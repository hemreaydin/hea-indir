const { test } = require('node:test');
const assert = require('node:assert/strict');
const { BrowserBridge } = require('../app/browser-bridge.cjs');
const { publicUrl, browserSource, contextArgs } = require('../app/web-source.cjs');
const { validateUrl, Engine } = require('../app/engine.cjs');
const media = require('../extension/media.js');
const config = require('../app/extension-config.json');

test('genel video sayfaları açılır; dosya/yerel adres ve sahte platform engellenir', () => {
  assert.equal(validateUrl('https://vimeo.com/123').platformKey, 'web');
  assert.equal(validateUrl('https://youtube.com.evil.org/a').platformKey, 'web');
  assert.equal(validateUrl('http://media.example.com/a.mp4').url, 'http://media.example.com/a.mp4');
  for (const u of ['http://127.0.0.1/a', 'http://2130706433/a', 'http://0x7f000001/a', 'http://192.168.1.2/a', 'http://[::1]/a', 'http://localhost/a', 'http://device.local/a', 'file:///C:/x', 'ftp://media.example.com/a', 'https://user:pass@example.com/a', 'https://example.com:1234/a']) assert.throws(() => publicUrl(u), u);
  const source = browserSource({ url:'https://cdn.example.com/a.m3u8', pageUrl:'https://example.com/watch', userAgent:'Chrome\r\nCookie: secret', title:'Film' });
  assert.equal(source.userAgent, '');
  assert.deepEqual(contextArgs(source), ['--referer', 'https://example.com/watch']);
  assert.throws(() => browserSource({ ...source, drm: true }), /DRM/);
});

test('video/manifest algılama parçaları eler ve aynı kaynağı tekilleştirir', () => {
  assert.equal(media.kind('https://cdn.example.com/master.m3u8?token=a'), 'HLS');
  assert.equal(media.kind('https://cdn.example.com/manifest', 'application/dash+xml'), 'DASH');
  assert.equal(media.kind('https://cdn.example.com/film.mp4'), 'Video');
  assert.equal(media.kind('https://cdn.example.com/segment-012.m4s', 'video/mp4'), '');
  assert.equal(media.kind('blob:https://example.com/foo', '', true), '');
  let items = media.merge([], { url: 'https://example.com/a.mp4', kind: 'Video' });
  const id = items[0].id;
  items = media.merge(items, { url: 'https://example.com/a.mp4', kind: 'Video', duration: 40 });
  assert.equal(items.length, 1); assert.equal(items[0].id, id); assert.equal(items[0].duration, 40);
});

test('tarayıcı köprüsü eşleştirme, origin/token doğrulama ve kapatma anahtarı', async t => {
  let enabled = true, received, saved;
  const bridge = new BrowserBridge({ extensionId: config.extensionId, port: 0, enabled: () => enabled, onPair: token => { saved = token; }, onDownload: data => { received = data; return { id: 'job' }; } });
  await bridge.start(); t.after(() => bridge.close());
  const base = `http://127.0.0.1:${bridge.port}`;
  const headers = { Origin: `chrome-extension://${config.extensionId}`, 'X-Hea-Client': config.extensionId, 'Content-Type': 'application/json' };
  let r = await fetch(base + '/status', { headers }); assert.equal(r.status, 401);
  r = await fetch(base + '/pair', { method: 'POST', headers: { ...headers, Origin:'https://example.com' }, body: JSON.stringify({ code:bridge.code }) }); assert.equal(r.status, 403);
  r = await fetch(base + '/pair', { method:'POST', headers, body:JSON.stringify({ code:'000000' }) }); assert.equal(r.status, 401);
  r = await fetch(base + '/pair', { method:'POST', headers, body:JSON.stringify({ code:bridge.code }) }); assert.equal(r.status, 200);
  const { token } = await r.json(); assert.equal(saved, token); assert.equal(bridge.status().paired, true); assert.equal(bridge.status().code, '');
  const auth = { ...headers, Authorization: 'Bearer ' + token };
  r = await fetch(base + '/status', { headers:auth }); assert.deepEqual(await r.json(), { enabled:true, version:'0.3.0' });
  const noOrigin = { ...auth }; delete noOrigin.Origin;
  assert.equal((await fetch(base + '/status', { headers:noOrigin })).status, 200);
  const data = { url:'https://cdn.example.com/a.mp4', pageUrl:'https://example.com/watch', title:'Film' };
  r = await fetch(base + '/download', { method:'POST', headers:auth, body:JSON.stringify(data) }); assert.equal(r.status, 200); assert.equal(received.url, data.url);
  enabled = false; received = null;
  r = await fetch(base + '/download', { method:'POST', headers:auth, body:JSON.stringify(data) }); assert.equal(r.status, 409); assert.equal(received, null);
  enabled = true;
  r = await fetch(base + '/download', { method:'POST', headers:auth, body:JSON.stringify({ ...data, url:'file:///C:/secret' }) }); assert.equal(r.status, 400);
  r = await fetch(base + '/download', { method:'POST', headers:auth, body:JSON.stringify({ ...data, drm:true }) }); assert.equal(r.status, 400);
  bridge.reset(); assert.equal(saved, ''); assert.equal((await fetch(base + '/status', { headers:auth })).status, 401);
});

test('eşleştirme kodu süresi ve deneme limiti uygulanır', async t => {
  const bridge = new BrowserBridge({ extensionId:config.extensionId, port:0, enabled:()=>true, onPair:()=>{}, onDownload:()=>{} });
  await bridge.start(); t.after(()=>bridge.close());
  const headers = { 'X-Hea-Client':config.extensionId, 'Content-Type':'application/json' };
  const send = code => fetch(`http://127.0.0.1:${bridge.port}/pair`, { method:'POST', headers, body:JSON.stringify({ code }) });
  bridge.expires = Date.now()-1; assert.equal((await send(bridge.code)).status, 401);
  bridge.newCode();
  for (let i=0;i<4;i++) assert.equal((await send('wrong')).status, 401);
  assert.equal((await send(bridge.code)).status, 429);
});

test('tarayıcı isteği referrer taşır; DRM metadata indirmeye geçirilmez', async () => {
  const engine = new Engine({ bin:'.', runtime:process.execPath });
  let args;
  engine.run = async (_id, _exe, received) => { args=received; return { stdout:JSON.stringify({ has_drm:true, formats:[{ has_drm:true }] }) }; };
  await assert.rejects(engine.inspect({ id:'a', url:'https://cdn.example.com/film.mpd', referrer:'https://example.com/watch' }), /DRM/);
  assert.equal(args[args.indexOf('--referer')+1], 'https://example.com/watch');
  engine.run = async () => ({ stdout:JSON.stringify({ id:'a', title:'opaque-file', url:'https://cdn.example.com/a.mp4' }) });
  assert.equal((await engine.inspect({ id:'a', url:'https://cdn.example.com/a.mp4', browserTitle:'Sayfadaki film' })).title, 'Sayfadaki film');
});
