const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let state = { jobs: [], defaults: { mode: 'both', format: 'mp4', quality: 'best' }, theme: 'dark' }, view = 'download', signature = '', toastTimer, healthLoading = false;
const formats = mode => mode === 'audio' ? [['mp3', 'MP3'], ['m4a', 'M4A'], ['wav', 'WAV']] : [['mp4', 'MP4'], ['mkv', 'MKV']];
const qualities = mode => mode === 'audio' ? [['best', 'En iyi ses'], ['320', '320 kbps'], ['192', '192 kbps'], ['128', '128 kbps']] : [['best', 'En iyi kalite'], ['2160', 'En fazla 4K'], ['1440', 'En fazla 1440p'], ['1080', 'En fazla 1080p'], ['720', 'En fazla 720p'], ['480', 'En fazla 480p'], ['360', 'En fazla 360p']];
const optionHtml = (list, selected) => list.map(([v, label]) => `<option value="${v}"${v === selected ? ' selected' : ''}>${label}</option>`).join('');
const statusText = { inspecting: 'Bilgiler alınıyor', ready: 'İndirmeye hazır', queued: 'Sırada', downloading: 'İndiriliyor', processing: 'Dosya hazırlanıyor', completed: 'Tamamlandı', error: 'İşlem tamamlanamadı', cancelled: 'İptal edildi', cancelling: 'İptal ediliyor' };
const activeStates = ['inspecting', 'downloading', 'processing', 'cancelling'];
function duration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, s = Math.floor(seconds % 60);
  return `${h ? h + ':' : ''}${h ? String(m).padStart(2, '0') : m}:${String(s).padStart(2, '0')}`;
}
function size(n) { if (!n) return ''; const i = Math.min(3, Math.floor(Math.log(n) / Math.log(1024))); return `${(n / 1024 ** i).toFixed(i ? 1 : 0)} ${['B', 'KB', 'MB', 'GB'][i]}`; }
function toast(text) { $('#toast').textContent = text; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 5500); }
async function call(name, ...args) { return window.hea.call(name, ...args); }
function guard(fn) { return (...args) => Promise.resolve().then(() => fn(...args)).catch(error => toast(error.message)); }
function emptyState(history = false) {
  return `<div class="empty-state"><div class="empty-art">${icon(history ? 'history' : 'video')}<span class="art-badge">${icon(history ? 'check' : 'plus')}</span></div><div><h3>${history ? 'İlk indirmen burada yerini alacak.' : 'Sıradaki güzel içerik burada yerini alacak.'}</h3><p>${history ? 'Tamamlanan dosyalarını bu ekrandan kolayca bulabilirsin.' : 'Yukarıya bir bağlantı ekle, gerisini birlikte halledelim.'}</p></div>${history ? '' : '<span class="empty-step">Kopyala <span>→</span> Yapıştır <span>→</span> İndir</span>'}</div>`;
}
function actionButton(action, name, title, cls = '') { return `<button class="icon-button ${cls}" data-action="${action}" title="${title}" aria-label="${title}">${icon(name)}</button>`; }
function jobHtml(job) {
  const editable = ['ready', 'error', 'cancelled'].includes(job.status), running = activeStates.includes(job.status), o = job.options;
  let actions = '';
  if (job.status === 'completed') actions += actionButton('show-file', 'folder', 'Dosyayı klasörde göster', 'start');
  else if (editable) actions += actionButton('start', job.status === 'ready' ? 'download' : 'refresh', job.status === 'ready' ? 'Bu içeriği indir' : 'Yeniden dene', 'start');
  if (running || job.status === 'queued') actions += job.status === 'cancelling' ? '' : actionButton('cancel', 'close', 'İşlemi iptal et');
  else actions += actionButton('remove', 'close', 'Listeden kaldır');
  actions += actionButton('source', 'external', 'Kaynağı tarayıcıda aç');
  const error = job.error && ['error', 'cancelled'].includes(job.status) ? `<p class="job-error">${escape(job.error)}${job.detail && job.status === 'error' ? '<button class="detail-link" data-action="detail">Ayrıntı</button>' : ''}</p>` : '';
  const complete = job.status === 'completed';
  const selectControls = `<div class="job-options"><select data-option="mode" aria-label="Bu içerik için indirme türü" ${editable ? '' : 'disabled'}>${optionHtml([['both', 'Video + ses'], ['audio', 'Yalnızca ses'], ['video', 'Yalnızca video']], o.mode)}</select><select data-option="format" aria-label="Bu içerik için format" ${editable ? '' : 'disabled'}>${optionHtml(formats(o.mode), o.format)}</select><select data-option="quality" aria-label="Bu içerik için kalite" ${editable && o.format !== 'wav' ? '' : 'disabled'}>${optionHtml(qualities(o.mode), o.quality)}</select></div>`;
  return `<article class="job" data-id="${escape(job.id)}"><div class="job-thumb">${icon(o.mode === 'audio' ? 'music' : 'video')}${job.thumbnail ? `<img src="${escape(job.thumbnail)}" alt="" referrerpolicy="no-referrer" loading="lazy">` : ''}${job.duration ? `<span class="duration">${duration(job.duration)}</span>` : ''}</div><div class="job-content"><div class="job-meta"><span class="platform-tag ${escape(job.platformKey)}">${escape(job.platform)}</span><span>${escape(job.creator)}</span><span class="status-label status-${job.status}">${statusText[job.status] || 'Bekliyor'}</span></div><h3 title="${escape(job.title)}">${escape(job.title)}</h3>${complete ? `<div class="completed-info">${escape(o.format.toUpperCase())} <span>·</span> ${size(job.size)} <span>·</span> ${new Date(job.completedAt).toLocaleDateString('tr-TR')} <span>·</span> ${o.mode === 'video' ? 'Sessiz video' : o.mode === 'audio' ? 'Ses dosyası' : 'Video + ses'}</div>` : selectControls}${running ? `<div class="progress-area"><div class="progress-track"><div class="progress-fill indeterminate"></div></div><div class="progress-caption"><span data-progress-label></span><span data-progress-speed></span></div></div>` : ''}${error}</div><div class="job-actions">${actions}</div></article>`;
}
function renderProgress() {
  for (const job of state.jobs) {
    const card = document.querySelector(`[data-id="${job.id}"]`);
    if (!card) continue;
    const bar = card.querySelector('.progress-fill');
    if (!bar) continue;
    const unknown = job.percent == null || ['inspecting', 'cancelling'].includes(job.status);
    bar.classList.toggle('indeterminate', unknown);
    bar.style.width = unknown ? '30%' : `${Math.max(0, Math.min(100, job.percent))}%`;
    card.querySelector('[data-progress-label]').textContent = job.status === 'processing' ? `Dosya hazırlanıyor${unknown ? '…' : ` · %${Math.round(job.percent)}`}` : job.status === 'inspecting' ? 'Başlık, süre ve kullanılabilir biçimler kontrol ediliyor…' : job.status === 'cancelling' ? 'İşlem güvenle durduruluyor…' : `${unknown ? 'Bağlanıyor…' : `İndirilen parça · %${Math.round(job.percent)}`}`;
    card.querySelector('[data-progress-speed]').textContent = job.status === 'downloading' && job.speed ? `${size(job.speed)}/sn${job.eta ? ' · ' + duration(job.eta) + ' kaldı' : ''}` : '';
  }
}
function renderDefaults() {
  const o = state.defaults;
  $$('.mode').forEach(button => { button.classList.toggle('active', button.dataset.mode === o.mode); button.setAttribute('aria-pressed', String(button.dataset.mode === o.mode)); });
  $('#format-select').innerHTML = optionHtml(formats(o.mode), o.format);
  $('#quality-select').innerHTML = optionHtml(qualities(o.mode), o.quality);
  $('#quality-select').disabled = o.format === 'wav';
  const tip = o.format === 'wav' ? 'WAV sıkıştırılmamış sestir; daha fazla yer kaplar.' : o.mode === 'audio' ? 'Ses kalitesi, kaynak kaydın kalitesine bağlıdır.' : o.format === 'mp4' ? 'MP4, çoğu cihazla uyumlu seçimdir.' : 'MKV, kaynak görüntü kalitesini korur.';
  $('#format-tip').innerHTML = icon('info') + `<span>${tip}</span>`;
}
function render(next) {
  const defaultChanged = JSON.stringify(state.defaults) !== JSON.stringify(next.defaults);
  state = next;
  const dark = state.theme !== 'light';
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#theme-toggle').innerHTML = icon(dark ? 'sun' : 'moon') + `<span>${dark ? 'Açık görünüm' : 'Koyu görünüm'}</span>`;
  $('#theme-toggle').title = dark ? 'Açık temaya geç' : 'Koyu temaya geç';
  $('#theme-select').value = dark ? 'dark' : 'light';
  const browser = state.browser || {};
  $('#browser-enabled').checked = browser.enabled !== false;
  $('#browser-code').textContent = browser.code || (browser.paired ? 'Eşleştirildi' : 'Yeni kod al');
  $('#browser-code-copy').disabled = !browser.code;
  $('#browser-status').textContent = browser.error || (!browser.ready ? 'Bağlantı hazırlanıyor…' : browser.paired ? (browser.enabled ? 'Eklenti eşleştirildi. Video düğmesi açık.' : 'Eklenti eşleştirildi. Video düğmesi kapalı.') : 'Eklentiyle eşleştirmek için aşağıdaki kodu kullan. Kod 10 dakika geçerli.');
  if (defaultChanged || !$('#format-select').options.length) renderDefaults();
  const queue = state.jobs.filter(j => j.status !== 'completed'), history = state.jobs.filter(j => j.status === 'completed').reverse();
  const nextSignature = JSON.stringify(state.jobs.map(({ percent, speed, eta, bytes, total, ...rest }) => rest));
  if (nextSignature !== signature) {
    signature = nextSignature;
    $('#queue-list').innerHTML = queue.length ? queue.map(jobHtml).join('') : emptyState();
    $('#history-list').innerHTML = history.length ? history.map(jobHtml).join('') : emptyState(true);
    $$('img').forEach(img => img.addEventListener('error', () => img.remove(), { once: true }));
  }
  renderProgress();
  $('#queue-count').textContent = queue.length;
  $('#nav-count').textContent = queue.length;
  $('#history-count').textContent = history.length;
  const ready = queue.filter(j => j.status === 'ready').length;
  $('#download-all').disabled = !ready || state.updating;
  $('#download-all span').textContent = ready > 1 ? `Tümünü indir (${ready})` : 'İndirmeyi başlat';
  $('#ready-label').textContent = ready ? `${ready} içerik indirmeye hazır` : state.active ? 'İndirme devam ediyor' : queue.length ? 'Kuyruğunu buradan yönet' : 'Linkini ekleyerek başla';
  $('#folder-name').textContent = state.outputDir?.split(/[\\/]/).slice(-2).join(' / ') || 'İndirilenler / hea-indir';
  $('.save-location').title = state.outputDir || '';
  $('#settings-folder').textContent = state.outputDir || '';
  $('#version').textContent = 'v' + (state.version || '0.3.0');
  $('#clear-queue').disabled = !queue.some(j => ['ready', 'error', 'cancelled'].includes(j.status));
  $('#clear-history').disabled = !history.length;
  $('#update-engine').disabled = state.updating || Boolean(state.active) || queue.some(j => j.status === 'inspecting');
  $('#update-engine').innerHTML = icon('refresh') + (state.updating ? 'Güncelleniyor…' : 'Güncellemeleri kontrol et');
  $('#add-button').disabled = state.updating;
}
async function health() {
  if (healthLoading) return;
  healthLoading = true;
  try {
    const result = await call('health');
    $('#engine-status').textContent = `yt-dlp · ${result.ytdlp}`;
    $('#engine-components').textContent = `${result.ffmpeg && result.ffprobe ? '✓ Video ve ses dönüştürücü hazır' : 'Dönüştürme araçları eksik'}   ·   ✓ JavaScript motoru hazır`;
  } catch (err) { $('#engine-status').textContent = 'Motor kontrol edilemedi: ' + err.message; }
  finally { healthLoading = false; }
}
function showView(name) {
  view = name;
  $$('.view').forEach(section => { section.hidden = section.id !== name + '-view'; });
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.view === name));
  $('#breadcrumb').innerHTML = `Çalışma alanı <span>/</span> ${{ download: 'Yeni indirme', history: 'İndirme geçmişi', settings: 'Ayarlar' }[name]}`;
  $('main').scrollTop = 0;
  if (name === 'settings') health();
}
async function addLinks(event) {
  event?.preventDefault();
  const text = $('#url-input').value.trim();
  if (!text) { $('#url-input').focus(); toast('Önce bir video bağlantısı yapıştır.'); return; }
  $('#add-button').disabled = true;
  try {
    const added = await call('add', text, state.defaults);
    $('#url-input').value = ''; $('#input-hint').classList.remove('error');
    $('#input-hint').textContent = 'Birden fazla bağlantıyı ayrı satırlara yapıştırabilirsin.';
    toast(added ? `${added} bağlantı eklendi. Video bilgileri alınıyor.` : 'Bu bağlantı zaten kuyrukta.');
  } catch (err) { $('#input-hint').textContent = err.message; $('#input-hint').classList.add('error'); }
  finally { $('#add-button').disabled = state.updating; }
}
async function applyDefaults(selected) {
  const changed = await call('defaults', selected);
  if (changed) toast(`${changed} bekleyen içeriğin indirme ayarları güncellendi.`);
}
$('#link-form').addEventListener('submit', addLinks);
$('#url-input').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); addLinks(); } });
$('#paste-button').addEventListener('click', guard(async () => { const text = await call('clipboard'); if (!text.trim()) return toast('Panoda bir bağlantı bulunamadı.'); $('#url-input').value = text; $('#url-input').focus(); }));
$$('.mode').forEach(button => button.addEventListener('click', guard(async () => {
  const mode = button.dataset.mode;
  await applyDefaults({ mode, format: mode === 'audio' ? 'mp3' : 'mp4', quality: 'best' });
})));
$('#format-select').addEventListener('change', guard(event => applyDefaults({ ...state.defaults, format: event.target.value })));
$('#quality-select').addEventListener('change', guard(event => applyDefaults({ ...state.defaults, quality: event.target.value })));
$('#theme-toggle').addEventListener('click', guard(() => call('theme', state.theme === 'light' ? 'dark' : 'light')));
$('#theme-select').addEventListener('change', guard(event => call('theme', event.target.value)));
$('#browser-enabled').addEventListener('change', guard(event => call('browser-enabled', event.target.checked)));
$('#browser-pair').addEventListener('click', guard(() => call('browser-pair')));
$('#browser-code-copy').addEventListener('click', guard(async () => { await call('browser-code-copy'); toast('Eşleştirme kodu kopyalandı.'); }));
$('#browser-install').addEventListener('click', guard(async () => toast(await call('browser-install'))));
$('#browser-folder').addEventListener('click', guard(() => call('browser-folder')));
$$('.nav-item').forEach(button => button.addEventListener('click', () => showView(button.dataset.view)));
$('.brand').addEventListener('click', event => { event.preventDefault(); showView('download'); });
$$('.choose-folder').forEach(button => button.addEventListener('click', guard(() => call('choose-folder'))));
$('#download-all').addEventListener('click', guard(() => call('start')));
$('#clear-queue').addEventListener('click', guard(async () => { await call('clear', 'queue'); toast('Bekleyen kayıtlar listeden kaldırıldı. Dosyaların korundu.'); }));
$('#clear-history').addEventListener('click', guard(async () => { await call('clear', 'history'); toast('Geçmiş temizlendi. İndirdiğin dosyalar klasöründe duruyor.'); }));
$('#update-engine').addEventListener('click', guard(async () => { toast('İndirme motoru kontrol ediliyor…'); toast(await call('update')); health(); }));
for (const list of [$('#queue-list'), $('#history-list')]) {
  list.addEventListener('click', guard(async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const card = button.closest('[data-id]'), id = card.dataset.id, action = button.dataset.action;
    if (action === 'detail') {
      const job = state.jobs.find(j => j.id === id); $('#detail-message').textContent = job.error; $('#detail-text').textContent = job.detail; $('#detail-dialog').showModal(); return;
    }
    button.disabled = true;
    try { await call(action, id); } finally { if (button.isConnected) button.disabled = false; }
  }));
  list.addEventListener('change', guard(async event => {
    const select = event.target.closest('[data-option]');
    if (!select) return;
    const id = select.closest('[data-id]').dataset.id, job = state.jobs.find(j => j.id === id);
    const selected = { ...job.options, [select.dataset.option]: select.value };
    if (select.dataset.option === 'mode') { selected.format = selected.mode === 'audio' ? 'mp3' : 'mp4'; selected.quality = 'best'; }
    await call('options', id, selected);
  }));
}
$('#close-detail').addEventListener('click', () => $('#detail-dialog').close());
if (window.hea) {
  window.hea.onState(render); window.hea.onNotice(toast);
  call('state').then(render).catch(err => toast(err.message));
} else {
  $('#queue-list').innerHTML = emptyState(); renderDefaults();
  toast('Uygulamayı hea-indir.exe ile aç. Tarayıcı görünümünde indirme motoru çalışmaz.');
}
