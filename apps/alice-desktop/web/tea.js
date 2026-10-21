import {TeaMotion} from './tea-motion.js';
import {paintCup,paintBrewing} from './tea-art.js';
import {cupPlacement} from './tea-animation.js';
const $=id=>document.getElementById(id),mix=(a,b,t)=>a+(b-a)*t;
export async function initTea({character,isPet,getPet,getVoice,getChat,getFeeding,stickers,onManual}){
  const api=window.aliceDesktop,dialog=$('tea-dialog'),canvas=$('tea-layer'),ctx=canvas.getContext('2d'),preview=$('tea-preview'),art=preview.getContext('2d'),motion=new TeaMotion();
  let info=null,draft=null,requesting=false,sequence=0,noteUntil=0,lastPhase='idle',lastCup=null,lastBrew=null,clockOffset=0,origin=null,commitPending=false,viewActive=true;
  if(!api?.teaInfo){$('tea-open').hidden=true;$('pet-tea').hidden=true;return {reset(){},setViewActive(){},step(){},draw(){},diagnostic:()=>({available:false})};}
  const check=r=>{if(!r?.ok)throw Error(r?.message||'茶室暂时没有回应。');return r;};
  const busySpeech=()=>{const v=getVoice(),s=v?.player.snapshot();return Boolean(getChat()?.busy||v?.diagnostic().generating||s?.loading||s?.playing||s?.paused);};
  function note(zh,ja=''){$('feeding-note').hidden=true;$('tea-note').textContent=zh;$('tea-note').hidden=false;noteUntil=performance.now()+6500;if(isPet&&!busySpeech()&&viewActive)getPet()?.speech?.show({zh,ja},6500);}
  function fields(){return {leaf:$('tea-leaf').value,temperature:Number($('tea-temperature').value),seconds:Number($('tea-seconds').value)};}
  function describe(){draft=fields();const l=info.leaves.find(l=>l.id===draft.leaf);$('tea-leaf-note').textContent=l.note;$('tea-recipe-hint').textContent=`这份茶的参考配方：${l.temperature}℃ · ${l.seconds} 秒`;$('tea-temperature-value').textContent=draft.temperature+'℃';$('tea-seconds-value').textContent=draft.seconds+' 秒';}
  function setDraft(r){$('tea-leaf').value=r.leaf;$('tea-temperature').value=r.temperature;$('tea-seconds').value=r.seconds;describe();}
  function render(){if(!info)return;const occupied=info.phase==='brewing'||info.phase==='serving',acting=motion.busy||requesting||commitPending;
    $('tea-brew').disabled=occupied||Boolean(info.cup)||acting;$('tea-serve').disabled=info.phase!=='ready'||acting;$('tea-discard').disabled=info.phase==='serving'||(!info.brewing&&!info.cup)||acting;
    for(const id of ['tea-leaf','tea-temperature','tea-seconds','tea-recommended'])$(id).disabled=occupied||acting;
    $('tea-serve').textContent=motion.phase==='queued'?'等她空闲…':'递给有珠';$('tea-discard').textContent=info.brewing?'取消冲泡':'收走这杯';
    const cup=info.cup;$('tea-result').hidden=!cup;if(cup){$('tea-grade').textContent=cup.grade+' · '+cup.score+' 分';$('tea-grade').dataset.grade=cup.grade;$('tea-result-copy').textContent=cup.leafName+'。'+cup.reason;}
    const latest=info.history[0];$('tea-last').hidden=!latest;$('tea-read').disabled=!latest||acting||busySpeech();
    if(latest){$('tea-feeling-name').textContent=latest.feedback.name;$('tea-feeling-copy').textContent=latest.feedback.zh;}
    $('tea-history').replaceChildren();for(const c of info.history.slice(0,5)){const row=document.createElement('li');row.textContent=`${c.leafName} · ${c.grade} · ${c.feedback.name}`;$('tea-history').append(row);}
    for(const id of ['tea-open','pet-tea']){$(id).classList.toggle('tea-ready',Boolean(cup));const hint=cup?'红茶已泡好，可以递给有珠':'泡一杯红茶';if(id==='tea-open'){$(id).dataset.railHint=hint;}else $(id).title=hint;}
    character.teaBusy=acting;character.teaBrewing=Boolean(info.brewing);document.documentElement.classList.toggle('tea-active',acting||Boolean(info.brewing));if(isPet&&viewActive&&(acting||info.brewing))void api.petActivity(true).catch(()=>{});
  }
  function apply(value){if(!value)return;info=value;clockOffset=value.serverNow-Date.now();if(!$('tea-leaf').options.length)for(const l of info.leaves){const o=document.createElement('option');o.value=l.id;o.textContent=l.quality+' · '+l.name;$('tea-leaf').append(o);}if(!draft)setDraft(info.recipe);render();}
  async function refresh(){apply(check(await api.teaInfo()));}
  async function open(){await refresh();if(isPet&&getPet()?.edge?.isDocked())await getPet().edge.recall();if(!dialog.open)dialog.showModal();getChat()?.companion?.activity?.();}
  async function brew(){try{onManual();apply(check(await api.teaBrew(fields())));$('tea-status').textContent='提起茶壶，准备注水。';getChat()?.companion?.activity?.();return true;}catch(e){$('tea-status').textContent=e.message;return false;}}
  function mouth(){const f=character.meshBounds('ArtMeshFace'),m=character.meshBounds('ArtMeshMouthOpen');return f?{x:m?(m.left+m.right)/2:f.left+f.width*.5,y:m?(m.top+m.bottom)/2:f.top+f.height*.76,face:f}:null;}
  async function serve(){
    if(requesting||motion.busy||commitPending)return false;const cup=info?.cup;if(!cup)return false;const token=++sequence;requesting=true;render();
    try{const r=check(await api.teaTake(cup.id));if(token!==sequence||!viewActive){await api.teaRelease();return false;}apply(r);dialog.close();const m=mouth();if(!m)throw Error('人物还没有准备好。');origin={x:Math.min(character.canvas.clientWidth-35,m.x+m.face.width*1.35),y:m.y+m.face.width*1.1};onManual();motion.request(cup);getPet()?.reaction.release();getChat()?.companion?.activity?.();if(busySpeech()||getFeeding()?.state.busy)note('……先把这杯茶放在这里。等一会儿。','……そのお茶、少し待って。');else note('……红茶？','……紅茶？');return true;
    }catch(e){$('tea-status').textContent=e.message;await api.teaRelease();return false;}finally{requesting=false;render();}
  }
  async function tasted(cup){const token=sequence;commitPending=true;try{const r=check(await api.teaFinish(cup.id));apply(r);if(token===sequence&&viewActive){note(r.tasted.feedback.zh,r.tasted.feedback.ja);$('tea-status').textContent='她已经尝过这杯茶。';const id=['exquisite','good'].includes(r.tasted.feeling)?'satisfied':['bitter','flat'].includes(r.tasted.feeling)?'nope':'none';stickers?.text(stickers.plan({id,source:'tea',...r.tasted.feedback}));}}catch(e){if(token===sequence){motion.cancel();note(e.message);}}finally{commitPending=false;render();}}
  function reset(){stickers?.cancelSource('tea');++sequence;motion.reset();requesting=false;lastPhase='idle';lastCup=null;origin=null;$('tea-note').hidden=true;void api.teaRelease().catch(()=>{});render();}
  $('tea-open').onclick=()=>void open().catch(e=>note(e.message));$('pet-tea').onclick=$('tea-open').onclick;$('close-tea').onclick=()=>dialog.close();
  $('tea-brew').onclick=()=>void brew();$('tea-serve').onclick=()=>void serve();$('tea-discard').onclick=async()=>{try{apply(check(await api.teaDiscard()));$('tea-status').textContent='已经收好茶具，可以重新泡一杯。';}catch(e){$('tea-status').textContent=e.message;}};
  $('tea-leaf').onchange=describe;$('tea-temperature').oninput=describe;$('tea-seconds').oninput=describe;$('tea-recommended').onclick=()=>{const l=info.leaves.find(l=>l.id===$('tea-leaf').value);setDraft({leaf:l.id,temperature:l.temperature,seconds:l.seconds});};
  $('tea-read').onclick=async()=>{const latest=info.history[0];if(!latest||motion.busy)return;dialog.close();onManual();const pending=stickers?.diagnostic().pending,stickerToken=pending?.source==='tea'?pending.token:null;if(stickerToken)stickers.plan({id:'none'});try{await getVoice().speakText(latest.feedback.ja,latest.feedback.zh,{preserveMood:true});if(stickerToken){const token=stickers.plan(pending);stickers.speech(token,getVoice().player.snapshot());}}catch(e){note('这句感想已显示；本机朗读暂不可用。');if(stickerToken){const token=stickers.plan(pending);stickers.text(token);}}};
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&motion.busy){motion.cancel();void api.teaRelease().catch(()=>{});}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
  const unsub=api.onTea(apply);window.addEventListener('beforeunload',()=>{unsub();},{once:true});await refresh();
  setDraft(info.recipe);
  return {open,brew,serve,refresh,reset,motion,mouth,setViewActive:value=>{viewActive=value;if(!value)reset();else void refresh();},
    step(dt){const old=motion.phase,s=motion.step(dt,{available:viewActive&&!busySpeech()&&!getFeeding()?.state.busy&&!document.querySelector('dialog[open]')&&(getPet()?.reaction.value||0)<.02,interrupted:busySpeech()||Boolean(document.querySelector('dialog[open]'))});
      if(s.taste)void tasted(s.cup);if(s.expired||s.finished&&!s.taste&&!commitPending)void api.teaRelease().catch(()=>{});
      if(s.expired)note('等她空闲后，再把茶递来吧。');if(s.phase==='sip'&&old!=='sip')note('……','……');if(s.phase!==lastPhase){lastPhase=s.phase;render();}
      character.teaBusy=motion.busy||requesting||commitPending;$('tea-read').disabled=!info?.history.length||character.teaBusy||busySpeech();return s;
    },
    apply(s){if(!s.weight)return;const c=character,w=s.weight,add=(id,v)=>c.set(id,c.model.parameters.values[c.parameterIndex[id]]+v*w),toward=(id,target,amount)=>{const i=c.parameterIndex[id];c.set(id,mix(c.model.parameters.values[i],target,amount));};
      add('ParamAngleY',-2+4*s.sip);add('ParamAngleX',1.6);toward('ParamEyeBallY',-.22,w*.7);toward('ParamEyeBallX',.16,w*.6);
      for(const id of ['ParamEyeLOpen','ParamEyeROpen'])toward(id,.22,w*(s.sip*.85));if(!busySpeech())toward('ParamMouthOpenY',s.sip*.035,w);
      if(s.feeling){const type=s.cup.feeling,a=s.feeling*.85;
        if(type==='exquisite'||type==='good'){for(const id of ['ParamEyeLOpen','ParamEyeROpen'])toward(id,type==='exquisite'?0:.55,a);toward('ParamMouthForm',.14,a);add('ParamBrowLY',.06*a);add('ParamBrowRY',.06*a);}
        else if(type==='bitter'){for(const id of ['ParamEyeLOpen','ParamEyeROpen'])toward(id,.52,a);add('ParamBrowLY',-.25*a);add('ParamBrowRY',-.25*a);toward('ParamMouthForm',-.18,a);add('ParamAngleX',Math.sin(s.elapsed*5)*1.6*a);}
        else if(type==='weak'||type==='flat'){toward('ParamEyeBallY',-.38,a);add('ParamAngleY',-2*a);toward('ParamMouthForm',-.08,a);}
        else{toward('ParamEyeLOpen',.7,a*.5);toward('ParamEyeROpen',.7,a*.5);add('ParamAngleY',Math.sin(s.elapsed*3)*.6*a);}
      }
    },
    draw(time){const c=character.canvas;if(canvas.width!==c.width||canvas.height!==c.height){canvas.width=c.width;canvas.height=c.height;}ctx.setTransform(c.width/c.clientWidth,0,0,c.height/c.clientHeight,0,0);ctx.clearRect(0,0,c.clientWidth,c.clientHeight);lastCup=null;
      const s=motion.pose(),m=mouth();if(m&&s.alpha>.001&&origin){const w=Math.max(18,Math.min(75,m.face.width*.42)),placed=cupPlacement(origin,m,w,s),{x,y,angle}=placed;paintCup(ctx,x,y,w,{tilt:angle,alpha:s.alpha,fill:1-s.consumed,steam:.65*(1-.4*s.sip),time});const c=Math.cos(angle),sn=Math.sin(angle),contact={x:x-w*.20*c+w*.025*sn,y:y-w*.20*sn-w*.025*c};lastCup={x,y,width:w,alpha:s.alpha,angle,fill:1-s.consumed,rimDistance:Math.hypot(x-m.x,y-m.y),contactDistance:Math.hypot(contact.x-m.x,contact.y-m.y)};}
      if(info){const b=info.brewing,p=b?Math.max(0,Math.min(1,(Date.now()+clockOffset-b.start)/(b.end-b.start))):info.cup?1:0;if(dialog.open)lastBrew=paintBrewing(art,preview.width,preview.height,{progress:p,time,ready:Boolean(info.cup),brewing:Boolean(b)});$('tea-progress').value=p;$('tea-progress').hidden=!b;if(b)$('tea-status').textContent=(lastBrew?.label||'正在冲泡')+' · '+Math.floor(p*100)+'%';else if(info.cup)$('tea-status').textContent='红茶泡好了。';}
      if(!$('tea-note').hidden&&m){const hat=character.wardrobe?.headBounds()||character.meshBounds('ArtMeshHeadwear')||m.face;$('tea-note').style.left=Math.max(12,Math.min(c.clientWidth-270,m.x-125))+'px';$('tea-note').style.top=Math.max(12,hat.top-66)+'px';if(performance.now()>noteUntil)$('tea-note').hidden=true;}
    },
    diagnostic:()=>({info,draft,requesting,commitPending,motion:motion.pose(),cup:lastCup,brewingArt:lastBrew,mouth:mouth(),note:$('tea-note').textContent})
  };
}
