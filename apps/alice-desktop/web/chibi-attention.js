const clamp=(v,a=-1,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
export function blinkOpening(seconds){
  if(seconds<0||seconds>=.285)return 1;
  if(seconds<.09)return 1-smooth(seconds/.09);
  if(seconds<.135)return 0;
  return smooth((seconds-.135)/.15);
}
// Attention has separate eye and head timing. A held target stays still;
// small pointer noise does not start another glance or perpetual oscillation.
export class ChibiAttention{
  constructor(random=Math.random){this.random=random;this.reset();}
  reset(){this.time=0;this.look={x:0,y:0};this.target={x:0,y:0};this.head={x:0,y:0};this.headTarget={x:0,y:0};this.delay=0;this.blinkAt=3.2+this.random()*2.8;this.blinkStart=-10;this.open=1;}
  update({dt=0,target={},active=false,idle=true,blocked=false,immediate=false}={}){
    dt=clamp(dt,0,.05);this.time+=dt;
    const next={x:active&&!blocked?clamp(target.x||0):0,y:active&&!blocked?clamp(target.y||0):0};
    const distance=Math.hypot(next.x-this.target.x,next.y-this.target.y);
    if(distance>.045||!active||immediate){
      if(distance>.3)this.delay=.17;
      this.target=next;
    }
    const eyeBlend=immediate?1:1-Math.exp(-dt*(active?25:5));
    for(const axis of ['x','y'])this.look[axis]+=(this.target[axis]-this.look[axis])*eyeBlend;
    this.delay=Math.max(0,this.delay-dt);
    if(!this.delay)this.headTarget={...this.target};
    const headBlend=immediate?1:1-Math.exp(-dt*3.8);
    for(const axis of ['x','y'])this.head[axis]+=((idle&&!blocked?this.headTarget[axis]:0)-this.head[axis])*headBlend;
    if(!idle||blocked){this.open=1;this.blinkStart=-10;this.blinkAt=this.time+3.2+this.random()*2.8;}
    else{
      if(this.time>=this.blinkAt){this.blinkStart=this.time;this.blinkAt=this.time+3.2+this.random()*3.2;}
      this.open=blinkOpening(this.time-this.blinkStart);
    }
    return {look:{...this.look},head:{...this.head},blink:this.open};
  }
}
