const fs=require('node:fs'),path=require('node:path');
const {BrowserWindow,screen,Tray,Menu,powerMonitor}=require('electron');
const {EdgePeek,scaledBounds,scaleLimits,nearestEdge,dockPosition,dockLayout,EDGE_HANDLE_HEIGHT}=require('./pet-edge-state.cjs');
function fitBounds(bounds,area){const valid=(value,fallback)=>Number.isFinite(value)?value:fallback,width=Math.min(area.width,Math.max(240,Math.min(760,Math.round(valid(bounds.width,380))))),height=Math.min(area.height,Math.max(380,Math.min(1300,Math.round(valid(bounds.height,650)))));return {x:Math.round(Math.max(area.x,Math.min(valid(bounds.x,area.x+area.width-width-16),area.x+area.width-width))),y:Math.round(Math.max(area.y,Math.min(valid(bounds.y,area.y+area.height-height),area.y+area.height-height))),width,height};}
class DesktopPet{
  constructor({room,profile,url,webPreferences,verify,secure,beforeSwitch}){
    Object.assign(this,{room,profile,url,webPreferences,verify,secure,beforeSwitch});
    this.window=null;this.tray=null;this.drag=null;this.ignoring=false;this.quitting=false;this.boundsFile=path.join(profile,'pet-window.json');this.pinned=true;this.roomActive=true;this.scaleFactor=1;this.edge=new EdgePeek();this.dockPositions={left:null,right:null};this.edgeDragging=false;this.screenPaused=false;this.activityAt=0;this.activityBusy=true;
    this.displayChanged=()=>this.reflow();this.pauseReasons=new Set();this.powerHandlers={suspend:()=>this.powerPause('sleep',true),resume:()=>this.powerPause('sleep',false),'lock-screen':()=>this.powerPause('lock',true),'unlock-screen':()=>this.powerPause('lock',false)};
    for(const event of ['display-metrics-changed','display-removed','display-added'])screen.on(event,this.displayChanged);
    for(const [event,handler] of Object.entries(this.powerHandlers))powerMonitor.on(event,handler);
  }
  area(bounds){return bounds?screen.getDisplayMatching(bounds).workArea:screen.getPrimaryDisplay().workArea;}
  alive(){return this.window&&!this.window.isDestroyed();}
  dockedLayout(bounds=this.freeBounds){const area=this.area(bounds),side=this.edge.side,position=this.dockPositions[side]??dockPosition(bounds.y+bounds.height*.24+EDGE_HANDLE_HEIGHT/2,area);return dockLayout(bounds,area,side,position);}
  dockedBounds(bounds=this.freeBounds){return this.dockedLayout(bounds).bounds;}
  place(bounds,{resize=true}={}){
    const display=screen.getDisplayMatching(bounds),area=display.workArea,origin=display.bounds,factor=display.scaleFactor;
    // Align integer DIPs to whole physical pixels. At 150% DPI, moving an odd
    // DIP using Electron setPosition repeatedly can grow a frameless window.
    // Keep an explicit size and use a full rectangle on every animation step.
    let grid=1;for(let n=1;n<=16;n++)if(Math.abs(factor*n-Math.round(factor*n))<.00001){grid=n;break;}
    const desired=resize?bounds:(this.nativeSize||bounds),width=Math.min(Math.floor(area.width/grid)*grid,Math.max(grid,Math.round(desired.width/grid)*grid)),height=Math.min(Math.floor(area.height/grid)*grid,Math.max(grid,Math.round(desired.height/grid)*grid));
    const align=(value,start,min,max)=>Math.max(start+Math.ceil((min-start)/grid)*grid,Math.min(start+Math.floor((max-start)/grid)*grid,start+Math.round((value-start)/grid)*grid));
    const x=align(bounds.x,origin.x,area.x,area.x+area.width-width),y=align(bounds.y,origin.y,area.y,area.y+area.height-height);
    this.nativeSize={width,height};this.window.setBounds({x,y,width,height});
    return this.window.getBounds();
  }
  async open(){
    if(this.opening)return this.opening;if(this.alive()){this.activate();return this.info();}
    this.opening=(async()=>{
      let saved={};try{saved=JSON.parse(fs.readFileSync(this.boundsFile,'utf8'));}catch{}
      for(const side of ['left','right']){const value=saved.dockPositions?.[side];this.dockPositions[side]=typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):null;}
      this.pinned=saved.pinned!==false;const area=this.area(saved.bounds),initial=fitBounds(saved.bounds||{},area),sized=scaledBounds(initial,Number.isFinite(saved.scale)?saved.scale:initial.width/380,area);this.scaleFactor=sized.scale;this.freeBounds=sized.bounds;
      if(saved.dockSide==='left'||saved.dockSide==='right'){this.edge.dock(saved.dockSide);this.edge.pause();}else this.edge.recall();
      const bounds=this.edge.side?this.dockedBounds():this.freeBounds;
      const pet=new BrowserWindow({...bounds,title:'有珠 · 桌宠',transparent:true,frame:false,backgroundColor:'#00000000',hasShadow:false,alwaysOnTop:this.pinned,skipTaskbar:true,resizable:false,show:false,autoHideMenuBar:true,webPreferences:{...this.webPreferences}});this.window=pet;const actual=this.place(bounds);this.freeBounds=fitBounds({...this.freeBounds,width:actual.width,height:actual.height},area);this.secure(pet);
      pet.on('page-title-updated',event=>event.preventDefault());pet.on('close',event=>{if(!this.quitting){event.preventDefault();this.restore();}});pet.on('closed',()=>{this.cancelMotion();clearTimeout(this.edgeTimer);this.window=null;});
      pet.on('moved',()=>{if(!this.edge.side&&!this.motion&&!this.drag)this.freeBounds=pet.getBounds();this.persist();});
      const ready=new Promise((resolve,reject)=>{this.readyResolve=resolve;this.readyReject=reject;this.readyTimer=setTimeout(()=>reject(Error('桌宠模型加载超时，请重试。')),25000);});ready.catch(()=>{});
      await pet.loadURL(this.url+'?mode=pet');await ready;clearTimeout(this.readyTimer);this.activate();return this.info();
    })();try{return await this.opening;}catch(error){clearTimeout(this.readyTimer);if(this.alive())this.window.destroy();this.window=null;this.restore();throw error;}finally{this.opening=null;}
  }
  ready(sender){if(sender===this.window?.webContents){this.readyResolve?.();this.readyResolve=null;}}
  activate(){
    this.beforeSwitch?.();this.roomActive=false;this.room.webContents.send('alice:view-active',false);this.room.hide();
    if(!this.verify){if(this.edge.side)this.window.showInactive();else{this.window.show();this.window.focus();}}
    if(!this.screenPaused)this.edge.resume();this.hit(false);this.window.webContents.send('alice:view-active',true);this.window.webContents.send('alice:session-refresh');this.notify();this.armEdge();this.ensureTray();
  }
  restore(){
    this.beforeSwitch?.();this.endEdgeDrag({resume:false});this.endDrag({dock:false});this.cancelMotion();this.edge.pause();clearTimeout(this.edgeTimer);this.roomActive=true;
    if(this.alive()){this.window.webContents.send('alice:view-active',false);this.window.hide();this.notify();}
    if(!this.room.isDestroyed()){if(!this.verify){this.room.show();this.room.restore();this.room.focus();}this.room.webContents.send('alice:view-active',true);this.room.webContents.send('alice:session-refresh');}this.persist();return this.info();
  }
  suspendForKeyboard(){
    this.endEdgeDrag({resume:false});this.endDrag({dock:false});this.cancelMotion();clearTimeout(this.edgeTimer);this.edge.pause();
    this.roomActive=true;this.room.webContents.send('alice:view-active',false);this.room.hide();
    if(this.alive()){this.window.webContents.send('alice:view-active',false);this.window.hide();}
  }
  info(){const bounds=this.alive()?this.window.getBounds():null,layout=this.edge.side&&this.freeBounds?this.dockedLayout():null,anchorY=layout&&bounds?Math.max(EDGE_HANDLE_HEIGHT/2,Math.min(bounds.height-EDGE_HANDLE_HEIGHT/2,layout.centerY-bounds.y)):null;return {mode:this.roomActive?'room':'pet',bounds,pinned:this.pinned,ignoring:this.ignoring,dragging:Boolean(this.drag),scale:this.scaleFactor,scaleLimits:scaleLimits(this.area(this.freeBounds)),edge:{...this.edge.snapshot(),dragging:this.edgeDragging,position:layout?.position??null,travel:layout?.travel??0,anchorY}};}
  notify(message){if(this.alive())this.window.webContents.send('alice:pet-state',{...this.info(),...(message?{message}:{})});if(this.tray&&!this.tray.isDestroyed())this.tray.setContextMenu(Menu.buildFromTemplate(this.items()));}
  persist(immediate=false){
    clearTimeout(this.saveTimer);if(!this.alive())return;
    const save=()=>{if(!this.alive())return;fs.mkdirSync(this.profile,{recursive:true});const staged=this.boundsFile+'.tmp';fs.writeFileSync(staged,JSON.stringify({bounds:this.freeBounds||this.window.getBounds(),pinned:this.pinned,scale:this.scaleFactor,dockSide:this.edge.side,dockPositions:this.dockPositions}));fs.renameSync(staged,this.boundsFile);};
    if(immediate)save();else this.saveTimer=setTimeout(save,250);
  }
  hit(interactive){if(!this.alive()||this.roomActive)return;const ignore=!interactive&&!this.drag&&!this.edgeDragging;if(ignore!==this.ignoring){this.window.setIgnoreMouseEvents(ignore,{forward:true});this.ignoring=ignore;}}
  reportActivity(busy){this.activityAt=Date.now();this.activityBusy=busy===true;}
  busy(){return this.edgeDragging||this.activityBusy||Date.now()-this.activityAt>10000;}
  startEdgeDrag(){if(!this.alive()||this.roomActive||!this.edge.side||this.screenPaused)return this.info();this.edgeDragging=true;this.cancelMotion();clearTimeout(this.edgeTimer);this.edge.pause();this.place(this.dockedBounds(),{resize:false});this.hit(true);this.notify();return this.info();}
  setDockPosition(position){
    if(typeof position!=='number'||!Number.isFinite(position))throw Error('侧边位置无效。');if(!this.alive()||this.roomActive||!this.edge.side)return this.info();
    this.dockPositions[this.edge.side]=Math.max(0,Math.min(1,position));this.cancelMotion();const actual=this.place(this.dockedBounds(),{resize:false});this.freeBounds={...this.freeBounds,y:actual.y};if(!this.edgeDragging&&!this.screenPaused&&this.edge.phase==='hidden'){this.edge.resume();this.armEdge();}this.notify();this.persist();return this.info();
  }
  endEdgeDrag({resume=true}={}){if(!this.edgeDragging)return this.info();this.edgeDragging=false;if(resume&&!this.screenPaused&&!this.roomActive){this.edge.resume();this.armEdge();}this.notify();this.persist();return this.info();}
  cancelMotion(){if(this.motion){clearInterval(this.motion.timer);this.motion.resolve(false);this.motion=null;}}
  animateBounds(target,duration=360){
    this.cancelMotion();if(!this.alive())return Promise.resolve(false);const start=this.window.getBounds(),at=Date.now();
    return new Promise(resolve=>{const motion={resolve,timer:null};this.motion=motion;const update=()=>{if(!this.alive()){this.cancelMotion();return;}const t=Math.min(1,(Date.now()-at)/duration),e=t*t*(3-2*t),next={};for(const key of ['x','y','width','height'])next[key]=Math.round(start[key]+(target[key]-start[key])*e);this.place(next,{resize:false});if(t===1){clearInterval(motion.timer);if(this.motion===motion)this.motion=null;resolve(true);}};motion.timer=setInterval(update,16);update();});
  }
  startDrag(){
    if(!this.alive()||this.roomActive)return;if(this.edge.side){void this.recall();return;}
    this.endDrag({dock:false});this.cancelMotion();const cursor=screen.getCursorScreenPoint(),bounds=this.window.getBounds();this.drag={cursor,bounds};this.hit(true);
    this.dragTimer=setInterval(()=>{if(!this.drag||!this.alive())return;const p=screen.getCursorScreenPoint(),b=this.drag.bounds,next=fitBounds({...b,x:b.x+p.x-this.drag.cursor.x,y:b.y+p.y-this.drag.cursor.y},this.area({x:p.x,y:p.y,width:1,height:1})),current=this.window.getBounds();if(current.x!==next.x||current.y!==next.y)this.place(next,{resize:false});},16);
  }
  endDrag({dock=true}={}){
    clearInterval(this.dragTimer);const before=this.drag?.bounds,current=this.alive()?this.window.getBounds():null,moved=before&&current&&Math.hypot(current.x-before.x,current.y-before.y)>6;this.drag=null;
    if(moved&&this.alive()&&!this.edge.side){this.freeBounds=this.window.getBounds();const side=nearestEdge(this.freeBounds,this.area(this.freeBounds));if(dock&&side&&!this.roomActive){void this.dock(side);return;}}
    this.persist();
  }
  async dock(side='nearest'){
    if(!this.alive()||this.roomActive)return this.info();this.endEdgeDrag({resume:false});this.endDrag({dock:false});if(!this.edge.side)this.freeBounds=this.window.getBounds();
    const area=this.area(this.freeBounds);if(side==='nearest'){const b=this.window.getBounds();side=b.x+b.width/2<area.x+area.width/2?'left':'right';}
    if(this.dockPositions[side]===null)this.dockPositions[side]=dockPosition(this.freeBounds.y+this.freeBounds.height*.24+EDGE_HANDLE_HEIGHT/2,area);
    this.edge.dock(side);this.notify();this.armEdge();this.persist();if(!this.verify)this.window.blur();await this.animateBounds(this.dockedBounds());this.notify();return this.info();
  }
  async recall(){
    if(!this.alive()||this.roomActive)return this.info();this.endEdgeDrag({resume:false});const wasDocked=Boolean(this.edge.side);this.edge.recall();clearTimeout(this.edgeTimer);this.notify();
    if(wasDocked)await this.animateBounds(fitBounds(this.freeBounds,this.area(this.freeBounds)));if(!this.verify&&this.alive()&&!this.roomActive&&!this.edge.side&&!this.quitting){this.window.show();this.window.focus();}this.persist();return this.info();
  }
  peekNow(variant='auto'){if(this.edge.peek({busy:this.busy(),variant})){this.notify();this.armEdge();return true;}return false;}
  armEdge(){
    clearTimeout(this.edgeTimer);if(!this.alive()||this.roomActive||this.screenPaused||this.edge.paused||!this.edge.nextAt)return;
    this.edgeTimer=setTimeout(()=>{if(!this.alive()||this.roomActive||this.screenPaused)return;const changed=this.edge.tick({busy:this.busy()});if(changed)this.notify();this.armEdge();},Math.max(1,this.edge.nextAt-Date.now()));this.edgeTimer.unref();
  }
  powerPause(reason,value){if(value)this.pauseReasons.add(reason);else this.pauseReasons.delete(reason);this.setPaused(this.pauseReasons.size>0);}
  setPaused(value){this.screenPaused=value;clearTimeout(this.edgeTimer);if(value){this.endEdgeDrag({resume:false});this.edge.pause();if(this.edge.side&&this.alive()){this.cancelMotion();this.place(this.dockedBounds());}}else if(!this.roomActive){this.reflow();this.edge.resume();this.armEdge();}this.notify();}
  reflow(){
    if(!this.alive())return;this.endEdgeDrag();this.cancelMotion();const area=this.area(this.freeBounds),sized=scaledBounds(fitBounds(this.freeBounds,area),this.scaleFactor,area);this.scaleFactor=sized.scale;const actual=this.place(this.edge.side?this.dockedBounds(sized.bounds):sized.bounds);this.freeBounds=this.edge.side?fitBounds({...sized.bounds,width:actual.width,height:actual.height},area):actual;this.notify();this.persist();
  }
  scale(factor){
    if(!this.alive())return this.info();this.cancelMotion();const b=this.edge.side?this.freeBounds:this.window.getBounds(),area=this.area(b),sized=scaledBounds(b,factor,area);this.scaleFactor=sized.scale;const actual=this.place(this.edge.side?this.dockedBounds(sized.bounds):sized.bounds);this.freeBounds=this.edge.side?fitBounds({...sized.bounds,width:actual.width,height:actual.height},area):actual;this.notify();this.persist();return this.info();
  }
  togglePin(){this.pinned=!this.pinned;this.window?.setAlwaysOnTop(this.pinned);this.persist();this.notify();return this.pinned;}
  async showControls(){await this.recall();this.window?.webContents.send('alice:pet-settings','size');}
  items(){if(this.keyboardMode?.active)return this.keyboardMode.menuItems();return [{label:'切换像素键盘模式',click:()=>this.keyboardMode?.open()},{label:'返回冬日小室',click:()=>this.restore()},{label:'显示／收起对话',click:async()=>{await this.recall();this.window?.webContents.send('alice:pet-chat-toggle');}},{label:'记忆与存档',click:async()=>{await this.recall();this.window?.webContents.send('alice:pet-settings','memory');}},{label:'对话设置',click:async()=>{await this.recall();this.window?.webContents.send('alice:pet-settings','api');}},{label:'举书动作预览',click:async()=>{await this.recall();this.window?.webContents.send('alice:pet-reaction');}},{type:'separator'},{label:'大小与侧边…',click:()=>this.showControls()},{label:'藏到左侧',click:()=>this.dock('left')},{label:'藏到右侧',click:()=>this.dock('right')},{label:'唤回桌宠',enabled:Boolean(this.edge.side),click:()=>this.recall()},{label:'偷看一次',enabled:Boolean(this.edge.side),click:()=>this.peekNow()},{label:'企鹅服探头一次',enabled:Boolean(this.edge.side),click:()=>this.peekNow('penguin')},{label:'原衣装偷看一次',enabled:Boolean(this.edge.side),click:()=>this.peekNow('original')},{label:'保持置顶',type:'checkbox',checked:this.pinned,click:()=>this.togglePin()},{type:'separator'},{label:'退出程序',click:()=>require('electron').app.quit()}];}
  menu(){if(this.alive())Menu.buildFromTemplate(this.items()).popup({window:this.window});}
  ensureTray(){if(this.verify||this.tray)return;this.tray=new Tray(path.join(__dirname,'icon.ico'));this.tray.setToolTip('有珠 · 桌宠（双击返回小室）');this.tray.setContextMenu(Menu.buildFromTemplate(this.items()));this.tray.on('double-click',()=>this.restore());this.tray.on('right-click',()=>this.tray.setContextMenu(Menu.buildFromTemplate(this.items())));}
  close(){
    this.quitting=true;this.endEdgeDrag({resume:false});this.endDrag({dock:false});this.persist(true);clearTimeout(this.saveTimer);clearTimeout(this.edgeTimer);clearTimeout(this.readyTimer);this.cancelMotion();
    for(const event of ['display-metrics-changed','display-removed','display-added'])screen.removeListener(event,this.displayChanged);
    for(const [event,handler] of Object.entries(this.powerHandlers))powerMonitor.removeListener(event,handler);
    this.tray?.destroy();if(this.alive())this.window.destroy();
  }
}
module.exports={DesktopPet,fitBounds};
