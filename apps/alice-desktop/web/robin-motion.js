export const DURATION=14;
const clamp=x=>Math.max(0,Math.min(1,x));
export const ease=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
const mix=(a,b,t)=>a+(b-a)*t;
function curve(p,t){const a=1-t;return {x:a*a*a*p[0].x+3*a*a*t*p[1].x+3*a*t*t*p[2].x+t*t*t*p[3].x,y:a*a*a*p[0].y+3*a*a*t*p[1].y+3*a*t*t*p[2].y+t*t*t*p[3].y};}
// The original approved flight, rescaled to the current pet rather than 1280 px.
export function robinPose(time,anchor,unit,width){
  const t=Math.max(0,Math.min(DURATION,time)),rest={x:anchor.x,y:anchor.y-unit*.76};
  const flightIn=ease((t-1.2)/.25)*(1-ease((t-5.05)/.65)),flightOut=ease((t-10.3)/.8),flight=Math.max(flightIn,flightOut);
  let phase='待机',x=rest.x,y=rest.y,visible=t>=1.2&&t<13.5,contact=0,tilt=0;
  if(t<4.65){phase='飞来';const q=ease((t-1.2)/3.45),p=curve([{x:-unit*2.4,y:rest.y+unit*.35},{x:Math.max(unit,rest.x-unit*3),y:rest.y-unit*.82},{x:rest.x-unit*2.1,y:rest.y-unit*1.06},{x:rest.x-unit*.14,y:rest.y-unit*.21}],q);x=p.x;y=p.y;tilt=-.09+Math.sin(t*2)*.035;}
  else if(t<5.6){phase='落下收翅';const p=ease((t-4.65)/.95);x=rest.x-unit*.14*(1-p);y=rest.y-unit*.21*(1-p);contact=ease((t-5.22)/.30);tilt=-.035*(1-p);}
  else if(t<10.3){phase='停栖';contact=1;const a=ease((t-5.6)/.7)*ease((10.3-t)/.6);y=rest.y+Math.sin((t-5.6)*2.3)*unit*.008*a;tilt=Math.sin((t-5.6)*1.3)*.025*a;}
  else if(t<10.9){phase='起飞';const p=ease((t-10.3)/.6);contact=1-ease((t-10.62)/.26);y=rest.y+Math.sin(p*Math.PI)*unit*.035-p**3*unit*.14;tilt=.04*Math.sin(p*Math.PI);}
  else{phase='离开';const p=ease((t-10.9)/2.6),point=curve([{x:rest.x,y:rest.y-unit*.14},{x:rest.x+unit*1.8,y:Math.max(unit,rest.y-unit*3)},{x:width-unit*2,y:unit*.7},{x:width+unit*2.5,y:unit}],p);x=point.x;y=point.y;tilt=.045;}
  const legs=ease((t-4.15)/1.08)*(1-ease((t-10.88)/.5)),flap=Math.sin(t*Math.PI*2*5.5);
  return {time:t,phase,visible,x,y,unit,contact,legs,flight,wing:.35+flight*(-1.36+flap*1.18),tilt,tail:.05+flight*.18*Math.sin(t*7),direction:-1};
}
export function interruptedPose(from,elapsed,width){const p=ease(elapsed/1.05);return {...from,phase:'让开',visible:elapsed<1.05,x:mix(from.x,width+from.unit*2.5,p),y:mix(from.y,Math.max(from.unit,from.y-from.unit*2.4),p),contact:0,flight:1,legs:1-p,wing:.35-1.36+Math.sin(elapsed*Math.PI*11)*1.18,tilt:from.tilt*(1-p)};}
