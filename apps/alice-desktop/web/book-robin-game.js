import {BookRobinGame} from './book-robin-state.js';
import {loadBookFinale,paintBookFinale,finaleDialogue} from './book-robin-finale.js';
const $=id=>document.getElementById(id),clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{n=clamp(n);return n*n*(3-2*n);};
export async function initBookRobinGame({character,onOpen}){
  const dialog=$('book-game-dialog'),canvas=$('book-game-canvas'),g=canvas.getContext('2d'),game=new BookRobinGame();
  const bird=new Image();bird.src='robin/robin-atlas-generated.png';await bird.decode();
  const weapon=new Image();weapon.src='pet/paired-book-v320.png';await weapon.decode();
  const poses=await loadBookFinale(),art=character.chibi.images,frames=character.chibi.frames;
  let raf=0,last=0,cursor=null,swing=null,previousStage='',audioContext=null;
  const holes=Array.from({length:9},(_,i)=>({x:406+i%3*196,y:221+Math.floor(i/3)*116}));
  try{game.setDifficulty(localStorage.getItem('alice-book-game-difficulty')||'normal');}catch{}
  const difficulty=$('book-game-difficulty');
  for(const option of game.snapshot().difficulties){const item=document.createElement('option');item.value=option.id;item.textContent=option.label;difficulty.append(item);}
  difficulty.value=game.difficulty;
  $('book-game-reduced').checked=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function label(text,x,y,size=18,color='#655067',align='center'){g.fillStyle=color;g.font=size+'px "Microsoft YaHei",sans-serif';g.textAlign=align;g.fillText(text,x,y);}
  function figure(x,bottom,height,frame=2,rotation=0){const f=frames.book[frame],s=height/337;g.save();g.translate(x,bottom);g.rotate(rotation);g.drawImage(art.book,...f,-f[2]*s/2,-f[3]*s,f[2]*s,f[3]*s);g.restore();}
  function pill(text,x,y,w=160){g.fillStyle='#fff9eff0';g.strokeStyle='#bba4c277';g.lineWidth=1;g.beginPath();g.roundRect(x-w/2,y-27,w,40,12);g.fill();g.stroke();label(text,x,y,13);}
  function sound(type){
    if(!$('book-game-sound').checked||!audioContext||audioContext.state!=='running')return;
    const ctx=audioContext,t=ctx.currentTime,o=ctx.createOscillator(),v=ctx.createGain(),impact=type==='impact';
    o.type=type==='fly'?'sine':'triangle';o.frequency.setValueAtTime(impact?110:type==='fly'?280:520,t);o.frequency.exponentialRampToValueAtTime(impact?32:type==='fly'?1100:140,t+.16);
    v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(impact?.14:.055,t+.012);v.gain.exponentialRampToValueAtTime(.0001,t+.2);
    o.connect(v).connect(ctx.destination);o.start(t);o.stop(t+.22);
  }
  function unlockSound(){if(!$('book-game-sound').checked)return;audioContext??=new AudioContext();void audioContext.resume().catch(()=>{});}
  function render(){
    const s=game.snapshot(),isFinal=s.phase==='finale'||s.phase==='finished'||s.phase==='paused'&&s.resumePhase==='finale';
    g.clearRect(0,0,980,560);
    if(isFinal){
      paintBookFinale(g,s,{poses,bird,figure,label,pill,reducedMotion:$('book-game-reduced').checked});
      const line=finaleDialogue(s.finale),announcement=line.speaker+'：'+line.text;
      if($('book-game-status').textContent!==announcement)$('book-game-status').textContent=announcement;
    }else{
      const bg=g.createLinearGradient(0,0,0,560);bg.addColorStop(0,'#eae1ec');bg.addColorStop(.6,'#efe3d8');bg.addColorStop(1,'#ceac8b');g.fillStyle=bg;g.fillRect(0,0,980,560);
      g.fillStyle='#81657e';g.fillRect(0,0,980,20);
      for(let i=0;i<16;i++){const h=34+(i*17%29);g.fillStyle=['#a78b9b','#968598','#b09caa','#b09b83'][i%4];g.beginPath();g.roundRect(306+i*40,32,27,h,4);g.fill();}
      g.fillStyle='#96788d';g.fillRect(291,93,667,9);
      label('有珠的安静书房',161,67,22,'#59435f');label('请让 Robin 小声一点。',161,98,13,'#977e9b');
      g.fillStyle='#6c4b3217';g.beginPath();g.ellipse(161,482,91,15,0,0,Math.PI*2);g.fill();
      figure(161,481,323,swing&&s.elapsed-swing.at<.24?3:8,Math.sin(s.elapsed*1.3)*.015);
      pill(s.combo>=3?'……这本书很结实。':'……别吵。',161,142,166);
      label('3 × 3 · '+s.difficultyLabel,161,524,15,'#856a80');
      g.fillStyle='#a78165';g.beginPath();g.roundRect(291,118,656,407,27);g.fill();
      g.fillStyle='#d6bba0';g.beginPath();g.roundRect(300,112,638,402,25);g.fill();
      for(let i=0;i<9;i++){
        const h=holes[i];g.fillStyle='#9a705a';g.beginPath();g.ellipse(h.x,h.y+11,73,22,0,0,Math.PI*2);g.fill();
        g.fillStyle='#493545';g.beginPath();g.ellipse(h.x,h.y+8,64,18,0,0,Math.PI*2);g.fill();
        const target=s.targets.find(t=>t.hole===i&&!t.hit);
        if(target){const lift=ease(target.age/.16)*(1-ease((target.age-target.life+.18)/.18));g.save();g.beginPath();g.rect(h.x-80,h.y-98,160,111);g.clip();g.translate(h.x,h.y+105-lift*93);g.rotate(Math.sin(target.age*7)*.06);g.drawImage(bird,49,41,446,491,-41,-93,82,90);g.restore();}
        g.strokeStyle='#f5e5ce';g.lineWidth=4;g.beginPath();g.ellipse(h.x,h.y+11,71,20,0,.05,Math.PI-.05);g.stroke();
        label(String(i+1),h.x,h.y+42,12,'#926e56');
      }
      for(const fx of s.effects){const h=holes[fx.hole];if(!h)continue;const p=clamp((s.elapsed-fx.at)/.65);g.save();g.globalAlpha=1-p;label(fx.hit?'+'+fx.points:'没敲中',h.x,h.y-62-p*26,fx.hit?25:15,fx.hit?'#796b93':'#b19391');if(fx.hit)for(let i=0;i<5;i++){const a=i*2.4,r=12+p*55;g.fillStyle=i%2?'#fff1c5':'#b5a0ca';g.beginPath();g.arc(h.x+Math.cos(a)*r,h.y-48+Math.sin(a)*r*.6,4*(1-p)+1,0,Math.PI*2);g.fill();}g.restore();}
      if(swing&&s.elapsed-swing.at<.28){const h=holes[swing.hole],p=clamp((s.elapsed-swing.at)/.28),drop=Math.sin(p*Math.PI)*22;g.save();g.translate(h.x+18,h.y-28-drop);g.rotate(-.5+1.1*p);g.drawImage(weapon,-60,-56,120,120);g.restore();}
      else if(cursor&&s.phase==='playing'){g.strokeStyle='#87729277';g.lineWidth=2;g.beginPath();g.arc(cursor.x,cursor.y,15,0,Math.PI*2);g.stroke();}
    }
    if(s.phase==='ready'||s.phase==='paused'){
      g.fillStyle='#29203083';g.fillRect(0,0,980,560);g.fillStyle='#f8f1e8';g.beginPath();g.roundRect(313,164,610,215,22);g.fill();
      label(s.phase==='paused'?'稍作休息':'书本保卫战',618,224,29,'#57405e');
      label(s.phase==='paused'?'游戏与结算动画已暂停。':'九宫格 · '+s.difficultyLabel+' · 一局 45 秒',618,273,18,'#927397');
      label(s.phase==='paused'?'点击“继续”回来。':'点击 Robin，也可用数字键 1—9。',618,316,15,'#a18d9e');
    }
    $('book-game-score').textContent=s.score;$('book-game-combo').textContent=s.combo;
    $('book-game-time').textContent=isFinal?'结算':Math.ceil(s.remaining)+'s';$('book-game-best').textContent=Math.max(s.best,s.score);
    $('book-game-start').textContent=s.phase==='ready'?'开始游戏':s.phase==='finished'?'再来一局':'重新开始';
    $('book-game-start').disabled=s.phase==='finale'||s.phase==='paused'&&s.resumePhase==='finale';
    $('book-game-pause').disabled=['ready','finished'].includes(s.phase);$('book-game-pause').textContent=s.phase==='paused'?'继续':'暂停';
    difficulty.disabled=!['ready','finished'].includes(s.phase);
    $('book-game-difficulty-info').textContent=s.difficultyDescription;
    const stage=s.finale?.stage||'';
    if(stage!==previousStage){if(s.phase==='finale'&&['strike','fly','impact'].includes(stage))sound(stage);previousStage=stage;}
  }
  function update(now){if(!dialog.open){raf=0;return;}const dt=Math.min(.05,(now-(last||now))/1000);last=now;game.tick(dt);render();raf=requestAnimationFrame(update);}
  function open(){onOpen?.();if(!dialog.open)dialog.showModal();if(!raf){last=performance.now();raf=requestAnimationFrame(update);}render();}
  function start(){unlockSound();game.start();swing=null;previousStage='';last=performance.now();$('book-game-status').textContent='连续命中会加分；敲空扣 1 分，漏掉 Robin 会中断连击。';canvas.focus();render();}
  function hit(hole){const r=game.hit(hole);if(r.accepted){swing=holes[hole]?r:null;if(r.hit)sound('hit');$('book-game-status').textContent=r.hit?(r.combo>=3?r.combo+' 连击！有珠用书让 Robin 安静了一会儿。':'敲中了，Robin 把头缩回去了。'):'……敲在桌面上了。';render();}return r;}
  difficulty.onchange=()=>{if(game.setDifficulty(difficulty.value)){try{localStorage.setItem('alice-book-game-difficulty',difficulty.value);}catch{}}difficulty.value=game.difficulty;render();};
  $('book-game-sound').onchange=unlockSound;
  $('book-game-open').onclick=open;$('close-book-game').onclick=()=>{if(['playing','finale'].includes(game.phase))game.pause();dialog.close();};$('book-game-start').onclick=start;$('book-game-pause').onclick=()=>{unlockSound();game.pause();render();};
  $('pet-book-game').onclick=open;
  for(const id of ['book-game-open','pet-book-game']){$(id).setAttribute('aria-haspopup','dialog');$(id).setAttribute('aria-controls','book-game-dialog');}
  dialog.addEventListener('toggle',()=>{for(const id of ['book-game-open','pet-book-game'])$(id).setAttribute('aria-expanded',String(dialog.open));});
  canvas.onpointermove=e=>{const r=canvas.getBoundingClientRect();cursor={x:(e.clientX-r.left)*980/r.width,y:(e.clientY-r.top)*560/r.height};};canvas.onpointerleave=()=>cursor=null;
  canvas.onpointerdown=e=>{if(e.button!==0&&e.pointerType==='mouse')return;canvas.focus();canvas.onpointermove(e);const distances=holes.map(h=>Math.hypot((cursor.x-h.x)/77,(cursor.y-h.y+29)/56)),nearest=Math.min(...distances);hit(nearest<1?distances.indexOf(nearest):-1);e.preventDefault();};
  canvas.addEventListener('keydown',e=>{if(e.repeat)return;if(/^[1-9]$/.test(e.key)){hit(Number(e.key)-1);e.preventDefault();}if(e.code==='Space'){unlockSound();game.pause();render();e.preventDefault();}});
  dialog.addEventListener('close',()=>{if(['playing','finale'].includes(game.phase))game.pause();cancelAnimationFrame(raf);raf=0;cursor=null;void audioContext?.suspend();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&['playing','finale'].includes(game.phase)){game.pause();render();void audioContext?.suspend();}});
  return {open,start,hit,state:game,render,diagnostic:()=>({...game.snapshot(),open:dialog.open,holes,finaleArtReady:poses.image.complete})};
}

