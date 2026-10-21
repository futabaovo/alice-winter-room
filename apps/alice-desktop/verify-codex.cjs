const fs=require('node:fs/promises');
const path=require('node:path');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

exports.verifyCodex=async(window,output,{chat,voice})=>{
  const js=code=>window.webContents.executeJavaScript(code,true);
  const original=chat.info();
  try{
    const connection=await chat.codexStatus();
    if(!connection.loggedIn)throw Error('The local Codex account is not signed in.');
    await js("document.getElementById('chat-settings').click()");await delay(100);
    await js("document.getElementById('chat-provider').value='codex';document.getElementById('chat-provider').dispatchEvent(new Event('change'));document.getElementById('codex-model').value='gpt-6.1-sol';document.getElementById('api-reasoning').value='low';document.getElementById('api-form').requestSubmit()");
    for(let i=0;i<100;i++){if(chat.info().provider==='codex')break;await delay(50);}
    if(chat.info().provider!=='codex')throw Error('The settings form did not save the Codex provider.');
    await js("document.getElementById('api-dialog').close()");
    await js("aliceApp.showPanel('chat');document.getElementById('chat-messages').replaceChildren();document.getElementById('chat-input').value='有珠，今天一起喝杯茶吧。';document.getElementById('chat-auto-voice').checked=true;document.getElementById('chat-form').requestSubmit();");
    let completed=false;
    for(let i=0;i<1000;i++){completed=await js("Boolean(document.querySelector('.chat-message.assistant')&&!aliceApp.chat.busy)");if(completed)break;await delay(150);}
    if(!completed)throw Error('Live Codex conversation did not finish: '+await js("document.getElementById('chat-status').textContent"));
    const result=await js("({reply:document.querySelector('.chat-message.assistant').textContent,speech:aliceApp.voice.diagnostic(),subtitle:document.getElementById('subtitle-zh').textContent,mood:aliceApp.state.mood,performance:aliceApp.replyPerformance.diagnostic(),speechCues:aliceApp.voice.lastGenerated.speechCues})");
    if(!result.speech.playing||!result.speech.id?.startsWith('generated-')||!result.subtitle)throw Error('Live Codex reply did not reach local TTS and subtitles: '+JSON.stringify(result));
    let mouthMax=0;for(let i=0;i<18;i++){mouthMax=Math.max(mouthMax,await js("aliceApp.character.model.parameters.values[aliceApp.character.parameterIndex.ParamMouthOpenY]"));await delay(40);}
    if(mouthMax<.01)throw Error('Live reply did not drive the model mouth.');
    await fs.writeFile(path.join(output,'codex-speaking.png'),(await window.webContents.capturePage()).toPNG());
    await fs.copyFile(voice.lastGenerated,path.join(output,'codex-generated-test.wav'));
    await js("document.getElementById('chat-cancel').click();document.getElementById('chat-settings').click()");await delay(150);
    await js("document.getElementById('codex-check').click()");
    for(let i=0;i<200;i++){if(await js("!document.getElementById('codex-check').disabled"))break;await delay(100);}
    const settingsStatus=await js("document.getElementById('codex-status').textContent");
    if(!settingsStatus.includes('已登录'))throw Error('Codex settings account check failed: '+settingsStatus);
    await fs.writeFile(path.join(output,'codex-settings.png'),(await window.webContents.capturePage()).toPNG());
    const semantic=[];
    for(const [name,prompt]of [['ordinary','不用寒暄，请告诉我 2 加 3 等于几。'],['thoughtful-gift','我记得你喜欢这本旧版童话集。我找到了完好的初版，还仔细修复了里面松开的书页，送给你。']]){
      const reply=await chat.ask(prompt,{persist:false});semantic.push({name,prompt,...reply});
      if(name==='ordinary'&&reply.expressionEvents.length)throw Error('A simple factual reply forced an expression.');
    }
    const report={ok:true,transport:'Official local Codex App Server',liveRequestTested:true,model:'gpt-6.1-sol',authType:connection.authType,reply:result.reply,subtitle:result.subtitle,duration:result.speech.duration,mouthMax,settingsStatus,speechCues:result.speechCues,performance:result.performance,semantic};
    await fs.writeFile(path.join(output,'codex-verification.json'),JSON.stringify(report,null,2));return report;
  }finally{await js("document.getElementById('api-dialog').close();aliceApp.voice.stop()");chat.clear();chat.save({...original,key:''});await voice.stop();}
};
