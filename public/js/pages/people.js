// Admin: the organisation — hiring managers and interviewers. Import the list straight from
// King Time (employee CSV export), or add people one at a time.
import { api } from '../api.js';
import { state } from '../state.js';
import { h, mount, clear, field, input, select, toast, openModal, confirmDialog, initials, icon } from '../ui.js';
import { t } from '../i18n.js';
import { exportMenu } from '../export.js';
import { parseCsv } from '../csv.js';

let cache = [];
const filters = { q: '', dept: '', level: '' };

function applyFilters(list) {
  const q = filters.q.trim().toLowerCase();
  return list.filter((e) =>
    (!filters.dept || e.department === filters.dept) &&
    (!filters.level || e.level === filters.level) &&
    (!q || (e.name || '').toLowerCase().includes(q) || (e.empCode || '').toLowerCase().includes(q))
  );
}

export async function render(root) {
  cache = await api.get('/employees');
  const card = h('div', { class: 'card' });
  const countChip = h('span', { class: 'chip muted' }, '');
  const tableHost = h('div', {});
  const rebuild = async () => { cache = await api.get('/employees'); paint(); };
  const distinct = (key) => [...new Set(cache.map((e) => e[key]).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  function refreshTable() {
    const list = applyFilters(cache);
    countChip.textContent = list.length === cache.length ? String(cache.length) : `${list.length} / ${cache.length}`;
    mount(tableHost, table(list, rebuild));
  }

  function paint() {
    clear(card);
    const searchBox = input({ placeholder: t('people.searchPlaceholder'), value: filters.q, style: { maxWidth: '260px' } });
    searchBox.addEventListener('input', () => { filters.q = searchBox.value; refreshTable(); });
    const deptSel = select([{ value: '', label: t('people.allDepts') }, ...distinct('department').map((a) => ({ value: a, label: a }))], { value: filters.dept, style: 'width:auto' });
    deptSel.addEventListener('change', () => { filters.dept = deptSel.value; refreshTable(); });
    const lvlSel = select([{ value: '', label: t('people.allLevels') }, ...distinct('level').map((a) => ({ value: a, label: a }))], { value: filters.level, style: 'width:auto' });
    lvlSel.addEventListener('change', () => { filters.level = lvlSel.value; refreshTable(); });
    const clearBtn = h('button', { class: 'btn btn-sm btn-ghost', onClick: () => { filters.q = ''; filters.dept = ''; filters.level = ''; paint(); } }, t('common.clear'));

    card.append(
      h('div', { class: 'card__head' },
        h('h3', {}, t('nav.people')), countChip, h('div', { class: 'topbar__spacer' }),
        exportMenu('people', [
          { key: 'empCode', label: t('people.code') }, { key: 'name', label: t('common.name') },
          { key: 'department', label: t('people.dept') }, { key: 'area', label: t('people.area') },
          { key: 'position', label: t('people.position') }, { key: 'level', label: t('people.level') },
          { key: 'email', label: t('people.email') }, { key: 'phone', label: t('people.phone') },
        ], () => applyFilters(cache), 'People'),
        h('button', { class: 'btn btn-sm', onClick: () => importModal(rebuild) }, t('people.import')),
        h('button', { class: 'btn btn-primary btn-sm', onClick: () => editPerson(null, rebuild) }, t('people.add'))
      ),
      h('div', { class: 'card__pad', style: { borderBottom: '1px solid var(--line)', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' } },
        h('div', { class: 'spread', style: { gap: '6px', flex: '1', minWidth: '200px' } }, icon('search', 'navlink__icon'), searchBox),
        deptSel, lvlSel, clearBtn),
      tableHost
    );
    refreshTable();
  }

  paint();
  mount(root, h('p', { class: 'page-intro' }, t('people.intro')), card);
}

function table(list, rebuild) {
  if (!list.length) return h('div', { class: 'card__pad muted' }, t('people.none'));
  return h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {},
      h('th', {}, t('people.code')), h('th', {}, t('common.name')), h('th', {}, t('people.position')),
      h('th', {}, t('people.dept')), h('th', {}, t('people.level')), h('th', {}, t('people.phone')),
      h('th', { class: 'td-right' }, t('common.actions')))),
    h('tbody', {}, list.map((e) => h('tr', {},
      h('td', { class: 'mono' }, e.empCode || h('span', { class: 'muted' }, '—')),
      h('td', {}, h('div', { class: 'spread' }, h('span', { class: 'avatar' }, initials(e.name, e.empCode)), h('span', { class: 'cellname' }, e.name || '—'))),
      h('td', { class: 'cellsub' }, e.position || '—'),
      h('td', { class: 'cellsub' }, e.department || '—'),
      h('td', {}, e.level ? h('span', { class: 'chip' }, e.level) : h('span', { class: 'muted' }, '—')),
      h('td', { class: 'cellsub mono' }, e.phone || '—'),
      h('td', { class: 'td-right' }, h('div', { class: 'btn-row', style: { justifyContent: 'flex-end' } },
        h('button', { class: 'btn btn-sm btn-ghost', onClick: () => editPerson(e, rebuild) }, t('common.edit')),
        h('button', { class: 'btn btn-sm btn-danger', onClick: () => removePerson(e, rebuild) }, t('common.delete'))))
    )))
  ));
}

function editPerson(e, rebuild) {
  const isNew = !e;
  const empCode = input({ value: e?.empCode || '', placeholder: 'e.g. EMP-00001' });
  const name = input({ value: e?.name || '', placeholder: 'e.g. Jane Smith' });
  const position = input({ value: e?.position || '', placeholder: 'e.g. Production Manager' });
  const department = input({ value: e?.department || '', placeholder: 'e.g. MANU Production' });
  const area = input({ value: e?.area || '', placeholder: 'e.g. Assembly' });
  const lvlSel = select([{ value: '', label: '—' }, ...state.levels.map((l) => ({ value: l, label: l }))], { value: e?.level || '' });
  const email = input({ type: 'email', value: e?.email || '' });
  const phone = input({ value: e?.phone || '' });
  const mgrSel = select([{ value: '', label: '—' }, ...cache.filter((x) => !e || x.id !== e.id).map((x) => ({ value: x.id, label: (x.empCode ? x.empCode + ' · ' : '') + (x.name || x.position || x.id) }))], { value: e?.managerId || '' });

  const err = h('div', { class: 'chip danger', style: { display: 'none', marginBottom: '12px' } });
  const saveBtn = h('button', { class: 'btn btn-primary' }, isNew ? t('people.add') : t('common.save'));
  const m = openModal({
    size: 'lg',
    title: isNew ? t('people.add') : (e.name || e.empCode || t('common.edit')),
    body: h('div', {}, err,
      h('div', { class: 'row' }, field(t('people.code'), empCode), field(t('common.name'), name)),
      h('div', { class: 'row' }, field(t('people.position'), position), field(t('people.level'), lvlSel)),
      h('div', { class: 'row' }, field(t('people.dept'), department), field(t('people.area'), area)),
      h('div', { class: 'row' }, field(t('people.email'), email), field(t('people.phone'), phone)),
      h('div', { class: 'row' }, field(t('people.manager'), mgrSel), h('div', {}))),
    footer: h('div', { class: 'btn-row' }, h('button', { class: 'btn', onClick: () => m.close() }, t('common.cancel')), saveBtn),
  });
  saveBtn.addEventListener('click', async () => {
    err.style.display = 'none';
    const payload = { empCode: empCode.value, name: name.value, position: position.value, department: department.value, area: area.value, level: lvlSel.value, email: email.value, phone: phone.value, managerId: mgrSel.value || null };
    if (!payload.name && !payload.empCode) { err.textContent = 'A name or staff code is required.'; err.style.display = ''; return; }
    saveBtn.disabled = true;
    try { if (isNew) await api.post('/employees', payload); else await api.put('/employees/' + e.id, payload); m.close(); toast(t('common.saved'), 'success'); rebuild(); }
    catch (er) { err.textContent = er.message; err.style.display = ''; saveBtn.disabled = false; }
  });
}

async function removePerson(e, rebuild) {
  const ok = await confirmDialog(h('div', {}, 'Delete ', h('b', {}, e.name || e.empCode), '?'), { confirmText: t('common.delete'), danger: true, title: t('common.delete') });
  if (!ok) return;
  try { await api.del('/employees/' + e.id); toast(t('common.deleted')); rebuild(); }
  catch (er) { toast(er.message, 'error'); }
}

function importModal(rebuild) {
  const fileInput = h('input', { type: 'file', accept: '.csv,text/csv', class: 'input' });
  const result = h('div', { class: 'small muted', style: { marginTop: '10px' } });
  const err = h('div', { class: 'chip danger', style: { display: 'none', marginBottom: '12px' } });
  const saveBtn = h('button', { class: 'btn btn-primary', disabled: true }, t('people.import'));
  let rows = [];
  fileInput.addEventListener('change', async () => {
    err.style.display = 'none'; result.textContent = '';
    const f = fileInput.files[0]; if (!f) return;
    try { rows = parseCsv(await f.text()); result.textContent = rows.length + ' row(s) ready to import.'; saveBtn.disabled = rows.length === 0; }
    catch (e) { err.textContent = e.message; err.style.display = ''; }
  });
  const m = openModal({
    size: 'lg', title: t('people.importTitle'),
    body: h('div', {}, err, h('p', { class: 'small muted', style: { marginTop: '0' } }, t('people.importHint')), field(t('people.importBtn'), fileInput), result),
    footer: h('div', { class: 'btn-row' }, h('button', { class: 'btn', onClick: () => m.close() }, t('common.cancel')), saveBtn),
  });
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    try { const r = await api.post('/employees/import', { rows }); m.close(); toast(t('people.importDone', { created: r.created, updated: r.updated, skipped: r.skipped }), 'success'); rebuild(); }
    catch (e) { err.textContent = e.message; err.style.display = ''; saveBtn.disabled = false; }
  });
}
