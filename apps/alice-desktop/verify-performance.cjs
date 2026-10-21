const fs=require('node:fs/promises');
const path=require('node:path');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
exports.verifyPerformance=async(window,output)=>{
  const js=code=>window.webContents.executeJavaScript(code,true);
  const snap=()=>js('aliceApp.diagnostic()');
  const capture=async name=>{await fs.writeFile(path.join(output,`reply-${name}.png`),(await window.webContents.capturePage()).toPNG());};
  const seek=async time=>{await js(`new Promise((resolve,reject)=>{const a=aliceApp.voice.player.audio,t=setTimeout(()=>reject(Error('Seek timeout')),4000);a.addEventListener('seeked',()=>{clearTimeout(t);resolve();},{once:true});a.currentTime=${time};})`);await delay(180);};
  try{
    await js("aliceApp.reset();document.getElementById('idle').checked=false;document.getElementById('tracking').checked=false;aliceApp.setView('face');aliceApp.pause(false);aliceApp.showPanel('chat');");
    // A bundled real audio file with deliberately specified sentence anchors
    // isolates player lifecycle from TTS quality. verify-chat checks real TTS cues.
    await js(`(async()=>{const p=aliceApp.replyPerformance,t=p.reserve();p.accept(t,{ja:'そう。悪くないわ。',expressionEvents:[{sentenceIndex:1,emotion:'smile',strength:.35,hold:.75}]});const item={...aliceApp.voice.clips.find(c=>c.id==='lullaby'),id:'performance-test',speechCues:[{start:0,end:1},{start:2,end:5}]};p.attachSpeech(t,item);await aliceApp.voice.player.play(item);await aliceApp.voice.player.toggle();})()`);
    const before=await snap();if(before.performance.active||before.mood!=='平静')throw Error('Expression started before its sentence.');await capture('before');
    await seek(2.65);await delay(500);const active=await snap();
    if(active.performance.active?.index!==1||active.parameters.ParamEyeLOpen>.12||active.parameters.ParamEyeROpen>.12)throw Error('Timed closed-eye expression did not reach authored closure: '+JSON.stringify(active.performance));
    if(active.glError||!active.finite)throw Error('Invalid expression render.');await capture('during');
    const frozenTime=active.speech.time;await delay(450);const paused=await snap();
    if(paused.speech.time!==frozenTime||paused.performance.active?.weight!==active.performance.active.weight)throw Error('Paused audio did not hold the expression clock.');
    await seek(.5);await delay(500);const rewound=await snap();if(rewound.performance.active||rewound.mood!=='平静'||rewound.parameters.ParamEyeLOpen<.8)throw Error('Seeking backwards did not restore baseline.');
    await seek(2.65);await js('aliceApp.setMood(2)');await delay(500);const manual=await snap();if(manual.performance.mode!=='idle'||manual.mood!=='不悦')throw Error('Manual expression did not take precedence.');
    await js("{aliceApp.voice.stop();aliceApp.setMood(0);const p=aliceApp.replyPerformance,t=p.reserve();p.accept(t,{ja:'普通の返事。',expressionEvents:[]});p.startText(t);}");await delay(350);const empty=await snap();if(empty.performance.active||empty.mood!=='平静')throw Error('Empty plan forced an emotion.');
    await js("{const p=aliceApp.replyPerformance;p.cancel();const t=p.reserve();aliceApp.setMood(7);p.accept(t,{ja:'……そう。',expressionEvents:[{sentenceIndex:0,emotion:'smile',strength:.4,hold:1}]});p.startText(t);}");await delay(350);const pendingManual=await snap();if(pendingManual.mood!=='冷视'||pendingManual.performance.mode!=='idle')throw Error('A pending reply overrode manual selection.');
    await js("{aliceApp.setMood(0);const p=aliceApp.replyPerformance,t=p.reserve();p.accept(t,{ja:'約束でしょう。',expressionEvents:[{sentenceIndex:0,emotion:'bow',strength:.35,hold:.75}]});p.startText(t);}");await delay(650);const textOnly=await snap();if(textOnly.performance.active?.index!==10)throw Error('Text-only expression did not work.');
    await js("document.getElementById('chat-expressions').checked=false;document.getElementById('chat-expressions').dispatchEvent(new Event('change'))");await delay(500);const disabled=await snap();if(disabled.performance.enabled||disabled.performance.mode!=='idle'||disabled.mood!=='平静')throw Error('Disable did not restore baseline.');
    await js("{document.getElementById('chat-expressions').checked=true;document.getElementById('chat-expressions').dispatchEvent(new Event('change'));aliceApp.setMood(0);const p=aliceApp.replyPerformance,t=p.reserve();p.accept(t,{ja:'考えてみるわ。',expressionEvents:[{sentenceIndex:0,emotion:'thinking',strength:.4,hold:.6}]});p.startText(t);}");await delay(1800);const released=await snap();if(released.performance.active||released.mood!=='平静')throw Error('Expression did not fade back to baseline.');await capture('after');
    await js(`(async()=>{const p=aliceApp.replyPerformance,t=p.reserve(),clip=aliceApp.voice.clips.find(c=>c.id==='aoko-mine');p.accept(t,{ja:'考えてみるわ。',expressionEvents:[{sentenceIndex:0,emotion:'thinking',strength:.4,hold:1.2}]});const item={...clip,id:'performance-ending',speechCues:[{start:clip.duration-.65,end:clip.duration}]};p.attachSpeech(t,item);await aliceApp.voice.player.play(item);await aliceApp.voice.player.toggle();})()`);
    const duration=await js('aliceApp.voice.player.audio.duration');await seek(duration-.35);await js('aliceApp.voice.player.toggle()');await delay(1200);const ended=await snap();
    if(!ended.speech.ended||ended.performance.active||ended.mood!=='平静')throw Error('Audio completion did not release the active expression.');
    await js('aliceApp.voice.player.toggle();');await seek(duration-.35);await js('aliceApp.voice.player.toggle();');const replay=await snap();
    if(replay.performance.active?.index!==5)throw Error('Replay did not reconstruct its expression.');
    const report={ok:true,audioFixture:'bundled WAV files with constructed sentence anchors; actual TTS timing separately checked by verify-chat',before,active,paused,rewound,manual,empty,pendingManual,textOnly,disabled,released,ended,replay};
    await fs.writeFile(path.join(output,'reply-performance-verification.json'),JSON.stringify(report,null,2));return report;
  }finally{await js('aliceApp.replyPerformance.setEnabled(true);aliceApp.reset();');}
};
