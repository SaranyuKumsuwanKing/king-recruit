'use strict';
// Authentication helpers: password hashing (Node's built-in scrypt — no dependencies),
// and a small session store backed by a JSON file so logins survive a server restart.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const SESSIONS_PATH = path.join(DATA_DIR, 'sessions.json');
const COOKIE_NAME = 'kr_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

let sessions = {}; // token -> { userId, createdAt }

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_PATH)) sessions = JSON.parse(fs.readFileSync(SESSIONS_PATH, 'utf8'));
  } catch (e) {
    sessions = {};
  }
}

function saveSessions() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(SESSIONS_PATH, JSON.stringify(sessions));
  } catch (e) {
    /* non-fatal: worst case a restart logs users out */
  }
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(pw, stored) {
  if (!stored) return false;
  const parts = String(stored).split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const calc = crypto.scryptSync(String(pw), parts[1], 64).toString('hex');
  const a = Buffer.from(parts[2], 'hex');
  const b = Buffer.from(calc, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { userId, createdAt: Date.now() };
  saveSessions();
  return token;
}

function destroySession(token) {
  if (token && sessions[token]) {
    delete sessions[token];
    saveSessions();
  }
}

function getSession(token) {
  if (!token) return null;
  const s = sessions[token];
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL_MS) {
    destroySession(token);
    return null;
  }
  return s;
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((p) => {
    const idx = p.indexOf('=');
    if (idx > -1) out[p.slice(0, idx).trim()] = decodeURIComponent(p.slice(idx + 1).trim());
  });
  return out;
}

module.exports = {
  loadSessions,
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  getSession,
  parseCookies,
  COOKIE_NAME,
  SESSION_TTL_MS,
};
