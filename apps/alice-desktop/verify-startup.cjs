const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
exports.verifyStartup=async(window,url,output,{desktopPet})=>{
  const origin=new URL(url).origin,session=window.webContents.session,consoleErrors=[],js=code=>window.webContents.executeJavaScript(code,true),report={samples:[]};
  let slow=true,failure=false;
  window.webContents.on('console-message',d=>{if(d.level==='error')consoleErrors.push(d.message);});
  const policy=(details,callback)=>{
    const allowed=details.url.startsWith(origin+'/')||details.url.startsWith('data:')||details.url.startsWith('blob:'+origin+'/')||details.url.startsWith('devtools:');
    if(failure&&details.url.endsWith('.moc3')){callback({cancel:true});return;}
    const ms=slow?(details.url.endsWith('.moc3')?800:details.url.endsWith('/expressions/manifest.json')?400:details.url.endsWith('/voice/manifest.json')?350:details.url.endsWith('/wardrobe/white-coat-v3.png')?350:0):0;
    if(ms)setTimeout(()=>callback({cancel:!allowed}),ms);else callback({cancel:!allowed});
  };
  session.webRequest.onBeforeRequest(policy);
  const until=async(predicate,label)=>{for(let n=0;n<300;n++){if(await predicate())return;await delay(50);}throw Error('Startup verification timed out: '+label);};
  const state=()=>js('window.aliceStartup?.snapshot()||null'),shot=async name=>fs.writeFile(path.join(output,name+'.png'),(await window.webContents.capturePage()).toPNG());
  await window.loadURL(url);await until(async()=>{const s=await state();return s?.birdLoaded&&!s.hidden;},'first Robin frame');await shot('loading-start');
  let middle=false;
  for(let n=0;n<300;n++){const s=await state();report.samples.push(s);if(!middle&&s.target>=.49&&s.phase==='loading'){await shot('loading-preparing');middle=true;}if(s.hidden)break;await delay(40);}
  const ready=await state();assert.equal(ready.phase,'ready');assert.equal(ready.hidden,true);assert.equal(ready.birdLoaded,true);assert(ready.history.length>=8);assert(ready.history.every((s,i,a)=>!i||s.progress>=a[i-1].progress));assert(report.samples.every((s,i,a)=>!i||s.progress>=a[i-1].progress));
  const live=await js('aliceApp.diagnostic()');assert(live.finite&&!live.glError&&live.visiblePixels>10000);assert(window.getBackgroundColor().toLowerCase().endsWith('17151f'));assert.deepEqual(consoleErrors,[]);await shot('room-ready');report.success=ready;report.realProgress=true;
  window.setContentSize(960,680);slow=true;await window.loadURL(url);await until(async()=>{const s=await state();return s?.birdLoaded&&!s.hidden;},'small viewport');
  const layout=await js("(()=>{const r=document.querySelector('.startup-card').getBoundingClientRect(),c=document.getElementById('startup-flight').getBoundingClientRect();return {card:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},bird:{width:c.width,height:c.height},width:innerWidth,height:innerHeight};})()");assert(layout.card.left>=0&&layout.card.top>=0&&layout.card.right<=layout.width&&layout.card.bottom<=layout.height);await shot('loading-small');report.smallLayout=layout;await until(async()=>(await state())?.hidden,'small ready');
  const beforeFailure=consoleErrors.length;failure=true;slow=false;await window.loadURL(url);await until(async()=>(await state())?.phase==='failed','failure page');const failed=await state();assert(!failed.hidden&&failed.progress<1);assert.equal(await js("Boolean(document.querySelector('#loading .spinner'))"),false);assert((await js("document.getElementById('startup-title').textContent")).includes('未能'));await shot('loading-failed');report.failure={phase:failed.phase,progress:failed.progress,detail:failed.detail};report.expectedFailureErrors=consoleErrors.slice(beforeFailure);
  failure=false;const beforeRecovery=consoleErrors.length;window.setContentSize(1360,900);await window.loadURL(url);await until(async()=>(await state())?.hidden,'recovery');assert.deepEqual(consoleErrors.slice(beforeRecovery),[]);report.recovery=true;await shot('room-recovered');
  await js('aliceDesktop.petEnter()');const pet=desktopPet.window,pjs=code=>pet.webContents.executeJavaScript(code,true);await until(()=>pjs("Boolean(window.aliceApp?.state.ready&&document.getElementById('loading').hidden)"),'pet ready');
  const petState=await pjs("(()=>{const root=document.getElementById('loading');return {startup:aliceStartup.snapshot(),background:getComputedStyle(root).backgroundColor,backgroundArt:getComputedStyle(root,'::before').display,finite:aliceApp.diagnostic().finite};})()");assert(petState.finite&&petState.startup.hidden&&petState.background==='rgba(0, 0, 0, 0)'&&petState.backgroundArt==='none');report.petTransparent=petState;desktopPet.restore();
  report.ok=true;return report;
};
