const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
exports.verifyBookGame=async(room,output,{desktopPet})=>{
  const js=async(s,w=room)=>{try{return await w.webContents.executeJavaScript(`{${s}}`,true);}catch(error){throw Error(error.message+'\nScript: '+s.slice(0,800));}};
  const capture=async(name,w=room)=>{await delay(90);await fs.writeFile(path.join(output,name+'.png'),(await w.webContents.capturePage()).toPNG());};
  const canvas=async(name)=>{const png=await js("document.getElementById('book-game-canvas').toDataURL('image/png')");await fs.writeFile(path.join(output,name+'.png'),Buffer.from(png.split(',')[1],'base64'));return png;};
  await js("aliceApp.voice.stop();aliceApp.pause(true);document.getElementById('book-game-open').click();document.getElementById('book-game-sound').checked=false;window.bookTestTick=aliceApp.bookGame.state.tick.bind(aliceApp.bookGame.state);aliceApp.bookGame.state.tick=()=>aliceApp.bookGame.state.snapshot();void 0;");
  const tick=(seconds)=>js(`(()=>{for(let i=0;i<${Math.round(seconds/.01)};i++)bookTestTick(.01);aliceApp.bookGame.render();return aliceApp.bookGame.diagnostic();})()`);
  const results={difficulties:[],endingTiers:[],stages:[],input:[]};
  for(const difficulty of ['easy','normal','hard']){
    await js(`aliceApp.bookGame.state.reset();const d=document.getElementById('book-game-difficulty');d.value='${difficulty}';d.dispatchEvent(new Event('change'));`);
    const d=await js('aliceApp.bookGame.diagnostic()');assert.equal(d.difficulty,difficulty);assert.equal(d.holes.length,9);assert.equal(new Set(d.holes.map(h=>h.x)).size,3);assert.equal(new Set(d.holes.map(h=>h.y)).size,3);
    assert.equal(await js("localStorage.getItem('alice-book-game-difficulty')"),difficulty);results.difficulties.push({id:difficulty,label:d.difficultyLabel});
    await js("document.getElementById('book-game-start').click()");await tick(.6);await capture('grid-'+difficulty);
    assert(await js("document.getElementById('book-game-difficulty').disabled"));
    // Pointer geometry for all nine holes, with deterministic target fixtures.
    for(let i=0;i<9;i++){
      const state=await js(`(()=>{const a=aliceApp.bookGame,g=a.state;g.lastSwing=-Infinity;g.targets=[{id:900+${i},hole:${i},age:.4,life:2,hit:false}];const h=a.diagnostic().holes[${i}],c=document.getElementById('book-game-canvas'),r=c.getBoundingClientRect();c.dispatchEvent(new PointerEvent('pointerdown',{clientX:r.left+h.x/980*r.width,clientY:r.top+(h.y-30)/560*r.height,button:0,pointerType:'mouse',bubbles:true}));return a.diagnostic();})()`);
      assert.equal(state.hits,i+1);results.input.push({difficulty,hole:i+1,hit:true});
    }
    await js("document.getElementById('book-game-pause').click();");const frozen=await js('aliceApp.bookGame.diagnostic().elapsed');await tick(1);assert.equal(await js('aliceApp.bookGame.diagnostic().elapsed'),frozen);
    await js("document.getElementById('book-game-pause').click();");
  }
  // Keyboard 9 reaches the bottom-right hole; key repeats cannot farm points.
  const keys=await js("(()=>{const a=aliceApp.bookGame,g=a.state;g.lastSwing=-Infinity;g.targets=[{id:1010,hole:8,age:.4,life:2,hit:false}];const c=document.getElementById('book-game-canvas'),before=g.hits;c.dispatchEvent(new KeyboardEvent('keydown',{key:'9',code:'Digit9',bubbles:true}));c.dispatchEvent(new KeyboardEvent('keydown',{key:'9',code:'Digit9',repeat:true,bubbles:true}));return {hits:g.hits-before};})()");assert.equal(keys.hits,1);
  for(const [tier,score] of [['low',0],['medium',400],['high',1800]]){
    await js(`aliceApp.bookGame.start();aliceApp.bookGame.state.score=${score};`);await tick(45);
    let d=await js('aliceApp.bookGame.diagnostic()');assert.equal(d.phase,'finale');assert.equal(d.finale.tier,tier);assert.equal(d.finale.stage,'taunt');assert.equal(await js('aliceApp.bookGame.hit(0).accepted'),false);await canvas('taunt-'+tier);
    results.endingTiers.push({tier,score,line:d.finale.robinLine});
    // Pausing and closing both freeze the complete ending clock.
    await js("document.getElementById('book-game-pause').click()");await tick(1);assert.equal(await js('aliceApp.bookGame.diagnostic().finale.elapsed'),0);await js("document.getElementById('book-game-pause').click();document.getElementById('close-book-game').click()");await delay(60);await tick(1);assert.equal(await js('aliceApp.bookGame.diagnostic().finale.elapsed'),0);await js("document.getElementById('book-game-open').click();document.getElementById('book-game-pause').click()");
    const images=[];
    for(const [stage,time] of [['taunt',.8],['grab',3],['windup',4.1],['strike',4.72],['fly',5.15],['impact',5.65],['slide',6.7],['settle',7.8],['result',8.4]]){
      d=await js('aliceApp.bookGame.diagnostic()');await tick(time-d.finale.elapsed);d=await js('aliceApp.bookGame.diagnostic()');assert.equal(d.finale.stage,stage);assert.equal(d.score,score);
      if(tier==='low'){images.push(await canvas('ending-'+stage));results.stages.push({stage,time:d.finale.elapsed});}
    }
    assert.equal(d.phase,'finished');assert(!await js("document.getElementById('book-game-difficulty').disabled"));
    if(images.length){const sheet=await js(`(async()=>{const c=document.createElement('canvas');c.width=1470;c.height=885;const g=c.getContext('2d');g.fillStyle='#201c29';g.fillRect(0,0,c.width,c.height);for(const [i,src] of ${JSON.stringify(images)}.entries()){const im=new Image();im.src=src;await im.decode();g.drawImage(im,(i%3)*490,Math.floor(i/3)*295,490,280);g.fillStyle='#ead5a8';g.font='12px Microsoft YaHei';g.fillText(['台词','揪出','举书','挥书','飞向镜头','撞屏','滑落','收书','结果'][i],(i%3)*490+10,Math.floor(i/3)*295+292);}return c.toDataURL();})()`);await fs.writeFile(path.join(output,'ending-review-round1.png'),Buffer.from(sheet.split(',')[1],'base64'));}
  }
  // Second pass at the smallest room layout and reduced-motion impact.
  room.setSize(960,680);await delay(160);await js("aliceApp.bookGame.start();aliceApp.bookGame.state.score=0;");await tick(45);await tick(5.65);await capture('ending-review-round2-impact');await js("document.getElementById('book-game-reduced').checked=true;aliceApp.bookGame.render();");await capture('reduced-motion-impact');
  const bounds=await js("(()=>{const d=document.getElementById('book-game-dialog'),c=document.getElementById('book-game-canvas').getBoundingClientRect();return {scrollWidth:d.scrollWidth,clientWidth:d.clientWidth,canvasWidth:c.width,scrollHeight:d.scrollHeight,clientHeight:d.clientHeight};})()");assert(bounds.scrollWidth<=bounds.clientWidth+1);assert(bounds.canvasWidth>500);assert(bounds.scrollHeight<=bounds.clientHeight+1);
  await tick(3);await js("document.getElementById('book-game-reduced').checked=false;document.getElementById('book-game-start').click();");assert.equal(await js('aliceApp.bookGame.diagnostic().score'),0);
  if(process.argv.includes('--record-book-game')){
    room.setSize(1360,900);await delay(100);
    const clip=await js(`(async()=>{
      const a=aliceApp.bookGame,c=document.getElementById('book-game-canvas');
      a.state.tick=window.bookTestTick;a.state.reset();a.state.setDifficulty('normal');a.start();
      const stream=c.captureStream(30),rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:3500000}),chunks=[];
      const done=new Promise(resolve=>{rec.ondataavailable=e=>chunks.push(e.data);rec.onstop=resolve;});rec.start();
      const taps=setInterval(()=>{const t=a.state.targets.find(t=>!t.hit&&t.age>.25);if(t)a.hit(t.hole);},240);
      await new Promise(r=>setTimeout(r,3200));clearInterval(taps);a.state.elapsed=a.state.duration-.01;
      await new Promise(r=>setTimeout(r,9600));rec.stop();await done;stream.getTracks().forEach(t=>t.stop());
      const bytes=new Uint8Array(await new Blob(chunks).arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text);
    })()`);
    await fs.writeFile(path.join(output,'book-robin-preview.webm'),Buffer.from(clip,'base64'));results.recorded=true;
  }
  await js("document.getElementById('close-book-game').click()");
  const entered=await js('aliceDesktop.petEnter()');assert(entered.ok);for(let i=0;i<100;i++){if(await js('Boolean(window.aliceApp?.state.ready)',desktopPet.window).catch(()=>false))break;await delay(100);}
  const pet=desktopPet.window;await js("document.getElementById('pet-book-game').click();",pet);await capture('pet-nine-grid',pet);assert.equal(await js('aliceApp.bookGame.diagnostic().holes.length',pet),9);assert(await js("document.getElementById('book-game-dialog').open",pet));
  await js("document.getElementById('close-book-game').click();aliceDesktop.petReturn();",pet);
  results.pauseAndCloseFreezeFinale=true;results.keyboardNine=true;results.twoVisualPasses=true;results.pet=true;results.smallRoomLayout=bounds;
  return results;
};
