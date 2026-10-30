const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
exports.verifyReactions=async(k,output)=>{
  const js=s=>k.window.webContents.executeJavaScript(s,true),report={rounds:[],localKeys:[]};
  k.save({scope:'local',outfit:'winter',paused:false,shortcuts:true});await delay(100);
  report.pages=await require('./verify-keyboard-pages.cjs').verifyPages(k,output);
  for(let round=1;round<=2;round++){
    const capture=await js(`(()=>{const c=document.createElement('canvas');c.width=960;c.height=744;const g=c.getContext('2d');g.fillStyle='${round===1?'#eee5dc':'#231e2c'}';g.fillRect(0,0,c.width,c.height);const stats=[];for(const [row,outfit]of ['winter','white','penguin'].entries())for(let col=0;col<5;col++){const p=document.createElement('canvas');p.width=192;p.height=224;const a=p.getContext('2d'),bounds=(col?keyboardApp.reactionSprites:keyboardApp.sprites).draw(a,{outfit,frame:col?col-1:0}),data=a.getImageData(0,0,192,224).data;let opaque=0;for(let i=3;i<data.length;i+=4)if(data[i]>100)opaque++;g.drawImage(p,col*192,row*248);g.fillStyle='${round===1?'#513c61':'#eadbec'}';g.font='12px Microsoft YaHei';g.fillText(outfit+' / '+['待机','书页','合书','扶额','检视'][col],col*192+15,row*248+239);stats.push({outfit,col,opaque,bounds,clearCorner:data[3]===0});}return {png:c.toDataURL(),stats};})()`);
    await fs.writeFile(path.join(output,'shortcut-review-round'+round+'.png'),Buffer.from(capture.png.split(',')[1],'base64'));
    await fs.writeFile(path.join(output,'shortcut-stats-round'+round+'.json'),JSON.stringify(capture.stats,null,2));
    for(const s of capture.stats){assert(s.opaque>4000&&s.clearCorner);assert(s.bounds.y>0&&s.bounds.y+s.bounds.h<=218);}
    for(const outfit of ['winter','white','penguin']){
      const values=capture.stats.filter(s=>s.outfit===outfit).map(s=>s.bounds.h);assert(Math.max(...values)-Math.min(...values)<=6,'Reaction size jump: '+outfit);
    }
    await fs.writeFile(path.join(output,'shortcut-review-round'+round+'.png'),Buffer.from(capture.png.split(',')[1],'base64'));report.rounds.push({round,stats:capture.stats});
  }
  const cases=[['C',['control'],'copy'],['X',['control'],'cut'],['V',['control'],'paste'],['S',['control'],'save'],['Z',['control'],'undo'],['Y',['control'],'redo'],['Z',['control','shift'],'redo'],['F',['control'],'find'],['A',['control'],'select'],['Return',[],'confirm'],['Escape',[],'dismiss']];
  for(const [keyCode,modifiers,id]of cases){
    await js('keyboardApp.reactions.reset();document.getElementById("pixel").focus()');
    k.window.webContents.sendInputEvent({type:'keyDown',keyCode,modifiers});k.window.webContents.sendInputEvent({type:'keyUp',keyCode,modifiers});await delay(45);
    assert.equal(await js('keyboardApp.reactions.current?.id'),id,'Native renderer chord: '+keyCode);report.localKeys.push({keyCode,modifiers,id});
  }
  await js('keyboardApp.reactions.reset();document.dispatchEvent(new CompositionEvent("compositionstart"))');
  k.window.webContents.sendInputEvent({type:'keyDown',keyCode:'Return'});await delay(30);assert.equal(await js('keyboardApp.reactions.current'),null);await js('document.dispatchEvent(new CompositionEvent("compositionend"))');report.imeEnterIgnored=true;
  k.save({scope:'global'});await delay(100);k.pulse('S:find');await delay(200);assert.equal(await js('keyboardApp.reactions.current?.id'),'find');k.pulse('key');await delay(35);assert.equal(await js('keyboardApp.reactions.current?.id'),'find');report.typingDoesNotInterrupt=true;
  k.save({shortcuts:false});await delay(60);k.pulse('S:copy');await delay(40);assert.equal(await js('keyboardApp.reactions.current'),null);assert.equal(await js('keyboardApp.motion.count'),1);report.toggleWorks=true;
  k.save({shortcuts:true});await delay(60);k.pulse('S:copy');k.pulse('S:paste');await delay(50);k.save({paused:true});await delay(50);assert.equal(await js('keyboardApp.reactions.current'),null);assert.equal(await js('keyboardApp.reactions.pending'),null);assert.equal(k.input.child,null);report.pauseCancels=true;
  k.save({paused:false});await delay(60);k.pulse('S:copy');await delay(60);await js('keyboardApp.setPanel(true)');k.pulse('S:save');await delay(40);assert.equal(await js('keyboardApp.reactions.current'),null);report.settingsSuppressInput=true;
  await js('document.getElementById("reaction-preview").value="save";document.getElementById("preview-reaction").click()');await delay(300);assert.equal(await js('keyboardApp.diagnostic().panel'),false);assert.equal(await js('keyboardApp.reactions.current?.id'),'save');report.previewWorks=true;
  await js('keyboardApp.setPanel(true)');await fs.writeFile(path.join(output,'shortcut-settings.png'),(await k.window.webContents.capturePage()).toPNG());await js('keyboardApp.setPanel(false)');
  k.save({outfit:'winter',scope:'global'});await delay(100);await js('keyboardApp.reactions.reset();keyboardApp.motion.reset()');return report;
};
