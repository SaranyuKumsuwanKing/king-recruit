// Everyone applying across all roles. Filter, rate, move through the pipeline, and open a
// candidate to see their stage history or schedule an interview.
import { api } from '../api.js';
import { state, isAdmin, currency, stageName, sourceName } from '../state.js';
import { h, mount, clear, field, input, select, textarea, toast, openModal, confirmDialog, initials, money, icon } from '../ui.js';
import { t } from '../i18n.js';
import { exportMenu } from '../export.js';
import { openInterview } from './interviews.js';

let cache = [];
let reqs = [];
const filters = { q: '', requisitionId: '', stageId: '', level: '', source: '' };
const selected = new Set(); // candidate ids ticked for side-by-side compare

function applyFilters(list) {
  const q = filters.q.trim().toLowerCase();
  return list.filter((c) =>
    (!filters.requisitionId || c.requisitionId === filters.requisitionId) &&
    (!filters.stageId || c.currentStageId === filters.stageId) &&
    (!filters.level || c.level === filters.level) &&
    (!filters.source || c.source === filters.source) &&
    (!q || (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q))
  );
}

export async function render(root, params) {
  if (params && params[0]) filters.requisitionId = params[0]; // deep-link from a requisition
  [cache, reqs] = await Promise.all([api.get('/candidates'), api.get('/requisitions')]);
  const card = h('div', { class: 'card' });
  const countChip = h('span', { class: 'chip muted' }, '');
  const tableHost = h('div', {});
  const rebuild = async () => { cache = await api.get('/candidates'); paint(); };
  const reqLabel = (id) => { const r = reqs.find((x) => x.id === id); return r ? r.code + ' · ' + r.title : t('cand.noReq'); };

  function refreshTable() {
    const list = applyFilters(cache);
    countChip.textContent = list.length === cache.length ? String(cache.length) : `${list.length} / ${cache.length}`;
    mount(tableHost, table(list, rebuild));
  }
  function paint() {
    clear(card);
    const searchBox = input({ placeholder: t('cand.searchPlaceholder'), value: filters.q, style: { maxWidth: '220px' } });
    searchBox.addEventListener('input', () => { filters.q = searchBox.value; refreshTable(); });
    const reqSel = select([{ value: '', label: t('cand.allReqs') }, ...reqs.map((r) => ({ value: r.id, label: r.code + ' · ' + r.title }))], { value: filters.requisitionId, style: 'width:auto' });
    reqSel.addEventListener('change', () => { filters.requisitionId = reqSel.value; refreshTable(); });
    const stageSel = select([{ value: '', label: t('cand.allStages') }, ...state.stages.map((s) => ({ value: s.id, label: s.name }))], { value: filters.stageId, style: 'width:auto' });
    stageSel.addEventListener('change', () => { filters.stageId = stageSel.value; refreshTable(); });
    const lvlSel = select([{ value: '', label: t('cand.allLevels') }, ...state.levels.map((l) => ({ value: l, label: l }))], { value: filters.level, style: 'width:auto' });
    lvlSel.addEventListener('change', () => { filters.level = lvlSel.value; refreshTable(); });
    const clearBtn = h('button', { class: 'btn btn-sm btn-ghost', onClick: () => { filters.q = ''; filters.requisitionId = ''; filters.stageId = ''; filters.level = ''; filters.source = ''; paint(); } }, t('common.clear'));

    card.append(
      h('div', { class: 'card__head' },
        h('h3', {}, t('nav.candidates')), countChip, h('div', { class: 'topbar__spacer' }),
        exportMenu('candidates', [
          { key: 'code', label: t('cand.code') }, { key: 'name', label: t('common.name') },
          { key: 'requisitionTitle', label: t('cand.appliedFor') }, { key: 'level', label: t('req.level') },
          { key: 'stageLabel', label: t('cand.stage') }, { key: 'sourceLabel', label: t('cand.source') },
          { key: 'phone', label: t('cand.phone') }, { key: 'rating', label: t('cand.rating') },
        ], () => applyFilters(cache).map((c) => ({ ...c, stageLabel: stageName(c.currentStageId), sourceLabel: sourceName(c.source) })), 'Candidates'),
        (compareBtnEl = h('button', { class: 'btn btn-sm', onClick: () => openCompare() }, compareLabel())),
        isAdmin() ? h('button', { class: 'btn btn-sm', onClick: () => importModal(rebuild) }, t('cand.import')) : null,
        h('button', { class: 'btn btn-primary btn-sm', onClick: () => editCand(null, rebuild) }, t('cand.add'))
      ),
      h('div', { class: 'card__pad', style: { borderBottom: '1px solid var(--line)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } },
        h('div', { class: 'spread', style: { gap: '6px', flex: '1', minWidth: '160px' } }, icon('search', 'navlink__icon'), searchBox),
        reqSel, stageSel, lvlSel, clearBtn),
      tableHost
    );
    refreshTable();
  }
  paint();
  mount(root, h('p', { class: 'page-intro' }, t('cand.intro')), card);
}

function stars(n) { return h('span', { class: 'pcard__stars', title: (n || 0) + '/5' }, '★'.repeat(n || 0) + '☆'.repeat(5 - (n || 0))); }

let compareBtnEl = null;
function compareLabel() { return t('cand.compareSel') + (selected.size ? ' (' + selected.size + ')' : ''); }
function syncCompareBtn() { if (compareBtnEl) compareBtnEl.textContent = compareLabel(); }

function table(list, rebuild) {
  if (!list.length) return h('div', { class: 'card__pad muted' }, t('cand.none'));
  return h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {},
      h('th', {}, ''), h('th', {}, t('cand.code')), h('th', {}, t('cand.name')), h('th', {}, t('cand.appliedFor')),
      h('th', {}, t('cand.stage')), h('th', {}, t('cand.rating')), h('th', { class: 'td-right' }, t('common.actions')))),
    h('tbody', {}, list.map((c) => {
      const moveSel = select(state.stages.map((s) => ({ value: s.id, label: s.name })), { value: c.currentStageId, style: 'width:auto' });
      moveSel.addEventListener('change', async () => {
        const prev = c.currentStageId; const y = window.scrollY; // stay where we are, don't jump to the top
        try {
          await api.post('/candidates/' + c.id + '/stage', { stageId: moveSel.value });
          const item = cache.find((x) => x.id === c.id); if (item) { item.currentStageId = moveSel.value; item.status = (state.stages.find((s) => s.id === moveSel.value) || {}).type || item.status; }
          c.currentStageId = moveSel.value;
          toast(t('pipe.moved', { stage: stageName(moveSel.value) }), 'success');
          await rebuild(); window.scrollTo(0, y);
        } catch (e) { moveSel.value = prev; toast(e.message, 'error'); }
      });
      const chk = h('input', { type: 'checkbox' }); chk.checked = selected.has(c.id);
      chk.addEventListener('change', () => { if (chk.checked) selected.add(c.id); else selected.delete(c.id); syncCompareBtn(); });
      return h('tr', {},
        h('td', {}, chk),
        h('td', { class: 'mono' }, c.code),
        h('td', {}, h('div', { class: 'spread' }, h('span', { class: 'avatar' }, initials(c.name)), h('div', {}, h('span', { class: 'cellname' }, c.name), h('div', { class: 'cellsub' }, [c.level, sourceName(c.source)].filter(Boolean).join(' · ') || '—')))),
        h('td', { class: 'cellsub' }, c.requisitionTitle || h('span', { class: 'muted' }, t('cand.noReq'))),
        h('td', {}, moveSel),
        h('td', {}, stars(c.rating)),
        h('td', { class: 'td-right' }, h('div', { class: 'btn-row', style: { justifyContent: 'flex-end' } },
          h('button', { class: 'btn btn-sm btn-ghost', onClick: () => openCand(c, rebuild) }, t('common.edit')),
          h('button', { class: 'btn btn-sm btn-danger', onClick: () => removeCand(c, rebuild) }, t('common.delete'))))
      );
    }))
  ));
}

function levelDefaultFromReq(reqId) { const r = reqs.find((x) => x.id === reqId); return r ? r.level : ''; }

function editCand(c, rebuild) {
  const isNew = !c;
  const name = input({ value: c?.name || '', placeholder: 'e.g. Jane Smith' });
  const reqSel = select([{ value: '', label: t('cand.noReq') }, ...reqs.map((r) => ({ value: r.id, label: r.code + ' · ' + r.title }))], { value: c?.requisitionId || filters.requisitionId || '' });
  const lvlSel = select([{ value: '', label: '—' }, ...state.levels.map((l) => ({ value: l, label: l }))], { value: c?.level || levelDefaultFromReq(c?.requisitionId || filters.requisitionId) || '' });
  reqSel.addEventListener('change', () => { if (!lvlSel.value) lvlSel.value = levelDefaultFromReq(reqSel.value) || ''; });
  const srcSel = select([{ value: '', label: '—' }, ...state.sources.map((s) => ({ value: s.id, label: s.name }))], { value: c?.source || '' });
  const phone = input({ value: c?.phone || '' });
  const email = input({ type: 'email', value: c?.email || '' });
  const expected = input({ type: 'number', min: '0', step: '100', value: c?.expectedSalary || '' });
  const ratingSel = select([0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: n === 0 ? '—' : '★'.repeat(n) })), { value: String(c?.rating || 0) });
  const resumeUrl = input({ value: c?.resumeUrl || '', placeholder: 'https://…' });
  const notes = textarea({ value: c?.notes || '' });

  const err = h('div', { class: 'chip danger', style: { display: 'none', marginBottom: '12px' } });
  const saveBtn = h('button', { class: 'btn btn-primary' }, isNew ? t('cand.add') : t('common.save'));
  const m = openModal({
    size: 'lg', title: isNew ? t('cand.add') : (c.code + ' · ' + c.name),
    body: h('div', {}, err,
      h('div', { class: 'row' }, field(t('common.name'), name), field(t('cand.rating'), ratingSel)),
      h('div', { class: 'row' }, field(t('cand.appliedFor'), reqSel), field(t('req.level'), lvlSel)),
      h('div', { class: 'row' }, field(t('cand.source'), srcSel), field(t('cand.expected'), expected)),
      h('div', { class: 'row' }, field(t('cand.phone'), phone), field(t('cand.email'), email)),
      field(t('cand.resume'), resumeUrl),
      field(t('cand.notes'), notes)),
    footer: h('div', { class: 'btn-row' }, h('button', { class: 'btn', onClick: () => m.close() }, t('common.cancel')), saveBtn),
  });
  saveBtn.addEventListener('click', async () => {
    err.style.display = 'none';
    const payload = { name: name.value, requisitionId: reqSel.value || null, level: lvlSel.value, source: srcSel.value, phone: phone.value, email: email.value, expectedSalary: expected.value, rating: ratingSel.value, resumeUrl: resumeUrl.value, notes: notes.value };
    if (!payload.name.trim()) { err.textContent = "The candidate's name is required."; err.style.display = ''; return; }
    saveBtn.disabled = true;
    try { if (isNew) await api.post('/candidates', payload); else await api.put('/candidates/' + c.id, payload); m.close(); toast(t('common.saved'), 'success'); rebuild(); }
    catch (e) { err.textContent = e.message; err.style.display = ''; saveBtn.disabled = false; }
  });
}

// Open a candidate: edit + stage history + a shortcut to schedule an interview.
function openCand(c, rebuild) {
  const hist = (c.history || []).slice().reverse();
  const m = openModal({
    size: 'lg', title: c.code + ' · ' + c.name,
    body: h('div', {},
      h('div', { class: 'spread', style: { gap: '10px', marginBottom: '16px' } },
        h('span', { class: 'chip' }, c.level || '—'),
        h('span', { class: 'chip info' }, stageName(c.currentStageId)),
        stars(c.rating),
        c.requisitionTitle ? h('span', { class: 'chip muted' }, c.requisitionTitle) : null),
      c.phone || c.email ? h('p', { class: 'small muted' }, [c.phone && '☎ ' + c.phone, c.email && '✉ ' + c.email].filter(Boolean).join('   ')) : null,
      c.notes ? h('div', { class: 'self-note', style: { marginBottom: '16px' } }, h('b', {}, t('cand.notes')), h('div', {}, c.notes)) : null,
      documentsBlock(c),
      screeningBlock(c),
      applicationBlock(c),
      h('div', { class: 'section-title' }, t('cand.history')),
      hist.length ? h('ul', { class: 'timeline' }, hist.map((x) => h('li', {},
        h('div', { class: 'timeline__what' }, stageName(x.stageId)),
        h('div', { class: 'timeline__when' }, fmtDateTime(x.at) + (x.note ? ' · ' + x.note : ''))))) : h('p', { class: 'muted small' }, '—')),
    footer: h('div', { class: 'btn-row' },
      h('button', { class: 'btn', onClick: () => m.close() }, t('common.close')),
      h('button', { class: 'btn', onClick: () => printProfile(c) }, t('cand.printProfile')),
      h('button', { class: 'btn', onClick: () => { m.close(); openInterview(null, c, rebuild); } }, t('cand.scheduleInterview')),
      h('button', { class: 'btn btn-primary', onClick: () => { m.close(); editCand(c, rebuild); } }, t('common.edit'))),
  });
}

async function removeCand(c, rebuild) {
  const ok = await confirmDialog(h('div', {}, 'Delete ', h('b', {}, c.name), '? This also removes their interviews.'), { confirmText: t('common.delete'), danger: true, title: t('common.delete') });
  if (!ok) return;
  try { await api.del('/candidates/' + c.id); toast(t('common.deleted')); rebuild(); }
  catch (e) { toast(e.message, 'error'); }
}

// Side-by-side comparison of the ticked candidates.
function openCompare() {
  const list = cache.filter((c) => selected.has(c.id));
  if (list.length < 2) { toast(t('cand.compareNeed'), 'error'); return; }
  const val = (c, fn) => { try { return fn(c) || '—'; } catch { return '—'; } };
  const app = (c) => c.application || {};
  const rows = [
    [t('cand.code'), (c) => c.code],
    [t('req.level'), (c) => c.level],
    [t('cand.appliedFor'), (c) => c.requisitionTitle],
    [t('cand.stage'), (c) => stageName(c.currentStageId)],
    [t('cand.rating'), (c) => '★'.repeat(c.rating || 0) + '☆'.repeat(5 - (c.rating || 0))],
    [t('cand.source'), (c) => sourceName(c.source)],
    [t('cand.expected'), (c) => c.expectedSalary ? money(c.expectedSalary, currency()) : ((app(c).positions || {}).expectedSalary ? money(app(c).positions.expectedSalary, currency()) : '')],
    [t('cand.phone'), (c) => c.phone],
    [t('cand.email'), (c) => c.email],
    ['English', (c) => (app(c).skills || {}).english],
    [t('apply.sec.education'), (c) => ((app(c).education || []).map((x) => x.level).filter(Boolean).join(', '))],
    [t('apply.sec.work'), (c) => ((app(c).work || []).length ? (app(c).work.length + ' record(s)') : '')],
  ];
  const head = h('tr', {}, h('th', {}, ''), ...list.map((c) => h('th', {}, c.name)));
  const body = rows.map(([label, fn]) => h('tr', {},
    h('td', { class: 'cellsub', style: { whiteSpace: 'nowrap' } }, label),
    ...list.map((c) => h('td', {}, val(c, fn)))));
  const cm = openModal({
    size: 'lg', title: t('cand.compareSel'),
    body: h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('thead', {}, head), h('tbody', {}, body))),
    footer: h('div', { class: 'btn-row' }, h('button', { class: 'btn', onClick: () => cm.close() }, t('common.close'))),
  });
}

function importModal(rebuild) {
  const fileInput = h('input', { type: 'file', accept: '.csv,text/csv', class: 'input' });
  const result = h('div', { class: 'small muted', style: { marginTop: '10px' } });
  const err = h('div', { class: 'chip danger', style: { display: 'none', marginBottom: '12px' } });
  const saveBtn = h('button', { class: 'btn btn-primary', disabled: true }, t('cand.import'));
  let rows = [];
  fileInput.addEventListener('change', async () => {
    err.style.display = 'none'; result.textContent = '';
    const f = fileInput.files[0]; if (!f) return;
    try { rows = parseCandidateCsv(await f.text()); result.textContent = rows.length + ' row(s) ready to import.'; saveBtn.disabled = rows.length === 0; }
    catch (e) { err.textContent = e.message; err.style.display = ''; }
  });
  const m = openModal({
    size: 'lg', title: t('cand.import'),
    body: h('div', {}, err, h('p', { class: 'small muted', style: { marginTop: '0' } }, t('cand.importHint')), field(t('cand.importBtn'), fileInput), result),
    footer: h('div', { class: 'btn-row' }, h('button', { class: 'btn', onClick: () => m.close() }, t('common.cancel')), saveBtn),
  });
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try { const r = await api.post('/candidates/import', { rows }); m.close(); toast(t('cand.importDone', { created: r.created, skipped: r.skipped }), 'success'); rebuild(); }
    catch (e) { err.textContent = e.message; err.style.display = ''; saveBtn.disabled = false; }
  });
}

// Lightweight CSV → candidate rows (the shared csv.js is tuned for the people import).
function parseCandidateCsv(text) {
  const lines = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() !== '');
  if (lines.length < 2) throw new Error('The file needs a header row and at least one data row.');
  const split = (line) => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
  const norm = (s) => String(s || '').toLowerCase().replace(/[\s_-]+/g, '');
  const map = { name: 'name', fullname: 'name', candidate: 'name', phone: 'phone', mobile: 'phone', tel: 'phone', email: 'email', mail: 'email', level: 'level', source: 'source', expectedsalary: 'expectedSalary', expected: 'expectedSalary', salary: 'expectedSalary', notes: 'notes', note: 'notes' };
  const headers = split(lines[0]).map((hh) => map[norm(hh)] || null);
  const out = [];
  for (let i = 1; i < lines.length; i++) { const cells = split(lines[i]); const o = {}; headers.forEach((f, idx) => { if (f) o[f] = (cells[idx] || '').trim(); }); if (o.name) out.push(o); }
  return out;
}

function fmtDateTime(ts) { if (!ts) return ''; const d = new Date(ts); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

/* ---- printable "Job Application" profile sheet (opens a print window) ---- */
function printProfile(c) {
  const w = window.open('', '_blank');
  if (!w) { toast('Please allow pop-ups to print the profile.', 'error'); return; }
  w.document.write(profileHtml(c));
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch (e) {} }, 500); // give the photo time to load
}
function profileHtml(c) {
  const e = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const app = c.application || {};
  const p = app.personal || {}, pos = app.positions || {}, sk = app.skills || {}, o = app.other || {};
  const reqTitle = (id) => { const r = reqs.find((x) => x.id === id); return r ? r.title : ''; };
  const photo = (c.documents || []).find((d) => d.kind === 'photo');
  const photoUrl = photo ? '/api/uploads/' + photo.fileId : '';
  const fullName = [p.firstName, p.lastName].filter(Boolean).join(' ') || c.name;
  const enName = [p.firstNameEn, p.lastNameEn].filter(Boolean).join(' ');
  const prefs = [pos.rank1 && reqTitle(pos.rank1), pos.rank2 && reqTitle(pos.rank2)].filter(Boolean);
  const appliedDate = c.appliedAt ? new Date(c.appliedAt).toLocaleDateString() : '';
  const row = (label, val) => val ? `<tr><td class="l">${e(label)}</td><td>${e(val)}</td></tr>` : '';
  const section = (title, inner) => inner ? `<h2>${e(title)}</h2>${inner}` : '';

  const personalTbl = `<table class="kv">${row('Full name', fullName + (c.code ? ' (' + c.code + ')' : ''))}${row('Name (English)', enName)}${row('Address', p.presentAddress || p.permanentAddress)}${row('Email', p.email || c.email)}${row('Mobile', p.mobile || c.phone)}${row('Phone', p.phone)}</table>`;
  const infoTbl = `<table class="kv two">${row('Nickname', p.nickname)}${row('Gender', p.gender)}${row('Date of birth', p.birthDate)}${row('Age', p.age)}${row('Height (cm)', p.height)}${row('Weight (kg)', p.weight)}${row('Nationality', p.nationality)}${row('Military status', p.militaryStatus)}</table>`;
  const prefTbl = `<table class="kv">${row('Preferred positions', prefs.join('  /  '))}${row('Level', p.level || c.level)}${row('Expected salary', pos.expectedSalary ? Number(pos.expectedSalary).toLocaleString() : '')}${row('Work location', pos.location)}${row('Employment type', app.employmentType)}${row('Available start', pos.startDate)}`
    + `</table>`;
  const eduRows = (app.education || []).map((x) => `<tr><td>${e(x.level || '')}</td><td>${e(x.institution || '')}</td><td>${e(x.major || '')}</td><td>${e(x.gpa || '')}</td><td>${e([x.from, x.to].filter(Boolean).join(' – '))}</td></tr>`).join('');
  const eduTbl = eduRows ? `<table class="grid"><thead><tr><th>Level</th><th>Institution</th><th>Major</th><th>GPA</th><th>Period</th></tr></thead><tbody>${eduRows}</tbody></table>` : '';
  const workRows = (app.work || []).map((x) => `<tr><td>${e(x.company || '')}</td><td>${e(x.position || '')}</td><td>${e([x.startSalary, x.lastSalary].filter(Boolean).join(' → '))}</td><td>${e([x.from, x.to].filter(Boolean).join(' – '))}</td><td>${e(x.reason || '')}</td></tr>`).join('');
  const workTbl = workRows ? `<table class="grid"><thead><tr><th>Company</th><th>Position</th><th>Salary</th><th>Period</th><th>Reason for leaving</th></tr></thead><tbody>${workRows}</tbody></table>` : '';
  const trainRows = (app.training || []).map((x) => `<tr><td>${e(x.activity || '')}</td><td>${e(x.institution || '')}</td><td>${e([x.from, x.to].filter(Boolean).join(' – '))}</td></tr>`).join('');
  const trainTbl = trainRows ? `<table class="grid"><thead><tr><th>Activity / training</th><th>Institution</th><th>Period</th></tr></thead><tbody>${trainRows}</tbody></table>` : '';
  const skillsTbl = `<table class="kv two">${row('English', sk.english)}${row('Other language', sk.otherLanguage)}${row('Computer / program', [sk.computer, sk.computerLevel].filter(Boolean).join(' · '))}${row('Driving', [sk.driving, sk.licenseExpiry && ('licence exp. ' + sk.licenseExpiry)].filter(Boolean).join(' · '))}${row('Own vehicle', sk.owner)}</table>`;
  const emergency = [o.emergencyName, o.emergencyRelationship, o.emergencyPhone].filter(Boolean).join(' · ');
  const otherTbl = `<table class="kv">${row('Emergency contact', emergency)}${row('Relative working here', o.relativeWorking && (o.relativeWorking + (o.relativeName ? ' — ' + o.relativeName : '')))}${row('Can work upcountry', o.canUpcountry)}</table>`;
  const intro = o.selfIntro || c.notes;

  return `<!doctype html><html><head><meta charset="utf-8"><title>Job Application — ${e(fullName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", "Leelawadee UI", Arial, sans-serif; color: #111; margin: 28px 34px; font-size: 13px; line-height: 1.45; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0a0a0a; padding-bottom: 10px; margin-bottom: 14px; }
  .head h1 { font-size: 20px; margin: 0 0 4px; } .head .sub { color: #555; font-size: 12px; }
  .brand { text-align: right; font-family: Georgia, serif; letter-spacing: .14em; font-weight: 600; }
  .top { display: flex; gap: 20px; margin-bottom: 8px; }
  .photo { width: 118px; height: 148px; object-fit: cover; border: 1px solid #ccc; background: #f2f2f2; flex-shrink: 0; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: #0a0a0a; border-bottom: 1px solid #ccc; padding-bottom: 3px; margin: 18px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  table.kv td { padding: 3px 6px; vertical-align: top; }
  table.kv td.l { color: #666; width: 170px; }
  table.kv.two { display: grid; grid-template-columns: 1fr 1fr; }
  table.kv.two td.l { width: 130px; }
  table.grid th, table.grid td { border: 1px solid #ddd; padding: 5px 7px; text-align: left; font-size: 12px; }
  table.grid th { background: #f4f4f4; }
  .intro { border: 1px solid #ddd; padding: 8px 10px; background: #fafafa; white-space: pre-wrap; }
  @media print { body { margin: 12mm; } @page { size: A4; } }
</style></head><body>
  <div class="head">
    <div><h1>Job Application${pos.rank1 && reqTitle(pos.rank1) ? ': ' + e(reqTitle(pos.rank1)) : ''}</h1>
      <div class="sub">From: ${e(fullName)}${appliedDate ? '  ·  Applied: ' + e(appliedDate) : ''}${c.source === 'online' ? '  ·  Online application' : ''}</div></div>
    <div class="brand">KING LIVING<br><span style="font-size:10px;letter-spacing:.3em;color:#888">RECRUIT</span></div>
  </div>
  <div class="top">
    ${photoUrl ? `<img class="photo" src="${photoUrl}" alt="photo">` : '<div class="photo"></div>'}
    <div style="flex:1">${personalTbl}</div>
  </div>
  ${section('Personal information', infoTbl)}
  ${section('Job preferences', prefTbl)}
  ${section('Education', eduTbl)}
  ${section('Work experience', workTbl)}
  ${section('Training / certificates', trainTbl)}
  ${section('Skills', skillsTbl)}
  ${section('Other', otherTbl)}
  ${intro ? section('Introduction', '<div class="intro">' + e(intro) + '</div>') : ''}
</body></html>`;
}

/* ---- detail blocks for an online application (only render when present) ---- */
const DOC_LABEL = { photo: t('apply.doc.photo'), resume: t('apply.doc.resume'), transcript: t('apply.doc.transcript'), idcard: t('apply.doc.idcard'), housereg: t('apply.doc.housereg'), other: t('apply.doc.other') };
function documentsBlock(c) {
  const docs = c.documents || [];
  if (!docs.length) return null;
  return h('div', {},
    h('div', { class: 'section-title' }, t('apply.sec.documents')),
    h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' } }, docs.map((dd) =>
      h('a', { class: 'btn btn-sm', href: '/api/uploads/' + dd.fileId + '?download=1&name=' + encodeURIComponent(dd.originalName || dd.fileId), target: '_blank' },
        icon('doc', 'navlink__icon'), (DOC_LABEL[dd.kind] || dd.kind)))));
}
function screeningBlock(c) {
  const ans = (c.screeningAnswers || []).filter((a) => a.answer);
  if (!ans.length) return null;
  return h('div', {},
    h('div', { class: 'section-title' }, t('apply.sec.screening')),
    h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('tbody', {}, ans.map((a) =>
      h('tr', {}, h('td', { class: 'cellsub' }, a.question), h('td', {}, h('b', {}, a.answer))))))));
}
function applicationBlock(c) {
  const app = c.application;
  if (!app) return null;
  const rows = [];
  const add = (label, val) => { if (val) rows.push(h('tr', {}, h('td', { class: 'cellsub', style: { width: '40%' } }, label), h('td', {}, val))); };
  const p = app.personal || {}, pos = app.positions || {}, sk = app.skills || {}, o = app.other || {};
  add('Name (EN)', [p.firstNameEn, p.lastNameEn].filter(Boolean).join(' '));
  add('Nickname', p.nickname);
  add('Gender / Birth', [p.gender, p.birthDate].filter(Boolean).join(' · '));
  add('Age', p.age);
  add('Nationality', p.nationality);
  add('Present address', p.presentAddress);
  add('Military status', p.militaryStatus);
  add('Expected salary', pos.expectedSalary ? money(pos.expectedSalary, currency()) : '');
  add('Available from', pos.startDate);
  add('English', sk.english);
  add('Computer', [sk.computer, sk.computerLevel].filter(Boolean).join(' · '));
  add('Driving', [sk.driving, sk.licenseExpiry].filter(Boolean).join(' · '));
  add('Emergency contact', [o.emergencyName, o.emergencyRelationship, o.emergencyPhone].filter(Boolean).join(' · '));
  add('Relative working here', o.relativeWorking ? (o.relativeWorking + (o.relativeName ? ' (' + o.relativeName + ')' : '')) : '');
  add('Can work upcountry', o.canUpcountry);
  const edu = (app.education || []).map((e) => `${e.level}: ${[e.institution, e.major, e.gpa && ('GPA ' + e.gpa)].filter(Boolean).join(', ')}`);
  const work = (app.work || []).map((w) => `${[w.company, w.position].filter(Boolean).join(' — ')}${w.from || w.to ? ` (${w.from || '?'}–${w.to || '?'})` : ''}`);
  return h('div', {},
    h('div', { class: 'section-title' }, t('apply.sec.personal')),
    rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' }, h('tbody', {}, rows))) : h('p', { class: 'muted small' }, '—'),
    edu.length ? h('div', {}, h('div', { class: 'section-title' }, t('apply.sec.education')), h('ul', { class: 'small', style: { margin: 0, paddingLeft: '18px' } }, edu.map((x) => h('li', {}, x)))) : null,
    work.length ? h('div', {}, h('div', { class: 'section-title' }, t('apply.sec.work')), h('ul', { class: 'small', style: { margin: 0, paddingLeft: '18px' } }, work.map((x) => h('li', {}, x)))) : null);
}
