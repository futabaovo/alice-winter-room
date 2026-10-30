const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
exports.verifyPages=async(k,output)=>{
  const js=s=>k.window.webContents.executeJavaScript(s,true),report={rounds:[]};
  for(let round=1;round<=2;round++){
    const capture=await js(`(()=>{const c=document.createElement('canvas');c.width=1152;c.height=744;const g=c.getContext('2d');g.fillStyle='${round===1?'#eee5dc':'#231e2c'}';g.fillRect(0,0,c.width,c.height);const stats=[];for(const [row,outfit]of ['winter','white','penguin'].entries())for(let col=0;col<6;col++){const p=document.createElement('canvas');p.width=192;p.height=224;const a=p.getContext('2d'),bounds=keyboardApp.pageSprites.draw(a,{outfit,frame:col}),data=a.getImageData(0,0,192,224).data;let opaque=0;for(let i=3;i<data.length;i+=4)if(data[i]>100)opaque++;g.drawImage(p,col*192,row*248);g.fillStyle='${round===1?'#513c61':'#eadbec'}';g.font='12px Microsoft YaHei';g.fillText(outfit+' / '+['C 翻书','C 抽页','C 复制','V 取页','V 托页','V 落下'][col],col*192+15,row*248+239);stats.push({outfit,col,opaque,bounds,clearCorner:data[3]===0});}return {png:c.toDataURL(),stats};})()`);
    await fs.writeFile(path.join(output,'copy-paste-round'+round+'.png'),Buffer.from(capture.png.split(',')[1],'base64'));
    await fs.writeFile(path.join(output,'copy-paste-stats'+round+'.json'),JSON.stringify(capture.stats,null,2));
    for(const s of capture.stats){assert(s.opaque>4000&&s.clearCorner);assert(s.bounds.y>0&&s.bounds.y+s.bounds.h<=218);}
    for(const outfit of ['winter','white','penguin']){const values=capture.stats.filter(s=>s.outfit===outfit);assert(Math.max(...values.map(s=>s.bounds.h))-Math.min(...values.map(s=>s.bounds.h))<=3,'Page gesture height jumps: '+outfit);assert(Math.max(...values.map(s=>s.bounds.w))-Math.min(...values.map(s=>s.bounds.w))<=7,'Page gesture width jumps: '+outfit);}
    report.rounds.push({round,stats:capture.stats});
  }
  k.save({scope:'local',outfit:'winter',paused:false,shortcuts:true});await delay(60);
  await js('keyboardApp.reactions.reset();document.getElementById("pixel").focus()');
  for(const keyCode of ['C','V']){k.window.webContents.sendInputEvent({type:'keyDown',keyCode,modifiers:['control']});k.window.webContents.sendInputEvent({type:'keyUp',keyCode,modifiers:['control']});await delay(40);}
  assert.equal(await js('keyboardApp.reactions.current?.id'),'copy');assert.equal(await js('keyboardApp.reactions.pending?.id'),'paste');
  await delay(2800);assert.equal(await js('keyboardApp.reactions.current?.id'),'paste');await delay(2500);assert.equal(await js('keyboardApp.reactions.current'),null);assert.equal(await js('keyboardApp.reactions.started'),2);report.quickCopyPaste=true;
  await js('keyboardApp.reactions.reset();keyboardApp.motion.reset()');return report;
};
