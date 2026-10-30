const fs=require('node:fs/promises'),path=require('node:path');
exports.recordKeyboard=async(win,output)=>{
  const encoded=await win.webContents.executeJavaScript(`(async()=>{
    const c=document.createElement('canvas');c.width=576;c.height=720;const g=c.getContext('2d'),source=document.getElementById('pixel');
    const recorder=new MediaRecorder(c.captureStream(60),{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:3500000}),chunks=[];
    const stopped=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=resolve;});recorder.start();
    const names=['冬日披肩','白色冬装','企鹅服'],outfits=['winter','white','penguin'];let current=-1,lastBeat=-1;const start=performance.now();
    await new Promise(resolve=>{const paint=async now=>{
      const elapsed=(now-start)/1000,index=Math.min(2,Math.floor(elapsed/5)),part=elapsed-index*5;
      if(current!==index){current=index;await keyboardDesktop.save({outfit:outfits[index],scope:'local',paused:false});lastBeat=-1;}
      if(part<3&&Math.floor(part/.18)!==lastBeat){lastBeat=Math.floor(part/.18);keyboardApp.pulse('key');}
      g.fillStyle='#eae1dc';g.fillRect(0,0,c.width,c.height);g.textAlign='center';g.fillStyle='#4d3b59';g.font='bold 23px Microsoft YaHei';g.fillText('像素键盘模式 · 动作预览',288,62);g.font='16px Microsoft YaHei';g.fillText(names[index],288,99);
      g.imageSmoothingEnabled=false;g.drawImage(source,48,124,480,560);g.font='15px Microsoft YaHei';g.fillText(part<3?'敲击节奏 → 左右交替':'停手 → 回到待机',288,705);
      if(elapsed<15)requestAnimationFrame(paint);else resolve();};requestAnimationFrame(paint);});
    recorder.stop();await stopped;const blob=new Blob(chunks,{type:'video/webm'});return await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.readAsDataURL(blob);});
  })()`,true);
  const file=path.join(output,'keyboard-mode-preview.webm');await fs.writeFile(file,Buffer.from(encoded.split(',')[1],'base64'));return file;
};
