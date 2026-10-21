import {initDialogueAppearance} from './dialogue-appearance.js';
const $=id=>document.getElementById(id);
export async function initPetOptions({isPet}){
  let value={voiceReply:false,robinEnabled:true,robinVoice:true,dialogueOpacity:96};const listeners=new Set(),api=window.aliceDesktop;
  function apply(next){const previous=value;value={...value,...Object.fromEntries(Object.keys(value).filter(k=>typeof next?.[k]===typeof value[k]&&(typeof value[k]!=='number'||Number.isFinite(next[k]))).map(k=>[k,k==='dialogueOpacity'?Math.round(Math.max(0,Math.min(100,next[k]))):next[k]]))};$('pet-voice-reply').checked=value.voiceReply;$('robin-enabled').checked=value.robinEnabled;$('robin-voice').checked=value.robinVoice;if(isPet)$('chat-auto-voice').checked=value.voiceReply;for(const fn of listeners)fn(value,previous);}
  async function save(patch){const r=await api.petOptionsSave(patch);if(!r.ok)throw Error(r.message);apply(r);return value;}
  $('pet-voice-reply').onchange=()=>{void save({voiceReply:$('pet-voice-reply').checked}).catch(e=>{$('chat-status').textContent=e.message;apply(value);});};
  for(const [id,key]of [['robin-enabled','robinEnabled'],['robin-voice','robinVoice']])$(id).onchange=()=>{void save({[key]:$(id).checked}).catch(e=>{$('robin-status').textContent=e.message;apply(value);});};
  const unsub=api?.onPetOptions?.(apply);window.addEventListener('pagehide',()=>unsub?.(),{once:true});apply(api?.petOptions?await api.petOptions():value);
  const options={get value(){return value;},save,subscribe(fn){listeners.add(fn);return ()=>listeners.delete(fn);}};
  initDialogueAppearance(options);
  return options;
}
