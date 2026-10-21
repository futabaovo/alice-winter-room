const $=id=>document.getElementById(id);
// Text and audio share the player's subtitle clock, including pauses and seeks.
export function initPetSpeech({voice,character}){
  const bubble=$('pet-speech'),copy=$('pet-speech-copy');let until=0,held=false,lastId=null,lastCue='',lastLoading=false,dismissed=false,boundId=null,pendingReply=false,latest={ja:'',zh:''},mode='文字回复';
  function display({ja='',zh=''},duration=18000){
    if(!ja&&!zh)return;latest={ja,zh};const changed=$('pet-speech-ja').textContent!==ja||$('pet-speech-zh').textContent!==zh;
    $('pet-speech-ja').textContent=ja;$('pet-speech-ja').hidden=!ja;$('pet-speech-zh').textContent=zh;if(changed)copy.scrollTop=0;
    bubble.hidden=false;until=performance.now()+Math.max(duration,(ja.length+zh.length)*90);document.documentElement.classList.add('pet-speaking');$('pet-caption-show').disabled=false;$('pet-caption-show').setAttribute('aria-expanded','true');
  }
  function hide(){bubble.hidden=true;document.documentElement.classList.remove('pet-speaking');$('pet-caption-show').setAttribute('aria-expanded','false');}
  function show(text,duration){dismissed=false;boundId=null;pendingReply=false;mode='有珠';display(text,duration);}
  function refresh(snapshot){
    const newItem=Boolean(snapshot.id&&(snapshot.id!==lastId||(snapshot.loading&&!lastLoading)));
    if(newItem){dismissed=false;lastCue='';boundId=snapshot.id;pendingReply=false;}
    const wasHeld=held,generating=pendingReply&&voice.diagnostic().generating;held=Boolean(snapshot.id&&!snapshot.ended&&(snapshot.playing||snapshot.paused||snapshot.loading))||generating;
    if(boundId&&snapshot.id===boundId){
      mode=snapshot.loading?'准备播放':snapshot.paused?'已暂停':snapshot.ended?'朗读结束':snapshot.error?'播放中断':'语音字幕';
      if(snapshot.cue&&!dismissed){const key=JSON.stringify(snapshot.cue);if(key!==lastCue){display(snapshot.cue,6500);lastCue=key;}}
    }else if(generating)mode='准备语音';
    else if(!snapshot.id&&lastId){boundId=null;mode='文字回复';}
    if(wasHeld&&!held)until=performance.now()+6500;
    const speaking=Boolean(snapshot.playing&&boundId===snapshot.id),pausable=Boolean(snapshot.id&&!snapshot.ended&&!snapshot.loading&&boundId===snapshot.id);
    $('pet-speech-mode').textContent=mode;$('pet-speech-count').textContent=boundId&&snapshot.cueCount>1?`${snapshot.cueIndex+1} / ${snapshot.cueCount}`:'';
    $('pet-speech-toggle').hidden=!pausable;$('pet-speech-toggle').setAttribute('aria-label',snapshot.paused?'继续朗读':'暂停朗读');$('pet-speech-toggle').title=snapshot.paused?'继续朗读':'暂停朗读';$('pet-speech-toggle').dataset.paused=String(snapshot.paused);
    const progress=$('pet-speech-progress');progress.hidden=!boundId||!snapshot.duration;progress.max=snapshot.duration||1;progress.value=Math.min(snapshot.time,snapshot.duration||1);bubble.dataset.state=speaking?'playing':snapshot.paused&&boundId?'paused':generating?'preparing':'quiet';
    lastId=snapshot.id;lastLoading=snapshot.loading;
  }
  function reveal(){dismissed=false;const s=voice.player.snapshot();if(s.id&&s.cue){boundId=s.id;lastCue='';refresh(s);}else if(latest.ja||latest.zh)display(latest,18000);}
  document.addEventListener('alice:reply-present',event=>{show(event.detail);mode='有珠的回复';pendingReply=true;});
  document.addEventListener('alice:reply-stop',()=>{held=false;pendingReply=false;dismissed=true;hide();});
  $('pet-speech-close').onclick=()=>{dismissed=true;hide();};$('pet-caption-show').onclick=reveal;$('pet-caption-show').disabled=true;
  $('pet-speech-toggle').onclick=()=>void voice.player.toggle().catch(()=>{mode='播放中断';});
  const previous=voice.player.onChange;voice.player.onChange=snapshot=>{previous(snapshot);refresh(snapshot);};
  return {hide,show,reveal,space(){return bubble.hidden?0:bubble.offsetHeight+30;},get visible(){return !bubble.hidden;},step(){refresh(voice.player.snapshot());if(!held&&performance.now()>until)hide();},position(){
    if(bubble.hidden)return;
    const hat=character.wardrobe?.headBounds()||character.meshBounds('ArtMeshHeadwear')||character.meshBounds('ArtMeshFace');if(!hat)return;
    const dock=document.documentElement.classList.contains('pet-chat-open')?$('chat-panel'):document.querySelector('.pet-controls'),bottom=dock.getBoundingClientRect().top-10,limit=Math.min(188,Math.max(94,innerHeight*.28),Math.max(94,bottom-16));
    bubble.style.maxHeight=limit+'px';copy.style.maxHeight=Math.max(30,limit-72)+'px';
    const width=bubble.offsetWidth,height=bubble.offsetHeight,center=(hat.left+hat.right)/2,left=Math.max(8,Math.min(innerWidth-width-8,center-width/2));
    bubble.style.left=left+'px';bubble.style.top=Math.max(8,Math.min(hat.top-height-14,bottom-height))+'px';bubble.style.setProperty('--tail-x',Math.max(22,Math.min(width-22,center-left))+'px');bubble.style.opacity='1';
  },diagnostic:()=>({visible:!bubble.hidden,held,dismissed,mode,boundId,ja:$('pet-speech-ja').textContent,zh:$('pet-speech-zh').textContent,opacity:Number(getComputedStyle(bubble).opacity),rect:bubble.getBoundingClientRect().toJSON(),progress:{time:$('pet-speech-progress').value,duration:$('pet-speech-progress').max}})};
}
