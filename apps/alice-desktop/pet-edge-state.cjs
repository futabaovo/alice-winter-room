const PEEK_MIN=180000,PEEK_MAX=300000,PEEK_DURATION=6500,HIDE_DURATION=450;
const validSide=side=>side==='left'||side==='right';
class EdgePeek{
  constructor({now=Date.now,random=Math.random}={}){this.now=now;this.random=random;this.side=null;this.phase='free';this.nextAt=0;this.paused=false;this.peekCount=0;this.peekId=0;this.variant='original';}
  delay(){return PEEK_MIN+Math.round(Math.max(0,Math.min(1,this.random()))*(PEEK_MAX-PEEK_MIN));}
  dock(side){if(!validSide(side))throw Error('请选择左侧或右侧。');this.side=side;this.paused=false;this.phase='hiding';this.nextAt=this.now()+HIDE_DURATION;this.peekCount=0;this.variant='original';return this.snapshot();}
  recall(){this.side=null;this.phase='free';this.nextAt=0;this.paused=false;this.peekCount=0;this.variant='original';return this.snapshot();}
  pause(){this.paused=true;if(this.side)this.phase='hidden';this.nextAt=0;}
  resume(){this.paused=false;if(this.side){this.phase='hidden';this.nextAt=this.now()+this.delay();}}
  peek({busy=false,variant='auto'}={}){if(!this.side||this.paused||busy||this.phase!=='hidden')return false;if(!['auto','original','penguin'].includes(variant))return false;this.variant=variant==='auto'?(this.peekCount++%2===0?'penguin':'original'):variant;this.peekId++;this.phase='peeking';this.nextAt=this.now()+PEEK_DURATION;return true;}
  tick({busy=false}={}){
    if(!this.side||this.paused||!this.nextAt||this.now()<this.nextAt)return false;
    if(this.phase==='hiding'){this.phase='hidden';this.nextAt=this.now()+this.delay();return true;}
    if(this.phase==='peeking'){this.phase='hiding';this.nextAt=this.now()+HIDE_DURATION;return true;}
    if(this.phase==='hidden'){if(busy){this.nextAt=this.now()+15000;return false;}return this.peek();}
    return false;
  }
  snapshot(){return {side:this.side,phase:this.phase,nextAt:this.nextAt,paused:this.paused,variant:this.variant,peekId:this.peekId};}
}
function scaleLimits(area){const max=Math.max(1,Math.min(150,Math.floor(area.width/380*100),Math.floor(area.height/650*100)));return {min:Math.min(65,max),max};}
function scaledBounds(bounds,factor,area){
  if(typeof factor!=='number'||!Number.isFinite(factor))throw Error('桌宠大小无效。');
  const limits=scaleLimits(area),percent=Math.max(limits.min,Math.min(limits.max,Math.round(factor*100))),width=Math.min(area.width,Math.round(380*percent/100)),height=Math.min(area.height,Math.round(650*percent/100));
  return {scale:percent/100,bounds:{x:Math.round(Math.max(area.x,Math.min(bounds.x+(bounds.width-width)/2,area.x+area.width-width))),y:Math.round(Math.max(area.y,Math.min(bounds.y+bounds.height-height,area.y+area.height-height))),width,height}};
}
function edgeBounds(bounds,area,side){if(!validSide(side))throw Error('侧边无效。');return {...bounds,x:side==='left'?area.x:area.x+area.width-bounds.width,y:Math.round(Math.max(area.y,Math.min(bounds.y,area.y+area.height-bounds.height)))};}
const EDGE_HANDLE_HEIGHT=104;
function dockPosition(centerY,area){return Math.max(0,Math.min(1,(centerY-area.y-EDGE_HANDLE_HEIGHT/2)/Math.max(1,area.height-EDGE_HANDLE_HEIGHT)));}
function dockLayout(bounds,area,side,position){
  if(typeof position!=='number'||!Number.isFinite(position))throw Error('侧边位置无效。');
  const ratio=Math.max(0,Math.min(1,position)),travel=Math.max(1,area.height-EDGE_HANDLE_HEIGHT),centerY=area.y+EDGE_HANDLE_HEIGHT/2+ratio*travel;
  const placed=edgeBounds({...bounds,y:centerY-bounds.height*.24-EDGE_HANDLE_HEIGHT/2},area,side);
  return {bounds:placed,position:ratio,centerY,travel};
}
function nearestEdge(bounds,area,threshold=24){const left=Math.abs(bounds.x-area.x),right=Math.abs(area.x+area.width-bounds.x-bounds.width);return Math.min(left,right)<=threshold?(left<=right?'left':'right'):null;}
module.exports={EdgePeek,scaledBounds,scaleLimits,edgeBounds,nearestEdge,dockPosition,dockLayout,EDGE_HANDLE_HEIGHT,PEEK_MIN,PEEK_MAX,PEEK_DURATION,HIDE_DURATION};
