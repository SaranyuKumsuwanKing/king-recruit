// Admin: the recruitment configuration — pipeline stages, job levels, candidate sources,
// and the interview scorecard. Each card edits one list and saves it on its own.
import { api } from '../api.js';
import { state, loadRefs } from '../state.js';
import { h, mount, clear, field, input, select, toast } from '../ui.js';
import { t } from '../i18n.js';

export async function render(root) {
  const [stages, levels, sources, scorecard] = await Promise.all([
    api.get('/stages'), api.get('/levels'), api.get('/sources'), api.get('/scorecard'),
  ]);

  mount(root,
    h('p', { class: 'page-intro' }, t('setup.intro')),
    stagesCard(stages),
    levelsCard(levels),
    sourcesCard(sources),
    scorecardCard(scorecard),
  );
}

/* ----------------------------- stages ------------------------------ */
function stagesCard(stages) {
  const host = h('div', { class: 'card__pad' });
  let rows = stages.map((s) => ({ ...s }));
  const TYPES = [{ value: 'active', label: t('setup.type.active') }, { value: 'won', label: t('setup.type.won') }, { value: 'lost', label: t('setup.type.lost') }];

  function paint() {
    clear(host);
    rows.forEach((r, i) => {
      const name = input({ value: r.name });
      name.addEventListener('input', () => (r.name = name.value));
      const typeSel = select(TYPES, { value: r.type, style: 'width:auto' });
      typeSel.addEventListener('change', () => (r.type = typeSel.value));
      const up = h('button', { class: 'btn btn-sm btn-ghost', disabled: i === 0, onClick: () => { [rows[i - 1], rows[i]] = [rows[i], rows[i - 1]]; paint(); } }, '↑');
      const down = h('button', { class: 'btn btn-sm btn-ghost', disabled: i === rows.length - 1, onClick: () => { [rows[i + 1], rows[i]] = [rows[i], rows[i + 1]]; paint(); } }, '↓');
      const del = h('button', { class: 'btn btn-sm btn-danger', onClick: () => { rows.splice(i, 1); paint(); } }, '✕');
      host.append(h('div', { class: 'spread', style: { gap: '8px', marginBottom: '8px' } },
        h('div', { class: 'grow' }, name), typeSel, up, down, del));
    });
  }
  paint();
  const addBtn = h('button', { class: 'btn btn-sm', onClick: () => { rows.push({ id: '', name: 'New stage', type: 'active' }); paint(); } }, t('setup.addStage'));
  const saveBtn = h('button', { class: 'btn btn-primary' }, t('setup.saveStages'));
  saveBtn.addEventListener('click', async () => {
    try { await api.put('/stages', { stages: rows }); await loadRefs(); toast(t('common.saved'), 'success'); }
    catch (e) { toast(e.message, 'error'); }
  });
  return h('div', { class: 'card', style: { marginBottom: '18px' } },
    h('div', { class: 'card__head' }, h('h3', {}, t('setup.stages')), h('div', { class: 'topbar__spacer' }), addBtn, saveBtn),
    h('div', { class: 'card__pad', style: { borderBottom: '1px solid var(--line)' } }, h('p', { class: 'small muted', style: { margin: 0 } }, t('setup.stagesIntro'))),
    host);
}

/* ----------------------------- levels ------------------------------ */
function levelsCard(levels) {
  const ta = h('textarea', { class: 'textarea', style: { minHeight: '140px', fontFamily: 'var(--mono, monospace)' } });
  ta.value = levels.join('\n');
  const saveBtn = h('button', { class: 'btn btn-primary' }, t('setup.saveLevels'));
  saveBtn.addEventListener('click', async () => {
    const list = ta.value.split('\n').map((x) => x.trim()).filter(Boolean);
    try { await api.put('/levels', { levels: list }); await loadRefs(); toast(t('common.saved'), 'success'); }
    catch (e) { toast(e.message, 'error'); }
  });
  return h('div', { class: 'card', style: { marginBottom: '18px' } },
    h('div', { class: 'card__head' }, h('h3', {}, t('setup.levels')), h('div', { class: 'topbar__spacer' }), saveBtn),
    h('div', { class: 'card__pad' },
      h('p', { class: 'small muted', style: { marginTop: 0 } }, t('setup.levelsIntro')),
      field(null, ta, t('setup.levelsPlaceholder'))));
}

/* ----------------------------- sources ----------------------------- */
function sourcesCard(sources) {
  const host = h('div', { class: 'card__pad' });
  let rows = sources.map((s) => ({ ...s }));
  function paint() {
    clear(host);
    rows.forEach((r, i) => {
      const name = input({ value: r.name });
      name.addEventListener('input', () => (r.name = name.value));
      const del = h('button', { class: 'btn btn-sm btn-danger', onClick: () => { rows.splice(i, 1); paint(); } }, '✕');
      host.append(h('div', { class: 'spread', style: { gap: '8px', marginBottom: '8px' } }, h('div', { class: 'grow' }, name), del));
    });
  }
  paint();
  const addBtn = h('button', { class: 'btn btn-sm', onClick: () => { rows.push({ id: '', name: 'New source' }); paint(); } }, t('setup.addSource'));
  const saveBtn = h('button', { class: 'btn btn-primary' }, t('setup.saveSources'));
  saveBtn.addEventListener('click', async () => {
    try { await api.put('/sources', { sources: rows }); await loadRefs(); toast(t('common.saved'), 'success'); }
    catch (e) { toast(e.message, 'error'); }
  });
  return h('div', { class: 'card', style: { marginBottom: '18px' } },
    h('div', { class: 'card__head' }, h('h3', {}, t('setup.sources')), h('div', { class: 'topbar__spacer' }), addBtn, saveBtn),
    h('div', { class: 'card__pad', style: { borderBottom: '1px solid var(--line)' } }, h('p', { class: 'small muted', style: { margin: 0 } }, t('setup.sourcesIntro'))),
    host);
}

/* ---------------------------- scorecard ---------------------------- */
function scorecardCard(scorecard) {
  const host = h('div', { class: 'card__pad' });
  let rows = scorecard.map((c) => ({ ...c }));
  const GROUPS = [{ value: 'general', label: t('intv.general') }, { value: 'management', label: t('intv.management') }];
  function paint() {
    clear(host);
    rows.forEach((r, i) => {
      const name = input({ value: r.name });
      name.addEventListener('input', () => (r.name = name.value));
      const grp = select(GROUPS, { value: r.group, style: 'width:auto' });
      grp.addEventListener('change', () => (r.group = grp.value));
      const del = h('button', { class: 'btn btn-sm btn-danger', onClick: () => { rows.splice(i, 1); paint(); } }, '✕');
      host.append(h('div', { class: 'spread', style: { gap: '8px', marginBottom: '8px' } }, h('div', { class: 'grow' }, name), grp, del));
    });
  }
  paint();
  const addBtn = h('button', { class: 'btn btn-sm', onClick: () => { rows.push({ id: '', name: 'New criterion', group: 'general' }); paint(); } }, t('setup.addCriterion'));
  const saveBtn = h('button', { class: 'btn btn-primary' }, t('setup.saveScorecard'));
  saveBtn.addEventListener('click', async () => {
    try { await api.put('/scorecard', { scorecard: rows }); toast(t('common.saved'), 'success'); }
    catch (e) { toast(e.message, 'error'); }
  });
  return h('div', { class: 'card' },
    h('div', { class: 'card__head' }, h('h3', {}, t('setup.scorecard')), h('div', { class: 'topbar__spacer' }), addBtn, saveBtn),
    h('div', { class: 'card__pad', style: { borderBottom: '1px solid var(--line)' } }, h('p', { class: 'small muted', style: { margin: 0 } }, t('setup.scorecardIntro'))),
    host);
}
