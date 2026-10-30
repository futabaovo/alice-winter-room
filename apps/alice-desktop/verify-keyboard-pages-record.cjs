const fs=require('node:fs/promises'),path=require('node:path');
exports.recordPages=async(win,output)=>{
  const encoded=await win.webContents.executeJavaScript(`(async()=>{
    const c=document.createElement('canvas');c.width=960;c.height=720;const g=c.getContext('2d'),source=document.getElementById('pixel');
    const recorder=new MediaRecorder(c.captureStream(60),{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:4000000}),chunks=[];
    const stopped=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=resolve;});recorder.start();
    const outfits=['winter','white','penguin'];let current=-1,triggered=false;const start=performance.now();
    await new Promise(resolve=>{const paint=async now=>{
      const elapsed=(now-start)/1000,index=Math.min(2,Math.floor(elapsed/7)),part=elapsed-index*7,outfit=outfits[index];
      if(current!==index){current=index;await keyboardDesktop.save({outfit,scope:'local',paused:false,shortcuts:true});keyboardApp.reactions.reset();keyboardApp.motion.reset();triggered=false;}
      if(part>=.7&&!triggered){triggered=true;keyboardApp.pulse('S:copy');keyboardApp.pulse('S:paste');}
      const r=keyboardApp.diagnostic().reaction;
      g.fillStyle='#211c2b';g.fillRect(0,0,960,720);g.fillStyle='#302637';g.fillRect(36,36,888,648);g.textAlign='left';g.fillStyle='#e7d8ed';g.font='bold 26px Microsoft YaHei';g.fillText('有珠 · 书页魔法',72,100);g.fillStyle='#bca8c9';g.font='15px Microsoft YaHei';g.fillText('复制 / 粘贴 · 实际程序动作',72,134);
      g.fillStyle='#e8cc9b';g.font='bold 28px Segoe UI';g.fillText(r?.id==='paste'?'Ctrl + V':r?.id==='copy'?'Ctrl + C':'Ctrl + C  →  Ctrl + V',72,282);g.fillStyle='#ece0f0';g.font='19px Microsoft YaHei';g.fillText(r?.id==='paste'?'取页 · 双手托下 · 轻按':r?.id==='copy'?'翻书 · 抽页 · 留一份':'快速连按，依次完成',72,330);g.font='14px Microsoft YaHei';g.fillStyle='#b7a4c1';g.fillText({winter:'冬日披肩',white:'白色冬装',penguin:'企鹅服'}[outfit],72,370);
      g.imageSmoothingEnabled=false;g.drawImage(source,456,148,432,504);g.fillStyle='#d9cae4';g.font='15px Microsoft YaHei';g.textAlign='center';g.fillText(document.getElementById('line').textContent,672,668);
      g.fillStyle='#594660';g.fillRect(72,622,300,3);g.fillStyle='#d4b88c';g.fillRect(72,622,300*Math.min(1,elapsed/21),3);
      if(elapsed<21)requestAnimationFrame(paint);else resolve();};requestAnimationFrame(paint);});
    recorder.stop();await stopped;const blob=new Blob(chunks,{type:'video/webm'});return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
  })()`,true);
  const file=path.join(output,'copy-paste-preview.webm');await fs.writeFile(file,Buffer.from(encoded.split(',')[1],'base64'));return file;
};
