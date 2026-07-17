// Tiny DOM toolkit: hyperscript, toasts, modals, and shared formatting helpers.
// No framework, no build step — runs natively as an ES module in the browser.

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = {};
  }
  attrs = attrs || {};
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }
export function mount(el, ...nodes) { clear(el); nodes.flat().forEach((n) => n && el.appendChild(n)); return el; }

export const esc = (s) => String(s == null ? '' : s);

/* ------------------------------ icons ------------------------------ */
// Minimal line icons (Lucide-style paths), rendered inline so there are no asset requests.
const ICONS = {
  dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  team: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  target: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-4a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm0-4a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  clipboard: 'M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2',
  award: 'M12 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM8.21 13.89 7 23l5-3 5 3-1.21-9.12',
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
  home: 'M3 9.5 12 3l9 6.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9.5z M9 22V12h6v10',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  menu: 'M3 12h18M3 6h18M3 18h18',
  plus: 'M12 5v14M5 12h14',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
  moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  wallet: 'M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h3v-4z',
  scan: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  briefcase: 'M20 7h-16a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M2 12h20',
  check: 'M20 6 9 17l-5-5',
  x: 'M18 6 6 18M6 6l12 12',
  plane: 'M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  sitemap: 'M9 3h6v5H9zM3 16h6v5H3zM15 16h6v5h-6zM12 8v4M6 16v-2h12v2',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35',
  chevron: 'M9 18l6-6-6-6',
  board: 'M4 4h4v16H4zM10 4h4v11h-4zM16 4h4v7h-4z',
  funnel: 'M3 4h18l-7 8v6l-4 2v-8z',
  star: 'M12 2.5l2.9 6 6.6.6-5 4.3 1.5 6.5L12 16.9 6 19.9l1.5-6.5-5-4.3 6.6-.6z',
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
};
export function icon(name, cls = 'navlink__icon') {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('class', cls);
  (ICONS[name] || '').split(/(?=M)/).forEach((d) => {
    if (!d.trim()) return;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d.trim());
    svg.appendChild(p);
  });
  return svg;
}

/* ------------------------------ toast ------------------------------ */
function toastHost() {
  let host = document.querySelector('.toast-host');
  if (!host) { host = h('div', { class: 'toast-host' }); document.body.appendChild(host); }
  return host;
}
export function toast(msg, type = '') {
  const t = h('div', { class: 'toast ' + type }, msg);
  toastHost().appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; setTimeout(() => t.remove(), 250); }, type === 'error' ? 4200 : 2600);
}

/* ------------------------------ modal ------------------------------ */
export function openModal({ title, body, footer, size }) {
  const host = h('div', { class: 'modal-host' });
  const close = () => host.remove();
  const back = h('div', { class: 'modal-back', onClick: close });
  const modal = h('div', { class: 'modal' + (size === 'lg' ? ' lg' : '') },
    title && h('div', { class: 'modal__head' }, h('h3', {}, title)),
    h('div', { class: 'modal__body' }, body),
    footer && h('div', { class: 'modal__foot' }, footer)
  );
  host.append(back, modal);
  document.body.appendChild(host);
  const onKey = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onKey); } };
  document.addEventListener('keydown', onKey);
  return { close, host };
}

export function confirmDialog(message, { confirmText = 'Confirm', danger = false, title = 'Please confirm' } = {}) {
  return new Promise((resolve) => {
    const m = openModal({
      title,
      body: h('div', {}, message),
      footer: h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onClick: () => { m.close(); resolve(false); } }, 'Cancel'),
        h('button', { class: 'btn ' + (danger ? 'btn-danger' : 'btn-primary'), onClick: () => { m.close(); resolve(true); } }, confirmText)
      ),
    });
  });
}

/* --------------------------- form helpers -------------------------- */
export function field(label, control, hint) {
  return h('div', { class: 'field' },
    label && h('label', {}, label),
    control,
    hint && h('div', { class: 'hint' }, hint)
  );
}
export function input(attrs = {}) { return h('input', { class: 'input', ...attrs }); }
// NOTE: a <textarea>'s initial text is its DOM *value* (property), not a `value` attribute —
// setting the attribute is silently ignored by browsers, so pull it out and assign the property.
export function textarea(attrs = {}) {
  const { value, ...rest } = attrs;
  const el = h('textarea', { class: 'textarea', ...rest });
  if (value != null) el.value = value;
  return el;
}
export function select(options, attrs = {}) {
  const sel = h('select', { class: 'select', ...attrs });
  options.forEach((o) => {
    const opt = h('option', { value: o.value }, o.label);
    if (o.value === attrs.value) opt.selected = true;
    sel.appendChild(opt);
  });
  return sel;
}

/* ----------------------------- format ------------------------------ */
export function gradeChip(grade, big = false) {
  const g = grade || null;
  return h('span', { class: 'grade ' + (big ? 'grade-lg ' : '') + (g ? 'grade-' + g : 'grade-none') }, g || '–');
}
export function pct(n) { return n == null ? '–' : (Math.round(n * 100) / 100) + '%'; }
export function money(n, currency = 'THB') {
  if (n == null || n === '') return '–';
  const v = Number(n) || 0;
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) + (currency ? ' ' + currency : '');
}
export function hours(n) { return n == null || n === '' ? '–' : (Math.round(Number(n) * 100) / 100) + ' h'; }
export function initials(name, title) {
  const s = (name || title || '?').trim();
  const parts = s.split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase() || s[0]?.toUpperCase() || '?';
}
export function emptyState(titleText, sub, action) {
  return h('div', { class: 'empty' }, h('h3', {}, titleText), sub && h('p', { class: 'muted' }, sub), action);
}
export function meter(value, target = 100) {
  const pctv = Math.min(100, (value / target) * 100);
  const cls = value === target ? ' full' : value > target ? ' over' : '';
  return h('div', { class: 'meter' + cls }, h('span', { style: { width: pctv + '%' } }));
}
export function spinner(label) { return h('div', { class: 'spinner-row' }, h('span', { class: 'spinner' }), label || ''); }
