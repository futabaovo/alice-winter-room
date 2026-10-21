const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export const smooth=n=>{n=clamp(n);return n*n*n*(10+n*(-15+6*n));};
// Exact critically damped integration keeps velocity continuous on retrigger/release.
export class BookReaction{
  constructor(){this.value=0;this.velocity=0;this.time=0;this.until=0;this.started=-Infinity;this.triggers=0;this.phase='idle';}
  trigger(){if(this.phase==='idle')this.started=this.time;this.until=Math.min(this.started+14,Math.max(this.until,this.time+4.2));this.triggers++;return true;}
  release(){this.until=this.time;}
  step(dt){dt=clamp(dt,0,.08);this.time+=dt;const target=this.time<this.until?1:0,omega=target?4.8:4.1,offset=this.value-target,c=this.velocity+omega*offset,e=Math.exp(-omega*dt);this.value=clamp(target+(offset+c*dt)*e);this.velocity=(this.velocity-omega*c*dt)*e;if(!target&&this.value<.0004&&Math.abs(this.velocity)<.003){this.value=0;this.velocity=0;this.phase='idle';}else this.phase=target?(this.value<.94?'lifting':'thinking'):'lowering';return this.snapshot();}
  snapshot(){return {progress:this.value,velocity:this.velocity,phase:this.phase,triggers:this.triggers,time:this.time};}
}
export class HeadStroke{
  constructor(reaction){this.reaction=reaction;this.reset();this.lastTrigger=-Infinity;}
  reset(){this.last=null;this.started=0;this.travel=0;this.reversals=0;this.direction=0;this.turnTravel=0;}
  move({x,y,time,head,pressed=false}){
    const inside=head&&x>=head.left&&x<=head.right&&y>=head.top&&y<=head.bottom;
    if(!inside){this.reset();return false;}
    if(!this.last||time-this.last.time>.22){this.reset();this.started=time;this.last={x,y,time};return false;}
    const dx=x-this.last.x,dy=y-this.last.y,elapsed=Math.max(.005,time-this.last.time),width=head.right-head.left;this.last={x,y,time};
    if(Math.hypot(dx,dy)/width/elapsed>12){this.reset();return false;}
    if(Math.abs(dx)<.4)return false;
    this.travel+=Math.min(Math.hypot(dx,dy),width*.25)/width;const direction=Math.sign(dx);this.turnTravel+=Math.abs(dx)/width;
    if(this.direction&&direction!==this.direction&&this.turnTravel>.08){this.reversals++;this.turnTravel=0;}this.direction=direction;
    if(time-this.started>=(pressed?.28:.6)&&this.travel>=(pressed?.65:1.25)&&this.reversals>=(pressed?1:2)&&time-this.lastTrigger>.65){this.reaction.trigger();this.lastTrigger=time;this.started=time;this.travel=0;this.reversals=0;return true;}return false;
  }
}
