// Shared app state + small data helpers used across pages.
import { api } from './api.js';

export const state = {
  user: null,
  branding: { appName: 'King Recruit', logoDataUrl: null },
  settings: null,
  stages: [],
  levels: [],
  sources: [],
};

export const isAdmin = () => !!(state.user && (state.user.role === 'admin' || state.user.admin === true));
export const currency = () => (state.settings && state.settings.currency) || 'THB';

// Load the reference lists every page leans on (pipeline stages, levels, sources).
export async function loadRefs() {
  try {
    const [stages, levels, sources] = await Promise.all([api.get('/stages'), api.get('/levels'), api.get('/sources')]);
    state.stages = stages; state.levels = levels; state.sources = sources;
  } catch { /* leave whatever we had */ }
  return state;
}

export function stageName(id) { const s = state.stages.find((x) => x.id === id); return s ? s.name : id || '—'; }
export function sourceName(id) { const s = state.sources.find((x) => x.id === id); return s ? s.name : id || '—'; }
export const activeStages = () => state.stages.filter((s) => s.type === 'active');

// CSS modifier for a job level, shared by the org chart and the board cards.
export function lvlClass(level) {
  if (level === 'Management' || level === 'Manager') return 'lvl-mgr';
  if (level === 'Supervisor') return 'lvl-sup';
  if (level === 'Leader') return 'lvl-lead';
  return 'lvl-op';
}
