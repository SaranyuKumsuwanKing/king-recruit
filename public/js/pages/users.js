// Admin: app logins for HR and supervisors. A login can be linked to an employee record
// so a supervisor can approve their team's leave. Floor workers who only use the face
// scanner do not need a login.
import { api } from '../api.js';
import { h, mount, clear, field, input, select, toast, openModal, confirmDialog, initials } from '../ui.js';
import { t } from '../i18n.js';

export async function render(root) {
  const [users, employees] = await Promise.all([api.get('/users'), api.get('/employees')]);
  const empById = Object.fromEntries(employees.map((e) => [e.id, e]));
  const card = h('div', { class: 'card' });
  const rebuild = async () => { const fresh = await api.get('/users'); paint(fresh); };

  function paint(list) {
    clear(card);
    card.append(
      h('div', { class: 'card__head' }, h('h3', {}, t('nav.users')), h('div', { class: 'topbar__spacer' }),
        h('button', { class: 'btn btn-primary btn-sm', onClick: () => editUser(null, employees, rebuild) }, t('users.add'))),
      list.length ? table(list, empById, employees, rebuild) : h('div', { class: 'card__pad muted' }, t('users.none'))
    );
  }
  paint(users);
  mount(root, h('p', { class: 'page-intro' }, t('users.intro')), card);
}

function statusChip(u) {
  if (u.role === 'admin') return h('span', { class: 'chip ok' }, t('role.administrator'));
  if (!u.hasLogin) return h('span', { class: 'chip warn' }, t('pw.set'));
  if (!u.active) return h('span', { class: 'chip muted' }, t('common.inactive'));
  return h('span', { class: 'chip ok' }, t('common.active'));
}

function table(list, empById, employees, rebuild) {
  return h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, h('th', {}, t('common.name')), h('th', {}, t('login.username')), h('th', {}, t('users.linkedTo')), h('th', {}, t('common.status')), h('th', { class: 'td-right' }, t('common.actions')))),
    h('tbody', {}, list.map((u) => h('tr', {},
      h('td', {}, h('div', { class: 'spread' }, h('span', { class: 'avatar' }, initials(u.name, u.username)),
        h('div', {}, h('div', { class: 'cellname' }, u.name || u.username), u.title ? h('div', { class: 'cellsub' }, u.title) : null))),
      h('td', { class: 'mono' }, u.username),
      h('td', { class: 'cellsub' }, u.employeeId && empById[u.employeeId] ? (empById[u.employeeId].name || empById[u.employeeId].empCode) : '—', u.admin && u.role !== 'admin' ? h('span', { class: 'chip info', style: { marginLeft: '6px' } }, t('users.admin')) : null),
      h('td', {}, statusChip(u)),
      h('td', { class: 'td-right' }, h('div', { class: 'btn-row', style: { justifyContent: 'flex-end' } },
        h('button', { class: 'btn btn-sm btn-ghost', onClick: () => editUser(u, employees, rebuild) }, t('common.edit')),
        h('button', { class: 'btn btn-sm btn-ghost', onClick: () => setPassword(u, rebuild) }, u.hasLogin ? t('users.resetPw') : t('users.setPw')),
        u.role !== 'admin' ? h('button', { class: 'btn btn-sm btn-danger', onClick: () => removeUser(u, rebuild) }, t('common.delete')) : null
      ))
    )))
  ));
}

function editUser(u, employees, rebuild) {
  const isNew = !u;
  const isGM = !!(u && u.role === 'admin');
  const name = input({ value: u?.name || '', placeholder: 'e.g. Sunisa J.' });
  const title = input({ value: u?.title || '', placeholder: 'e.g. HR Manager', list: 'role-suggestions' });
  const roleList = h('datalist', { id: 'role-suggestions' }, ['General Manager', 'HR Manager', 'Recruitment Officer', 'Hiring Manager', 'HR Officer', 'Supervisor'].map((r) => h('option', { value: r })));
  const username = input({ value: u?.username || '', placeholder: 'e.g. sunisa' });
  const empSel = select([{ value: '', label: '—' }, ...employees.map((e) => ({ value: e.id, label: (e.empCode ? e.empCode + ' · ' : '') + (e.name || e.id) }))], { value: u?.employeeId || '' });
  const adminChk = h('input', { type: 'checkbox' }); adminChk.checked = isGM || !!(u && u.admin); adminChk.disabled = isGM;
  const err = h('div', { class: 'chip danger', style: { display: 'none', marginBottom: '12px' } });
  const saveBtn = h('button', { class: 'btn btn-primary' }, isNew ? t('users.add') : t('common.save'));
  const m = openModal({
    title: isNew ? t('users.add') : (u.name || u.username),
    body: h('div', {}, err, roleList,
      h('div', { class: 'row' }, field(t('common.name'), name), field(t('users.role'), title)),
      field(t('login.username'), username),
      field(t('users.linkedTo'), empSel),
      field(t('users.admin'), h('label', { class: 'spread', style: { gap: '8px', cursor: isGM ? 'default' : 'pointer' } }, adminChk, h('span', {}, t('users.adminHint'))))),
    footer: h('div', { class: 'btn-row' }, h('button', { class: 'btn', onClick: () => m.close() }, t('common.cancel')), saveBtn),
  });
  saveBtn.addEventListener('click', async () => {
    err.style.display = 'none';
    const payload = { name: name.value, title: title.value, username: username.value, employeeId: empSel.value || null, admin: adminChk.checked };
    if (!payload.username.trim()) { err.textContent = 'A username is required.'; err.style.display = ''; return; }
    saveBtn.disabled = true;
    try { if (isNew) await api.post('/users', payload); else await api.put('/users/' + u.id, payload); m.close(); toast(t('common.saved'), 'success'); rebuild(); }
    catch (e) { err.textContent = e.message; err.style.display = ''; saveBtn.disabled = false; }
  });
}

function setPassword(u, rebuild) {
  const pw = input({ type: 'text', value: suggestPassword() });
  const err = h('div', { class: 'chip danger', style: { display: 'none', marginBottom: '12px' } });
  const saveBtn = h('button', { class: 'btn btn-primary' }, t('users.setPw'));
  const m = openModal({
    title: 'Login for ' + (u.name || u.username),
    body: h('div', {}, err, h('p', { class: 'muted small' }, 'Username: ', h('b', {}, u.username)),
      field('Temporary password', pw, 'Share privately. They will set their own at first sign-in.')),
    footer: h('div', { class: 'btn-row' }, h('button', { class: 'btn', onClick: () => m.close() }, t('common.cancel')), saveBtn),
  });
  saveBtn.addEventListener('click', async () => {
    err.style.display = 'none'; saveBtn.disabled = true;
    try { await api.post('/users/' + u.id + '/password', { password: pw.value }); m.close(); toast('Login is ready', 'success'); rebuild(); }
    catch (e) { err.textContent = e.message; err.style.display = ''; saveBtn.disabled = false; }
  });
}

async function removeUser(u, rebuild) {
  const ok = await confirmDialog(h('div', {}, 'Delete login ', h('b', {}, u.username), '?'), { confirmText: t('common.delete'), danger: true, title: t('common.delete') });
  if (!ok) return;
  try { await api.del('/users/' + u.id); toast(t('common.deleted')); rebuild(); }
  catch (e) { toast(e.message, 'error'); }
}

function suggestPassword() {
  const words = ['King', 'Living', 'Teak', 'Linen', 'Oak', 'Stone', 'Brass', 'Velvet'];
  const w = words[Math.floor(Math.random() * words.length)];
  return w + '-' + Math.floor(1000 + Math.random() * 9000);
}
