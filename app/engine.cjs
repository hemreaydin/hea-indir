const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { publicUrl, contextArgs } = require('./web-source.cjs');

const PLATFORMS = [
  { name: 'YouTube', key: 'youtube', hosts: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'] },
  { name: 'Instagram', key: 'instagram', hosts: ['instagram.com'] },
  { name: 'TikTok', key: 'tiktok', hosts: ['tiktok.com'] },
  { name: 'Facebook', key: 'facebook', hosts: ['facebook.com', 'fb.watch', 'fb.com'] }
];
function validateUrl(value) {
  const url = publicUrl(value);
  const platform = PLATFORMS.find(p => p.hosts.some(h => url.hostname === h || url.hostname.endsWith('.' + h)));
  if (platform) url.protocol = 'https:';
  url.hash = '';
  return { url: url.href, platform: platform?.name || url.hostname.replace(/^www\./, ''), platformKey: platform?.key || 'web' };
}
function options(input = {}) {
  const mode = ['both', 'audio', 'video'].includes(input.mode) ? input.mode : 'both';
  const formats = mode === 'audio' ? ['mp3', 'm4a', 'wav'] : ['mp4', 'mkv'];
  const format = formats.includes(input.format) ? input.format : formats[0];
  const qualities = mode === 'audio' ? ['best', '320', '192', '128'] : ['best', '2160', '1440', '1080', '720', '480', '360'];
  const quality = qualities.includes(String(input.quality)) ? String(input.quality) : 'best';
  return { mode, format, quality };
}
function formatSelector(input) {
  const o = options(input);
  if (o.mode === 'audio') return 'bestaudio/best';
  const cap = o.quality === 'best' ? '' : `[height<=${o.quality}]`;
  return o.mode === 'video' ? `bestvideo${cap}/best${cap}` : `bestvideo${cap}+bestaudio/best${cap}`;
}
function safeFilename(title) {
  let name = String(title || 'Video').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_').replace(/[. ]+$/g, '').trim().slice(0, 100).replace(/[. ]+$/g, '');
  if (/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(name)) name = '_' + name;
  return name || 'Video';
}
function userError(raw) {
  const text = String(raw || '');
  if (/DRM|protected content|encrypted media/i.test(text)) return 'Bu içerik DRM korumalı. Koruma kaldırma veya şifre çözme desteklenmiyor.';
  if (/cancelled|iptal/i.test(text)) return 'İndirme iptal edildi. Dilersen yeniden başlatabilirsin.';
  if (/private|login|log in|sign in|cookies|authentication|not a bot|age.restricted|confirm your age/i.test(text)) return 'Bu içerik oturum açma veya doğrulama istiyor. Herkese açık başka bir bağlantı dene; bu sürüm hesap girişi kullanmıyor.';
  if (/unsupported url|not a valid url|no video found/i.test(text)) return 'Bu sayfadaki video doğrudan bulunamadı. Chrome eklentisi açıkken videoyu oynatıp algılanan kaynağı göndermeyi dene.';
  if (/playlist|profile|channel/i.test(text)) return 'Bir profil veya liste yerine tek bir video bağlantısı ekle.';
  if (/not available|unavailable|removed|deleted|404|not found/i.test(text)) return 'İçerik bulunamadı, kaldırılmış veya bulunduğun bölgede erişilemiyor.';
  if (/403|429|forbidden|rate.limit|blocked/i.test(text)) return 'Platform isteği sınırlandırdı. Bir süre sonra yeniden dene veya Ayarlar’dan indirme motorunu güncelle.';
  if (/timed out|timeout|network|resolve|connection|ENOTFOUND/i.test(text)) return 'Bağlantı kurulamadı. İnternet bağlantını kontrol edip yeniden dene.';
  if (/ENOSPC|No space left/i.test(text)) return 'Diskte yeterli alan yok. Yer aç veya indirme klasörünü değiştir.';
  if (/EACCES|EPERM|Permission denied/i.test(text)) return 'Klasöre yazılamıyor. Ayarlar’dan yazma iznin olan bir klasör seç.';
  if (/requested format|no video formats/i.test(text)) return 'Bu kalite içerikte bulunamadı. “En iyi” seçeneğiyle yeniden dene.';
  if (/live/i.test(text)) return 'Canlı yayınlar bu sürümde desteklenmiyor. Yayın bittikten sonra tekrar dene.';
  return 'İşlem tamamlanamadı. Yeniden dene; sorun sürerse Ayarlar’dan motoru güncelle. Hata ayrıntısını karttan görebilirsin.';
}
function sanitizeDetail(raw) {
  return String(raw).replace(/https?:\/\/[^\s]+/g, '[bağlantı]').slice(-2000);
}
function parseProgress(line) {
  if (!line.startsWith('HEA_PROGRESS:')) return null;
  try {
    const p = JSON.parse(line.slice(13));
    const total = Number(p.total_bytes || p.total_bytes_estimate) || 0;
    return { percent: total ? Math.max(0, Math.min(100, Number(p.downloaded_bytes || 0) / total * 100)) : null, speed: Number(p.speed) || 0, eta: Number(p.eta) || 0, bytes: Number(p.downloaded_bytes) || 0, total };
  } catch { return null; }
}
function conversionArgs(input, source, target, probe) {
  const o = options(input);
  const args = ['-hide_banner', '-nostdin', '-y', '-i', source];
  if (o.mode === 'audio') {
    args.push('-map', '0:a:0', '-vn');
    if (o.format === 'wav') args.push('-c:a', 'pcm_s16le');
    else if (o.format === 'mp3') {
      args.push('-c:a', 'libmp3lame');
      args.push(...(o.quality === 'best' ? ['-q:a', '0'] : ['-b:a', o.quality + 'k']));
    } else args.push('-c:a', 'aac', '-b:a', (o.quality === 'best' ? '256' : o.quality) + 'k');
  } else {
    args.push('-map', '0:v:0');
    if (o.mode === 'video') args.push('-an');
    else args.push('-map', '0:a:0?');
    const codec = probe?.streams?.find(s => s.codec_type === 'video')?.codec_name;
    if (o.format === 'mp4' && codec !== 'h264') args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p');
    else args.push('-c:v', 'copy');
    if (o.mode === 'both') args.push('-c:a', o.format === 'mkv' ? 'copy' : 'aac');
  }
  if (['mp4', 'm4a'].includes(o.format)) args.push('-movflags', '+faststart');
  args.push('-progress', 'pipe:1', '-nostats', target);
  return args;
}
class Engine {
  constructor({ bin, runtime, downloader, onProgress = () => {} }) {
    this.bin = bin;
    this.runtime = runtime;
    this.downloader = downloader || path.join(bin, 'yt-dlp.exe');
    this.onProgress = onProgress;
    this.children = new Map();
    this.cancelled = new Set();
  }
  baseArgs() {
    return ['--ignore-config', '--no-playlist', '--no-colors', '--no-warnings', '--socket-timeout', '25', '--retries', '2', '--fragment-retries', '2', '--encoding', 'utf-8', '--ffmpeg-location', this.bin, '--js-runtimes', `node:${this.runtime}`];
  }
  async cancel(id) {
    this.cancelled.add(id);
    const child = this.children.get(id);
    if (!child?.pid) return;
    if (process.platform === 'win32') await new Promise(resolve => {
      const killer = spawn(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'), ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      const timer = setTimeout(() => { child.kill(); killer.kill(); resolve(); }, 5000);
      const finish = () => { clearTimeout(timer); child.kill(); resolve(); };
      killer.on('error', finish);
      killer.on('close', finish);
    });
    else child.kill('SIGTERM');
  }
  run(id, exe, args, { onLine, timeout = 0, capture = false } = {}) {
    if (this.cancelled.has(id)) return Promise.reject(new Error('cancelled'));
    return new Promise((resolve, reject) => {
      const child = spawn(exe, args, { windowsHide: true, shell: false, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', PYTHONIOENCODING: 'utf-8' }, stdio: ['ignore', 'pipe', 'pipe'] });
      this.children.set(id, child);
      let stdout = '', stderr = '', pending = '', timedOut = false, overflow = false;
      const timer = timeout ? setTimeout(() => { timedOut = true; this.cancel(id); }, timeout) : null;
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', data => {
        if (capture) {
          stdout += data;
          if (stdout.length > 16 * 1024 * 1024) { overflow = true; this.cancel(id); }
        }
        if (onLine) {
          pending += data;
          const lines = pending.split(/\r?\n/); pending = lines.pop();
          for (const line of lines) onLine(line);
          if (pending.length > 1024 * 1024) pending = '';
        }
      });
      child.stderr.on('data', data => { stderr = (stderr + data).slice(-10000); });
      const clean = () => { if (timer) clearTimeout(timer); if (this.children.get(id) === child) this.children.delete(id); };
      child.on('error', err => { clean(); reject(err); });
      child.on('close', code => {
        clean();
        if (pending && onLine) onLine(pending);
        if (timedOut) reject(new Error('timeout'));
        else if (overflow) reject(new Error('İçerik bilgisi çok büyük. Tek bir video seç.'));
        else if (this.cancelled.has(id)) reject(new Error('cancelled'));
        else if (code !== 0) reject(new Error(stderr || `İşlem hata kodu: ${code}`));
        else resolve({ stdout, stderr });
      });
    });
  }
  async inspect(job) {
    this.cancelled.delete(job.id);
    const checked = validateUrl(job.url);
    const { stdout } = await this.run(job.id, this.downloader, [...this.baseArgs(), ...contextArgs(job), '--skip-download', '--dump-single-json', '--', checked.url], { capture: true, timeout: 90000 });
    const info = JSON.parse(stdout);
    if (info._type === 'playlist' || info.entries) throw new Error('playlist');
    if (info.is_live || info.live_status === 'is_live') throw new Error('live');
    if (info.has_drm || (info.formats?.length && info.formats.every(f => f.has_drm))) throw new Error('DRM protected content');
    if (!info.formats?.length && !info.url) throw new Error('no video formats');
    const thumb = typeof info.thumbnail === 'string' && /^https:\/\//i.test(info.thumbnail) ? info.thumbnail : '';
    return { title: String(job.browserTitle || info.title || 'İsimsiz video').slice(0, 500), creator: String(info.uploader || info.channel || checked.platform).slice(0, 200), duration: Number(info.duration) || 0, thumbnail: thumb, heights: [...new Set((info.formats || []).map(f => f.height).filter(h => Number.isFinite(h) && h > 0))].sort((a, b) => b - a), mediaId: String(info.id || 'web-video').slice(0, 80) };
  }
  async download(job, outputDir) {
    this.cancelled.delete(job.id);
    const checked = validateUrl(job.url), o = options(job.options);
    const stage = path.join(outputDir, '.hea-work', randomUUID());
    await fs.mkdir(stage, { recursive: true });
    let source = '';
    try {
      await this.run(job.id, this.downloader, [...this.baseArgs(), ...contextArgs(job), '--newline', '--progress', '--progress-delta', '0.3', '--progress-template', 'download:HEA_PROGRESS:%(progress)j', '--print', 'after_move:HEA_FILE:%(filepath)j', '--no-simulate', '--windows-filenames', '--no-mtime', '--format', formatSelector(o), '--merge-output-format', 'mkv', '-P', stage, '-o', 'source.%(ext)s', '--', checked.url], {
        onLine: line => {
          const p = parseProgress(line);
          if (p) this.onProgress(job.id, { ...p, status: 'downloading' });
          if (line.startsWith('HEA_FILE:')) { try { source = JSON.parse(line.slice(9)); } catch {} }
        }
      });
      if (!source || path.dirname(path.resolve(source)) !== path.resolve(stage)) throw new Error('İndirilen dosya bulunamadı.');
      this.onProgress(job.id, { status: 'processing', percent: 0, speed: 0, eta: 0 });
      const { stdout } = await this.run(job.id, path.join(this.bin, 'ffprobe.exe'), ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', source], { capture: true, timeout: 30000 });
      const probe = JSON.parse(stdout);
      const duration = Number(probe.format?.duration) || job.duration || 0;
      const target = path.join(stage, `converted.${o.format}`);
      await this.run(job.id, path.join(this.bin, 'ffmpeg.exe'), conversionArgs(o, source, target, probe), { onLine: line => {
        if (line.startsWith('out_time_us=') && duration) this.onProgress(job.id, { status: 'processing', percent: Math.min(99, Number(line.slice(12)) / (duration * 1000000) * 100) });
      } });
      if (this.cancelled.has(job.id)) throw new Error('cancelled');
      const suffix = o.mode === 'video' ? ' - sessiz' : o.mode === 'audio' ? ' - ses' : '';
      const base = safeFilename(job.title) + suffix;
      let finalPath;
      for (let i = 0; i < 10000; i++) {
        finalPath = path.join(outputDir, `${base}${i ? ` (${i})` : ''}.${o.format}`);
        try { await fs.copyFile(target, finalPath, require('node:fs').constants.COPYFILE_EXCL); break; }
        catch (err) { if (err.code !== 'EEXIST' || i === 9999) throw err; }
      }
      const stat = await fs.stat(finalPath);
      return { file: finalPath, size: stat.size, completedAt: new Date().toISOString() };
    } finally {
      await fs.rm(stage, { recursive: true, force: true }).catch(() => {});
      await fs.rmdir(path.dirname(stage)).catch(() => {});
      this.cancelled.delete(job.id);
    }
  }
}
module.exports = { Engine, validateUrl, options, formatSelector, safeFilename, userError, sanitizeDetail, parseProgress, conversionArgs };
