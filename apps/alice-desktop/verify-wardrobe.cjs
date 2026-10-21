const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
exports.verifyWardrobe=async(window,output,options)=>{
  const js=code=>window.webContents.executeJavaScript(code,true),capture=async name=>{await delay(55);await fs.writeFile(path.join(output,name+'.png'),(await window.webContents.capturePage()).toPNG());};
  await js("aliceApp.state.suspended=true;aliceApp.voice.stop();aliceApp.feeding.setMuted(true);document.getElementById('idle').checked=false;document.getElementById('tracking').checked=false;");
  const looks=[];
  for(const outfit of ['white','penguin','winter']){
    await js(`aliceApp.wardrobe.set('${outfit}',{save:false});aliceApp.setMood(0);aliceApp.setView('full');aliceApp.settle();aliceApp.renderNow();`);await capture(outfit+'-full');
    const state=await js('aliceApp.diagnostic()');assert(state.finite&&!state.glError&&state.visiblePixels>10000);assert(Object.values(state.wardrobe.meshes).every(m=>m.finite));
    await js("aliceApp.setView('portrait');aliceApp.renderNow();");await capture(outfit+'-portrait');
    if(outfit==='white'){
      const detail=await js("(()=>{const c=aliceApp.character,f=c.meshBounds('ArtMeshFace'),scale=c.canvas.width/c.canvas.clientWidth,box={x:f.left-f.width*.6,y:f.top-f.height*1.3,width:f.width*2.2,height:f.width*2.2*760/620},out=document.createElement('canvas');out.width=620;out.height=760;const ctx=out.getContext('2d');ctx.fillStyle='#e7e2db';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(c.canvas,box.x*scale,box.y*scale,box.width*scale,box.height*scale,0,0,out.width,out.height);return out.toDataURL('image/png');})()");await fs.writeFile(path.join(output,'white-head-detail.png'),Buffer.from(detail.split(',')[1],'base64'));
    }
    await js('aliceApp.setMood(6);aliceApp.settle();aliceApp.renderNow();');await capture(outfit+'-closed');looks.push({outfit,wardrobe:state.wardrobe,pixels:state.visiblePixels,glError:state.glError});
  }
  const jawSeams=await require('./verify-wardrobe-seams.cjs').verifyWardrobeSeams(window,output);
  const interactions=await require('./verify-wardrobe-interaction.cjs').verifyWardrobeInteraction(window,output,options);
  const report={ok:true,looks,jawSeams,interactions};await fs.writeFile(path.join(output,'wardrobe-verification.json'),JSON.stringify(report,null,2));return report;
};
