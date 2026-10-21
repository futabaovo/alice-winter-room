import { SpeechPlayer } from './speech.js';
const $=id=>document.getElementById(id);
const clock=value=>`${Math.floor((value||0)/60)}:${String(Math.floor((value||0)%60)).padStart(2,'0')}`;

export async function initVoice(setMood,{onManual=()=>{}}={}){
  const response=await fetch('voice/manifest.json');if(!response.ok)throw Error('本地语音目录缺失。');
  const {clips}=await response.json();
  let requestSequence=0,generating=false,lastGenerated=null;
  const say=message=>{$('voice-message').textContent=message;};
  const player=new SpeechPlayer(snapshot=>{
    $('voice-pause').disabled=!snapshot.id||snapshot.loading;
    $('voice-stop').disabled=!snapshot.id&&!generating;
    $('voice-pause').textContent=snapshot.paused?'继续语音':snapshot.ended?'重播语音':'暂停语音';
    $('voice-pause').setAttribute('aria-pressed',String(snapshot.paused));
    $('voice-progress').disabled=!snapshot.duration;
    $('voice-progress').max=snapshot.duration||1;$('voice-progress').value=snapshot.time;
    $('voice-time').textContent=clock(snapshot.time)+' / '+clock(snapshot.duration);
    $('speech-caption').hidden=!snapshot.id;$('caption').hidden=Boolean(snapshot.id);
    $('reply-caption').hidden=Boolean(snapshot.id);
    const cue=snapshot.cue||(snapshot.duration&&snapshot.time>=snapshot.duration-.03?player.item?.cues.at(-1):null);
    $('subtitle-zh').textContent=cue?.zh||'…';$('subtitle-ja').textContent=cue?.ja||'';
    if(snapshot.error)say(snapshot.error);
    else if(snapshot.loading)say('正在准备播放…');
    else if(snapshot.id)say(snapshot.playing?'正在播放 · '+snapshot.title:snapshot.paused?'已暂停 · '+snapshot.title:'播放结束 · '+snapshot.title);
  });
  for(const item of clips){const option=document.createElement('option');option.value=item.id;option.textContent=item.title;$('voice-select').append(option);}
  async function playId(id){
    const item=clips.find(clip=>clip.id===id)||(lastGenerated?.id===id?lastGenerated:null);if(!item)throw Error('未找到这句台词。');
    onManual();++requestSequence;if($('voice-expression').checked&&Number.isInteger(item.mood))setMood(item.mood);
    $('voice-select').value=id;await player.play(item);
  }
  const stop=()=>{onManual();++requestSequence;player.stop();say(generating?'已取消播放；本机仍在完成生成。':'语音已停止。');};
  const error=reason=>say(reason.message||String(reason));
  $('voice-play').onclick=()=>playId($('voice-select').value).catch(error);
  $('voice-pause').onclick=()=>player.toggle().catch(error);
  $('voice-stop').onclick=stop;
  $('voice-progress').oninput=()=>{if(Number.isFinite(player.audio.duration)){player.audio.currentTime=Number($('voice-progress').value);player.emit();}};
  $('voice-volume').oninput=()=>{player.setVolume(Number($('voice-volume').value)/100);$('voice-volume-value').textContent=$('voice-volume').value+'%';};
  async function showInfo(result){
    if(!result?.ok)throw Error(result?.message||'无法连接本机语音环境。');
    $('voice-start').disabled=result.ready||generating;
    $('voice-unload').disabled=!result.ready&&!result.starting;
    $('voice-engine-status').textContent=result.ready?'本机语音模型已就绪':result.available?'已找到本机语音环境；首次生成时加载模型。':'请选择已配置语音环境的 live2d 项目文件夹。';
  }
  async function speakText(ja,zh,{preserveMood=false,beforePlay=()=>{}}={}){
    if(!window.aliceDesktop)throw Error('请在桌面程序中使用本机合成。');
    if(generating)throw Error('上一句正在生成，请稍候。');
    if(!ja.trim()||ja.trim().length>120)throw Error('请输入 1–120 字的日语台词。');
    const request=++requestSequence;player.stop();generating=true;$('voice-generate').disabled=true;$('voice-stop').disabled=false;
    $('voice-engine-status').textContent='正在生成日语语音；首次使用会先加载模型…';
    try{
      const result=await window.aliceDesktop.voiceSpeak({ja,zh});
      if(!result.ok)throw Error(result.message);
      lastGenerated=result;
      for(const option of $('voice-select').querySelectorAll('[data-generated]'))option.remove();
      const option=document.createElement('option');option.value=result.id;option.textContent=result.title;option.dataset.generated='true';$('voice-select').append(option);$('voice-select').value=result.id;
      if(request===requestSequence){if(!preserveMood&&$('voice-expression').checked)setMood(0);beforePlay(result);await player.play(result);}
      return {duration:result.duration,played:request===requestSequence};
    }finally{generating=false;$('voice-generate').disabled=false;$('voice-stop').disabled=!player.item;await showInfo(await window.aliceDesktop.voiceInfo());}
  }
  $('voice-form').onsubmit=event=>{event.preventDefault();onManual();speakText($('voice-ja').value,$('voice-zh').value).catch(reason=>{$('voice-engine-status').textContent=reason.message;});};
  $('voice-start').onclick=async()=>{if(!window.aliceDesktop)return;$('voice-start').disabled=true;$('voice-unload').disabled=false;$('voice-engine-status').textContent='正在加载本机语音模型…';try{await showInfo(await window.aliceDesktop.voiceStart());}catch(reason){$('voice-engine-status').textContent=reason.message;$('voice-start').disabled=false;}};
  $('voice-choose').onclick=async()=>{if(!window.aliceDesktop)return;try{await showInfo(await window.aliceDesktop.voiceChoose());}catch(reason){$('voice-engine-status').textContent=reason.message;}};
  $('voice-unload').onclick=async()=>{if(!window.aliceDesktop)return;onManual();++requestSequence;try{await showInfo(await window.aliceDesktop.voiceStop());}catch(reason){$('voice-engine-status').textContent=reason.message;}};
  if(window.aliceDesktop)await showInfo(await window.aliceDesktop.voiceInfo());
  else{$('voice-custom').hidden=true;}
  return {player,clips,playId,stop,speakText,get lastGenerated(){return lastGenerated;},diagnostic:()=>({...player.snapshot(),catalogCount:clips.length,generating})};
}
