const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const { Engine, validateUrl, options, formatSelector, safeFilename, parseProgress, conversionArgs, userError } = require('../app/engine.cjs');
const bin = path.join(__dirname, '../bin');

test('platform bağlantıları ve kısaltılmış bağlantılar doğrulanır', () => {
  for (const [url, platform] of [['https://youtu.be/test', 'YouTube'], ['https://www.youtube.com/shorts/test', 'YouTube'], ['https://instagram.com/reel/a', 'Instagram'], ['https://vm.tiktok.com/test', 'TikTok'], ['https://fb.watch/a', 'Facebook'], ['https://m.facebook.com/watch/?v=1', 'Facebook']]) assert.equal(validateUrl(url).platform, platform);
  for (const url of ['file:///C:/x', 'https://youtube.com.attacker.test/a', 'https://youtube.com@evil.test/a', 'https://evil.test/?youtube.com', 'https://youtube.com:1234/a', '--exec=cmd', 'javascript:alert(1)', 'https://user:pass@youtube.com/a']) assert.throws(() => validateUrl(url));
});
test('format ve kalite seçenekleri sınırlanır; komut ekleme kabul edilmez', () => {
  assert.deepEqual(options({ mode: 'audio', format: 'mp4', quality: '9999' }), { mode: 'audio', format: 'mp3', quality: 'best' });
  assert.equal(formatSelector({ mode: 'video', quality: '720' }), 'bestvideo[height<=720]/best[height<=720]');
  assert.equal(formatSelector({ mode: 'both', quality: '1080' }), 'bestvideo[height<=1080]+bestaudio/best[height<=1080]');
  assert.equal(formatSelector({ mode: 'audio' }), 'bestaudio/best');
  assert(!formatSelector({ quality: '720]; --exec powershell' }).includes('powershell'));
});
test('Windows dosya adları, yüzde ve anlaşılır hata mesajları', () => {
  assert.equal(safeFilename('CON'), '_CON');
  assert.equal(safeFilename('İstanbul: gün / gece? '), 'İstanbul_ gün _ gece_');
  assert.equal(safeFilename('...'), 'Video');
  assert.equal(parseProgress('HEA_PROGRESS:{"downloaded_bytes":25,"total_bytes":100,"speed":12}').percent, 25);
  assert.equal(parseProgress('HEA_PROGRESS:{"downloaded_bytes":25}').percent, null);
  assert.equal(parseProgress('garbage'), null);
  assert.match(userError('Sign in to confirm you’re not a bot'), /oturum/);
  assert.match(userError('HTTP Error 403'), /sınırlandırdı/);
});
test('iptal, çocuk süreci sonlandırır ve işlem başarısız döner', { timeout: 15000 }, async () => {
  const engine = new Engine({ bin, runtime: process.execPath });
  const result = engine.run('cancel-me', process.execPath, ['-e', 'setInterval(()=>{},1000)']);
  const rejection = assert.rejects(result, /cancelled/);
  await new Promise(r => setTimeout(r, 150));
  await engine.cancel('cancel-me');
  await rejection;
  assert.equal(engine.children.size, 0);
});
test('playlist ve canlı yayınlar tek video olarak işlenmez', async () => {
  const engine = new Engine({ bin, runtime: process.execPath });
  engine.run = async () => ({ stdout: JSON.stringify({ _type: 'playlist', entries: [] }) });
  await assert.rejects(engine.inspect({ id: 'a', url: 'https://youtube.com/playlist?list=1' }), /playlist/);
  engine.run = async () => ({ stdout: JSON.stringify({ is_live: true }) });
  await assert.rejects(engine.inspect({ id: 'a', url: 'https://youtube.com/watch?v=1' }), /live/);
});
test('gerçek FFmpeg: video+ses, sessiz video, MP3, M4A, WAV ve MKV akışları', async () => {
  const dir = path.join(__dirname, '../test-output/conversion');
  await fs.mkdir(dir, { recursive: true });
  const source = path.join(dir, 'fixture.mkv');
  await exec(path.join(bin, 'ffmpeg.exe'), ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=160x90:rate=12', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=44100', '-t', '1.2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', source], { windowsHide: true });
  const inspect = async file => JSON.parse((await exec(path.join(bin, 'ffprobe.exe'), ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file], { windowsHide: true })).stdout);
  const probe = await inspect(source);
  for (const [mode, format, expected] of [['both', 'mp4', ['video', 'audio']], ['video', 'mp4', ['video']], ['audio', 'mp3', ['audio']], ['audio', 'm4a', ['audio']], ['audio', 'wav', ['audio']], ['both', 'mkv', ['video', 'audio']]]) {
    const output = path.join(dir, `${mode}.${format}`);
    await exec(path.join(bin, 'ffmpeg.exe'), conversionArgs({ mode, format, quality: mode === 'audio' ? '192' : 'best' }, source, output, probe), { windowsHide: true });
    const data = await inspect(output);
    assert.deepEqual(data.streams.map(s => s.codec_type), expected, `${mode}/${format}`);
    assert(Number(data.format.duration) > 1);
  }
});
test('indirme işlemi dosya çakışmasında eski dosyayı korur ve geçici alanı temizler', async () => {
  const dir = path.join(__dirname, '../test-output/pipeline');
  await fs.mkdir(dir, { recursive: true });
  const original = path.join(dir, 'test - ses.mp3');
  await fs.writeFile(original, 'eski dosya');
  const engine = new Engine({ bin, runtime: process.execPath });
  const run = engine.run.bind(engine);
  engine.run = async (id, exe, args, config) => {
    if (exe.endsWith('yt-dlp.exe')) {
      const stage = args[args.indexOf('-P') + 1], file = path.join(stage, 'source.wav');
      await exec(path.join(bin, 'ffmpeg.exe'), ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440', '-t', '0.3', '-y', file], { windowsHide: true });
      config.onLine('HEA_FILE:' + JSON.stringify(file));
      return { stdout: '' };
    }
    return run(id, exe, args, config);
  };
  const result = await engine.download({ id: 'pipeline', title: 'test', url: 'https://youtube.com/watch?v=1', options: { mode: 'audio', format: 'mp3', quality: '192' } }, dir);
  assert.notEqual(result.file, original);
  assert.equal(await fs.readFile(original, 'utf8'), 'eski dosya');
  assert(result.size > 0);
  assert(!await fs.stat(path.join(dir, '.hea-work')).catch(() => null));
});
