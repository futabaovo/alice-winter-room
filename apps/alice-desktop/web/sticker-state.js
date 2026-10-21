export const STICKERS=Object.freeze({
  satisfied:{src:'stickers/satisfied.jpg',label:'心满意足'},
  nope:{src:'stickers/nope.jpg',label:'这个不行'},
  smug:{src:'stickers/smug.jpg',label:'有一点得意'},
  speechless:{src:'stickers/speechless.jpg',label:'……无语'},
  goodbye:{src:'stickers/goodbye.jpg',label:'下次再见'}
});
export const readingDelay=text=>Math.max(1200,Math.min(4800,[...String(text||'')].length*65));

// One response owns one delivery. A pause or a cancelled playback is not an end.
export class StickerDelivery{
  constructor({now=()=>performance.now(),send}){this.now=now;this.send=send;this.serial=0;this.pending=null;this.trace=[];}
  cancel(){this.pending=null;}
  plan(value){this.cancel();if(!STICKERS[value?.id])return null;const token=++this.serial;this.pending={...value,token,mode:'pending'};return token;}
  text(token){if(this.pending?.token!==token)return;this.pending.mode='text';this.pending.due=this.now()+readingDelay(this.pending.zh||this.pending.ja);}
  speech(token,snapshot){if(this.pending?.token!==token||!snapshot?.id)return false;Object.assign(this.pending,{mode:'voice',speechId:snapshot.id,playbackId:snapshot.playbackId});return true;}
  step(snapshot){
    const item=this.pending;if(!item)return;
    if(item.mode==='text'&&this.now()>=item.due&&!(snapshot?.playing||snapshot?.paused||snapshot?.loading)){this.deliver(item);return;}
    if(item.mode!=='voice')return;
    if(snapshot.id!==item.speechId||snapshot.playbackId!==item.playbackId||snapshot.error){this.cancel();return;}
    if(snapshot.ended&&snapshot.finishedPlaybackId===item.playbackId&&!snapshot.loading)this.deliver(item);
  }
  deliver(item){if(this.pending!==item)return;this.pending=null;this.trace.push({id:item.id,source:item.source,at:this.now(),mode:item.mode});this.trace=this.trace.slice(-30);this.send(item);}
}
