const fs=require('node:fs/promises');
const path=require('node:path');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

exports.verifyVoice=async(window,output,{voice,checkSynthesis}={})=>{
  const js=code=>window.webContents.executeJavaScript(code,true);
  const catalog=await js(`(async()=>{const v=aliceApp.voice;await v.player.initAudio();const rows=[];for(const c of v.clips){const bytes=await fetch(c.src).then(r=>{if(!r.ok)throw Error('Missing voice');return r.arrayBuffer();});const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('');if(hash!==c.sha256)throw Error('Voice checksum mismatch');const audio=await v.player.context.decodeAudioData(bytes.slice(0));if(Math.abs(audio.duration-c.duration)>.03)throw Error('Voice duration mismatch');rows.push({id:c.id,duration:audio.duration});}return rows;})()`);
  if(catalog.length!==13)throw Error('Expected thirteen bundled voice clips.');
  await js("aliceApp.showPanel('voice');document.getElementById('idle').checked=false;document.getElementById('tracking').checked=false;document.getElementById('voice-expression').checked=false;aliceApp.setMood(0);aliceApp.settle();aliceApp.pause(true);aliceApp.setView('face');");
  await js("aliceApp.voice.playId('aoko-mine')");
  const mouths=[];let captured=false;
  for(let i=0;i<38;i++){
    await delay(65);
    const result=await js("({mouth:aliceApp.character.model.parameters.values[aliceApp.character.parameterIndex.ParamMouthOpenY],speech:aliceApp.voice.diagnostic(),subtitle:document.getElementById('subtitle-zh').textContent})");
    mouths.push(result.mouth);
    if(result.mouth>.1&&!captured){captured=true;await fs.writeFile(path.join(output,'speaking.png'),(await window.webContents.capturePage()).toPNG());if(!result.subtitle.includes('我的东西'))throw Error('Spoken subtitle missing.');}
  }
  if(Math.max(...mouths)<.1||new Set(mouths.map(n=>n.toFixed(2))).size<4)throw Error('The actual audio did not drive mouth movement: '+JSON.stringify(mouths));
  await js("aliceApp.voice.playId('alice-tea')");await delay(250);
  await js("aliceApp.voice.player.toggle()");await delay(160);
  const paused=await js("({speech:aliceApp.voice.diagnostic(),mouth:aliceApp.character.model.parameters.values[aliceApp.character.parameterIndex.ParamMouthOpenY]})");
  if(paused.speech.playing||paused.mouth>.01)throw Error('Pause did not close the mouth.');
  await js("aliceApp.voice.player.toggle()");await delay(180);
  await js("aliceApp.voice.stop()");await delay(120);
  const stopped=await js("({speech:aliceApp.voice.diagnostic(),mouth:aliceApp.character.model.parameters.values[aliceApp.character.parameterIndex.ParamMouthOpenY],captionHidden:document.getElementById('speech-caption').hidden})");
  if(stopped.speech.id||stopped.mouth>.01||!stopped.captionHidden)throw Error('Stop did not reset speech.');
  await js("aliceApp.voice.playId('aoko-mine')");
  await js("document.getElementById('voice-volume').focus();document.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape',bubbles:true}));");
  if(await js('Boolean(aliceApp.voice.player.item)'))throw Error('Escape did not stop speech while a control was focused.');
  const replaced=await js("(async()=>{await Promise.all([aliceApp.voice.playId('aoko-mine'),aliceApp.voice.playId('alice-book')]);return aliceApp.voice.diagnostic();})()");
  if(replaced.id!=='alice-book'||!replaced.playing)throw Error('Rapid speech replacement failed.');
  await js("aliceApp.voice.playId('lullaby')");
  await js("new Promise((resolve,reject)=>{const a=aliceApp.voice.player.audio;const timer=setTimeout(()=>reject(Error('Seek timed out')),5000);a.addEventListener('seeked',()=>{clearTimeout(timer);aliceApp.voice.player.emit();resolve();},{once:true});a.currentTime=4;})");await delay(120);
  const poemSubtitle=await js("document.getElementById('subtitle-zh').textContent");
  const lullaby=await js("aliceApp.voice.clips.find(c=>c.id==='lullaby')"),expected=lullaby.cues.find(c=>4.1>=c.start&&4.1<c.end);
  if(!expected||poemSubtitle!==expected.zh)throw Error('Lullaby seek caption failed: '+poemSubtitle+' '+JSON.stringify(await js('aliceApp.voice.diagnostic()')));
  if(lullaby.kind==='source-recording'&&(!lullaby.source?.url?.includes('BV1fv4y157tw')||poemSubtitle.includes('小鸟')||lullaby.duration<70))throw Error('The selected source recording was not installed.');
  const lullabyMouth=[];for(let i=0;i<16;i++){await delay(75);lullabyMouth.push(await js('aliceApp.character.model.parameters.values[aliceApp.character.parameterIndex.ParamMouthOpenY]'));}
  if(Math.max(...lullabyMouth)<.02)throw Error('Lullaby audio did not drive mouth movement.');
  await fs.writeFile(path.join(output,'lullaby-playing.png'),(await window.webContents.capturePage()).toPNG());
  await js("aliceApp.voice.player.audio.currentTime=aliceApp.voice.player.audio.duration-.08");await delay(450);
  const ended=await js("({speech:aliceApp.voice.diagnostic(),mouth:aliceApp.character.model.parameters.values[aliceApp.character.parameterIndex.ParamMouthOpenY]})");
  if(ended.speech.playing||ended.mouth>.01)throw Error('Mouth did not close at audio end.');
  await js("aliceApp.voice.stop();document.getElementById('voice-volume').value=25;document.getElementById('voice-volume').dispatchEvent(new Event('input'));document.getElementById('voice-custom').open=true;");
  const gain=await js("aliceApp.voice.player.gain.gain.value");if(Math.abs(gain-.25)>.001)throw Error('Volume control failed.');
  let generated=null;
  if(checkSynthesis){
    await js("aliceApp.voice.speakText('青子、これは私のものよ。','青子，这是我的东西。')");
    const levels=[];
    for(let i=0;i<20;i++){await delay(60);levels.push(await js("aliceApp.character.model.parameters.values[aliceApp.character.parameterIndex.ParamMouthOpenY]"));}
    if(Math.max(...levels)<.1)throw Error('Generated audio did not drive the mouth.');
    generated=await js("({duration:aliceApp.voice.lastGenerated.duration,speech:aliceApp.voice.diagnostic(),subtitle:document.getElementById('subtitle-zh').textContent})");
    if(!generated.speech.id.startsWith('generated-')||!generated.subtitle.includes('我的东西'))throw Error('Synthesized speech or subtitles missing.');
    await fs.copyFile(voice.lastGenerated,path.join(output,'generated-test.wav'));
    await fs.writeFile(path.join(output,'speaking-generated.png'),(await window.webContents.capturePage()).toPNG());
    await js("aliceApp.voice.stop()");
    await voice.stop();if(voice.info().ready||voice.child)throw Error('Voice worker was not stopped.');
  }
  await js("aliceApp.voice.stop();aliceApp.reset();aliceApp.showPanel('chat');");
  await fs.writeFile(path.join(output,'conversation.png'),(await window.webContents.capturePage()).toPNG());
  const keyStatus=await js("(async()=>{const info=await aliceDesktop.chatInfo();return {configured:info.keyConfigured,model:info.model};})()");
  if(!keyStatus.configured){await js("document.getElementById('chat-settings').click()");await delay(100);await fs.writeFile(path.join(output,'api-settings.png'),(await window.webContents.capturePage()).toPNG());await js("document.getElementById('api-dialog').close()");}
  await js("aliceApp.showPanel('voice');");
  const report={ok:true,catalog,mouthRange:[Math.min(...mouths),Math.max(...mouths)],pause:paused,stop:stopped,rapidReplacement:replaced.id,lullaby:{title:lullaby.title,duration:lullaby.duration,kind:lullaby.kind,source:lullaby.source,mouthRange:[Math.min(...lullabyMouth),Math.max(...lullabyMouth)]},verseSubtitle:poemSubtitle,end:ended,gain,generated,api:{...keyStatus,liveRequestTested:false}};
  await fs.writeFile(path.join(output,'voice-verification.json'),JSON.stringify(report,null,2));
  return report;
};
