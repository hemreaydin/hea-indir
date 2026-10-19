const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const id = require('../app/extension-config.json').extensionId;
const token = 'a'.repeat(64);
const popup = { id, url: `chrome-extension://${id}/popup.html` };
const content = { id, url: 'https://example.com/watch', tab: { id: 1 }, frameId: 0 };
function harness(saved = {}) {
 const local = { ...saved }, session = {}, calls = [];
 let online = false, enabled = true, nativeMissing = false;
 const storage = data => ({ async get(keys) { if (keys == null) return {...data}; return Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,data[k]])); }, async set(value){Object.assign(data,value)}, async remove(key){delete data[key]}, async setAccessLevel(){} });
 const listener = { addListener(){} };
 const context = vm.createContext({ importScripts(){}, HeaMedia:require('../extension/media.js'), Map, Promise, Date, URL, AbortSignal, setTimeout, chrome: {
  runtime:{id,getURL:f=>`chrome-extension://${id}/${f}`,onMessage:listener,async sendNativeMessage(name,body){calls.push('native');assert.equal(name,'com.hea.indir');assert.equal(body.action,'start');if(nativeMissing)throw Error('not installed');online=true;return {ok:true,token};}},
  storage:{local:storage(local),session:storage(session)},webRequest:{onBeforeRequest:listener,onBeforeSendHeaders:listener,onHeadersReceived:listener},tabs:{onRemoved:listener,async get(){return{url:'https://example.com/watch',title:'Test'}}},alarms:{create(){},onAlarm:listener}
 }, async fetch(url, opts){
  const route=new URL(url).pathname;calls.push(route);if(!online)throw Error('offline');
  if(opts.headers.Authorization!=='Bearer '+token)return{ok:false,status:401,json:async()=>({error:'unauthorized'})};
  if(route==='/enabled')enabled=JSON.parse(opts.body).enabled;
  return {ok:true,json:async()=>route==='/status'?{enabled,protocol:2,jobs:[]}:{enabled,message:'queued'}};
 }});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../extension/background.js'),'utf8'),context);
 return {local,calls,context,run:async(message,sender=popup)=>context.handle({...message,tabId:1},sender),sync:()=>context.sync(true),stop:()=>{online=false},nativeMissing:()=>{nativeMissing=true}};
}
test('OFF survives worker restart, polling never starts a process, only popup may enable',async()=>{
 const h=harness();await h.sync();assert.equal((await h.run({type:'status'})).enabled,false);
 await assert.rejects(h.run({type:'toggle',enabled:true},content),/reddedildi/);
 assert(!h.calls.includes('native'));
 await assert.rejects(h.run({type:'page'}),/gönderilemiyor/);
 assert(!h.calls.includes('native'));
});
test('ON starts and pairs, OFF blocks requests, persisted ON restarts app only on download',async()=>{
 const h=harness();await h.sync();await h.run({type:'toggle',enabled:true});assert.equal(h.local.enabled,true);assert.equal(h.local.token,token);
 await h.run({type:'page'});assert(h.calls.includes('/download'));
 await h.run({type:'toggle',enabled:false});assert.equal(h.local.enabled,false);await assert.rejects(h.run({type:'page'}));
 const restart=harness({...h.local,enabled:true});await restart.sync();assert.equal((await restart.run({type:'status'})).enabled,true);assert(!restart.calls.includes('native'));
 await restart.run({type:'page'});assert.equal(restart.calls.filter(c=>c==='native').length,1);assert(restart.calls.includes('/download'));
});
test('missing installer leaves OFF and explains setup; OFF while app stopped never starts it',async()=>{
 const h=harness();await h.sync();h.nativeMissing();await assert.rejects(h.run({type:'toggle',enabled:true}),/Bir kez kurulum/);assert(!h.local.enabled);
 const off=harness({enabled:true,token});await off.sync();await off.run({type:'toggle',enabled:false});assert.equal(off.local.enabled,false);assert(!off.calls.includes('native'));
});
