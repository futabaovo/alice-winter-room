const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
exports.verifyChibiEyes=async(room,output,{desktopPet})=>{
 room.webContents.on('console-message',details=>{if(details.level==='error')console.error('renderer: '+details.message);});
 const js=async(s,w=room)=>{try{return await w.webContents.executeJavaScript(`try {${s}}catch(error){console.error(error.stack);throw error;}`,true);}catch(error){throw Error(error.message+' Script: '+s.slice(0,600));}},report={eyes:[],directions:[]};
 await js("aliceApp.state.suspended=true;aliceApp.voice.stop();aliceApp.pause(false);document.getElementById('idle').checked=false;document.getElementById('tracking').checked=true;aliceApp.characterStyle.set('chibi',{save:false});aliceApp.setView('room');aliceApp.renderNow();");
 for(const outfit of ['winter','white','penguin']){
  const shots=[];
  for(let mood=0;mood<20;mood++){
   const base=await js(`(()=>{aliceApp.wardrobe.set('${outfit}',{save:false});aliceApp.setMood(${mood});aliceApp.settle();aliceApp.renderNow();const c=aliceApp.character;c.chibiState.look={x:0,y:0};c.chibi.render();return c.chibi.eyes.diagnostic();})()`);
   report.eyes.push({outfit,mood,...base});
   for(const x of [-1,0,1]){
    const image=await js(`(()=>{const c=aliceApp.character;c.chibiState.look={x:${x},y:0};c.chibi.render();const s=document.createElement('canvas');s.width=300;s.height=250;const g=s.getContext('2d'),f=c.chibi.local.face;g.fillStyle='#eee5db';g.fillRect(0,0,300,250);const w=f.width*1.7,h=f.height*2,k=Math.min(300/w,250/h);g.drawImage(c.chibi.surface,f.left-f.width*.35,f.top-f.height*.7,w,h,(300-w*k)/2,(250-h*k)/2,w*k,h*k);return s.toDataURL();})()`);
    shots.push({image,label:aliceName(mood)+' '+(x<0?'左':x>0?'右':'中')});
   }
  }
  for(let page=0;page<4;page++){
   const selected=shots.slice(page*15,(page+1)*15),png=await js(`(async()=>{const c=document.createElement('canvas');c.width=900;c.height=1350;const g=c.getContext('2d');g.fillStyle='#eee5db';g.fillRect(0,0,c.width,c.height);for(const [i,s]of ${JSON.stringify(selected)}.entries()){const im=new Image();im.src=s.image;await im.decode();g.drawImage(im,i%3*300,Math.floor(i/3)*270);g.fillStyle='#50465f';g.font='15px Microsoft YaHei';g.fillText(s.label,i%3*300+10,Math.floor(i/3)*270+266);}return c.toDataURL();})()`);
   await fs.writeFile(path.join(output,outfit+'-eyes-'+(page+1)+'.png'),Buffer.from(png.split(',')[1],'base64'));
  }
 }
 await fs.writeFile(path.join(output,'eye-analysis.json'),JSON.stringify(report,null,2));
 report.natural=await require('./verify-chibi-natural.cjs').verifyNatural(room,output);
 if(process.argv.includes('--inspect-chibi-eyes'))return report;
 for(const e of report.eyes)assert.equal(e.count,[1,6,10,16,19].includes(e.mood)?0:2,`${e.outfit} mood ${e.mood}`);
 report.pixelChecks=[];
 for(const outfit of ['winter','white','penguin'])for(let mood=0;mood<20;mood++){
  const checked=await js(`(()=>{
   const c=aliceApp.character;aliceApp.wardrobe.set('${outfit}',{save:false});aliceApp.setMood(${mood});aliceApp.settle();aliceApp.renderNow();c.chibiState.look={x:0,y:0};c.chibi.render();
   const rig=c.chibi.eyes,g=c.chibi.ctx,base=g.getImageData(0,0,512,640).data,vertices=JSON.stringify(Array.from(c.chibi.mesh.positions));
   const sample=()=>{const p=g.getImageData(0,0,512,640).data;return rig.eyes.map(e=>{let mass=0,xs=0,ys=0;const a=e.irisAperture||e.aperture;for(let y=Math.max(0,Math.floor(a.top));y<=a.bottom;y++)for(let x=Math.floor(a.left);x<=a.right;x++){const i=(y*512+x)*4,weight=Math.max(0,180-(p[i]+p[i+1]+p[i+2])/3);mass+=weight;xs+=weight*x;ys+=weight*y;}return {x:xs/mass,y:ys/mass};});};
   const center=sample(),samples=[];let outsideChanges=0,headChanged=false;const diffExamples=[];
   for(const look of [{x:-1,y:0},{x:1,y:0},{x:0,y:-1},{x:0,y:1}]){c.chibiState.look=look;c.chibi.render();const p=g.getImageData(0,0,512,640).data;samples.push({look,centers:sample()});if(JSON.stringify(Array.from(c.chibi.mesh.positions))!==vertices)headChanged=true;
    for(let y=0;y<640;y++)for(let x=0;x<512;x++){if(rig.eyes.some(e=>x>=e.aperture.left-2&&x<=e.aperture.right+2&&y>=e.aperture.top-2&&y<=e.aperture.bottom+2))continue;const i=(y*512+x)*4;if(p[i]!==base[i]||p[i+1]!==base[i+1]||p[i+2]!==base[i+2]||p[i+3]!==base[i+3]){outsideChanges++;if(diffExamples.length<6)diffExamples.push({x,y,before:[...base.slice(i,i+4)],after:[...p.slice(i,i+4)]});}}
   }
   return {count:rig.eyes.length,center,samples,outsideChanges,headChanged,diffExamples,gl:c.gl.getError()};
  })()`);
  assert.equal(checked.outsideChanges,0,`${outfit}/${mood}: pixels outside eyes changed ${JSON.stringify(checked.diffExamples)}`);assert(!checked.headChanged&&!checked.gl);
  for(let i=0;i<checked.count;i++){
   assert(checked.samples[0].centers[i].x<checked.center[i].x-.15,`${outfit}/${mood}: left pupil`);
   assert(checked.samples[1].centers[i].x>checked.center[i].x+.15,`${outfit}/${mood}: right pupil`);
   assert(checked.samples[2].centers[i].y>checked.samples[3].centers[i].y+.03,`${outfit}/${mood}: up/down pupil`);
  }
  report.pixelChecks.push({outfit,mood,outsideChanges:checked.outsideChanges,headChanged:checked.headChanged,pupils:checked.count});
 }
 // Exercise real room pointer input, including coordinates over the chat dock.
 await js("aliceApp.setMood(0);aliceApp.wardrobe.set('winter',{save:false});aliceApp.renderNow();");
 for(const [x,y]of [[-1,0],[0,0],[1,0],[0,-1],[0,1]]){
  const p=await js(`(()=>{const f=aliceApp.character.chibi.trackingFace,c=aliceApp.character.canvas;return {x:Math.round(Math.max(4,Math.min(c.clientWidth-4,f.left+f.width/2+${x}*c.clientWidth*.4))),y:Math.round(Math.max(4,Math.min(c.clientHeight-4,f.top+f.height/2-(${y})*c.clientHeight*.5)))};})()`);
  room.webContents.sendInputEvent({type:'mouseMove',x:p.x,y:p.y});await delay(30);await js("for(let i=0;i<5;i++){aliceApp.state.previous=performance.now()-20;aliceApp.renderNow();}void 0;");
  const d=await js('aliceApp.character.chibi.eyes.diagnostic()');assert.equal(d.pupils.length,2);for(const e of d.pupils){if(x)assert(e.dx*x>0);if(y)assert(e.dy*y<0);}report.directions.push({x,y,pupils:d.pupils});
 }
 await js("document.getElementById('tracking').checked=false;aliceApp.renderNow();");assert(await js('aliceApp.character.chibi.eyes.last.every(e=>Math.abs(e.dx)+Math.abs(e.dy)<.001)'));
 await js("document.getElementById('tracking').checked=true;window.dispatchEvent(new Event('blur'));aliceApp.renderNow();");assert(await js('aliceApp.character.chibi.eyes.last.every(e=>Math.abs(e.dx)+Math.abs(e.dy)<.001)'));
 report.eyePixelsMove=true;report.headAndClothingUnchanged=true;report.controls=true;
 report.headIdle=await js(`(()=>{const c=aliceApp.character;aliceApp.setMood(0);aliceApp.wardrobe.set('winter',{save:false});aliceApp.renderNow();c.chibiState.look={x:0,y:0};c.chibiState.idle=false;c.chibi.render();const base=Array.from(c.chibi.mesh.positions),local=c.chibi.mesh.local,neck=c.chibi.local.face.bottom+c.chibi.local.face.height*.38,poses=[];let bodyChanges=0;for(const time of [-1,-.4,.4,1]){c.chibiState.clock=time;c.chibiState.headLook={x:time,y:time*.4};c.chibiState.idle=true;c.chibiState.gesture={type:'head-idle-test'};c.chibi.render();const bodyBase=Array.from(c.chibi.mesh.positions);c.chibiState.gesture=null;c.chibi.render();poses.push({...c.chibi.last.head});for(let i=0;i<local.length;i+=2)if(local[i+1]>=neck&&(Math.abs(c.chibi.mesh.positions[i]-bodyBase[i])>1e-7||Math.abs(c.chibi.mesh.positions[i+1]-bodyBase[i+1])>1e-7))bodyChanges++;}c.bookProgress=1;c.chibi.render();const bookOwnsHead=c.chibi.last.head.angle===0;c.bookProgress=0;c.chibiState.idle=false;c.chibi.render();return {poses,bodyChanges,bookOwnsHead};})()`);
 assert.equal(report.headIdle.bodyChanges,0);assert(report.headIdle.bookOwnsHead);assert(report.headIdle.poses.some(p=>p.angle>0)&&report.headIdle.poses.some(p=>p.angle<0));
 report.attention=await require('./verify-chibi-natural.cjs').verifyAttentionTiming(room);
 if(process.argv.includes('--record-chibi-eyes'))await recordEyes(room,output,js,delay);
 return report;
};
async function recordEyes(room,output,js,delay){
 await js(`(()=>{const c=document.createElement('canvas');c.width=960;c.height=600;const g=c.getContext('2d'),chunks=[],stream=c.captureStream(30),rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:3000000});window.eyeRecording={rec,chunks,stream,canvas:c,done:new Promise(r=>rec.onstop=r)};rec.ondataavailable=e=>chunks.push(e.data);rec.start();document.getElementById('idle').checked=true;aliceApp.state.suspended=false;window.eyePreviewLabel='平静';const draw=()=>{if(!window.eyeRecording)return;const q=aliceApp.character.chibi,f=q.trackingFace,source=aliceApp.character.canvas,sx=source.width/source.clientWidth,sy=source.height/source.clientHeight;g.fillStyle='#211c2c';g.fillRect(0,0,960,600);const sw=f.width*1.8*sx,sh=f.height*2.3*sy,k=Math.min(540/sw,500/sh);g.drawImage(source,(f.left-f.width*.4)*sx,(f.top-f.height*.95)*sy,sw,sh,480-sw*k/2,300-sh*k/2,sw*k,sh*k);g.fillStyle='#ebd1a6';g.font='24px Microsoft YaHei';g.textAlign='center';g.fillText('自然注视 · '+window.eyePreviewLabel,480,34);g.font='17px Microsoft YaHei';g.fillText('眼睛先看 · 头部稍后跟随 · 停留后稳住',480,565);g.fillStyle='#d8be8f';const look=aliceApp.character.chibiState.look;g.beginPath();g.arc(480+look.x*380,300-look.y*230,9,0,Math.PI*2);g.fill();window.eyeRecording.raf=requestAnimationFrame(draw);};draw();})()`);
 for(const outfit of ['winter','white','penguin']){
  await js(`aliceApp.wardrobe.set('${outfit}',{save:false});window.eyePreviewLabel='${outfit==='winter'?'冬装':outfit==='white'?'白色冬装':'企鹅装'}';`);
  for(const [x,y]of [[-1,0],[0,0],[1,0],[0,1],[0,-1]]){
   const p=await js(`(()=>{const f=aliceApp.character.chibi.trackingFace,c=aliceApp.character.canvas;return {x:Math.round(Math.max(4,Math.min(c.clientWidth-4,f.left+f.width/2+${x}*c.clientWidth*.4))),y:Math.round(Math.max(4,Math.min(c.clientHeight-4,f.top+f.height/2-(${y})*c.clientHeight*.5)))};})()`);
   room.webContents.sendInputEvent({type:'mouseMove',x:p.x,y:p.y});await delay(1650);
  }
 }
 const movie=await js(`(async()=>{const r=window.eyeRecording;r.rec.stop();await r.done;cancelAnimationFrame(r.raf);r.stream.getTracks().forEach(t=>t.stop());delete window.eyeRecording;const bytes=new Uint8Array(await new Blob(r.chunks).arrayBuffer());let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);})()`);
 await fs.writeFile(path.join(output,'eye-tracking-preview.webm'),Buffer.from(movie,'base64'));
}
function aliceName(index){return ['平静','淡笑','不悦','惊讶','敛容','思考','休憩','冷淡','垂眸','侧目','低首','柔笑','严肃','无语','怀疑','得意','叹息','愕然','困惑','眩晕'][index];}
