const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

exports.verifyOpacity=async(room,output,{desktopPet})=>{
  const js=(w,code)=>w.webContents.executeJavaScript(code,true);
  const until=async(fn,label)=>{for(let n=0;n<300;n++){if(await fn())return;await delay(70);}throw Error('Opacity check timed out: '+label);};
  const ready=w=>until(()=>js(w,'Boolean(window.aliceApp?.state.ready&&aliceApp.character.frames>3)'),'ready');
  const report={levels:[],layouts:[]},errors=[];
  if(process.argv.includes('--verify-opacity-restart')){
    const saved=JSON.parse(await fs.readFile(path.join(require('electron').app.getPath('userData'),'pet-options.json'),'utf8'));
    assert.equal(saved.dialogueOpacity,73);assert.equal(await js(room,'aliceApp.petOptions.value.dialogueOpacity'),73);assert.equal(await js(room,"Number(getComputedStyle(document.documentElement).getPropertyValue('--dialogue-alpha'))"),.73);
    return {restartRestored:true,dialogueOpacity:saved.dialogueOpacity};
  }
  const change=async(w,n)=>{
    const immediate=await js(w,`(()=>{const s=document.getElementById('dialogue-opacity');s.value=${n};s.dispatchEvent(new Event('input',{bubbles:true}));return getComputedStyle(document.documentElement).getPropertyValue('--dialogue-alpha');})()`);
    assert.equal(Number(immediate),n/100,'Live preview waited for disk');
    await js(w,"document.getElementById('dialogue-opacity').dispatchEvent(new Event('change',{bubbles:true}))");
    await until(()=>js(w,`aliceApp.petOptions.value.dialogueOpacity===${n}&&document.getElementById('dialogue-appearance-status').textContent.startsWith('已保存')`),'save '+n);
  };
  const shot=async(w,name)=>{await delay(100);const capture=await w.webContents.capturePage();await fs.writeFile(path.join(output,name+'.png'),capture.toPNG());return capture;};
  await js(room,"aliceApp.showPanel('chat');document.getElementById('idle').checked=false;document.getElementById('tracking').checked=false;document.getElementById('chat-appearance').click()");
  assert(await js(room,"document.getElementById('dialogue-appearance').open"));await change(room,52);await shot(room,'room-settings-52');
  await js(room,"document.getElementById('close-dialogue-appearance').click()");await shot(room,'room-52');
  assert((await js(room,'aliceDesktop.petEnter()')).ok);let pet=desktopPet.window;pet.webContents.on('console-message',d=>{if(d.level==='error')errors.push(d.message);});await ready(pet);desktopPet.scale(1);await delay(200);
  await js(pet,"aliceApp.petOptions.save({robinEnabled:false});aliceApp.pet.setChat(true);document.getElementById('idle').checked=false;document.getElementById('tracking').checked=false;aliceApp.pet.speech.show({zh:'红茶泡好了，要喝一杯吗？',ja:'お茶を淹れたわ。'},60000)");
  assert.equal(await js(pet,'aliceApp.petOptions.value.dialogueOpacity'),52,'New pet did not inherit room opacity');
  for(const n of [100,50,0]){
    await change(pet,n);await until(()=>js(room,`aliceApp.petOptions.value.dialogueOpacity===${n}`),'room/pet sync');
    const data=await js(pet,"(()=>{const c=document.getElementById('chat-panel'),b=document.getElementById('pet-speech'),s=getComputedStyle(c),t=getComputedStyle(b);return {dock:c.getBoundingClientRect().toJSON(),background:s.backgroundImage,blur:s.backdropFilter,caption:t.backgroundImage,ink:getComputedStyle(document.getElementById('chat-input')).opacity,captionInk:getComputedStyle(document.getElementById('pet-speech-zh')).opacity,text:document.getElementById('pet-speech-zh').textContent,finite:aliceApp.diagnostic().finite};})()");
    assert.equal(data.ink,'1');assert.equal(data.captionInk,'1');assert(data.finite&&data.text.length>0);if(n===0)assert.equal(data.blur,'blur(0px)');
    const capture=await shot(pet,'pet-'+n),bitmap=capture.toBitmap(),{width,height}=capture.getSize(),viewport=await js(pet,'({width:innerWidth,height:innerHeight})');let alpha=255;
    // Native screenshots use physical pixels; DOM bounds use CSS pixels.
    const sx=width/viewport.width,sy=height/viewport.height;
    for(let x=Math.ceil((data.dock.left+3)*sx);x<(data.dock.left+8)*sx;x++)for(let y=Math.ceil((data.dock.top+25)*sy);y<(data.dock.bottom-25)*sy;y++)alpha=Math.min(alpha,bitmap[(y*width+x)*4+3]);
    if(n===0)assert.equal(alpha,0,'Transparent setting left a visible background');if(n===100)assert.equal(alpha,255,'Opaque setting did not cover desktop');
    report.levels.push({percent:n,minimumBackgroundAlpha:alpha,...data,width,height});
  }
  await js(pet,"document.getElementById('chat-appearance').click()");
  await js(pet,"(()=>{const s=document.getElementById('dialogue-opacity');for(let n=0;n<=83;n++){s.value=n;s.dispatchEvent(new Event('input',{bubbles:true}));}s.dispatchEvent(new Event('change',{bubbles:true}));})()");
  await until(()=>js(pet,"aliceApp.petOptions.value.dialogueOpacity===83&&document.getElementById('dialogue-appearance-status').textContent.startsWith('已保存')"),'last slider input wins');
  await js(pet,"document.getElementById('dialogue-opacity').focus()");pet.webContents.sendInputEvent({type:'keyDown',keyCode:'Left'});pet.webContents.sendInputEvent({type:'keyUp',keyCode:'Left'});await until(()=>js(pet,'aliceApp.petOptions.value.dialogueOpacity===82'),'keyboard adjustment');
  for(const scale of [.65,1,1.5]){
    desktopPet.scale(scale);await delay(200);const layout=await js(pet,"(()=>{const ids=['dialogue-appearance','dialogue-opacity','dialogue-opacity-reset','close-dialogue-appearance'];return {w:innerWidth,h:innerHeight,controls:ids.map(id=>({id,...document.getElementById(id).getBoundingClientRect().toJSON()}))};})()");
    for(const control of layout.controls)assert(control.left>=0&&control.right<=layout.w+.5&&control.top>=0&&control.bottom<=layout.h+.5,'Opacity controls clipped: '+JSON.stringify(layout));report.layouts.push({scale,...layout});await shot(pet,'pet-settings-'+Math.round(scale*100));
  }
  await js(pet,"document.getElementById('dialogue-opacity-reset').click()");await until(()=>js(pet,'aliceApp.petOptions.value.dialogueOpacity===96'),'reset');await change(pet,73);await js(pet,"document.getElementById('close-dialogue-appearance').click()");
  // Recreate the pet window; a separate process checks profile restoration.
  desktopPet.restore();assert.equal(await js(room,"Number(getComputedStyle(document.documentElement).getPropertyValue('--dialogue-alpha'))"),.73);
  pet.destroy();await desktopPet.open();pet=desktopPet.window;await ready(pet);assert.equal(await js(pet,'aliceApp.petOptions.value.dialogueOpacity'),73);
  const saved=JSON.parse(await fs.readFile(path.join(require('electron').app.getPath('userData'),'pet-options.json'),'utf8'));assert.equal(saved.dialogueOpacity,73);assert.equal(saved.robinEnabled,false);assert.equal(typeof saved.voiceReply,'boolean');
  const invalid=await js(pet,"aliceDesktop.petOptionsSave({dialogueOpacity:'no',robinEnabled:'no',unknown:true})");assert.equal(invalid.dialogueOpacity,73);assert.equal(invalid.robinEnabled,false);assert(!Object.hasOwn(invalid,'unknown'));
  await js(pet,'aliceApp.petOptions.save({dialogueOpacity:1000})');assert.equal(await js(pet,'aliceApp.petOptions.value.dialogueOpacity'),100);await js(pet,'aliceApp.petOptions.save({dialogueOpacity:-10})');assert.equal(await js(pet,'aliceApp.petOptions.value.dialogueOpacity'),0);await js(pet,'aliceApp.petOptions.save({dialogueOpacity:73})');
  desktopPet.restore();assert.deepEqual(errors,[]);return {...report,livePreview:true,crossModeSync:true,keyboardRange:true,lastInputWins:true,reset:true,recreatedWindow:true,saved,validated:true,errors};
};
