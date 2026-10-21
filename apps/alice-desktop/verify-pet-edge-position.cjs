const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
exports.verifyPosition=async({desktopPet,getPet,output})=>{
  const js=code=>getPet().webContents.executeJavaScript(code,true),until=async(test,label)=>{for(let n=0;n<100;n++){if(await test())return;await delay(50);}throw Error('Position timed out: '+label);};
  const handle=()=>js("(()=>{const r=document.getElementById('pet-edge-handle').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()");
  const mouse=(type,point)=>getPet().webContents.sendInputEvent({type,...point,...(type==='mouseMove'?{}:{button:'left',clickCount:1})});
  const shot=async name=>fs.writeFile(path.join(output,name+'.png'),(await getPet().webContents.capturePage()).toPNG());
  const within=()=>{const b=getPet().getBounds(),a=desktopPet.area(b);assert(b.x>=a.x&&b.y>=a.y&&b.x+b.width<=a.x+a.width&&b.y+b.height<=a.y+a.height);};
  desktopPet.scale(1);await desktopPet.dock('left');await until(()=>desktopPet.edge.phase==='hidden','hide');await js('aliceDesktop.petDockPosition(.35)');
  const initial=desktopPet.info(),point=await handle();mouse('mouseMove',point);await delay(100);mouse('mouseDown',point);await until(()=>desktopPet.edgeDragging,'real pointer starts drag');assert.equal(desktopPet.edge.nextAt,0);assert.equal(desktopPet.ignoring,false);
  const captured=await js('aliceApp.pet.edge.diagnostic().drag');assert(captured&&Number.isInteger(captured.id));
  // Start and release with native input; the intervening screen-coordinate
  // event is deterministic and does not move the user's physical mouse.
  await js(`document.getElementById('pet-edge-handle').dispatchEvent(new PointerEvent('pointermove',{pointerId:${captured.id},screenY:${captured.screenY+160},buttons:1,bubbles:true}))`);
  const expected=.35+160/initial.edge.travel;await until(async()=>Math.abs(desktopPet.info().edge.position-expected)<.00001&&!(await js('aliceApp.pet.edge.diagnostic().positionWriting')),'pointer moves whole edge');within();
  const afterDrag=desktopPet.info();mouse('mouseUp',await handle());await until(()=>!desktopPet.edgeDragging,'release');await delay(150);assert.equal(desktopPet.edge.phase,'hidden','Drag accidentally recalled the pet');assert(desktopPet.edge.nextAt-Date.now()>178000);await shot('edge-dragged');
  const positions=[];
  for(const [key,position] of [['Home',0],['End',1]]){
    await js(`(()=>{const h=document.getElementById('pet-edge-handle');h.focus();h.dispatchEvent(new KeyboardEvent('keydown',{key:'${key}',bubbles:true}));})()`);await until(()=>desktopPet.info().edge.position===position,key);
    const info=desktopPet.info(),b=getPet().getBounds(),a=desktopPet.area(b),center=b.y+info.edge.anchorY;assert(Math.abs(center-(a.y+52+position*(a.height-104)))<1.1,'Handle did not reach work-area extreme');within();
    desktopPet.reportActivity(false);assert(desktopPet.peekNow('original'));await delay(1700);
    const visible=await js(`(()=>{const p=aliceApp.pet.rig.pose,e=aliceApp.pet.edge,c=aliceApp.character,f=c.meshBounds('ArtMeshFace'),hat=c.meshBounds('ArtMeshHeadwear');return {hands:[p.leftHandPoint,p.rightHandPoint].map(v=>e.screenPoint(v)),wrists:p.grips.map(v=>e.screenPoint(v.wrist)),hat:[{x:hat.left,y:hat.top},{x:hat.right,y:hat.top}].map(v=>e.screenPoint(v)),elbows:[p.elbowL,p.elbowR].map(v=>e.screenPoint(v)),viewport:{w:innerWidth,h:innerHeight}};})()`);
    for(const p of [...visible.hands,...visible.wrists,...visible.elbows])assert(p.y>0&&p.y<visible.viewport.h,'Hand/arm cropped at '+key+': '+JSON.stringify(visible));assert(visible.hat.every(p=>p.y>=0),'Hat cropped at top');
    positions.push({key,position,center,visible});await shot('peek-position-'+position);desktopPet.startEdgeDrag();desktopPet.endEdgeDrag();await delay(100);
  }
  await js("(()=>{const h=document.getElementById('pet-edge-handle');h.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',shiftKey:true,bubbles:true}));})()");await until(()=>desktopPet.info().edge.position<1,'keyboard nudge');const nudge=desktopPet.info().edge.position;assert(Math.abs(nudge-(1-32/desktopPet.info().edge.travel))<1e-9);
  await js('aliceDesktop.petDockPosition(.61)');const beforeScale=desktopPet.info().bounds.y+desktopPet.info().edge.anchorY;desktopPet.scale(.83);await delay(250);const afterScale=desktopPet.info().bounds.y+desktopPet.info().edge.anchorY;assert(Math.abs(beforeScale-afterScale)<1.1,'Scale moved saved edge anchor');
  await desktopPet.dock('right');await until(()=>desktopPet.edge.phase==='hidden','right hide');await js('aliceDesktop.petDockPosition(.22)');await desktopPet.dock('left');await until(()=>desktopPet.edge.phase==='hidden','left remembered');assert.equal(desktopPet.info().edge.position,.61);
  desktopPet.persist(true);const saved=JSON.parse(await fs.readFile(desktopPet.boundsFile,'utf8'));assert.deepEqual(saved.dockPositions,{left:.61,right:.22});
  desktopPet.restore();getPet().destroy();await desktopPet.open();await until(()=>js('Boolean(window.aliceApp?.state.ready)'), 'recreated');assert.equal(desktopPet.info().edge.position,.61);assert.deepEqual(desktopPet.dockPositions,saved.dockPositions);
  desktopPet.startEdgeDrag();desktopPet.powerPause('lock',true);assert.equal(desktopPet.edgeDragging,false);assert.equal(desktopPet.edge.nextAt,0);desktopPet.powerPause('lock',false);assert(desktopPet.edge.nextAt-Date.now()>179000);
  // A short click still recalls after dragging and after window recreation.
  await delay(500);const tap=await handle();mouse('mouseMove',tap);await delay(100);mouse('mouseDown',tap);mouse('mouseUp',tap);await until(()=>desktopPet.edge.side===null,'tap recalls');await delay(650);within();
  return {ok:true,nativeDrag:true,noAccidentalRecall:true,wholeEdge:true,afterDrag,positions,keyboardNudge:true,scaleAnchor:{beforeScale,afterScale},saved,recreatedPersistence:true,lockCancelsDrag:true,tapRecall:true};
};
