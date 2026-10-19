const $ = s => document.querySelector(s);
let tabId;
async function send(message) { const r = await chrome.runtime.sendMessage({ ...message, tabId }); if (!r?.ok) throw new Error(r?.error || 'Eklentiye ulaşılamadı.'); return r.value; }
function notice(text) { $('#notice').textContent = text; $('#notice').hidden = false; }
async function download(id) { try { notice((await send(id ? { type: 'download', id } : { type: 'page' })).message); } catch (e) { notice(e.message); } }
async function refresh() {
  try {
    const s = await send({ type: 'status' });
    const selection = s.selection ? ` · ${{audio:'Yalnızca ses',video:'Sessiz video',both:'Video + ses'}[s.selection.mode]} / ${s.selection.format.toUpperCase()}` : '';
    $('#connection').textContent = !s.connected ? s.error : s.enabled ? '● hea-indir bağlı' + selection : 'Video düğmesi programdan kapatılmış.';
    $('#pair-form').hidden = s.paired;
    $('#sources').replaceChildren();
    $('#send-page').hidden = !s.connected || !s.enabled || !s.pageUrl || s.drm;
    for (const item of s.items) {
      const row = document.createElement('div'); row.className = 'source'; const label = document.createElement('div');
      label.textContent = item.kind + (item.duration ? ` · ${Math.round(item.duration)} sn` : '');
      const hint = document.createElement('small'); hint.textContent = new URL(item.url).hostname; label.append(hint);
      const button = document.createElement('button'); button.textContent = 'İndir'; button.addEventListener('click', async () => { button.disabled = true; await download(item.id); button.disabled = false; }); row.append(label, button); $('#sources').append(row);
    }
    if (!s.items.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = s.drm ? 'Bu oynatıcı DRM korumalı. İndirme desteklenmiyor.' : !s.connected ? 'Programı açıp bağlantıyı kurduktan sonra videoyu oynat.' : !s.enabled ? 'Yeniden açmak için programdaki Chrome eklentisi anahtarını kullan.' : 'Henüz kaynak bulunamadı. Videoyu birkaç saniye oynat, sonra yenile. Gerekirse sayfayı yeniden yükle.'; $('#sources').append(p); }
  } catch (e) { $('#connection').textContent = e.message; }
}
$('#pair-form').addEventListener('submit', async e => { e.preventDefault(); try { await send({ type: 'pair', code: $('#code').value.trim() }); $('#code').value = ''; notice('Eşleştirme tamamlandı. Videoyu oynatabilirsin.'); refresh(); } catch (e) { notice(e.message); } });
$('#refresh').addEventListener('click', refresh);
$('#send-page').addEventListener('click', () => download());
chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => { tabId = tabs[0]?.id; refresh(); });
