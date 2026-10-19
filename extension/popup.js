const $ = s => document.querySelector(s);
let tabId, changing = false;
async function send(message) { const r = await chrome.runtime.sendMessage({ ...message, tabId }); if (!r?.ok) throw new Error(r?.error || 'Eklentiye ulaşılamadı.'); return r.value; }
function notice(text) { $('#notice').textContent = text; $('#notice').hidden = false; }
async function download(id) { try { notice('Arka planda hazırlanıyor…'); notice((await send(id ? { type: 'download', id } : { type: 'page' })).message); await refresh(); } catch (e) { notice(e.message); } }
async function refresh() {
  if (changing) return;
  try {
    const s = await send({ type: 'status' });
    $('#enabled').checked = s.enabled;
    $('#switch-label').textContent = s.enabled ? 'AÇIK' : 'KAPALI';
    const selection = s.selection ? ` · ${{audio:'Yalnızca ses',video:'Sessiz video',both:'Video + ses'}[s.selection.mode]} / ${s.selection.format.toUpperCase()}` : '';
    $('#connection').textContent = !s.enabled ? 'İndirme kapalı. Başlamak için anahtarı aç.' : s.connected ? '● Arka planda hazır' + selection : '● Açık · İndir’e bastığında otomatik başlar.';
    $('#sources').replaceChildren();
    $('#send-page').hidden = !s.enabled || !s.pageUrl || s.drm;
    for (const item of s.items) {
      const row = document.createElement('div'); row.className = 'source'; const label = document.createElement('div');
      label.textContent = item.kind + (item.duration ? ` · ${Math.round(item.duration)} sn` : '');
      const hint = document.createElement('small'); hint.textContent = new URL(item.url).hostname; label.append(hint);
      const button = document.createElement('button'); button.textContent = 'İndir'; button.addEventListener('click', async () => { button.disabled = true; await download(item.id); button.disabled = false; }); row.append(label, button); $('#sources').append(row);
    }
    if (!s.items.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = s.drm ? 'Bu oynatıcı DRM korumalı. İndirme desteklenmiyor.' : !s.enabled ? 'Kapalıyken sayfalarda indirme düğmesi gösterilmez.' : 'Videoyu birkaç saniye oynat, sonra yenile. Gerekirse sayfayı yeniden yükle.'; $('#sources').append(p); }
    $('#jobs').replaceChildren();
    const labels = { inspecting:'Hazırlanıyor', queued:'Sırada', downloading:'İndiriliyor', processing:'Dosya hazırlanıyor', completed:'Tamamlandı', error:'Hata', cancelled:'İptal edildi', cancelling:'İptal ediliyor', ready:'Hazır' };
    for (const job of s.jobs || []) {
      const row = document.createElement('div'); row.className = 'job';
      const title = document.createElement('strong'); title.textContent = job.title;
      const detail = document.createElement('small'); detail.textContent = (labels[job.status] || job.status) + (job.percent != null ? ` · %${Math.round(job.percent)}` : '') + (job.error ? ' · ' + job.error : '');
      row.append(title, detail); $('#jobs').append(row);
    }
    $('#recent').hidden = !s.jobs?.length;
  } catch (e) { $('#connection').textContent = e.message; }
}
$('#enabled').addEventListener('change', async () => {
  changing = true; $('#enabled').disabled = true;
  notice($('#enabled').checked ? 'Arka plan bağlantısı hazırlanıyor…' : 'İndirme kapatılıyor…');
  try { await send({ type: 'toggle', enabled: $('#enabled').checked }); notice($('#enabled').checked ? 'Hazır. Programı elle açmadan indirebilirsin.' : 'Kapalı. Başlamış indirmeler devam eder.'); }
  catch (e) { notice(e.message); }
  finally { changing = false; $('#enabled').disabled = false; await refresh(); }
});
$('#refresh').addEventListener('click', refresh);
$('#send-page').addEventListener('click', () => download());
chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => { tabId = tabs[0]?.id; refresh(); });
setInterval(refresh, 2500);
