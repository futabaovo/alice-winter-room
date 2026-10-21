import {PeekMotion} from './peek-motion.js';
const $=id=>document.getElementById(id);

// The native window stays inside its monitor; the actor slides behind its edge.
export async function initPetEdge({api,character,reaction,setChat,onActive,getVoice,getChat,message}){
  const root=document.documentElement,slider=$('pet-scale'),value=$('pet-scale-value'),panel=$('pet-size-panel'),handle=$('pet-edge-handle');
  const motion=new PeekMotion(),stage=$('stage');
  const temporaryOwner='edge-peek';let temporaryPeek=null;
  function restoreOutfit({behindEdge=false,side=state.edge.side}={}){
    if(!temporaryPeek)return;
    // A recall restores the chosen outfit before it slides back into view.
    if(behindEdge&&side)motion.set({side,phase:'hidden'});
    character.wardrobe?.restore(temporaryOwner);temporaryPeek=null;verticalPrepared=false;
  }
  let state={mode:'room',scale:1,edge:{side:null,phase:'free',paused:false}},viewActive=false,pendingScale=null,scaling=false,verticalPrepared=false,drag=null,suppressClickUntil=0,pendingPosition=null,positionWork=Promise.resolve(),endingDrag=Promise.resolve(),positionWriting=false;
  const pose=()=>{character.peekCover=motion.cover;character.peekDirection=motion.direction;stage.style.transformOrigin='50% 94.5%';stage.style.transform=`translate3d(${motion.offset*innerWidth}px,${motion.vertical}px,0) rotate(${motion.angle}deg)`;};
  const vertical=snap=>{
    if(!state.edge.side||!Number.isFinite(state.edge.anchorY)){motion.setVertical(0);return;}
    const face=character.meshBounds('ArtMeshFace'),hat=character.wardrobe?.headBounds()||character.meshBounds('ArtMeshHeadwear');if(!face||!hat)return;
    const angle=motion.target.angle*Math.PI/180,s=Math.sin(angle),c=Math.cos(angle),y=(x,y)=>innerHeight*.945+(x-innerWidth*.5)*s+(y-innerHeight*.945)*c;
    const eyeY=y((face.left+face.right)/2,face.top+face.height*.30),headTop=Math.min(y(hat.left,hat.top),y(hat.right,hat.top)),cx=(face.left+face.right)/2,hasBook=!character.outfit||character.outfit==='winter';
    // At the very bottom, lift the complete book/forearms into view. Keeping
    // only the chin inside the viewport would cut off both wrists.
    const bottom=hasBook?Math.max(y(cx-face.width*1.8,face.bottom+face.width*1.95),y(cx+face.width*1.8,face.bottom+face.width*1.95)):Math.max(y(face.left,face.bottom),y(face.right,face.bottom));
    motion.setVertical(Math.max(6-headTop,Math.min(innerHeight-6-bottom,state.edge.anchorY-eyeY)),snap||!verticalPrepared);verticalPrepared=true;
  };
  const active=()=>onActive(viewActive&&!state.edge.paused&&state.edge.phase!=='hidden');
  const setSizePanel=open=>{panel.hidden=!open;$('pet-size').setAttribute('aria-expanded',String(open));if(open){void api.petHit(true);slider.focus();}};
  function apply(info){
    if(!info?.edge)return;const previous=state.edge;state=info;
    const sideChanged=previous.side&&previous.side!==info.edge.side;
    if(!info.edge.side||info.edge.paused||info.edge.phase==='hidden'||sideChanged)restoreOutfit({behindEdge:info.edge.phase!=='hidden',side:previous.side});
    if(previous.side&&info.edge.side&&sideChanged)motion.set({side:info.edge.side,phase:'hidden'});
    if(info.edge.phase==='peeking'&&(previous.phase!=='peeking'||previous.peekId!==info.edge.peekId)&&info.edge.variant==='penguin'&&character.wardrobe?.selected!=='penguin'){
      if(character.wardrobe?.wearTemporarily('penguin',temporaryOwner)){temporaryPeek=info.edge.peekId;verticalPrepared=false;}
    }
    slider.min=info.scaleLimits.min;slider.max=info.scaleLimits.max;
    if(!scaling&&pendingScale===null){slider.value=Math.round(info.scale*100);value.textContent=slider.value+'%';}
    const docked=Boolean(info.edge.side),hidden=info.edge.phase==='hidden';
    root.classList.toggle('pet-edge',docked);root.classList.toggle('pet-edge-hidden',docked&&hidden);root.classList.toggle('pet-edge-peeking',info.edge.phase==='peeking');
    root.dataset.petEdge=info.edge.side||'';handle.hidden=!docked;$('pet-edge-arrow').textContent=info.edge.side==='right'?'‹':'›';
    if(Number.isFinite(info.edge.anchorY))handle.style.top=(info.edge.anchorY-52)+'px';else handle.style.removeProperty('top');
    root.classList.toggle('pet-edge-dragging',Boolean(info.edge.dragging));if(drag&&previous.dragging&&!info.edge.dragging)void finishDrag(true);
    handle.setAttribute('aria-label',`从${info.edge.side==='right'?'右':'左'}侧唤回有珠，也可上下拖动调整位置`);
    if(docked){setSizePanel(false);setChat(false);if(document.activeElement!==handle)document.activeElement?.blur();for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();}
    if(info.edge.phase==='peeking'&&previous.phase!=='peeking')reaction.trigger();
    if(info.edge.phase==='hiding'&&previous.phase==='peeking')reaction.release();
    motion.set(info.edge);vertical(hidden);pose();
    if(info.message)message(info.message);active();
  }
  async function drainScale(){
    if(scaling)return;scaling=true;
    try{while(pendingScale!==null){const factor=pendingScale;pendingScale=null;const info=await api.petScale(factor);if(!info.ok)throw Error(info.message);apply(info);}}
    catch(error){message(error.message);}
    finally{scaling=false;if(pendingScale===null){slider.value=Math.round(state.scale*100);value.textContent=slider.value+'%';}}
  }
  slider.oninput=()=>{value.textContent=slider.value+'%';pendingScale=Number(slider.value)/100;void drainScale();};
  $('pet-size').onclick=()=>setSizePanel(panel.hidden);$('pet-size-close').onclick=()=>{setSizePanel(false);$('pet-size').focus();};
  const perform=async promise=>{try{const info=await promise;if(!info.ok)throw Error(info.message);apply(info);}catch(error){message(error.message);}};
  for(const side of ['left','right'])$('pet-dock-'+side).onclick=()=>perform(api.petDock(side));
  const movePosition=value=>{pendingPosition=Math.max(0,Math.min(1,value));if(positionWriting)return positionWork;positionWriting=true;positionWork=(async()=>{while(pendingPosition!==null){const next=pendingPosition;pendingPosition=null;const info=await api.petDockPosition(next);if(!info.ok)throw Error(info.message);apply(info);}})().catch(error=>{pendingPosition=null;message(error.message);}).finally(()=>{positionWriting=false;});return positionWork;};
  const finishDrag=cancelled=>{
    if(!drag)return endingDrag;const ended=drag;drag=null;if(ended.travel>6||cancelled)suppressClickUntil=performance.now()+450;
    if(handle.hasPointerCapture(ended.id))handle.releasePointerCapture(ended.id);
    endingDrag=(async()=>{await positionWork;const info=await api.petEdgeDrag(false);if(info.ok)apply(info);else message(info.message);})().catch(error=>message(error.message));return endingDrag;
  };
  handle.onpointerdown=event=>{if(drag||event.button!==0||!state.edge.side)return;drag={id:event.pointerId,screenY:event.screenY,position:state.edge.position,span:Math.max(1,state.edge.travel),travel:0};handle.setPointerCapture(event.pointerId);void api.petEdgeDrag(true).then(info=>{if(!info.ok)message(info.message);}).catch(error=>{message(error.message);void finishDrag(true);});event.preventDefault();};
  handle.onpointermove=event=>{if(!drag||event.pointerId!==drag.id)return;const dy=event.screenY-drag.screenY;drag.travel=Math.max(drag.travel,Math.abs(dy));if(drag.travel>6)void movePosition(drag.position+dy/drag.span);event.preventDefault();};
  handle.onpointerup=()=>{void finishDrag(false);};handle.onpointercancel=()=>{void finishDrag(true);};handle.onlostpointercapture=()=>{void finishDrag(true);};window.addEventListener('blur',()=>{void finishDrag(true);});
  handle.onclick=async()=>{if(performance.now()<suppressClickUntil)return;await endingDrag;await perform(api.petRecall());};
  handle.onkeydown=event=>{if(!state.edge.side||!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?1:state.edge.position+(event.key==='ArrowUp'?-1:1)*(event.shiftKey?32:8)/Math.max(1,state.edge.travel);void movePosition(next);};
  document.addEventListener('pointerdown',event=>{if(!panel.hidden&&!event.target.closest('#pet-size-panel,#pet-size'))setSizePanel(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){setSizePanel(false);$('pet-size').focus();event.preventDefault();}});
  const measure=()=>root.style.setProperty('--pet-controls-height',document.querySelector('.pet-controls').getBoundingClientRect().height+'px');
  new ResizeObserver(measure).observe(document.querySelector('.pet-controls'));measure();
  const report=()=>{const voice=getVoice(),speech=voice?.player.snapshot(),chat=getChat(),focus=document.activeElement;const busy=Boolean(chat?.busy||chat?.attachments.loading||chat?.attachments.images.length||speech?.playing||speech?.paused||speech?.loading||voice?.diagnostic().generating||character.robinBusy||character.feedingBusy||character.teaBusy||character.teaBrewing||document.querySelector('dialog[open]')||focus?.matches('textarea,input:not([type=range])'));
    void api.petActivity(busy).catch(()=>{});return busy;};
  const unsubscribe=api.onPetState(apply),timer=setInterval(report,900);window.addEventListener('beforeunload',()=>{clearInterval(timer);unsubscribe();},{once:true});
  const info=await api.petInfo();if(info.ok)apply(info);report();
  return {setSizePanel,isDocked:()=>Boolean(state.edge.side),recall:()=>perform(api.petRecall()),setViewActive:value=>{viewActive=value;if(!value)restoreOutfit({behindEdge:true});active();},anchor:()=>.5,localPoint:point=>motion.localPoint(point,innerWidth,innerHeight),screenPoint:point=>motion.screenPoint(point,innerWidth,innerHeight),
    step(dt){vertical(false);motion.step(dt);pose();return motion;},
    applyPeek(add){if(motion.cover>.001){const amount=motion.cover;add('ParamAngleX',motion.direction*4*amount);add('ParamAngleZ',motion.direction*-.8*amount);add('ParamEyeBallX',motion.direction*.3*amount);add('ParamEyeBallY',.34*amount);for(const id of ['ParamEyeLOpen','ParamEyeROpen'])add(id,.1*amount);}},
    diagnostic:()=>({state,motion:motion.snapshot(),temporaryPeek,panelOpen:!panel.hidden,scaling,pendingScale,positionWriting,drag:drag?{...drag}:null,busy:report()})};
}
