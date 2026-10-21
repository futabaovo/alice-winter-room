const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),http=require('node:http');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
exports.verifyStickers=async(room,output,{chat,desktopPet,tea,farewell})=>{
  const errors=[],watch=w=>w.webContents.on('console-message',d=>{if(d.level==='error')errors.push(d.message);}),js=(w,code)=>w.webContents.executeJavaScript(code,true);watch(room);
  const until=async(fn,label)=>{for(let n=0;n<250;n++){if(await fn())return;await delay(80);}throw Error('Sticker verification timed out: '+label);};
  const shot=async(w,name)=>{await delay(300);await fs.writeFile(path.join(output,name+'.png'),(await w.webContents.capturePage()).toPNG());};
  const fixture={nope:{ja:'それは、だめ。',zh:'这个不行。'},smug:{ja:'私に任せれば、当然でしょう。',zh:'交给我，这不是理所当然的吗。'},speechless:{ja:'……何と言えばいいのかしら。',zh:'……我都不知道该怎么说了。'},none:{ja:'ええ、分かったわ。',zh:'嗯，知道了。'},satisfied:{ja:'ありがとう。',zh:'……谢谢。'}};
  let next='none',requests=0;
  const server=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);assert(body.text.format.schema.required.includes('sticker'));requests++;res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({...fixture[next],emotion:'neutral',expressionEvents:[],sticker:next})}]}]}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const shown=(w,id)=>js(w,`aliceApp.stickers.diagnostic().shown?.id===${JSON.stringify(id)}`);
  const advance=(w,n)=>js(w,`(()=>{for(let i=0;i<${n};i++){aliceApp.state.previous=performance.now()-16.6667;aliceApp.renderNow();}})()`);
  const enter=async()=>{await js(room,'aliceDesktop.petEnter()');const pet=desktopPet.window;watch(pet);await until(()=>js(pet,'Boolean(window.aliceApp?.state.ready&&aliceApp.character.frames>3)'),'pet ready');desktopPet.scale(1);await js(pet,'aliceApp.petOptions.save({robinEnabled:false,voiceReply:false})');return pet;};
  const exit=async(w,trigger)=>{
    let finished=0;farewell.finish=()=>{finished++;};await js(w,"aliceApp.stickers.cancel();document.getElementById('chat-auto-voice').checked=true;window.exitTiming={};aliceApp.voice.player.audio.addEventListener('ended',()=>window.exitTiming.ended=performance.now());document.addEventListener('alice:sticker-shown',e=>{if(e.detail.id==='goodbye')window.exitTiming.shown=performance.now();});");
    trigger();await until(()=>js(w,'aliceApp.stickers.diagnostic().closing'),'farewell started');assert(!farewell.done({},farewell.operation.token));
    await delay(450);assert(!await shown(w,'goodbye'));assert.equal(finished,0);await until(()=>shown(w,'goodbye'),'farewell sticker');assert.equal(finished,0);const timing=await js(w,'window.exitTiming');assert(timing.shown>=timing.ended&&timing.ended>0,'Exit sticker appeared before spoken goodbye ended');await shot(w,'goodbye');
    await until(()=>finished===1,'exit acknowledged after image hold');assert.equal(farewell.reason,'presented');return {afterSpeech:true,afterImageHold:true,timing,finished,normalWindowStillAlive:!w.isDestroyed()};
  };
  const report={};
  try{
    chat.save({provider:'api',model:'gpt-5.4-mini',baseUrl:`http://127.0.0.1:${server.address().port}/v1`,reasoning:'low',remember:true,key:'local-sticker-verification'});
    if(process.argv.includes('--verify-stickers-exit-pet')){
      const pet=await enter();await desktopPet.dock('left');await until(()=>desktopPet.edge.phase==='hidden','pet hidden');report.exit=await exit(pet,()=>require('electron').app.quit());assert.equal(desktopPet.edge.side,null);return {...report,mode:'pet tray exit from hidden edge',errors};
    }
    await js(room,"aliceApp.showPanel('chat');document.getElementById('chat-auto-voice').checked=false;document.getElementById('idle').checked=false;document.getElementById('tracking').checked=false");
    report.text=[];
    for(const id of ['nope','smug','speechless']){
      next=id;await js(room,`aliceApp.chat.submit(${JSON.stringify('测试'+id)})`);assert.equal(await shown(room,id),false);await until(()=>shown(room,id),id+' after text');await until(()=>js(room,`Boolean(document.querySelector('.chat-message:last-child .chat-sticker'))`),'history image');await shot(room,id);
      const row=chat.transcript().at(-1);assert(row.stickerSent&&row.sticker===id);report.text.push({id,recorded:true});
    }
    await js(room,'aliceApp.stickers.cancel()');next='none';await js(room,"aliceApp.chat.submit('普通确认')");await delay(1400);assert.equal(await js(room,'aliceApp.stickers.diagnostic().visible'),false);assert(!chat.transcript().at(-1).stickerSent);report.neutralDoesNotSend=true;
    const pet=await enter();await js(pet,'aliceApp.pet.setChat(true)');
    // Real bundled audio exercises the same dialogue callback, without a TTS request.
    await js(pet,"window.realSpeakText=aliceApp.voice.speakText;aliceApp.voice.speakText=async(ja,zh,options)=>{const item={id:'sticker-voice-fixture',src:'voice/alice-sushi-thanks.wav',duration:.96,cues:[{start:0,end:.96,ja,zh}]};options.beforePlay(item);await aliceApp.voice.player.play(item);return {played:true};};document.getElementById('chat-auto-voice').checked=true;window.stickerTiming={};aliceApp.voice.player.audio.addEventListener('ended',()=>window.stickerTiming.ended=performance.now());document.addEventListener('alice:sticker-shown',()=>window.stickerTiming.shown=performance.now());");
    next='satisfied';await js(pet,"aliceApp.chat.submit('谢谢这份寿司')");assert.equal(await js(pet,'aliceApp.stickers.diagnostic().pending?.mode'),'voice');await js(pet,'aliceApp.voice.player.toggle()');await delay(1300);assert(!await shown(pet,'satisfied'));assert(!chat.transcript().at(-1).stickerSent);
    await js(pet,'aliceApp.voice.player.toggle()');await until(()=>shown(pet,'satisfied'),'audio end');await until(()=>chat.transcript().at(-1).stickerSent,'voice sticker recorded');const timing=await js(pet,'window.stickerTiming');assert(timing.shown>=timing.ended&&timing.ended>0);await shot(pet,'pet-satisfied-after-voice');report.voice={timing,pausedDidNotSend:true};
    await js(pet,"aliceApp.chat.submit('再试一次')");await js(pet,'aliceApp.voice.player.toggle();aliceApp.chat.cancel()');await delay(1300);assert(!await shown(pet,'satisfied'));assert(!chat.transcript().at(-1).stickerSent);report.cancelDoesNotSend=true;
    await js(pet,"aliceApp.voice.speakText=window.realSpeakText;document.getElementById('chat-auto-voice').checked=true;aliceApp.state.suspended=true;aliceApp.feeding.request()");await advance(pet,430);
    await until(()=>js(pet,"aliceApp.stickers.diagnostic().pending?.source==='feeding'&&aliceApp.stickers.diagnostic().pending?.mode==='voice'"),'sushi thanks');assert(!await shown(pet,'satisfied'));await until(()=>shown(pet,'satisfied'),'sushi reaction');await shot(pet,'sushi-satisfied');report.sushiCompleted=(await js(pet,'aliceApp.feeding.diagnostic()')).completed;
    await js(pet,'aliceApp.state.suspended=false');report.sizes=[];
    for(const scale of [.65,1,1.5]){desktopPet.scale(scale);await delay(650);const layout=await js(pet,"(()=>{const d=aliceApp.stickers.diagnostic(),head=aliceApp.wardrobe.headBounds(),face=aliceApp.character.meshBounds('ArtMeshFace'),dock=document.getElementById('chat-panel').getBoundingClientRect();return {card:d.rect,head,face,dock:dock.toJSON(),width:innerWidth,height:innerHeight};})()");assert(layout.card.left>=0&&layout.card.right<=layout.width+1&&layout.card.top>=0&&layout.card.bottom<=layout.dock.top,'Sticker outside window or overlaps composer');assert(layout.face.bottom<layout.dock.top,'Face is hidden by composer');assert(layout.card.bottom<=layout.head.top+3||layout.card.right<layout.head.left,'Sticker covers head');report.sizes.push({scale,...layout});await shot(pet,'sticker-size-'+Math.round(scale*100));}
    desktopPet.scale(1);await js(pet,"aliceApp.stickers.cancel();document.getElementById('chat-auto-voice').checked=false");tea.brewMs=80;
    report.tea=[];
    for(const recipe of [{leaf:'reserve',temperature:90,seconds:150},{leaf:'choice',temperature:95,seconds:300}]){
      const count=tea.history.length;await js(pet,`aliceDesktop.teaBrew(${JSON.stringify(recipe)})`);await delay(150);await js(pet,'aliceApp.tea.refresh();');await until(()=>js(pet,"aliceApp.tea.diagnostic().info.phase==='ready'"),'tea ready');assert(await js(pet,'aliceApp.tea.serve()'));await js(pet,'aliceApp.state.suspended=true');await advance(pet,600);await until(()=>tea.history.length>count,'tea tasted');const tasted=tea.history[0],id=tasted.feeling==='exquisite'?'satisfied':'nope';await until(()=>shown(pet,id),'tea '+id);report.tea.push({feeling:tasted.feeling,sticker:id});await shot(pet,'tea-'+id);await js(pet,'aliceApp.stickers.cancel();aliceApp.tea.reset();aliceApp.state.suspended=false');
    }
    const saved=chat.transcript().filter(row=>row.stickerSent);assert(saved.length>=6);await js(pet,'aliceDesktop.petReturn()');await delay(250);await js(room,"document.getElementById('chat-history').open=true");await until(()=>js(room,"document.querySelectorAll('.chat-sticker').length>=6"),'history refresh');await shot(room,'sticker-history');await js(room,"document.getElementById('chat-history').open=false");report.historyImages=saved.length;
    report.exit=await exit(room,()=>room.close());assert.deepEqual(errors,[]);return {...report,requests,errors};
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
};
