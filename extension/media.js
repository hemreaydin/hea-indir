/* Shared, dependency-free source classification; does not read cookies. */
(function (root) {
  function url(value) {
    try {
      const u = new URL(value), h = u.hostname.toLowerCase();
      if (!/^https?:$/.test(u.protocol) || u.username || u.password || u.port || !h.includes('.') || /(^|\.)(localhost|local|lan|internal|test|invalid)$/.test(h) || /^[\d.]+$/.test(h) || h.includes(':')) return '';
      u.hash = ''; return u.href;
    } catch { return ''; }
  }
  function kind(value, mime = '', fromVideo = false) {
    const safe = url(value); if (!safe) return '';
    const p = new URL(safe).pathname.toLowerCase();
    if (/\.(ts|m4s|cmfv|cmfa|key)$/.test(p) || /(?:^|\/)(?:init|segment|seg|chunk)[-_\d]/.test(p)) return '';
    if (/\.m3u8$/.test(p) || /mpegurl/i.test(mime)) return 'HLS';
    if (/\.mpd$/.test(p) || /dash\+xml/i.test(mime)) return 'DASH';
    if (/\.(mp4|webm|mkv|mov|m4v|ogv)$/.test(p) || /^video\//i.test(mime) || fromVideo) return 'Video';
    return '';
  }
  function knownPage(value) {
    const safe = url(value); if (!safe) return false;
    const u = new URL(safe);
    return /(^|\.)(youtube\.com|youtu\.be|instagram\.com|tiktok\.com|facebook\.com|fb\.watch)$/.test(u.hostname) && /watch|shorts|reel|\/p\/|\/video\/|youtu\.be|fb\.watch/.test(safe);
  }
  function merge(list, item) {
    const source = url(item.url); if (!source || !item.kind) return list;
    const previous = list.find(x => x.url === source);
    const next = { ...previous, ...item, url: source, id: previous?.id || crypto.randomUUID() };
    return [next, ...list.filter(x => x.url !== source)].slice(0, 24);
  }
  root.HeaMedia = { url, kind, knownPage, merge };
  if (typeof module !== 'undefined') module.exports = root.HeaMedia;
})(globalThis);
