const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class TypingMotion {
  constructor(random=Math.random){this.random=random;this.time=0;this.nextBlink=3+random()*2;this.blinkStart=-10;this.reset();}
  reset(){this.phase='idle';this.age=0;this.pending=false;this.side=0;this.last=-10;this.interval=.28;this.count=0;this.strikes=0;this.engagement=0;}
  pulse(kind='key'){
    const gap=this.time-this.last;this.interval=clamp(this.interval*.65+clamp(gap,.09,.7)*.35,.14,.42);this.last=this.time;this.count++;
    if(this.phase==='idle'){this.side=kind==='mouse'?1:1-this.side;this.phase='down';this.age=0;this.strikes++;}
    else this.pending=true; // One coalesced beat, never a backlog of keystrokes.
  }
  step(dt,{enabled=true,intensity=.6}={}){
    dt=clamp(Number.isFinite(dt)?dt:0,0,.05);this.time+=dt;
    if(!enabled){this.phase='idle';this.pending=false;this.age=0;this.engagement=0;return this.snapshot(0);}
    this.age+=dt;const duration=this.interval;
    if(this.phase==='down'&&this.age>=duration*.48){this.phase='up';this.age=0;}
    else if(this.phase==='up'&&this.age>=duration*.52){
      if(this.pending&&this.time-this.last<.24){this.side=1-this.side;this.phase='down';this.strikes++;}else this.phase='idle';
      this.age=0;this.pending=false;
    }
    this.engagement+=(Number(this.phase!=='idle')-this.engagement)*(1-Math.exp(-dt*8));
    if(this.time>=this.nextBlink&&this.phase==='idle'){this.blinkStart=this.time;this.nextBlink=this.time+3.5+this.random()*3;}
    return this.snapshot(intensity);
  }
  snapshot(intensity=.6){const blink=this.phase==='idle'&&this.time-this.blinkStart<.14;return {phase:this.phase,side:this.side,frame:blink?3:this.phase==='down'?1+this.side:0,count:this.count,strikes:this.strikes,pending:this.pending,engagement:this.engagement,bob:this.phase==='down'?Math.sin(Math.min(1,this.age/(this.interval*.48))*Math.PI)*clamp(intensity,0,1)*1.2:0};}
}
