// The renderer and input adapters share this clock, including the ending animation.
export const GAME_DIFFICULTIES = Object.freeze({
  easy: Object.freeze({id:'easy',label:'轻松',description:'Robin 停留更久，同时最多 2 只。',spawnStart:1.05,spawnEnd:.78,lifeStart:2.15,lifeEnd:1.75,maxTargets:2,mediumScore:150,highScore:500}),
  normal: Object.freeze({id:'normal',label:'普通',description:'速度逐渐加快，同时最多 3 只。',spawnStart:.76,spawnEnd:.45,lifeStart:1.65,lifeEnd:1.1,maxTargets:3,mediumScore:220,highScore:750}),
  hard: Object.freeze({id:'hard',label:'挑战',description:'Robin 更快缩回，同时最多 4 只。',spawnStart:.46,spawnEnd:.25,lifeStart:1.15,lifeEnd:.72,maxTargets:4,mediumScore:300,highScore:1100})
});
export const FINAL_SEQUENCE = Object.freeze([
  {stage:'taunt',duration:2.4},{stage:'grab',duration:1.3},{stage:'windup',duration:.8},
  {stage:'strike',duration:.35},{stage:'fly',duration:.6},{stage:'impact',duration:.65},
  {stage:'slide',duration:1.2},{stage:'settle',duration:1}
].map(Object.freeze));
export const FINALE_DURATION = FINAL_SEQUENCE.reduce((sum,part)=>sum+part.duration,0);
const HOLES=Object.freeze(Array.from({length:9},(_,i)=>i));
const ENDING_LINES=Object.freeze({
  low:{robinLine:'哈哈哈哈！才这点分？连我的羽毛都碰不到吧！',aliceLine:'……笑够了吗。'},
  medium:{robinLine:'哼，还算有两下子。不过，我刚才只是热身！',aliceLine:'那就到此为止。'},
  high:{robinLine:'等、等等！有珠大人，我认输！书先放下！',aliceLine:'现在才说，太迟了。'}
});
const EPSILON=1e-8;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));

export class BookRobinGame{
  constructor({random=Math.random,duration=45,difficulty='normal'}={}){
    this.random=random;
    this.duration=Number.isFinite(duration)&&duration>0?duration:45;
    this.difficulty=Object.hasOwn(GAME_DIFFICULTIES,difficulty)?difficulty:'normal';
    this.bestScores={easy:0,normal:0,hard:0};this.reset();
  }
  get best(){return this.bestScores[this.difficulty]||0;}
  get settings(){return GAME_DIFFICULTIES[this.difficulty];}
  reset(){
    this.phase='ready';this.resumePhase=null;this.elapsed=0;this.score=0;this.combo=0;
    this.maxCombo=0;this.hits=0;this.misses=0;this.missedBirds=0;this.targets=[];
    this.effects=[];this.untilSpawn=.25;this.lastSwing=-Infinity;this.serial=0;
    this.finaleElapsed=0;this.ending=null;
  }
  setDifficulty(id){
    if(!['ready','finished'].includes(this.phase)||!Object.hasOwn(GAME_DIFFICULTIES,id))return false;
    if(id!==this.difficulty){this.difficulty=id;this.reset();}
    return true;
  }
  start(){this.reset();this.phase='playing';return this.snapshot();}
  pause(){
    if(this.phase==='playing'||this.phase==='finale'){this.resumePhase=this.phase;this.phase='paused';}
    else if(this.phase==='paused'){this.phase=this.resumePhase||'playing';this.resumePhase=null;}
    return this.phase;
  }
  randomUnit(){const value=Number(this.random());return Number.isFinite(value)?clamp(value,0,1-EPSILON):.5;}
  beginFinale(){
    this.phase='finale';this.resumePhase=null;this.finaleElapsed=0;
    this.bestScores[this.difficulty]=Math.max(this.best,this.score);
    const config=this.settings,tier=this.score>=config.highScore?'high':this.score>=config.mediumScore?'medium':'low';
    this.ending={tier,...ENDING_LINES[tier]};this.targets=[];this.effects=[];
  }
  tick(dt){
    if(this.phase!=='playing'&&this.phase!=='finale')return this.snapshot();
    dt=Number.isFinite(dt)?clamp(dt,0,.1):0;
    if(this.phase==='finale'){
      this.finaleElapsed=Math.min(FINALE_DURATION,this.finaleElapsed+dt);
      if(this.finaleElapsed+EPSILON>=FINALE_DURATION){this.finaleElapsed=FINALE_DURATION;this.phase='finished';}
      return this.snapshot();
    }
    // Stop before processing targets so the finale cannot add a miss or score.
    this.elapsed=Math.min(this.duration,this.elapsed+dt);
    if(this.elapsed+EPSILON>=this.duration){this.elapsed=this.duration;this.beginFinale();return this.snapshot();}
    this.untilSpawn-=dt;
    for(const target of this.targets){
      target.age+=dt;
      if(!target.hit&&target.age>=target.life){target.hit=true;this.missedBirds++;this.combo=0;}
    }
    this.targets=this.targets.filter(t=>t.age<t.life);
    this.effects=this.effects.filter(e=>this.elapsed-e.at<.65);
    if(this.untilSpawn<=0){
      const config=this.settings,used=new Set(this.targets.map(t=>t.hole));
      const free=HOLES.filter(i=>!used.has(i)),level=this.elapsed/this.duration;
      if(free.length&&this.targets.length<config.maxTargets){
        const hole=free[Math.floor(this.randomUnit()*free.length)];
        this.targets.push({id:++this.serial,hole,age:0,life:config.lifeStart+(config.lifeEnd-config.lifeStart)*level,hit:false});
      }
      this.untilSpawn=config.spawnStart+(config.spawnEnd-config.spawnStart)*level+this.randomUnit()*.12;
    }
    return this.snapshot();
  }
  hit(hole){
    if(this.phase!=='playing'||this.elapsed-this.lastSwing<.16)return {accepted:false};
    this.lastSwing=this.elapsed;
    const target=this.targets.find(t=>t.hole===hole&&!t.hit&&t.age>.1&&t.age<t.life-.08);
    let points=0;
    if(target){
      target.hit=true;this.hits++;this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);
      points=10+Math.min(20,(this.combo-1)*2);this.score+=points;
    }else{this.misses++;this.combo=0;this.score=Math.max(0,this.score-1);}
    const result={accepted:true,hit:Boolean(target),hole,points,at:this.elapsed,id:target?.id,combo:this.combo};
    this.effects.push(result);return result;
  }
  finaleSnapshot(){
    if(!this.ending)return null;
    let start=0,stage='result',progress=1;
    for(const part of FINAL_SEQUENCE){
      if(this.finaleElapsed<start+part.duration-EPSILON){stage=part.stage;progress=clamp((this.finaleElapsed-start)/part.duration,0,1);break;}
      start+=part.duration;
    }
    return {...this.ending,elapsed:this.finaleElapsed,duration:FINALE_DURATION,stage,progress};
  }
  snapshot(){
    const config=this.settings;
    return {
      phase:this.phase,resumePhase:this.resumePhase,elapsed:this.elapsed,remaining:Math.max(0,this.duration-this.elapsed),
      score:this.score,combo:this.combo,maxCombo:this.maxCombo,hits:this.hits,misses:this.misses,missedBirds:this.missedBirds,
      best:this.best,difficulty:this.difficulty,difficultyLabel:config.label,difficultyDescription:config.description,
      difficulties:Object.values(GAME_DIFFICULTIES).map(({id,label,description,maxTargets,mediumScore,highScore})=>({id,label,description,maxTargets,mediumScore,highScore})),
      targets:this.targets.map(t=>({...t})),effects:this.effects.map(e=>({...e})),finale:this.finaleSnapshot()
    };
  }
}
