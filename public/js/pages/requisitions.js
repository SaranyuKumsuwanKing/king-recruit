// Job openings to fill. Each requisition has a level, a department and a hiring manager.
import { api } from '../api.js';
import { state, isAdmin, currency } from '../state.js';
import { h, mount, clear, field, input, select, textarea, toast, openModal, confirmDialog, money, icon } from '../ui.js';
import { t } from '../i18n.js';
import { exportMenu } from '../export.js';

let reqs = [];
let people = [];
const filters = { q: '', status: '', dept: '' };

const EMP_TYPES = ['full-time', 'contract', 'daily', 'intern'];

function applyFilters(list) {
  const q = filters.q.trim().toLowerCase();
  return list.filter((r) =>
    (!filters.status || r.status === filters.status) &&
    (!filters.dept || r.department === filters.dept) &&
    (!q || (r.title || '').toLowerCase().includes(q) || (r.code || '').toLowerCase().includes(q))
  );
}

export async function render(root) {
  [reqs, people] = await Promise.all([api.get('/requisitions'), api.get('/employees').catch(() => [])]);
  const card = h('div', { class: 'card' });
  const countChip = h('span', { class: 'chip muted' }, '');
  const tableHost = h('div', {});
  const rebuild = async () => { reqs = await api.get('/requisitions'); paint(); };
  const distinct = (key) => [...new Set(reqs.map((e) => e[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  function refreshTable() {
    const list = applyFilters(reqs);
    countChip.textContent = list.length === reqs.length ? String(reqs.length) : `${list.length} / ${reqs.length}`;
    mount(tableHost, table(list, rebuild));
  }
  function paint() {
    clear(card);
    const searchBox = input({ placeholder: t('req.searchPlaceholder'), value: filters.q, style: { maxWidth: '240px' } });
    searchBox.addEventListener('input', () => { filters.q = searchBox.value; refreshTable(); });
    const statusSel = select([{ value: '', label: t('req.allStatus') }, ...['draft', 'open', 'on-hold', 'filled', 'closed'].map((s) => ({ value: s, label: t('req.st.' + s) }))], { value: filters.status, style: 'width:auto' });
    statusSel.addEventListener('change', () => { filters.status = statusSel.value; refreshTable(); });
    const deptSel = select([{ value: '', label: t('dash.allDepts') }, ...distinct('department').map((a) => ({ value: a, label: a }))], { value: filters.dept, style: 'width:auto' });
    deptSel.addEventListener('change', () => { filters.dept = deptSel.value; refreshTable(); });
    const clearBtn = h('button', { class: 'btn btn-sm btn-ghost', onClick: () => { filters.q = ''; filters.status = ''; filters.dept = ''; paint(); } }, t('common.clear'));

    card.append(
      h('div', { class: 'card__head' },
        h('h3', {}, t('nav.requisitions')), countChip, h('div', { class: 'topbar__spacer' }),
        exportMenu('requisitions', [
          { key: 'code', label: t('req.code') }, { key: 'title', label: t('req.title') },
          { key: 'department', label: t('req.dept') }, { key: 'level', label: t('req.level') },
          { key: 'headcount', label: t('req.headcount') }, { key: 'filled', label: t('req.filled') },
          { key: 'priority', label: t('req.priority') }, { key: 'status', label: t('common.status') },
        ], () => applyFilters(reqs), 'Requisitions'),
        isAdmin() ? h('button', { class: 'btn btn-primary btn-sm', onClick: () => editReq(null, rebuild) }, t('req.add')) : null
      ),
      h('div', { class: 'card__pad', style: { borderBottom: '1px solid var(--line)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } },
        h('div', { class: 'spread', style: { gap: '6px', flex: '1', minWidth: '180px' } }, icon('search', 'navlink__icon'), searchBox),
        statusSel, deptSel, clearBtn),
      tableHost
    );
    refreshTable();
  }
  paint();
  mount(root, h('p', { class: 'page-intro' }, t('req.intro')), card);
}

function table(list, rebuild) {
  if (!list.length) return h('div', { class: 'card__pad muted' }, t('req.none'));
  return h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {},
      h('th', {}, t('req.code')), h('th', {}, t('req.title')), h('th', {}, t('req.dept')), h('th', {}, t('req.level')),
      h('th', { class: 'td-center' }, t('req.filled')), h('th', { class: 'td-center' }, t('req.candidates')),
      h('th', {}, t('req.priority')), h('th', {}, t('common.status')), h('th', { class: 'td-right' }, t('common.actions')))),
    h('tbody', {}, list.map((r) => h('tr', {},
      h('td', { class: 'mono' }, r.code),
      h('td', {}, h('span', { class: 'cellname' }, r.title), h('div', { class: 'cellsub' }, r.area || '—'), r.published ? h('span', { class: 'chip ok', style: { marginTop: '4px' } }, t('req.published')) : null),
      h('td', { class: 'cellsub' }, r.department || '—'),
      h('td', {}, r.level ? h('span', { class: 'chip' }, r.level) : '—'),
      h('td', { class: 'td-center mono' }, `${r.filled}/${r.headcount}`),
      h('td', { class: 'td-center' }, h('a', { class: 'chip info', href: '#/candidates/' + r.id, title: t('req.viewCands') }, String(r.totalCandidates))),
      h('td', {}, h('span', { class: 'chip pri-' + r.priority }, t('req.pri.' + r.priority))),
      h('td', {}, h('span', { class: 'chip st-' + statusCls(r.status) }, t('req.st.' + r.status))),
      h('td', { class: 'td-right' }, h('div', { class: 'btn-row', style: { justifyContent: 'flex-end' } },
        h('a', { class: 'btn btn-sm btn-ghost', href: '#/candidates/' + r.id }, t('req.viewCands')),
        isAdmin() ? h('button', { class: 'btn btn-sm btn-ghost', onClick: () => editReq(r, rebuild) }, t('common.edit')) : null,
        isAdmin() ? h('button', { class: 'btn btn-sm btn-danger', onClick: () => removeReq(r, rebuild) }, t('common.delete')) : null))
    )))
  ));
}
function statusCls(s) { return ({ 'draft': 'draft', 'open': 'open', 'on-hold': 'hold', 'filled': 'filled', 'closed': 'closed' })[s] || 'draft'; }

function editReq(r, rebuild) {
  const isNew = !r;
  const title = input({ value: r?.title || '', placeholder: 'e.g. Sewing Operator' });
  const department = input({ value: r?.department || '', placeholder: 'e.g. MANU Production' });
  const area = input({ value: r?.area || '', placeholder: 'e.g. Sewing' });
  const costCenter = input({ value: r?.costCenter || '' });
  const lvlSel = select([{ value: '', label: '—' }, ...state.levels.map((l) => ({ value: l, label: l }))], { value: r?.level || '' });
  const headcount = input({ type: 'number', min: '1', step: '1', value: r?.headcount ?? 1 });
  const empSel = select(EMP_TYPES.map((x) => ({ value: x, label: t('req.et.' + x) })), { value: r?.employmentType || 'full-time' });
  const shift = input({ value: r?.shift || '', placeholder: 'e.g. Day' });
  const prioSel = select(['low', 'normal', 'high', 'urgent'].map((x) => ({ value: x, label: t('req.pri.' + x) })), { value: r?.priority || 'normal' });
  const statusSel = select(['draft', 'open', 'on-hold', 'filled', 'closed'].map((x) => ({ value: x, label: t('req.st.' + x) })), { value: r?.status || 'open' });
  // Hiring manager: free text, with People (if any) offered as suggestions. Works even
  // when the People directory is empty — HR can just type the name.
  const mgrName0 = r?.hiringManagerName || (r?.hiringManagerId ? (people.find((p) => p.id === r.hiringManagerId)?.name || '') : '');
  const mgrInput = input({ value: mgrName0, placeholder: 'e.g. Sunisa J.', list: 'hm-suggestions' });
  const mgrList = h('datalist', { id: 'hm-suggestions' }, people.map((p) => h('option', { value: p.name || p.empCode })));
  const salMin = input({ type: 'number', min: '0', step: '100', value: r?.salaryMin || '' });
  const salMax = input({ type: 'number', min: '0', step: '100', value: r?.salaryMax || '' });
  const openDate = input({ type: 'date', value: r?.openedAt ? new Date(r.openedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10) });
  const targetDate = input({ type: 'date', value: r?.targetDate || '' });
  const description = textarea({ value: r?.description || '' });
  const requirements = textarea({ value: r?.requirements || '' });

  // Publish to the careers portal + screening questions shown during apply
  const publishedChk = h('input', { type: 'checkbox' }); publishedChk.checked = !!r?.published;
  let screening = (r?.screeningQuestions || []).map((q) => ({ ...q }));
  const screenHost = h('div', {});
  function paintScreen() {
    clear(screenHost);
    screening.forEach((q, i) => {
      const text = input({ value: q.text || '', placeholder: 'e.g. Can you work night shift?' });
      text.addEventListener('input', () => (q.text = text.value));
      const type = select([{ value: 'yesno', label: 'Yes / No' }, { value: 'text', label: 'Short text' }], { value: q.type || 'yesno', style: 'width:auto' });
      type.addEventListener('change', () => (q.type = type.value));
      const ko = h('input', { type: 'checkbox', title: 'Knockout' }); ko.checked = !!q.knockout; ko.addEventListener('change', () => (q.knockout = ko.checked));
      const del = h('button', { class: 'btn btn-sm btn-danger', onClick: () => { screening.splice(i, 1); paintScreen(); } }, '✕');
      screenHost.append(h('div', { class: 'spread', style: { gap: '8px', marginBottom: '8px' } },
        h('div', { class: 'grow' }, text), type, h('label', { class: 'spread', style: { gap: '4px' }, title: 'Knockout question' }, ko, h('span', { class: 'small muted' }, 'KO')), del));
    });
    screenHost.append(h('button', { class: 'btn btn-sm', onClick: () => { screening.push({ id: '', text: '', type: 'yesno', knockout: false }); paintScreen(); } }, '+ Add question'));
  }
  paintScreen();

  const err = h('div', { class: 'chip danger', style: { display: 'none', marginBottom: '12px' } });
  const saveBtn = h('button', { class: 'btn btn-primary' }, isNew ? t('req.add') : t('common.save'));
  const m = openModal({
    size: 'lg', title: isNew ? t('req.add') : (r.code + ' · ' + r.title),
    body: h('div', {}, err,
      h('div', { class: 'row' }, field(t('req.title'), title), field(t('req.level'), lvlSel)),
      h('div', { class: 'row' }, field(t('req.dept'), department), field(t('req.area'), area)),
      h('div', { class: 'row' }, field(t('req.costCenter'), costCenter), field(t('req.headcount'), headcount)),
      h('div', { class: 'row' }, field(t('req.empType'), empSel), field(t('req.shift'), shift)),
      h('div', { class: 'row' }, field(t('req.priority'), prioSel), field(t('common.status'), statusSel)),
      mgrList,
      h('div', { class: 'row' }, field(t('req.hiringMgr'), mgrInput), h('div', {})),
      h('div', { class: 'row' }, field(t('req.openDate'), openDate), field(t('req.targetDate'), targetDate)),
      h('div', { class: 'row' }, field(t('req.salaryMin'), salMin), field(t('req.salaryMax'), salMax)),
      field(t('req.description'), description),
      field(t('req.requirements'), requirements),
      h('hr', { class: 'divider' }),
      field(t('req.publish'), h('label', { class: 'spread', style: { gap: '8px', cursor: 'pointer' } }, publishedChk, h('span', { class: 'muted small' }, t('req.publishHint')))),
      h('div', { class: 'field' }, h('label', {}, t('req.screening')), h('div', { class: 'hint', style: { marginBottom: '10px' } }, t('req.screeningHint')), screenHost)),
    footer: h('div', { class: 'btn-row' }, h('button', { class: 'btn', onClick: () => m.close() }, t('common.cancel')), saveBtn),
  });
  saveBtn.addEventListener('click', async () => {
    err.style.display = 'none';
    const payload = {
      title: title.value, department: department.value, area: area.value, costCenter: costCenter.value, level: lvlSel.value,
      headcount: headcount.value, employmentType: empSel.value, shift: shift.value, priority: prioSel.value, status: statusSel.value,
      salaryMin: salMin.value, salaryMax: salMax.value, openedAt: openDate.value || undefined, targetDate: targetDate.value,
      description: description.value, requirements: requirements.value,
      published: publishedChk.checked, screeningQuestions: screening.filter((q) => (q.text || '').trim()),
      ...(() => { const typed = mgrInput.value.trim(); const match = people.find((p) => (p.name || '') === typed || (p.empCode || '') === typed); return { hiringManagerName: typed, hiringManagerId: match ? match.id : null }; })(),
    };
    if (!payload.title.trim()) { err.textContent = 'A job title is required.'; err.style.display = ''; return; }
    saveBtn.disabled = true;
    try { if (isNew) await api.post('/requisitions', payload); else await api.put('/requisitions/' + r.id, payload); m.close(); toast(t('common.saved'), 'success'); rebuild(); }
    catch (e) { err.textContent = e.message; err.style.display = ''; saveBtn.disabled = false; }
  });
}

async function removeReq(r, rebuild) {
  const ok = await confirmDialog(h('div', {}, 'Delete ', h('b', {}, r.code + ' · ' + r.title), '? Candidates stay but are unlinked.'), { confirmText: t('common.delete'), danger: true, title: t('common.delete') });
  if (!ok) return;
  try { await api.del('/requisitions/' + r.id); toast(t('common.deleted')); rebuild(); }
  catch (e) { toast(e.message, 'error'); }
}
