const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs/promises');
const { promisify } = require('node:util');
const exec = promisify(require('node:child_process').execFile);
const { Engine } = require('../app/engine.cjs');

test('gerçek yt-dlp + FFmpeg ile HLS ve DASH akışları dosyaya dönüşür', {timeout:60000}, async t => {
  const root = path.join(__dirname, '../test-output/streams');
  const bin = path.join(__dirname, '../bin');
  await fs.mkdir(root, {recursive:true});
  const fixture = path.join(root, 'fixture.mp4');
  await exec(path.join(bin,'ffmpeg.exe'),['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','testsrc=size=160x90:rate=12','-f','lavfi','-i','sine=frequency=440','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-g','12','-c:a','aac',fixture],{windowsHide:true});
  await exec(path.join(bin,'ffmpeg.exe'),['-hide_banner','-loglevel','error','-y','-i',fixture,'-c','copy','-hls_time','1','-hls_list_size','0','-hls_playlist_type','vod',path.join(root,'film.m3u8')],{windowsHide:true});
  await exec(path.join(bin,'ffmpeg.exe'),['-hide_banner','-loglevel','error','-y','-i',fixture,'-c','copy','-f','dash','film.mpd'],{windowsHide:true,cwd:root});
  const server = http.createServer(async(req,res)=>{try{const file=path.join(root,path.basename(new URL(req.url,'http://localhost').pathname));res.setHeader('Content-Type',file.endsWith('.m3u8')?'application/vnd.apple.mpegurl':file.endsWith('.mpd')?'application/dash+xml':'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  t.after(()=>{server.closeAllConnections();server.close();});
  const engine = new Engine({bin,runtime:process.execPath});
  const run = engine.run.bind(engine);
  // Isolated transport fixture: production validation continues to reject local IP URLs.
  engine.run = (id,exe,args,options)=>run(id,exe,args.map(a=>a.startsWith('https://stream.example.com/')?a.replace('https://stream.example.com',`http://127.0.0.1:${server.address().port}`):a),options);
  for(const ext of ['m3u8','mpd']) {
    const job={id:ext,url:`https://stream.example.com/film.${ext}`,title:`Test ${ext}`,options:{mode:'both',format:'mp4',quality:'best'}};
    Object.assign(job,await engine.inspect(job));
    const result=await engine.download(job,path.join(root,'results'));
    const probe=JSON.parse((await exec(path.join(bin,'ffprobe.exe'),['-v','error','-show_streams','-show_format','-of','json',result.file],{windowsHide:true})).stdout);
    assert.deepEqual(probe.streams.map(s=>s.codec_type),['video','audio']);
    assert(Number(probe.format.duration)>=1.9); assert(result.size>1000);
  }
});
