const { options } = require('./engine.cjs');

// Upper controls apply to all jobs that have not started transferring yet.
// Active transfers retain the exact settings used by their running process.
const WAITING_STATUSES = new Set(['inspecting', 'ready', 'queued', 'error', 'cancelled']);
function applyQueueDefaults(state, selected) {
  const next = options(selected);
  state.defaults = { ...next };
  let changed = 0;
  for (const job of state.jobs) {
    if (!WAITING_STATUSES.has(job.status)) continue;
    if (['mode', 'format', 'quality'].some(key => job.options?.[key] !== next[key])) changed++;
    job.options = { ...next };
  }
  return changed;
}
function normalizeTheme(theme) {
  return theme === 'light' ? 'light' : 'dark';
}

module.exports = { applyQueueDefaults, normalizeTheme };
