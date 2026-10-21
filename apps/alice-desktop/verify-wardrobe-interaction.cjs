const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
exports.verifyWardrobeInteraction=async(room,output,{desktopPet})=>{
  const js=(code,win=room)=>win.webContents.executeJavaScript(code,true),capture=async(name,win=room)=>{await delay(65);await fs.writeFile(path.join(output,name+'.png'),(await win.webContents.capturePage()).toPNG());};
  const advance=(frames,dt=1/60,win=room)=>js(`(()=>{for(let i=0;i<${frames};i++){aliceApp.state.previous=performance.now()-${dt*1000};aliceApp.renderNow();}return aliceApp.feeding.diagnostic();})()`,win);
  const results={meals:[],seams:[]};
  for(const outfit of ['white','penguin']){
    await js(`aliceApp.wardrobe.set('${outfit}',{save:false});aliceApp.setView('portrait');aliceApp.setMood(0);aliceApp.settle();aliceApp.renderNow();`);
    for(const mood of [0,6,9]){
      await js(`aliceApp.setMood(${mood});aliceApp.settle();aliceApp.renderNow();`);
      const seams=await js("(()=>{const c=aliceApp.character,f=c.meshBounds('ArtMeshFace'),cx=(f.left+f.right)/2;return {finite:c.diagnostic().finite,neck:[-.12,0,.12].map(dx=>c.alphaAt(cx+f.width*dx,f.bottom+f.height*.025)),cap:c.wardrobe.selected==='white'?(()=>{const v=new Uint8Array(4),x=cx,y=f.top-f.height*.55;c.gl.readPixels(Math.floor(x*c.canvas.width/c.canvas.clientWidth),c.canvas.height-1-Math.floor(y*c.canvas.height/c.canvas.clientHeight),1,1,c.gl.RGBA,c.gl.UNSIGNED_BYTE,v);return [...v];})():null};})()");
      assert(seams.finite);assert(seams.neck.every(a=>a>200),'Transparent neck seam '+outfit+' '+mood+' '+JSON.stringify(seams));if(seams.cap)assert(seams.cap[0]>150&&seams.cap[1]>150&&seams.cap[3]>230,'Old dark hat visible in white outfit');results.seams.push({outfit,mood,...seams});
    }
    await js('aliceApp.setMood(0);aliceApp.settle();aliceApp.renderNow();');
    const types=await js('aliceApp.feeding.types');
    for(const type of types){
      await js(`aliceApp.feeding.select('${type.id}',{save:false});aliceApp.feeding.request();`);await advance(31,.05);await capture(outfit+'-'+type.id+'-bite');
      const first=await js('aliceApp.feeding.diagnostic()');assert.equal(first.kind,type.id);assert(first.food&&first.food.kind===type.id);assert.equal(first.phase,'bite');assert(Math.abs(first.food.y-first.mouth.y)<1);
      await advance(20,.05);const half=await js('aliceApp.feeding.diagnostic()');if(type.bites===2)assert(half.food&&half.consumed>.4&&half.consumed<.6&&half.hold>.6,'Missing held half portion');else assert.equal(half.food,null);
      const final=await js("(()=>{const seen=new Set();for(let i=0;i<160&&aliceApp.feeding.state.busy;i++){aliceApp.state.previous=performance.now()-50;aliceApp.renderNow();seen.add(aliceApp.feeding.state.phase);}return {phases:[...seen],state:aliceApp.feeding.diagnostic(),model:aliceApp.character.diagnostic()};})()");assert.equal(final.state.phase,'idle');assert(final.model.finite&&!final.model.glError);assert.equal(final.phases.includes('second-bite'),type.bites===2);results.meals.push({outfit,kind:type.id,bites:type.bites,halfRemaining:type.bites===2,completed:final.state.completed});
    }
  }
  await js("aliceApp.wardrobe.open();");await capture('wardrobe-and-menu');const icons=await js("[...document.querySelectorAll('.sushi-card canvas')].map(c=>c.toDataURL())");assert.equal(new Set(icons).size,6);results.distinctSushiIcons=6;await js("document.getElementById('wardrobe-dialog').close();aliceApp.wardrobe.set('white');aliceApp.feeding.select('maki');");await delay(100);
  const preferences=await js('aliceDesktop.appearanceInfo()');assert.equal(preferences.outfit,'white');assert.equal(preferences.sushi,'maki');results.savedAppearance=preferences;
  const entered=await js('aliceDesktop.petEnter()');assert(entered.ok);const pet=desktopPet.window;pet.webContents.setAudioMuted(true);
  for(let i=0;i<120;i++){if(await js('Boolean(window.aliceApp?.state.ready)',pet))break;await delay(80);}
  await js("aliceApp.state.suspended=true;aliceApp.voice.stop();aliceApp.feeding.setMuted(true);document.getElementById('idle').checked=false;document.getElementById('tracking').checked=false;aliceApp.renderNow();",pet);
  assert.equal(await js('aliceApp.wardrobe.selected',pet),'white');assert.equal(await js('aliceApp.feeding.selected',pet),'maki');await capture('pet-white',pet);
  await js("aliceApp.wardrobe.set('penguin');aliceApp.renderNow();",pet);await capture('pet-penguin',pet);
  await js("document.getElementById('pet-feed').click();",pet);await advance(50,.05,pet);await capture('pet-penguin-eating',pet);await advance(70,.05,pet);assert.equal(await js('aliceApp.feeding.state.completed',pet),1);assert.equal(await js('aliceApp.character.alphaAt(1,1)',pet),0);
  desktopPet.scale(.75);await delay(250);await advance(20,1/60,pet);
  const bar=await js("(()=>{const r=document.querySelector('.pet-controls').getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth};})()",pet);assert(bar.left>=0&&bar.right<=bar.width);results.pet={restoredAppearance:true,transparentCorners:true,penguinMeal:true,compactToolbar:bar};
  await js('aliceDesktop.petReturn()',pet);await js('aliceApp.state.suspended=true;aliceApp.voice.stop();aliceApp.feeding.reset();');
  // A side-by-side export of the actual renderer, with no app chrome covering feet.
  const images=[];for(const outfit of ['white','penguin']){await js(`aliceApp.wardrobe.set('${outfit}',{save:false});aliceApp.setView('full');aliceApp.setMood(0);aliceApp.settle();aliceApp.renderNow();`);images.push(await js('aliceApp.capture()'));}
  const plate=await js(`(async()=>{const out=document.createElement('canvas');out.width=900;out.height=900;const ctx=out.getContext('2d');ctx.fillStyle='#e7e2db';ctx.fillRect(0,0,900,900);const data=${JSON.stringify(images)};for(let i=0;i<2;i++){const image=new Image();image.src=data[i];await image.decode();ctx.drawImage(image,450,0,650,900,i*450,0,450,850);}ctx.fillStyle='#4c4353';ctx.font='20px Microsoft YaHei';ctx.textAlign='center';ctx.fillText('白色大衣',225,882);ctx.fillText('企鹅装',675,882);return out.toDataURL('image/png');})()`);await fs.writeFile(path.join(output,'actual-outfits.png'),Buffer.from(plate.split(',')[1],'base64'));
  const video=path.join(output,'wardrobe-sushi-preview.mp4'),ffmpeg=path.resolve(__dirname,'../../.cache/audio-tools/bin/ffmpeg.exe');
  const enc=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','60','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',video],{windowsHide:true,stdio:['pipe','ignore','pipe']});let errors='';enc.stderr.on('data',b=>errors+=b);const complete=new Promise((resolve,reject)=>{enc.on('error',reject);enc.on('close',n=>n===0?resolve():reject(Error(errors)));});complete.catch(()=>{});
  for(const [outfit,kind]of [['white','salmon'],['penguin','roe']]){await js(`aliceApp.wardrobe.set('${outfit}',{save:false});aliceApp.feeding.reset();aliceApp.feeding.select('${kind}',{save:false});aliceApp.setView('portrait');aliceApp.setMood(0);aliceApp.settle();aliceApp.renderNow();aliceApp.feeding.request();`);for(let i=0;i<420;i++){await advance(1);const picture=(await room.webContents.capturePage()).resize({width:1360,height:900}).toJPEG(88);if(!enc.stdin.write(picture))await once(enc.stdin,'drain');if(i%120===0)await fs.writeFile(path.join(output,'export-progress.json'),JSON.stringify({outfit,frame:i,totalPerOutfit:420}));}}
  enc.stdin.end();await complete;results.recording={file:'wardrobe-sushi-preview.mp4',duration:14,fps:60,audio:false};await fs.writeFile(path.join(output,'interaction-verification.json'),JSON.stringify({ok:true,...results},null,2));return results;
};
