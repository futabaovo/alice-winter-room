const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
exports.verifyEdge=async(room,output,{desktopPet})=>{
  assert((await room.webContents.executeJavaScript('aliceDesktop.petEnter()',true)).ok);
  let pet=desktopPet.window;const errors=[];pet.webContents.on('console-message',details=>{if(details.level==='error')errors.push(details.message);});
  const js=code=>pet.webContents.executeJavaScript(code,true);
  const until=async(predicate,label)=>{for(let i=0;i<100;i++){if(await predicate())return;await delay(60);}throw Error('Timed out: '+label);};
  const shot=async name=>{await delay(80);await fs.writeFile(path.join(output,name+'.png'),(await pet.webContents.capturePage()).toPNG());};
  const within=()=>{const b=pet.getBounds(),a=desktopPet.area(b);assert(b.x>=a.x&&b.y>=a.y&&b.x+b.width<=a.x+a.width&&b.y+b.height<=a.y+a.height,JSON.stringify({bounds:b,area:a,scale:desktopPet.info().scale}));};
  const checkCover=async side=>{
    const result=await js(`(()=>{const c=aliceApp.character,p=aliceApp.pet.rig.pose,d=c.model.drawables,i=d.ids.indexOf('ArtMeshTopwear'),v=d.vertexPositions[i],posed=c.drawOverrides.get(i)||v,indices=d.indices[i];let flipped=0;for(let n=0;n<indices.length;n+=3){const cross=a=>{const j=indices[n]*2,k=indices[n+1]*2,l=indices[n+2]*2;return (a[k]-a[j])*(a[l+1]-a[j+1])-(a[k+1]-a[j+1])*(a[l]-a[j]);};if(Math.abs(cross(v))>1e-8&&cross(v)*cross(posed)<=0)flipped++;}const eyes=d.ids.filter(id=>id.startsWith('ArtMeshEyewhite')).map(id=>{const r=c.meshBounds(id);return {id,x:(r.left+r.right)/2,y:(r.top+r.bottom)/2};}).sort((a,b)=>a.x-b.x),scale=c.canvas.width/c.canvas.clientWidth,ctx=aliceApp.pet.rig.frontContext;for(const eye of eyes){eye.bookAlpha=ctx.getImageData(Math.round(eye.x*scale),Math.round(eye.y*scale),1,1).data[3];eye.screen=aliceApp.pet.edge.screenPoint(eye);}const openings=p.openings.map(o=>{const a=c.alphaAt(o.x,o.y),b=aliceApp.pet.rig.backContext.getImageData(Math.round(o.x*scale),Math.round(o.y*scale),1,1).data[3],f=ctx.getImageData(Math.round(o.x*scale),Math.round(o.y*scale),1,1).data[3];return 255-(255-a)*(255-b)*(255-f)/65025;});return {eyes,openings,flipped};})()`);
    assert.equal(result.flipped,0,'Peek garment mesh folded');assert(result.openings.every(alpha=>alpha>245),'Peek sleeve opening has a transparent gap');assert.equal(result.eyes.length,2);
    const visible=result.eyes[side==='left'?0:1],covered=result.eyes[side==='left'?1:0];assert(visible.bookAlpha<25&&covered.bookAlpha>225,'Book must cover one eye and reveal the other: '+JSON.stringify(result));
    assert(visible.screen.x>0&&visible.screen.x<pet.getContentBounds().width);pet.webContents.sendInputEvent({type:'mouseMove',x:Math.round(visible.screen.x),y:Math.round(visible.screen.y)});await delay(120);assert.equal(desktopPet.ignoring,false,'Tilted visible eye cannot receive a click');
    const b=pet.getContentBounds();pet.webContents.sendInputEvent({type:'mouseMove',x:Math.round(b.width*.5),y:Math.round(b.height*.5)});await delay(120);assert.equal(desktopPet.ignoring,true,'The old unrotated body still intercepts clicks');return result;
  };
  await until(()=>js('Boolean(window.aliceApp?.state.ready&&aliceApp.character.frames>3)'), 'pet ready');
  await js("document.getElementById('pet-size').click()");
  assert.equal(await js("document.getElementById('pet-size-panel').hidden"),false);
  const sizes=[];
  for(const percent of [65,83,117,150]){
    const expected=Math.min(percent,desktopPet.info().scaleLimits.max);
    await js(`(()=>{const s=document.getElementById('pet-scale');s.value=${percent};s.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await until(async()=>desktopPet.info().scale===expected/100&&!(await js('aliceApp.pet.edge.diagnostic().scaling')),'scale '+percent);within();
    const layout=await js("(()=>{const ids=['pet-scale','pet-size-panel','pet-return','pet-drag','pet-menu'];return ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return {id,x:r.x,y:r.y,right:r.right,bottom:r.bottom,viewport:{width:innerWidth,height:innerHeight}};});})()");
    for(const r of layout)assert(r.x>=0&&r.y>=0&&r.right<=r.viewport.width+.5&&r.bottom<=r.viewport.height+.5,'Size control clipped '+JSON.stringify(r));
    assert.equal(await js("document.getElementById('pet-scale-value').textContent"),expected+'%');sizes.push({percent:expected,...desktopPet.info(),layout});await shot('size-'+expected);
  }
  const panelPoint=await js("(()=>{const r=document.getElementById('pet-size-panel').getBoundingClientRect();return {x:Math.round(r.x+8),y:Math.round(r.y+r.height-10)};})()");pet.webContents.sendInputEvent({type:'mouseMove',...panelPoint});await delay(100);assert.equal(desktopPet.ignoring,false,'Settings background clicks leaked to desktop');
  await js("(()=>{const s=document.getElementById('pet-scale');for(let n=65;n<=137;n++){s.value=n;s.dispatchEvent(new Event('input',{bubbles:true}));}})()");
  const lastScale=Math.min(137,desktopPet.info().scaleLimits.max)/100;await until(async()=>desktopPet.info().scale===lastScale&&!(await js('aliceApp.pet.edge.diagnostic().scaling')),'last scale wins');
  // A real keyboard range change must go through the same live resize path.
  await js("document.getElementById('pet-scale').focus()");pet.webContents.sendInputEvent({type:'keyDown',keyCode:'Left'});pet.webContents.sendInputEvent({type:'keyUp',keyCode:'Left'});await until(()=>desktopPet.info().scale===lastScale-.01,'keyboard range');
  await js('aliceDesktop.petScale(1)');await delay(300);
  const movementSize=pet.getSize();for(let n=0;n<30;n++){const b=pet.getBounds();desktopPet.place({...b,x:b.x+(n%2?1:-1)},{resize:false});}assert.deepEqual(pet.getSize(),movementSize,'Sliding changed the pet size');
  await js("document.getElementById('pet-size-close').click();aliceApp.pet.setChat(true);document.getElementById('chat-input').value='保留的草稿'");
  const free=pet.getBounds();await js("aliceDesktop.petDock('left')");await until(()=>desktopPet.edge.phase==='hidden','left hides');await delay(100);
  assert.equal(pet.getBounds().x,desktopPet.area(free).x);assert.deepEqual(desktopPet.freeBounds,free);assert(await js('aliceApp.state.suspended'));assert.equal(await js("document.getElementById('chat-input').value"),'保留的草稿');
  const interval=desktopPet.edge.nextAt-Date.now();assert(interval>178000&&interval<=300000);await shot('hidden-left');
  pet.webContents.sendInputEvent({type:'mouseMove',x:Math.round(free.width/2),y:Math.round(free.height/2)});await delay(180);assert.equal(desktopPet.ignoring,true,'Hidden actor still intercepts desktop');
  const handle=await js("(()=>{const r=document.getElementById('pet-edge-handle').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),width:r.width,height:r.height};})()");
  assert(handle.width>=24);pet.webContents.sendInputEvent({type:'mouseMove',x:handle.x,y:handle.y});await delay(180);assert.equal(desktopPet.ignoring,false,'Recall tab cannot receive clicks');
  // Exercise the real timer callback with an expired deadline, not a separate preview path.
  desktopPet.reportActivity(true);desktopPet.edge.nextAt=Date.now()-1;desktopPet.armEdge();await delay(100);assert.equal(desktopPet.edge.phase,'hidden');assert(desktopPet.edge.nextAt-Date.now()>14000);
  desktopPet.reportActivity(false);const calls={focus:0,show:0,showInactive:0},original={};for(const key of Object.keys(calls)){original[key]=pet[key];pet[key]=function(...args){calls[key]++;return original[key].apply(this,args);};}
  desktopPet.edge.nextAt=Date.now()-1;desktopPet.armEdge();await until(()=>desktopPet.edge.phase==='peeking','periodic peek');await until(()=>js('aliceApp.wardrobe.displayed==="penguin"'),'automatic penguin outfit');desktopPet.startEdgeDrag();desktopPet.endEdgeDrag();desktopPet.reportActivity(false);assert(desktopPet.peekNow('original'));await delay(1700);within();
  const peekLeft=await js('aliceApp.pet.diagnostic()');assert(!await js('aliceApp.state.suspended'));assert(peekLeft.progress>.9&&peekLeft.edge.motion.offset<-.59&&peekLeft.edge.motion.angle>11&&peekLeft.rig.peek>.99&&peekLeft.rig.alpha===1);const coverLeft=await checkCover('left');await shot('peek-left');
  assert.deepEqual(calls,{focus:0,show:0,showInactive:0});for(const key of Object.keys(calls))pet[key]=original[key];
  await until(()=>desktopPet.edge.phase==='hidden','peek retracts after 6.5 s');assert(await js('aliceApp.state.suspended'));
  // Send a native click to the only remaining visible control.
  pet.webContents.sendInputEvent({type:'mouseMove',x:handle.x,y:handle.y});pet.webContents.sendInputEvent({type:'mouseDown',x:handle.x,y:handle.y,button:'left',clickCount:1});pet.webContents.sendInputEvent({type:'mouseUp',x:handle.x,y:handle.y,button:'left',clickCount:1});
  await until(()=>desktopPet.edge.side===null,'native tab recall');await delay(650);assert.deepEqual(pet.getBounds(),free);assert(!await js('aliceApp.state.suspended'));
  await js("document.getElementById('pet-size').click();document.getElementById('pet-dock-right').click()");await until(()=>desktopPet.edge.phase==='hidden','right hides');within();assert.equal(pet.getBounds().x+free.width,desktopPet.area(free).x+desktopPet.area(free).width);
  await js('aliceDesktop.petScale(.83)');await delay(200);within();assert.equal(desktopPet.info().scale,.83);desktopPet.reportActivity(false);assert(desktopPet.peekNow('original'));await delay(1700);const peekRight=await js('aliceApp.pet.diagnostic()');assert(peekRight.edge.motion.offset>.59&&peekRight.edge.motion.angle<-11&&peekRight.rig.peek>.99);const coverRight=await checkCover('right');await shot('peek-right');
  desktopPet.powerPause('lock',true);desktopPet.powerPause('sleep',true);await delay(100);assert.equal(desktopPet.edge.nextAt,0);assert(await js('aliceApp.state.suspended'));desktopPet.powerPause('sleep',false);assert(desktopPet.edge.paused,'Sleep resume bypassed the screen lock');desktopPet.powerPause('lock',false);await delay(100);assert.equal(desktopPet.edge.phase,'hidden');assert(desktopPet.edge.nextAt-Date.now()>179000);
  // Return/re-enter must not replay a pending peek; saved size/side survive window recreation.
  desktopPet.restore();assert.equal(desktopPet.edge.nextAt,0);await delay(300);assert.equal(await room.webContents.executeJavaScript('aliceApp.state.suspended'),false);
  await desktopPet.open();await delay(150);assert.equal(desktopPet.edge.phase,'hidden');const saved=JSON.parse(await fs.readFile(desktopPet.boundsFile,'utf8'));assert.equal(saved.scale,.83);assert.equal(saved.dockSide,'right');assert.deepEqual(saved.bounds,desktopPet.freeBounds);
  desktopPet.restore();desktopPet.persist(true);pet.destroy();assert.equal(desktopPet.window,null);await desktopPet.open();pet=desktopPet.window;await until(()=>js('Boolean(window.aliceApp?.state.ready)'), 'recreated pet ready');assert.equal(desktopPet.info().scale,.83);assert.equal(desktopPet.edge.side,'right');assert.equal(desktopPet.edge.phase,'hidden');
  await js('aliceDesktop.petRecall()');await delay(650);await js("document.getElementById('pet-size').click()");await shot('ready-83');
  const outfitPeeks=[];for(const outfit of ['white','penguin']){await js(`aliceApp.wardrobe.set('${outfit}',{save:false})`);await desktopPet.dock('right');await until(()=>desktopPet.edge.phase==='hidden',outfit+' hides');desktopPet.reportActivity(false);assert(desktopPet.peekNow('original'));await delay(1200);const d=await js('aliceApp.diagnostic()');assert(d.finite&&!d.glError&&d.visiblePixels>1000);assert.equal(d.pet.rig,null,'Unbound book leaked into '+outfit);assert(Object.values(d.wardrobe.meshes).every(mesh=>mesh.finite));await shot('peek-'+outfit);outfitPeeks.push({outfit,finite:d.finite,visiblePixels:d.visiblePixels,bookAbsent:d.pet.rig===null});await desktopPet.recall();await delay(250);}await js("aliceApp.wardrobe.set('winter',{save:false})");
  // A drag released near either edge docks; an ordinary click does not.
  const base=pet.getBounds(),area=desktopPet.area(base);desktopPet.startDrag();desktopPet.endDrag();assert.equal(desktopPet.edge.side,null);
  desktopPet.startDrag();pet.setBounds({...base,x:area.x+3});desktopPet.endDrag();await until(()=>desktopPet.edge.phase==='hidden','drag snap left');assert.equal(desktopPet.edge.side,'left');
  await desktopPet.recall();const raced=[desktopPet.dock('left'),desktopPet.recall(),desktopPet.dock('right'),desktopPet.recall()];await Promise.all(raced);await delay(550);assert.equal(desktopPet.edge.side,null);within();
  const positionChecks=await require('./verify-pet-edge-position.cjs').verifyPosition({desktopPet,getPet:()=>desktopPet.window,output});pet=desktopPet.window;
  let preview=null;
  if(process.argv.includes('--verify-peek-demo')){
    desktopPet.scale(1);await desktopPet.dock('left');await until(()=>desktopPet.edge.phase==='hidden','demo hides');
    const frames=path.join(output,'frames');await fs.mkdir(frames,{recursive:true});const count=246,start=Date.now();
    for(let n=0;n<count;n++){if(n===18){desktopPet.reportActivity(false);assert(desktopPet.peekNow('original'));}await fs.writeFile(path.join(frames,`frame-${String(n).padStart(4,'0')}.png`),(await pet.webContents.capturePage()).toPNG());await delay(Math.max(0,start+(n+1)*1000/30-Date.now()));}
    const sample=pet.getContentBounds(),file=path.join(output,'peek-motion-preview.mp4');require('node:child_process').execFileSync(path.resolve(__dirname,'../../.cache/audio-tools/bin/ffmpeg.exe'),['-hide_banner','-loglevel','error','-y','-f','lavfi','-i',`color=c=0xdedbd7:s=${sample.width}x${sample.height}:r=30`,'-framerate','30','-i',path.join(frames,'frame-%04d.png'),'-filter_complex','[0:v][1:v]overlay=shortest=1:format=auto,format=yuv420p','-c:v','libx264','-crf','20','-preset','fast','-movflags','+faststart','-shortest',file],{windowsHide:true});preview={file,frames:count,fps:30,duration:count/30};
    await until(()=>desktopPet.edge.phase==='hidden','demo retracts');desktopPet.reportActivity(false);assert(desktopPet.peekNow('original'));await delay(1100);const eye=(await checkCover('left')).eyes[0].screen;pet.webContents.sendInputEvent({type:'mouseMove',x:Math.round(eye.x),y:Math.round(eye.y)});pet.webContents.sendInputEvent({type:'mouseDown',x:Math.round(eye.x),y:Math.round(eye.y),button:'left',clickCount:1});pet.webContents.sendInputEvent({type:'mouseUp',x:Math.round(eye.x),y:Math.round(eye.y),button:'left',clickCount:1});await until(()=>desktopPet.edge.side===null,'click tilted eye recalls');await delay(900);
  }
  desktopPet.restore();assert.equal(desktopPet.edge.nextAt,0);assert.deepEqual(errors,[]);
  const report={ok:true,sizes,lastInputWins:true,keyboardRange:true,hiddenClickThrough:true,panelClickProtection:true,nativeRecallClick:true,intervalMs:interval,peekDurationMs:6500,peekLeft,peekRight,coverLeft,coverRight,outfitPeeks,positionChecks,preview,focusCallsDuringPeek:calls,restoredBounds:free,persistence:saved,powerPauseResume:true,dragSnap:true,rapidReversal:true,errors};await fs.writeFile(path.join(output,'edge-verification.json'),JSON.stringify(report,null,2));return report;
};
