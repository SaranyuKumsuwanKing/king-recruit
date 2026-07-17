// Admin: branding, currency, and data backup.
import { api } from '../api.js';
import { state } from '../state.js';
import { h, mount, field, input, textarea, select, toast } from '../ui.js';
import { t } from '../i18n.js';
import { qrSvg } from '../qr.js';

export async function render(root) {
  const s = await api.get('/settings');
  const careers = s.careers || {};

  /* careers portal */
  const introEn = textarea({ value: careers.intro || '', style: { minHeight: '90px' } });
  const introTh = textarea({ value: careers.introTh || '', style: { minHeight: '90px' } });
  const pdpaEn = textarea({ value: careers.pdpa || '', style: { minHeight: '120px' } });
  const pdpaTh = textarea({ value: careers.pdpaTh || '', style: { minHeight: '120px' } });
  const saveCareers = h('button', { class: 'btn btn-primary' }, t('settings.save'));
  saveCareers.addEventListener('click', async () => {
    try { await api.put('/settings', { careers: { intro: introEn.value, introTh: introTh.value, pdpa: pdpaEn.value, pdpaTh: pdpaTh.value } }); toast(t('common.saved'), 'success'); }
    catch (e) { toast(e.message, 'error'); }
  });
  const portalUrl = location.origin + '/apply';

  function qrBlock(url) {
    let svg = '';
    try { svg = qrSvg(url, { scale: 6 }); } catch (e) { svg = ''; }
    const printEl = h('div', { class: 'qr-print' },
      h('div', { html: qrSvg(url, { scale: 10 }), style: { width: '320px', margin: '0 auto' } }),
      h('h2', { style: { fontFamily: 'Georgia, serif', marginTop: '16px' } }, t('settings.qrCaption')),
      h('p', {}, url));
    const printBtn = h('button', { class: 'btn btn-sm', onClick: () => {
      document.body.classList.add('printing-qr');
      const onAfter = () => { document.body.classList.remove('printing-qr'); window.removeEventListener('afterprint', onAfter); };
      window.addEventListener('afterprint', onAfter);
      window.print();
    } }, t('settings.qrPrint'));
    return h('div', { class: 'field' },
      h('label', {}, t('settings.qr')),
      h('div', { class: 'qr-wrap' },
        svg ? h('div', { class: 'qr-box', html: svg }) : h('div', { class: 'muted small' }, '—'),
        h('div', {}, h('p', { class: 'small muted', style: { marginTop: 0 } }, t('settings.qrHint')), printBtn)),
      printEl);
  }

  /* branding */
  const appName = input({ value: s.appName || '' });
  const saveName = h('button', { class: 'btn btn-primary' }, t('settings.saveName'));
  saveName.addEventListener('click', async () => {
    try { const r = await api.put('/settings', { appName: appName.value }); state.branding.appName = r.appName; document.title = r.appName; toast(t('common.saved'), 'success'); window.__kt.relayout(); }
    catch (e) { toast(e.message, 'error'); }
  });

  const logoInput = h('input', { type: 'file', accept: 'image/*', class: 'input' });
  const logoPreview = h('img', { src: s.logoDataUrl || '', style: { maxHeight: '40px', display: s.logoDataUrl ? '' : 'none' } });
  logoInput.addEventListener('change', async () => {
    const f = logoInput.files[0]; if (!f) return;
    if (f.size > 1.5 * 1024 * 1024) { toast('Logo must be under 1.5 MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = async () => {
      try { await api.put('/settings/logo', { dataUrl: reader.result }); state.branding.logoDataUrl = reader.result; logoPreview.src = reader.result; logoPreview.style.display = ''; toast(t('common.saved'), 'success'); window.__kt.relayout(); }
      catch (e) { toast(e.message, 'error'); }
    };
    reader.readAsDataURL(f);
  });

  /* general */
  const currency = input({ value: s.currency || 'THB' });
  const saveGeneral = h('button', { class: 'btn btn-primary' }, t('settings.save'));
  saveGeneral.addEventListener('click', async () => {
    try { await api.put('/settings', { currency: currency.value }); state.settings = await api.get('/settings'); toast(t('common.saved'), 'success'); }
    catch (e) { toast(e.message, 'error'); }
  });

  /* email notifications */
  const em = s.email || {};
  const emEnabled = h('input', { type: 'checkbox' }); emEnabled.checked = !!em.enabled;
  const emHost = input({ value: em.host || '', placeholder: 'smtp.office365.com' });
  const emPort = input({ type: 'number', value: em.port || 587, style: { maxWidth: '120px' } });
  const emSecure = select([{ value: 'starttls', label: 'STARTTLS (587)' }, { value: 'ssl', label: 'SSL/TLS (465)' }], { value: em.secure ? 'ssl' : 'starttls' });
  const emUser = input({ value: em.user || '', placeholder: 'careers@kingliving.co.th' });
  const emPass = input({ type: 'password', placeholder: em.hasPassword ? '•••••••• (saved — leave blank to keep)' : '', autocomplete: 'new-password' });
  const emFromName = input({ value: em.fromName || 'King Living Careers' });
  const emFromEmail = input({ value: em.fromEmail || '', placeholder: 'careers@kingliving.co.th' });
  const emHrNotify = input({ value: em.hrNotify || '', placeholder: 'hr@kingliving.co.th (optional)' });
  const emSubject = input({ value: em.confirmSubject || '' });
  const emBody = textarea({ value: em.confirmBody || '', style: { minHeight: '150px' } });
  const collectEmail = () => ({
    enabled: emEnabled.checked, host: emHost.value, port: emPort.value, secure: emSecure.value === 'ssl',
    user: emUser.value, fromName: emFromName.value, fromEmail: emFromEmail.value, hrNotify: emHrNotify.value,
    confirmSubject: emSubject.value, confirmBody: emBody.value,
    ...(emPass.value ? { password: emPass.value } : {}),
  });
  const saveEmail = h('button', { class: 'btn btn-primary' }, t('settings.save'));
  saveEmail.addEventListener('click', async () => {
    try { await api.put('/settings', { email: collectEmail() }); emPass.value = ''; toast(t('common.saved'), 'success'); }
    catch (e) { toast(e.message, 'error'); }
  });
  const testTo = input({ value: em.user || '', placeholder: 'you@kingliving.co.th', style: { maxWidth: '260px' } });
  const testBtn = h('button', { class: 'btn' }, t('settings.emailTest'));
  testBtn.addEventListener('click', async () => {
    testBtn.disabled = true; testBtn.textContent = t('settings.emailTesting');
    try { await api.put('/settings', { email: collectEmail() }); emPass.value = ''; await api.post('/settings/test-email', { to: testTo.value }); toast(t('settings.emailTestOk'), 'success'); }
    catch (e) { toast(e.message, 'error'); }
    finally { testBtn.disabled = false; testBtn.textContent = t('settings.emailTest'); }
  });

  mount(root,
    h('p', { class: 'page-intro' }, t('settings.intro')),
    h('div', { class: 'card', style: { marginBottom: '18px' } },
      h('div', { class: 'card__head' }, h('h3', {}, t('settings.branding'))),
      h('div', { class: 'card__pad' },
        field(t('settings.appName'), h('div', { class: 'spread', style: { gap: '10px' } }, appName, saveName)),
        field(t('settings.logo'), h('div', { class: 'spread', style: { gap: '12px' } }, logoPreview, logoInput)))),
    h('div', { class: 'card', style: { marginBottom: '18px' } },
      h('div', { class: 'card__head' }, h('h3', {}, t('settings.general'))),
      h('div', { class: 'card__pad' },
        h('div', { class: 'row' }, field(t('settings.currency'), currency), h('div', {})),
        h('div', { class: 'spread', style: { marginTop: '8px' } }, h('div', { class: 'topbar__spacer' }), saveGeneral))),
    h('div', { class: 'card', style: { marginBottom: '18px' } },
      h('div', { class: 'card__head' }, h('h3', {}, t('settings.careers')), h('div', { class: 'topbar__spacer' }), saveCareers),
      h('div', { class: 'card__pad' },
        h('p', { class: 'small muted', style: { marginTop: 0 } }, t('settings.careersIntro')),
        h('div', { class: 'banner', style: { marginBottom: '16px' } }, t('settings.portalLink') + ': ',
          h('a', { href: '/apply', target: '_blank', style: { fontWeight: '600' } }, portalUrl)),
        qrBlock(portalUrl),
        h('div', { class: 'row' }, field(t('settings.introEn'), introEn), field(t('settings.introTh'), introTh)),
        h('div', { class: 'row' }, field(t('settings.pdpaEn'), pdpaEn), field(t('settings.pdpaTh'), pdpaTh)))),
    h('div', { class: 'card', style: { marginBottom: '18px' } },
      h('div', { class: 'card__head' }, h('h3', {}, t('settings.email')), h('div', { class: 'topbar__spacer' }), saveEmail),
      h('div', { class: 'card__pad' },
        h('p', { class: 'small muted', style: { marginTop: 0 } }, t('settings.emailIntro')),
        s.emailAvailable === false ? h('div', { class: 'chip warn', style: { marginBottom: '14px' } }, t('settings.emailNotInstalled')) : null,
        h('div', { class: 'field' }, h('label', { class: 'spread', style: { gap: '8px', cursor: 'pointer' } }, emEnabled, h('span', {}, t('settings.emailEnabled')))),
        h('div', { class: 'row' }, field(t('settings.emailHost'), emHost), field(t('settings.emailPort'), h('div', { class: 'spread', style: { gap: '8px' } }, emPort, emSecure))),
        h('div', { class: 'row' }, field(t('settings.emailUser'), emUser), field(t('settings.emailPass'), emPass)),
        h('div', { class: 'row' }, field(t('settings.emailFromName'), emFromName), field(t('settings.emailFromEmail'), emFromEmail)),
        field(t('settings.emailHrNotify'), emHrNotify),
        h('hr', { class: 'divider' }),
        h('p', { class: 'small muted', style: { marginTop: 0 } }, t('settings.emailTemplateHint')),
        field(t('settings.emailSubject'), emSubject),
        field(t('settings.emailBody'), emBody),
        h('hr', { class: 'divider' }),
        field(t('settings.emailTestLabel'), h('div', { class: 'spread', style: { gap: '10px' } }, testTo, testBtn)))),
    h('div', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', {}, t('settings.data'))),
      h('div', { class: 'card__pad' },
        h('p', { class: 'small muted', style: { marginTop: '0' } }, 'Everything is stored in data/db.json next to the app. Download a copy to keep it safe.'),
        h('a', { class: 'btn', href: '/api/export' }, t('settings.download'))))
  );
}
