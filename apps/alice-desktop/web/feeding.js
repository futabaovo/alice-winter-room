import {FeedingState,ease} from './feeding-state.js';
import {SUSHI_TYPES,sushiType,paintSushi,paintChopsticks} from './sushi-art.js';
export {paintSushi} from './sushi-art.js';
const $=id=>document.getElementById(id),mix=(a,b,t)=>a+(b-a)*t;
const cues={approach:['……寿司？','……お寿司？'],swallow:['……味道还不错。','……悪くないわ。']};

export async function initFeeding({character,isPet,getPet,getVoice,getChat,stickers,onManual}){
  const state=new FeedingState(),canvas=$('feeding-layer'),context=canvas.getContext('2d'),buttons=[$('feed-sushi'),$('pet-feed')];
  let pointer=null,down=null,suppressClick=false,lastPhase='idle',noteUntil=0,lastFood=null,muted=false;
  const preferences=await window.aliceDesktop?.appearanceInfo?.();let selected=sushiType(preferences?.sushi).id;
  function renderSelection(){const type=sushiType(selected);for(const button of document.querySelectorAll('[data-sushi]'))button.setAttribute('aria-pressed',String(button.dataset.sushi===selected));$('sushi-description').textContent=type.description;$('feed-selected').textContent='投喂'+type.short;}
  function select(id,{save=true}={}){if(!SUSHI_TYPES.some(t=>t.id===id))return false;selected=id;renderSelection();if(save)void window.aliceDesktop?.appearanceSave?.({sushi:id});return true;}
  for(const type of SUSHI_TYPES){const button=document.createElement('button');button.type='button';button.className='sushi-card';button.dataset.sushi=type.id;const picture=document.createElement('canvas');picture.width=240;picture.height=150;paintSushi(picture.getContext('2d'),120,78,162,0,-.04,1,type.id);const label=document.createElement('strong');label.textContent=type.name;button.append(picture,label);button.onclick=()=>select(type.id);$('sushi-options').append(button);}
  renderSelection();$('feed-selected').onclick=()=>{$('wardrobe-dialog').close();request();};
  window.aliceDesktop?.onAppearance?.(value=>{if(value.sushi&&value.sushi!==selected)select(value.sushi,{save:false});});
  const thanks=await fetch('voice/sushi-thanks.json').then(r=>{if(!r.ok)throw Error('投喂语音缺失');return r.json();});
  const point=e=>{const r=character.canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top};};
  const mouth=()=>{const f=character.meshBounds('ArtMeshFace'),m=character.meshBounds('ArtMeshMouthOpen');if(!f)return null;return {x:m?(m.left+m.right)/2:f.left+f.width*.5,y:m?(m.top+m.bottom)/2:f.top+f.height*.76,face:f,radius:Math.max(18,f.width*.24)};};
  const busy=()=>{const v=getVoice(),s=v?.player.snapshot();return Boolean(getChat()?.busy||v?.diagnostic().generating||s?.loading||s?.playing||s?.paused||document.querySelector('dialog[open]'));};
  function note(zh,ja=''){
    const teaNote=$('tea-note');if(teaNote)teaNote.hidden=true;
    $('feeding-note').textContent=zh;$('feeding-note').hidden=false;noteUntil=performance.now()+3600;
    if(isPet&&!busy())getPet()?.speech?.show({zh,ja},3600);
  }
  function request(origin){
    if(character.teaBusy){note('先等她放下茶杯吧。');return false;}const target=mouth();if(!target)return false;
    const r=character.canvas.getBoundingClientRect();origin=origin||{x:target.x+target.face.width*.9,y:Math.min(r.height-100,target.y+target.face.height*.9)};
    const type=sushiType(selected),accepted=state.request(origin,{kind:type.id,bites:type.bites});if(!accepted)return false;
    getPet()?.reaction.release();character.feedingBusy=true;document.documentElement.classList.add('feeding-active');getChat()?.companion?.activity?.();if(busy())note('等她忙完这一句。','少し待って。');return true;
  }
  function releaseCapture(){if(down?.button.hasPointerCapture(down.id))down.button.releasePointerCapture(down.id);down=null;}
  function reset(){stickers?.cancelSource('feeding');state.reset();releaseCapture();character.feedingBusy=false;character.feedingInteractive=false;document.documentElement.classList.remove('feeding-active');$('feeding-note').hidden=true;lastFood=null;lastPhase='idle';}
  function releasePointer(e){
    if(!down||down.id!==e.pointerId)return;
    const p=point(e),target=mouth();down=null;character.feedingInteractive=false;
    if(state.phase==='dragging'){
      const accepted=target&&Math.hypot(p.x-target.x,p.y-target.y)<=target.radius;
      state.move(p);state.drop(false);character.feedingBusy=false;
      if(accepted)request(p);else note('没送到嘴边。也可以轻点“寿司”投喂。');
    }
  }
  // A release may be retargeted to the stage after the pointer leaves the
  // toolbar. Handle it in document capture as well as the captured button.
  document.addEventListener('pointerup',releasePointer,true);
  document.addEventListener('pointercancel',()=>{if(down){reset();suppressClick=true;}},true);
  for(const button of buttons){
    button.addEventListener('pointerdown',e=>{if(e.button!==0||state.busy||character.teaBusy||down)return;down={...point(e),id:e.pointerId,button};suppressClick=false;button.setPointerCapture(e.pointerId);});
    button.addEventListener('pointermove',e=>{if(!down||down.id!==e.pointerId)return;pointer=point(e);if(state.phase==='idle'&&Math.hypot(pointer.x-down.x,pointer.y-down.y)>6){const type=sushiType(selected);state.beginDrag(pointer,{kind:type.id,bites:type.bites});suppressClick=true;character.feedingInteractive=true;character.feedingBusy=true;getPet()?.reaction.release();note('把寿司拖到她嘴边，再松开。');}state.move(pointer);});
    button.addEventListener('pointerup',releasePointer);
    button.addEventListener('pointercancel',()=>{reset();suppressClick=true;});
    button.addEventListener('click',e=>{e.preventDefault();if(suppressClick&&e.detail!==0){suppressClick=false;return;}suppressClick=false;request();});
  }
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){state.cancel();if(down){suppressClick=true;releaseCapture();}character.feedingInteractive=false;}});
  window.addEventListener('blur',()=>{if(down||state.phase==='dragging')reset();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  async function complete(){
    note('……谢谢。','ありがとう。');
    const token=stickers?.plan({id:'satisfied',source:'feeding',ja:'ありがとう。',zh:'……谢谢。'});
    if(muted||busy()||!$('chat-auto-voice').checked){stickers?.text(token);return;}
    try{await getVoice().player.play(thanks);stickers?.speech(token,getVoice().player.snapshot());}catch{note('……谢谢。','ありがとう。');stickers?.text(token);}
  }
  return {state,mouth,request,reset,select,types:SUSHI_TYPES,get selected(){return selected;},setMuted:value=>{muted=Boolean(value);},
    step(dt){const speechBusy=busy(),book=getPet()?.reaction.value||0,s=state.step(dt,{available:!speechBusy&&book<.02,interrupted:speechBusy});character.feedingBusy=state.busy;character.feedingInteractive=s.phase==='dragging';document.documentElement.classList.toggle('feeding-active',state.busy);
      if(s.phase!==lastPhase){if(s.phase==='approach'){onManual();const type=sushiType(s.kind);note('……'+type.short+'？','……'+type.ja+'？');}else if(cues[s.phase])note(...cues[s.phase]);lastPhase=s.phase;}
      if(s.expired)note('等她空闲时，再试一口吧。');
      if(s.finished)void complete();
      for(const button of buttons){button.setAttribute('aria-disabled',String(state.busy));const hint=state.busy?'她正在尝寿司，请稍等':'投喂'+sushiType(selected).short+'；右键选择种类';if(button.id==='feed-sushi'){if(button.dataset.railHint!==hint)button.dataset.railHint=hint;}else button.title=hint;}
      return s;
    },
    apply(s){if(!s.weight)return;const c=character,weight=s.weight,add=(id,v)=>c.set(id,c.model.parameters.values[c.parameterIndex[id]]+v*weight);
      add('ParamAngleX',1.8);add('ParamAngleY',-2.4-.45*s.jaw);add('ParamAngleZ',.6);add('ParamMouthForm',.08);add('ParamBrowLY',.07);add('ParamBrowRY',.07);
      for(const [id,target]of [['ParamEyeBallX',.16],['ParamEyeBallY',-.23]]){const i=c.parameterIndex[id];c.set(id,c.model.parameters.values[i]*(1-weight)+target*weight);}
      for(const id of ['ParamEyeLOpen','ParamEyeROpen']){const i=c.parameterIndex[id];c.set(id,c.model.parameters.values[i]*(1-(.13+s.blink)*weight));}
      if(!busy())c.set('ParamMouthOpenY',s.mouth);
    },
    draw(){const c=character.canvas;if(canvas.width!==c.width||canvas.height!==c.height){canvas.width=c.width;canvas.height=c.height;}context.setTransform(c.width/c.clientWidth,0,0,c.height/c.clientHeight,0,0);context.clearRect(0,0,c.clientWidth,c.clientHeight);
      const s=state.pose(),m=mouth();lastFood=null;if(!m)return;
      const type=sushiType(s.kind||selected);
      if(s.phase==='dragging'){context.save();context.strokeStyle='#e8c89cbb';context.lineWidth=1.5;context.setLineDash([3,4]);context.beginPath();context.ellipse(m.x,m.y,m.radius,m.radius*.65,0,0,Math.PI*2);context.stroke();context.restore();paintSushi(context,s.drag.x,s.drag.y,36,0,-.06,1,type.id);lastFood={...s.drag,width:36,kind:type.id};}
      else if(s.foodVisible&&s.origin&&s.consumed<.999){const width=Math.max(12,Math.min(65,m.face.width*.26*type.size)),u=s.travel;let x=mix(s.origin.x,m.x+width*.5,u),y=mix(s.origin.y,m.y,u)-Math.sin(Math.PI*u)*Math.min(50,m.face.width*.35);
        x+=width*(s.hold-s.consumed);y-=width*s.hold*.12;
        const alpha=s.alpha??1;paintChopsticks(context,x,y,width,alpha*(1-ease((s.consumed-.75)/.25)));paintSushi(context,x,y,width,s.consumed,-.06*(1-u),alpha,type.id);lastFood={x,y,width,consumed:s.consumed,hold:s.hold,kind:type.id};
      }
      if(!$('feeding-note').hidden){const hat=character.wardrobe?.headBounds()||character.meshBounds('ArtMeshHeadwear')||m.face;$('feeding-note').style.left=Math.max(12,Math.min(c.clientWidth-260,m.x-120))+'px';$('feeding-note').style.top=Math.max(12,hat.top-42)+'px';if(performance.now()>noteUntil)$('feeding-note').hidden=true;}
    },
    diagnostic:()=>({...state.pose(),mouth:mouth(),food:lastFood,selected,muted})
  };
}

