// Change-password modal, shared by the shell and the Preferences page.
import { api } from './api.js';
import { h, openModal, field, input, toast } from './ui.js';
import { t } from './i18n.js';

export function openChangePassword() {
  const cur = input({ type: 'password', autocomplete: 'current-password' });
  const nw = input({ type: 'password', autocomplete: 'new-password' });
  const nw2 = input({ type: 'password', autocomplete: 'new-password' });
  const err = h('div', { class: 'chip danger', style: { display: 'none', marginBottom: '12px' } });
  const save = h('button', { class: 'btn btn-primary' }, t('pw.update'));
  const m = openModal({
    title: t('pw.change'),
    body: h('div', {}, err, field(t('pw.current'), cur), field(t('pw.new'), nw, t('pw.newHint')), field(t('pw.confirm'), nw2)),
    footer: h('div', { class: 'btn-row' }, h('button', { class: 'btn', onClick: () => m.close() }, t('common.cancel')), save),
  });
  save.addEventListener('click', async () => {
    err.style.display = 'none';
    if (nw.value !== nw2.value) { err.textContent = t('pw.mismatch'); err.style.display = ''; return; }
    save.disabled = true;
    try { await api.post('/change-password', { currentPassword: cur.value, newPassword: nw.value }); m.close(); toast(t('pw.updated'), 'success'); }
    catch (e) { err.textContent = e.message; err.style.display = ''; save.disabled = false; }
  });
}
