import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import extract from 'extract-zip';
const root = path.resolve(import.meta.dirname, '..');
const bin = path.join(root, 'bin');
await fs.mkdir(bin, { recursive: true });
await fs.mkdir(path.join(root, 'licenses'), { recursive: true });
async function get(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!res.ok) throw new Error(`${res.status}: ${url}`);
  return Buffer.from(await res.arrayBuffer());
}
const release = JSON.parse((await get('https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest')).toString());
const base = `https://github.com/yt-dlp/yt-dlp/releases/download/${release.tag_name}/`;
console.log(`yt-dlp ${release.tag_name} indiriliyor…`);
const [exe, sums] = await Promise.all([get(base + 'yt-dlp.exe'), get(base + 'SHA2-256SUMS')]);
const expected = sums.toString().split('\n').find(line => /\s+\*?yt-dlp\.exe\s*$/.test(line))?.split(/\s+/)[0];
const actual = crypto.createHash('sha256').update(exe).digest('hex');
if (!expected || actual !== expected) throw new Error('yt-dlp SHA256 doğrulaması başarısız.');
await fs.writeFile(path.join(bin, 'yt-dlp.exe'), exe);
console.log('FFmpeg ve FFprobe indiriliyor…');
const ffmpegUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
const [ffmpegZip, ffmpegSums] = await Promise.all([get(ffmpegUrl), get(ffmpegUrl + '.sha256')]);
const ffmpegHash = crypto.createHash('sha256').update(ffmpegZip).digest('hex');
if (ffmpegHash !== ffmpegSums.toString().trim().split(/\s+/)[0].toLowerCase()) throw new Error('FFmpeg SHA256 doğrulaması başarısız.');
const cache = path.join(root, '.tools-cache');
await fs.mkdir(cache, { recursive: true });
const archive = path.join(cache, 'ffmpeg.zip'), unpacked = path.join(cache, 'ffmpeg-' + ffmpegHash.slice(0, 12));
await fs.writeFile(archive, ffmpegZip);
await extract(archive, { dir: unpacked });
const ffmpegDir = (await fs.readdir(unpacked)).find(name => /^ffmpeg-.+-essentials_build$/.test(name));
if (!ffmpegDir) throw new Error('FFmpeg arşiv yapısı tanınmadı.');
for (const name of ['ffmpeg.exe', 'ffprobe.exe']) await fs.copyFile(path.join(unpacked, ffmpegDir, 'bin', name), path.join(bin, name));
await fs.copyFile(path.join(unpacked, ffmpegDir, 'LICENSE'), path.join(root, 'licenses/FFmpeg-LICENSE.txt'));
await fs.copyFile(path.join(unpacked, ffmpegDir, 'README.txt'), path.join(root, 'licenses/FFmpeg-BUILD.txt'));
for (const [name, url] of Object.entries({
  'yt-dlp-LICENSE': 'https://raw.githubusercontent.com/yt-dlp/yt-dlp/' + release.tag_name + '/LICENSE',
  'yt-dlp-THIRD-PARTY.txt': 'https://raw.githubusercontent.com/yt-dlp/yt-dlp/' + release.tag_name + '/THIRD_PARTY_LICENSES.txt',
  'GPL-3.0.txt': 'https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/COPYING.GPLv3',
  'GPL-2.0.txt': 'https://raw.githubusercontent.com/FFmpeg/FFmpeg/master/COPYING.GPLv2'
})) await fs.writeFile(path.join(root, 'licenses', name), await get(url));
await fs.writeFile(path.join(bin, 'versions.json'), JSON.stringify({ ytdlp: release.tag_name, sha256: actual, ffmpeg: ffmpegDir, ffmpegSha256: ffmpegHash }, null, 2));
console.log('İndirme araçları hazır; yt-dlp SHA256 doğrulandı.');
