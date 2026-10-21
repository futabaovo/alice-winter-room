import {STICKERS,StickerDelivery} from './sticker-state.js';
const $=id=>document.getElementById(id);

export async function initStickers({voice,character,isPet,getPet,getChat,getTea,getFeeding}){
  const bubble=$('sticker-bubble'),picture=$('sticker-picture'),root=document.documentElement,api=window.aliceDesktop;
  let shown=null,hideAt=0,active=true,closing=false,exitToken=null,exitAcknowledged=false;
  const images=await Promise.all(Object.values(STICKERS).map(async value=>{const image=new Image();image.src=value.src;await image.decode();return image;}));
  function hide(){bubble.hidden=true;shown=null;character.stickerReserve=0;character.stickerAnchor=null;}
  function cancel(){delivery.cancel();hide();}
  async function show(item){
    if(!active||closing&&item.id!=='goodbye')return;
    getPet()?.speech?.hide();picture.src=STICKERS[item.id].src;picture.alt='有珠的表情包：'+STICKERS[item.id].label;
    $('sticker-label').textContent=STICKERS[item.id].label;shown=item;bubble.hidden=false;bubble.dataset.sticker=item.id;hideAt=performance.now()+(item.id==='goodbye'?2300:6000);
    if(isPet)character.stickerReserve=bubble.offsetHeight+28;position();
    document.dispatchEvent(new CustomEvent('alice:sticker-shown',{detail:{id:item.id,source:item.source,mode:item.mode}}));
    if(item.id!=='goodbye'&&(item.replyId||['feeding','tea'].includes(item.source))){
      try{const result=await api.stickerRecord({sticker:item.id,replyId:item.replyId,source:item.source,ja:item.ja||'',zh:item.zh||''});if(result.ok&&result.recorded)document.dispatchEvent(new CustomEvent('alice:sticker-sent',{detail:result.row}));}
      catch{/* The local visual still works if a history write is unavailable. */}
    }
  }
  const delivery=new StickerDelivery({send:item=>void show(item)});
  function plan(value){if(closing&&value.id!=='goodbye'||isPet&&root.classList.contains('pet-edge')&&!closing)return null;hide();return delivery.plan(value);}
  function position(){
    if(bubble.hidden)return;const hat=character.wardrobe?.headBounds()||character.meshBounds('ArtMeshHeadwear')||character.meshBounds('ArtMeshFace');if(!hat)return;
    const w=bubble.offsetWidth,h=bubble.offsetHeight,dock=isPet?(root.classList.contains('pet-chat-open')?$('chat-panel'):document.querySelector('.pet-controls')):$('chat-panel'),bottom=dock.getBoundingClientRect().top-10;
    if(isPet){const compact=innerWidth<340;character.stickerReserve=compact?innerHeight*.16:h+28;character.stickerAnchor=compact?.73:null;if(compact){bubble.style.left='8px';bubble.style.top=Math.max(8,Math.min(24,bottom-h))+'px';return;}}
    const left=isPet?(hat.left+hat.right-w)/2:hat.left-w-24;
    bubble.style.left=Math.max(8,Math.min(innerWidth-w-8,left))+'px';bubble.style.top=Math.max(8,Math.min(bottom-h,isPet?hat.top-h-12:hat.top+hat.height*.2))+'px';
  }
  function acknowledge(){if(exitAcknowledged)return;exitAcknowledged=true;void api.farewellDone(exitToken);}
  function tick(){
    const snapshot=voice.player.snapshot();if(shown&&snapshot.playing)hide();delivery.step(snapshot);if(!bubble.hidden&&performance.now()>hideAt){const goodbye=shown?.id==='goodbye';hide();if(goodbye)acknowledge();}
  }
  $('pet-caption-show').addEventListener('click',()=>{if(shown)hide();});
  $('sticker-close').onclick=()=>{if(shown?.id==='goodbye'){hide();acknowledge();}else hide();};
  document.addEventListener('alice:reply-stop',()=>{if(!closing)cancel();});
  const unsubView=api?.onViewActive?.(value=>{active=value;if(!active&&!closing)cancel();});
  const unsubPet=api?.onPetState?.(value=>{if(isPet&&value.edge?.side&&!closing)cancel();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!closing)cancel();});
  async function farewell({token}){
    if(closing)return;closing=true;active=true;exitToken=token;root.classList.add('farewell-active');
    await getChat()?.cancel();getFeeding()?.reset();getTea()?.reset();getPet()?.robin?.setActive(false);
    $('chat-form').inert=true;for(const nav of document.querySelectorAll('.tool-rail,.pet-controls'))nav.inert=true;
    for(const dialog of document.querySelectorAll('dialog[open]'))dialog.close();
    const clip=voice.clips.find(clip=>clip.id==='alice-tomorrow'),text=clip?.cues?.[0]||{zh:'今天就到这里吧。下次再见。',ja:'今日はここまで。またね。'};
    $('reply-zh').textContent=text.zh;$('reply-ja').textContent=text.ja;getPet()?.speech?.show(text,10000);
    const pending=plan({id:'goodbye',source:'exit',...text});
    if(clip&&$('chat-auto-voice').checked){
      try{await voice.player.play(clip);delivery.speech(pending,voice.player.snapshot());}
      catch{delivery.text(pending);}
    }else delivery.text(pending);
  }
  const unsubExit=api?.onFarewell?.(value=>void farewell(value).catch(()=>acknowledge()));
  const timer=setInterval(tick,80);
  window.addEventListener('pagehide',()=>{clearInterval(timer);unsubView?.();unsubPet?.();unsubExit?.();},{once:true});
  return {plan,cancel,text:token=>delivery.text(token),speech:(token,snapshot)=>delivery.speech(token,snapshot),position,
    cancelSource(source){if(delivery.pending?.source===source)delivery.cancel();if(shown?.source===source)hide();},
    diagnostic:()=>({shown:shown?{id:shown.id,source:shown.source}:null,pending:delivery.pending?{...delivery.pending}:null,visible:!bubble.hidden,rect:bubble.getBoundingClientRect().toJSON(),trace:delivery.trace,active,closing,images:images.length})};
}
