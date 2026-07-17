// The pipeline board — a Kanban of the hiring stages. Drag a candidate card to another
// column, or use the ◀ ▶ arrows. Filter to one requisition to focus a single hire.
import { api } from '../api.js';
import { state, stageName, sourceName, lvlClass } from '../state.js';
import { h, mount, clear, select, toast, icon } from '../ui.js';
import { t } from '../i18n.js';

let cands = [];
let reqs = [];
let reqFilter = '';

export async function render(root) {
  [cands, reqs] = await Promise.all([api.get('/candidates'), api.get('/requisitions')]);

  const reqSel = select([{ value: '', label: t('pipe.allReqs') }, ...reqs.map((r) => ({ value: r.id, label: r.code + ' · ' + r.title }))], { value: reqFilter, style: 'width:auto' });
  reqSel.addEventListener('change', () => { reqFilter = reqSel.value; paint(); });

  const boardHost = h('div', {});
  function paint() {
    const list = reqFilter ? cands.filter((c) => c.requisitionId === reqFilter) : cands;
    mount(boardHost, board(list));
  }

  mount(root,
    h('p', { class: 'page-intro' }, t('pipe.intro')),
    h('div', { class: 'card', style: { marginBottom: '16px' } },
      h('div', { class: 'card__pad', style: { display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' } },
        icon('funnel', 'navlink__icon'), h('strong', {}, t('nav.pipeline')), h('div', { class: 'topbar__spacer' }), reqSel)),
    boardHost
  );
  paint();

  async function moveTo(candId, stageId) {
    const c = cands.find((x) => x.id === candId);
    if (!c || c.currentStageId === stageId) return;
    const prev = c.currentStageId;
    const boardEl = boardHost.querySelector('.board');
    const sl = boardEl ? boardEl.scrollLeft : 0, y = window.scrollY; // keep the view put
    const repaint = () => { paint(); const nb = boardHost.querySelector('.board'); if (nb) nb.scrollLeft = sl; window.scrollTo(0, y); };
    c.currentStageId = stageId; repaint(); // optimistic
    try { await api.post('/candidates/' + candId + '/stage', { stageId }); toast(t('pipe.moved', { stage: stageName(stageId) }), 'success'); }
    catch (e) { c.currentStageId = prev; repaint(); toast(e.message, 'error'); }
  }

  function board(list) {
    const stages = state.stages;
    const cols = stages.map((s) => col(s, list.filter((c) => c.currentStageId === s.id)));
    return h('div', { class: 'board' }, cols);
  }

  function col(stage, items) {
    const body = h('div', { class: 'board__body', dataset: { stage: stage.id } });
    body.addEventListener('dragover', (e) => { e.preventDefault(); body.classList.add('dragover'); });
    body.addEventListener('dragleave', () => body.classList.remove('dragover'));
    body.addEventListener('drop', (e) => { e.preventDefault(); body.classList.remove('dragover'); const id = e.dataTransfer.getData('text/plain'); if (id) moveTo(id, stage.id); });
    if (items.length) items.forEach((c) => body.appendChild(card(c, stage)));
    else body.appendChild(h('div', { class: 'board__empty' }, t('pipe.empty')));
    const headCls = stage.type === 'won' ? 'won' : stage.type === 'lost' ? 'lost' : '';
    return h('div', { class: 'board__col' },
      h('div', { class: 'board__head ' + headCls }, h('h4', {}, stage.name), h('span', { class: 'board__count' }, String(items.length))),
      body);
  }

  function card(c, stage) {
    const idx = state.stages.findIndex((s) => s.id === stage.id);
    const prevStage = state.stages[idx - 1];
    const nextStage = state.stages[idx + 1];
    const left = h('button', { title: prevStage ? prevStage.name : '', disabled: !prevStage, onClick: () => prevStage && moveTo(c.id, prevStage.id) }, '◀');
    const right = h('button', { title: nextStage ? nextStage.name : '', disabled: !nextStage, onClick: () => nextStage && moveTo(c.id, nextStage.id) }, '▶');
    const el = h('div', { class: 'pcard ' + lvlClass(c.level), draggable: 'true' },
      h('div', { class: 'pcard__name' }, c.name),
      h('div', { class: 'pcard__sub' }, [c.requisitionTitle, c.level].filter(Boolean).join(' · ') || sourceName(c.source) || '—'),
      h('div', { class: 'pcard__foot' },
        c.rating ? h('span', { class: 'pcard__stars', title: c.rating + '/5' }, '★'.repeat(c.rating)) : h('span', { class: 'muted small' }, sourceName(c.source) || ''),
        h('div', { class: 'pcard__move' }, left, right)));
    el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    return el;
  }
}
