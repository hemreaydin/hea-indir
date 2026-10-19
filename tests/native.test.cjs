const {test}=require('node:test');
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(repo,'native/Host.cs'),'utf8');
const tempRoot=path.join(repo,'test-output');fs.mkdirSync(tempRoot,{recursive:true});
const dir=fs.mkdtempSync(path.join(tempRoot,'native-test-'));
fs.mkdirSync(path.join(dir,'resources/native'),{recursive:true});
const csc=path.join(process.env.SystemRoot,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
function compile(file,out){cp.execFileSync(csc,['/nologo','/target:winexe','/reference:System.Web.Extensions.dll','/out:'+out,file],{windowsHide:true});}
function cs(value){return '"'+value.replaceAll('\\','\\\\').replaceAll('"','\\"')+'"';}
const state=path.join(dir,'state.json'), marker=path.join(dir,'launched.txt');
// Redirect only the OS state-directory lookup to an isolated fixture; protocol and fixed executable resolution remain unchanged.
fs.writeFileSync(path.join(dir,'Host.cs'),source.replace('Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "hea-indir", "state.json")',cs(state)));
compile(path.join(dir,'Host.cs'),path.join(dir,'resources/native/hea-native.exe'));
fs.writeFileSync(path.join(dir,'Fake.cs'),'using System.IO; class Fake { static void Main(string[] args) { File.WriteAllText('+cs(marker)+', string.Join(" ", args)); File.WriteAllText('+cs(state)+', '+cs(JSON.stringify({browser:{token:'a'.repeat(64)}}))+'); } }');
compile(path.join(dir,'Fake.cs'),path.join(dir,'hea-indir.exe'));
async function run(exe,origin,body){return new Promise((resolve,reject)=>{let chunks=[];const child=cp.spawn(exe,[origin],{windowsHide:true,stdio:['pipe','pipe','pipe']});const timer=setTimeout(()=>{child.kill();reject(Error('timeout'))},15000);child.stdout.on('data',c=>chunks.push(c));child.on('error',reject);child.on('close',code=>{clearTimeout(timer);let result=null;const data=Buffer.concat(chunks);if(data.length){assert.equal(data.readInt32LE(),data.length-4);result=JSON.parse(data.subarray(4).toString())}resolve({code,result})});child.stdin.on('error',()=>{});const bytes=Buffer.from(JSON.stringify(body)),length=Buffer.alloc(4);length.writeInt32LE(bytes.length);child.stdin.end(Buffer.concat([length,bytes]));})}
test('compiled Windows helper validates caller and payload, starts hidden and returns framed token', {skip:process.platform!=='win32',timeout:30000}, async t=>{t.after(()=>{assert.equal(path.dirname(dir),tempRoot);fs.rmSync(dir,{recursive:true,force:true});});const origin='chrome-extension://dknocgpgibkieijeipgfkaboiogddnbo/';const exe=path.join(dir,'resources/native/hea-native.exe');
 assert.equal((await run(exe,'https://example.com/',{action:'start'})).code,2);assert(!fs.existsSync(marker));
 let r=await run(exe,origin,{action:'start',url:'https://example.com'});assert.equal(r.result.ok,false);assert(!fs.existsSync(marker));
 r=await run(exe,origin,{action:'start'});assert.equal(r.result.ok,true);assert.equal(r.result.token,'a'.repeat(64));assert.equal(fs.readFileSync(marker,'utf8'),'--background');
 compile(path.join(repo,'native/Host.cs'),path.join(dir,'production-native.exe'));
 r=await run(path.join(dir,'production-native.exe'),origin,{action:'start'});assert.equal(r.result.ok,false);assert.match(r.result.error,/Windows paketini/);
 console.log('PASS: compiled native host origin/payload rejection, framed stdio, hidden app launch, token read, missing-package error');
});
