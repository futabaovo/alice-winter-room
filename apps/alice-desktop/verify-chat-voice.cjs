const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
exports.verifyChatVoice=async(room,output,{voice,chat,desktopPet})=>{
  const ja='お帰りなさい。お茶を淹れたわ。',zh='欢迎回来。红茶已经泡好了。';let long=false;
  const server=http.createServer(async(req,res)=>{for await(const _ of req){}res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({ja:long?'今日は少し休みましょう。'.repeat(12):ja,zh:long?'忙了一天，先坐下来休息一下，喝一杯红茶吧。':zh,emotion:'neutral'})}]}]}));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const js=(w,s)=>w.webContents.executeJavaScript(s,true),until=async(fn,label)=>{for(let i=0;i<240;i++){if(await fn())return;await delay(100);}throw Error('Chat voice timeout: '+label);};
  const sample=async(w,name,engine)=>{await until(()=>js(w,'aliceApp.voice.player.snapshot().playing'),'playback');const item=await js(w,'({engine:aliceApp.voice.player.item.engine,source:aliceApp.voice.player.item.voiceSource,subtitle:aliceApp.voice.player.snapshot().cue})');assert.equal(item.engine,engine);assert(item.subtitle.zh&&item.subtitle.ja);await delay(250);await js(w,'aliceApp.voice.player.toggle()');await fs.writeFile(path.join(output,name+'.png'),(await w.webContents.capturePage()).toPNG());await fs.copyFile(voice.lastGenerated,path.join(output,name+'.wav'));return item;};
  try{
    chat.save({provider:'api',model:'gpt-5.4-mini',baseUrl:`http://127.0.0.1:${server.address().port}/v1`,reasoning:'low',remember:false,key:'local-voice-regression-only'});
    assert(await js(room,"document.getElementById('chat-auto-voice').checked"));
    await js(room,"aliceApp.chat.submit('欢迎我回来吧。')");const roomReply=await sample(room,'room-alice-reply','alice');await js(room,'aliceApp.voice.stop();aliceDesktop.petEnter()');const pet=desktopPet.window;await until(()=>js(pet,'Boolean(window.aliceApp?.state.ready)'),'pet ready');
    await js(pet,'aliceApp.petOptions.save({robinEnabled:false});aliceApp.pet.setChat(true)');assert(await js(pet,"document.getElementById('pet-voice-reply').checked"));
    await js(pet,"aliceApp.chat.submit('你也用声音回答我。')");const petReply=await sample(pet,'pet-alice-reply','alice');assert((await js(pet,'aliceApp.pet.speech.diagnostic()')).visible);
    await js(pet,'aliceApp.voice.stop()');const workspace=voice.workspace;voice.workspace=null;await voice.refreshInfo();assert(voice.info().systemAvailable);
    await js(pet,"aliceApp.chat.submit('没有训练环境也请朗读。')");const systemReply=await sample(pet,'pet-system-reply','system');await js(pet,'aliceApp.voice.stop()');voice.workspace=workspace;
    long=true;await js(pet,"aliceApp.chat.submit('请给我一段较长回答。')");const longReply=await sample(pet,'pet-long-reply','system');
    await js(pet,"document.getElementById('pet-voice-reply').click()");await until(()=>js(pet,'!aliceApp.voice.player.item&&!aliceApp.petOptions.value.voiceReply'),'turn off');assert.equal(await js(room,"document.getElementById('chat-auto-voice').checked"),false);
    await js(pet,"aliceApp.chat.submit('本次只要文字。')");assert.equal(await js(pet,'aliceApp.voice.player.item'),null);
    await js(room,"document.getElementById('chat-auto-voice').click()");await until(()=>js(pet,"document.getElementById('pet-voice-reply').checked"),'turn on sync');
    desktopPet.restore();return {roomReply,petReply,systemReply,longReply,defaultEnabled:true,crossModeSync:true,muteStopsPlayback:true};
  }finally{await voice.stop();await new Promise(r=>server.close(r));}
};
