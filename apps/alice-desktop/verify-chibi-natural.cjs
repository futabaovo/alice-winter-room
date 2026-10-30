const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
exports.verifyNatural=async(room,output)=>{
 const js=s=>room.webContents.executeJavaScript(s,true),report=[];
 for(const outfit of ['winter','white','penguin']){
  const shots=[];
  for(let mood=0;mood<20;mood++){
   const sample=await js(`(()=>{aliceApp.wardrobe.set('${outfit}',{save:false});aliceApp.setMood(${mood});aliceApp.settle();aliceApp.renderNow();const c=aliceApp.character,q=c.chibi;c.chibiState.look={x:0,y:0};c.chibiState.blink=1;q.render();const base=q.ctx.getImageData(0,0,512,640).data;let centerDiff=0;for(let i=0;i<base.length;i++)if(base[i]!==q.eyes.basePixels.data[i])centerDiff++;return {centerDiff,index:q.choose().index,eyes:q.eyes.eyes.length};})()`);
   assert.equal(sample.centerDiff,0,`${outfit}/${mood}: original eyes at rest`);
   for(const opening of [1,.55,.12,0]){
    const shot=await js(`(()=>{const c=aliceApp.character,q=c.chibi;c.chibiState.blink=${opening};q.render();const f=q.local.face,canvas=document.createElement('canvas');canvas.width=260;canvas.height=240;const g=canvas.getContext('2d');g.fillStyle='#eee5db';g.fillRect(0,0,260,240);const w=f.width*1.6,h=f.height*1.8,k=Math.min(260/w,240/h);g.drawImage(q.surface,f.left-f.width*.3,f.top-f.height*.55,w,h,(260-w*k)/2,(240-h*k)/2,w*k,h*k);return {image:canvas.toDataURL(),index:q.choose().index};})()`);
    assert.equal(shot.index,opening<.22&&![1,5,6,9,10,16,18,19].includes(mood)?6:sample.index,'authored blink preserves directional/closed expressions');
    shots.push({...shot,label:`${mood+1} · ${opening===1?'原眼':opening===0?'闭眼':Math.round(opening*100)+'%'}`});
   }
   report.push({outfit,mood,...sample});
  }
  for(let page=0;page<4;page++){
   const png=await js(`(async()=>{const c=document.createElement('canvas');c.width=1040;c.height=1300;const g=c.getContext('2d');g.fillStyle='#eee5db';g.fillRect(0,0,c.width,c.height);for(const [i,s]of ${JSON.stringify(shots.slice(page*20,page*20+20))}.entries()){const im=new Image();im.src=s.image;await im.decode();g.drawImage(im,i%4*260,Math.floor(i/4)*260);g.fillStyle='#50465f';g.font='14px Microsoft YaHei';g.fillText(s.label,i%4*260+8,Math.floor(i/4)*260+256);}return c.toDataURL();})()`);
   await fs.writeFile(path.join(output,`${outfit}-blink-${page+1}.png`),Buffer.from(png.split(',')[1],'base64'));
  }
 }
 await js('aliceApp.character.chibiState.blink=1;');
 return report;
};
exports.verifyAttentionTiming=async(room)=>{
 const js=s=>room.webContents.executeJavaScript(s,true),delay=ms=>new Promise(r=>setTimeout(r,ms));
 await js("aliceApp.setMood(0);aliceApp.wardrobe.set('winter',{save:false});document.getElementById('idle').checked=true;document.getElementById('tracking').checked=true;window.dispatchEvent(new Event('blur'));aliceApp.renderNow();aliceApp.state.suspended=false;aliceApp.pause(false);");
 await delay(250);
 const point=await js("(()=>{const f=aliceApp.character.chibi.trackingFace;return {x:4,y:Math.round(f.top+f.height/2)};})()");
 room.webContents.sendInputEvent({type:'mouseMove',...point});await delay(95);
 const early=await js('({...aliceApp.character.chibiState})');assert(Math.abs(early.look.x)>.1);assert(Math.abs(early.headLook.x)<Math.abs(early.look.x)*.65,'eyes must lead the head');
 await delay(1300);const settled=await js('({...aliceApp.character.chibiState})');await delay(900);const held=await js('({...aliceApp.character.chibiState})');assert(Math.abs(held.headLook.x-settled.headLook.x)<.025,'held gaze must settle');
 const blink=[];let frames=await js('aliceApp.character.frames'),start=Date.now();
 for(let i=0;i<125;i++){await delay(50);blink.push(await js('aliceApp.character.chibiState.blink'));}
 const fps=(await js('aliceApp.character.frames')-frames)*1000/(Date.now()-start);assert(blink.some(v=>v<.08),'natural blink must close');assert(blink.some(v=>v>.1&&v<.9),'natural blink must include transitions');
 await js('aliceApp.pause(true)');const frozen=await js('({...aliceApp.character.chibiState})');await delay(200);const after=await js('({...aliceApp.character.chibiState})');assert.deepEqual(after.look,frozen.look);assert.equal(after.blink,frozen.blink);assert.deepEqual(after.headLook,frozen.headLook);
 await js('aliceApp.pause(false);aliceApp.state.suspended=true;');
 return {early:{eye:early.look,head:early.headLook},settled:{eye:held.look,head:held.headLook},blinkSamples:blink,averageFps:fps,pause:true};
};
