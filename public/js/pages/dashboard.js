// Recruitment snapshot: open roles, the pipeline funnel, hires this month, interviews due,
// and breakdowns by level and source. Filter by department / level. Hiring managers see
// only their own requisitions.
import { api } from '../api.js';
import { isAdmin } from '../state.js';
import { h, mount, clear, select } from '../ui.js';
import { t } from '../i18n.js';

const filters = { department: '', level: '' };

export async function render(root) {
  const wrap = h('div', {});
  const body = h('div', {});

  async function load() {
    const qs = new URLSearchParams();
    if (filters.department) qs.set('department', filters.department);
    if (filters.level) qs.set('level', filters.level);
    const d = await api.get('/dashboard' + (qs.toString() ? '?' + qs : ''));
    paint(d);
  }

  function paint(d) {
    clear(body);
    // tiles
    const tiles = h('div', { class: 'grid cols-4', style: { marginBottom: '18px' } },
      stat(t('dash.openReqs'), d.openReqs, 't1', d.totalOpenings + ' ' + t('dash.openingsSub')),
      stat(t('dash.inPipeline'), d.inPipeline, 't2', t('dash.inPipelineSub')),
      stat(t('dash.interviews'), d.upcomingInterviews, 't3', t('intv.upcoming')),
      stat(t('dash.hires'), d.hiresThisMonth, 't4', ''),
    );

    const total = Math.max(1, ...d.funnel.map((f) => f.count));
    const funnelCard = h('div', { class: 'card', style: { marginBottom: '18px' } },
      h('div', { class: 'card__head' }, h('h3', {}, t('dash.funnel'))),
      h('div', { class: 'card__pad' },
        d.funnel.some((f) => f.count > 0)
          ? h('div', { class: 'funnel' }, d.funnel.map((f) => h('div', { class: 'funnel__row' },
              h('div', { class: 'funnel__label', title: f.name }, f.name),
              h('div', { class: 'funnel__bar' }, h('span', { style: { width: Math.round((f.count / total) * 100) + '%', background: f.type === 'won' ? 'var(--ok)' : f.type === 'lost' ? 'var(--danger)' : 'var(--chart-bar)' } })),
              h('div', { class: 'funnel__val' }, String(f.count)))))
          : h('p', { class: 'muted' }, t('dash.noFunnel'))));

    const breakdowns = h('div', { class: 'grid cols-2', style: { marginBottom: '18px' } },
      listCard(t('dash.byLevel'), d.byLevel),
      listCard(t('dash.bySource'), d.bySource));

    // open roles table
    const rolesCard = h('div', { class: 'card' },
      h('div', { class: 'card__head' }, h('h3', {}, t('dash.openRoles'))),
      d.requisitions.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, h('th', {}, t('req.code')), h('th', {}, t('req.title')), h('th', {}, t('req.level')), h('th', { class: 'td-center' }, t('req.filled')), h('th', {}, t('req.priority')))),
        h('tbody', {}, d.requisitions.map((r) => h('tr', { class: 'clickable', onClick: () => (location.hash = '#/candidates/' + r.id) },
          h('td', { class: 'mono' }, r.code), h('td', {}, h('span', { class: 'cellname' }, r.title), h('div', { class: 'cellsub' }, r.department || '')),
          h('td', {}, r.level ? h('span', { class: 'chip' }, r.level) : '—'),
          h('td', { class: 'td-center mono' }, `${r.filled}/${r.headcount}`),
          h('td', {}, h('span', { class: 'chip pri-' + r.priority }, t('req.pri.' + r.priority))))))))
        : h('div', { class: 'card__pad muted' }, t('req.none')));

    body.append(tiles, funnelCard, breakdowns, rolesCard);
  }

  // filter bar
  const d0 = await api.get('/dashboard');
  const deptSel = select([{ value: '', label: t('dash.allDepts') }, ...d0.departments.map((x) => ({ value: x, label: x }))], { value: filters.department, style: 'width:auto' });
  deptSel.addEventListener('change', () => { filters.department = deptSel.value; load(); });
  const lvlSel = select([{ value: '', label: t('dash.allLevels') }, ...d0.levels.map((x) => ({ value: x, label: x }))], { value: filters.level, style: 'width:auto' });
  lvlSel.addEventListener('change', () => { filters.level = lvlSel.value; load(); });

  mount(wrap,
    h('div', { class: 'spread', style: { marginBottom: '16px', gap: '10px', flexWrap: 'wrap' } },
      h('p', { class: 'page-intro', style: { margin: 0, flex: '1', minWidth: '200px' } }, t('dash.intro')),
      isAdmin() ? deptSel : null, isAdmin() ? lvlSel : null),
    body);
  mount(root, wrap);
  paint(d0);
}

function stat(label, value, tone, sub) {
  return h('div', { class: 'card stat tinted ' + tone },
    h('div', { class: 'stat__label' }, label),
    h('div', { class: 'stat__value' }, String(value)),
    sub ? h('div', { class: 'stat__sub' }, sub) : null);
}

function listCard(title, rows) {
  const total = rows.reduce((a, b) => a + b.count, 0);
  return h('div', { class: 'card' },
    h('div', { class: 'card__head' }, h('h3', {}, title)),
    h('div', { class: 'card__pad' },
      rows.length ? h('div', { class: 'funnel' }, rows.map((r) => h('div', { class: 'funnel__row' },
        h('div', { class: 'funnel__label', title: r.name }, r.name),
        h('div', { class: 'funnel__bar' }, h('span', { style: { width: Math.round((r.count / Math.max(1, total)) * 100) + '%' } })),
        h('div', { class: 'funnel__val' }, String(r.count)))))
        : h('p', { class: 'muted' }, '—')));
}
