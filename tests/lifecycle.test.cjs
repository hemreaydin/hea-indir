const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const vm=require('node:vm');const {EventEmitter}=require('node:events');const {createRequire}=require('node:module');
const main=path.resolve(__dirname,'../app/main.cjs'),realRequire=createRequire(main);
function createApp(profile,background){
 let win,tray,exitCount=0;
 const app=Object.assign(new EventEmitter(),{isPackaged:false,requestSingleInstanceLock:()=>true,setPath(){},getPath:key=>key==='userData'?profile:path.join(profile,'downloads'),getVersion:()=> '0.4.0',whenReady:()=>Promise.resolve(),setAppUserModelId(){},quit(){exitCount++;app.emit('before-quit')}});
 class Window extends EventEmitter {constructor(){super();win=this;this.visible=false;this.webContents=Object.assign(new EventEmitter(),{send(){},setWindowOpenHandler(){}})}setMenu(){}loadFile(){setImmediate(()=>this.emit('ready-to-show'))}show(){this.visible=true}hide(){this.visible=false}isVisible(){return this.visible}isMinimized(){return false}isDestroyed(){return false}focus(){}setProgressBar(){}close(){let prevented=false;this.emit('close',{preventDefault(){prevented=true}});return prevented}}
 class Tray extends EventEmitter {constructor(){super();tray=this}setToolTip(){}setContextMenu(menu){this.menu=menu}destroy(){this.destroyed=true}}
 class Bridge {constructor(options){Object.assign(this,options);this.code='123456'}start(){return Promise.resolve()}status(){return {ready:true}}close(){this.closed=true} }
 const electron={app,BrowserWindow:Window,Tray,Menu:{buildFromTemplate:x=>x},ipcMain:{handle(){}},dialog:{showErrorBox:(_title,message)=>{throw Error(message)},showMessageBox:async()=>({response:0})},session:{defaultSession:{setPermissionRequestHandler(){},setPermissionCheckHandler(){}}},nativeTheme:{}};
 const context=vm.createContext({require:name=>name==='electron'?electron:name==='./browser-bridge.cjs'?{BrowserBridge:Bridge}:realRequire(name),__dirname:path.dirname(main),process:{...process,argv:background?['electron','--background']:['electron'],env:{...process.env,HEA_TEST_PROFILE:profile}},setImmediate,console,URL});
 vm.runInContext(fs.readFileSync(main,'utf8'),context,{filename:main});
 return {app,context,get window(){return win},get tray(){return tray},get exits(){return exitCount}};
}
test('background startup stays hidden, X preserves work, ordinary reopen shows, explicit quit closes bridge',async t=>{
 const profile=fs.mkdtempSync(path.join(fs.mkdirSync(path.join(__dirname,'../test-output'),{recursive:true}) || path.join(__dirname,'../test-output'),'hea-lifecycle-'));t.after(()=>fs.rmSync(profile,{recursive:true,force:true}));
 const h=createApp(profile,true);await new Promise(setImmediate);await new Promise(setImmediate);
 assert.equal(h.window.visible,false);assert.match(JSON.parse(fs.readFileSync(path.join(profile,'state.json'))).browser.token,/^[a-f0-9]{64}$/);
 h.app.emit('second-instance',{},[]);assert.equal(h.window.visible,true);assert.equal(h.window.close(),true);assert.equal(h.window.visible,false);assert.equal(h.exits,0);
 h.app.emit('second-instance',{},['--background']);assert.equal(h.window.visible,false);
 h.tray.menu[0].click();assert.equal(h.window.visible,true);
 await h.tray.menu[2].click();assert.equal(h.exits,1);assert.equal(h.tray.destroyed,true);assert.equal(vm.runInContext('bridge.closed && quitting',h.context),true);
});
test('normal startup stays visible and existing user settings survive background pairing',async t=>{
 const profile=fs.mkdtempSync(path.join(fs.mkdirSync(path.join(__dirname,'../test-output'),{recursive:true}) || path.join(__dirname,'../test-output'),'hea-lifecycle-'));t.after(()=>fs.rmSync(profile,{recursive:true,force:true}));
 fs.writeFileSync(path.join(profile,'state.json'),JSON.stringify({outputDir:path.join(profile,'saved'),theme:'light',browser:{enabled:false,token:''},defaults:{mode:'audio',format:'mp3',quality:'best'},jobs:[]}));
 const h=createApp(profile,false);await new Promise(setImmediate);await new Promise(setImmediate);assert.equal(h.window.visible,true);
 h.app.emit('second-instance',{},['--background']);const saved=JSON.parse(fs.readFileSync(path.join(profile,'state.json')));assert.equal(saved.outputDir,path.join(profile,'saved'));assert.equal(saved.browser.enabled,false);assert.equal(saved.defaults.mode,'audio');assert.match(saved.browser.token,/^[a-f0-9]{64}$/);h.app.quit();
});
