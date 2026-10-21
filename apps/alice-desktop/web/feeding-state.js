const clamp=n=>Math.max(0,Math.min(1,n));
export const ease=n=>{n=clamp(n);return n*n*n*(10+n*(-15+6*n));};
const twoBites=[['approach',.85],['inspect',.4],['bite',.55],['withdraw',.35],['chew',1.05],['second-offer',.4],['second-bite',.45],['final-chew',1.15],['swallow',.4],['settle',.7]];
const oneBite=[['approach',.85],['inspect',.4],['bite',.55],['chew',1.45],['swallow',.4],['settle',.7]];
export const FEED_DURATION=twoBites.reduce((n,[,s])=>n+s,0);
export class FeedingState{
  constructor(){this.completed=0;this.queuedFor=0;this.reset();}
  get busy(){return this.phase!=='idle';}
  get segments(){return this.bites===1?oneBite:twoBites;}
  get duration(){return this.segments.reduce((n,[,s])=>n+s,0);}
  request(origin,{kind='salmon',bites=2}={}){if(this.busy)return false;this.origin={...origin};this.kind=kind;this.bites=bites===1?1:2;this.phase='queued';this.elapsed=0;this.queuedFor=0;return true;}
  beginDrag(point,options={}){if(this.busy)return false;this.kind=options.kind||'salmon';this.bites=options.bites===1?1:2;this.phase='dragging';this.drag={...point};return true;}
  move(point){if(this.phase==='dragging')this.drag={...point};}
  drop(accepted){if(this.phase!=='dragging')return false;const origin={...this.drag},options={kind:this.kind,bites:this.bites};this.reset();return accepted?this.request(origin,options):false;}
  reset(){this.phase='idle';this.elapsed=0;this.drag=null;this.cancelPose=null;this.origin=null;this.kind=null;this.bites=2;}
  cancel(){if(this.phase==='queued'||this.phase==='dragging'){this.reset();return;}if(this.phase==='idle'||this.phase==='cancelled')return;this.cancelPose=this.pose();this.elapsed=0;this.phase='cancelled';}
  step(dt,{available=true,interrupted=false}={}){
    dt=Math.max(0,Math.min(.1,dt));let finished=false,expired=false;
    if(interrupted&&!['queued','dragging'].includes(this.phase))this.cancel();
    if(this.phase==='queued'){
      this.queuedFor+=dt;if(this.queuedFor>20){this.reset();expired=true;}else if(available){this.phase='approach';this.elapsed=0;}
    }else if(this.phase!=='idle'&&this.phase!=='dragging'){
      this.elapsed+=dt;
      if(this.phase==='cancelled'){if(this.elapsed>=.45)this.reset();}
      else if(this.elapsed>=this.duration){this.completed++;this.reset();finished=true;}
      else{let at=0;for(const [name,seconds]of this.segments){if(this.elapsed<at+seconds){this.phase=name;break;}at+=seconds;}}
    }
    return {...this.pose(),finished,expired};
  }
  pose(){
    const base={phase:this.phase,busy:this.busy,completed:this.completed,elapsed:this.elapsed,duration:this.duration,kind:this.kind,bites:this.bites,weight:0,mouth:0,jaw:0,blink:0,travel:0,hold:0,consumed:0,foodVisible:false,origin:this.origin,drag:this.drag};
    if(this.phase==='idle'||this.phase==='queued')return base;if(this.phase==='dragging')return {...base,foodVisible:true};
    if(this.phase==='cancelled'){const a=ease(this.elapsed/.45),old=this.cancelPose;return {...base,weight:old.weight*(1-a),mouth:old.mouth*(1-a),travel:old.travel,hold:old.hold+.25*a,consumed:old.consumed,foodVisible:old.foodVisible,alpha:1-a};}
    let local=this.elapsed;for(const [name,seconds]of this.segments){if(name===this.phase)break;local-=seconds;}
    const duration=this.segments.find(([name])=>name===this.phase)[1],p=clamp(local/duration),first=this.bites===2?.48:1;
    if(this.phase==='approach')return {...base,travel:ease(p),weight:.55*ease(p),foodVisible:true};
    if(this.phase==='inspect')return {...base,travel:1,weight:.55+.45*ease(p),foodVisible:true};
    if(this.phase==='bite')return {...base,travel:1,weight:1,consumed:first*ease((p-.15)/.7),mouth:.28*Math.sin(Math.PI*p),foodVisible:true};
    if(this.phase==='withdraw')return {...base,travel:1,weight:1,hold:.65*ease(p),consumed:first,foodVisible:true};
    if(this.phase==='chew'){const jaw=Math.sin(p*Math.PI*3)**2;return {...base,travel:1,weight:1,hold:this.bites===2?.65:0,consumed:first,jaw,mouth:.008+.035*jaw,foodVisible:this.bites===2};}
    if(this.phase==='second-offer')return {...base,travel:1,weight:1,hold:.65*(1-ease(p)),consumed:.48,foodVisible:true};
    if(this.phase==='second-bite')return {...base,travel:1,weight:1,consumed:.48+.52*ease((p-.12)/.72),mouth:.23*Math.sin(Math.PI*p),foodVisible:true};
    if(this.phase==='final-chew'){const jaw=Math.sin(p*Math.PI*3)**2*(1-ease(p));return {...base,travel:1,weight:1,consumed:1,jaw,mouth:.04*jaw};}
    if(this.phase==='swallow')return {...base,travel:1,weight:1-.15*ease(p),consumed:1,blink:.18*Math.sin(Math.PI*p)**2};
    return {...base,travel:1,weight:.85*(1-ease(p)),consumed:1};
  }
}
