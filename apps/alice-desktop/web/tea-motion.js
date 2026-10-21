const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{n=clamp(n);return clamp(n*n*n*(10+n*(-15+6*n)));};
const segments=[['approach',1],['inspect',.55],['sip',1.3],['lower',.85],['feeling',2.8],['settle',.65]];
export class TeaMotion{
  constructor(){this.completed=0;this.reset();}
  get busy(){return this.phase!=='idle';}
  reset(){this.phase='idle';this.elapsed=0;this.wait=0;this.cup=null;this.tasted=false;this.cancelPose=null;}
  request(cup){if(this.busy||!cup)return false;this.cup=cup;this.phase='queued';this.elapsed=0;this.wait=0;return true;}
  cancel(){if(this.phase==='idle'||this.phase==='cancelled')return;if(this.phase==='queued'){this.reset();return;}this.cancelPose=this.pose();this.phase='cancelled';this.elapsed=0;}
  step(dt,{available=true,interrupted=false}={}){
    dt=Math.max(0,Math.min(.1,dt));let taste=false,finished=false,expired=false;
    if(interrupted&&['approach','inspect','sip','lower'].includes(this.phase))this.cancel();
    if(this.phase==='queued'){this.wait+=dt;if(this.wait>20){this.reset();expired=true;}else if(available){this.phase='approach';this.elapsed=0;}}
    else if(this.phase==='cancelled'){this.elapsed+=dt;if(this.elapsed>=.45){this.reset();finished=true;}}
    else if(this.phase!=='idle'){
      this.elapsed+=dt;let at=0,found=false;
      for(const [name,seconds] of segments){if(this.elapsed<at+seconds){this.phase=name;found=true;break;}at+=seconds;}
      if(!this.tasted&&this.elapsed>=3.7){this.tasted=true;taste=true;this.completed++;}
      if(!found){this.reset();finished=true;}
    }
    return {...this.pose(),taste,finished,expired};
  }
  pose(){
    const base={phase:this.phase,busy:this.busy,cup:this.cup,elapsed:this.elapsed,completed:this.completed,weight:0,travel:0,tilt:0,sip:0,consumed:0,feeling:0,alpha:0};
    if(this.phase==='idle'||this.phase==='queued')return base;
    if(this.phase==='cancelled'){const p=ease(this.elapsed/.45),old=this.cancelPose;return {...base,weight:old.weight*(1-p),travel:old.travel*(1-p),tilt:old.tilt*(1-p),consumed:old.consumed,alpha:old.alpha*(1-p)};}
    let local=this.elapsed;for(const [name,s] of segments){if(this.phase===name)break;local-=s;}
    const p=clamp(local/segments.find(([name])=>name===this.phase)[1]);
    if(this.phase==='approach')return {...base,weight:.55*ease(p),travel:ease(p),alpha:ease(p*3)};
    if(this.phase==='inspect')return {...base,weight:.55+.45*ease(p),travel:1,alpha:1};
    if(this.phase==='sip'){const sip=ease(p/.22)*(1-ease((p-.72)/.28));return {...base,weight:1,travel:1,tilt:sip,sip,consumed:.36*ease((p-.12)/.78),alpha:1};}
    if(this.phase==='lower')return {...base,weight:1,travel:1-ease(p),consumed:.36,alpha:1-.55*ease(p)};
    if(this.phase==='feeling')return {...base,weight:1,feeling:ease(p/.15),consumed:.36,alpha:.45*(1-ease(p/.2))};
    return {...base,weight:1-ease(p),consumed:.36,feeling:1-ease(p)};
  }
}
