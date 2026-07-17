// Admin (GM / HR): the organisation chart. Drag the reporting lines around here and the
// leave-approval rules follow automatically — everyone's approver is simply their manager
// in this tree. Edit a person to change who they report to (with a loop guard), their area,
// or their position.
import { api } from '../api.js';
import { h, mount, clear, icon, initials, openModal, field, input, select, toast } from '../ui.js';
import { t } from '../i18n.js';

let emps = [];
let childrenOf = {};            // managerId -> [emp]
const expanded = new Set();     // emp ids whose children are shown

function index() {
  childrenOf = {};
  emps.forEach((e) => { const k = e.managerId || '__root'; (childrenOf[k] = childrenOf[k] || []).push(e); });
  Object.values(childrenOf).forEach((arr) => arr.sort((a, b) =>
    rank(a) - rank(b) || (a.name || '').localeCompare(b.name || '')));
}
// managers first, then supervisors, then leaders/staff/shop floor
function rank(e) { const o = { Management: 0, Manager: 1, Supervisor: 2, Leader: 3, Staff: 4, 'Shop Floor': 5 }; return o[e.level] != null ? o[e.level] : 9; }
const kids = (id) => childrenOf[id] || [];
const reportCount = (id) => kids(id).length;
// total people at or below a node (whole sub-tree)
function teamSize(id) { let n = 0; for (const c of kids(id)) n += 1 + teamSize(c.id); return n; }

// the set of a node's descendants (so you can't make someone report into their own branch)
function descendants(id, acc = new Set()) { for (const c of kids(id)) { acc.add(c.id); descendants(c.id, acc); } return acc; }

export async function render(root) {
  emps = await api.get('/employees');
  index();

  const roots = kids('__root');
  // default: open the top two layers so the leadership structure is visible at a glance
  if (!expanded.size) {
    roots.forEach((r) => { expanded.add(r.id); kids(r.id).forEach((m) => expanded.add(m.id)); });
  }

  const stats = h('div', { class: 'grid cols-4', style: { marginBottom: '18px' } },
    statCard(t('org.people'), emps.length, 't1'),
    statCard(t('org.managers'), emps.filter((e) => e.level === 'Manager' || e.level === 'Management').length, 't2'),
    statCard(t('org.supervisors'), emps.filter((e) => e.level === 'Supervisor').length, 't3'),
    statCard(t('org.unassigned'), emps.filter((e) => !e.managerId && e.level !== 'Management').length, 't4'),
  );

  // quick find: jump to a person's edit dialog
  const finder = select(
    [{ value: '', label: t('org.findPerson') }, ...emps.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((e) => ({ value: e.id, label: (e.empCode ? e.empCode + ' · ' : '') + e.name }))],
    { style: 'max-width:320px' });
  finder.addEventListener('change', () => { const e = emps.find((x) => x.id === finder.value); if (e) editNode(e, reload); finder.value = ''; });

  const treeHost = h('div', { class: 'card__pad' });
  const card = h('div', { class: 'card' },
    h('div', { class: 'card__head' }, h('h3', {}, t('nav.orgchart')),
      h('div', { class: 'topbar__spacer' }),
      h('div', { class: 'spread', style: { gap: '6px' } }, icon('search', 'navlink__icon'), finder),
      h('button', { class: 'btn btn-sm btn-ghost', onClick: () => { roots.forEach((r) => expandAll(r.id)); paintTree(); } }, t('org.expandAll')),
      h('button', { class: 'btn btn-sm btn-ghost', onClick: () => { expanded.clear(); paintTree(); } }, t('org.collapseAll')),
    ),
    treeHost
  );

  function paintTree() { mount(treeHost, ...roots.map((r) => nodeEl(r, 0))); }
  async function reload() { emps = await api.get('/employees'); index(); paintTree(); }

  function nodeEl(e, depth) {
    const hasKids = reportCount(e.id) > 0;
    const isOpen = expanded.has(e.id);
    const caret = h('button', { class: 'org-caret ' + (hasKids ? (isOpen ? 'open' : '') : 'leaf') }, icon('chevron'));
    const childHost = h('div', { class: 'org-children' });
    const wrap = h('div', {});
    const fill = () => mount(childHost, ...kids(e.id).map((c) => nodeEl(c, depth + 1)));
    if (hasKids && isOpen) fill();
    childHost.style.display = hasKids && isOpen ? '' : 'none';
    caret.addEventListener('click', () => {
      if (!hasKids) return;
      if (expanded.has(e.id)) { expanded.delete(e.id); childHost.style.display = 'none'; caret.classList.remove('open'); }
      else { expanded.add(e.id); fill(); childHost.style.display = ''; caret.classList.add('open'); }
    });

    const row = h('div', { class: 'org-card ' + lvlClass(e.level) },
      caret,
      h('span', { class: 'avatar' }, initials(e.name, e.empCode)),
      h('div', { class: 'grow', style: { minWidth: '0' } },
        h('div', { class: 'org-name' }, e.name || e.empCode || '—'),
        h('div', { class: 'org-sub' }, [e.position, e.area].filter(Boolean).join(' · ') || '—')),
      h('span', { class: 'chip ' + lvlChip(e.level), style: { whiteSpace: 'nowrap' } }, h('span', { class: 'org-lvl' }, e.level || '—')),
      hasKids ? h('span', { class: 'chip muted', title: t('org.teamTotal', { n: teamSize(e.id) }) }, t('org.reports', { n: reportCount(e.id) })) : null,
      h('button', { class: 'btn btn-sm btn-ghost', onClick: () => editNode(e, reload) }, t('common.edit'))
    );
    wrap.className = 'org-node';
    wrap.append(row, childHost);
    return wrap;
  }

  paintTree();
  mount(root, h('p', { class: 'page-intro' }, t('org.intro')), stats, card);
}

function expandAll(id) { if (reportCount(id) > 0) { expanded.add(id); kids(id).forEach((c) => expandAll(c.id)); } }

function lvlChip(level) {
  if (level === 'Management' || level === 'Manager') return 'info';
  if (level === 'Supervisor') return 'ok';
  if (level === 'Leader') return 'warn';
  return 'muted';
}
function lvlClass(level) {
  if (level === 'Management' || level === 'Manager') return 'lvl-mgr';
  if (level === 'Supervisor') return 'lvl-sup';
  if (level === 'Leader') return 'lvl-lead';
  return 'lvl-op';
}

function statCard(label, value, tone) {
  return h('div', { class: 'card stat tinted ' + tone }, h('div', { class: 'stat__label' }, label), h('div', { class: 'stat__value' }, value));
}

// Edit a node: who they report to (loop-guarded), their area and position.
function editNode(e, reload) {
  const banned = descendants(e.id); banned.add(e.id); // can't report to self or own descendants
  const options = emps.filter((x) => !banned.has(x.id))
    .sort((a, b) => rank(a) - rank(b) || (a.name || '').localeCompare(b.name || ''))
    .map((x) => ({ value: x.id, label: (x.name || x.empCode) + (x.position ? ' — ' + x.position : '') }));
  const mgrSel = select([{ value: '', label: t('org.noManager') }, ...options], { value: e.managerId || '' });
  const area = input({ value: e.area || '' });
  const position = input({ value: e.position || '' });
  const err = h('div', { class: 'chip danger', style: { display: 'none', marginBottom: '12px' } });
  const saveBtn = h('button', { class: 'btn btn-primary' }, t('common.save'));

  const m = openModal({
    title: e.name || e.empCode || t('common.edit'),
    body: h('div', {}, err,
      h('div', { class: 'banner', style: { marginBottom: '16px' } }, t('org.editHint')),
      field(t('org.reportsTo'), mgrSel),
      h('div', { class: 'row' }, field(t('emp.area'), area), field(t('emp.position'), position))
    ),
    footer: h('div', { class: 'btn-row' }, h('button', { class: 'btn', onClick: () => m.close() }, t('common.cancel')), saveBtn),
  });
  saveBtn.addEventListener('click', async () => {
    err.style.display = 'none'; saveBtn.disabled = true;
    try {
      await api.put('/employees/' + e.id, { managerId: mgrSel.value || null, area: area.value, position: position.value });
      m.close(); toast(t('common.saved'), 'success'); reload();
    } catch (er) { err.textContent = er.message; err.style.display = ''; saveBtn.disabled = false; }
  });
}
