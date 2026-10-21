const { app, BrowserWindow, ipcMain, dialog, safeStorage, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { startServer } = require('./server.cjs');
const { VoiceHost } = require('./voice-host.cjs');
const { ChatHost, persona } = require('./chat-host.cjs');
const { ProactiveHost } = require('./proactive-host.cjs');
const {DesktopPet}=require('./desktop-pet.cjs');
const {TeaHost}=require('./tea-host.cjs');
const {FarewellHost}=require('./farewell-host.cjs');

app.setName('AliceKuonjiWinter');
// Preserve the existing local settings and native encrypted-key profile.
const releaseTag = '2.4';
const reportArgument = process.argv.find(argument => argument.startsWith('--verify-output='));
const verify = Boolean(reportArgument);
const previewArgument=process.argv.find(argument=>argument.startsWith('--preview-profile='));
const startupMarker=process.env.ALICE_STARTUP_READY_FILE;
const profile = verify ? path.resolve(reportArgument.slice('--verify-output='.length), 'profile') : previewArgument?path.resolve(previewArgument.slice('--preview-profile='.length)):path.join(app.getPath('appData'), 'AliceKuonjiWinter', releaseTag);
const petOptionsFile=path.join(profile,'pet-options.json'),petOptionDefaults={voiceReply:false,robinEnabled:true,robinVoice:true,dialogueOpacity:96};
const validPetOptions=value=>Object.fromEntries(Object.entries(petOptionDefaults).flatMap(([key,defaultValue])=>{
  const next=value?.[key];
  if(typeof defaultValue==='boolean')return typeof next==='boolean'?[[key,next]]:[];
  return typeof next==='number'&&Number.isFinite(next)?[[key,Math.round(Math.max(0,Math.min(100,next)))]]:[];
}));
let petOptions={...petOptionDefaults};try{petOptions={...petOptions,...validPetOptions(JSON.parse(fs.readFileSync(petOptionsFile,'utf8')))};}catch{}
const appearanceFile=path.join(profile,'appearance.json');let appearance={outfit:'winter',sushi:'salmon'};
const validAppearance=value=>Object.fromEntries(Object.entries(value||{}).filter(([key,id])=>key==='outfit'?['winter','white','penguin'].includes(id):key==='sushi'&&['salmon','tuna','shrimp','egg','roe','maki'].includes(id)));
try{appearance={...appearance,...validAppearance(JSON.parse(fs.readFileSync(appearanceFile,'utf8')))};}catch{}
app.setPath('userData', profile);
app.setPath('sessionData', profile);
let server;
let window;
let voice;
let chat;
let proactive;
let companionTimer;
let memoryRetryAt=0;
let desktopPet;
let tea;
let farewell,allowQuit=false;
let roomReady=false;
function requestQuit(){
  if(allowQuit)return;
  const target=desktopPet?.roomActive===false?desktopPet.window:window;
  if(target===window&&!roomReady){allowQuit=true;app.quit();return;}
  if(farewell&&target&&!target.isDestroyed())farewell.request(target.webContents);
  else{allowQuit=true;app.quit();}
}
const lock = verify || Boolean(previewArgument) || app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', () => { if(desktopPet&&!desktopPet.roomActive)desktopPet.restore();else if (window) { window.restore(); window.focus(); } });
  app.whenReady().then(async () => {
    const hosted = await startServer(path.join(__dirname, 'web'));
    server = hosted.server;
    const voiceArgument=process.argv.find(argument=>argument.startsWith('--verify-voice-workspace='));
    voice=new VoiceHost({profile,developmentRoot:app.isPackaged?null:path.resolve(__dirname,'../..'),launchDirectory:process.env.ALICE_LAUNCH_DIR,override:verify&&voiceArgument?voiceArgument.slice('--verify-voice-workspace='.length):null});
    const apiSession=session.fromPartition('alice-openai-api');
    chat=new ChatHost({profile,safeStorage,fetchImpl:(...args)=>apiSession.fetch(...args)});
    window = new BrowserWindow({
      title: `有珠 · 冬日小室 ${require('./package.json').version} · 日语语音`, width: 1360, height: 900, minWidth: 960, minHeight: 680,
      show: false, autoHideMenuBar: true, backgroundColor: '#17151f',
      icon: path.join(__dirname, 'icon.ico'),
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, offscreen: verify }
    });
    window.webContents.on('page-title-updated', event => event.preventDefault());
    const origin = new URL(hosted.url).origin;
    const trusted = event => event.senderFrame?.url && new URL(event.senderFrame.url).origin === origin&&[window?.webContents,desktopPet?.window?.webContents].includes(event.sender);
    window.once('ready-to-show',()=>{if(!verify&&!startupMarker)window.show();});
    ipcMain.handle('alice:startup-ready',event=>{
      if(!trusted(event))return {ok:false};
      if(event.sender===window.webContents){
        roomReady=true;
        if(!verify)window.show();
        if(startupMarker&&path.dirname(path.resolve(startupMarker)).toLowerCase()===path.resolve(app.getPath('temp')).toLowerCase()&&/^AliceKuonji-Startup-[a-f0-9]{32}\.ready$/.test(path.basename(startupMarker)))fs.writeFileSync(startupMarker,'ready');
      }
      return {ok:true};
    });
    ipcMain.handle('alice:startup-failed',event=>{
      if(!trusted(event))return {ok:false};
      if(event.sender===window.webContents){roomReady=false;if(!verify)window.show();if(startupMarker&&path.dirname(path.resolve(startupMarker)).toLowerCase()===path.resolve(app.getPath('temp')).toLowerCase()&&/^AliceKuonji-Startup-[a-f0-9]{32}\.ready$/.test(path.basename(startupMarker)))fs.writeFileSync(startupMarker,'failed');}
      return {ok:true};
    });
    ipcMain.handle('alice:pin', (event, pinned) => {
      if (!trusted(event) || typeof pinned !== 'boolean') return false;
      const owner=BrowserWindow.fromWebContents(event.sender);owner.setAlwaysOnTop(pinned);return owner.isAlwaysOnTop();
    });
    const reply=handler=>async(event,...args)=>{if(!trusted(event))return {ok:false,message:'窗口来源无效。'};try{return {ok:true,...await handler(...args)};}catch(error){return {ok:false,message:error.message};}};
    ipcMain.handle('alice:pet-options',reply(()=>petOptions));
    ipcMain.handle('alice:pet-options-save',reply(patch=>{const next={...petOptions,...validPetOptions(patch)};fs.mkdirSync(profile,{recursive:true});fs.writeFileSync(petOptionsFile+'.tmp',JSON.stringify(next));fs.renameSync(petOptionsFile+'.tmp',petOptionsFile);petOptions=next;for(const target of [window,desktopPet?.window])if(target&&!target.isDestroyed())target.webContents.send('alice:pet-options',petOptions);return petOptions;}));
    tea=new TeaHost({profile,onChange:value=>{for(const target of [window,desktopPet?.window])if(target&&!target.isDestroyed())target.webContents.send('alice:tea',value);}});
    ipcMain.handle('alice:tea-info',reply(()=>tea.info()));
    const teaReply=handler=>async(event,...args)=>{if(!trusted(event)||event.sender!==(desktopPet?.roomActive===false?desktopPet.window:window)?.webContents)return {ok:false,message:'请在当前显示的窗口泡茶。'};try{return {ok:true,...handler(event.sender.id,...args)};}catch(error){return {ok:false,message:error.message};}};
    ipcMain.handle('alice:tea-brew',teaReply((_owner,value)=>tea.brew(value)));
    ipcMain.handle('alice:tea-discard',teaReply(()=>tea.discard()));
    ipcMain.handle('alice:tea-take',teaReply((owner,id)=>tea.take(owner,id)));
    ipcMain.handle('alice:tea-finish',teaReply((owner,id)=>tea.finish(owner,id)));
    ipcMain.handle('alice:tea-release',event=>trusted(event)?{ok:true,...tea.release(event.sender.id)}:{ok:false,message:'窗口来源无效。'});
    ipcMain.handle('alice:appearance-info',reply(()=>appearance));
    ipcMain.handle('alice:appearance-save',reply(value=>{appearance={...appearance,...validAppearance(value)};fs.mkdirSync(profile,{recursive:true});const staged=appearanceFile+'.tmp';fs.writeFileSync(staged,JSON.stringify(appearance));fs.renameSync(staged,appearanceFile);for(const target of [window,desktopPet?.window])if(target&&!target.isDestroyed())target.webContents.send('alice:appearance',appearance);return appearance;}));
    const secure=target=>{target.webContents.setWindowOpenHandler(()=>({action:'deny'}));target.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});target.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));target.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith(origin+'/')&&!details.url.startsWith('data:')&&!details.url.startsWith('blob:'+origin+'/')&&!details.url.startsWith('devtools:')}));};
    desktopPet=new DesktopPet({room:window,profile,url:hosted.url,webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false,offscreen:verify},verify,secure,beforeSwitch:()=>{chat.cancel();proactive?.dismiss();tea.release();}});
    const activeWindow=()=>desktopPet.roomActive?window:desktopPet.window;
    farewell=new FarewellHost({present:async({owner,token})=>{
      chat.cancel();proactive?.dismiss();clearInterval(companionTimer);
      if(owner===desktopPet.window?.webContents)await desktopPet.recall();
      const target=BrowserWindow.fromWebContents(owner);if(!target||target.isDestroyed())throw Error('窗口已关闭');
      if(!verify){target.show();target.restore();target.focus();}
      owner.send('alice:farewell',{token});
    },finish:()=>{allowQuit=true;desktopPet.quitting=true;void voice.stop().finally(()=>app.quit());}});
    ipcMain.handle('alice:farewell-done',(event,token)=>({ok:trusted(event)&&farewell.done(event.sender,token)}));
    ipcMain.handle('alice:sticker-record',async(event,value)=>{if(!trusted(event)||event.sender!==activeWindow()?.webContents)return {ok:false,message:'请在当前窗口发送表情包。'};try{return {ok:true,...chat.recordSticker(value)};}catch(error){return {ok:false,message:error.message};}});
    proactive=new ProactiveHost({chat,available:()=>{const active=activeWindow();return Boolean((desktopPet.roomActive||!desktopPet.edge.side)&&active&&!active.isDestroyed()&&active.isVisible()&&!active.isMinimized()&&active.isFocused());},deliver:candidate=>activeWindow()?.webContents.send('alice:proactive-candidate',candidate)});
    companionTimer=setInterval(async()=>{
      if(proactive.pending&&Date.now()>proactive.pending.expires)proactive.dismiss();
      const started=await proactive.tick();
      if(!started&&!chat.controller&&!chat.auxController&&proactive.canDeliver&&proactive.idleMs>=30000&&Date.now()-proactive.reportedAt<25000&&Date.now()>memoryRetryAt){
        try{await chat.summarizeMemory();}catch{memoryRetryAt=Date.now()+60000;}
      }
    },15000);
    companionTimer.unref();
    ipcMain.handle('alice:voice-info',reply(()=>voice.info()));
    ipcMain.handle('alice:voice-start',reply(()=>voice.start()));
    ipcMain.handle('alice:voice-stop',reply(()=>voice.stop()));
    ipcMain.handle('alice:voice-speak',reply(request=>voice.synthesize(request?.ja,request?.zh)));
    ipcMain.handle('alice:voice-choose',reply(async()=>{const selected=await dialog.showOpenDialog(activeWindow(),{title:'选择已配置语音环境的 live2d 项目文件夹',properties:['openDirectory']});return selected.canceled?voice.info():voice.configure(selected.filePaths[0]);}));
    ipcMain.handle('alice:chat-info',reply(()=>chat.info()));
    ipcMain.handle('alice:chat-persona',reply(()=>({persona})));
    ipcMain.handle('alice:chat-save',reply(settings=>chat.save(settings)));
    ipcMain.handle('alice:chat-forget-key',reply(()=>chat.forgetKey()));
    ipcMain.handle('alice:chat-history',reply(()=>({messages:chat.transcript()})));
    ipcMain.handle('alice:chat-clear',reply(()=>chat.clear()));
    ipcMain.handle('alice:chat-cancel',reply(()=>{chat.cancel();return {};}));
    ipcMain.handle('alice:chat-ask',reply(text=>chat.ask(text)));
    ipcMain.handle('alice:chat-test',reply(()=>chat.test()));
    ipcMain.handle('alice:codex-status',reply(()=>chat.codexStatus()));
    ipcMain.handle('alice:companion-info',reply(()=>chat.companionInfo()));
    ipcMain.handle('alice:companion-configure',reply(settings=>{chat.cancelAux();proactive.dismiss();chat.companion.configure(settings);return chat.companionInfo();}));
    ipcMain.handle('alice:memory-edit',reply(notes=>{chat.cancelAux();chat.companion.editMemory(notes);return chat.companionInfo();}));
    ipcMain.handle('alice:memory-clear',reply(()=>{chat.cancelAux();chat.companion.clearMemory();return chat.companionInfo();}));
    ipcMain.handle('alice:memory-organize',reply(()=>chat.summarizeMemory({force:true})));
    ipcMain.handle('alice:save-create',reply(title=>{if(chat.controller)throw Error('请先停止回答，再保存进度。');chat.companion.save(title);return chat.companionInfo();}));
    ipcMain.handle('alice:save-load',reply(id=>{chat.cancel();proactive.dismiss();chat.companion.load(id);chat.syncHistory();return {...chat.companionInfo(),messages:chat.transcript()};}));
    ipcMain.handle('alice:save-remove',reply(id=>{chat.companion.remove(id);return chat.companionInfo();}));
    ipcMain.handle('alice:companion-report',async(event,report)=>{if(!trusted(event))return {ok:false,message:'窗口来源无效。'};if(event.sender!==activeWindow()?.webContents)return {ok:true};return {ok:true,...proactive.report(report)};});
    ipcMain.handle('alice:proactive-accept',reply(id=>proactive.accept(id)));
    ipcMain.handle('alice:pet-enter',reply(async()=>{chat.cancel();proactive.dismiss();return desktopPet.open();}));
    ipcMain.handle('alice:pet-return',reply(()=>{chat.cancel();proactive.dismiss();return desktopPet.restore();}));
    const petReply=handler=>async(event,...args)=>{if(!trusted(event)||event.sender!==desktopPet.window?.webContents)return {ok:false,message:'桌宠窗口来源无效。'};try{return {ok:true,...await handler(event,...args)};}catch(error){return {ok:false,message:error.message};}};
    ipcMain.handle('alice:pet-ready',petReply(event=>{desktopPet.ready(event.sender);return {};}));
    ipcMain.handle('alice:pet-hit',petReply((_event,value)=>{desktopPet.hit(value===true);return {};}));
    ipcMain.handle('alice:pet-drag',petReply((_event,value)=>{if(value===true)desktopPet.startDrag();else desktopPet.endDrag();return {};}));
    ipcMain.handle('alice:pet-menu',petReply(()=>{desktopPet.menu();return {};}));
    ipcMain.handle('alice:pet-info',petReply(()=>desktopPet.info()));
    ipcMain.handle('alice:pet-scale',petReply((_event,factor)=>desktopPet.scale(factor)));
    ipcMain.handle('alice:pet-dock',petReply((_event,side)=>{proactive.dismiss();return desktopPet.dock(side);}));
    ipcMain.handle('alice:pet-recall',petReply(()=>desktopPet.recall()));
    ipcMain.handle('alice:pet-activity',petReply((_event,busy)=>{desktopPet.reportActivity(busy);return {};}));
    ipcMain.handle('alice:pet-edge-drag',petReply((_event,active)=>active===true?desktopPet.startEdgeDrag():desktopPet.endEdgeDrag()));
    ipcMain.handle('alice:pet-dock-position',petReply((_event,position)=>desktopPet.setDockPosition(position)));
    secure(window);
    window.on('close',event=>{if(!allowQuit){event.preventDefault();requestQuit();}});
    window.on('closed',()=>{window=null;app.quit();});
    if (verify) {
      const output = path.resolve(reportArgument.slice('--verify-output='.length));
      fs.mkdirSync(output, { recursive: true });
      window.webContents.setAudioMuted(true);
      await require('./verify.cjs').verify(window, hosted.url, output,{voice,chat,proactive,desktopPet,tea,farewell,startupOnly:process.argv.includes('--verify-startup-only'),expressionAuditRound:Number(process.argv.find(a=>a.startsWith('--expression-audit-round='))?.split('=')[1]||0),expressionsOnly:process.argv.includes('--verify-expressions-only'),penguinPeekOnly:process.argv.includes('--verify-penguin-peek-only'),stickersOnly:process.argv.includes('--verify-stickers-only'),opacityOnly:process.argv.includes('--verify-opacity-only'),petUIOnly:process.argv.includes('--verify-pet-ui-only'),petCompanionsOnly:process.argv.includes('--verify-pet-companions-only'),voiceOnly:process.argv.includes('--verify-voice-only'),teaOnly:process.argv.includes('--verify-tea-only'),edgeOnly:process.argv.includes('--verify-edge-only'),wardrobeOnly:process.argv.includes('--verify-wardrobe-only'),feedingOnly:process.argv.includes('--verify-feeding-only'),petOnly:process.argv.includes('--verify-pet-only'),visionOnly:process.argv.includes('--verify-vision-only'),companionOnly:process.argv.includes('--verify-companion-only'),layoutOnly:process.argv.includes('--verify-layout-only'),checkSynthesis:Boolean(voiceArgument)||process.argv.includes('--verify-local-voice'),checkCodex:process.argv.includes('--verify-codex')});
      await voice.stop();
      app.exit(0);
    } else {await window.loadURL(hosted.url);}
  }).catch(async error => {
    console.error(error);
    if (verify) {
      const output = path.resolve(reportArgument.slice('--verify-output='.length));
      fs.mkdirSync(output, { recursive: true });
      fs.writeFileSync(path.join(output, 'error.txt'), error.stack || String(error));
    } else dialog.showErrorBox('有珠 · 启动失败', error.message);
    await voice?.stop();app.exit(1);
  });
}
app.on('window-all-closed', () => app.quit());
app.on('before-quit',event=>{if(!allowQuit){event.preventDefault();requestQuit();return;}if(desktopPet)desktopPet.quitting=true;if(voice?.child){event.preventDefault();voice.stop().finally(()=>app.quit());}});
app.on('will-quit', () => { desktopPet?.close();tea?.close();clearInterval(companionTimer);chat?.close();if (server) server.close(); });
