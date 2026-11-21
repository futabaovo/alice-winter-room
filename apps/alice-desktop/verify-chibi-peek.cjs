const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
exports.verifyChibiPeek=async(room,output,{desktopPet:pet})=>{
  await room.webContents.executeJavaScript("aliceApp.characterStyle.set('chibi');aliceApp.wardrobe.set('white');aliceDesktop.petEnter()",true);
  const win=pet.window,js=async s=>{try{return await win.webContents.executeJavaScript(s,true);}catch(e){throw Error(e.message+' Script: '+s);}},until=async(fn,label)=>{for(let i=0;i<150;i++){if(await fn())return;await delay(70);}throw Error('Q peek timed out: '+label);};
  await until(()=>js('Boolean(window.aliceApp?.state.ready&&aliceApp.character.frames>3)'),'ready');
  await js("aliceApp.petOptions.save({robinEnabled:false});document.getElementById('idle').checked=false;document.getElementById('tracking').checked=false;aliceApp.pet.setChat(false)");
  const geometry=()=>js(`(()=>{const c=aliceApp.character,q=c.chibi;return {style:c.characterStyle,texture:{w:q.surface.width,h:q.surface.height,body:q.local.body},body:q.bounds.body,pose:q.last,edge:aliceApp.pet.edge.diagnostic(),selected:aliceApp.wardrobe.selected,displayed:aliceApp.wardrobe.displayed,w:innerWidth,h:innerHeight};})()`);
  // Every authored sprite must fit the intermediate texture, including the wide
  // idle costume and the tall pleased poses, before any native-window clipping.
  const atlas=await js(`(()=>{const q=aliceApp.character.chibi,rows=[];for(const [sheet,frames]of Object.entries(q.frames))for(let index=0;index<frames.length;index++){const outfit=sheet==='outfits'?(index>=4&&index<8||index>=10?'penguin':'white'):sheet.startsWith('idle-')?sheet.slice(5):'winter';q.paint({sheet,index,outfit,action:'idle',face:false});const r=q.local.body;rows.push({sheet,index,...r,w:q.surface.width,h:q.surface.height});}q.cacheKey='';return rows;})()`);
  for(const r of atlas)assert(r.left>=10&&r.right<=r.w-10&&r.top>=20&&r.bottom<=r.h-20,'Sprite cut by texture: '+JSON.stringify(r));
  const saved=await fs.readFile(path.join(require('electron').app.getPath('userData'),'appearance.json'),'utf8'),samples=[];
  for(let round=1;round<=2;round++)for(const side of ['left','right'])for(const scale of [.65,1,1.5]){
    pet.scale(scale);await pet.dock(side);await until(()=>pet.edge.phase==='hidden','hidden');pet.reportActivity(false);assert(pet.peekNow('penguin'));await delay(1300);
    const d=await geometry(),r=d.body;assert.equal(d.style,'chibi');assert.equal(d.displayed,'penguin');assert.equal(d.selected,'white');
    assert(r.left>2&&r.right<d.w-2,'Costume cut by WebGL viewport: '+JSON.stringify(d));
    assert(r.top>2&&r.bottom<d.h-2,'Costume cut vertically before peek');
    assert.equal(await fs.readFile(path.join(require('electron').app.getPath('userData'),'appearance.json'),'utf8'),saved,'Temporary outfit changed saved appearance');
    await fs.writeFile(path.join(output,`q-penguin-${side}-${Math.round(scale*100)}-round${round}.png`),(await win.webContents.capturePage()).toPNG());samples.push({round,side,scale,body:r,window:{w:d.w,h:d.h}});
    await pet.recall();await delay(600);assert.equal((await geometry()).displayed,'white');
  }
  for(const position of [0,1]){await pet.dock('right');await until(()=>pet.edge.phase==='hidden','position hide');pet.setDockPosition(position);pet.reportActivity(false);assert(pet.peekNow('penguin'));await delay(1200);await fs.writeFile(path.join(output,'q-penguin-position-'+position+'.png'),(await win.webContents.capturePage()).toPNG());await pet.recall();await delay(400);}
  pet.restore();return {atlasFrames:atlas.length,samples,temporaryOutfitRestored:true};
};
