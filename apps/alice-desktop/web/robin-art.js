import {ease} from './robin-motion.js';
let atlas,image,flightImage;
export async function loadRobinArt(){
  const r=await fetch('robin/atlas.json');if(!r.ok)throw Error('Robin 分层目录缺失。');atlas=await r.json();
  image=new Image();flightImage=new Image();image.src='robin/'+atlas.image;flightImage.src='robin/'+atlas.flightImage;await Promise.all([image.decode(),flightImage.decode()]);
}
const localPoint=(pose,x,y)=>({x:pose.x+Math.cos(pose.tilt)*x*pose.direction-Math.sin(pose.tilt)*y,y:pose.y+Math.sin(pose.tilt)*x*pose.direction+Math.cos(pose.tilt)*y});
const blend=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
function sprite(target,name,x,y,scale,angle=0,scaleX=1){const part=atlas.parts[name],r=part.rect,p=part.pivot;target.save();target.translate(x,y);target.rotate(angle);target.scale(scale*scaleX,scale);target.drawImage(part.sheet==='flight'?flightImage:image,...r,r[0]-p[0],r[1]-p[1],r[2],r[3]);target.restore();}
function leg(target,name,root,toe,direction){const part=atlas.parts[name],r=part.rect,a=part.root,b=part.toe,source=Math.hypot(b[0]-a[0],b[1]-a[1]),length=Math.hypot(toe.x-root.x,toe.y-root.y);target.save();target.translate(root.x,root.y);target.rotate(Math.atan2(toe.y-root.y,toe.x-root.x)-Math.atan2(b[1]-a[1],(b[0]-a[0])*direction));target.scale(direction*length/source,length/source);target.drawImage(image,...r,r[0]-a[0],r[1]-a[1],r[2],r[3]);target.restore();}
function wing(target,pose,near){const u=pose.unit,folded=ease(1-pose.flight),full=ease((pose.flight-.45)/.55),half=Math.max(0,1-folded-full),x=near?.21*u:-.05*u,y=near?-.25*u:-.22*u,angle=pose.wing-(near?0:.16),sx=near?.92+.08*pose.flight:.78+.18*pose.flight;for(const [name,weight,scale]of [[near?'wingNear':'wingFar',folded,.00128],[near?'brakeNear':'brakeFar',half,.00122],[near?'flightNear':'flightFar',full,.00116]])if(weight>.001){target.save();target.globalAlpha=weight;sprite(target,name,x,y,u*scale,angle,sx);target.restore();}}
export function paintBird(target,pose,feet){
  if(!pose.visible)return;
  const u=pose.unit,partScale=u/446;
  const toes=[],roots=[];
  for(const [i,x]of [-.13,.17].entries()){
    const root=localPoint(pose,x*u,.40*u),free=localPoint(pose,(x-.05)*u,(.58+.18*pose.legs)*u),toe=blend(free,feet[i],pose.contact);roots.push(root);toes.push(toe);
  }
  target.save();target.translate(pose.x,pose.y);target.rotate(pose.tilt);target.scale(pose.direction,1);
  wing(target,pose,false);
  sprite(target,'tail',.30*u,.25*u,u*.00120,.13+pose.tail);
  target.restore();
  leg(target,'legFar',roots[0],toes[0],pose.direction);leg(target,'legNear',roots[1],toes[1],pose.direction);
  target.save();target.translate(pose.x,pose.y);target.rotate(pose.tilt);target.scale(pose.direction,1);
  sprite(target,'body',0,0,partScale);
  if((pose.mouth||0)>.03){
    // Small lower-beak motion at the existing beak root, measured in atlas pixels.
    target.save();target.scale(partScale,partScale);target.fillStyle='#13171e';target.strokeStyle='#0c1017';target.lineWidth=2;
    target.beginPath();target.moveTo(-79,-100);target.quadraticCurveTo(-128,-88+pose.mouth*25,-187,-108);target.quadraticCurveTo(-144,-97+pose.mouth*32,-112,-92+pose.mouth*20);target.closePath();target.fill();target.stroke();target.restore();
  }
  wing(target,pose,true);
  target.restore();pose.roots=roots;pose.toes=toes;
}

