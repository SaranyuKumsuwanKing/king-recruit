// King Recruit — front-end entry point: theme, language, auth screens, layout, router.
import { api } from './api.js';
import { state, isAdmin, loadRefs } from './state.js';
import { h, mount, clear, icon, field, input, initials, spinner } from './ui.js';
import { t, getLang, setLang } from './i18n.js';
import { openChangePassword } from './account.js';

import * as dashboard from './pages/dashboard.js';
import * as requisitions from './pages/requisitions.js';
import * as candidates from './pages/candidates.js';
import * as pipeline from './pages/pipeline.js';
import * as interviews from './pages/interviews.js';
import * as people from './pages/people.js';
import * as setup from './pages/setup.js';
import * as settings from './pages/settings.js';
import * as users from './pages/users.js';
import * as preferences from './pages/preferences.js';

const root = document.getElementById('app');

/* ------------------------------ theme ------------------------------ */
const THEMES = ['light', 'dark', 'futuristic'];
function ckGet(n) { return (document.cookie.split('; ').find((c) => c.indexOf(n + '=') === 0) || '').split('=')[1] || ''; }
function ckSet(n, v) { document.cookie = `${n}=${v}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`; }
const prefersDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
export function storedTheme() { return ckGet('kt_theme') || localStorage.getItem('kt-theme') || 'system'; }
function effectiveTheme() { const tt = storedTheme(); return tt === 'system' ? (prefersDark() ? 'dark' : 'light') : tt; }
function applyTheme() {
  const e = effectiveTheme();
  if (e === 'light') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', e);
}
export function setTheme(v) { ckSet('kt_theme', v); try { localStorage.setItem('kt-theme', v); } catch {} applyTheme(); }
applyTheme();
if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (storedTheme() === 'system') applyTheme(); });

function cycleThemeButton() {
  const btn = h('button', { class: 'btn btn-icon btn-ghost login__toggle', title: 'Theme' });
  const paint = () => mount(btn, icon(effectiveTheme() === 'light' ? 'moon' : 'sun', 'navlink__icon'));
  btn.addEventListener('click', () => { const cur = effectiveTheme(); setTheme(THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length]); paint(); });
  paint();
  return btn;
}

/* ------------------------------- nav ------------------------------- */
const ADMIN_NAV = [
  { path: 'dashboard', key: 'nav.dashboard', icon: 'dashboard', page: dashboard, section: 'nav.sec.overview' },
  { path: 'requisitions', key: 'nav.requisitions', icon: 'briefcase', page: requisitions, section: 'nav.sec.hiring' },
  { path: 'candidates', key: 'nav.candidates', icon: 'team', page: candidates, section: 'nav.sec.hiring' },
  { path: 'pipeline', key: 'nav.pipeline', icon: 'board', page: pipeline, section: 'nav.sec.hiring' },
  { path: 'interviews', key: 'nav.interviews', icon: 'calendar', page: interviews, section: 'nav.sec.hiring' },
  { path: 'people', key: 'nav.people', icon: 'user', page: people, section: 'nav.sec.org' },
  { path: 'careers', key: 'nav.careersPage', icon: 'briefcase', ext: '/apply', section: 'nav.sec.org' },
  { path: 'setup', key: 'nav.setup', icon: 'sliders', page: setup, section: 'nav.sec.setup' },
  { path: 'users', key: 'nav.users', icon: 'user', page: users, section: 'nav.sec.setup' },
  { path: 'settings', key: 'nav.settings', icon: 'settings', page: settings, section: 'nav.sec.setup' },
];
const PREFS = { path: 'preferences', key: 'nav.preferences', icon: 'sun', page: preferences, section: 'nav.sec.me' };

function navFor() {
  if (isAdmin()) return [...ADMIN_NAV, PREFS];
  // hiring managers see their own requisitions and pipeline only
  const nav = [
    { path: 'dashboard', key: 'nav.dashboard', icon: 'dashboard', page: dashboard, section: 'nav.sec.overview' },
    { path: 'requisitions', key: 'nav.requisitions', icon: 'briefcase', page: requisitions, section: 'nav.sec.hiring' },
    { path: 'candidates', key: 'nav.candidates', icon: 'team', page: candidates, section: 'nav.sec.hiring' },
    { path: 'pipeline', key: 'nav.pipeline', icon: 'board', page: pipeline, section: 'nav.sec.hiring' },
    { path: 'interviews', key: 'nav.interviews', icon: 'calendar', page: interviews, section: 'nav.sec.hiring' },
    PREFS,
  ];
  return nav;
}

/* ------------------------------ wordmark ---------------------------- */
function wordmark() {
  if (state.branding.logoDataUrl) return h('div', { class: 'wordmark' }, h('img', { class: 'wordmark__logo', src: state.branding.logoDataUrl, alt: state.branding.appName }));
  return h('div', { class: 'wordmark' }, h('div', { class: 'wordmark__fallback' }, 'King Living', h('small', {}, (state.branding.appName || 'King Recruit').replace(/^King\s*/i, '') || 'Recruit')));
}

/* ------------------------------- boot ------------------------------- */
async function boot() {
  try { state.branding = await api.get('/branding'); } catch {}
  document.title = state.branding.appName || 'King Recruit';
  let me = null;
  try { me = (await api.get('/me')).user; } catch {}
  state.user = me;
  if (!state.user) return renderLogin();
  await afterLogin();
}

async function afterLogin() {
  if (state.user.mustChangePassword) return renderForcePassword();
  try { state.settings = await api.get('/settings'); } catch {}
  await loadRefs();
  renderShell();
  if (!location.hash || location.hash === '#/' || location.hash === '#') location.hash = '#/dashboard';
  else route();
}

/* ------------------------------ login ------------------------------- */
function renderLogin() {
  const username = input({ placeholder: t('login.username'), autocomplete: 'username', autofocus: true });
  const password = input({ type: 'password', placeholder: t('login.password'), autocomplete: 'current-password' });
  const errBox = h('div', { class: 'chip danger', style: { display: 'none', marginBottom: '14px' } });
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('login.signIn'));
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      errBox.style.display = 'none'; btn.disabled = true; btn.textContent = t('login.signingIn');
      try { const r = await api.post('/login', { username: username.value.trim(), password: password.value }); state.user = r.user; await afterLogin(); }
      catch (err) { errBox.textContent = err.message; errBox.style.display = ''; btn.disabled = false; btn.textContent = t('login.signIn'); }
    },
  }, field(t('login.username'), username), field(t('login.password'), password), errBox, btn);

  mount(root, h('div', { class: 'login' },
    h('div', { class: 'login__brand' }, wordmark(),
      h('div', { class: 'login__tag' }, h('h1', {}, t('login.tagTitle')), h('p', {}, t('login.tagSub'))),
      h('div', { class: 'login__brandfoot' }, t('login.internalOnly'))),
    h('div', { class: 'login__panel' }, langButton(renderLogin), cycleThemeButton(),
      h('div', { class: 'login__card' }, h('h2', {}, t('login.welcome')), h('p', { class: 'sub' }, t('login.signInTo', { app: state.branding.appName || 'King Recruit' })), form))
  ));
  root.className = '';
}

function renderForcePassword() {
  const cur = input({ type: 'password', placeholder: t('pw.current'), autocomplete: 'current-password' });
  const nw = input({ type: 'password', placeholder: t('pw.new'), autocomplete: 'new-password' });
  const nw2 = input({ type: 'password', placeholder: t('pw.confirm'), autocomplete: 'new-password' });
  const errBox = h('div', { class: 'chip danger', style: { display: 'none', marginBottom: '14px' } });
  const btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('pw.set'));
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault(); errBox.style.display = 'none';
      if (nw.value !== nw2.value) { errBox.textContent = t('pw.mismatch'); errBox.style.display = ''; return; }
      btn.disabled = true;
      try { await api.post('/change-password', { currentPassword: cur.value, newPassword: nw.value }); state.user.mustChangePassword = false; await afterLogin(); }
      catch (err) { errBox.textContent = err.message; errBox.style.display = ''; btn.disabled = false; }
    },
  }, field(t('pw.current'), cur), field(t('pw.new'), nw), field(t('pw.confirm'), nw2), errBox, btn);

  mount(root, h('div', { class: 'login' },
    h('div', { class: 'login__brand' }, wordmark(), h('div', { class: 'login__tag' }, h('h1', {}, t('pw.oneStep')), h('p', {}, t('pw.oneStepSub'))), h('div', { class: 'login__brandfoot' }, t('login.internalOnly'))),
    h('div', { class: 'login__panel' }, langButton(renderForcePassword), cycleThemeButton(), h('div', { class: 'login__card' }, h('h2', {}, t('pw.title')), h('p', { class: 'sub' }, t('pw.sub')), form))
  ));
  root.className = '';
}

function langButton(rerender) {
  const btn = h('button', { class: 'btn btn-sm btn-ghost', style: { position: 'absolute', top: '16px', right: '58px' } }, getLang() === 'th' ? 'EN' : 'ไทย');
  btn.addEventListener('click', () => { setLang(getLang() === 'th' ? 'en' : 'th'); rerender(); });
  return btn;
}

/* ------------------------------ shell ------------------------------- */
let contentEl, titleEl, sidebarEl;

function renderShell() {
  root.className = '';
  const nav = navFor();
  const sections = [];
  nav.forEach((n) => { let s = sections.find((x) => x.key === n.section); if (!s) { s = { key: n.section, items: [] }; sections.push(s); } s.items.push(n); });

  const navEl = h('nav', { class: 'sidebar__nav' }, sections.map((s) =>
    h('div', {}, h('div', { class: 'sidebar__section' }, t(s.key)),
      s.items.map((n) => n.ext
        ? h('a', { class: 'navlink', href: n.ext, target: '_blank', title: t(n.key) }, icon(n.icon), t(n.key), h('span', { class: 'topbar__spacer' }), icon('upload', 'navlink__icon'))
        : h('a', { class: 'navlink', 'data-path': n.path, href: '#/' + n.path }, icon(n.icon), t(n.key))))
  ));

  sidebarEl = h('aside', { class: 'sidebar' },
    h('div', { class: 'sidebar__head' }, wordmark()),
    navEl,
    h('div', { class: 'sidebar__foot' },
      h('div', { class: 'spread' },
        h('div', { class: 'userchip grow' },
          h('div', { class: 'avatar' }, initials(state.user.name, state.user.username)),
          h('div', { class: 'userchip__meta' },
            h('div', { class: 'userchip__name' }, state.user.name || state.user.username),
            h('div', { class: 'userchip__role' }, isAdmin() ? t('role.administrator') : t('role.member')))),
        h('button', { class: 'btn btn-icon btn-ghost', title: 'Sign out', onClick: logout }, icon('logout', 'navlink__icon'))))
  );

  titleEl = h('h1', {}, '');
  contentEl = h('div', { class: 'content' });
  const topbar = h('div', { class: 'topbar' },
    h('button', { class: 'btn btn-icon btn-ghost menu-toggle', onClick: () => sidebarEl.classList.toggle('open') }, icon('menu', 'navlink__icon')),
    titleEl, h('div', { class: 'topbar__spacer' }));

  mount(root, h('div', { class: 'layout' }, sidebarEl, h('div', { class: 'main' }, topbar, contentEl)));
  window.removeEventListener('hashchange', route);
  window.addEventListener('hashchange', route);
  route();
}

/* ------------------------------ router ------------------------------ */
function route() {
  if (!contentEl) return;
  const parts = (location.hash.replace(/^#\/?/, '') || '').split('/').filter(Boolean);
  const key = parts[0] || 'dashboard';
  const params = parts.slice(1);
  sidebarEl.querySelectorAll('.navlink').forEach((a) => a.classList.toggle('active', a.dataset.path === key));
  sidebarEl.classList.remove('open');

  const navItem = navFor().find((n) => n.path === key);
  let page, title;
  if (navItem) { page = navItem.page; title = t(navItem.key); }
  else { location.hash = '#/dashboard'; return; }

  titleEl.textContent = title;
  clear(contentEl);
  contentEl.appendChild(spinner(t('common.loading')));
  Promise.resolve(page.render(contentEl, params, { setTitle: (x) => (titleEl.textContent = x) }))
    .catch((err) => mount(contentEl, h('div', { class: 'banner' }, 'Something went wrong: ' + err.message)));
}

/* --------------------------- shared actions ------------------------- */
async function logout() {
  try { await api.post('/logout'); } catch {}
  state.user = null; location.hash = ''; window.removeEventListener('hashchange', route); renderLogin();
}
function relayout() { if (state.user && contentEl) renderShell(); }

window.__kt = { reroute: route, relayout, boot, setTheme, openChangePassword };
boot();
