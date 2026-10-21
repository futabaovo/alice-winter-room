import {BookReaction,HeadStroke,smooth} from './pet-reaction.js';
import {BookRig} from './book-rig.js';
import {initPetSpeech} from './pet-speech.js';
import {initPetEdge} from './pet-edge.js';
import {initRobin} from './robin.js';
const $=id=>document.getElementById(id);
export async function initPet({character,isPet,options,getVoice,getChat,onActive}){
  const api=window.aliceDesktop,reaction=new BookReaction(),stroke=new HeadStroke(reaction);let pointer=null,pressed=false,dragging=false,lastHit=null,lastPick=0,chatOpen=false;
  const rig=isPet?new BookRig(character,$('reaction-back'),$('reaction-front')):null;if(rig)await rig.load();
  const speech=isPet?initPetSpeech({voice:getVoice(),character}):null;
  let robin=null;
  const stop=async()=>{getVoice()?.stop();await getChat()?.cancel();};
  const message=text=>{if(isPet)$('pet-hint').textContent=text;else $('status').textContent=text;};
  const result=async promise=>{const info=await promise;if(!info.ok)throw Error(info.message);return info;};
  if(!api?.petEnter){$('pet-enter').hidden=true;return {reaction,anchor:()=>.5,applyPeek(){},step:dt=>reaction.step(dt),draw(){},isPet:false,head:()=>null,diagnostic:()=>reaction.snapshot()};}
  $('pet-enter').onclick=async()=>{try{await stop();await result(api.petEnter());}catch(error){message(error.message);}};
  $('pet-return').onclick=async()=>{try{await stop();await result(api.petReturn());}catch(error){message(error.message);}};
  function setChat(value){chatOpen=Boolean(value);document.documentElement.classList.toggle('pet-chat-open',chatOpen);character.petChatOpen=chatOpen;$('pet-chat').setAttribute('aria-expanded',String(chatOpen));if(chatOpen){void api.petHit(true);$('chat-input').focus();}}
  $('pet-chat').onclick=()=>setChat(!chatOpen);$('pet-menu').onclick=()=>api.petMenu();
  $('pet-image').onclick=()=>{setChat(true);getChat()?.attachments.choose();};
  document.addEventListener('alice:images-ready',()=>{if(isPet)setChat(true);});
  const edge=isPet?await initPetEdge({api,character,reaction,setChat,onActive:value=>{robin?.setActive(value);onActive(value);},getVoice,getChat,message}):null;
  if(isPet)robin=await initRobin({character,options,getVoice,getChat,getEdge:()=>edge,getReaction:()=>reaction,speech});
  api.onPetEvent(event=>{if(event==='size')edge?.setSizePanel(true);if(event==='chat')setChat(!chatOpen);if(event==='memory')$('companion-tools').click();if(event==='api')$('chat-settings').click();if(event==='reaction'&&!character.feedingBusy&&!character.teaBusy){reaction.trigger();message('……只是在看书。');}});
  api.onViewActive(value=>{if(edge)edge.setViewActive(value);else onActive(value);lastHit=null;if(!value){speech?.hide();dragging=false;pressed=false;stroke.reset();void getChat()?.cancel();getVoice()?.stop();}});
  const head=()=>{const face=character.meshBounds('ArtMeshFace');return face?{left:face.left-face.width*.34,right:face.right+face.width*.34,top:face.top-face.height*1.38,bottom:face.top+face.height*.34}:null;};
  const within=(p,r)=>r&&p.x>=r.left&&p.x<=r.right&&p.y>=r.top&&p.y<=r.bottom;
  const local=point=>edge?.localPoint(point)||point;
  const hit=()=>{if(!isPet)return;const modal=Boolean(document.querySelector('dialog[open]'));let interactive=modal||dragging||pressed||character.feedingInteractive;if(pointer&&!interactive){const element=document.elementFromPoint(pointer.x,pointer.y),p=local(pointer);interactive=Boolean(element?.closest('button,input,textarea,select,summary,.dialogue-dock,.pet-speech,.sticker-bubble,.pet-size-panel,.pet-controls,dialog'))||(!document.documentElement.classList.contains('pet-edge-hidden')&&(character.alphaAt(p.x,p.y)>24||Boolean(rig?.hit(p.x,p.y))));}if(interactive!==lastHit){lastHit=interactive;void api.petHit(interactive);}};
  if(isPet)api.onPetState(()=>{lastHit=null;queueMicrotask(hit);});
  document.addEventListener('mousemove',event=>{if(!isPet)return;pointer={x:event.clientX,y:event.clientY};if(performance.now()-lastPick>35){lastPick=performance.now();hit();}});
  document.addEventListener('mouseleave',()=>{pointer=null;stroke.reset();hit();});
  document.addEventListener('pointermove',event=>{if(!isPet||edge?.isDocked()||character.feedingBusy||character.teaBusy||event.target.closest('button,input,textarea,dialog,.dialogue-dock,.pet-speech,.sticker-bubble'))return;pointer={x:event.clientX,y:event.clientY};if(!dragging){const p=local(pointer);if(stroke.move({...p,time:performance.now()/1000,head:head(),pressed})){message('……只是在看书。');}character.canvas.style.cursor=within(p,head())?'pointer':'grab';}});
  character.canvas.addEventListener('pointerdown',event=>{if(!isPet||event.button!==0)return;if(edge?.isDocked()){void edge.recall();event.preventDefault();event.stopImmediatePropagation();return;}if(character.teaBusy)return;pointer={x:event.clientX,y:event.clientY};const p=local(pointer);pressed=true;hit();if(within(p,head())){stroke.reset();stroke.move({...p,time:performance.now()/1000,head:head(),pressed:true});}else{dragging=true;void api.petDrag(true);}character.canvas.setPointerCapture(event.pointerId);event.preventDefault();event.stopImmediatePropagation();},true);
  const end=()=>{if(dragging)void api.petDrag(false);pressed=false;dragging=false;stroke.reset();hit();};
  document.addEventListener('pointerup',end);document.addEventListener('pointercancel',end);window.addEventListener('blur',end);
  character.canvas.addEventListener('click',event=>{if(isPet){event.preventDefault();event.stopImmediatePropagation();}},true);
  document.addEventListener('contextmenu',event=>{if(!isPet||event.target.closest('textarea,input'))return;event.preventDefault();void api.petMenu();});
  $('pet-drag').onpointerdown=event=>{if(event.button!==0)return;dragging=true;pressed=true;void api.petDrag(true);event.currentTarget.setPointerCapture(event.pointerId);event.preventDefault();};
  document.addEventListener('keydown',event=>{if(isPet&&event.key==='Escape'&&chatOpen&&!document.querySelector('dialog[open]'))setChat(false);});
  if(isPet)await api.petReady();
  return {isPet,reaction,rig,stroke,head,setChat,speech,edge,robin,anchor:()=>edge?.isDocked()?edge.anchor():(character.stickerAnchor??.5),applyPeek:add=>edge?.applyPeek(add),step(dt){edge?.step(dt);robin?.step(dt);const base=reaction.step(dt),pose={...base,progress:Math.max(base.progress,character.peekCover||0)};character.handsOpacity=1-smooth(pose.progress/.18);character.bookProgress=pose.progress;character.bookTime=reaction.time;speech?.step();const blend=1-Math.exp(-dt*9),toolbar=document.querySelector('.pet-controls').getBoundingClientRect(),freeGround=isPet?Math.min(.945,(innerHeight-toolbar.height-16)/innerHeight):.945,ground=freeGround,reserve=Math.max(speech?.visible?speech.space():0,character.stickerReserve||0,(character.robinBusy||getChat()?.busy)?150:0,innerHeight*.1),height=Math.max(.2,Math.min(.84,ground-reserve/innerHeight));character.petHeight=(character.petHeight??.84)+(height-(character.petHeight??.84))*blend;character.petGround=(character.petGround??.945)+(ground-(character.petGround??.945))*blend;return pose;},draw(){rig?.draw();robin?.draw();speech?.position();if(isPet&&performance.now()-lastPick>80){lastPick=performance.now();hit();}},diagnostic:()=>({...reaction.snapshot(),progress:character.bookProgress??reaction.value,isPet,chatOpen,robin:robin?.diagnostic(),edge:edge?.diagnostic(),head:head(),rig:rig?.pose||null,speech:speech?.diagnostic()||null})};
}
