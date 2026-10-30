import {TypingMotion} from './motion.js';
import {PixelSprites} from './sprites.js';
import {ShortcutReactions,REACTIONS,shortcutFromEvent,drawReactionEffect} from './reactions.js';
import {pagePose,drawPageEffect} from './page-gesture.js';
const $=id=>document.getElementById(id),api=window.keyboardDesktop,canvas=$('pixel'),g=canvas.getContext('2d',{willReadFrequently:true}),motion=new TypingMotion(),sprites=new PixelSprites();
const reactions=new ShortcutReactions(),reactionSprites=new PixelSprites();
reactionSprites.reference=sprites;
const pageSprites=new PixelSprites();pageSprites.reference=sprites;
let reaction=null,composing=false;
let frameHandle=0,paintKey='';
const beatBars=[...document.querySelectorAll('#beat i')];
let info={active:false,blocked:false,settings:{scope:'global',outfit:'winter',scale:100,intensity:60,paused:false,mouse:false,pinned:true}},loaded=false,panel=false,dragging=false,lastHit=null,previous=0,pose={frame:0},lastSettings='',previewUntil=0,farewell=false;
function apply(next){
  const old=info;info=next;const s=info.settings,stamp=[info.active,info.blocked,s.paused,s.scope,s.outfit,s.shortcuts].join(':');
  if(lastSettings!==stamp){motion.reset();reactions.reset();reaction=null;lastSettings=stamp;previewUntil=0;}
  for(const id of ['scope','outfit','scale','intensity'])if(document.activeElement!==$(id))$(id).value=s[id];
  for(const id of ['mouse','pinned','shortcuts'])$(id).checked=s[id];
  $('scale-value').textContent=s.scale+'%';$('intensity-value').textContent=s.intensity+'%';$('pause').textContent=s.paused?'继续':'暂停';$('pause').setAttribute('aria-pressed',String(s.paused));
  document.body.dataset.input=info.input;
  $('status').textContent=info.blocked?'暂时休息':s.paused?'响应已暂停':info.input==='unavailable'?'全局响应不可用 · 可在设置中改为仅此窗口':info.input==='starting'?'正在连接键盘':s.scope==='global'?'全局响应 · 不记录输入内容':'仅此窗口 · 点击人物后试着打字';
  if(old.active&&!info.active){dragging=false;setPanel(false);}
  if(!info.active){cancelAnimationFrame(frameHandle);frameHandle=0;previous=0;}
  else{draw(0);queueFrame();}
}
const pulse=kind=>{
  if(!info.active||info.settings.paused||info.blocked||panel||farewell)return;
  // Settings and local text composition are never gesture triggers.
  if(document.activeElement?.matches('input,select,textarea'))return;
  if(kind.startsWith('S:')&&info.settings.shortcuts&&!composing){
    if(reactions.trigger(kind.slice(2)))motion.step(0,{enabled:false});
    return;
  }
  if(!reactions.current)motion.pulse(kind==='mouse'?'mouse':'key');
};
function setPanel(open){panel=open;$('settings').hidden=!open;$('settings-open').setAttribute('aria-expanded',String(open));motion.pending=false;if(open){reactions.reset();reaction=null;previewUntil=0;motion.step(0,{enabled:false});api?.hit(true);$('scope').focus();}else canvas.focus();}
async function save(patch){try{const result=await api.save(patch);if(!result.ok)throw Error(result.message);apply(result);}catch(e){$('status').textContent=e.message;}}
function draw(dt){
  if(farewell)return;
  const enabled=info.active&&!info.blocked&&(performance.now()<previewUntil||!info.settings.paused&&!panel);
  reaction=reactions.step(dt,{enabled});
  pose=motion.step(dt,{enabled:enabled&&!reaction,intensity:info.settings.intensity/100});
  if(loaded){
    const outfit=info.settings.outfit;
    if(reaction?.stage==='hold'){
      const nod=['save','redo','confirm'].includes(reaction.id)?Math.sin(reaction.progress*Math.PI)*2:0;
      if(reaction.gesture){const page=pagePose(reaction);pageSprites.draw(g,{outfit,frame:page.frame});drawPageEffect(g,reaction,page);}
      else{(reaction.sprite===undefined?sprites:reactionSprites).draw(g,{outfit,frame:reaction.sprite??reaction.frame,bob:nod*info.settings.intensity/100});drawReactionEffect(g,reaction);}
      paintKey=''; // Effects change every frame; restore the ordinary sprite afterwards.
    }else{
      const spriteFrame=reaction?(reaction.stage==='prepare'?1:0):pose.frame;
      const nextKey=[outfit,spriteFrame,Math.round(pose.bob)].join(':');
      if(nextKey!==paintKey){sprites.draw(g,{...pose,outfit,frame:spriteFrame});paintKey=nextKey;}
    }
  }
  const engaged=pose.phase!=='idle'||Boolean(reaction),line=reaction?reaction.line:info.settings.paused?'……休息一会儿。':engaged?'……我也在认真敲。':'……我陪你。';
  if($('line').textContent!==line)$('line').textContent=line;
  const label=reaction?reaction.label:'像素有珠，按住人物可以拖动';
  if(canvas.getAttribute('aria-label')!==label)canvas.setAttribute('aria-label',label);
  beatBars.forEach((bar,i)=>{const on=engaged&&i<Math.ceil(2+pose.engagement*3);if(bar.classList.contains('on')!==on)bar.classList.toggle('on',on);});
}
function queueFrame(){if(loaded&&info.active&&!farewell&&!frameHandle)frameHandle=requestAnimationFrame(frame);}
function frame(time){frameHandle=0;if(!info.active||farewell)return;const dt=Math.min(.05,(time-(previous||time))/1000);previous=time;draw(dt);queueFrame();}
function hit(event){if(!info.active)return;let yes=panel||dragging||Boolean(event.target.closest('button,header,footer,#line,#status'));
  if(event.target===canvas){const r=canvas.getBoundingClientRect(),x=Math.floor((event.clientX-r.left)*192/r.width),y=Math.floor((event.clientY-r.top)*224/r.height);yes=x>=0&&y>=0&&x<192&&y<224&&g.getImageData(x,y,1,1).data[3]>40||yes;}
  if(yes!==lastHit){lastHit=yes;api?.hit(yes);}
}
document.addEventListener('pointermove',hit);document.addEventListener('pointerleave',()=>{if(!panel&&!dragging){lastHit=false;api?.hit(false);}});
canvas.addEventListener('pointerdown',event=>{if(event.button!==0||panel)return;dragging=true;api?.drag(true);canvas.setPointerCapture(event.pointerId);});
const end=()=>{dragging=false;api?.drag(false);lastHit=null;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);window.addEventListener('blur',end);
document.addEventListener('compositionstart',()=>{composing=true;});document.addEventListener('compositionend',()=>{composing=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel){setPanel(false);return;}if(info.settings.scope!=='local'||event.repeat||event.isComposing||composing||event.keyCode===229||['Shift','Control','Alt','Meta'].includes(event.key)||event.target.closest('input,select,button,textarea'))return;const command=shortcutFromEvent(event);pulse(command?'S:'+command:'key');});
document.addEventListener('pointerdown',event=>{if(info.settings.scope==='local'&&info.settings.mouse&&!event.target.closest('input,select,button')&&!panel)pulse('mouse');});
document.addEventListener('contextmenu',event=>{event.preventDefault();api?.menu();});
$('settings-open').onclick=()=>setPanel(!panel);$('settings-close').onclick=()=>setPanel(false);
for(const id of ['scope','outfit'])$(id).onchange=()=>save({[id]:$(id).value});
for(const id of ['mouse','pinned','shortcuts'])$(id).onchange=()=>save({[id]:$(id).checked});
for(const id of ['scale','intensity'])$(id).oninput=()=>{const value=Number($(id).value);$(id+'-value').textContent=value+'%';void save({[id]:value});};
$('pause').onclick=()=>save({paused:!info.settings.paused});
for(const mode of ['pet','room'])$('return-'+mode).onclick=async()=>{const result=await api.exit(mode);if(!result.ok)$('status').textContent=result.message;};
$('preview').onclick=()=>{setPanel(false);previewUntil=performance.now()+700;motion.pulse();};
const keyLabels={copy:'Ctrl+C',cut:'Ctrl+X',paste:'Ctrl+V',save:'Ctrl+S',undo:'Ctrl+Z',redo:'Ctrl+Y / Ctrl+Shift+Z',find:'Ctrl+F',select:'Ctrl+A',confirm:'Enter',dismiss:'Esc'};
for(const [id,def]of Object.entries(REACTIONS))$('reaction-preview').add(new Option(keyLabels[id]+' · '+def.label.split(' · ')[1],id));
$('preview-reaction').onclick=()=>{const id=$('reaction-preview').value;setPanel(false);previewUntil=performance.now()+(REACTIONS[id].duration+.2)*1000;motion.step(0,{enabled:false});reactions.trigger(id,{preview:true});};
api?.onState(apply);api?.onPulse(event=>pulse(event.kind));
api?.onFarewell(async({token})=>{farewell=true;info.active=false;cancelAnimationFrame(frameHandle);frameHandle=0;reactions.reset();reaction=null;motion.step(0,{enabled:false});if(loaded)sprites.draw(g,{outfit:info.settings.outfit,frame:3});$('line').textContent='……下次见。';await new Promise(r=>setTimeout(r,1800));await api.farewellDone(token);});
window.keyboardReady=(async()=>{await Promise.all([sprites.load(),reactionSprites.load('alice-pixel-reactions.png'),pageSprites.load('alice-pixel-pages.png',6)]);loaded=true;const result=await api.info();if(!result.ok)throw Error(result.message);apply(result);return true;})().catch(error=>{$('status').textContent='加载失败：'+error.message;console.error(error);return false;});
window.keyboardApp={motion,sprites,reactions,reactionSprites,pageSprites,pulse,draw,setPanel,diagnostic:()=>({ready:loaded,info,pose,reaction,panel}),capture:()=>canvas.toDataURL('image/png')};
