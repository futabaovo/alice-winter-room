const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{once}=require('node:events');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
exports.verifyFeeding=async(room,output,{desktopPet})=>{
  const results={};
  const driver=window=>({window,js:async code=>{try{return await window.webContents.executeJavaScript(code,true);}catch(error){throw Error(`Renderer evaluation failed: ${code}\n${error.stack||error}`);}},capture:async name=>{await delay(45);await fs.writeFile(path.join(output,name+'.png'),(await window.webContents.capturePage()).toPNG());}});
  const configure=async d=>{await d.js("aliceApp.state.suspended=true;aliceApp.voice.stop();aliceApp.feeding.reset();aliceApp.feeding.setMuted(true);document.getElementById('idle').checked=false;document.getElementById('tracking').checked=false;aliceApp.state.previous=performance.now()-16.6667;aliceApp.renderNow();");};
  const advance=async(d,frames)=>d.js(`(()=>{for(let i=0;i<${frames};i++){aliceApp.state.previous=performance.now()-16.6667;aliceApp.renderNow();}return aliceApp.feeding.diagnostic();})()`);
  const valid=async d=>{const r=await d.js('aliceApp.character.diagnostic()');assert(r.finite&&!r.glError&&r.visiblePixels>2000);return {finite:r.finite,glError:r.glError};};
  const r=driver(room);await configure(r);await r.js("aliceApp.setView('portrait');aliceApp.renderNow();document.getElementById('feed-sushi').click();");
  assert.equal((await r.js('aliceApp.feeding.diagnostic()')).phase,'queued');
  await advance(r,54);await r.capture('room-offer');const offer=await r.js('aliceApp.feeding.diagnostic()');assert(offer.food&&offer.food.width>10);
  await advance(r,42);await r.capture('room-bite');const bite=await r.js('aliceApp.feeding.diagnostic()');assert.equal(bite.phase,'bite');assert(Math.abs(bite.food.y-bite.mouth.y)<1,'Food does not meet the native mouth mesh');
  await advance(r,54);await r.capture('room-chew');const chew=await r.js('aliceApp.feeding.diagnostic()');assert.equal(chew.phase,'chew');assert(chew.food&&chew.consumed>.4&&chew.consumed<.6);
  await advance(r,270);await r.capture('room-finished');assert.equal((await r.js('aliceApp.feeding.diagnostic()')).completed,1);results.room={offer,bite,chew,model:await valid(r)};
  // Do not interrupt a real playing sentence. The queued sushi starts only
  // after the shared SpeechPlayer is released.
  await r.js("aliceApp.feeding.reset();aliceApp.voice.player.play(aliceApp.voice.clips[0]);");await delay(250);
  await r.js('aliceApp.feeding.request();');await advance(r,15);assert.equal((await r.js('aliceApp.feeding.diagnostic()')).phase,'queued');
  await r.js('aliceApp.voice.stop();');await advance(r,3);assert.equal((await r.js('aliceApp.feeding.diagnostic()')).phase,'approach');await r.js('aliceApp.feeding.reset();');results.waitedForSpeech=true;
  // Native pointer events exercise capture, drag hit testing and click suppression.
  const drag=async(d,target)=>{
    const start=await d.js(`(()=>{const b=document.getElementById(${JSON.stringify(d===r?'feed-sushi':'pet-feed')}).getBoundingClientRect();return {x:Math.round(b.left+b.width/2),y:Math.round(b.top+b.height/2)};})()`);
    d.window.webContents.sendInputEvent({type:'mouseMove',...start});d.window.webContents.sendInputEvent({type:'mouseDown',...start,button:'left',clickCount:1});
    for(let i=1;i<=8;i++){d.window.webContents.sendInputEvent({type:'mouseMove',x:Math.round(start.x+(target.x-start.x)*i/8),y:Math.round(start.y+(target.y-start.y)*i/8)});await delay(12);}
    d.window.webContents.sendInputEvent({type:'mouseUp',x:Math.round(target.x),y:Math.round(target.y),button:'left',clickCount:1});await delay(60);
  };
  await drag(r,{x:25,y:120});assert.equal((await r.js('aliceApp.feeding.diagnostic()')).phase,'idle');results.missedDragDoesNotFeed=true;
  const mouth=await r.js('aliceApp.feeding.mouth()');await drag(r,mouth);assert((await r.js('aliceApp.feeding.diagnostic()')).busy,'Valid mouth drop did not feed');await advance(r,420);assert.equal((await r.js('aliceApp.feeding.diagnostic()')).completed,2);results.nativeDragFeedsOnce=true;
  // Keyboard activation must still work after dropping away from the mouth.
  await drag(r,{x:25,y:120});await r.js("document.getElementById('feed-sushi').click();");assert.equal((await r.js('aliceApp.feeding.diagnostic()')).phase,'queued');await r.js('aliceApp.feeding.reset();');results.keyboardWorksAfterMissedDrag=true;
  const entered=await r.js('aliceDesktop.petEnter()');assert(entered.ok);const pet=desktopPet.window,p=driver(pet);pet.webContents.setAudioMuted(true);
  for(let i=0;i<120;i++){if(await p.js('Boolean(window.aliceApp?.state.ready)'))break;await delay(80);}await configure(p);
  await p.js('aliceApp.pet.reaction.trigger();');await advance(p,50);assert((await p.js('aliceApp.pet.reaction.value'))>.5);
  await p.js("document.getElementById('pet-feed').click();");await advance(p,15);assert.equal((await p.js('aliceApp.feeding.diagnostic()')).phase,'queued');
  await advance(p,130);assert((await p.js('aliceApp.pet.reaction.value'))<.02,'Book was not lowered before eating');await p.capture('pet-offer');
  await advance(p,330);const finished=await p.js('aliceApp.feeding.diagnostic()');assert.equal(finished.completed,1);assert.equal(finished.phase,'idle');await p.capture('pet-finished');results.bookLowersBeforeEating=true;
  assert.equal(await p.js('aliceApp.character.alphaAt(1,1)'),0);results.pet={model:await valid(p),finished};
  // A clean pet profile defaults to text-only. Explicitly enable its real option
  // before asserting the optional thank-you voice.
  await p.js('aliceApp.petOptions.save({voiceReply:true})');
  await p.js('aliceApp.feeding.setMuted(false);aliceApp.feeding.request();');await advance(p,420);await delay(300);
  const thanks=await p.js('aliceApp.voice.player.snapshot()');assert.equal(thanks.id,'alice-sushi-thanks');assert(thanks.playing||thanks.ended);assert.equal(thanks.cue?.zh,'……谢谢。');await p.capture('pet-thanks');results.thanks={id:thanks.id,playing:thanks.playing,cue:thanks.cue};
  await p.js('aliceApp.voice.stop();aliceApp.feeding.reset();');desktopPet.scale(.75);await delay(250);await advance(p,10);
  const toolbar=await p.js("(()=>{const b=document.getElementById('pet-feed').getBoundingClientRect(),bar=document.querySelector('.pet-controls').getBoundingClientRect();return {buttonLeft:b.left,buttonRight:b.right,barLeft:bar.left,barRight:bar.right,width:innerWidth};})()");assert(toolbar.buttonLeft>=0&&toolbar.buttonRight<=toolbar.width&&toolbar.barLeft>=0&&toolbar.barRight<=toolbar.width,'Sushi toolbar does not fit the small pet');
  await drag(p,await p.js('aliceApp.feeding.mouth()'));assert((await p.js('aliceApp.feeding.diagnostic()')).busy,'Pet mouth drop did not feed');await advance(p,420);assert.equal((await p.js('aliceApp.feeding.diagnostic()')).completed,3);results.smallPetDrag={ok:true,requestedScale:.75,actualWindow:desktopPet.info().bounds,toolbar};await p.capture('pet-small');
  await p.js('aliceApp.feeding.reset();aliceDesktop.petReturn();');await configure(r);
  // Deterministic 60 FPS render of the interaction. The interactive preview
  // plays the actual thanks clip; this short motion-review movie is silent.
  await r.js("aliceApp.setView('portrait');aliceApp.state.clock=1;aliceApp.renderNow();document.getElementById('feed-sushi').click();");
  const video=path.join(output,'sushi-feeding-preview.mp4'),ffmpeg=path.resolve(__dirname,'../../.cache/audio-tools/bin/ffmpeg.exe');
  if(!process.argv.includes('--verify-feeding-demo')){
    results.recording={exported:false,reason:'Optional developer movie export; run with --verify-feeding-demo and ffmpeg.'};
    await fs.writeFile(path.join(output,'feeding-verification.json'),JSON.stringify({ok:true,...results},null,2));return results;
  }
  const enc=spawn(ffmpeg,['-hide_banner','-loglevel','error','-y','-f','image2pipe','-framerate','60','-i','pipe:0','-an','-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',video],{windowsHide:true,stdio:['pipe','ignore','pipe']});let error='';enc.stderr.on('data',b=>error+=b);const complete=new Promise((resolve,reject)=>{enc.on('error',reject);enc.on('close',c=>c===0?resolve():reject(Error(error)));});complete.catch(()=>{});
  for(let i=0;i<420;i++){await advance(r,1);const picture=(await room.webContents.capturePage()).resize({width:1360,height:900}).toJPEG(90);if(!enc.stdin.write(picture))await once(enc.stdin,'drain');if(i%60===0)await fs.writeFile(path.join(output,'export-progress.json'),JSON.stringify({frame:i,total:420}));}
  enc.stdin.end();await complete;await fs.writeFile(path.join(output,'export-progress.json'),JSON.stringify({frame:420,total:420}));
  results.recording={file:'sushi-feeding-preview.mp4',frames:420,fps:60,duration:7,audio:false};
  await fs.writeFile(path.join(output,'feeding-verification.json'),JSON.stringify({ok:true,...results},null,2));return results;
};
