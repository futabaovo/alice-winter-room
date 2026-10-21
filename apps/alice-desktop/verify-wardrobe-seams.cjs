const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
exports.verifyWardrobeSeams=async(window,output)=>{
  const js=code=>window.webContents.executeJavaScript(code,true),results=[];
  // Wearing depth must never squeeze the original bangs or the native face.
  const isolation=await js(`(()=>{
    const a=aliceApp,c=a.character;a.wardrobe.set('white',{save:false});a.setView('face');a.setMood(0);a.settle();a.renderNow();
    const original=c.model.drawables.vertexPositions.map(v=>Array.from(v)),before=a.wardrobe.diagnostic();
    a.wardrobe.setCapOffset(.06);c.render();const after=a.wardrobe.diagnostic();
    const unchanged=original.every((v,i)=>v.every((n,j)=>n===c.model.drawables.vertexPositions[i][j]));
    a.wardrobe.setCapOffset(0);c.render();
    return {nativeMeshesUnchanged:unchanged,hairUnchanged:before.meshes.whiteHair.signature===after.meshes.whiteHair.signature,fringeUnchanged:before.meshes.whiteFringe.signature===after.meshes.whiteFringe.signature,capMoves:before.meshes.whiteCap.signature!==after.meshes.whiteCap.signature,capWidthChange:Math.abs(before.capExtent.width-after.capExtent.width),capHeightChange:Math.abs(before.capExtent.height-after.capExtent.height),capFit:before.capFit};
  })()`);
  assert(isolation.nativeMeshesUnchanged&&isolation.hairUnchanged&&isolation.fringeUnchanged&&isolation.capMoves,'Cap depth altered the face or hair '+JSON.stringify(isolation));
  assert(isolation.capWidthChange<1e-5&&isolation.capHeightChange<1e-5,'Cap depth stretched its shape '+JSON.stringify(isolation));
  const whitePoses=[];
  const poses=[
    {name:'neutral',x:0,y:0,z:0,mouth:0,eyes:.82},
    {name:'closed',x:0,y:0,z:0,mouth:0,eyes:0},
    {name:'left',x:-8,y:0,z:-2,mouth:0,eyes:.82},
    {name:'right',x:8,y:0,z:2,mouth:0,eyes:.82},
    {name:'up',x:0,y:6,z:0,mouth:.4,eyes:.82},
    {name:'down',x:0,y:-6,z:0,mouth:.7,eyes:.82},
    {name:'left-down',x:-8,y:-6,z:-3,mouth:1,eyes:.65},
    {name:'right-up',x:8,y:6,z:3,mouth:.65,eyes:.82}
  ];
  for(const outfit of ['white','penguin'])for(const pose of poses){
    await js(`aliceApp.wardrobe.set('${outfit}',{save:false});aliceApp.setView('face');aliceApp.setMood(0);aliceApp.settle();aliceApp.renderNow();`);
    const result=await js(`(()=>{
      const c=aliceApp.character,p=${JSON.stringify(pose)};
      c.set('ParamAngleX',p.x);c.set('ParamAngleY',p.y);c.set('ParamAngleZ',p.z);c.set('ParamMouthOpenY',p.mouth);c.set('ParamEyeLOpen',p.eyes);c.set('ParamEyeROpen',p.eyes);c.render();
      const f=c.meshBounds('ArtMeshFace'),outline=c.wardrobe.faceContour(),cx=(f.left+f.right)/2,cheeks=[],neck=[];
      for(let t=.55;t<=.88;t+=.03){const y=f.top+t*f.height;for(const side of [-1,1]){const x=outline.edge(side,y)+side*Math.max(.6,f.width*.006);cheeks.push({x,y,alpha:c.alphaAt(x,y)});}}
      for(const dy of [-.015,.015,.045])for(const dx of [-.17,0,.17]){const x=cx+dx*f.width,y=outline.bottom+dy*f.height;neck.push({x,y,alpha:c.alphaAt(x,y)});}
      return {cheeks,neck,finite:c.diagnostic().finite,glError:c.gl.getError(),jawInset:(f.bottom-outline.bottom)/f.height};
    })()`);
    const item={outfit,pose:pose.name,cheekAlpha:Math.min(...result.cheeks.map(v=>v.alpha)),neckAlpha:Math.min(...result.neck.map(v=>v.alpha)),jawInset:result.jawInset,finite:result.finite,glError:result.glError};
    if(outfit==='white')whitePoses.push({name:pose.name,image:await js(`(()=>{const c=aliceApp.character,f=c.meshBounds('ArtMeshFace'),s=c.canvas.width/c.canvas.clientWidth,out=document.createElement('canvas');out.width=310;out.height=380;const ctx=out.getContext('2d');ctx.fillStyle='#e7e2db';ctx.fillRect(0,0,310,380);ctx.drawImage(c.canvas,(f.left-f.width*.6)*s,(f.top-f.height*1.3)*s,f.width*2.2*s,f.width*2.2*760/620*s,0,0,310,380);return out.toDataURL();})()`)});
    if(item.cheekAlpha<230||item.neckAlpha<230)await fs.writeFile(path.join(output,`seam-failure-${outfit}-${pose.name}.png`),(await window.webContents.capturePage()).toPNG());
    assert(item.finite&&!item.glError,'Invalid seam pose '+JSON.stringify(item));
    assert(item.cheekAlpha>=230&&item.neckAlpha>=230,'Visible cheek or jaw/collar seam '+JSON.stringify({item,samples:result}));results.push(item);
  }
  const posePlate=await js(`(async()=>{const out=document.createElement('canvas');out.width=1240;out.height=820;const ctx=out.getContext('2d');ctx.fillStyle='#e7e2db';ctx.fillRect(0,0,1240,820);for(const [i,p]of ${JSON.stringify(whitePoses)}.entries()){const im=new Image();im.src=p.image;await im.decode();const x=i%4*310,y=Math.floor(i/4)*410;ctx.drawImage(im,x,y+30);ctx.fillStyle='#4c4353';ctx.font='18px sans-serif';ctx.textAlign='center';ctx.fillText(p.name,x+155,y+23);}return out.toDataURL();})()`);
  await fs.writeFile(path.join(output,'white-hat-eight-poses.png'),Buffer.from(posePlate.split(',')[1],'base64'));
  // Neutral white close-up on both light and dark backgrounds exposes alpha
  // leaks and duplicate jaw/collar lines that a center-only alpha test misses.
  await js("aliceApp.wardrobe.set('white',{save:false});aliceApp.setView('face');aliceApp.setMood(0);aliceApp.settle();aliceApp.renderNow();");
  const plate=await js(`(()=>{const c=aliceApp.character,f=c.meshBounds('ArtMeshFace'),s=c.canvas.width/c.canvas.clientWidth,out=document.createElement('canvas');out.width=1200;out.height=760;const ctx=out.getContext('2d');for(let i=0;i<2;i++){ctx.fillStyle=i?'#25222a':'#e7e2db';ctx.fillRect(i*600,0,600,760);ctx.drawImage(c.canvas,(f.left-f.width*.4)*s,(f.top-f.height)*s,f.width*1.8*s,f.height*2.45*s,i*600,0,600,760);}return out.toDataURL('image/png');})()`);
  await fs.writeFile(path.join(output,'jaw-collar-check.png'),Buffer.from(plate.split(',')[1],'base64'));
  await fs.writeFile(path.join(output,'jaw-seam-verification.json'),JSON.stringify({ok:true,scope:'Visible alpha contour; cheek and collar overlap in eight head/eye/mouth poses per outfit',isolation,poses:results},null,2));return results;
};
