const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
exports.verifyKeyboard=async(room,output,{keyboardMode:k,desktopPet:pet})=>{
  const errors=[],report={rounds:[],switches:[]},js=async(s,w=k.window)=>{try{return await w.webContents.executeJavaScript(s,true);}catch(e){throw Error(e.message+' Script: '+s);}};
  await js("aliceApp.characterStyle.set('chibi');aliceApp.wardrobe.set('white');",room);await delay(80);
  await k.open();k.window.webContents.on('console-message',d=>{if(d.level==='error')errors.push(d.message);});
  assert(k.active&&pet.roomActive);assert.equal(await js('aliceApp.state.suspended',room),true);
  for(let i=0;i<60&&k.state==='starting';i++)await delay(100);assert.equal(k.state,'listening','Raw Input helper did not start');report.nativeStarted=true;
  assert.equal(await js('typeof window.aliceDesktop'),'undefined','keyboard page must not expose chat / credential APIs');
  report.shortcuts=await require('./verify-keyboard-reactions.cjs').verifyReactions(k,output);
  for(let round=1;round<=2;round++){
    const capture=await js(`(()=>{const sheet=document.createElement('canvas');sheet.width=768;sheet.height=744;const g=sheet.getContext('2d');g.fillStyle='${round===1?'#eee5dc':'#241e31'}';g.fillRect(0,0,768,744);const stats=[];for(const [row,outfit]of ['winter','white','penguin'].entries())for(let frame=0;frame<4;frame++){const c=document.createElement('canvas');c.width=192;c.height=224;const a=c.getContext('2d'),bounds=keyboardApp.sprites.draw(a,{outfit,frame}),p=a.getImageData(0,0,192,224).data;let opaque=0;for(let j=3;j<p.length;j+=4)if(p[j]>100)opaque++;if(opaque<4000||p[3]!==0)throw Error('Invalid sprite transparency');g.imageSmoothingEnabled=false;g.drawImage(c,frame*192,row*248);g.fillStyle='${round===1?'#55435f':'#e4d2ed'}';g.font='12px Microsoft YaHei';g.fillText(outfit+' / '+['待机','左敲','右敲','闭眼'][frame],frame*192+18,row*248+239);stats.push({outfit,frame,opaque,bounds});}return {png:sheet.toDataURL(),stats};})()`);
    for(const outfit of ['winter','white','penguin']){const poses=capture.stats.filter(p=>p.outfit===outfit),heights=poses.map(p=>p.bounds.h),widths=poses.map(p=>p.bounds.w);assert(Math.max(...heights)-Math.min(...heights)<=4,'Pose registration jumps in height: '+outfit);assert(Math.max(...widths)-Math.min(...widths)<=4,'Pose registration jumps in width: '+outfit);}
    await fs.writeFile(path.join(output,'pixel-review-round'+round+'.png'),Buffer.from(capture.png.split(',')[1],'base64'));report.rounds.push({round,frames:capture.stats});
  }
  // Verify simulated animation pulses locally after proving the native helper
  // starts, so the user's real keyboard activity cannot alter this sequence.
  for(const outfit of ['winter','white','penguin']){k.save({outfit,scope:'local'});await delay(70);k.pulse('key');await delay(45);assert.equal(await js('keyboardApp.motion.count'),1);await fs.writeFile(path.join(output,'keyboard-'+outfit+'.png'),(await k.window.webContents.capturePage()).toPNG());await delay(800);assert.equal(await js('keyboardApp.motion.phase'),'idle');}
  if(process.argv.includes('--record-keyboard'))report.preview=await require('./verify-keyboard-shortcuts-record.cjs').recordKeyboard(k.window,output);
  if(process.argv.includes('--record-pages'))report.pagePreview=await require('./verify-keyboard-pages-record.cjs').recordPages(k.window,output);
  report.sizes=[];for(const scale of [70,150,100]){k.save({scale});await delay(60);const bounds=k.window.getBounds(),area=require('electron').screen.getDisplayMatching(bounds).workArea;assert(bounds.x>=area.x&&bounds.y>=area.y&&bounds.x+bounds.width<=area.x+area.width&&bounds.y+bounds.height<=area.y+area.height);const ui=await js("(()=>{const r=document.getElementById('return-room').getBoundingClientRect();return {bottom:r.bottom,right:r.right,width:innerWidth,height:innerHeight};})()");assert(ui.bottom<=ui.height&&ui.right<=ui.width,'Controls clipped at scale '+scale);report.sizes.push({scale,bounds});if(scale!==100)await fs.writeFile(path.join(output,'keyboard-scale-'+scale+'.png'),(await k.window.webContents.capturePage()).toPNG());}
  k.save({paused:true});await delay(70);k.pulse('key');await delay(70);assert.equal(await js('keyboardApp.motion.count'),0);assert.equal(k.input.child,null);report.pauseDropsInput=true;
  k.save({paused:false,scope:'local'});await delay(60);assert.equal(k.input.child,null);await js("document.getElementById('pixel').focus()");k.window.webContents.sendInputEvent({type:'keyDown',keyCode:'A'});k.window.webContents.sendInputEvent({type:'keyUp',keyCode:'A'});await delay(50);assert.equal(await js('keyboardApp.motion.count'),1);report.localNativeEvent=true;
  await js('keyboardApp.setPanel(true)');await fs.writeFile(path.join(output,'keyboard-settings.png'),(await k.window.webContents.capturePage()).toPNG());await js('keyboardApp.setPanel(false)');
  k.save({scope:'global'});await delay(200);k.powerPause('test',true);assert.equal(k.input.child,null);assert.equal(k.state,'paused');k.powerPause('test',false);await delay(300);assert.equal(k.state,'listening');report.lockLifecycle=true;
  const normal=await js('({style:aliceApp.characterStyle.selected,outfit:aliceApp.wardrobe.selected})',room);assert.equal(normal.style,'chibi');assert.equal(normal.outfit,'white');
  await k.exit('pet');assert(!k.active&&k.input.child===null&&!pet.roomActive);for(let i=0;i<100;i++){if(await js('Boolean(window.aliceApp?.state.ready)',pet.window))break;await delay(100);}assert.equal(await js('aliceApp.characterStyle.selected',pet.window),'chibi');assert.equal(await js('aliceApp.wardrobe.selected',pet.window),'white');const savedBounds=pet.window.getBounds();
  await pet.dock('right');await delay(100);const beforeSide=pet.edge.side;
  await k.open();await delay(80);assert(k.active);assert.equal(pet.edge.side,beforeSide);assert(pet.edge.paused);
  await k.exit('pet');assert.equal(pet.edge.side,beforeSide);assert.equal(pet.edge.paused,false);await pet.recall();
  assert.deepEqual(pet.window.getBounds(),savedBounds);report.switches.push({petRestored:true,outfitPreserved:true,boundsPreserved:true,edgePreserved:true});
  await k.open();await delay(50);await k.exit('room');assert(!k.active&&pet.roomActive&&k.input.child===null);await delay(50);assert.equal(await js('aliceApp.state.suspended',room),false);report.switches.push({roomRestored:true});
  await js("{const g=document.getElementById('pixel').getContext('2d');window.__idlePaints=0;window.__originalDraw=g.drawImage;g.drawImage=function(...args){window.__idlePaints++;return window.__originalDraw.apply(this,args);};}void 0;");
  await delay(500);report.hiddenCanvasPaints=await js('window.__idlePaints');
  await js("document.getElementById('pixel').getContext('2d').drawImage=window.__originalDraw;void 0;");
  await fs.writeFile(path.join(output,'idle-render-measurement.json'),JSON.stringify({hiddenCanvasPaints:report.hiddenCanvasPaints,intervalMs:500}));
  assert.equal(report.hiddenCanvasPaints,0,'Hidden keyboard window continues drawing');
  await k.open();k.save({scope:'local',paused:false});await delay(100);
  await js("keyboardApp.motion.reset();keyboardApp.motion.nextBlink=keyboardApp.motion.time+10;keyboardApp.motion.blinkStart=-10;keyboardApp.draw(0);window.__idlePaints=0;document.getElementById('pixel').getContext('2d').drawImage=function(...args){window.__idlePaints++;return window.__originalDraw.apply(this,args);};void 0;");
  await delay(500);report.stillCanvasPaints=await js('window.__idlePaints');assert.equal(report.stillCanvasPaints,0,'Unchanged idle sprite is being repainted');
  const eyesOpen=await js('keyboardApp.capture()');await js('keyboardApp.motion.nextBlink=keyboardApp.motion.time;void 0;');await delay(45);
  assert.notEqual(await js('keyboardApp.capture()'),eyesOpen,'Blink did not repaint after idle');await delay(250);assert.equal(await js('keyboardApp.capture()'),eyesOpen,'Blink did not restore idle');report.idleBlinkRestores=true;
  k.save({paused:true});await delay(80);await js('window.__idlePaints=0');await delay(500);report.pausedCanvasPaints=await js('window.__idlePaints');assert.equal(report.pausedCanvasPaints,0);
  k.save({paused:false});await delay(50);await js('document.getElementById("pixel").focus()');k.window.webContents.sendInputEvent({type:'keyDown',keyCode:'A'});k.window.webContents.sendInputEvent({type:'keyUp',keyCode:'A'});await delay(50);assert.equal(await js('keyboardApp.motion.count'),1);assert((await js('window.__idlePaints'))>0);report.resumeRepaints=true;
  await js("document.getElementById('pixel').getContext('2d').drawImage=window.__originalDraw;void 0;");await k.exit('room');
  await fs.writeFile(path.join(output,'idle-render-measurement.json'),JSON.stringify({hiddenCanvasPaints:report.hiddenCanvasPaints,stillCanvasPaints:report.stillCanvasPaints,pausedCanvasPaints:report.pausedCanvasPaints,intervalMs:500,idleBlinkRestores:report.idleBlinkRestores,resumeRepaints:report.resumeRepaints},null,2));
  assert.deepEqual(errors,[]);report.errors=errors;return report;
};
