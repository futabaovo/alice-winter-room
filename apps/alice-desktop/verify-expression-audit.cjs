const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),{nativeImage}=require('electron');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
exports.verifyExpressionAudit=async(window,output,{expressionAuditRound})=>{
  const js=code=>window.webContents.executeJavaScript(code,true),round=Number(expressionAuditRound),report={round,expressions:[],frames:0};
  await js("aliceApp.reset();aliceApp.petOptions.save({robinEnabled:false});aliceApp.wardrobe.set('winter',{save:false});document.getElementById('idle').checked=false;document.getElementById('tracking').checked=false;aliceApp.pause(true);aliceApp.setView('face');aliceApp.showPanel(null)");await delay(180);
  const catalog=await js('aliceApp.definitions.map(d=>({id:d.id,name:d.name}))');assert.equal(catalog.length,20);
  const variations=round===1?[{id:'full',intensity:1},{id:'normal',intensity:.8},{id:'low',intensity:.2}]:[{id:'authored'},{id:'blink-half',blink:.5},{id:'blink-closed',blink:0},{id:'look-left-up',x:-.75,y:.55},{id:'look-right-down',x:.75,y:-.55},{id:'talk',mouth:.42},{id:'after-switch',from:'dizzy'}];
  const capture=async(mood,test)=>{
    const r=await js(`(()=>{const a=aliceApp,c=a.character,t=${JSON.stringify(test)};a.state.intensity=t.intensity??.8;if(t.from){a.setMood(a.definitions.findIndex(d=>d.id===t.from));a.settle();a.renderNow();}a.setMood(a.definitions.findIndex(d=>d.id==='${mood.id}'));a.settle();a.renderNow();if(t.blink!==undefined)for(const s of ['L','R']){const id='ParamEye'+s+'Open';c.set(id,c.model.parameters.values[c.parameterIndex[id]]*t.blink);}if(t.x!==undefined)c.set('ParamEyeBallX',c.model.parameters.values[c.parameterIndex.ParamEyeBallX]+t.x);if(t.y!==undefined)c.set('ParamEyeBallY',c.model.parameters.values[c.parameterIndex.ParamEyeBallY]+t.y);if(t.mouth!==undefined)c.set('ParamMouthOpenY',t.mouth);c.render();const d=c.model.drawables,f=c.meshBounds('ArtMeshFace'),h=c.meshBounds('ArtMeshHeadwear');return {png:a.capture(),diagnostic:c.diagnostic(),scale:c.canvas.width/c.canvas.clientWidth,rect:{x:f.left-f.width*.56,y:h.top-8,width:f.width*2.12,height:f.bottom+f.height*.4-h.top+8},eyes:Object.fromEntries(['L','R'].map(s=>[s,{open:c.model.parameters.values[c.parameterIndex['ParamEye'+s+'Open']],openLash:d.opacities[d.ids.indexOf('ArtMeshEyelash'+s)],closedLash:d.opacities[d.ids.indexOf('ArtMeshEyeClose'+s)],iris:d.opacities[d.ids.indexOf('ArtMeshIrides'+s)]}])),browCount:d.ids.filter(id=>/^ArtMeshEyebrow[LR]$/.test(id)).length};})()`);
    const d=r.diagnostic;assert(d.finite&&d.expressionMeshesFinite&&!d.glError&&d.visiblePixels>10000,mood.id+' '+test.id);assert.equal(r.browCount,2);
    for(const e of Object.values(r.eyes))if(e.open===0)assert(e.openLash<.01&&e.closedLash>.99&&e.iris<.01,'Duplicate open/closed eye at '+mood.id+' '+test.id);
    const im=nativeImage.createFromBuffer(Buffer.from(r.png.split(',')[1],'base64')),size=im.getSize(),x=Math.max(0,Math.floor(r.rect.x*r.scale)),y=Math.max(0,Math.floor(r.rect.y*r.scale)),width=Math.min(size.width-x,Math.ceil(r.rect.width*r.scale)),height=Math.min(size.height-y,Math.ceil(r.rect.height*r.scale));await fs.writeFile(path.join(output,mood.id+'-'+test.id+'.png'),im.crop({x,y,width,height}).toPNG());report.frames++;
    return {variation:test.id,eyes:r.eyes,finite:true};
  };
  for(const mood of catalog){const frames=[];for(const test of variations)frames.push(await capture(mood,test));report.expressions.push({...mood,frames});}
  if(round===1){
    await capture(catalog.find(m=>m.id==='startled'),{id:'isolation-base',intensity:1});
    for(const layer of ['without-brows','without-lashes','brows-only','lashes-only']){
      const png=await js(`(()=>{const c=aliceApp.character,d=c.model.drawables,all=c.order,layer='${layer}';try{c.order=all.filter(i=>layer==='without-brows'?!/^ArtMeshEyebrow/.test(d.ids[i]):layer==='without-lashes'?!/^ArtMeshEyelash/.test(d.ids[i]):layer==='brows-only'?/^ArtMeshEyebrow/.test(d.ids[i]):/^ArtMeshEyelash/.test(d.ids[i]));c.render();return aliceApp.capture();}finally{c.order=all;c.render();}})()`);await fs.writeFile(path.join(output,layer+'.png'),Buffer.from(png.split(',')[1],'base64'));
    }
  }
  report.ok=true;await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2));return report;
};
