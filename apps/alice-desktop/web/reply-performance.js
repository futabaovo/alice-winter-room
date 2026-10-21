// A response owns its timeline. Audio time, rather than queued wall timers,
// determines its pose, including pause, seeking and replay. No keyword rules.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=n=>{n=clamp(n,0,1);return n*n*(3-2*n);};
const split=text=>String(text).split(/(?<=[。！？!?])|[\r\n]+/u).map(s=>s.trim()).filter(Boolean);
export class ReplyPerformance {
  constructor({getSpeech,getMood,displayMood,moodIds,now=()=>performance.now()/1000}){
    Object.assign(this,{getSpeech,getMood,displayMood,moodIds,now});this.enabled=true;this.session=null;this.serial=0;this.trace=[];this.lastPose=null;
  }
  log(type,extra={}){this.trace.push({type,token:this.session?.token,...extra});this.trace=this.trace.slice(-60);}
  reserve(){this.cancel('replacement');const token=++this.serial;if(this.enabled){this.session={token,baseIndex:this.getMood(),mode:'pending',events:[],timeline:[],lastKey:null};this.log('reserved');}return token;}
  accept(token,reply){const s=this.session;if(!s||s.token!==token)return false;s.ja=reply.ja;s.events=Array.isArray(reply.expressionEvents)?reply.expressionEvents.filter(e=>Number.isInteger(e.sentenceIndex)&&this.moodIds.includes(e.emotion)&&e.emotion!=='neutral'&&Number.isFinite(e.strength)&&Number.isFinite(e.hold)).slice(0,2):[];this.log('planned',{events:s.events.length});return true;}
  timeline(cues){const s=this.session;const events=s.events.flatMap((event,i)=>{const cue=cues[event.sentenceIndex];if(!cue||!Number.isFinite(cue.start)||!Number.isFinite(cue.end)||cue.end<=cue.start)return [];const hold=Math.min(clamp(event.hold,.6,1.8),['smile','rest','bow','sigh','dizzy'].includes(event.emotion)?.75:1.8);return [{...event,key:i,start:cue.start,end:cue.start+.24+hold+.55,strength:clamp(event.strength,.15,.6)}];}).sort((a,b)=>a.start-b.start);for(let i=0;i<events.length-1;i++)events[i].end=Math.min(events[i].end,events[i+1].start);return events;}
  attachSpeech(token,item){const s=this.session;if(!s||s.token!==token)return false;s.timeline=this.timeline(item.speechCues||[]);s.speechId=item.id;s.mode='voice';s.lastKey=null;this.log('audio-bound',{id:item.id,events:s.timeline.length});return true;}
  startText(token){const s=this.session;if(!s||s.token!==token)return false;let cursor=0;const cues=split(s.ja).map(ja=>{const start=cursor;cursor+=clamp([...ja].length*.12,1.8,7);return {start,end:cursor};});s.timeline=this.timeline(cues);delete s.speechId;s.mode='text';s.started=this.now();s.duration=cursor;s.lastKey=null;this.log('text-started',{events:s.timeline.length});return true;}
  setEnabled(value){this.enabled=Boolean(value);if(!this.enabled)this.cancel('disabled');}
  manualOverride(){this.cancel('manual',{restore:false});}
  cancel(reason='cancel',{restore=true}={}){if(!this.session)return;const base=this.session.baseIndex;this.log(reason);this.session=null;this.lastPose=null;if(restore)this.displayMood(base);}
  finish(){const s=this.session;if(!s)return;s.mode='done';s.lastKey=null;this.lastPose=null;this.displayMood(s.baseIndex);this.log('finished');}
  update(){
    const s=this.session;if(!s)return null;const now=this.now();let time=0;
    if(s.mode==='pending')return null;
    if(s.mode==='tail'){
      const speech=this.getSpeech();
      if(s.speechId&&(!speech.id||speech.id!==s.speechId||speech.error)){this.cancel('speech-replaced');return null;}
      if(s.speechId&&!speech.ended){s.mode='voice';s.lastKey=null;this.lastPose=null;return this.update();}
      const elapsed=now-s.tailStart;if(elapsed>=.55){this.finish();return null;}
      this.lastPose={...s.tailPose,weight:s.tailPose.weight*(1-smooth(elapsed/.55))};return this.lastPose;
    }
    if(s.mode==='voice'||s.mode==='done'){
      const speech=this.getSpeech();
      if(s.mode==='done'){if(s.speechId&&speech.id===s.speechId&&speech.playing&&!speech.ended){s.mode='voice';s.lastKey=null;this.log('replay');}else return null;}
      if(!speech.id||speech.id!==s.speechId||speech.error){this.cancel('speech-replaced');return null;}
      if(speech.loading)return this.lastPose;
      time=speech.time;
      if(speech.ended){if(this.lastPose){s.tailPose=this.lastPose;s.tailStart=now;s.mode='tail';return this.lastPose;}this.finish();return null;}
    }else if(s.mode==='text'){time=now-s.started;if(time>=s.duration+1){if(this.lastPose){s.tailPose=this.lastPose;s.tailStart=now;s.mode='tail';return this.lastPose;}this.finish();return null;}}
    // The latest relevant sentence takes precedence; rewinding reconstructs it.
    const event=s.timeline.filter(e=>time>=e.start&&time<e.end).at(-1);
    if(!event){if(s.lastKey!==null){this.displayMood(s.baseIndex);this.log('released',{time});s.lastKey=null;}this.lastPose=null;return null;}
    const elapsed=time-event.start,remaining=event.end-time;
    const weight=Math.min(smooth(elapsed/.24),smooth(remaining/.55));
    const index=this.moodIds.indexOf(event.emotion);
    if(s.lastKey!==event.key){s.lastKey=event.key;this.displayMood(index);this.log('expression',{emotion:event.emotion,time});}
    this.lastPose={index,baseIndex:s.baseIndex,strength:event.strength,weight};return this.lastPose;
  }
  diagnostic(){const s=this.session;return {enabled:this.enabled,token:s?.token||null,mode:s?.mode||'idle',baseIndex:s?.baseIndex??null,active:this.lastPose,timeline:s?.timeline||[],trace:this.trace.slice()};}
}
