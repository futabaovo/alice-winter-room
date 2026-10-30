const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm');
const {EventEmitter}=require('events');
function host(profile){
  const powerMonitor=new EventEmitter(),screen=new EventEmitter();screen.getDisplayMatching=screen.getPrimaryDisplay=()=>({workArea:{x:0,y:0,width:1920,height:1080}});
  const box={x:20,y:30,width:368,height:432},win={isDestroyed:()=>false,getBounds:()=>({...box}),setBounds:b=>Object.assign(box,b),setAlwaysOnTop(){},hide(){},destroy(){},webContents:{send(){}}};
  const sandbox={module:{exports:{}},require:id=>id==='electron'?{powerMonitor,screen}:id==='./keyboard-input.cjs'?{KeyboardInput:class{stop(){}}}:require(id),__dirname,clearTimeout,setTimeout,clearInterval,setInterval};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'keyboard-mode.cjs'),'utf8'),sandbox);
  const k=new sandbox.module.exports.KeyboardMode({profile,pet:{notify(){}},room:{},appearance:{outfit:'winter'}});k.window=win;return k;
}
test('closing immediately after changing keyboard settings flushes settings and final bounds',()=>{
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'alice-keyboard-persist-'));
  try{const k=host(profile);k.save({scale:123,outfit:'white',scope:'local'});const bounds=k.window.getBounds();k.close();const saved=JSON.parse(fs.readFileSync(path.join(profile,'keyboard-mode.json'),'utf8'));assert.equal(saved.settings.scale,123);assert.equal(saved.settings.outfit,'white');assert.deepEqual(saved.bounds,bounds);assert.equal(k.saveTimer,null);}finally{fs.rmSync(profile,{recursive:true,force:true});}
});
