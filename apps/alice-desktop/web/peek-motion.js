// Transform the complete stage after rendering, so a tilted head and its book
// remain in the same coordinate system and are clipped only at the screen edge.
const spring=(value,velocity,target,omega,dt)=>{const offset=value-target,c=velocity+omega*offset,e=Math.exp(-omega*dt);return [target+(offset+c*dt)*e,(velocity-omega*c*dt)*e];};
export class PeekMotion{
  constructor(){this.side=null;this.phase='free';this.variant='original';this.direction=1;this.offset=0;this.angle=0;this.cover=0;this.vertical=0;this.velocity={offset:0,angle:0,cover:0,vertical:0};this.target={offset:0,angle:0,cover:0,vertical:0};}
  set({side,phase,variant='original'}){
    this.side=side;this.phase=phase;this.variant=variant;const direction=side==='left'?1:-1;
    if(!side){this.target={offset:0,angle:0,cover:0,vertical:0};return;}
    this.direction=direction;
    if(phase==='hidden'){
      this.target={offset:-direction*1.25,angle:direction*(variant==='penguin'?8:12),cover:1,vertical:this.vertical};Object.assign(this,this.target);this.velocity={offset:0,angle:0,cover:0,vertical:0};
    }else if(phase==='peeking')this.target={offset:-direction*(variant==='penguin'?.50:.60),angle:direction*(variant==='penguin'?8:12),cover:1,vertical:this.target.vertical};
    else this.target={offset:-direction*1.25,angle:this.angle,cover:this.cover,vertical:this.target.vertical};
  }
  setVertical(value,snap=false){this.target.vertical=Number.isFinite(value)?value:0;if(snap){this.vertical=this.target.vertical;this.velocity.vertical=0;}}
  step(dt){dt=Math.max(0,Math.min(.08,dt));for(const key of ['offset','angle','cover','vertical']){[this[key],this.velocity[key]]=spring(this[key],this.velocity[key],this.target[key],key==='cover'?8:11,dt);if(Math.abs(this[key]-this.target[key])<.00001&&Math.abs(this.velocity[key])<.0001){this[key]=this.target[key];this.velocity[key]=0;}}return this.snapshot();}
  localPoint(point,width,height){const angle=this.angle*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),x=point.x-width*(.5+this.offset),y=point.y-height*.945-this.vertical;return {x:width*.5+x*c+y*s,y:height*.945-x*s+y*c};}
  screenPoint(point,width,height){const angle=this.angle*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle),x=point.x-width*.5,y=point.y-height*.945;return {x:width*(.5+this.offset)+x*c-y*s,y:height*.945+this.vertical+x*s+y*c};}
  snapshot(){return {side:this.side,phase:this.phase,variant:this.variant,direction:this.direction,offset:this.offset,angle:this.angle,cover:this.cover,vertical:this.vertical,velocity:{...this.velocity}};}
}
