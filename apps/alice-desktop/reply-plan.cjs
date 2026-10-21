const moods=require('./character/expressions.json').map(item=>item.id);
const splitSentences=text=>String(text).split(/(?<=[。！？!?])|[\r\n]+/u).map(s=>s.trim()).filter(Boolean);
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function normalizeEvents(value,ja){
  if(!Array.isArray(value))return [];
  const count=splitSentences(ja).length,events=[];
  for(const event of value.slice(0,12)){
    if(!event||!Number.isInteger(event.sentenceIndex)||event.sentenceIndex<0||event.sentenceIndex>=count||!moods.includes(event.emotion)||event.emotion==='neutral'||!Number.isFinite(event.strength)||!Number.isFinite(event.hold))continue;
    if(events.some(e=>e.sentenceIndex===event.sentenceIndex))continue;
    events.push({sentenceIndex:event.sentenceIndex,emotion:event.emotion,strength:clamp(event.strength,.15,.6),hold:clamp(event.hold,.6,1.8)});
  }
  return events.sort((a,b)=>a.sentenceIndex-b.sentenceIndex).filter((e,i,a)=>i===0||e.emotion!==a[i-1].emotion).slice(0,2);
}
function validateSpeechCues(value,ja,duration){
  const sentences=splitSentences(ja);let end=0;
  if(!Number.isFinite(duration)||duration<=0||!Array.isArray(value)||value.length!==sentences.length)return [];
  const cues=[];
  for(const [i,cue]of value.entries()){
    if(!cue||cue.ja!==sentences[i]||!Number.isFinite(cue.start)||!Number.isFinite(cue.end)||cue.start<end-.001||cue.start<0||cue.end<=cue.start||cue.end>duration+.03)return [];
    cues.push({start:cue.start,end:cue.end,ja:cue.ja});end=cue.end;
  }
  return cues;
}
module.exports={moods,splitSentences,normalizeEvents,validateSpeechCues};
