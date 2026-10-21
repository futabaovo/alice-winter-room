const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
// Flavor rules belong to this interaction, rather than a real-world brewing guide.
const LEAVES=[
  {id:'daily',name:'日常红茶',quality:'普通',base:66,temperature:95,seconds:180,note:'朴素醇和，适合安静的日常。'},
  {id:'choice',name:'精选红茶',quality:'精选',base:84,temperature:95,seconds:180,note:'香气细腻，泡得合适时入口柔顺。'},
  {id:'reserve',name:'珍藏红茶',quality:'珍藏',base:98,temperature:90,seconds:150,note:'清雅的香气与悠长余韵，需要仔细掌握火候。'}
];
const DEFAULT_RECIPE={leaf:'choice',temperature:95,seconds:180};
const FEELINGS={
  exquisite:{name:'余韵悠长',zh:'……香气和余韵都很好。再陪我坐一会儿吧。',ja:'……香りも余韻も、とてもいいわ。もう少し、ここにいて。',expression:'smile'},
  good:{name:'心情舒展',zh:'入口很顺，香气也恰好。……泡得不错。',ja:'口当たりも香りも、ちょうどいいわ。……上手に淹れたのね。',expression:'smile'},
  ordinary:{name:'平静满足',zh:'嗯，作为日常的红茶，这样就可以了。',ja:'ええ、普段のお茶なら、これで十分よ。',expression:'neutral'},
  weak:{name:'略感遗憾',zh:'……有些淡，香气还没展开。下次再仔细些吧。',ja:'……少し薄いわ。香りがまだ開いていない。次はもう少し丁寧にね。',expression:'downcast'},
  bitter:{name:'微微蹙眉',zh:'……有些涩。下次别让茶叶泡这么久。',ja:'……少し渋いわ。次は、茶葉を浸しすぎないで。',expression:'displeased'},
  flat:{name:'不太满意',zh:'……这杯的香气不太对。水温和时间，再调整一下吧。',ja:'……この香りは、少し違うわ。温度と時間を、見直して。',expression:'thinking'}
};
function recipe(value){
  if(!value||!LEAVES.some(l=>l.id===value.leaf)||!Number.isInteger(value.temperature)||value.temperature<80||value.temperature>100||!Number.isInteger(value.seconds)||value.seconds<60||value.seconds>300)throw Error('请选择茶叶，并使用 80–100℃、60–300 秒的配方。');
  return {leaf:value.leaf,temperature:value.temperature,seconds:value.seconds};
}
function evaluate(value){
  const r=recipe(value),leaf=LEAVES.find(l=>l.id===r.leaf),ratio=r.seconds/leaf.seconds;
  let score=Math.round(leaf.base-Math.abs(r.temperature-leaf.temperature)*1.25-Math.abs(Math.log(ratio))*40),flavor='balanced';
  if(ratio>1.4&&r.temperature>=leaf.temperature-8){flavor='bitter';score=Math.min(score,51);}
  else if(ratio<.7||r.temperature<leaf.temperature-10){flavor='weak';score=Math.min(score,51);}
  score=Math.max(5,Math.min(99,score));
  const grade=score>=90?'珍品':score>=75?'佳品':score>=55?'家常':'欠佳',feeling=flavor==='balanced'?(score>=90?'exquisite':score>=75?'good':score>=55?'ordinary':'flat'):flavor;
  const reason=flavor==='bitter'?'浸泡偏久，涩味盖过了香气。':flavor==='weak'?'萃取不足，茶汤与香气都偏淡。':score>=75?'水温和时间配合得当，保留了茶叶的香气。':score>=55?'口感平实，是一杯日常红茶。':'火候不太合适，香气没有很好地展开。';
  return {recipe:r,leafName:leaf.name,score,grade,flavor,feeling,reason,feedback:{...FEELINGS[feeling]}};
}
class TeaHost{
  constructor({profile,onChange=()=>{},now=Date.now,brewMs=4200,timers=true}){
    Object.assign(this,{file:path.join(profile,'tea.json'),onChange,now,brewMs,timers});this.recipe={...DEFAULT_RECIPE};this.cup=null;this.brewing=null;this.claim=null;this.history=[];
    try{const saved=JSON.parse(fs.readFileSync(this.file,'utf8'));try{this.recipe=recipe(saved.recipe);}catch{}
      const cup=v=>{if(!v||typeof v.id!=='string'||v.id.length>80)return null;return {id:v.id,createdAt:Number.isFinite(v.createdAt)?v.createdAt:this.now(),...evaluate(v.recipe)};};
      try{this.cup=cup(saved.cup);}catch{}
      if(!this.cup&&saved.brewing&&typeof saved.brewing.id==='string'&&Number.isFinite(saved.brewing.end)&&Number.isFinite(saved.brewing.start))try{this.brewing={id:saved.brewing.id,start:saved.brewing.start,end:saved.brewing.end,recipe:recipe(saved.brewing.recipe)};}catch{}
      this.history=(Array.isArray(saved.history)?saved.history:[]).slice(0,8).flatMap(v=>{try{const c=cup(v);return c?[{...c,tastedAt:Number.isFinite(v.tastedAt)?v.tastedAt:this.now()}]:[];}catch{return [];}});
    }catch{}
    this.tick();this.arm();
  }
  save(){fs.mkdirSync(path.dirname(this.file),{recursive:true});const temp=this.file+'.tmp';fs.writeFileSync(temp,JSON.stringify({recipe:this.recipe,cup:this.cup,brewing:this.brewing,history:this.history}));fs.renameSync(temp,this.file);}
  changed(){this.save();this.onChange(this.snapshot());}
  tick(){
    if(this.brewing&&this.now()>=this.brewing.end){const b=this.brewing;this.brewing=null;this.cup={id:b.id,createdAt:this.now(),...evaluate(b.recipe)};this.changed();}
    if(this.claim&&this.now()>this.claim.until){this.claim=null;this.onChange(this.snapshot());}
  }
  arm(){clearTimeout(this.timer);if(this.timers&&(this.brewing||this.claim)){const deadline=this.brewing?.end??this.claim.until;this.timer=setTimeout(()=>{this.tick();this.arm();},Math.max(1,deadline-this.now()+1));this.timer.unref?.();}}
  snapshot(){return JSON.parse(JSON.stringify({phase:this.brewing?'brewing':this.claim?'serving':this.cup?'ready':'idle',recipe:this.recipe,leaves:LEAVES,brewing:this.brewing,cup:this.cup,history:this.history,brewMs:this.brewMs,serverNow:this.now()}));}
  info(){this.tick();return this.snapshot();}
  brew(value){this.tick();if(this.brewing||this.cup||this.claim)throw Error('茶还在这里。先递给有珠，或倒掉这杯再泡。');this.recipe=recipe(value);const start=this.now();this.brewing={id:randomUUID(),start,end:start+this.brewMs,recipe:{...this.recipe}};this.changed();this.arm();return this.snapshot();}
  discard(){this.tick();if(this.claim)throw Error('请等她把杯子放下。');this.brewing=null;this.cup=null;this.changed();this.arm();return this.snapshot();}
  take(owner,id){this.tick();if(!this.cup||this.cup.id!==id||this.claim)throw Error('这杯茶已被取走，或还没有泡好。');this.claim={owner,id,until:this.now()+45000};this.onChange(this.snapshot());this.arm();return this.snapshot();}
  finish(owner,id){this.tick();if(!this.claim||this.claim.owner!==owner||this.claim.id!==id||this.cup?.id!==id)throw Error('这次品饮已经结束，请重新递茶。');const tasted={...this.cup,tastedAt:this.now()};this.history.unshift(tasted);this.history=this.history.slice(0,8);this.cup=null;this.claim=null;this.changed();this.arm();return {...this.snapshot(),tasted};}
  release(owner){if(this.claim&&(owner===undefined||this.claim.owner===owner)){this.claim=null;this.onChange(this.snapshot());this.arm();}return this.snapshot();}
  close(){clearTimeout(this.timer);this.claim=null;this.save();}
}
module.exports={TeaHost,evaluate,recipe,LEAVES,FEELINGS,DEFAULT_RECIPE};
