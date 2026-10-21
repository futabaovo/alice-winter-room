const cache=new WeakMap();
const split=text=>String(text||'').split(/(?<=[。！？!?])|[\r\n]+/u).map(s=>s.trim()).filter(Boolean);
export function subtitleCues(item){
  if(!item)return [];if(cache.has(item))return cache.get(item);
  let cues=Array.isArray(item.cues)?item.cues.filter(c=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.start>=0&&c.end>c.start):[];
  const timed=item.speechCues;
  if(Array.isArray(timed)&&timed.length&&timed.every((c,i)=>Number.isFinite(c.start)&&Number.isFinite(c.end)&&c.start>=0&&c.end>c.start&&(!i||c.start>=timed[i-1].end-.001)&&typeof c.ja==='string'&&c.ja.trim()&&(!Number.isFinite(item.duration)||c.end<=item.duration+.03))){
    const chinese=cues.map(c=>c.zh||'').join('\n').trim(),translated=split(chinese),aligned=translated.length===timed.length;
    // Timing comes from synthesis. Only pair translations when sentence counts match.
    cues=timed.map((c,i)=>({start:c.start,end:c.end,ja:c.ja,zh:aligned?translated[i]:chinese}));
  }
  cues=cues.slice().sort((a,b)=>a.start-b.start);cache.set(item,cues);return cues;
}
export function subtitleAt(item,time=0){
  const cues=subtitleCues(item);if(!cues.length)return {cue:null,index:-1,count:0};
  const t=Number.isFinite(time)?Math.max(0,time):0;let index=0;
  // Hold a sentence across its trailing pause; seeking always recomputes from time.
  for(let i=1;i<cues.length;i++){if(t<cues[i].start)break;index=i;}
  return {cue:cues[index],index,count:cues.length};
}
