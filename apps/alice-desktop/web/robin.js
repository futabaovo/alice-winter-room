import {loadRobinArt,paintBird} from './robin-art.js';
import {robinPose,interruptedPose,ease,DURATION} from './robin-motion.js';
const $=id=>document.getElementById(id);
export async function initRobin({character,options,getVoice,getChat,getEdge,getReaction,speech}){
  await loadRobinArt();const response=await fetch('robin/voice/dialogue.json');if(!response.ok)throw Error('Robin 语音目录缺失。');const manifest=await response.json(),entry=manifest.clips[0],reply=manifest.clips[1];
  const canvas=$('robin-layer'),ctx=canvas.getContext('2d'),audio=new Audio('robin/'+entry.src),ownedId='robin-alice-disdain';audio.preload='auto';
  let active=false,time=null,idle=12,pending=false,leaving=null,lastPose=null,lastFeet=[],lastFace=null,entrySent=false,replySent=false,audioGeneration=0,error='',cacheKey='',cachedSurface=null;
  const ownSpeech=()=>getVoice().player.item?.id===ownedId;
  function stopSound(){++audioGeneration;audio.pause();audio.currentTime=0;if(ownSpeech())getVoice().player.stop();}
  function finish(){stopSound();time=null;leaving=null;lastPose=null;idle=120+Math.random()*120;character.robinBusy=false;document.documentElement.classList.remove('robin-active');ctx.clearRect(0,0,canvas.width,canvas.height);}
  const free=()=>{const v=getVoice(),s=v.player.snapshot(),chat=getChat();return active&&!getEdge()?.isDocked()&&!chat?.busy&&!chat?.attachments.loading&&!chat?.attachments.images.length&&!v.diagnostic().generating&&(!s.id||ownSpeech()||(!s.playing&&!s.paused&&!s.loading))&&!character.feedingBusy&&!character.teaBusy&&!character.teaBrewing&&(getReaction()?.value||0)<.02&&!document.querySelector('dialog[open]')&&!$('chat-input').value.trim()&&(!speech.visible||time!==null||pending);};
  function request(){pending=true;idle=0;$('robin-status').textContent='Robin 会等她空闲时飞来。';return true;}
  function soundError(e){if(e.name==='AbortError')return;error='Robin 的声音暂时无法播放。';$('robin-status').textContent=error;}
  function announce(clip,bird){speech.show({zh:(bird?'Robin：':'')+clip.zh,ja:bird?(clip.displayEnglish||clip.ja):clip.ja},Math.max(2600,clip.duration*1000+500));}
  function cue(){
    if(time>=entry.start&&!entrySent){entrySent=true;announce(entry,true);if(options.value.robinVoice){const token=audioGeneration;audio.volume=getVoice().player.volume;void audio.play().catch(e=>{if(token===audioGeneration)soundError(e);});}}
    if(time>=reply.start&&!replySent){replySent=true;audio.pause();announce(reply,false);if(options.value.robinVoice){const token=audioGeneration;void getVoice().player.play({id:ownedId,title:'有珠回应 Robin',src:'robin/'+reply.src,duration:reply.duration,cues:[{start:0,end:reply.duration,ja:reply.ja,zh:reply.zh}]}).then(()=>{if(token!==audioGeneration&&ownSpeech())getVoice().player.stop();}).catch(e=>{if(token===audioGeneration)soundError(e);});}}
  }
  function surface(x,start,end){const gl=character.gl,c=character.canvas,sx=c.width/c.clientWidth,sy=c.height/c.clientHeight,top=Math.max(0,Math.floor(start*sy)),bottom=Math.min(c.height-1,Math.ceil(end*sy));if(bottom<top)return end;const pixels=new Uint8Array((bottom-top+1)*4);gl.readPixels(Math.max(0,Math.min(c.width-1,Math.round(x*sx))),c.height-1-bottom,1,bottom-top+1,gl.RGBA,gl.UNSIGNED_BYTE,pixels);for(let y=top;y<=bottom;y++)if(pixels[(bottom-y)*4+3]>100)return y/sy+1;return end;}
  function geometry(){const face=character.meshBounds('ArtMeshFace');if(!face)return null;const unit=face.width*.56,hat=character.wardrobe?.headBounds(),penguin=character.outfit==='penguin',x=penguin&&hat?hat.left+hat.width*.20:face.left-face.width*.40,start=penguin&&hat?hat.top:face.bottom+face.height*.18,end=face.bottom+face.height*1.02;
    const key=[x,start,end,unit].map(n=>n.toFixed(1)).join(':')+character.outfit;if(key!==cacheKey){cacheKey=key;cachedSurface=[{x:x+.07*unit,y:surface(x+.07*unit,start,end)},{x:x-.07*unit,y:surface(x-.07*unit,start,end)}];}return {face,unit,feet:cachedSurface,anchor:{x,y:(cachedSurface[0].y+cachedSurface[1].y)/2}};}
  $('pet-robin').onclick=()=>{$('robin-dialog').showModal();};$('close-robin').onclick=()=>$('robin-dialog').close();$('robin-call').onclick=async()=>{try{if(!options.value.robinEnabled)await options.save({robinEnabled:true});$('robin-dialog').close();request();}catch(e){$('robin-status').textContent=e.message;}};
  const unsub=options.subscribe((v,old)=>{if(!v.robinEnabled){pending=false;finish();}else if(!old.robinEnabled)idle=12;if(!v.robinVoice&&old.robinVoice)stopSound();});
  window.addEventListener('pagehide',()=>{unsub();finish();},{once:true});
  return {request,finish,setActive(value){if(active===value)return;active=value;if(!value){pending=false;finish();}else if(time===null)idle=12;},
    step(dt){if(!active||!options.value.robinEnabled)return;const available=free();
      if(leaving){leaving.elapsed+=dt;if(leaving.elapsed>=1.05)finish();return;}
      if(time===null){if(!available)return;idle-=dt;if(idle>0&&!pending)return;time=0;pending=false;entrySent=replySent=false;error='';cacheKey='';}
      if(!available){stopSound();if(lastPose?.visible)leaving={from:{...lastPose},elapsed:0};else finish();return;}
      character.robinBusy=true;document.documentElement.classList.add('robin-active');time+=dt;cue();if(time>=DURATION)finish();
    },
    apply(add){if(time===null||leaving)return;const onset=entry.start+entry.duration*.48,end=reply.start+reply.duration,annoyed=ease((time-onset)/.9)*(1-ease((time-end-.15)/1.1)),away=ease((time-reply.start+.1)/.55)*(1-ease((time-end-.4)/.85));add('ParamAngleX',3.8*away);add('ParamAngleY',-1.1*annoyed);add('ParamEyeBallX',.24*away);add('ParamBrowLY',-.36*annoyed);add('ParamBrowRY',-.30*annoyed);add('ParamMouthForm',-.19*annoyed);},
    draw(){const c=character.canvas;if(canvas.width!==c.width||canvas.height!==c.height){canvas.width=c.width;canvas.height=c.height;}ctx.setTransform(c.width/c.clientWidth,0,0,c.height/c.clientHeight,0,0);ctx.clearRect(0,0,c.clientWidth,c.clientHeight);if(time===null)return;const g=geometry();if(!g)return;const pose=leaving?interruptedPose(leaving.from,leaving.elapsed,c.clientWidth):robinPose(time,g.anchor,g.unit,c.clientWidth);
      const q=audio.currentTime*entry.envelopeHz,i=Math.floor(q),fraction=q-i;pose.mouth=options.value.robinVoice&&!audio.paused&&!audio.ended&&i<entry.envelope.length-1?entry.envelope[i]*(1-fraction)+entry.envelope[i+1]*fraction:0;paintBird(ctx,pose,g.feet);lastPose=pose;lastFeet=g.feet;lastFace=g.face;},
    diagnostic:()=>({active,enabled:options.value.robinEnabled,voice:options.value.robinVoice,time,idle,pending,leaving:Boolean(leaving),pose:lastPose,feet:lastFeet,face:lastFace,audio:{playing:!audio.paused&&!audio.ended,time:audio.currentTime,error},ownSpeech:ownSpeech()})};
}
