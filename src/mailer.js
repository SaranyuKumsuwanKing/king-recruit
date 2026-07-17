'use strict';
// Thin wrapper around nodemailer. nodemailer is lazy-required so the app still boots and
// runs even if the package hasn't been installed yet (email just stays unavailable).

let nodemailer = null;
let loadError = null;
function load() {
  if (nodemailer || loadError) return nodemailer;
  try { nodemailer = require('nodemailer'); }
  catch (e) { loadError = e; }
  return nodemailer;
}
function available() { return !!load(); }

function transport(email) {
  const nm = load();
  if (!nm) throw new Error('Email library not installed. Run "npm install" on the server.');
  if (!email || !email.host) throw new Error('SMTP server is not configured.');
  return nm.createTransport({
    host: email.host,
    port: Number(email.port) || 587,
    secure: !!email.secure, // true = 465/SSL, false = STARTTLS (587)
    auth: email.user ? { user: email.user, pass: email.password || '' } : undefined,
  });
}

function fromField(email) {
  const addr = email.fromEmail || email.user;
  return email.fromName ? `"${email.fromName}" <${addr}>` : addr;
}

// Send one message. Returns a promise; callers may fire-and-forget for non-critical mail.
async function send(email, { to, subject, text, html, cc }) {
  const t = transport(email);
  return t.sendMail({ from: fromField(email), to, cc, subject, text, html });
}

module.exports = { available, send };
