const http = require('node:http');
const { randomBytes, randomInt, timingSafeEqual } = require('node:crypto');
const { browserSource } = require('./web-source.cjs');

const same = (a, b) => typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b));
class BrowserBridge {
  constructor({ extensionId, port = 38473, token = '', enabled, selection, onPair, onDownload, onEnabled, jobs, onChange = () => {} }) {
    Object.assign(this, { extensionId, port, token, enabled, selection, onPair, onDownload, onEnabled, jobs, onChange });
    this.ready = false; this.error = ''; this.attempts = 0; this.lockUntil = 0;
    this.newCode();
  }
  newCode() { this.code = String(randomInt(100000, 1000000)); this.expires = Date.now() + 10 * 60 * 1000; }
  reset() { this.token = ''; this.onPair(''); this.newCode(); this.onChange(); }
  status() { return { ready: this.ready, paired: Boolean(this.token), enabled: this.enabled(), code: !this.token && this.expires > Date.now() ? this.code : '', error: this.error }; }
  async start() {
    this.server = http.createServer((req, res) => this.handle(req, res).catch(() => { if (!res.headersSent) this.reply(res, 500, { error: 'İstek işlenemedi.' }); else res.end(); }));
    this.server.requestTimeout = 10000; this.server.headersTimeout = 10000; this.server.maxHeadersCount = 30;
    await new Promise((resolve, reject) => { this.server.once('error', reject); this.server.listen(this.port, '127.0.0.1', resolve); });
    this.port = this.server.address().port; this.ready = true;
    this.server.on('error', () => { this.ready = false; this.error = 'Tarayıcı bağlantısı kesildi. Uygulamayı yeniden aç.'; this.onChange(); });
    this.onChange();
  }
  reply(res, status, value) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); }
  async body(req) {
    if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new Error('JSON isteği gerekli.');
    let body = '';
    for await (const chunk of req) { body += chunk; if (Buffer.byteLength(body) > 32768) throw new Error('İstek çok büyük.'); }
    return JSON.parse(body);
  }
  async handle(req, res) {
    const origin = `chrome-extension://${this.extensionId}`;
    if (req.headers.host !== `127.0.0.1:${this.port}` || (req.headers.origin && req.headers.origin !== origin) || (req.method !== 'OPTIONS' && req.headers['x-hea-client'] !== this.extensionId) || (req.method === 'OPTIONS' && req.headers.origin !== origin)) return this.reply(res, 403, { error: 'Bu istemciye izin verilmedi.' });
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Hea-Client');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    if (req.method === 'POST' && req.url === '/pair') {
      if (this.token || Date.now() < this.lockUntil) return this.reply(res, 429, { error: 'Programdan yeni eşleştirme kodu oluştur.' });
      let input;
      try { input = await this.body(req); } catch { return this.reply(res, 400, { error: 'Geçersiz istek.' }); }
      if (Date.now() > this.expires || !same(input.code, this.code)) {
        if (++this.attempts >= 5) { this.lockUntil = Date.now() + 30000; this.attempts = 0; }
        return this.reply(res, 401, { error: 'Kod yanlış veya süresi dolmuş. Programdan yeni kod al.' });
      }
      this.token = randomBytes(32).toString('hex'); this.code = ''; this.expires = 0; this.attempts = 0;
      this.onPair(this.token); this.onChange();
      return this.reply(res, 200, { token: this.token });
    }
    if (!this.token || !same(req.headers.authorization, `Bearer ${this.token}`)) return this.reply(res, 401, { error: 'Önce eklentiyi programla eşleştir.' });
    if (req.method === 'GET' && req.url === '/status') return this.reply(res, 200, { enabled: this.enabled(), version: '0.4.0', protocol: 2, ...(this.selection ? { selection: this.selection() } : {}), ...(this.jobs ? { jobs: this.jobs() } : {}) });
    if (req.method === 'POST' && req.url === '/enabled' && this.onEnabled) {
      try {
        const input = await this.body(req);
        if (typeof input.enabled !== 'boolean') throw new Error('Geçersiz anahtar değeri.');
        await this.onEnabled(input.enabled);
        return this.reply(res, 200, { enabled: this.enabled() });
      } catch (error) { return this.reply(res, 400, { error: error.message }); }
    }
    if (req.method === 'POST' && req.url === '/download') {
      if (!this.enabled()) return this.reply(res, 409, { error: 'Tarayıcıdan indirme programdan kapatılmış.' });
      try { const result = await this.onDownload(browserSource(await this.body(req))); return this.reply(res, 200, result); }
      catch (error) { return this.reply(res, 400, { error: error.message }); }
    }
    this.reply(res, 404, { error: 'İşlem bulunamadı.' });
  }
  close() { this.ready = false; this.server?.closeAllConnections(); return new Promise(resolve => this.server ? this.server.close(resolve) : resolve()); }
}
module.exports = { BrowserBridge };
