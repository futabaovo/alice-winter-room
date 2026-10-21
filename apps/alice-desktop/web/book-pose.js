import {smooth} from './pet-reaction.js';
const mix=(a,b,t)=>a+(b-a)*t;
export function bookPose(progress,face,time=0,{peek=0,direction=1}={}){
  const p=Math.max(0,Math.min(1,progress)),lift=smooth(p),hand=smooth((p-.2)/.8),u=face.width,cx=face.left+u/2,y=face.bottom;
  const point=(x,dy)=>({x:cx+x*u,y:y+dy*u});
  const book={...point(-.25,mix(2,1.3,lift)+Math.sin(time*1.2)*.008*lift),width:u*2.05,angle:mix(-6,-2,lift)*Math.PI/180};
  const cover=smooth(peek)*lift,side=direction<0?-1:1;
  book.x=mix(book.x,cx+side*u*.92,cover);book.y=mix(book.y,face.top+u*.435,cover);book.width=mix(book.width,u*2.15,cover);book.angle=mix(book.angle,side*-3*Math.PI/180,cover);
  book.height=book.width*650/1100;
  const elbowL=point(mix(-1.45,-1.4,lift),mix(3.4,2.9,lift)),elbowR=point(mix(1.45,1.05,hand),mix(3.4,2.9,hand));
  elbowL.x=mix(elbowL.x,cx+u*(side>0?-.8:-1.15),cover);elbowL.y=mix(elbowL.y,y+u*1.65,cover);
  elbowR.x=mix(elbowR.x,cx+u*(side>0?1.25:.85),cover);elbowR.y=mix(elbowR.y,y+u*1.65,cover);
  const shoulderL=point(-.95,.35),shoulderR=point(.95,.35);
  const opening=(shoulder,elbow,amount)=>{const dx=elbow.x-shoulder.x,dy=elbow.y-shoulder.y,length=Math.hypot(dx,dy),axis={x:dx/length,y:dy/length};return {x:elbow.x-axis.x*u*.16,y:elbow.y-axis.y*u*.16,rx:u*.28,ry:u*.42,axis,opacity:smooth(amount/.45)};};
  return {progress:p,lift,hand,peek:cover,direction:side,alpha:smooth(p/.18),unit:u,book,elbowL,elbowR,shoulderL,shoulderR,openings:[opening(shoulderL,elbowL,lift),opening(shoulderR,elbowR,hand)],restL:point(-1.45,3.4),restR:point(1.45,3.4)};
}
export function bookGrips(pose){
  // The forearms end at the painted sleeve boundaries, not at fingertips.
  const scale=pose.book.width/1100,angle=pose.book.angle,co=Math.cos(angle),si=Math.sin(angle);
  return [{x:275,y:980},{x:1005,y:980}].map((anchor,index)=>{
    const at=point=>{const dx=(point.x-650)*scale,dy=(point.y-485)*scale;return {x:pose.book.x+dx*co-dy*si,y:pose.book.y+dx*si+dy*co};},contact=index?{x:1120,y:650}:{x:175,y:650};
    return {scale,angle,anchor,wrist:at(anchor),palm:at(contact),contact,origin:{x:650,y:485}};
  });
}
export function capePoint(x,y,face,cape,pose){
  const u=face.width,cx=face.left+u/2,depth=smooth((y-cape.top)/cape.height),n=(x-cx)/u;
  const left=Math.exp(-(((n+1.55)/.82)**2))*depth,right=Math.exp(-(((n-1.55)/.82)**2))*depth;
  const limit=(v,a,b)=>Math.max(a,Math.min(b,v));
  return {x:x+limit(pose.elbowL.x-pose.restL.x,-u*.15,u*.15)*left+limit(pose.elbowR.x-pose.restR.x,-u*.15,u*.15)*right,y:y+limit(pose.elbowL.y-pose.restL.y,-u*.32,u*.18)*left+limit(pose.elbowR.y-pose.restR.y,-u*.32,u*.18)*right};
}
