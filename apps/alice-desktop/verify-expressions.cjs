const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{nativeImage}=require('electron');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
exports.verifyExpressions=async(window,output,{desktopPet})=>{
  const js=code=>window.webContents.executeJavaScript(code,true),faces=new Map(),report={moods:[],wardrobes:[],pet:[],checks:{}};
  await js("aliceApp.reset();aliceApp.petOptions.save({robinEnabled:false});document.getElementById('idle').checked=false;document.getElementById('tracking').checked=false;aliceApp.pause(true);aliceApp.setView('face');document.getElementById('intensity').value=100;document.getElementById('intensity').dispatchEvent(new Event('input'));aliceApp.showPanel(null)");
  await delay(180);await js('aliceApp.setMood(0);aliceApp.settle();aliceApp.renderNow();aliceApp.renderNow()');
  const catalog=await js('aliceApp.definitions.map(d=>({id:d.id,name:d.name}))');assert.equal(catalog.length,20);
  const snap=async(id,save=false)=>{
    const result=await js(`(()=>{const a=aliceApp,c=a.character;a.setMood(a.definitions.findIndex(d=>d.id==='${id}'));a.settle();a.renderNow();const f=c.meshBounds('ArtMeshFace'),h=c.meshBounds('ArtMeshHeadwear');return {png:a.capture(),diagnostic:a.diagnostic(),rect:{x:f.left-f.width*.56,y:h.top-8,width:f.width*2.12,height:f.bottom+f.height*.4-h.top+8},dpr:c.canvas.width/c.canvas.clientWidth};})()`);
    const d=result.diagnostic;assert(d.finite&&d.expressionMeshesFinite&&d.visiblePixels>10000&&!d.glError,id);
    const image=nativeImage.createFromBuffer(Buffer.from(result.png.split(',')[1],'base64')),size=image.getSize(),r=result.rect,k=result.dpr,x=Math.max(0,Math.floor(r.x*k)),y=Math.max(0,Math.floor(r.y*k)),width=Math.min(size.width-x,Math.ceil(r.width*k)),height=Math.min(size.height-y,Math.ceil(r.height*k)),face=image.crop({x,y,width,height});
    if(save)await fs.writeFile(path.join(output,id+'.png'),face.toPNG());
    faces.set(id,face.getBitmap());
    return {id,checksum:d.pixelChecksum,faceChecksum:crypto.createHash('sha256').update(face.getBitmap()).digest('hex'),parameters:d.parameters,spiral:d.spiralEyes};
  };
  for(const mood of catalog){report.moods.push({...mood,...await snap(mood.id,true)});if(mood.id==='neutral')await fs.copyFile(path.join(output,'neutral.png'),path.join(output,'neutral-initial.png'));}
  assert.equal(new Set(report.moods.map(d=>d.checksum)).size,20,'Duplicate differential images');
  const initialFace=faces.get('neutral');assert.equal((await snap('dizzy')).spiral,1);const restored=await snap('neutral',true);assert.equal(restored.spiral,0);assert.deepEqual(restored.parameters,report.moods[0].parameters,'Parameters failed to restore');const finalFace=faces.get('neutral');assert.equal(initialFace.length,finalFace.length);let maxDifference=0;for(let n=0;n<initialFace.length;n++)maxDifference=Math.max(maxDifference,Math.abs(initialFace[n]-finalFace[n]));assert(maxDifference<=2,'Special effect leaked into neutral face');report.checks.spiralClears={maxChannelDifference:maxDifference,tolerance:2};
  // Compare actual pixels with/without irises, not merely their parameter value.
  const closures=[];
  for(const id of ['smile','rest','bow','sigh']){
    await snap(id);
    const closed=await js(`(()=>{const c=aliceApp.character,d=c.model.drawables,g=c.gl,all=c.order,pixels=()=>{const a=new Uint8Array(c.canvas.width*c.canvas.height*4);g.readPixels(0,0,c.canvas.width,c.canvas.height,g.RGBA,g.UNSIGNED_BYTE,a);return a;},before=pixels();let changes=0;try{c.order=all.filter(i=>!/^ArtMeshIrides/.test(d.ids[i]));c.render();const after=pixels();for(let i=0;i<before.length;i+=4)if(Math.abs(before[i]-after[i])+Math.abs(before[i+1]-after[i+1])+Math.abs(before[i+2]-after[i+2])>30)changes++;}finally{c.order=all;c.render();}return {changes,closed:['L','R'].every(s=>d.opacities[d.ids.indexOf('ArtMeshEyeClose'+s)]>.99&&d.opacities[d.ids.indexOf('ArtMeshEyelash'+s)]<.01)};})()`);
    assert(closed.changes<=4&&closed.closed,'Broken closed-eye layers: '+id);closures.push({id,...closed});
  }report.checks.closures=closures;
  const masks=[];
  for(const id of ['startled','puzzled','dizzy','stern','skeptical'])for(const gaze of [-1,0,1]){
    await snap(id);
    const result=await js(`(()=>{const c=aliceApp.character,d=c.model.drawables,g=c.gl,all=c.order;c.set('ParamEyeBallX',${gaze});c.set('ParamEyeBallY',${gaze}*.55);c.render();const results=[];const pixels=index=>{c.order=[index];c.render();const p=new Uint8Array(c.canvas.width*c.canvas.height*4);g.readPixels(0,0,c.canvas.width,c.canvas.height,g.RGBA,g.UNSIGNED_BYTE,p);return p;};try{for(const side of ['L','R']){const white=pixels(d.ids.indexOf('ArtMeshEyewhite'+side)),iris=pixels(d.ids.indexOf('ArtMeshIrides'+side));let leaked=0;for(let i=3;i<white.length;i+=4)if(iris[i]>200&&white[i]<30)leaked++;results.push({side,leaked});}}finally{c.order=all;c.render();}return results;})()`);
    assert(result.every(r=>r.leaked===0),'Deformed iris escaped clipping: '+id);masks.push({id,gaze,...{eyes:result}});
  }report.checks.eyeMasks=masks;
  for(const outfit of ['white','penguin']){await js(`aliceApp.wardrobe.set('${outfit}',{save:false})`);for(const {id}of catalog.slice(11))report.wardrobes.push({outfit,...await snap(id)});}
  await js("aliceApp.wardrobe.set('winter',{save:false});aliceApp.setMood(0);aliceApp.layout.setTools(true,'moods');document.querySelector('[data-mood-filter=special]').click()");
  report.checks.previews=await js("(async()=>{const images=Array.from(document.querySelectorAll('.mood img'));for(const image of images)image.loading='eager';await Promise.all(images.map(i=>i.decode()));return images.length;})()");assert.equal(report.checks.previews,20);
  assert.deepEqual(await js("Array.from(document.querySelectorAll('.mood:not([hidden])')).map(b=>b.dataset.mood)"),['dizzy']);await js("document.querySelector('[data-mood=dizzy]').click()");assert.equal(await js('aliceApp.diagnostic().mood'),'圈圈眼');await js("document.querySelector('[data-mood-filter=all]').click()");
  await js("aliceApp.setMood(0);document.querySelector('[data-mood-filter=daily]').click();document.getElementById('tools-panel').scrollTop=0");await delay(400);assert.equal(await js("document.getElementById('tools-panel').hidden"),false);
  await fs.writeFile(path.join(output,'expression-panel.png'),(await window.webContents.capturePage()).toPNG());report.checks.filters=true;
  await js("aliceApp.showPanel(null);aliceApp.setMood(0);aliceApp.settle();aliceApp.renderNow();aliceApp.pause(false);aliceApp.setMood(aliceApp.definitions.findIndex(d=>d.id==='speechless'))");await delay(40);const early=await js('aliceApp.diagnostic().parameters.ParamEyeLOpen');await delay(550);const settled=await js('aliceApp.diagnostic().parameters.ParamEyeLOpen');assert(early>settled+.04&&settled<.5,'Expression transition snapped or did not finish');report.checks.transition={early,settled};
  await js("aliceApp.setMood(0);const p=aliceApp.replyPerformance,t=p.reserve();p.accept(t,{ja:'これは、少し困るわ。',expressionEvents:[{sentenceIndex:0,emotion:'speechless',strength:.35,hold:1}]});p.startText(t)");await delay(650);const auto=await js('aliceApp.diagnostic()');assert.equal(auto.mood,'无语');assert(auto.parameters.ParamEyeLOpen<.8);report.checks.newDialogueEvent={mood:auto.mood,open:auto.parameters.ParamEyeLOpen};
  report.performance=await require('./verify-performance.cjs').verifyPerformance(window,output);
  await js('aliceDesktop.petEnter()');const pet=desktopPet.window,pjs=code=>pet.webContents.executeJavaScript(code,true);
  for(let n=0;n<160;n++){if(await pjs('Boolean(window.aliceApp?.state.ready&&aliceApp.character.frames>3)'))break;await delay(80);}
  await pjs("aliceApp.petOptions.save({robinEnabled:false});document.getElementById('idle').checked=false;document.getElementById('tracking').checked=false;aliceApp.pause(true)");
  for(const {id}of catalog.slice(11)){const d=await pjs(`(()=>{aliceApp.setMood(aliceApp.definitions.findIndex(d=>d.id==='${id}'));aliceApp.settle();aliceApp.renderNow();return aliceApp.diagnostic()})()`);assert(d.finite&&!d.glError&&d.visiblePixels>1000);report.pet.push({id,mood:d.mood,spiral:d.spiralEyes});}
  await fs.writeFile(path.join(output,'pet-expression.png'),(await pet.webContents.capturePage()).toPNG());desktopPet.restore();
  report.ok=true;await fs.writeFile(path.join(output,'expression-verification.json'),JSON.stringify(report,null,2));return report;
};
