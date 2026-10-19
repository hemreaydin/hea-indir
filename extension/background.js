importScripts('media.js');
const BASE = 'http://127.0.0.1:38473';
let connection = { connected: false, enabled: false, paired: false, userEnabled: false, error: '' }, checkedAt = 0, checking, starting;
const serial = new Map(), requests = new Map();
chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
const tabKey = id => 'tab:' + id;
function changeTab(id, fn) {
  const next = (serial.get(id) || Promise.resolve()).catch(() => {}).then(async () => {
    const key = tabKey(id), saved = (await chrome.storage.session.get(key))[key] || { items: [], frames: {}, drm: false };
    const result = await fn(saved);
    await chrome.storage.session.set({ [key]: result });
    return result;
  });
  serial.set(id, next); next.finally(() => { if (serial.get(id) === next) serial.delete(id); }).catch(() => {});
  return next;
}
async function request(path, body, token) {
  const headers = { 'X-Hea-Client': chrome.runtime.id };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body) headers['Content-Type'] = 'application/json';
  let response;
  try { response = await fetch(BASE + path, { method: body ? 'POST' : 'GET', headers, body: body ? JSON.stringify(body) : undefined, credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(3500) }); }
  catch { throw new Error('Arka plan bağlantısı kurulamadı. Windows paketindeki Chrome bağlantısını kurup yeniden dene.'); }
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.error || 'Bağlantı kurulamadı.'); error.status = response.status; throw error; }
  return result;
}
async function sync(force = false) {
  if (!force && Date.now() - checkedAt < 1800) return connection;
  if (checking) return checking;
  checking = (async () => {
    const { token, enabled = false } = await chrome.storage.local.get(['token', 'enabled']);
    try {
      if (!token) throw new Error('İlk kullanım için Windows paketindeki Chrome bağlantısını kur, ardından anahtarı aç.');
      const status = await request('/status', null, token);
      connection = { connected: true, paired: true, userEnabled: enabled, enabled: enabled && status.enabled, selection: status.selection, jobs: status.jobs || [], protocol: status.protocol, error: '' };
    } catch (error) { connection = { connected: false, enabled, userEnabled: enabled, paired: Boolean(token) && error.status !== 401, error: error.message, jobs: [] }; }
    checkedAt = Date.now(); checking = null; return connection;
  })();
  return checking;
}
async function ensureStarted() {
  if (starting) return starting;
  starting = (async () => {
    let result;
    try { result = await chrome.runtime.sendNativeMessage('com.hea.indir', { action: 'start' }); }
    catch { throw new Error('Bir kez kurulum gerekli: Windows paketinde resources → native → Chrome-Baglantisini-Kur.cmd dosyasını çalıştır. Sonra yeniden aç.'); }
    if (!result?.ok || !/^[a-f0-9]{64}$/.test(result.token || '')) throw new Error(result?.error || 'Arka plan bileşeni başlatılamadı.');
    await chrome.storage.local.set({ token: result.token });
    for (let i = 0; i < 40; i++) {
      try {
        const status = await request('/status', null, result.token);
        if (status.protocol !== 2) throw new Error('Eski hea-indir sürümünü tamamen kapatıp 0.4.0 Windows paketini kur.');
        return result.token;
      } catch (error) { if (error.message.includes('Eski hea-indir') || i === 39) throw error; }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  })();
  try { return await starting; } finally { starting = null; }
}
let switching = Promise.resolve();
async function setEnabled(enabled) {
  if (typeof enabled !== 'boolean') throw new Error('Geçersiz anahtar değeri.');
  if (enabled) {
    // Polls never launch a process; only explicit popup/download actions can.
    const token = await ensureStarted();
    await request('/enabled', { enabled: true }, token);
    await chrome.storage.local.set({ enabled: true });
  } else {
    await chrome.storage.local.set({ enabled: false });
    connection.enabled = false; requests.clear();
    const { token } = await chrome.storage.local.get('token');
    if (token) { try { await request('/enabled', { enabled: false }, token); } catch { /* Local OFF also works with the app stopped. */ } }
  }
  if (checking) await checking;
  return sync(true);
}
async function downloadRequest(body) {
  if (!(await chrome.storage.local.get('enabled')).enabled) throw new Error('Eklenti kapalı. Önce anahtarı aç.');
  let status = await sync(true);
  if (!status.connected) { await ensureStarted(); status = await sync(true); }
  if (!(await chrome.storage.local.get('enabled')).enabled || !status.enabled) throw new Error('İndirme kapalı. Eklentideki anahtarı aç.');
  const { token } = await chrome.storage.local.get('token');
  return request('/download', body, token);
}
async function observe(tabId, item) {
  if (tabId < 0 || !(await sync()).enabled) return;
  await changeTab(tabId, state => { state.items = HeaMedia.merge(state.items, item); return state; });
}
chrome.webRequest.onBeforeRequest.addListener(details => {
  if (details.tabId < 0) return;
  if (details.type === 'main_frame') changeTab(details.tabId, () => ({ items: [], frames: { 0: details.url }, pageUrl: details.url, drm: false })).catch(() => {});
  else if (details.type === 'sub_frame') changeTab(details.tabId, s => { s.frames[details.frameId] = details.url; return s; }).catch(() => {});
}, { urls: ['http://*/*', 'https://*/*'], types: ['main_frame', 'sub_frame'] });
chrome.webRequest.onBeforeSendHeaders.addListener(d => {
  if (d.tabId < 0 || !connection.enabled) return;
  const pick = key => d.requestHeaders?.find(h => h.name.toLowerCase() === key)?.value || '';
  requests.set(d.requestId, { referrer: pick('referer'), userAgent: pick('user-agent') });
  if (requests.size > 300) requests.delete(requests.keys().next().value);
}, { urls: ['http://*/*', 'https://*/*'], types: ['media', 'xmlhttprequest', 'other'] }, ['requestHeaders', 'extraHeaders']);
chrome.webRequest.onHeadersReceived.addListener(d => {
  const headers = requests.get(d.requestId) || {}; requests.delete(d.requestId);
  const mime = d.responseHeaders?.find(h => h.name.toLowerCase() === 'content-type')?.value || '';
  const kind = HeaMedia.kind(d.url, mime);
  if (d.tabId < 0 || !kind || d.statusCode >= 400) return;
  (async () => {
    const stored = (await chrome.storage.session.get(tabKey(d.tabId)))[tabKey(d.tabId)];
    await observe(d.tabId, { url: d.url, kind, referrer: HeaMedia.url(headers.referrer || stored?.frames[d.frameId] || d.initiator), userAgent: headers.userAgent, frameId: d.frameId, title: kind + ' kaynağı' });
  })().catch(() => {});
}, { urls: ['http://*/*', 'https://*/*'], types: ['media', 'xmlhttprequest', 'other'] }, ['responseHeaders']);
chrome.tabs.onRemoved.addListener(id => { changeTab(id, () => ({ items: [], frames: {}, drm: false })).then(() => chrome.storage.session.remove(tabKey(id))).catch(() => {}); });
chrome.alarms.create('connection', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(() => sync(true));
sync();

async function handle(message, sender) {
  if (sender.id !== chrome.runtime.id) throw new Error('İstek reddedildi.');
  const fromPopup = sender.url === chrome.runtime.getURL('popup.html');
  if (message.type === 'toggle') {
    if (!fromPopup) throw new Error('İstek reddedildi.');
    const next = switching.catch(() => {}).then(() => setEnabled(message.enabled));
    switching = next; return next;
  }
  if (message.type === 'pair') {
    if (!fromPopup || !/^\d{6}$/.test(message.code)) throw new Error('Altı haneli eşleştirme kodunu gir.');
    const result = await request('/pair', { code: message.code });
    await chrome.storage.local.set({ token: result.token }); await sync(true); return connection;
  }
  const id = fromPopup ? message.tabId : sender.tab?.id;
  if (message.type === 'status' && fromPopup && (!Number.isInteger(id) || id < 0)) return { ...await sync(), items: [] };
  if (!Number.isInteger(id) || id < 0) throw new Error('Bir video sekmesi aç.');
  if (message.type === 'observe') {
    if (!sender.tab) throw new Error('İstek reddedildi.');
    if (!(await sync()).enabled) return {};
    if (message.drm) await changeTab(id, s => { s.drm = true; return s; });
    for (const item of (Array.isArray(message.items) ? message.items : []).slice(0, 12)) {
      const kind = HeaMedia.kind(item.url, '', true);
      if (kind) await observe(id, { url: item.url, kind, referrer: HeaMedia.url(sender.url), userAgent: String(message.userAgent || '').slice(0, 512), duration: Number(item.duration) || 0, title: 'Oynatılan video', frameId: sender.frameId });
    }
    return {};
  }
  const status = await sync();
  const tab = await chrome.tabs.get(id);
  const pageUrl = HeaMedia.url(tab.url);
  let state = (await chrome.storage.session.get(tabKey(id)))[tabKey(id)] || { items: [] };
  if (state.pageUrl && state.pageUrl !== tab.url) state = await changeTab(id, () => ({ items: [], frames: { 0: tab.url }, pageUrl: tab.url, drm: false }));
  let items = state.drm ? [] : state.items;
  if (!state.drm && HeaMedia.knownPage(pageUrl)) items = [{ id: 'page', url: pageUrl, kind: 'Sayfa', title: tab.title || 'Video sayfası' }];
  if (message.type === 'status') return { ...status, drm: Boolean(state.drm), items: status.enabled ? items : [], pageUrl, title: tab.title || 'Video' };
  if (message.type === 'download') {
    if (!status.enabled) throw new Error('İndirme kapalı. Eklentideki anahtarı aç.');
    if (state.drm) throw new Error('Bu oynatıcı DRM korumalı; desteklenmiyor.');
    // The content script can select only a previously detected source, never an arbitrary request.
    const item = items.find(x => x.id === message.id);
    if (!item || !pageUrl) throw new Error('Kaynak artık bulunamıyor. Videoyu yeniden oynat.');
    return downloadRequest({ url: item.url, pageUrl, referrer: item.referrer || pageUrl, userAgent: item.userAgent || '', title: tab.title || item.title });
  }
  if (message.type === 'page' && fromPopup) {
    if (!status.enabled || !pageUrl || state.drm) throw new Error('Bu sayfa şu anda gönderilemiyor.');
    return downloadRequest({ url: pageUrl, pageUrl, title: tab.title });
  }
  throw new Error('İşlem bulunamadı.');
}
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  handle(message || {}, sender).then(value => reply({ ok: true, value }), error => reply({ ok: false, error: error.message }));
  return true;
});
