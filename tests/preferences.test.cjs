const { test } = require('node:test');
const assert = require('node:assert/strict');
const { applyQueueDefaults, normalizeTheme } = require('../app/preferences.cjs');

test('üstten yalnızca ses seçimi mevcut bekleyen kartların tamamını değiştirir', () => {
  const old = { mode: 'both', format: 'mp4', quality: '1080' };
  const state = { defaults: { ...old }, jobs: ['inspecting', 'ready', 'queued', 'error', 'cancelled'].map(status => ({ status, options: { ...old } })) };
  const selected = { mode: 'audio', format: 'mp3', quality: 'best' };
  assert.equal(applyQueueDefaults(state, selected), 5);
  assert.deepEqual(state.defaults, selected);
  for (const job of state.jobs) assert.deepEqual(job.options, selected);
  // Kart ayarı bağımsız kalır; üst seçim tekrar yapılınca topluca uygulanır.
  state.jobs[0].options.format = 'wav';
  assert.equal(state.defaults.format, 'mp3');
  assert.equal(state.jobs[1].options.format, 'mp3');
  assert.equal(applyQueueDefaults(state, selected), 1);
  assert.deepEqual(state.jobs[0].options, selected);
});
test('başlamış indirmeler ve geçmiş kayıtları toplu seçimden etkilenmez', () => {
  const originals = ['downloading', 'processing', 'cancelling', 'completed'].map(status => ({ status, options: { mode: 'both', format: 'mkv', quality: '720' }, file: 'saved.mkv' }));
  const before = structuredClone(originals);
  const state = { defaults: {}, jobs: originals };
  assert.equal(applyQueueDefaults(state, { mode: 'audio', format: 'mp3', quality: '320' }), 0);
  assert.deepEqual(state.jobs, before);
  assert.deepEqual(state.defaults, { mode: 'audio', format: 'mp3', quality: '320' });
});
test('üst format/kalite ayarları ve kalıcı tercihler tutarlı kalır', () => {
  const state = { defaults: {}, jobs: [{ status: 'ready', options: { mode: 'both', format: 'mp4', quality: 'best' } }] };
  applyQueueDefaults(state, { mode: 'audio', format: 'm4a', quality: '192' });
  const restored = JSON.parse(JSON.stringify(state));
  assert.deepEqual(restored.jobs[0].options, { mode: 'audio', format: 'm4a', quality: '192' });
  applyQueueDefaults(state, { mode: 'video', format: 'mp3', quality: '192' });
  assert.deepEqual(state.jobs[0].options, { mode: 'video', format: 'mp4', quality: 'best' });
  assert.equal(normalizeTheme(undefined), 'dark');
  assert.equal(normalizeTheme('dark'), 'dark');
  assert.equal(normalizeTheme('light'), 'light');
  assert.equal(normalizeTheme('invalid'), 'dark');
});
