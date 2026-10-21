const fs = require('node:fs/promises');
const path = require('node:path');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

exports.verify = async (window, url, output, options={}) => {
  const errors=[], requests=[];
  window.webContents.on('console-message', details => { if(details.level==='error') errors.push(details.message); });
  window.webContents.session.webRequest.onCompleted(details => { if(details.statusCode>=400) requests.push(`${details.statusCode}: ${details.url}`); });
  if(options.startupOnly){const startup=await require('./verify-startup.cjs').verifyStartup(window,url,output,options),unexpected=errors.filter(error=>!startup.expectedFailureErrors.includes(error));if(unexpected.length||requests.length)throw Error(JSON.stringify({errors:unexpected,requests}));await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({ok:true,startup,errors:unexpected,failedRequests:requests},null,2));return;}
  await window.loadURL(url);
  let ready=false;
  for(let i=0;i<120;i++){ready=await window.webContents.executeJavaScript("Boolean(window.aliceApp?.state.ready && window.aliceApp.character.frames>3 && document.getElementById('loading').hidden)");if(ready)break;await delay(150);}
  if(!ready)throw Error('Application did not render a ready character. '+JSON.stringify(errors));
  if(options.expressionAuditRound){await require('./verify-expression-audit.cjs').verifyExpressionAudit(window,output,options);if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));return;}
  if(options.expressionsOnly){const expressions=await require('./verify-expressions.cjs').verifyExpressions(window,output,options);if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({ok:true,expressions,errors,failedRequests:requests},null,2));return;}
  if(options.penguinPeekOnly){const peek=await require('./verify-penguin-peek.cjs').verifyPenguinPeek(window,output,options);if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({ok:true,peek,errors,failedRequests:requests},null,2));return;}
  if(options.stickersOnly){const stickers=await require('./verify-stickers.cjs').verifyStickers(window,output,options);if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({ok:true,stickers,errors,failedRequests:requests},null,2));return;}
  if(options.opacityOnly){const opacity=await require('./verify-opacity.cjs').verifyOpacity(window,output,options);if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({ok:true,opacity,errors,failedRequests:requests},null,2));return;}
  if(options.petUIOnly){await require('./verify-pet-ui.cjs').verifyPetUI(window,output,options);if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));return;}
  if(options.petCompanionsOnly){await require('./verify-pet-companions.cjs').verifyPetCompanions(window,output,options);if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));return;}
  if(options.voiceOnly){const speech=await require('./verify-voice.cjs').verifyVoice(window,output,options);if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));await fs.writeFile(path.join(output,'verification.json'),JSON.stringify({ok:true,scope:'Bundled voice playback and imported lullaby',speech,errors,failedRequests:requests},null,2));return;}
  if(options.teaOnly){const tea=await require('./verify-tea.cjs').verifyTea(window,output,options);if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));const report={ok:true,scope:'Tea brewing, quality, reactions, room and pet',tea,errors,failedRequests:requests};await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2));return report;}
  if(options.edgeOnly){const edge=await require('./verify-pet-edge.cjs').verifyEdge(window,output,options);if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));const report={ok:true,scope:'Continuous pet size, edge hide/peek/recall and persistence',edge,errors,failedRequests:requests};await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2));return report;}
  if(options.wardrobeOnly){const wardrobe=await require('./verify-wardrobe.cjs').verifyWardrobe(window,output,options);if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));const report={ok:true,wardrobe,errors,failedRequests:requests};await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2));return report;}
  if(options.feedingOnly){const feeding=await require('./verify-feeding.cjs').verifyFeeding(window,output,options);if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));const report={ok:true,scope:'Sushi feeding in room and desktop-pet modes',feeding,errors,failedRequests:requests};await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2));return report;}
  if(options.visionOnly){const vision=await require('./verify-vision.cjs').verifyVision(window,output,options);if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));const report={ok:true,packaged:require('electron').app.isPackaged,executable:process.execPath,vision,errors,failedRequests:requests};await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2));return report;}
  if(options.petOnly){const pet=await require('./verify-pet.cjs').verifyPet(window,output,options);if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));const report={ok:true,packaged:require('electron').app.isPackaged,executable:process.execPath,pet,errors,failedRequests:requests};await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));return report;}
  if(options.companionOnly){const companion=await require('./verify-companion.cjs').verifyCompanion(window,output,options);if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));const report={ok:true,packaged:require('electron').app.isPackaged,executable:process.execPath,companion,errors,failedRequests:requests};await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));return report;}
  const roomLayout=await require('./verify-layout.cjs').verifyLayout(window,output);
  if(options.layoutOnly){
    if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));
    const report={ok:true,packaged:require('electron').app.isPackaged,executable:process.execPath,scope:'background and layout including keyboard and toolbar',roomLayout,errors,failedRequests:requests};
    await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2));return report;
  }
  await window.webContents.executeJavaScript("document.getElementById('idle').checked=false;document.getElementById('tracking').checked=false;aliceApp.pause(true);aliceApp.setView('face');document.getElementById('intensity').value=100;document.getElementById('intensity').dispatchEvent(new Event('input'));");
  const moods=[];
  const expressionCount=await window.webContents.executeJavaScript('aliceApp.definitions.length');
  if(expressionCount!==require('./character/expressions.json').length)throw Error('Expression catalog did not reach the renderer.');
  for(let i=0;i<expressionCount;i++){
    await window.webContents.executeJavaScript(`aliceApp.setMood(${i});aliceApp.settle();aliceApp.renderNow();`);
    await delay(150);
    const data=await window.webContents.executeJavaScript('aliceApp.diagnostic()');
    if(!data.finite || data.glError || data.visiblePixels<10000)throw Error('Invalid or blank render: '+JSON.stringify(data));
    const png=await window.webContents.executeJavaScript('aliceApp.capture()');
    await fs.writeFile(path.join(output,`mood-${i+1}.png`),Buffer.from(png.split(',')[1],'base64'));
    moods.push(data);
  }
  if(new Set(moods.map(m=>m.pixelChecksum)).size!==expressionCount)throw Error('Expressions are not visually distinct.');
  const semantic=await window.webContents.executeJavaScript("(()=>{const byId=Object.fromEntries(aliceApp.definitions.map(d=>[d.id,d]));const value=(id,param)=>byId[id].expression.Parameters.find(p=>p.Id===param).Value;return {neutralOpen:value('neutral','ParamEyeLOpen'),surpriseOpen:value('surprised','ParamEyeLOpen'),smileOpen:value('smile','ParamEyeLOpen'),smileMouth:value('smile','ParamMouthForm'),coldShade:byId.cold.faceShadow,reserved:byId.reserved.name};})()");
  if(semantic.neutralOpen>=semantic.surpriseOpen||semantic.smileOpen!==0||semantic.smileMouth>.3||semantic.coldShade<.2||semantic.reserved!=='敛容')throw Error('Reference expression intent was not preserved.');
  await window.webContents.executeJavaScript("document.getElementById('chat-persona').click()");await delay(100);
  const shownPersona=await window.webContents.executeJavaScript("document.getElementById('persona-content').textContent");
  if(!shownPersona.includes('重视传统')||!shownPersona.includes('约定')||!shownPersona.includes('浪漫'))throw Error('The actual persona was not available in the UI.');
  await fs.writeFile(path.join(output,'persona-settings.png'),(await window.webContents.capturePage()).toPNG());
  await window.webContents.executeJavaScript("document.getElementById('persona-dialog').close()");
  // Render the native eye meshes without the face/hair, retaining their real
  // white-to-iris clipping masks. This distinguishes a broken mask from normal
  // foreground fringe occlusion at the inner corners.
  await window.webContents.executeJavaScript('aliceApp.setMood(0);aliceApp.settle();aliceApp.renderNow();');
  const eyeIsolation=await window.webContents.executeJavaScript(`(()=>{const c=aliceApp.character,d=c.model.drawables,all=c.order;const keep=all.filter(i=>/^ArtMesh(Eyewhite|Irides|Eyelash)/.test(d.ids[i]));const masks=keep.filter(i=>/Irides/.test(d.ids[i])).map(i=>({id:d.ids[i],masks:Array.from(d.masks[i]).map(j=>d.ids[j])}));try{c.order=keep;c.render();return {png:aliceApp.capture(),report:aliceApp.diagnostic(),masks};}finally{c.order=all;c.render();}})()`);
  if(eyeIsolation.masks.length!==2||eyeIsolation.masks.some(eye=>!eye.masks.some(id=>/Eyewhite/.test(id)))||eyeIsolation.report.visiblePixels<300||eyeIsolation.report.glError)throw Error('Native iris isolation or clipping failed.');
  await fs.writeFile(path.join(output,'eyes-isolated.png'),Buffer.from(eyeIsolation.png.split(',')[1],'base64'));
  delete eyeIsolation.png;
  const eyeStates=[];
  for(const [name,open]of [['open',1],['half',.55],['closed',0]]){
    const capture=await window.webContents.executeJavaScript(`(()=>{const c=aliceApp.character;c.mode='face';c.reset();c.set('ParamEyeLOpen',${open});c.set('ParamEyeROpen',${open});c.set('ParamMouthForm',-.15);c.render();return {png:aliceApp.capture(),report:aliceApp.diagnostic()};})()`);
    await fs.writeFile(path.join(output,'eyes-'+name+'.png'),Buffer.from(capture.png.split(',')[1],'base64'));
    eyeStates.push({name,...capture.report});
  }
  // Exercise the actual pointer handler and native masked irises at the edges,
  // including expression offsets which can reach the model's parameter limits.
  await window.webContents.executeJavaScript("aliceApp.setMood(0);aliceApp.settle();aliceApp.pause(false);document.getElementById('tracking').checked=true;aliceApp.renderNow();");
  const gazeStates=[];
  for(const [name,x,y]of [['center',.5,.5],['left',0,.5],['right',1,.5],['up',.5,0],['down',.5,1],['upper-left',0,0],['upper-right',1,0],['lower-left',0,1],['lower-right',1,1]]){
    const capture=await window.webContents.executeJavaScript(`(()=>{const c=aliceApp.character,r=c.canvas.getBoundingClientRect();c.canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+r.width*${x},clientY:r.top+r.height*${y}}));aliceApp.renderNow();return {png:aliceApp.capture(),report:aliceApp.diagnostic()};})()`);
    if(!capture.report.finite||capture.report.glError||capture.report.visiblePixels<10000)throw Error('Invalid gaze render: '+name);
    await fs.writeFile(path.join(output,'gaze-'+name+'.png'),Buffer.from(capture.png.split(',')[1],'base64'));
    gazeStates.push({name,...capture.report});
  }
  if(new Set(gazeStates.map(g=>g.pixelChecksum)).size!==9)throw Error('Gaze directions are not visually distinct.');
  for(const [mood,name,x,y]of [[4,'reserved-limit',0,1],[5,'thinking-limit',1,0],[6,'closed-limit',1,1],[7,'cold-limit',1,0],[9,'aside-limit',0,1]]){
    await window.webContents.executeJavaScript(`aliceApp.setMood(${mood});aliceApp.settle();`);
    const capture=await window.webContents.executeJavaScript(`(()=>{const c=aliceApp.character,r=c.canvas.getBoundingClientRect();c.canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:r.left+r.width*${x},clientY:r.top+r.height*${y}}));aliceApp.renderNow();return {png:aliceApp.capture(),report:aliceApp.diagnostic()};})()`);
    if(!capture.report.finite||capture.report.glError||capture.report.visiblePixels<10000)throw Error('Invalid expression gaze limit: '+name);
    await fs.writeFile(path.join(output,'gaze-'+name+'.png'),Buffer.from(capture.png.split(',')[1],'base64'));
    gazeStates.push({name,...capture.report});
  }
  const gazeReturn=await window.webContents.executeJavaScript("(()=>{aliceApp.setMood(0);aliceApp.settle();aliceApp.character.canvas.dispatchEvent(new PointerEvent('pointerleave'));aliceApp.renderNow();return aliceApp.diagnostic();})()");
  if(Math.abs(gazeReturn.parameters.ParamEyeBallX)>1e-6||Math.abs(gazeReturn.parameters.ParamEyeBallY)>1e-6||!gazeReturn.finite||gazeReturn.glError)throw Error('Gaze did not return to neutral after leaving the stage.');
  await window.webContents.executeJavaScript("document.getElementById('tracking').checked=false;aliceApp.pause(true);");
  await window.webContents.executeJavaScript("aliceApp.reset();document.getElementById('idle').checked=false;aliceApp.pause(true);aliceApp.settle();aliceApp.renderNow();");await delay(200);
  await fs.writeFile(path.join(output,'application.png'),(await window.webContents.capturePage()).toPNG());
  await window.webContents.executeJavaScript("aliceApp.setView('full');aliceApp.renderNow();");await delay(100);
  await fs.writeFile(path.join(output,'full-body.png'),(await window.webContents.capturePage()).toPNG());
  const baseline=await window.webContents.executeJavaScript('aliceApp.diagnostic()');
  const changes=await window.webContents.executeJavaScript(`(()=>{const c=aliceApp.character,m=c.model;const get=()=>m.drawables.vertexPositions.map(a=>Array.from(a));c.reset();m.update();const rest=get(),op=Array.from(m.drawables.opacities),result={};for(const [id,value]of Object.entries({ParamAngleX:8,ParamAngleY:6,ParamEyeLOpen:0,ParamEyeROpen:0,ParamEyeBallX:.6,ParamBrowLY:1,ParamBrowRY:-1,ParamMouthForm:1,ParamMouthOpenY:1,ParamBreath:1})){c.reset();c.set(id,value);m.update();let vertices=0,opacity=0;m.drawables.vertexPositions.forEach((a,d)=>a.forEach((v,i)=>{if(Math.abs(v-rest[d][i])>1e-6)vertices++;}));m.drawables.opacities.forEach((v,i)=>{if(Math.abs(v-op[i])>1e-6)opacity++;});result[id]={vertices,opacity};}return result;})()`);
  if(Object.values(changes).some(change=>change.vertices+change.opacity===0))throw Error('Inactive expression/motion parameter: '+JSON.stringify(changes));
  const visualAudit=await require('./verify-visual.cjs').verifyVisual(window,output,{enforce:true});
  const speech=await require('./verify-voice.cjs').verifyVoice(window,output,options);
  const replyPerformance=await require('./verify-performance.cjs').verifyPerformance(window,output);
  const conversation=options.checkSynthesis?await require('./verify-chat.cjs').verifyChat(window,output,options):{liveOpenAIRequestTested:false};
  const codex=options.checkCodex?await require('./verify-codex.cjs').verifyCodex(window,output,options):null;
  if(errors.length||requests.length)throw Error(JSON.stringify({errors,requests}));
  const report={ok:true,packaged:require('electron').app.isPackaged,executable:process.execPath,roomLayout,baseline,moods,eyeIsolation,eyeStates,gazeStates,gazeReturn,changes,visualAudit,speech,replyPerformance,conversation,codex,errors,failedRequests:requests};
  await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({ok:true,packaged:report.packaged,moods:moods.map(m=>({name:m.mood,pixels:m.visiblePixels,checksum:m.pixelChecksum})),changes}));
};
