// Schedule interviews and capture a scorecard for each. The scorecard mirrors the King
// competency set; management criteria show for leadership roles. openInterview() is also
// called from the Candidates page.
import { api } from '../api.js';
import { state } from '../state.js';
import { h, mount, clear, field, input, select, textarea, toast, openModal, confirmDialog } from '../ui.js';
import { t } from '../i18n.js';

const TYPES = ['phone', 'onsite', 'panel', 'trade-test', 'video'];
const RECS = ['strong-yes', 'yes', 'maybe', 'no'];

export async function render(root) {
  const list = await api.get('/interviews');
  const rebuild = async () => render(root);

  const upcoming = list.filter((i) => i.status === 'scheduled').sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
  const past = list.filter((i) => i.status !== 'scheduled');

  mount(root,
    h('p', { class: 'page-intro' }, t('intv.intro')),
    h('div', { class: 'spread', style: { marginBottom: '16px' } }, h('div', { class: 'topbar__spacer' }),
      h('button', { class: 'btn btn-primary btn-sm', onClick: () => openInterview(null, null, rebuild) }, t('intv.add'))),
    section(t('intv.upcoming'), upcoming, rebuild),
    h('div', { style: { height: '18px' } }),
    section(t('intv.past'), past, rebuild),
  );
}

function section(title, items, rebuild) {
  return h('div', { class: 'card' },
    h('div', { class: 'card__head' }, h('h3', {}, title), h('span', { class: 'chip muted' }, String(items.length))),
    items.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {},
        h('th', {}, t('intv.candidate')), h('th', {}, t('intv.when')), h('th', {}, t('intv.type')),
        h('th', {}, t('intv.interviewer')), h('th', {}, t('intv.overall')), h('th', {}, t('common.status')), h('th', { class: 'td-right' }, t('common.actions')))),
      h('tbody', {}, items.map((i) => h('tr', {},
        h('td', {}, h('span', { class: 'cellname' }, i.candidateName), h('div', { class: 'cellsub mono' }, i.candidateCode)),
        h('td', { class: 'cellsub' }, fmt(i.scheduledAt)),
        h('td', {}, h('span', { class: 'chip' }, t('intv.t.' + i.type) || i.type)),
        h('td', { class: 'cellsub' }, i.interviewerName || '—'),
        h('td', {}, avgScore(i) != null ? h('span', { class: 'chip info' }, avgScore(i) + '/5') : '—', i.recommendation ? h('span', { class: 'chip ' + recCls(i.recommendation), style: { marginLeft: '6px' } }, t('intv.rec.' + i.recommendation)) : null),
        h('td', {}, statusChip(i)),
        h('td', { class: 'td-right' }, h('div', { class: 'btn-row', style: { justifyContent: 'flex-end' } },
          h('button', { class: 'btn btn-sm btn-ghost', onClick: () => openInterview(i, null, rebuild) }, t('common.edit')),
          h('button', { class: 'btn btn-sm btn-danger', onClick: () => removeInterview(i, rebuild) }, t('common.delete'))))
      ))))) : h('div', { class: 'card__pad muted' }, t('intv.none')));
}

function statusChip(i) {
  if (i.status === 'completed') return h('span', { class: 'chip ok' }, t('intv.st.completed'));
  if (i.status === 'cancelled') return h('span', { class: 'chip muted' }, t('intv.st.cancelled'));
  return h('span', { class: 'chip info' }, t('intv.st.scheduled'));
}
function recCls(r) { return ({ 'strong-yes': 'ok', 'yes': 'ok', 'maybe': 'warn', 'no': 'danger' })[r] || ''; }
function avgScore(i) {
  const vals = Object.values(i.scores || {}).map(Number).filter((n) => n > 0);
  if (!vals.length) return null;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
}
function fmt(s) { if (!s) return '—'; const d = new Date(s); if (isNaN(d)) return s; return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

// Schedule / edit one interview. `candidate` may be pre-selected from the Candidates page.
export async function openInterview(existing, candidate, onDone) {
  const [scorecard, people, candidates] = await Promise.all([
    api.get('/scorecard'), api.get('/employees').catch(() => []), candidate ? Promise.resolve([candidate]) : api.get('/candidates'),
  ]);
  const isNew = !existing;
  const candId = existing?.candidateId || candidate?.id || '';
  const candSel = select([{ value: '', label: '—' }, ...candidates.map((c) => ({ value: c.id, label: c.code ? c.code + ' · ' + c.name : c.name }))], { value: candId });
  if (candidate) candSel.disabled = true;
  // Interviewer: free text, with People (if any) as suggestions — works with empty People.
  const interviewerName0 = existing?.interviewerName || (existing?.interviewerId ? (people.find((p) => p.id === existing.interviewerId)?.name || '') : '');
  const interviewerInput = input({ value: interviewerName0, placeholder: 'e.g. Sunisa J.', list: 'interviewer-suggestions' });
  const interviewerList = h('datalist', { id: 'interviewer-suggestions' }, people.map((p) => h('option', { value: p.name || p.empCode })));
  const typeSel = select(TYPES.map((x) => ({ value: x, label: t('intv.t.' + x) })), { value: existing?.type || 'onsite' });
  const when = input({ type: 'datetime-local', value: toLocalInput(existing?.scheduledAt) });
  const location = input({ value: existing?.location || '', placeholder: 'e.g. Meeting room 2 / Teams link' });
  const statusSel = select(['scheduled', 'completed', 'cancelled'].map((x) => ({ value: x, label: t('intv.st.' + x) })), { value: existing?.status || 'scheduled' });
  const recSel = select([{ value: '', label: '—' }, ...RECS.map((x) => ({ value: x, label: t('intv.rec.' + x) }))], { value: existing?.recommendation || '' });
  const notes = textarea({ value: existing?.notes || '' });

  // scorecard rows: a 0–5 select per criterion, grouped general / management
  const scores = { ...(existing?.scores || {}) };
  const scoreRow = (crit) => {
    const sel = select([0, 1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: n === 0 ? '—' : String(n) })), { value: String(scores[crit.id] || 0), style: 'width:80px' });
    sel.addEventListener('change', () => { scores[crit.id] = Number(sel.value); });
    return h('div', { class: 'sc-row' }, h('div', {}, h('div', { class: 'sc-row__name' }, crit.name), h('div', { class: 'sc-row__group' }, t('intv.' + crit.group))), sel);
  };
  const general = scorecard.filter((c) => c.group === 'general');
  const mgmt = scorecard.filter((c) => c.group === 'management');

  const err = h('div', { class: 'chip danger', style: { display: 'none', marginBottom: '12px' } });
  const saveBtn = h('button', { class: 'btn btn-primary' }, isNew ? t('intv.add') : t('intv.complete'));
  const m = openModal({
    size: 'lg', title: isNew ? t('intv.add') : (existing.candidateName || t('intv.scorecard')),
    body: h('div', {}, err, interviewerList,
      h('div', { class: 'row' }, field(t('intv.candidate'), candSel), field(t('intv.interviewer'), interviewerInput)),
      h('div', { class: 'row' }, field(t('intv.when'), when), field(t('intv.type'), typeSel)),
      h('div', { class: 'row' }, field(t('intv.location'), location), field(t('common.status'), statusSel)),
      h('hr', { class: 'divider' }),
      h('div', { class: 'section-title', style: { marginTop: 0 } }, t('intv.scorecard')),
      ...general.map(scoreRow),
      mgmt.length ? h('div', { class: 'section-title' }, t('intv.management')) : null,
      ...mgmt.map(scoreRow),
      h('hr', { class: 'divider' }),
      field(t('intv.recommendation'), recSel),
      field(t('cand.notes'), notes)),
    footer: h('div', { class: 'btn-row' }, h('button', { class: 'btn', onClick: () => m.close() }, t('common.cancel')), saveBtn),
  });
  saveBtn.addEventListener('click', async () => {
    err.style.display = 'none';
    const typedInterviewer = interviewerInput.value.trim();
    const matchInterviewer = people.find((p) => (p.name || '') === typedInterviewer || (p.empCode || '') === typedInterviewer);
    const payload = {
      candidateId: candSel.value, interviewerId: matchInterviewer ? matchInterviewer.id : null, interviewerName: typedInterviewer, type: typeSel.value,
      scheduledAt: fromLocalInput(when.value), location: location.value, status: statusSel.value,
      scores, recommendation: recSel.value, notes: notes.value,
    };
    if (!payload.candidateId) { err.textContent = 'Choose a candidate.'; err.style.display = ''; return; }
    saveBtn.disabled = true;
    try { if (isNew) await api.post('/interviews', payload); else await api.put('/interviews/' + existing.id, payload); m.close(); toast(t('common.saved'), 'success'); if (onDone) onDone(); }
    catch (e) { err.textContent = e.message; err.style.display = ''; saveBtn.disabled = false; }
  });
}

async function removeInterview(i, rebuild) {
  const ok = await confirmDialog(h('div', {}, 'Delete this interview for ', h('b', {}, i.candidateName), '?'), { confirmText: t('common.delete'), danger: true, title: t('common.delete') });
  if (!ok) return;
  try { await api.del('/interviews/' + i.id); toast(t('common.deleted')); rebuild(); }
  catch (e) { toast(e.message, 'error'); }
}

// ISO <-> <input type=datetime-local> (which has no timezone). Keep it simple & local.
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso); if (isNaN(d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocalInput(v) { if (!v) return ''; const d = new Date(v); return isNaN(d) ? '' : d.toISOString(); }
