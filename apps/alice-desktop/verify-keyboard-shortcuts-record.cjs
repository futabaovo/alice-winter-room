const fs=require('node:fs/promises'),path=require('node:path');
exports.recordKeyboard=async(win,output)=>{
  const encoded=await win.webContents.executeJavaScript(`(async()=>{
    const c=document.createElement('canvas');c.width=960;c.height=720;const g=c.getContext('2d'),source=document.getElementById('pixel');
    const recorder=new MediaRecorder(c.captureStream(60),{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:4000000}),chunks=[];
    const stopped=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=resolve;});recorder.start();
    const shots=[
      ['winter','copy','Ctrl + C','收好这一页'],['winter','paste','Ctrl + V','把书页放回去'],['winter','save','Ctrl + S','合书，妥善保管'],
      ['white','undo','Ctrl + Z','停手扶额，再想一遍'],['white','redo','Ctrl + Shift + Z','重新确认'],['white','find','Ctrl + F','举书仔细检视'],
      ['penguin','select','Ctrl + A','这些都要？'],['penguin','cut','Ctrl + X','先收起来'],['penguin','confirm','Enter','轻敲确认'],['penguin','dismiss','Esc','闭眼收手']
    ];let current=-1,triggered=false,lastBeat=-1;const start=performance.now();
    await new Promise(resolve=>{const paint=async now=>{
      const elapsed=(now-start)/1000,index=Math.min(shots.length-1,Math.floor(elapsed/3.2)),part=elapsed-index*3.2,[outfit,id,key,title]=shots[index];
      if(current!==index){current=index;await keyboardDesktop.save({outfit,scope:'local',paused:false,shortcuts:true});keyboardApp.reactions.reset();keyboardApp.motion.reset();triggered=false;lastBeat=-1;}
      if(part<.55&&Math.floor(part/.17)!==lastBeat){lastBeat=Math.floor(part/.17);keyboardApp.pulse('key');}
      if(part>=.55&&!triggered){triggered=true;keyboardApp.pulse('S:'+id);}
      g.fillStyle='#211c2b';g.fillRect(0,0,960,720);g.fillStyle='#302637';g.fillRect(36,36,888,648);g.textAlign='left';g.fillStyle='#e7d8ed';g.font='bold 26px Microsoft YaHei';g.fillText('有珠 · 键盘时光',72,100);g.fillStyle='#bca8c9';g.font='15px Microsoft YaHei';g.fillText('快捷键专属动作 / 实际程序渲染',72,134);
      g.fillStyle='#e8cc9b';g.font='bold 28px Segoe UI';g.fillText(key,72,304);g.fillStyle='#ece0f0';g.font='19px Microsoft YaHei';g.fillText(title,72,350);g.font='14px Microsoft YaHei';g.fillStyle='#b7a4c1';g.fillText({winter:'冬日披肩',white:'白色冬装',penguin:'企鹅服'}[outfit],72,388);
      g.imageSmoothingEnabled=false;g.drawImage(source,456,148,432,504);g.fillStyle='#d9cae4';g.font='15px Microsoft YaHei';g.textAlign='center';g.fillText(document.getElementById('line').textContent,672,668);
      g.fillStyle='#594660';g.fillRect(72,622,300,3);g.fillStyle='#d4b88c';g.fillRect(72,622,300*Math.min(1,elapsed/(shots.length*3.2)),3);
      if(elapsed<shots.length*3.2)requestAnimationFrame(paint);else resolve();};requestAnimationFrame(paint);});
    recorder.stop();await stopped;const blob=new Blob(chunks,{type:'video/webm'});return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
  })()`,true);
  const file=path.join(output,'keyboard-shortcuts-preview.webm');await fs.writeFile(file,Buffer.from(encoded.split(',')[1],'base64'));return file;
};
