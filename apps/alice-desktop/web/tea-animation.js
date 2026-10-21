export const clamp=n=>Math.max(0,Math.min(1,n));
export const ease=n=>{n=clamp(n);return clamp(n*n*n*(10+n*(-15+6*n)));};
export const SPOUT_TIP={x:86,y:-32};
const mix=(a,b,t)=>a+(b-a)*t;
const FLOW={start:.27,end:.74,ramp:.04,flight:.035};
const integral=t=>2.5*t**4-3*t**5+t**6;
function flowAt(p){return ease((p-FLOW.start)/FLOW.ramp)*(1-ease((p-FLOW.end+FLOW.ramp)/FLOW.ramp));}
function pouredAt(p){
  const q=p-FLOW.start,duration=FLOW.end-FLOW.start,r=FLOW.ramp;
  if(q<=0)return 0;if(q>=duration)return 1;
  const amount=q<r?r*integral(q/r):q<duration-r?q-r/2:duration-r*1.5+r*((q-duration+r)/r-integral((q-duration+r)/r));
  return clamp(amount/(duration-r));
}
export function potPose(progress){
  const p=clamp(progress),lift=ease((p-.035)/.195),lower=ease((p-.82)/.18),carry=lift*(1-lower),tilt=ease((p-.16)/.115)*(1-ease((p-.70)/.12));
  const landing=clamp((p-.91)/.09),settle=1.5*Math.sin(landing*Math.PI*2)*Math.sin(landing*Math.PI)**2;
  return {x:mix(-116,-28,carry),y:mix(14,-39,carry)+settle,angle:.42*tilt};
}
export function potPoint(pot,point=SPOUT_TIP){const c=Math.cos(pot.angle),s=Math.sin(pot.angle);return {x:pot.x+point.x*c-point.y*s,y:pot.y+point.x*s+point.y*c};}
export function brewingPose(progress,{ready=false,brewing=progress>0&&!ready}={}){
  const p=ready?1:clamp(progress),pot=potPose(p),source=potPoint(pot),cup={x:110,y:0,width:79},target={x:cup.x-5,y:cup.y+1},flow=brewing?flowAt(p):0;
  const droplets=[];
  if(brewing)for(const [at,radius]of [[.75,1.35],[.785,1]]){const q=(p-at)/.05;if(q>0&&q<1){const from=potPoint(potPose(at));droplets.push({x:mix(from.x,target.x,q),y:mix(from.y,target.y,q*q),radius,alpha:1-ease((q-.82)/.18)});}}
  const impact=Math.max(flowAt(p-FLOW.flight),.45*ease((p-.77)/.04)*(1-ease((p-.815)/.13))),control={x:source.x+(target.x-source.x)*.55,y:source.y+(target.y-source.y)*.09};
  const phase=ready?'ready':!brewing?'idle':p<.16?'lifting':p<FLOW.start?'tilting':p<FLOW.end?'pouring':p<.82?'draining':'returning';
  const labels={idle:'先选一份茶叶。',lifting:'提起茶壶',tilting:'缓缓倾壶',pouring:'细流注入杯中',draining:'收住水流，等最后几滴落下',returning:'轻轻放回茶壶',ready:'红茶泡好了。'};
  return {progress:p,phase,label:labels[phase],pot,source,control,target,cup,flow,front:ease((p-FLOW.start)/FLOW.flight),fill:ready?1:pouredAt(p-FLOW.flight),impact:brewing?impact:0,steam:ready?1:pouredAt(p-FLOW.flight)*.9,droplets};
}
export function cupPlacement(origin,mouth,width,{travel=0,tilt=0}={}){
  // The contact point on the rim remains against the lips during rotation.
  const angle=-.16*tilt,c=Math.cos(angle),s=Math.sin(angle),dx=width*.20,dy=width*.025;
  const x=mouth.x+dx*c-dy*s,y=mouth.y+dx*s+dy*c;
  return {x:mix(origin.x,x,travel),y:mix(origin.y,y,travel)-Math.sin(Math.PI*travel)*mouth.face.width*.15,angle};
}
