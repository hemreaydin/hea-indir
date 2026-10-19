const net = require('node:net');

function publicUrl(value) {
  if (typeof value !== 'string' || value.length > 8192 || /[\r\n\x00]/.test(value)) throw new Error('Geçerli bir video bağlantısı gir.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Bağlantı http:// veya https:// ile başlamalı.'); }
  const host = url.hostname.replace(/\.$/, '').toLowerCase();
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || !host.includes('.') || net.isIP(host) || host.includes(':') || /(^|\.)(localhost|local|internal|lan|home|test|invalid|example)$/.test(host)) throw new Error('Herkese açık bir internet video bağlantısı kullan. Yerel adresler ve bu bağlantı türü desteklenmiyor.');
  url.hash = '';
  return url;
}
function browserSource(value) {
  if (!value || typeof value !== 'object' || value.drm) throw new Error('DRM korumalı içerik desteklenmiyor.');
  const url = publicUrl(value.url).href;
  const pageUrl = publicUrl(value.pageUrl).href;
  const referrer = publicUrl(value.referrer || pageUrl).href;
  const userAgent = typeof value.userAgent === 'string' && /^[\x20-\x7e]{1,512}$/.test(value.userAgent) ? value.userAgent : '';
  return { url, pageUrl, referrer, userAgent, browserTitle: String(value.title || 'Tarayıcı videosu').slice(0, 500) };
}
function contextArgs(job) {
  const args = [];
  if (job.referrer) args.push('--referer', publicUrl(job.referrer).href);
  if (typeof job.userAgent === 'string' && /^[\x20-\x7e]{1,512}$/.test(job.userAgent)) args.push('--user-agent', job.userAgent);
  return args;
}
module.exports = { publicUrl, browserSource, contextArgs };
