const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
exports.verifyChibiLook=async(room,output,{desktopPet})=>{
  const js=(s,w=room)=>w.webContents.executeJavaScript(`{${s}}`,true);
  const prepare=async(w=room)=>js("aliceApp.state.suspended=true;aliceApp.voice.stop();aliceApp.pause(false);document.getElementById('idle').checked=false;document.getElementById('tracking').checked=true;aliceApp.characterStyle.set('chibi',{save:false});aliceApp.setMood(0);aliceApp.setView('room');aliceApp.settle();aliceApp.renderNow();",w);
  const advance=(w=room)=>js("for(let i=0;i<6;i++){aliceApp.state.previous=performance.now()-16;aliceApp.renderNow();}void 0;",w);
  const pointer=async(direction,w=room,target='canvas',wantImage=true)=>{
    const pos=await js(`(()=>{const f=aliceApp.character.chibi.trackingFace,c=document.getElementById('canvas'),r=c.getBoundingClientRect(),center=f.left+f.width/2;return {x:Math.round(r.left+Math.max(3,Math.min(r.width-3,center+${direction}*r.width*.4))),y:Math.round(r.top+f.top+f.height/2)};})()`,w);
    if(target==='canvas')w.webContents.sendInputEvent({type:'mouseMove',x:pos.x,y:pos.y});
    else await js(`document.getElementById('${target}').dispatchEvent(new PointerEvent('pointermove',{clientX:${pos.x},clientY:${pos.y},bubbles:true}));`,w);
    await delay(25);await advance(w);return js(`({look:aliceApp.character.chibi.last.look,index:aliceApp.character.chibi.last.index,face:aliceApp.character.chibi.bounds.face,anchor:aliceApp.character.chibi.trackingFace,glError:aliceApp.character.gl.getError(),finite:aliceApp.character.chibi.mesh.positions.every(Number.isFinite),png:${wantImage?'aliceApp.capture()':'null'}})` ,w);
  };
  const result={directions:[],controls:[],expressions:[],pet:[]};await prepare();
  for(let round=1;round<=2;round++){
    const shots=[];
    for(const outfit of ['winter','white','penguin']){
      await js(`aliceApp.wardrobe.set('${outfit}',{save:false});aliceApp.setMood(0);aliceApp.renderNow();`);
      const centers=[];
      for(const direction of [-1,0,1]){
        const p=await pointer(direction);assert(p.finite&&!p.glError);assert.equal(p.index,0,'pointer must not select a different emotion');
        assert(direction===0?Math.abs(p.look.x)<.02:p.look.x*direction>.15);centers.push(p.face.left+p.face.width/2);shots.push({png:p.png,label:outfit+' '+['左','正','右'][direction+1]});
        result.directions.push({round,outfit,direction,look:p.look});
      }
      assert(centers.every(x=>Math.abs(x-centers[1])<.001),'pupil tracking must not move the head');
    }
    const sheet=await js(`(async()=>{const c=document.createElement('canvas');c.width=1440;c.height=1260;const g=c.getContext('2d');g.fillStyle='#e6ded6';g.fillRect(0,0,c.width,c.height);for(const [i,s] of ${JSON.stringify(shots)}.entries()){const im=new Image();im.src=s.png;await im.decode();g.drawImage(im,im.width*.40,0,im.width*.47,im.height*.78,(i%3)*480,Math.floor(i/3)*420,480,385);g.fillStyle='#584661';g.font='19px Microsoft YaHei';g.fillText(s.label,(i%3)*480+20,Math.floor(i/3)*420+412);}return c.toDataURL();})()`);
    await fs.writeFile(path.join(output,'gaze-review-round'+round+'.png'),Buffer.from(sheet.split(',')[1],'base64'));
  }
  // The input element is above the canvas: its bubbling pointer event must work.
  for(const direction of [-1,1]){const p=await pointer(direction,room,'chat-input');assert(p.look.x*direction>.15);result.controls.push({target:'chat-input',direction,look:p.look});}
  await js("document.getElementById('tracking').checked=false;");await advance();assert.equal(await js('aliceApp.character.chibi.last.look.x'),0);
  await js("document.getElementById('tracking').checked=true;");await pointer(1);await js("window.dispatchEvent(new Event('blur'));");await advance();assert.equal(await js('aliceApp.character.chibi.last.look.x'),0);
  await pointer(-1);await js("document.dispatchEvent(new PointerEvent('pointerleave'));");await advance();assert.equal(await js('aliceApp.character.chibi.last.look.x'),0);
  await pointer(1);await js("document.getElementById('help-dialog').showModal();");await advance();assert.equal(await js('aliceApp.character.chibi.last.look.x'),0);await js("document.getElementById('help-dialog').close();");
  // Every authored expression remains distinct from tracking at both extremes.
  for(const outfit of ['winter','white','penguin'])for(let mood=0;mood<20;mood++){
    await js(`aliceApp.wardrobe.set('${outfit}',{save:false});aliceApp.setMood(${mood});aliceApp.renderNow();`);
    for(const direction of [-1,1]){await pointer(direction,room,'canvas',false);const d=await js('({id:aliceApp.character.chibi.last.expression,gl:aliceApp.character.gl.getError(),finite:aliceApp.character.chibi.mesh.positions.every(Number.isFinite)})');assert(d.finite&&!d.gl);assert.equal(d.id,await js(`aliceApp.definitions[${mood}].id`));}
    result.expressions.push({outfit,mood});
  }
  await js("aliceApp.setMood(0);aliceApp.wardrobe.set('winter',{save:false});aliceApp.pet.reaction.trigger();");await js("for(let i=0;i<50;i++){aliceApp.state.previous=performance.now()-50;aliceApp.renderNow();}void 0;");await pointer(1);assert.equal(await js('aliceApp.character.chibi.last.look.x'),0,'book action owns head pose');
  await js("aliceApp.pet.reaction.release();for(let i=0;i<120;i++){aliceApp.state.previous=performance.now()-50;aliceApp.renderNow();}aliceApp.characterStyle.set('illustration',{save:false});");
  const width=await js('aliceApp.character.canvas.clientWidth'),height=await js('aliceApp.character.canvas.clientHeight');room.webContents.sendInputEvent({type:'mouseMove',x:Math.round(width*.25),y:Math.round(height*.3)});await delay(20);await advance();assert(await js('aliceApp.state.gaze.x<0'));
  await js("aliceApp.characterStyle.set('chibi');aliceApp.setMood(0);aliceApp.renderNow();");
  const entered=await js('aliceDesktop.petEnter()');assert(entered.ok);const pet=desktopPet.window;
  for(let i=0;i<120;i++){if(await js('Boolean(window.aliceApp?.state.ready)',pet))break;await delay(100);}await prepare(pet);
  for(const direction of [-1,0,1]){const p=await pointer(direction,pet);assert(direction===0?Math.abs(p.look.x)<.02:p.look.x*direction>.15);result.pet.push({direction,look:p.look});}
  await js('aliceDesktop.petReturn()',pet);
  result.trackingOffReturnsCenter=true;result.blurAndLeaveReturnCenter=true;result.modalSuspendsTracking=true;result.illustrationUnchanged=true;result.bookOwnsPose=true;
  return result;
};
