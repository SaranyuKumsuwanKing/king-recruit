'use strict';
// All HTTP API endpoints, mounted under /api by server.js.

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { getDb, save } = require('./db');
const auth = require('./auth');
const mailer = require('./mailer');

const router = express.Router();

// Uploaded applicant files (photos, résumés, etc.) live on disk, NOT in db.json, so the
// database stays small. Only a filename reference is stored on the candidate.
const UPLOAD_DIR = path.join(__dirname, '..', 'data', 'uploads');
function ensureUploadDir() { if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true }); }

/* ----------------------------- helpers ----------------------------- */

function publicUser(u) {
  if (!u) return null;
  const { passwordHash, ...rest } = u;
  return { ...rest, hasLogin: !!u.passwordHash };
}
function findUser(id) { return getDb().users.find((u) => u.id === id); }
function findEmp(id) { return getDb().employees.find((e) => e.id === id); }
function isAdminUser(u) { return !!u && (u.role === 'admin' || u.admin === true); }

// The employee record a login user is linked to (a hiring manager owns their requisitions).
function userEmployee(u) { return u && u.employeeId ? findEmp(u.employeeId) : null; }

const num = (v) => (v === '' || v === null || v === undefined ? 0 : Number(v) || 0);
function ymd(d) { return typeof d === 'string' ? d.slice(0, 10) : new Date(d).toISOString().slice(0, 10); }
const now = () => Date.now();

// Pad a running counter into a REQ-0001 / CAND-0001 style code.
function nextCode(prefix, key) {
  const s = getDb().settings;
  s[key] = (s[key] || 0) + 1;
  return `${prefix}-${String(s[key]).padStart(4, '0')}`;
}

function stageById() { return Object.fromEntries(getDb().stages.map((s) => [s.id, s])); }
function activeStages() { return getDb().stages.filter((s) => s.type === 'active'); }
// Status of a candidate derived from the stage they sit in.
function candidateStatus(c) { const st = stageById()[c.currentStageId]; return st ? st.type : 'active'; }
// Requisitions a non-admin hiring manager owns (where they are the hiring manager).
function ownedReqIds(user) {
  const me = userEmployee(user);
  if (!me) return new Set();
  return new Set(getDb().requisitions.filter((r) => r.hiringManagerId === me.id).map((r) => r.id));
}

/* ------------------------- auth middleware ------------------------- */

router.use((req, res, next) => {
  const token = auth.parseCookies(req)[auth.COOKIE_NAME];
  const sess = auth.getSession(token);
  if (sess) {
    const u = findUser(sess.userId);
    if (u && u.active) { req.user = u; req.sessionToken = token; }
  }
  next();
});

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  if (!isAdminUser(req.user)) return res.status(403).json({ error: 'Administrator access only' });
  next();
}

/* ----------------------------- branding ---------------------------- */
router.get('/branding', (req, res) => {
  const s = getDb().settings;
  res.json({ appName: s.appName, logoDataUrl: s.logoDataUrl });
});

/* ===================================================================== */
/*  PUBLIC applicant portal (no login) — served at /apply                */
/* ===================================================================== */

// Branding + careers intro + PDPA text + the reference lists the form needs.
router.get('/public/config', (req, res) => {
  const s = getDb().settings;
  res.json({
    appName: s.appName,
    logoDataUrl: s.logoDataUrl,
    careers: s.careers || {},
    levels: getDb().levels,
    sources: getDb().sources,
  });
});

// Open + published requisitions, with only the fields an applicant should see.
router.get('/public/jobs', (req, res) => {
  const db = getDb();
  const jobs = db.requisitions
    .filter((r) => r.status === 'open' && r.published)
    .map((r) => ({
      id: r.id, code: r.code, title: r.title, department: r.department, area: r.area,
      level: r.level, employmentType: r.employmentType, shift: r.shift,
      description: r.description, requirements: r.requirements,
      screeningQuestions: (r.screeningQuestions || []).map((q) => ({ id: q.id, text: q.text, type: q.type })),
    }));
  res.json(jobs);
});

// One file at a time, sent as a data URL. Decoded and written to disk; only a reference
// is kept. Limited to images and PDFs, max ~6 MB each.
const UPLOAD_MIME = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif', 'application/pdf': 'pdf' };
router.post('/public/upload', (req, res) => {
  const { dataUrl, originalName, kind } = req.body || {};
  const m = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ''));
  if (!m) return res.status(400).json({ error: 'Expected a base64 data URL' });
  const ext = UPLOAD_MIME[m[1].toLowerCase()];
  if (!ext) return res.status(400).json({ error: 'Only image or PDF files are accepted' });
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > 6 * 1024 * 1024) return res.status(400).json({ error: 'File must be under 6 MB' });
  ensureUploadDir();
  const fileId = crypto.randomUUID() + '.' + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, fileId), buf);
  res.json({ fileId, originalName: String(originalName || 'file').slice(0, 160), size: buf.length, kind: String(kind || 'other') });
});

// Submit an application. Creates a candidate in the first stage, source = Online application.
router.post('/public/apply', (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const app = b.application || {};
  const p = app.personal || {};
  const pos = app.positions || {};
  if (!b.consent || !b.consent.accepted) return res.status(400).json({ error: 'Consent is required' });
  if (!b.certifiedTrue) return res.status(400).json({ error: 'Please certify the information is true' });
  const firstName = String(p.firstName || '').trim();
  const lastName = String(p.lastName || '').trim();
  const name = (firstName + ' ' + lastName).trim() || String(p.firstNameEn || '').trim();
  if (!name) return res.status(400).json({ error: 'Your name is required' });

  // sanitise uploaded-file references (must look like our stored ids and exist on disk)
  const documents = Array.isArray(b.documents) ? b.documents.filter((d) => d && typeof d.fileId === 'string' && /^[a-f0-9-]+\.(png|jpg|gif|pdf)$/i.test(d.fileId) && fs.existsSync(path.join(UPLOAD_DIR, d.fileId)))
    .map((d) => ({ kind: String(d.kind || 'other'), fileId: d.fileId, originalName: String(d.originalName || '').slice(0, 160), size: num(d.size), uploadedAt: now() })) : [];

  const reqId = pos.rank1 && db.requisitions.some((r) => r.id === pos.rank1) ? pos.rank1 : null;
  const reqObj = reqId ? db.requisitions.find((r) => r.id === reqId) : null;
  const screeningAnswers = Array.isArray(b.screeningAnswers) ? b.screeningAnswers.map((a) => ({ qid: String(a.qid || ''), question: String(a.question || '').slice(0, 300), answer: String(a.answer || '').slice(0, 1000) })) : [];

  const stageId = firstStageId();
  const candidate = {
    id: crypto.randomUUID(), code: nextCode('CAND', 'seqCand'), createdAt: now(), appliedAt: now(),
    editToken: crypto.randomUUID(), // lets the applicant reopen & edit without an account
    name, requisitionId: reqId, level: String(p.level || (reqObj ? reqObj.level : '') || '').trim(),
    source: 'online', currentStageId: stageId,
    phone: String(p.mobile || p.phone || '').trim(), email: String(p.email || '').trim(),
    expectedSalary: num(pos.expectedSalary), rating: 0, resumeUrl: '',
    notes: String(app.other && app.other.selfIntro ? app.other.selfIntro : '').slice(0, 4000),
    application: app, documents, screeningAnswers,
    consent: { accepted: true, at: now(), version: 'pdpa-1' }, certifiedTrue: true,
    history: [{ stageId, at: now(), note: 'Applied online' }],
  };
  db.candidates.push(candidate);
  save();
  const editLink = baseUrl(req) + '/apply#/edit/' + candidate.editToken;
  sendApplicationEmails(candidate, reqObj, editLink); // fire-and-forget
  res.json({ ok: true, code: candidate.code, editToken: candidate.editToken, editLink });
});

// Base public URL from the incoming request (honours a reverse-proxy Host header).
function baseUrl(req) { return req.protocol + '://' + req.get('host'); }

// Confirmation to the applicant + optional notification to HR. Never throws into the request.
function sendApplicationEmails(candidate, reqObj, editLink) {
  const s = getDb().settings;
  const email = s.email || {};
  if (!email.enabled || !mailer.available()) return;
  const posText = reqObj ? (' for ' + reqObj.title) : '';
  // applicant confirmation
  if (candidate.email) {
    const body = String(email.confirmBody || '')
      .replace(/\{name\}/g, candidate.name)
      .replace(/\{position\}/g, posText)
      .replace(/\{code\}/g, candidate.code)
      .replace(/\{editLink\}/g, editLink);
    mailer.send(email, { to: candidate.email, subject: email.confirmSubject || 'Application received', text: body })
      .catch((e) => console.warn('[mail] confirmation failed:', e.message));
  }
  // HR notification
  if (email.hrNotify) {
    const text = `New online application\n\nName: ${candidate.name}\nRef: ${candidate.code}\nPosition: ${reqObj ? reqObj.title : '(general)'}\nPhone: ${candidate.phone || '-'}\nEmail: ${candidate.email || '-'}`;
    mailer.send(email, { to: email.hrNotify, subject: `New application: ${candidate.name} (${candidate.code})`, text })
      .catch((e) => console.warn('[mail] HR notify failed:', e.message));
  }
}

/* -------- applicant self-service: view/update own application by token -------- */
function findByToken(token) {
  if (!token) return null;
  return getDb().candidates.find((c) => c.editToken && c.editToken === token) || null;
}
router.get('/public/application/:token', (req, res) => {
  const c = findByToken(req.params.token);
  if (!c) return res.status(404).json({ error: 'Application not found' });
  res.json({ code: c.code, requisitionId: c.requisitionId, application: c.application || {}, documents: c.documents || [], screeningAnswers: c.screeningAnswers || [] });
});
router.put('/public/application/:token', (req, res) => {
  const db = getDb();
  const c = findByToken(req.params.token);
  if (!c) return res.status(404).json({ error: 'Application not found' });
  const b = req.body || {};
  const app = b.application || {};
  const p = app.personal || {};
  const pos = app.positions || {};
  const name = ((String(p.firstName || '').trim() + ' ' + String(p.lastName || '').trim()).trim()) || String(p.firstNameEn || '').trim();
  if (!name) return res.status(400).json({ error: 'Your name is required' });
  const documents = Array.isArray(b.documents) ? b.documents.filter((d) => d && typeof d.fileId === 'string' && /^[a-f0-9-]+\.(png|jpg|gif|pdf)$/i.test(d.fileId) && fs.existsSync(path.join(UPLOAD_DIR, d.fileId)))
    .map((d) => ({ kind: String(d.kind || 'other'), fileId: d.fileId, originalName: String(d.originalName || '').slice(0, 160), size: num(d.size), uploadedAt: now() })) : c.documents;
  // applicant may re-point to a different open requisition
  const reqId = pos.rank1 && db.requisitions.some((r) => r.id === pos.rank1) ? pos.rank1 : c.requisitionId;
  c.name = name;
  c.requisitionId = reqId;
  c.phone = String(p.mobile || p.phone || '').trim();
  c.email = String(p.email || '').trim();
  c.expectedSalary = num(pos.expectedSalary);
  c.level = String(p.level || c.level || '').trim();
  c.notes = String(app.other && app.other.selfIntro ? app.other.selfIntro : c.notes || '').slice(0, 4000);
  c.application = app;
  c.documents = documents;
  if (Array.isArray(b.screeningAnswers)) c.screeningAnswers = b.screeningAnswers.map((a) => ({ qid: String(a.qid || ''), question: String(a.question || '').slice(0, 300), answer: String(a.answer || '').slice(0, 1000) }));
  c.history = c.history || [];
  c.history.push({ stageId: c.currentStageId, at: now(), note: 'Updated by applicant' });
  save();
  res.json({ ok: true, code: c.code });
});

/* ------------------------------- auth ------------------------------ */
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = getDb().users.find((x) => x.username && x.username.toLowerCase() === String(username || '').toLowerCase());
  if (!u || !u.active || !u.passwordHash || !auth.verifyPassword(password || '', u.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect username or password' });
  }
  const token = auth.createSession(u.id);
  res.cookie(auth.COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: auth.SESSION_TTL_MS });
  res.json({ user: publicUser(u) });
});

router.post('/logout', (req, res) => {
  if (req.sessionToken) auth.destroySession(req.sessionToken);
  res.clearCookie(auth.COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: { ...publicUser(req.user), reqCount: ownedReqIds(req.user).size } });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  if (!auth.verifyPassword(currentPassword || '', req.user.passwordHash)) return res.status(400).json({ error: 'Current password is incorrect' });
  req.user.passwordHash = auth.hashPassword(newPassword);
  req.user.mustChangePassword = false;
  save();
  res.json({ ok: true });
});

/* ----------------------------- settings ---------------------------- */
// The SMTP password is never returned — only a flag saying whether one is stored.
function safeSettings(s) {
  const email = s.email || {};
  const { password, ...emailRest } = email;
  return { ...s, email: { ...emailRest, hasPassword: !!password }, emailAvailable: mailer.available() };
}
router.get('/settings', requireAdmin, (req, res) => res.json(safeSettings(getDb().settings)));

router.put('/settings', requireAdmin, (req, res) => {
  const s = getDb().settings;
  const b = req.body || {};
  if (typeof b.appName === 'string' && b.appName.trim()) s.appName = b.appName.trim();
  if (typeof b.currency === 'string' && b.currency.trim()) s.currency = b.currency.trim();
  if (b.tzOffsetMinutes !== undefined) s.tzOffsetMinutes = num(b.tzOffsetMinutes);
  if (b.careers && typeof b.careers === 'object') {
    s.careers = s.careers || {};
    for (const k of ['intro', 'introTh', 'pdpa', 'pdpaTh']) {
      if (typeof b.careers[k] === 'string') s.careers[k] = b.careers[k];
    }
  }
  if (b.email && typeof b.email === 'object') {
    s.email = s.email || {};
    const e = b.email;
    if (e.enabled !== undefined) s.email.enabled = !!e.enabled;
    if (typeof e.host === 'string') s.email.host = e.host.trim();
    if (e.port !== undefined) s.email.port = num(e.port) || 587;
    if (e.secure !== undefined) s.email.secure = !!e.secure;
    if (typeof e.user === 'string') s.email.user = e.user.trim();
    if (typeof e.fromName === 'string') s.email.fromName = e.fromName;
    if (typeof e.fromEmail === 'string') s.email.fromEmail = e.fromEmail.trim();
    if (typeof e.hrNotify === 'string') s.email.hrNotify = e.hrNotify.trim();
    if (typeof e.confirmSubject === 'string') s.email.confirmSubject = e.confirmSubject;
    if (typeof e.confirmBody === 'string') s.email.confirmBody = e.confirmBody;
    // only overwrite the stored password when a non-empty new one is supplied
    if (typeof e.password === 'string' && e.password.length) s.email.password = e.password;
  }
  save();
  res.json(safeSettings(s));
});

// Send a test email to confirm the SMTP settings work.
router.post('/settings/test-email', requireAdmin, async (req, res) => {
  const s = getDb().settings;
  const to = String((req.body && req.body.to) || '').trim();
  if (!to) return res.status(400).json({ error: 'Enter an address to send the test to' });
  if (!s.email || !s.email.enabled) return res.status(400).json({ error: 'Enable email and save the settings first' });
  if (!mailer.available()) return res.status(400).json({ error: 'Email library not installed — run "npm install" on the server' });
  try {
    await mailer.send(s.email, { to, subject: 'King Recruit — test email', text: 'This is a test email from King Recruit. If you received this, your SMTP settings are working.' });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.put('/settings/logo', requireAdmin, (req, res) => {
  const { dataUrl } = req.body || {};
  if (dataUrl !== null && !(typeof dataUrl === 'string' && dataUrl.startsWith('data:image/'))) {
    return res.status(400).json({ error: 'Logo must be an image file' });
  }
  getDb().settings.logoDataUrl = dataUrl;
  save();
  res.json({ ok: true });
});

/* ------------------------ setup: stages ---------------------------- */
router.get('/stages', requireAuth, (req, res) => res.json(getDb().stages));

router.put('/stages', requireAdmin, (req, res) => {
  const list = Array.isArray(req.body && req.body.stages) ? req.body.stages : null;
  if (!list) return res.status(400).json({ error: 'Expected a list of stages' });
  const valid = new Set(['active', 'won', 'lost']);
  getDb().stages = list.map((s) => ({
    id: String(s.id || crypto.randomUUID()).trim() || crypto.randomUUID(),
    name: String(s.name || 'Stage').trim(),
    type: valid.has(s.type) ? s.type : 'active',
  }));
  save();
  res.json(getDb().stages);
});

/* ------------------------ setup: levels ---------------------------- */
router.get('/levels', requireAuth, (req, res) => res.json(getDb().levels));
router.put('/levels', requireAdmin, (req, res) => {
  const list = Array.isArray(req.body && req.body.levels) ? req.body.levels : null;
  if (!list) return res.status(400).json({ error: 'Expected a list of levels' });
  getDb().levels = list.map((x) => String(x || '').trim()).filter(Boolean);
  save();
  res.json(getDb().levels);
});

/* ------------------------ setup: sources --------------------------- */
router.get('/sources', requireAuth, (req, res) => res.json(getDb().sources));
router.put('/sources', requireAdmin, (req, res) => {
  const list = Array.isArray(req.body && req.body.sources) ? req.body.sources : null;
  if (!list) return res.status(400).json({ error: 'Expected a list of sources' });
  getDb().sources = list.map((x) => ({ id: String(x.id || crypto.randomUUID()), name: String(x.name || '').trim() || 'Source' }));
  save();
  res.json(getDb().sources);
});

/* ------------------------ setup: scorecard ------------------------- */
router.get('/scorecard', requireAuth, (req, res) => res.json(getDb().scorecard));
router.put('/scorecard', requireAdmin, (req, res) => {
  const list = Array.isArray(req.body && req.body.scorecard) ? req.body.scorecard : null;
  if (!list) return res.status(400).json({ error: 'Expected a list of criteria' });
  getDb().scorecard = list.map((c) => ({
    id: String(c.id || crypto.randomUUID()),
    name: String(c.name || '').trim() || 'Criterion',
    group: c.group === 'management' ? 'management' : 'general',
  }));
  save();
  res.json(getDb().scorecard);
});

/* ------------------------------ people ----------------------------- */
// The org / people directory — hiring managers and interviewers. Read by everyone signed in;
// only an administrator can add, edit, import or remove.
router.get('/employees', requireAuth, (req, res) => {
  const list = getDb().employees.slice();
  list.sort((a, b) => (a.empCode || '').localeCompare(b.empCode || '') || (a.name || '').localeCompare(b.name || ''));
  res.json(list);
});

function normalizeEmpInput(b, existing) {
  const e = existing || {};
  return {
    empCode: b.empCode !== undefined ? String(b.empCode).trim() : e.empCode || '',
    name: b.name !== undefined ? String(b.name).trim() : e.name || '',
    department: b.department !== undefined ? String(b.department).trim() : e.department || '',
    area: b.area !== undefined ? String(b.area).trim() : e.area || '',
    costCenter: b.costCenter !== undefined ? String(b.costCenter).trim() : e.costCenter || '',
    position: b.position !== undefined ? String(b.position).trim() : e.position || '',
    level: b.level !== undefined ? String(b.level).trim() : e.level || '',
    email: b.email !== undefined ? String(b.email).trim() : e.email || '',
    phone: b.phone !== undefined ? String(b.phone).trim() : e.phone || '',
    managerId: b.managerId !== undefined ? (b.managerId || null) : (e.managerId || null),
    active: b.active !== undefined ? !!b.active : (e.active !== false),
  };
}

router.post('/employees', requireAdmin, (req, res) => {
  const db = getDb();
  const b = req.body || {};
  if (!b.name && !b.empCode) return res.status(400).json({ error: 'A name or staff code is required' });
  if (b.empCode && db.employees.some((e) => e.empCode && e.empCode.toLowerCase() === String(b.empCode).toLowerCase())) {
    return res.status(400).json({ error: 'That staff code already exists' });
  }
  const emp = { id: crypto.randomUUID(), createdAt: now(), ...normalizeEmpInput(b, null) };
  db.employees.push(emp);
  save();
  res.json(emp);
});

router.put('/employees/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const emp = db.employees.find((e) => e.id === req.params.id);
  if (!emp) return res.status(404).json({ error: 'Person not found' });
  const b = req.body || {};
  if (b.empCode && db.employees.some((e) => e !== emp && e.empCode && e.empCode.toLowerCase() === String(b.empCode).toLowerCase())) {
    return res.status(400).json({ error: 'That staff code already exists' });
  }
  if (b.managerId && b.managerId === emp.id) return res.status(400).json({ error: 'A person cannot report to themselves' });
  // reporting-loop guard
  if (b.managerId) {
    let cur = findEmp(b.managerId), hops = 0;
    while (cur && hops++ < 200) {
      if (cur.id === emp.id) return res.status(400).json({ error: 'That would create a reporting loop' });
      cur = cur.managerId ? findEmp(cur.managerId) : null;
    }
  }
  Object.assign(emp, normalizeEmpInput(b, emp));
  save();
  res.json(emp);
});

router.delete('/employees/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const emp = db.employees.find((e) => e.id === req.params.id);
  if (!emp) return res.status(404).json({ error: 'Person not found' });
  db.employees.forEach((e) => { if (e.managerId === emp.id) e.managerId = emp.managerId || null; });
  db.employees = db.employees.filter((e) => e.id !== emp.id);
  db.requisitions.forEach((r) => { if (r.hiringManagerId === emp.id) r.hiringManagerId = null; });
  db.interviews.forEach((i) => { if (i.interviewerId === emp.id) i.interviewerId = null; });
  db.users.forEach((u) => { if (u.employeeId === emp.id) u.employeeId = null; });
  save();
  res.json({ ok: true });
});

// Bulk import / upsert of the org list (matched by empCode). Accepts the King Time export.
router.post('/employees/import', requireAdmin, (req, res) => {
  const db = getDb();
  const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : null;
  if (!rows) return res.status(400).json({ error: 'Expected rows to import' });
  let created = 0, updated = 0, skipped = 0;
  for (const row of rows) {
    const code = String(row.empCode || row.code || '').trim();
    if (!code && !row.name) { skipped += 1; continue; }
    let emp = code ? db.employees.find((e) => e.empCode && e.empCode.toLowerCase() === code.toLowerCase()) : null;
    if (emp) { Object.assign(emp, normalizeEmpInput(row, emp)); updated += 1; }
    else { db.employees.push({ id: crypto.randomUUID(), createdAt: now(), ...normalizeEmpInput(row, null) }); created += 1; }
  }
  save();
  res.json({ created, updated, skipped, total: db.employees.length });
});

/* --------------------------- requisitions -------------------------- */
function reqFilled(db, reqId) {
  return db.candidates.filter((c) => c.requisitionId === reqId && candidateStatus(c) === 'won').length;
}
function reqActive(db, reqId) {
  return db.candidates.filter((c) => c.requisitionId === reqId && candidateStatus(c) === 'active').length;
}
function decorateReq(db, r) {
  return { ...r, filled: reqFilled(db, r.id), activeCandidates: reqActive(db, r.id), totalCandidates: db.candidates.filter((c) => c.requisitionId === r.id).length };
}

router.get('/requisitions', requireAuth, (req, res) => {
  const db = getDb();
  let list = db.requisitions.slice();
  if (!isAdminUser(req.user)) { const ids = ownedReqIds(req.user); list = list.filter((r) => ids.has(r.id)); }
  list = list.map((r) => decorateReq(db, r));
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  res.json(list);
});

const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const REQ_STATUS = new Set(['draft', 'open', 'on-hold', 'filled', 'closed']);
function normalizeReq(b, existing) {
  const e = existing || {};
  return {
    title: b.title !== undefined ? String(b.title).trim() : e.title || '',
    department: b.department !== undefined ? String(b.department).trim() : e.department || '',
    area: b.area !== undefined ? String(b.area).trim() : e.area || '',
    costCenter: b.costCenter !== undefined ? String(b.costCenter).trim() : e.costCenter || '',
    level: b.level !== undefined ? String(b.level).trim() : e.level || '',
    headcount: b.headcount !== undefined ? Math.max(1, num(b.headcount)) : (e.headcount || 1),
    employmentType: b.employmentType !== undefined ? String(b.employmentType).trim() : (e.employmentType || 'full-time'),
    shift: b.shift !== undefined ? String(b.shift).trim() : (e.shift || ''),
    priority: PRIORITIES.has(b.priority) ? b.priority : (e.priority || 'normal'),
    status: REQ_STATUS.has(b.status) ? b.status : (e.status || 'open'),
    salaryMin: b.salaryMin !== undefined ? num(b.salaryMin) : (e.salaryMin || 0),
    salaryMax: b.salaryMax !== undefined ? num(b.salaryMax) : (e.salaryMax || 0),
    hiringManagerId: b.hiringManagerId !== undefined ? (b.hiringManagerId || null) : (e.hiringManagerId || null),
    hiringManagerName: b.hiringManagerName !== undefined ? String(b.hiringManagerName).trim() : (e.hiringManagerName || ''),
    openedAt: b.openedAt !== undefined && b.openedAt ? new Date(b.openedAt).getTime() : (e.openedAt || now()),
    description: b.description !== undefined ? String(b.description) : (e.description || ''),
    requirements: b.requirements !== undefined ? String(b.requirements) : (e.requirements || ''),
    targetDate: b.targetDate !== undefined ? (b.targetDate ? ymd(b.targetDate) : '') : (e.targetDate || ''),
    published: b.published !== undefined ? !!b.published : (e.published || false),
    screeningQuestions: Array.isArray(b.screeningQuestions)
      ? b.screeningQuestions.map((q) => ({ id: String(q.id || crypto.randomUUID()), text: String(q.text || '').trim(), type: q.type === 'text' ? 'text' : 'yesno', knockout: !!q.knockout })).filter((q) => q.text)
      : (e.screeningQuestions || []),
  };
}

router.post('/requisitions', requireAdmin, (req, res) => {
  const db = getDb();
  const b = req.body || {};
  if (!b.title) return res.status(400).json({ error: 'A job title is required' });
  const r = { id: crypto.randomUUID(), code: nextCode('REQ', 'seqReq'), createdAt: now(), openedAt: now(), ...normalizeReq(b, null) };
  db.requisitions.push(r);
  save();
  res.json(decorateReq(db, r));
});

router.put('/requisitions/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const r = db.requisitions.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Requisition not found' });
  Object.assign(r, normalizeReq(req.body || {}, r));
  save();
  res.json(decorateReq(db, r));
});

router.delete('/requisitions/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const r = db.requisitions.find((x) => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Requisition not found' });
  db.requisitions = db.requisitions.filter((x) => x.id !== r.id);
  // detach candidates from the deleted requisition (keep the candidate records)
  db.candidates.forEach((c) => { if (c.requisitionId === r.id) c.requisitionId = null; });
  save();
  res.json({ ok: true });
});

/* ----------------------------- candidates -------------------------- */
function firstStageId() { const a = activeStages(); return (a[0] && a[0].id) || (getDb().stages[0] && getDb().stages[0].id) || 'applied'; }
function decorateCand(db, c) {
  const req = c.requisitionId ? db.requisitions.find((r) => r.id === c.requisitionId) : null;
  return { ...c, status: candidateStatus(c), requisitionTitle: req ? req.title : '', requisitionCode: req ? req.code : '' };
}
function candidateVisible(user, c) {
  if (isAdminUser(user)) return true;
  return ownedReqIds(user).has(c.requisitionId);
}

router.get('/candidates', requireAuth, (req, res) => {
  const db = getDb();
  let list = db.candidates.filter((c) => candidateVisible(req.user, c));
  if (req.query.requisitionId) list = list.filter((c) => c.requisitionId === req.query.requisitionId);
  if (req.query.stageId) list = list.filter((c) => c.currentStageId === req.query.stageId);
  list = list.map((c) => decorateCand(db, c));
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  res.json(list);
});

function normalizeCand(b, existing) {
  const e = existing || {};
  return {
    name: b.name !== undefined ? String(b.name).trim() : e.name || '',
    requisitionId: b.requisitionId !== undefined ? (b.requisitionId || null) : (e.requisitionId || null),
    level: b.level !== undefined ? String(b.level).trim() : e.level || '',
    source: b.source !== undefined ? String(b.source).trim() : e.source || '',
    phone: b.phone !== undefined ? String(b.phone).trim() : e.phone || '',
    email: b.email !== undefined ? String(b.email).trim() : e.email || '',
    expectedSalary: b.expectedSalary !== undefined ? num(b.expectedSalary) : (e.expectedSalary || 0),
    rating: b.rating !== undefined ? Math.max(0, Math.min(5, num(b.rating))) : (e.rating || 0),
    resumeUrl: b.resumeUrl !== undefined ? String(b.resumeUrl).trim() : (e.resumeUrl || ''),
    notes: b.notes !== undefined ? String(b.notes) : (e.notes || ''),
  };
}

router.post('/candidates', requireAuth, (req, res) => {
  const db = getDb();
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: "The candidate's name is required" });
  if (!isAdminUser(req.user) && b.requisitionId && !ownedReqIds(req.user).has(b.requisitionId)) {
    return res.status(403).json({ error: 'You can only add candidates to your own requisitions' });
  }
  const fields = normalizeCand(b, null);
  // default the level from the requisition if not given
  if (!fields.level && fields.requisitionId) { const r = db.requisitions.find((x) => x.id === fields.requisitionId); if (r) fields.level = r.level; }
  const stageId = b.currentStageId && stageById()[b.currentStageId] ? b.currentStageId : firstStageId();
  const c = {
    id: crypto.randomUUID(), code: nextCode('CAND', 'seqCand'), createdAt: now(), appliedAt: now(),
    currentStageId: stageId, ...fields,
    history: [{ stageId, at: now(), by: req.user.id, note: 'Applied' }],
  };
  db.candidates.push(c);
  save();
  res.json(decorateCand(db, c));
});

router.put('/candidates/:id', requireAuth, (req, res) => {
  const db = getDb();
  const c = db.candidates.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Candidate not found' });
  if (!candidateVisible(req.user, c)) return res.status(403).json({ error: 'Forbidden' });
  Object.assign(c, normalizeCand(req.body || {}, c));
  save();
  res.json(decorateCand(db, c));
});

// Move a candidate to another pipeline stage (board drag / list buttons).
router.post('/candidates/:id/stage', requireAuth, (req, res) => {
  const db = getDb();
  const c = db.candidates.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Candidate not found' });
  if (!candidateVisible(req.user, c)) return res.status(403).json({ error: 'Forbidden' });
  const stageId = (req.body && req.body.stageId) || '';
  if (!stageById()[stageId]) return res.status(400).json({ error: 'Unknown stage' });
  if (stageId !== c.currentStageId) {
    c.currentStageId = stageId;
    c.history = c.history || [];
    c.history.push({ stageId, at: now(), by: req.user.id, note: String((req.body && req.body.note) || '') });
  }
  save();
  res.json(decorateCand(db, c));
});

router.delete('/candidates/:id', requireAuth, (req, res) => {
  const db = getDb();
  const c = db.candidates.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Candidate not found' });
  if (!candidateVisible(req.user, c)) return res.status(403).json({ error: 'Forbidden' });
  db.candidates = db.candidates.filter((x) => x.id !== c.id);
  db.interviews = db.interviews.filter((i) => i.candidateId !== c.id);
  save();
  res.json({ ok: true });
});

router.post('/candidates/import', requireAdmin, (req, res) => {
  const db = getDb();
  const rows = Array.isArray(req.body && req.body.rows) ? req.body.rows : null;
  if (!rows) return res.status(400).json({ error: 'Expected rows to import' });
  let created = 0, skipped = 0;
  const stageId = firstStageId();
  for (const row of rows) {
    if (!row.name) { skipped += 1; continue; }
    const fields = normalizeCand(row, null);
    db.candidates.push({ id: crypto.randomUUID(), code: nextCode('CAND', 'seqCand'), createdAt: now(), appliedAt: now(), currentStageId: stageId, ...fields, history: [{ stageId, at: now(), note: 'Imported' }] });
    created += 1;
  }
  save();
  res.json({ created, skipped, total: db.candidates.length });
});

/* ----------------------------- interviews -------------------------- */
function decorateInterview(db, i) {
  const c = db.candidates.find((x) => x.id === i.candidateId);
  const interviewer = i.interviewerId ? db.employees.find((e) => e.id === i.interviewerId) : null;
  return { ...i, candidateName: c ? c.name : '(deleted)', candidateCode: c ? c.code : '', interviewerName: interviewer ? interviewer.name : (i.interviewerName || '') };
}

router.get('/interviews', requireAuth, (req, res) => {
  const db = getDb();
  let list = db.interviews.slice();
  if (!isAdminUser(req.user)) {
    const ids = ownedReqIds(req.user);
    list = list.filter((i) => { const c = db.candidates.find((x) => x.id === i.candidateId); return c && ids.has(c.requisitionId); });
  }
  if (req.query.candidateId) list = list.filter((i) => i.candidateId === req.query.candidateId);
  list = list.map((i) => decorateInterview(db, i));
  list.sort((a, b) => String(b.scheduledAt || '').localeCompare(String(a.scheduledAt || '')));
  res.json(list);
});

const REC = new Set(['strong-yes', 'yes', 'maybe', 'no']);
function normalizeInterview(b, existing) {
  const e = existing || {};
  const scores = (b.scores && typeof b.scores === 'object') ? b.scores : (e.scores || {});
  const cleanScores = {};
  for (const [k, v] of Object.entries(scores)) { const n = num(v); if (n > 0) cleanScores[k] = Math.max(0, Math.min(5, n)); }
  return {
    candidateId: b.candidateId !== undefined ? b.candidateId : e.candidateId,
    interviewerId: b.interviewerId !== undefined ? (b.interviewerId || null) : (e.interviewerId || null),
    interviewerName: b.interviewerName !== undefined ? String(b.interviewerName).trim() : (e.interviewerName || ''),
    type: b.type !== undefined ? String(b.type).trim() : (e.type || 'onsite'),
    scheduledAt: b.scheduledAt !== undefined ? String(b.scheduledAt) : (e.scheduledAt || ''),
    location: b.location !== undefined ? String(b.location).trim() : (e.location || ''),
    status: ['scheduled', 'completed', 'cancelled'].includes(b.status) ? b.status : (e.status || 'scheduled'),
    scores: cleanScores,
    recommendation: REC.has(b.recommendation) ? b.recommendation : (e.recommendation || ''),
    notes: b.notes !== undefined ? String(b.notes) : (e.notes || ''),
  };
}

router.post('/interviews', requireAuth, (req, res) => {
  const db = getDb();
  const b = req.body || {};
  const c = db.candidates.find((x) => x.id === b.candidateId);
  if (!c) return res.status(400).json({ error: 'Choose a candidate' });
  if (!candidateVisible(req.user, c)) return res.status(403).json({ error: 'Forbidden' });
  const i = { id: crypto.randomUUID(), createdAt: now(), ...normalizeInterview(b, null) };
  db.interviews.push(i);
  save();
  res.json(decorateInterview(db, i));
});

router.put('/interviews/:id', requireAuth, (req, res) => {
  const db = getDb();
  const i = db.interviews.find((x) => x.id === req.params.id);
  if (!i) return res.status(404).json({ error: 'Interview not found' });
  const c = db.candidates.find((x) => x.id === i.candidateId);
  if (c && !candidateVisible(req.user, c)) return res.status(403).json({ error: 'Forbidden' });
  Object.assign(i, normalizeInterview(req.body || {}, i));
  save();
  res.json(decorateInterview(db, i));
});

router.delete('/interviews/:id', requireAuth, (req, res) => {
  const db = getDb();
  const i = db.interviews.find((x) => x.id === req.params.id);
  if (!i) return res.status(404).json({ error: 'Interview not found' });
  db.interviews = db.interviews.filter((x) => x.id !== i.id);
  save();
  res.json({ ok: true });
});

/* ------------------------------ dashboard -------------------------- */
// Recruitment snapshot: open requisitions, pipeline funnel, hires, breakdowns. Filterable
// by department and level. Admin/HR see everything; a hiring manager is scoped to their reqs.
router.get('/dashboard', requireAuth, (req, res) => {
  const db = getDb();
  let reqs = db.requisitions.slice();
  if (!isAdminUser(req.user)) { const ids = ownedReqIds(req.user); reqs = reqs.filter((r) => ids.has(r.id)); }
  if (req.query.department) reqs = reqs.filter((r) => r.department === req.query.department);
  if (req.query.level) reqs = reqs.filter((r) => r.level === req.query.level);
  const reqIds = new Set(reqs.map((r) => r.id));

  let cands = db.candidates.filter((c) => reqIds.has(c.requisitionId) || (isAdminUser(req.user) && !c.requisitionId && !req.query.department && !req.query.level));
  // when a hiring manager is scoped, only their candidates count
  if (!isAdminUser(req.user)) cands = db.candidates.filter((c) => reqIds.has(c.requisitionId));

  const sById = stageById();
  const openReqs = reqs.filter((r) => r.status === 'open').length;
  const totalOpenings = reqs.filter((r) => ['open', 'on-hold'].includes(r.status)).reduce((t, r) => t + (r.headcount || 1), 0);
  const inPipeline = cands.filter((c) => (sById[c.currentStageId] || {}).type === 'active').length;

  // hires this calendar month (by the time they entered a 'won' stage)
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const hiresThisMonth = cands.filter((c) => {
    if ((sById[c.currentStageId] || {}).type !== 'won') return false;
    const h = (c.history || []).filter((x) => (sById[x.stageId] || {}).type === 'won').pop();
    return h && h.at >= monthStart.getTime();
  }).length;

  const upcomingInterviews = db.interviews.filter((i) => {
    if (i.status !== 'scheduled') return false;
    const c = db.candidates.find((x) => x.id === i.candidateId);
    return c && reqIds.has(c.requisitionId);
  }).length;

  // funnel: candidate count per stage, in stage order
  const funnel = db.stages.map((s) => ({ id: s.id, name: s.name, type: s.type, count: cands.filter((c) => c.currentStageId === s.id).length }));

  // breakdown by level + by source (active candidates)
  const active = cands.filter((c) => (sById[c.currentStageId] || {}).type === 'active');
  const byLevel = tally(active.map((c) => c.level || '—'));
  const sourceName = Object.fromEntries(db.sources.map((s) => [s.id, s.name]));
  const bySource = tally(cands.map((c) => sourceName[c.source] || c.source || '—'));

  res.json({
    openReqs, totalOpenings, inPipeline, hiresThisMonth, upcomingInterviews,
    totalReqs: reqs.length, totalCandidates: cands.length,
    funnel, byLevel, bySource,
    requisitions: reqs.map((r) => decorateReq(db, r)).filter((r) => ['open', 'on-hold'].includes(r.status))
      .sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority)).slice(0, 8),
    departments: [...new Set(db.requisitions.map((r) => r.department).filter(Boolean))].sort(),
    levels: db.levels,
  });
});
function tally(arr) {
  const m = {};
  arr.forEach((k) => { m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}
function priorityRank(p) { return ({ urgent: 0, high: 1, normal: 2, low: 3 })[p] ?? 2; }

/* ------------------------- users (logins) -------------------------- */
router.get('/users', requireAdmin, (req, res) => res.json(getDb().users.map(publicUser)));

router.post('/users', requireAdmin, (req, res) => {
  const db = getDb();
  const { name, username, password, admin, employeeId, title } = req.body || {};
  if (!username || !String(username).trim()) return res.status(400).json({ error: 'A username is required' });
  if (db.users.some((u) => u.username && u.username.toLowerCase() === String(username).toLowerCase())) {
    return res.status(400).json({ error: 'That username is already taken' });
  }
  const u = {
    id: crypto.randomUUID(), username: String(username).trim(), name: String(name || '').trim(),
    title: String(title || '').trim(), role: 'member', admin: !!admin, employeeId: employeeId || null,
    passwordHash: null, mustChangePassword: false, active: false, createdAt: now(),
  };
  if (password) {
    if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    u.passwordHash = auth.hashPassword(password);
    u.mustChangePassword = true;
    u.active = true;
  }
  db.users.push(u);
  save();
  res.json(publicUser(u));
});

router.put('/users/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const b = req.body || {};
  if (typeof b.name === 'string') u.name = b.name.trim();
  if (typeof b.title === 'string') u.title = b.title.trim();
  if (b.employeeId !== undefined) u.employeeId = b.employeeId || null;
  if (typeof b.admin === 'boolean' && u.role !== 'admin') u.admin = b.admin;
  if (typeof b.username === 'string' && b.username.trim()) {
    if (db.users.some((x) => x !== u && x.username && x.username.toLowerCase() === b.username.toLowerCase())) {
      return res.status(400).json({ error: 'That username is already taken' });
    }
    u.username = b.username.trim();
  }
  if (typeof b.active === 'boolean') {
    if (b.active && !u.passwordHash) return res.status(400).json({ error: 'Set a password before activating' });
    if (!b.active && u.role === 'admin') return res.status(400).json({ error: 'Cannot deactivate an administrator' });
    u.active = b.active;
  }
  save();
  res.json(publicUser(u));
});

router.post('/users/:id/password', requireAdmin, (req, res) => {
  const u = getDb().users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const { password } = req.body || {};
  if (!password || String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  u.passwordHash = auth.hashPassword(password);
  u.mustChangePassword = true;
  u.active = true;
  save();
  res.json({ ok: true });
});

router.delete('/users/:id', requireAdmin, (req, res) => {
  const db = getDb();
  const u = db.users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.id === req.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  if (u.role === 'admin') return res.status(400).json({ error: 'Cannot delete an administrator' });
  db.users = db.users.filter((x) => x.id !== u.id);
  save();
  res.json({ ok: true });
});

/* ------------------- applicant uploads (HR view) ------------------- */
// Stream a file an applicant uploaded. Auth required; filename is strictly validated
// to block any path traversal.
router.get('/uploads/:fileId', requireAuth, (req, res) => {
  const fileId = String(req.params.fileId || '');
  if (!/^[a-f0-9-]+\.(png|jpg|gif|pdf)$/i.test(fileId)) return res.status(400).json({ error: 'Bad file id' });
  const full = path.join(UPLOAD_DIR, fileId);
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'File not found' });
  if (req.query.download) res.setHeader('Content-Disposition', 'attachment; filename="' + (req.query.name ? String(req.query.name).replace(/[^\w. -]/g, '_') : fileId) + '"');
  res.sendFile(full);
});

/* ------------------------- data export ----------------------------- */
router.get('/export', requireAdmin, (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="king-recruit-backup.json"');
  res.send(JSON.stringify(getDb(), null, 2));
});

module.exports = router;
