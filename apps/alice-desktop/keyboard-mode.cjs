const fs=require('node:fs'),path=require('node:path');
const {BrowserWindow,screen,Menu,powerMonitor}=require('electron');
const {KeyboardInput}=require('./keyboard-input.cjs');
const defaults={scope:'global',outfit:'winter',scale:100,intensity:60,mouse:false,paused:false,pinned:true,shortcuts:true};
function validSettings(value={}){
  const result={};for(const key of ['mouse','paused','pinned','shortcuts'])if(typeof value[key]==='boolean')result[key]=value[key];
  if(['global','local'].includes(value.scope))result.scope=value.scope;
  if(['winter','white','penguin'].includes(value.outfit))result.outfit=value.outfit;
  for(const [key,min,max]of [['scale',70,150],['intensity',0,100]])if(typeof value[key]==='number'&&Number.isFinite(value[key]))result[key]=Math.round(Math.max(min,Math.min(max,value[key])));
  return result;
}
class KeyboardMode {
  constructor({room,pet,profile,url,verify,secure,beforeEnter,appearance}){
    Object.assign(this,{room,pet,profile,url,verify,secure,beforeEnter,appearance});this.active=false;this.window=null;this.state='off';this.powerReasons=new Set();this.settings={...defaults};this.file=path.join(profile,'keyboard-mode.json');
    try{const saved=JSON.parse(fs.readFileSync(this.file,'utf8'));this.settings={...this.settings,...validSettings(saved.settings)};this.saved=saved.bounds;}catch{this.settings.outfit=appearance?.outfit||'winter';}
    this.input=new KeyboardInput({pulse:kind=>this.pulse(kind),status:status=>{this.state=status;this.notify();}});
    this.power={suspend:()=>this.powerPause('sleep',true),resume:()=>this.powerPause('sleep',false),'lock-screen':()=>this.powerPause('lock',true),'unlock-screen':()=>this.powerPause('lock',false)};
    for(const [name,handler]of Object.entries(this.power))powerMonitor.on(name,handler);
    this.displayChange=()=>{if(this.alive())this.resize();};for(const name of ['display-metrics-changed','display-removed','display-added'])screen.on(name,this.displayChange);
  }
  alive(){return this.window&&!this.window.isDestroyed();}
  info(){return {active:this.active,settings:{...this.settings},input:this.state,blocked:this.powerReasons.size>0,bounds:this.alive()?this.window.getBounds():null};}
  notify(){if(this.alive())this.window.webContents.send('alice:keyboard-state',this.info());this.pet?.notify();}
  bounds(){
    const current=this.alive()?this.window.getBounds():this.saved,valid=current&&['x','y','width','height'].every(k=>Number.isFinite(current[k]));
    const area=(valid?screen.getDisplayMatching(current):screen.getPrimaryDisplay()).workArea,s=this.settings.scale/100,width=Math.min(area.width,Math.round(368*s)),height=Math.min(area.height,Math.round(432*s));
    const x=valid?current.x+current.width-width:area.x+area.width-width-24,y=valid?current.y+current.height-height:area.y+area.height-height-20;
    return {x:Math.round(Math.max(area.x,Math.min(area.x+area.width-width,x))),y:Math.round(Math.max(area.y,Math.min(area.y+area.height-height,y))),width,height};
  }
  resize(){if(this.alive())this.window.setBounds(this.bounds());}
  async open(){
    if(this.opening)return this.opening;
    this.opening=(async()=>{
      if(!this.alive()){
        const win=new BrowserWindow({...this.bounds(),transparent:true,frame:false,hasShadow:false,backgroundColor:'#00000000',title:'有珠 · 键盘模式',show:false,skipTaskbar:true,resizable:false,alwaysOnTop:this.settings.pinned,webPreferences:{preload:path.join(__dirname,'keyboard-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:this.verify}});
        this.window=win;this.secure(win);win.on('page-title-updated',e=>e.preventDefault());
        win.on('close',e=>{if(!this.quitting){e.preventDefault();void this.exit('room');}});
        win.on('closed',()=>{this.input.stop();this.active=false;this.window=null;});
        win.on('moved',()=>this.persist());win.on('blur',()=>this.drag(false));
        win.on('hide',()=>{this.drag(false);this.input.stop();});
        await win.loadURL(this.url+'keyboard/index.html');
        const ready=await win.webContents.executeJavaScript('window.keyboardReady');if(!ready)throw Error('像素素材没有加载完成。');
      }
      this.beforeEnter?.();this.pet.suspendForKeyboard();this.active=true;
      if(!this.verify){this.window.showInactive();this.window.setAlwaysOnTop(this.settings.pinned);}
      this.syncInput();this.notify();this.pet.ensureTray();return this.info();
    })();
    try{return await this.opening;}catch(error){this.suspend();if(this.alive())this.window.destroy();this.room.show();throw error;}finally{this.opening=null;}
  }
  suspend(){this.active=false;this.drag(false);this.input.stop();this.state='off';this.notify();if(this.alive())this.window.hide();}
  async exit(mode='pet'){this.suspend();if(mode==='pet')await this.pet.open();else this.pet.restore();return this.info();}
  syncInput(){
    this.input.stop();if(!this.active||this.settings.paused||this.powerReasons.size){this.state=this.active?'paused':'off';this.notify();return;}
    if(this.settings.scope==='local'){this.state='local';this.notify();return;}
    this.input.start(this.settings.mouse);
  }
  pulse(kind){if(!this.active||this.settings.paused||this.powerReasons.size||!this.alive())return;if(kind==='mouse'&&this.window.isFocused())return;this.window.webContents.send('alice:keyboard-pulse',{kind});}
  save(patch){const next={...this.settings,...validSettings(patch)},restart=['scope','mouse','paused'].some(k=>next[k]!==this.settings[k]),resize=next.scale!==this.settings.scale;this.settings=next;if(this.alive()){this.window.setAlwaysOnTop(next.pinned);if(resize)this.resize();}if(restart)this.syncInput();this.notify();this.persist();return this.info();}
  persist(immediate=false){clearTimeout(this.saveTimer);this.saveTimer=null;const save=()=>{this.saveTimer=null;if(this.alive())this.saved=this.window.getBounds();fs.mkdirSync(this.profile,{recursive:true});fs.writeFileSync(this.file+'.tmp',JSON.stringify({settings:this.settings,bounds:this.saved}));fs.renameSync(this.file+'.tmp',this.file);};if(immediate)save();else this.saveTimer=setTimeout(save,250);}
  powerPause(reason,value){if(value)this.powerReasons.add(reason);else this.powerReasons.delete(reason);this.syncInput();}
  hit(value){if(this.active&&this.alive())this.window.setIgnoreMouseEvents(!value&&!this.dragging,{forward:true});}
  drag(value){
    clearInterval(this.dragTimer);this.dragging=null;if(!value||!this.active||!this.alive())return;
    const start=screen.getCursorScreenPoint(),b=this.window.getBounds();this.dragging={start,b};this.hit(true);
    this.dragTimer=setInterval(()=>{if(!this.dragging||!this.alive())return;const p=screen.getCursorScreenPoint(),area=screen.getDisplayNearestPoint(p).workArea;this.window.setPosition(Math.round(Math.max(area.x,Math.min(area.x+area.width-b.width,b.x+p.x-start.x))),Math.round(Math.max(area.y,Math.min(area.y+area.height-b.height,b.y+p.y-start.y))));},16);
  }
  menuItems(){return [{label:'有珠 · 像素键盘模式',enabled:false},{label:this.settings.paused?'继续响应':'暂停响应',click:()=>this.save({paused:!this.settings.paused})},{label:'全局打字响应',type:'checkbox',checked:this.settings.scope==='global',click:()=>this.save({scope:this.settings.scope==='global'?'local':'global'})},{type:'separator'},{label:'返回普通桌宠',click:()=>this.exit('pet')},{label:'返回冬日小室',click:()=>this.exit('room')},{type:'separator'},{label:'退出程序',click:()=>require('electron').app.quit()}];}
  menu(){if(this.alive())Menu.buildFromTemplate(this.menuItems()).popup({window:this.window});}
  close(){this.quitting=true;if(this.saveTimer)this.persist(true);this.suspend();for(const [name,handler]of Object.entries(this.power))powerMonitor.removeListener(name,handler);for(const name of ['display-metrics-changed','display-removed','display-added'])screen.removeListener(name,this.displayChange);if(this.alive())this.window.destroy();}
}
module.exports={KeyboardMode,validSettings};
