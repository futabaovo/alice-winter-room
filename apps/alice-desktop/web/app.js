import { Character } from './runtime.js';
import { initVoice } from './voice-panel.js';
import { initChat } from './chat-panel.js';
import { ReplyPerformance } from './reply-performance.js';
import { initRoomLayout } from './room-layout.js';
import {initPet} from './pet-panel.js';
import {initFeeding} from './feeding.js';
import {initWardrobe} from './wardrobe.js';
import {initTea} from './tea.js';
import {initPetOptions} from './pet-options.js';
import {installUI} from './ui.js';
import {initStickers} from './stickers.js';
import {expressionPose,expressionCategory} from './expression-pose.js';
import {eyeShape,mixEyeShape} from './expression-geometry.js';
import {initStartup} from './startup.js';
import {ChibiCharacter} from './chibi.js';
import {chibiPointerLook} from './chibi-look.js';
import {ChibiAttention} from './chibi-attention.js';
import {initCharacterStyle} from './character-style.js';
import {initBookRobinGame} from './book-robin-game.js';
const $=id=>document.getElementById(id);
const startup=initStartup();
let character;
let voice;
let chat;
let replyPerformance;
let layout;
let pet;
let feeding;
let wardrobe;
let tea;
let petOptions;
let stickers;
let characterStyle;
let bookGame;
let chibiPointer=null;
const chibiAttention=new ChibiAttention();
const isPet=new URLSearchParams(location.search).get('mode')==='pet';
const state={ready:false,mood:0,intensity:.8,paused:false,clock:0,view:'room',look:{x:0,y:0,active:false},gaze:{x:0,y:0},gesture:null,previous:0};
let definitions=[];
let parameterDefaults={};
let current={};
let faceShadow=0;
let spiral=0;
let eyeGeometry=eyeShape('neutral');
let moodFilter='all';
const moodKeys='1234567890-';
const gazeRange={x:.75,y:.55};

function setMood(index,{source='manual'}={}){
  if(index<0||index>=definitions.length)return;
  if(source==='manual')replyPerformance?.manualOverride();
  state.mood=index;
  document.querySelectorAll('.mood').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
  if(source==='manual'&&moodFilter!=='all'&&expressionCategory(definitions[index])!==moodFilter)filterMoods('all');
  $('mood-counter').textContent=String(index+1).padStart(2,'0')+' / '+String(definitions.length).padStart(2,'0');
  $('mood-description').textContent=definitions[index].description;
  $('caption').textContent=definitions[index].caption;
  chat?.updateCancel();
}
function filterMoods(category){moodFilter=category;for(const button of document.querySelectorAll('[data-mood-filter]'))button.setAttribute('aria-pressed',String(button.dataset.moodFilter===category));for(const button of document.querySelectorAll('.mood'))button.hidden=category!=='all'&&button.dataset.category!==category;}
function setView(view){if(isPet)view='pet';state.view=view;character.mode=view;document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===view));}
function gesture(type){state.gesture={type,start:state.clock};}
function pause(value){state.paused=value;$('pause').textContent=value?'继续动态':'暂停动态';$('pause').setAttribute('aria-pressed',String(value));}
function reset(){chibiPointer=null;chibiAttention.reset();tea?.reset();feeding?.reset();voice?.stop();if(state.ready)void chat?.cancel();state.intensity=.8;$('intensity').value=80;$('intensity-value').textContent='80%';$('zoom').value=100;$('zoom-value').textContent='100%';$('voice-volume').value=80;$('voice-volume-value').textContent='80%';$('lip-sync').checked=true;$('voice-expression').checked=true;$('voice-select').value='aoko-mine';voice?.player.setVolume(.8);character.zoom=1;$('idle').checked=true;$('tracking').checked=true;state.look={x:0,y:0,active:false};state.gesture=null;current={};pause(false);setMood(0);setView('room');}

async function main(){
  installUI();
  startup.stage(.06,'点亮窗边的灯');
  character=new Character($('canvas'));
  await character.load('model/');
  character.chibi=new ChibiCharacter(character);await character.chibi.load();
  startup.stage(.34,'整理有珠的情态');
  parameterDefaults=Object.fromEntries(character.model.parameters.ids.map((id,i)=>[id,character.model.parameters.defaultValues[i]]));
  const manifest=await fetch('model/expressions/manifest.json').then(r=>r.json());
  definitions=await Promise.all(manifest.map(async item=>({...item,expression:await fetch('model/expressions/'+item.file).then(r=>r.json())})));
  definitions.forEach((mood,index)=>{const button=document.createElement('button');button.className='mood';button.type='button';button.dataset.mood=mood.id;button.dataset.category=expressionCategory(mood);button.title=mood.description;button.setAttribute('aria-label',mood.name);button.setAttribute('aria-pressed',String(index===0));const icon=document.createElement('span');icon.className='mood-icon';icon.textContent=mood.icon;if(mood.preview){const image=new Image();image.src='expression-previews/'+mood.preview;image.alt='';image.loading='lazy';button.classList.add('mood-preview');button.append(image);}const label=document.createElement('span');label.textContent=mood.name;const key=document.createElement('span');key.className='key';key.textContent=moodKeys[index]||'';button.append(icon,label,key);button.onclick=()=>setMood(index);$('moods').append(button);});
  for(const button of document.querySelectorAll('[data-mood-filter]'))button.onclick=()=>filterMoods(button.dataset.moodFilter);
  document.querySelectorAll('[data-view]').forEach(button=>button.onclick=()=>setView(button.dataset.view));
  document.querySelectorAll('[data-gesture]').forEach(button=>button.onclick=()=>gesture(button.dataset.gesture));
  $('intensity').oninput=()=>{state.intensity=Number($('intensity').value)/100;$('intensity-value').textContent=$('intensity').value+'%';};
  $('zoom').oninput=()=>{character.zoom=Number($('zoom').value)/100;$('zoom-value').textContent=$('zoom').value+'%';};
  $('reset').onclick=reset;$('pause').onclick=()=>pause(!state.paused);
  $('help').onclick=()=>$('help-dialog').showModal();$('close-help').onclick=()=>$('help-dialog').close();
  $('pin').onclick=async()=>{if(!window.aliceDesktop)return;const value=await window.aliceDesktop.pin($('pin').getAttribute('aria-pressed')!=='true');$('pin').setAttribute('aria-pressed',String(value));};
  if(!window.aliceDesktop)$('pin').hidden=true;
  const canvas=$('canvas');
  canvas.addEventListener('pointermove',event=>{if(character.characterStyle==='chibi')return;const r=canvas.getBoundingClientRect();const clamp=value=>Math.max(-1,Math.min(1,value));state.look={x:clamp((event.clientX-r.left)/r.width*2-1)*gazeRange.x,y:clamp(1-(event.clientY-r.top)/r.height*2)*gazeRange.y,active:true};});
  // Chat controls sit above the canvas. Q版 must also receive their pointer moves.
  document.addEventListener('pointermove',event=>{if(character.characterStyle!=='chibi')return;const r=canvas.getBoundingClientRect();chibiPointer={x:event.clientX-r.left,y:event.clientY-r.top};});
  const clearLook=()=>{chibiPointer=null;state.look.active=false;};
  canvas.addEventListener('pointerleave',()=>{if(character.characterStyle!=='chibi')state.look.active=false;});
  document.addEventListener('pointerleave',clearLook);window.addEventListener('blur',clearLook);
  canvas.addEventListener('click',()=>gesture('nod'));
  document.addEventListener('keydown',event=>{if(document.querySelector('dialog[open]'))return;if(event.code==='Escape'){voice?.stop();void chat?.cancel();return;}if(['INPUT','BUTTON','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;const moodIndex=moodKeys.indexOf(event.key);if(event.key.length===1&&moodIndex>=0)setMood(moodIndex);if(event.code==='Space'){event.preventDefault();pause(!state.paused);}});
  replyPerformance=new ReplyPerformance({getSpeech:()=>voice?.player.snapshot()||{},getMood:()=>state.mood,displayMood:index=>setMood(index,{source:'dialogue'}),moodIds:definitions.map(item=>item.id)});
  startup.stage(.49,'准备声音与字幕');
  voice=await initVoice(setMood,{onManual:()=>replyPerformance.cancel('manual-voice')});
  startup.stage(.62,'铺好冬日小室');
  layout=initRoomLayout(character);
  const showPanel=layout.showPanel;
  petOptions=await initPetOptions({isPet});
  stickers=await initStickers({voice,character,isPet,getPet:()=>pet,getChat:()=>chat,getTea:()=>tea,getFeeding:()=>feeding});
  chat=await initChat({voice,replyPerformance,showPanel,isPet,petOptions,stickers});
  startup.stage(.73,'请 Robin 稍候');
  pet=await initPet({character,isPet,options:petOptions,getVoice:()=>voice,getChat:()=>chat,onActive:value=>{state.suspended=!value;if(!value)feeding?.reset();tea?.setViewActive(value);}});
  feeding=await initFeeding({character,isPet,getPet:()=>pet,getVoice:()=>voice,getChat:()=>chat,stickers,onManual:()=>replyPerformance.manualOverride()});
  startup.stage(.84,'摆好茶具与书');
  tea=await initTea({character,isPet,getPet:()=>pet,getVoice:()=>voice,getChat:()=>chat,getFeeding:()=>feeding,stickers,onManual:()=>replyPerformance.manualOverride()});
  startup.stage(.92,'整理衣装');
  wardrobe=await initWardrobe({character,getPet:()=>pet,onChange:()=>{tea.reset();feeding.reset();replyPerformance.manualOverride();}});
  characterStyle=await initCharacterStyle({character,onChange:()=>{clearLook();chibiAttention.reset();state.gaze={x:0,y:0};tea?.reset();feeding?.reset();pet?.reaction.release();pet?.robin?.finish();character.chibi.cacheKey='';character.drawOverrides?.clear();character.garmentOpenings=null;}});
  bookGame=await initBookRobinGame({character,onOpen:()=>{voice.stop();feeding.reset();tea.reset();pet.reaction.release();pet.robin?.finish();replyPerformance.manualOverride();}});
  reset();state.ready=true;$('status').textContent=`本地模型已就绪 · ${voice.clips.length} 段语音与童谣可离线播放`;
  window.aliceApp={state,character,characterStyle,bookGame,voice,chat,pet,petOptions,stickers,feeding,tea,wardrobe,replyPerformance,layout,showPanel,definitions,setMood,setView,gesture,reset,pause,renderNow:()=>frame(performance.now(),false),diagnostic:()=>({...character.diagnostic(),characterStyle:characterStyle.diagnostic(),chibi:character.chibi.diagnostic(),mood:definitions[state.mood].name,ready:state.ready,speech:voice.diagnostic(),performance:replyPerformance.diagnostic(),layout:layout.diagnostic(),pet:pet.diagnostic(),feeding:feeding.diagnostic(),tea:tea.diagnostic(),wardrobe:wardrobe.diagnostic()}),capture:()=>canvas.toDataURL('image/png'),settle:()=>{current={};state.gesture=null;state.look.active=false;}};
  frame(performance.now(),false);requestAnimationFrame(frame);
  await window.aliceDesktop?.startupReady?.();
  await startup.finish();
}

function frame(time,schedule=true){
  if(state.suspended&&schedule){state.previous=time;setTimeout(()=>requestAnimationFrame(frame),200);return;}
  const dt=Math.min(.05,(time-(state.previous||time))/1000);state.previous=time;if(!state.paused)state.clock+=dt;
  const width=character.canvas.clientWidth,drawer=width<=1050?382:404;
  const anchor=isPet?(pet?.anchor()??.5):(state.view==='room'?.69:.56)*(width-(character.toolsOpen?drawer:0))/width;
  character.anchorX=schedule&&!isPet?(character.anchorX??anchor)+(anchor-(character.anchorX??anchor))*(1-Math.exp(-dt*10)):anchor;
  character.reset();
  const acting=replyPerformance?.update();
  const expression=expressionPose({definitions,mood:state.mood,acting,defaults:parameterDefaults,intensity:state.intensity}),targets=expression.targets;
  const smoothing=1-Math.exp(-dt*9);
  for(const [id,target]of Object.entries(targets)){current[id]=current[id]===undefined?target:current[id]+(target-current[id])*smoothing;character.set(id,current[id]);}
  const shadeTarget=expression.faceShadow;
  faceShadow=Object.keys(current).length&&schedule?faceShadow+(shadeTarget-faceShadow)*smoothing:shadeTarget;character.faceShadow=faceShadow;
  spiral=schedule?spiral+(expression.spiral-spiral)*smoothing:expression.spiral;character.spiralEyes=spiral;
  const shapeBase=eyeShape(definitions[acting?.baseIndex??state.mood].id),shapeActive=eyeShape(definitions[acting?.index??state.mood].id),shapeTarget=mixEyeShape(eyeShape('neutral'),mixEyeShape(shapeBase,shapeActive,acting?acting.weight*Math.min(1,acting.strength/.6):1),state.intensity);
  eyeGeometry=schedule?mixEyeShape(eyeGeometry,shapeTarget,smoothing):shapeTarget;character.expressionShape=eyeGeometry;
  const add=(id,value)=>{const i=character.parameterIndex[id];if(i!==undefined)character.set(id,character.model.parameters.values[i]+value);};
  const reaction=pet?.step(dt),book=reaction?.progress||0;
  const t=state.clock;
  if($('idle').checked&&character.characterStyle!=='chibi'){
    add('ParamAngleX',Math.sin(t*.4)*2.1);add('ParamAngleY',Math.sin(t*.3)*.8);add('ParamAngleZ',Math.sin(t*.27)*.5);character.set('ParamBreath',.5+.5*Math.sin(t*1.5));character.set('ParamHairFront',Math.sin(t*1.4)*.035);character.set('ParamHairBack',Math.sin(t*1.1-.4)*.025);
    const phase=t%4.7;const blink=phase<.17?Math.abs(phase-.085)/.085:1;
    for(const id of ['ParamEyeLOpen','ParamEyeROpen']){const i=character.parameterIndex[id];character.set(id,character.model.parameters.values[i]*blink);}
  }
  if(character.characterStyle==='chibi')state.look=chibiPointerLook(document.querySelector('dialog[open]')?null:chibiPointer,character.chibi.trackingFace,{width:character.canvas.clientWidth,height:character.canvas.clientHeight},gazeRange);
  const follow=$('tracking').checked&&state.look.active&&!state.paused&&book<.15;
  const gazeBlend=schedule?1-Math.exp(-dt*14):1;
  state.gaze.x+=((follow?state.look.x:0)-state.gaze.x)*gazeBlend;
  state.gaze.y+=((follow?state.look.y:0)-state.gaze.y)*gazeBlend;
  add('ParamEyeBallX',state.gaze.x*expression.gazeInfluence);add('ParamEyeBallY',state.gaze.y*expression.gazeInfluence);
  if(book){add('ParamAngleX',-4*book);add('ParamAngleY',-3.2*book);add('ParamAngleZ',-2.2*book);add('ParamBodyLean',.5*book);add('ParamEyeBallX',-.1*book);add('ParamEyeBallY',-.24*book);add('ParamBrowLY',-.08*book);add('ParamBrowRY',-.04*book);for(const id of ['ParamEyeLOpen','ParamEyeROpen']){const value=character.model.parameters.values[character.parameterIndex[id]];character.set(id,value*(1-.13*book));}}
  const mouth=(voice?.player.mouth(dt)||0)*.84;
  if(voice?.player.item&&!voice.player.audio.paused&&!voice.player.audio.ended&&$('lip-sync').checked)character.set('ParamMouthOpenY',mouth);
  if(state.gesture){const elapsed=t-state.gesture.start;if(elapsed>1.5)state.gesture=null;else{const envelope=Math.sin(Math.PI*elapsed/1.5);if(state.gesture.type==='nod')add('ParamAngleY',Math.sin(elapsed*7)*4*envelope);if(state.gesture.type==='shake')add('ParamAngleX',Math.sin(elapsed*9)*6*envelope);if(state.gesture.type==='bow'){add('ParamBodyLean',2.5*envelope);add('ParamAngleY',-5*envelope);}}}
  const meal=feeding?.step(dt);if(meal)feeding.apply(meal);
  const cup=tea?.step(dt);if(cup)tea.apply(cup);
  pet?.applyPeek(add);
  pet?.robin?.apply(add);
  const teaInfo=character.characterStyle==='chibi'?tea?.diagnostic().info:null;
  const attention=chibiAttention.update({dt:state.paused?0:dt,target:{x:state.look.x/gazeRange.x,y:state.look.y/gazeRange.y},active:follow,idle:$('idle').checked,blocked:Boolean(book>.015||meal?.busy||cup?.busy||teaInfo?.brewing||state.gesture),immediate:!schedule});
  character.chibiState={clock:t,dt,idle:$('idle').checked,look:attention.look,headLook:attention.head,blink:attention.blink,speaking:Boolean(voice?.player.item&&!voice.player.audio.paused&&!voice.player.audio.ended),moodId:definitions[acting&&acting.weight>.5?acting.index:state.mood]?.id,gesture:state.gesture,book:reaction,meal,cup,brewing:teaInfo?.brewing,brewProgress:teaInfo?.brewing?Math.max(0,Math.min(1,(Date.now()-teaInfo.brewing.start)/(teaInfo.brewing.end-teaInfo.brewing.start))):0};
  character.render();pet?.draw(state.clock);feeding?.draw();tea?.draw(state.clock);stickers?.position();if(schedule)requestAnimationFrame(frame);
}
main().catch(error=>{startup.fail(error);$('status').textContent='加载失败';console.error(error);});
