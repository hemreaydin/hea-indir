(() => {
  let dead = false, signature = '', lastUrl = location.href, host, root, button, panel, status = { items: [] }, sending = false;
  const topFrame = window.top === window;
  const send = async message => {
    if (dead) return;
    try { const result = await chrome.runtime.sendMessage(message); if (!result?.ok) throw new Error(result?.error || 'Eklenti bağlantısı kesildi.'); return result.value; }
    catch (error) { if (/context invalidated|receiving end/i.test(error.message)) { dead = true; host?.remove(); clearInterval(timer); } throw error; }
  };
  function scan() {
    if (dead) return;
    const videos = [...document.querySelectorAll('video')];
    const drm = videos.some(v => v.mediaKeys);
    const items = videos.flatMap(v => [v.currentSrc, v.src, ...[...v.querySelectorAll('source')].map(s => s.src)].filter(u => /^https?:/.test(u)).map(url => ({ url, duration: Number.isFinite(v.duration) ? v.duration : 0 })));
    if (lastUrl !== location.href) { signature = ''; lastUrl = location.href; }
    const sig = JSON.stringify([items, drm]);
    if (signature !== sig && (items.length || drm)) send({ type: 'observe', items, drm, userAgent: navigator.userAgent }).then(() => { signature = sig; }).catch(() => {});
  }
  function install() {
    if (host || !document.documentElement) return;
    host = document.createElement('hea-indir-widget');
    host.style.cssText = 'all:initial!important;position:fixed!important;top:20px!important;right:20px!important;z-index:2147483647!important;display:block!important;';
    root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = ':host{color-scheme:dark}*{box-sizing:border-box}button{font:600 13px Segoe UI,Arial,sans-serif;cursor:pointer;border:0;border-radius:11px;padding:12px 16px;background:#f8cf4d;color:#152544;box-shadow:0 4px 20px #0004}button:disabled{opacity:.6;cursor:wait}.panel{font:13px/1.5 Segoe UI,Arial,sans-serif;width:320px;max-height:340px;overflow:auto;margin-top:9px;padding:14px;background:#172237;color:#edf2fc;border:1px solid #35445e;border-radius:14px;box-shadow:0 12px 35px #0006}.panel[hidden]{display:none}.row{display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #34415b}.row span{flex:1;min-width:0;overflow-wrap:anywhere}.row button{padding:8px 12px;box-shadow:none}small{display:block;color:#b2bed4;font-size:11px}p{margin:6px 0 0}';
    button = document.createElement('button'); button.type = 'button'; button.textContent = '↓ Videoyu indir'; button.setAttribute('aria-label', 'hea-indir ile videoyu indir');
    panel = document.createElement('div'); panel.className = 'panel'; panel.hidden = true; panel.setAttribute('role', 'status');
    button.addEventListener('click', event => { if (!event.isTrusted || sending) return; if (status.items.length === 1) download(status.items[0].id); else { panel.hidden = !panel.hidden; list(); } });
    root.append(style, button, panel); document.documentElement.append(host);
  }
  function list() {
    panel.replaceChildren();
    const label = document.createElement('strong'); label.textContent = 'İndirmek istediğin kaynağı seç'; panel.append(label);
    for (const item of status.items) {
      const row = document.createElement('div'); row.className = 'row'; const text = document.createElement('span'); text.textContent = item.kind + (item.duration ? ' · ' + Math.round(item.duration) + ' sn' : '');
      const small = document.createElement('small'); small.textContent = new URL(item.url).hostname; text.append(small);
      const action = document.createElement('button'); action.type = 'button'; action.textContent = 'İndir'; action.addEventListener('click', e => { if (e.isTrusted && !sending) download(item.id); }); row.append(text, action); panel.append(row);
    }
    const tip = document.createElement('p'); tip.textContent = 'Tür, kalite ve kayıt klasörü hea-indir’deki seçimlerinden alınır.'; panel.append(tip);
  }
  async function download(id) {
    sending = true; button.disabled = true; panel.hidden = false; panel.textContent = 'hea-indir’e gönderiliyor…';
    try { const result = await send({ type: 'download', id }); panel.textContent = result.message; }
    catch (error) { panel.textContent = error.message; }
    finally { sending = false; if (button) button.disabled = false; }
  }
  async function tick() {
    if (dead) return;
    try {
      status = await send({ type: 'status' });
      if (!status) return;
      if (status.connected && status.enabled) scan(); else signature = '';
      if (!topFrame) return;
      if (!status.connected || !status.enabled || !status.items.length || status.drm) { host?.remove(); host = root = button = panel = null; return; }
      install();
      if (button && !sending) {
        const label = status.selection?.mode === 'audio' ? 'Sesi indir' : status.selection?.mode === 'video' ? 'Sessiz video indir' : 'Videoyu indir';
        button.textContent = `↓ ${label}${status.items.length > 1 ? ` (${status.items.length})` : ''}`;
        button.title = `hea-indir · ${(status.selection?.format || 'mp4').toUpperCase()} · Programdaki kalite ve kayıt klasörü kullanılır`;
      }
    } catch { host?.remove(); host = root = button = panel = null; }
  }
  document.addEventListener('loadedmetadata', scan, true);
  document.addEventListener('play', scan, true);
  document.addEventListener('encrypted', () => send({ type: 'observe', items: [], drm: true }).catch(() => {}), true);
  const timer = setInterval(tick, 2500);
  tick();
})();
