const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, session, nativeTheme } = require('electron');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { randomUUID } = require('node:crypto');
const { Engine, validateUrl, options, userError, sanitizeDetail } = require('./engine.cjs');
const { applyQueueDefaults, normalizeTheme } = require('./preferences.cjs');
const { BrowserBridge } = require('./browser-bridge.cjs');
const extensionConfig = require('./extension-config.json');

const testDir = !app.isPackaged && process.env.HEA_TEST_PROFILE;
if (testDir) app.setPath('userData', path.resolve(testDir));
let win, state, engine, bridge, active = null, inspecting = false, quitting = false, updating = false;
const uiUrl = pathToFileURL(path.join(__dirname, 'index.html')).href;
const bin = path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..'), 'bin');
const updateBin = () => path.join(app.getPath('userData'), 'tools', 'yt-dlp.exe');
const statePath = () => path.join(app.getPath('userData'), 'state.json');
const busy = () => Boolean(active || inspecting || updating);
function persist() {
  const tmp = statePath() + '.tmp';
  try {
    fs.mkdirSync(path.dirname(tmp), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(state), 'utf8');
    fs.renameSync(tmp, statePath());
  } catch (error) { if (win && !win.isDestroyed()) win.webContents.send('hea:notice', 'Ayarlar kaydedilemedi: ' + error.message); }
}
function snapshot() { return { ...state, browser: bridge?.status() || { enabled: state.browser.enabled, ready: false }, active, updating, version: app.getVersion() }; }
function publish(save = true) {
  if (save) persist();
  if (win && !win.isDestroyed()) win.webContents.send('hea:state', snapshot());
  if (win && !win.isDestroyed()) {
    const job = state.jobs.find(j => j.id === active);
    win.setProgressBar(job ? (job.percent == null ? 2 : Math.min(0.99, job.percent / 100)) : -1);
  }
}
function readState() {
  const defaults = { outputDir: testDir ? path.join(testDir, 'downloads') : path.join(app.getPath('downloads'), 'hea-indir'), defaults: options(), theme: 'dark', browser: { enabled: true, token: '' }, jobs: [] };
  try {
    const saved = JSON.parse(fs.readFileSync(statePath(), 'utf8'));
    return { outputDir: typeof saved.outputDir === 'string' && path.isAbsolute(saved.outputDir) ? saved.outputDir : defaults.outputDir, defaults: options(saved.defaults), theme: normalizeTheme(saved.theme), browser: { enabled: saved.browser?.enabled !== false, token: /^[a-f0-9]{64}$/.test(saved.browser?.token || '') ? saved.browser.token : '' }, jobs: (Array.isArray(saved.jobs) ? saved.jobs : []).slice(-200).filter(j => {
      try { validateUrl(j.url); return typeof j.id === 'string' && typeof j.title === 'string'; } catch { return false; }
    }).map(j => ({ ...j, autoStart: false, options: options(j.options), status: ['downloading', 'processing', 'queued'].includes(j.status) ? 'ready' : j.status === 'inspecting' || j.status === 'cancelling' ? 'cancelled' : j.status, percent: j.status === 'completed' ? 100 : 0 })) };
  } catch { return defaults; }
}
function getJob(id) {
  const job = state.jobs.find(j => j.id === id);
  if (!job) throw new Error('İçerik bulunamadı.');
  return job;
}
async function inspectQueue() {
  if (inspecting || quitting || updating) return;
  const job = state.jobs.find(j => j.status === 'inspecting');
  if (!job) return;
  inspecting = true;
  try {
    Object.assign(job, await engine.inspect(job));
    job.status = job.autoStart ? 'queued' : 'ready'; job.autoStart = false; job.error = ''; job.detail = '';
  } catch (err) {
    job.status = engine.cancelled.has(job.id) ? 'cancelled' : 'error';
    job.error = userError(err.message); job.detail = sanitizeDetail(err.message);
  } finally { inspecting = false; engine.cancelled.delete(job.id); publish(); setImmediate(inspectQueue); setImmediate(pump); }
}
async function pump() {
  if (active || quitting || updating) return;
  const job = state.jobs.find(j => j.status === 'queued');
  if (!job) return;
  active = job.id; job.status = 'downloading'; job.percent = null; job.error = ''; job.detail = '';
  const destination = state.outputDir;
  publish();
  try {
    Object.assign(job, await engine.download(job, destination));
    job.status = 'completed'; job.percent = 100;
  } catch (err) {
    job.status = /cancelled/.test(err.message) || job.status === 'cancelling' ? 'cancelled' : 'error';
    job.error = userError(err.message); job.detail = sanitizeDetail(err.message);
  } finally { active = null; publish(); setImmediate(pump); }
}
function handle(name, handler) {
  ipcMain.handle('hea:' + name, async (event, ...args) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== uiUrl) return { ok: false, error: 'Yetkisiz istek.' };
    try { return { ok: true, value: await handler(...args) }; }
    catch (err) { return { ok: false, error: err.message }; }
  });
}
function bindIpc() {
  handle('state', () => snapshot());
  handle('browser-enabled', enabled => { state.browser.enabled = enabled === true; publish(); });
  handle('browser-pair', () => { bridge.reset(); return bridge.status().code; });
  handle('browser-code-copy', () => { const code = bridge.status().code; if (!code) throw new Error('Önce yeni kod oluştur.'); clipboard.writeText(code); });
  handle('browser-folder', async () => { const error = await shell.openPath(path.join(app.isPackaged ? process.resourcesPath : path.join(__dirname, '..'), 'extension')); if (error) throw new Error(error); });
  handle('clipboard', () => clipboard.readText().slice(0, 20000));
  handle('add', (text, selected) => {
    if (updating) throw new Error('Motor güncellemesinin bitmesini bekle.');
    if (typeof text !== 'string' || text.length > 50000) throw new Error('En fazla 20 bağlantı ekleyebilirsin.');
    const links = text.trim().split(/\s+/).filter(Boolean);
    if (!links.length || links.length > 20) throw new Error('Bir seferde 1–20 video bağlantısı ekle.');
    const checked = links.map(validateUrl);
    if (state.jobs.length + checked.length > 200) throw new Error('Kuyruk dolu. Önce eski kayıtları listeden kaldır.');
    let added = 0;
    for (const link of checked) {
      if (state.jobs.some(j => j.url === link.url && !['completed', 'cancelled', 'error'].includes(j.status))) continue;
      state.jobs.push({ id: randomUUID(), ...link, title: 'Video bilgileri alınıyor…', creator: link.platform, status: 'inspecting', options: options(selected), createdAt: new Date().toISOString(), percent: 0 }); added++;
    }
    publish(); inspectQueue(); return added;
  });
  handle('defaults', value => { const changed = applyQueueDefaults(state, value); publish(); return changed; });
  handle('theme', value => {
    state.theme = normalizeTheme(value);
    nativeTheme.themeSource = state.theme;
    win.setBackgroundColor(state.theme === 'dark' ? '#0e1625' : '#f6f7fb');
    publish();
  });
  handle('options', (id, selected) => {
    const job = getJob(id);
    if (!['ready', 'error', 'cancelled'].includes(job.status)) throw new Error('İşlem sürerken seçim değiştirilemez.');
    job.options = options(selected); publish();
  });
  handle('start', id => {
    const jobs = id ? [getJob(id)] : state.jobs;
    for (const job of jobs) {
      if (job.status === 'ready' || (['error', 'cancelled'].includes(job.status) && job.mediaId)) job.status = 'queued';
      else if (id && ['error', 'cancelled'].includes(job.status)) job.status = 'inspecting';
    }
    publish(); inspectQueue(); pump();
  });
  handle('cancel', async id => {
    const job = getJob(id);
    if (['inspecting', 'downloading', 'processing'].includes(job.status)) {
      if (engine.children.has(id) || id === active) { job.status = 'cancelling'; publish(); await engine.cancel(id); }
      else { job.status = 'cancelled'; publish(); }
    } else if (job.status === 'queued') { job.status = 'ready'; publish(); }
  });
  handle('remove', id => {
    const job = getJob(id);
    if (['inspecting', 'downloading', 'processing', 'cancelling'].includes(job.status)) throw new Error('Önce işlemi iptal et.');
    state.jobs = state.jobs.filter(j => j.id !== id); publish();
  });
  handle('clear', view => {
    state.jobs = state.jobs.filter(j => view === 'history' ? j.status !== 'completed' : !['ready', 'cancelled', 'error'].includes(j.status));
    publish();
  });
  handle('choose-folder', async () => {
    const result = await dialog.showOpenDialog(win, { title: 'İndirme klasörünü seç', defaultPath: state.outputDir, properties: ['openDirectory', 'createDirectory'] });
    if (!result.canceled && result.filePaths[0]) { state.outputDir = result.filePaths[0]; publish(); }
    return state.outputDir;
  });
  handle('folder', async () => { await fsp.mkdir(state.outputDir, { recursive: true }); const error = await shell.openPath(state.outputDir); if (error) throw new Error(error); });
  handle('show-file', async id => {
    const job = getJob(id);
    if (job.status !== 'completed' || !job.file) throw new Error('Dosya henüz hazır değil.');
    await fsp.access(job.file).catch(() => { throw new Error('Dosya taşınmış veya silinmiş.'); });
    shell.showItemInFolder(job.file);
  });
  handle('source', async id => { const job = getJob(id); await shell.openExternal(validateUrl(job.pageUrl || job.url).url); });
  handle('health', async () => {
    const result = await engine.run('health-' + randomUUID(), engine.downloader, ['--ignore-config', '--version'], { capture: true, timeout: 15000 });
    return { ytdlp: result.stdout.trim(), ffmpeg: fs.existsSync(path.join(bin, 'ffmpeg.exe')), ffprobe: fs.existsSync(path.join(bin, 'ffprobe.exe')), runtime: process.versions.node };
  });
  handle('update', async () => {
    if (busy() || state.jobs.some(j => j.status === 'queued')) throw new Error('Güncellemeden önce devam eden işlemlerin bitmesini bekle.');
    updating = true; publish(false);
    try {
      const target = updateBin(); await fsp.mkdir(path.dirname(target), { recursive: true });
      if (!fs.existsSync(target)) await fsp.copyFile(path.join(bin, 'yt-dlp.exe'), target);
      await engine.run('update', target, ['--ignore-config', '--update'], { capture: true, timeout: 180000 });
      engine.downloader = target;
      return 'İndirme motoru güncel.';
    } catch (err) { throw new Error(userError(err.message)); }
    finally { updating = false; engine.cancelled.delete('update'); publish(false); }
  });
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => {
    app.setAppUserModelId('com.hea.indir');
    state = readState();
    nativeTheme.themeSource = state.theme;
    bridge = new BrowserBridge({ ...extensionConfig, token: state.browser.token, enabled: () => state.browser.enabled, selection: () => state.defaults,
      onPair: token => { state.browser.token = token; persist(); }, onChange: () => publish(false),
      onDownload: source => {
        if (updating || quitting) throw new Error('Programdaki işlemin bitmesini bekle.');
        if (state.jobs.length >= 200) throw new Error('Kuyruk dolu. Önce eski kayıtları kaldır.');
        if (state.jobs.some(j => j.url === source.url && !['completed', 'cancelled', 'error'].includes(j.status))) throw new Error('Bu video zaten kuyrukta. Programdan durumunu kontrol et.');
        const checked = validateUrl(source.url);
        const job = { ...source, ...checked, id: randomUUID(), title: source.browserTitle, creator: new URL(source.pageUrl).hostname, status: 'inspecting', autoStart: true, options: { ...state.defaults }, createdAt: new Date().toISOString(), percent: 0 };
        state.jobs.push(job); publish(); inspectQueue();
        if (win) win.flashFrame(true);
        return { id: job.id, message: 'hea-indir’e gönderildi. Video kontrol edildikten sonra indirme başlayacak.' };
      }
    });
    engine = new Engine({ bin, runtime: process.execPath, downloader: fs.existsSync(updateBin()) ? updateBin() : undefined, onProgress: (id, progress) => {
      const job = state.jobs.find(j => j.id === id);
      if (job && job.status !== 'cancelling') { Object.assign(job, progress); publish(false); }
    } });
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    win = new BrowserWindow({ width: 1220, height: 870, minWidth: 980, minHeight: 730, show: false, title: 'hea-indir', backgroundColor: state.theme === 'dark' ? '#0e1625' : '#f6f7fb', icon: path.join(__dirname, '../assets/icon.png'), autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.webContents.on('will-attach-webview', event => event.preventDefault());
    win.setMenu(null);
    bindIpc();
    bridge.start().catch(() => { bridge.error = 'Tarayıcı bağlantısı açılamadı. Diğer hea-indir sürümlerini kapatıp yeniden aç.'; publish(false); });
    win.loadFile(path.join(__dirname, 'index.html'));
    win.once('ready-to-show', () => { win.show(); inspectQueue(); });
    win.on('close', async event => {
      if (quitting || !busy()) return;
      event.preventDefault();
      const result = await dialog.showMessageBox(win, { type: 'question', title: 'İşlem devam ediyor', message: 'İşlemleri iptal edip uygulamayı kapatmak istiyor musun?', buttons: ['Açık kalsın', 'İptal et ve kapat'], defaultId: 0, cancelId: 0 });
      if (result.response === 1) {
        quitting = true;
        await Promise.all([...engine.children.keys()].map(id => engine.cancel(id)));
        persist(); app.quit();
      }
    });
  }).catch(err => { dialog.showErrorBox('hea-indir açılamadı', err.message); app.quit(); });
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { bridge?.close(); });
}
