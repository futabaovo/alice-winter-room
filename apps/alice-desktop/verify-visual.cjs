/* Exercise the art in motion, including iris-to-lid coverage rather than just
 * nonblank frames. All pictures are real Cubism Core renders. */
const fs=require('node:fs/promises');
const path=require('node:path');

exports.verifyVisual=async(window,output,{enforce=false}={})=>{
 const directory=path.join(output,'visual-audit');await fs.mkdir(directory,{recursive:true});
 const setup=await window.webContents.executeJavaScript(`(()=>{document.getElementById('idle').checked=false;document.getElementById('tracking').checked=false;aliceApp.pause(true);aliceApp.setView('face');const c=aliceApp.character;return {version:document.title,definitions:aliceApp.definitions.map(d=>({id:d.id,name:d.name,parameters:d.expression.Parameters,faceShadow:d.faceShadow||0})),ids:c.model.drawables.ids,parameterLimits:Object.fromEntries(c.model.parameters.ids.map((id,i)=>[id,[c.model.parameters.minimumValues[i],c.model.parameters.maximumValues[i]]]))};})()`);
 const directions=[['center',0,0],['left',-.75,0],['right',.75,0],['up',0,.55],['down',0,-.55],['upper-left',-.75,.55],['upper-right',.75,.55],['lower-left',-.75,-.55],['lower-right',.75,-.55]];
 const cases=[];
 for(const mood of setup.definitions)for(const [direction,x,y]of directions)cases.push({name:`mood-${mood.id}-${direction}`,mood:mood.id,x,y,metrics:true});
 for(const open of [1,.75,.5,.25,.08,.04,0])for(const [direction,x,y]of directions)cases.push({name:`blink-${open}-${direction}`,mood:'neutral',x,y,open,metrics:true});
 for(const x of [-15,0,15])for(const y of [-8,0,8])cases.push({name:`turn-${x}-${y}`,mood:'neutral',angleX:x,angleY:y,metrics:false});
 for(const x of [-22,0,22])for(const y of [-14,0,14])cases.push({name:`gesture-limit-${x}-${y}`,mood:'neutral',angleX:x,angleY:y,metrics:false});
 for(const x of [-1,0,1])for(const y of [-1,0,1])cases.push({name:`native-limit-${x}-${y}`,mood:'neutral',x,y,metrics:true});
 for(const hair of [-.1,0,.1])cases.push({name:`hair-${hair}`,mood:'neutral',hair,metrics:false});
 for(const mood of setup.definitions)for(const intensity of [0,.5,.8])cases.push({name:`intensity-${mood.id}-${intensity}`,mood:mood.id,intensity,metrics:false});
 for(const view of ['full','portrait','face'])for(const zoom of [.7,1,1.3])cases.push({name:`view-${view}-${zoom}`,mood:'neutral',view,zoom,metrics:false});
 const captures=[];
 for(const test of cases){
  const mood=setup.definitions.find(m=>m.id===test.mood);
  const result=await window.webContents.executeJavaScript(`(()=>{
   const test=${JSON.stringify(test)},mood=${JSON.stringify(mood)},c=aliceApp.character,d=c.model.drawables,gl=c.gl;
   c.reset();c.mode=test.view||'face';c.zoom=test.zoom||1;c.faceShadow=mood.faceShadow*(test.intensity===undefined?1:test.intensity);
   for(const item of mood.parameters){const i=c.parameterIndex[item.Id],value=test.intensity===undefined?item.Value:c.model.parameters.defaultValues[i]+(item.Value-c.model.parameters.defaultValues[i])*test.intensity;c.set(item.Id,item.Value===0&&/Eye[LR]Open/.test(item.Id)?0:value);}
   const add=(id,v)=>c.set(id,c.model.parameters.values[c.parameterIndex[id]]+v);
   add('ParamEyeBallX',test.x||0);add('ParamEyeBallY',test.y||0);
   if(test.open!==undefined){c.set('ParamEyeLOpen',test.open);c.set('ParamEyeROpen',test.open);}
   if(test.angleX!==undefined)c.set('ParamAngleX',test.angleX);
   if(test.angleY!==undefined)c.set('ParamAngleY',test.angleY);
   if(test.hair!==undefined){c.set('ParamHairFront',test.hair);c.set('ParamHairBack',test.hair);}
   c.render();const diagnostic=c.diagnostic(),png=aliceApp.capture();
   let closedIrisVisiblePixels=null;
   if(c.model.parameters.values[c.parameterIndex.ParamEyeLOpen]===0&&c.model.parameters.values[c.parameterIndex.ParamEyeROpen]===0){
    const all=c.order,withIris=new Uint8Array(c.canvas.width*c.canvas.height*4);gl.readPixels(0,0,c.canvas.width,c.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,withIris);
    try{c.order=all.filter(i=>!/^ArtMeshIrides/.test(d.ids[i]));c.render();const withoutIris=new Uint8Array(withIris.length);gl.readPixels(0,0,c.canvas.width,c.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,withoutIris);closedIrisVisiblePixels=0;
     for(let i=0;i<withIris.length;i+=4)if(withIris[i+3]>200&&Math.abs(withIris[i]-withoutIris[i])+Math.abs(withIris[i+1]-withoutIris[i+1])+Math.abs(withIris[i+2]-withoutIris[i+2])>30)closedIrisVisiblePixels++;
    }finally{c.order=all;c.render();}
   }
   const metrics=[];
   if(test.metrics){
    const all=c.order;
    const pixels=index=>{c.order=[index];c.render();const values=new Uint8Array(c.canvas.width*c.canvas.height*4);gl.readPixels(0,0,c.canvas.width,c.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,values);return values;};
    try{for(const side of ['R','L']){
     const whiteIndex=d.ids.indexOf('ArtMeshEyewhite'+side),irisIndex=d.ids.indexOf('ArtMeshIrides'+side);
     const white=pixels(whiteIndex),iris=pixels(irisIndex),w=c.canvas.width,h=c.canvas.height;
     let minX=w,maxX=-1,minY=h,maxY=-1,leak=0,whiteMinY=h,whiteMaxY=-1,irisCount=0;
     // The onscreen white uses MSAA whereas its mask target does not. Measure
     // opaque escape, avoiding a one-pixel antialiasing threshold mismatch.
     for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4+3;if(white[i]>200){whiteMinY=Math.min(whiteMinY,y);whiteMaxY=Math.max(whiteMaxY,y);}if(iris[i]>200){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);irisCount++;}if(iris[i]>200&&white[i]<30)leak++;}
     const gaps=[];const from=Math.ceil(minX+(maxX-minX)*.35),to=Math.floor(minX+(maxX-minX)*.65);
     for(let x=from;x<=to&&x<w;x++){let wb=-1,ib=-1;for(let y=0;y<h;y++){const i=(y*w+x)*4+3;if(wb<0&&white[i]>200)wb=y;if(ib<0&&iris[i]>200)ib=y;}if(wb>=0&&ib>=0)gaps.push(Math.max(0,ib-wb));}
     const mean=gaps.length?gaps.reduce((a,b)=>a+b,0)/gaps.length:0,height=Math.max(1,whiteMaxY-whiteMinY+1);
     metrics.push({side,irisPixels:irisCount,leakPixels:leak,bottomGapPixels:mean,bottomGapFraction:mean/height,whiteHeight:height,irisHeight:Math.max(0,maxY-minY+1),irisCenterX:irisCount?(minX+maxX)/2:null});
    }}finally{c.order=all;c.render();}
   }
   return {png,diagnostic,metrics,closedIrisVisiblePixels,lidOpacities:Object.fromEntries(d.ids.map((id,i)=>[id,d.opacities[i]]).filter(([id])=>/^ArtMesh(Eyelash|EyeClose)/.test(id)))};
  })()`);
  if(!result.diagnostic.finite||result.diagnostic.glError||result.diagnostic.visiblePixels<10000)throw Error('Invalid visual-audit frame: '+test.name);
  await fs.writeFile(path.join(directory,test.name+'.png'),Buffer.from(result.png.split(',')[1],'base64'));
  captures.push({...test,parameters:result.diagnostic.parameters,pixelChecksum:result.diagnostic.pixelChecksum,metrics:result.metrics,closedIrisVisiblePixels:result.closedIrisVisiblePixels,lidOpacities:result.lidOpacities});
 }
 const checks={frames:captures.length,irisNeverLeaks:captures.every(c=>c.metrics.every(m=>m.leakPixels===0)),closedEyesHideIrises:captures.filter(c=>c.closedIrisVisiblePixels!==null).every(c=>c.closedIrisVisiblePixels<=4),maxClosedIrisVisiblePixels:Math.max(...captures.map(c=>c.closedIrisVisiblePixels||0)),maxBottomGapFraction:Math.max(...captures.filter(c=>c.mood==='neutral'&&(c.open===undefined||c.open===1)).flatMap(c=>c.metrics.map(m=>m.bottomGapFraction)))};
 const failures=[];
 if(!checks.irisNeverLeaks)failures.push('Iris pixels escape the native eye-white clipping mask.');
 if(!checks.closedEyesHideIrises)failures.push('A fully closed expression still shows iris pixels.');
 checks.authoredClosedLashesActive=captures.filter(c=>c.closedIrisVisiblePixels!==null).every(c=>['L','R'].every(side=>c.lidOpacities['ArtMeshEyeClose'+side]>.99&&c.lidOpacities['ArtMeshEyelash'+side]<.01));
 if(!checks.authoredClosedLashesActive)failures.push('Authored closed lashes are absent, or duplicate open lashes remain at closure.');
 if(checks.maxBottomGapFraction>.04)failures.push('Neutral gaze exposes a lower crescent greater than 4% of the eye aperture.');
 const report={ok:failures.length===0,enforced:enforce,checks,failures,parameterLimits:setup.parameterLimits,captures};
 await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2));
 await window.webContents.executeJavaScript("aliceApp.reset();document.getElementById('idle').checked=false;document.getElementById('tracking').checked=true;aliceApp.state.gaze={x:0,y:0};aliceApp.settle();aliceApp.renderNow();const c=aliceApp.character,r=c.canvas.getBoundingClientRect();c.canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:r.right,clientY:r.top+r.height*.5}));");
 await new Promise(resolve=>setTimeout(resolve,60));
 const first=await window.webContents.executeJavaScript('aliceApp.state.gaze.x');
 await new Promise(resolve=>setTimeout(resolve,500));
 const settled=await window.webContents.executeJavaScript('aliceApp.state.gaze.x');
 await window.webContents.executeJavaScript("aliceApp.character.canvas.dispatchEvent(new PointerEvent('pointerleave'));");
 await new Promise(resolve=>setTimeout(resolve,500));
 const returned=await window.webContents.executeJavaScript('aliceApp.state.gaze.x');
 report.gazeTransition={first,settled,returned,target:.75};
 if(!(first>0&&first<.75&&settled>.7&&Math.abs(returned)<.03)){report.ok=false;report.failures.push('Gaze easing or return-to-center failed.');}
 await fs.writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2));
 await window.webContents.executeJavaScript("aliceApp.reset();document.getElementById('idle').checked=false;document.getElementById('tracking').checked=false;aliceApp.pause(true);aliceApp.settle();aliceApp.renderNow();");
 if(enforce&&failures.length)throw Error('Visual audit: '+failures.join(' '));
 return {ok:report.ok,checks,failures};
};
