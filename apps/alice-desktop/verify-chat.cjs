const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

exports.verifyChat=async(window,output,{chat,voice})=>{
  const js=code=>window.webContents.executeJavaScript(code,true);
  const original=chat.info();
  if(original.keyConfigured)throw Error('Mock integration check requires an empty verification profile.');
  let requestBody=null,authenticated=false;
  const server=http.createServer(async(request,response)=>{
    let body='';for await(const chunk of request)body+=chunk;
    requestBody=JSON.parse(body);authenticated=request.headers.authorization==='Bearer test-only-desktop-verification';
    response.writeHead(200,{'Content-Type':'application/json'});
    response.end(JSON.stringify({status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({ja:'お帰りなさい。温かいお茶を淹れるわ。',zh:'欢迎回来。我来泡杯热茶。',emotion:'smile',expressionEvents:[{sentenceIndex:1,emotion:'smile',strength:.35,hold:.75}]})}]}]}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const baseUrl=`http://127.0.0.1:${server.address().port}/v1`;
    await js(`(async()=>{const r=await aliceDesktop.chatSave({model:'gpt-5.4-mini',baseUrl:${JSON.stringify(baseUrl)},reasoning:'low',remember:true,key:'test-only-desktop-verification'});if(!r.ok||r.keyPersistence!=='encrypted')throw Error('Native credential encryption failed');aliceApp.showPanel('chat');return r.keyConfigured;})()`);
    await js("document.getElementById('chat-input').value='今天一起喝茶吧。';document.getElementById('chat-auto-voice').checked=true;document.getElementById('chat-input').focus();");
    window.webContents.sendInputEvent({type:'keyDown',keyCode:'Return'});window.webContents.sendInputEvent({type:'keyUp',keyCode:'Return'});
    let completed=false;
    for(let i=0;i<900;i++){
      completed=await js("Boolean(document.querySelector('.chat-message.assistant')&&!aliceApp.chat.busy)");
      if(completed)break;await delay(150);
    }
    if(!completed)throw Error('Chat to speech integration did not finish: '+await js("document.getElementById('chat-status').textContent"));
    const result=await js("({messages:document.querySelectorAll('.chat-message').length,reply:document.querySelector('.chat-message.assistant').textContent,speech:aliceApp.voice.diagnostic(),mood:aliceApp.state.mood,subtitle:document.getElementById('subtitle-zh').textContent,speechCues:aliceApp.voice.lastGenerated.speechCues,performance:aliceApp.replyPerformance.diagnostic()})");
    if(!authenticated||!requestBody?.text?.format?.strict||requestBody.store!==false)throw Error('Desktop API request contract failed.');
    if(result.messages!==2||!result.reply.includes('热茶')||!result.speech.playing||!result.speech.id?.startsWith('generated-'))throw Error('Reply, translation or automatic voice failed: '+JSON.stringify(result));
    if(result.speechCues.length!==2||result.performance.timeline[0]?.start!==result.speechCues[1].start||result.mood!==0)throw Error('Actual sentence timing or calm opening failed: '+JSON.stringify(result));
    if(await js("document.getElementById('chat-cancel').disabled"))throw Error('The stop button was disabled while the reply was speaking.');
    await js('aliceApp.voice.player.toggle()');await fs.writeFile(path.join(output,'chat-before-expression.png'),(await window.webContents.capturePage()).toPNG());
    await js(`new Promise((resolve,reject)=>{const a=aliceApp.voice.player.audio,t=setTimeout(()=>reject(Error('Seek timeout')),4000);a.addEventListener('seeked',()=>{clearTimeout(t);resolve();},{once:true});a.currentTime=${result.speechCues[1].start+.65};})`);await delay(650);
    const during=await js('aliceApp.diagnostic()');if(during.performance.active?.index!==1||during.parameters.ParamEyeLOpen>.12)throw Error('Generated sentence did not trigger the authored closed-eye smile.');
    await fs.writeFile(path.join(output,'chat-speaking.png'),(await window.webContents.capturePage()).toPNG());
    await fs.copyFile(voice.lastGenerated,path.join(output,'chat-generated-test.wav'));
    await js("document.getElementById('chat-cancel').click()");
    if(await js('Boolean(aliceApp.voice.player.item)'))throw Error('The chat stop button did not stop the spoken reply.');
    if(await js("aliceApp.replyPerformance.diagnostic().mode!=='idle'||aliceApp.state.mood!==0"))throw Error('Stopping the reply did not release its expression.');
    const report={ok:true,apiTransport:'Local mock Responses API through real desktop networking',liveOpenAIRequestTested:false,nativeCredentialEncryption:true,reply:result.reply,openingMood:result.mood,speechCues:result.speechCues,performanceDuring:during.performance,generatedDuration:result.speech.duration,speechId:result.speech.id,subtitle:result.subtitle};
    await fs.writeFile(path.join(output,'chat-verification.json'),JSON.stringify(report,null,2));
    return report;
  }finally{
    await js(`(async()=>{aliceApp.voice.stop();await aliceDesktop.chatClear();await aliceDesktop.chatForgetKey();await aliceDesktop.chatSave(${JSON.stringify({...original,key:''})});})()`);
    await voice.stop();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  }
};
