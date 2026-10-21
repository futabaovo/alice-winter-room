import {brewingPose,clamp} from './tea-animation.js';
// Silver-grey, faintly lilac tea service, following the supplied tray reference.
const dark='#55515f',edge='#85808e',shine='#dedbe6';
function ellipse(ctx,x,y,rx,ry,angle=0){ctx.beginPath();ctx.ellipse(x,y,rx,ry,angle,0,Math.PI*2);}
function silver(ctx,x1,y1,x2,y2){const g=ctx.createLinearGradient(x1,y1,x2,y2);for(const [p,c]of [[0,'#767181'],[.22,'#c1bbc9'],[.42,'#e1dce5'],[.64,'#b4aebe'],[1,'#817a8e']])g.addColorStop(p,c);return g;}
function steam(ctx,x,y,width,amount,time,alpha){
  ctx.save();ctx.translate(x,y);ctx.scale(width,width);ctx.lineCap='round';ctx.lineWidth=.014;ctx.strokeStyle='#ddd8eb';
  for(let i=0;i<5;i++){
    const p=((time*.31+i*.217)%1+1)%1,base=(i%3-1)*.17+Math.sin(time*.65+i)*.045,bottom=-.12-p*.65,drift=Math.sin(time*.8+i)*.09;
    ctx.globalAlpha=alpha*amount*.18*Math.sin(Math.PI*p)**1.3;ctx.beginPath();ctx.moveTo(base,bottom);ctx.bezierCurveTo(base-.06+drift,bottom-.11,base+.09+drift,bottom-.22,base+drift*.7,bottom-.34);ctx.stroke();
  }
  ctx.restore();
}
export function paintCup(ctx,x,y,width,{fill=1,tilt=0,alpha=1,steam:heat=1,time=0,saucer=false,ripple=0}={}){
  fill=clamp(fill);alpha=clamp(alpha);ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.scale(width,width);ctx.globalAlpha=alpha;
  if(saucer){ctx.fillStyle=silver(ctx,-.7,.55,.65,.82);ctx.strokeStyle=dark;ctx.lineWidth=.018;ellipse(ctx,0,.70,.76,.14);ctx.fill();ctx.stroke();ctx.strokeStyle=shine;ctx.lineWidth=.010;ellipse(ctx,0,.68,.72,.118);ctx.stroke();ctx.strokeStyle=edge;ellipse(ctx,0,.70,.50,.075);ctx.stroke();}
  ctx.lineWidth=.07;ctx.strokeStyle=dark;ellipse(ctx,.49,.25,.18,.215,-.17);ctx.stroke();ctx.lineWidth=.034;ctx.strokeStyle='#bbb5c5';ctx.beginPath();ctx.ellipse(.49,.25,.18,.215,-.17,-1.7,2);ctx.stroke();ctx.lineWidth=.012;ctx.strokeStyle=shine;ctx.beginPath();ctx.ellipse(.49,.25,.18,.215,-.17,-1.7,1.3);ctx.stroke();
  ctx.fillStyle=silver(ctx,-.49,.05,.49,.23);ctx.strokeStyle=dark;ctx.lineWidth=.013;
  ctx.beginPath();ctx.moveTo(-.49,0);ctx.bezierCurveTo(-.48,.42,-.28,.59,0,.60);ctx.bezierCurveTo(.28,.59,.48,.42,.49,0);ctx.closePath();ctx.fill();ctx.stroke();
  // Shallow fluting and narrow dark bands, without a gold rim or modern emblem.
  ctx.strokeStyle='#777181';ctx.lineWidth=.009;ctx.globalAlpha=alpha*.37;
  for(const n of [-2,-1,0,1,2]){ctx.beginPath();ctx.moveTo(n*.145,.19);ctx.quadraticCurveTo(n*.14,.37,n*.09,.53);ctx.stroke();}
  ctx.globalAlpha=alpha;ctx.fillStyle='#c6becf';ellipse(ctx,0,0,.49,.143);ctx.fill();ctx.strokeStyle=dark;ctx.lineWidth=.020;ctx.stroke();ctx.strokeStyle='#ddd5e4';ctx.lineWidth=.008;ellipse(ctx,0,-.004,.475,.133);ctx.stroke();
  ctx.save();ellipse(ctx,0,.003,.438,.107);ctx.clip();const inside=ctx.createLinearGradient(0,-.1,0,.13);inside.addColorStop(0,'#6e6277');inside.addColorStop(1,'#bdb2c6');ctx.fillStyle=inside;ctx.fillRect(-.5,-.15,1,.35);
  // Counter-rotation keeps the free surface level while the cup moves at the lips.
  ctx.rotate(-tilt);const level=.19*(1-fill)+.003,rx=.44-.04*(1-fill);
  if(fill>.002){const tea=ctx.createLinearGradient(0,level-.1,0,level+.1);tea.addColorStop(0,'#48272c');tea.addColorStop(.5,'#774039');tea.addColorStop(1,'#a26046');ctx.fillStyle=tea;ellipse(ctx,0,level,rx,.102);ctx.fill();ctx.strokeStyle='#d3a68c';ctx.lineWidth=.008;ctx.globalAlpha=alpha*.42;ctx.beginPath();ctx.ellipse(-.025,level-.011,rx*.79,.060,0,Math.PI*1.03,Math.PI*1.82);ctx.stroke();ctx.globalAlpha=alpha;
    for(let i=0;i<3;i++){const p=((time*1.8+i/3)%1+1)%1;ctx.globalAlpha=alpha*ripple*(1-p)*.38;ctx.strokeStyle='#dfb8a0';ctx.lineWidth=.010;ellipse(ctx,-.065,level+.003,.025+p*.38,.009+p*.078);ctx.stroke();}
  }
  ctx.restore();ctx.globalAlpha=alpha;ctx.strokeStyle='#e0d8e8';ctx.lineWidth=.014;ctx.beginPath();ctx.ellipse(0,0,.475,.13,0,0,Math.PI);ctx.stroke();
  ctx.strokeStyle=dark;ctx.lineWidth=.012;ctx.beginPath();ctx.moveTo(-.30,.45);ctx.quadraticCurveTo(0,.54,.30,.45);ctx.stroke();ctx.strokeStyle='#d9d2e2';ctx.lineWidth=.009;ctx.beginPath();ctx.moveTo(-.28,.47);ctx.quadraticCurveTo(0,.55,.28,.47);ctx.stroke();ctx.fillStyle=silver(ctx,-.2,.57,.2,.67);ellipse(ctx,0,.60,.17,.045);ctx.fill();ellipse(ctx,0,.65,.23,.036);ctx.fill();ctx.strokeStyle=dark;ctx.stroke();ctx.restore();
  if(heat>0&&alpha>0)steam(ctx,x,y,width,heat,time,alpha);
}
function paintPot(ctx,pot){
  ctx.save();ctx.translate(pot.x,pot.y);ctx.rotate(pot.angle);
  ctx.strokeStyle=dark;ctx.lineWidth=7;ellipse(ctx,-53,2,19,27,-.2);ctx.stroke();ctx.strokeStyle='#b6b0c1';ctx.lineWidth=3.5;ellipse(ctx,-53,2,19,27,-.2);ctx.stroke();ctx.strokeStyle=shine;ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(-53,2,19,27,-.2,1.4,4.6);ctx.stroke();
  ctx.fillStyle=silver(ctx,-48,-15,48,26);ctx.strokeStyle=dark;ctx.lineWidth=1.2;
  ctx.beginPath();ctx.moveTo(-26,-23);ctx.bezierCurveTo(-31,-17,-50,-9,-49,11);ctx.bezierCurveTo(-48,39,-27,53,0,53);ctx.bezierCurveTo(27,53,48,39,49,11);ctx.bezierCurveTo(50,-9,31,-17,26,-23);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.save();ctx.globalAlpha=.26;ctx.strokeStyle='#5c546c';ctx.lineWidth=1;for(const n of [-2,-1,1,2]){ctx.beginPath();ctx.moveTo(n*10,-13);ctx.bezierCurveTo(n*19,7,n*17,29,n*9,45);ctx.stroke();}ctx.restore();
  ctx.beginPath();ctx.moveTo(35,-1);ctx.quadraticCurveTo(61,-10,78,-39);ctx.lineTo(90,-33);ctx.quadraticCurveTo(81,20,41,28);ctx.closePath();ctx.fill();ctx.stroke();ctx.strokeStyle='#d6cedf';ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(45,0);ctx.quadraticCurveTo(63,-11,79,-35);ctx.stroke();
  ctx.fillStyle='#49434f';ellipse(ctx,86,-32,5.2,2.7,.48);ctx.fill();ctx.strokeStyle='#b8afc4';ctx.lineWidth=1.3;ctx.stroke();
  ctx.fillStyle=silver(ctx,-24,48,24,57);ellipse(ctx,0,53,24,4.5);ctx.fill();ctx.strokeStyle=dark;ctx.lineWidth=1;ctx.stroke();
  for(const [y,rx,ry]of [[-21,27,7],[-26,29,7.5]]){ctx.strokeStyle=dark;ctx.lineWidth=2.8;ellipse(ctx,0,y,rx,ry);ctx.stroke();ctx.strokeStyle='#b8b1c4';ctx.lineWidth=.8;ctx.beginPath();ctx.ellipse(0,y-1,rx,ry,0,0,Math.PI);ctx.stroke();}
  ctx.fillStyle=silver(ctx,-30,-39,30,-27);ellipse(ctx,0,-31,34,8);ctx.fill();ctx.strokeStyle=dark;ctx.lineWidth=1.5;ctx.stroke();ctx.beginPath();ctx.moveTo(-31,-32);ctx.quadraticCurveTo(-6,-50,29,-32);ctx.fill();ctx.stroke();ctx.fillStyle=silver(ctx,-5,-49,5,-36);ellipse(ctx,0,-43,5.5,7);ctx.fill();ctx.strokeStyle=edge;ctx.lineWidth=.8;ctx.stroke();ctx.restore();
}
function paintTray(ctx){
  ctx.save();ctx.fillStyle='rgba(8,7,14,.23)';ellipse(ctx,0,76,217,14);ctx.fill();
  const outline=()=>{ctx.beginPath();ctx.moveTo(-192,45);ctx.lineTo(-161,34);ctx.quadraticCurveTo(-140,42,-125,38);ctx.lineTo(137,38);ctx.quadraticCurveTo(161,42,186,38);ctx.lineTo(211,58);ctx.lineTo(192,81);ctx.quadraticCurveTo(156,77,130,87);ctx.lineTo(-131,87);ctx.quadraticCurveTo(-157,78,-188,83);ctx.lineTo(-213,65);ctx.closePath();};
  outline();ctx.fillStyle=silver(ctx,-190,37,170,98);ctx.fill();ctx.strokeStyle=dark;ctx.lineWidth=2;ctx.stroke();ctx.save();ctx.translate(0,3);ctx.scale(.974,.88);outline();ctx.strokeStyle='#d1cadc';ctx.lineWidth=.8;ctx.stroke();ctx.restore();
  // A pale scalloped cloth leaves the rim and little handles visible.
  ctx.beginPath();ctx.moveTo(-160,43);ctx.bezierCurveTo(-143,39,-134,44,-120,42);ctx.lineTo(130,42);ctx.bezierCurveTo(142,41,158,41,161,47);ctx.bezierCurveTo(176,48,164,55,174,60);ctx.bezierCurveTo(179,64,168,69,169,75);ctx.bezierCurveTo(154,74,155,82,133,80);ctx.lineTo(-125,80);ctx.bezierCurveTo(-147,86,-148,76,-167,77);ctx.bezierCurveTo(-169,71,-177,67,-169,62);ctx.bezierCurveTo(-179,55,-163,53,-168,48);ctx.closePath();ctx.fillStyle='#b8b0c7';ctx.fill();ctx.strokeStyle='#cfc7dc';ctx.lineWidth=1.3;ctx.stroke();
  ctx.save();ctx.translate(-139,70);ctx.scale(1,.5);ctx.globalAlpha=.55;for(const [x,y]of [[0,0],[14,5],[-9,10]]){ctx.fillStyle='#807292';for(let n=0;n<5;n++){const a=n*Math.PI*2/5;ellipse(ctx,x+Math.cos(a)*4,y+Math.sin(a)*4,3,1.7,a);ctx.fill();}ctx.fillStyle='#aa98ba';ellipse(ctx,x,y,1.5,1.5);ctx.fill();}ctx.restore();ctx.restore();
}
function paintMilk(ctx){
  ctx.save();ctx.translate(-53,50);ctx.scale(.53,.53);ctx.strokeStyle=dark;ctx.lineWidth=5;ellipse(ctx,-23,11,10,17,-.2);ctx.stroke();ctx.strokeStyle='#b7afc3';ctx.lineWidth=2.5;ctx.stroke();ctx.fillStyle=silver(ctx,-24,-10,24,32);ctx.lineWidth=1.3;ctx.strokeStyle=dark;
  ctx.beginPath();ctx.moveTo(-19,-13);ctx.bezierCurveTo(-11,-7,-28,3,-23,21);ctx.bezierCurveTo(-22,42,20,44,21,21);ctx.quadraticCurveTo(21,7,17,-6);ctx.lineTo(26,-18);ctx.quadraticCurveTo(5,-10,-19,-13);ctx.closePath();ctx.fill();ctx.stroke();ctx.fillStyle='#80738e';ellipse(ctx,0,-11,17,4);ctx.fill();ctx.strokeStyle='#d9d1e3';ctx.stroke();ctx.restore();
}
function paintSugar(ctx){
  ctx.save();ctx.translate(-4,48);ctx.scale(.65,.65);ctx.lineWidth=3;ctx.strokeStyle=dark;for(const x of [-27,27]){ellipse(ctx,x,10,8,12,x<0?-.4:.4);ctx.stroke();}ctx.fillStyle=silver(ctx,-27,-7,27,30);ctx.lineWidth=1.2;
  ctx.beginPath();ctx.moveTo(-26,-2);ctx.bezierCurveTo(-25,23,-18,34,0,34);ctx.bezierCurveTo(18,34,25,23,26,-2);ctx.closePath();ctx.fill();ctx.stroke();ellipse(ctx,0,-3,28,8);ctx.fill();ctx.stroke();ctx.beginPath();ctx.moveTo(-24,-5);ctx.quadraticCurveTo(0,-31,24,-5);ctx.closePath();ctx.fill();ctx.stroke();ellipse(ctx,0,-18,4.2,5);ctx.fill();ctx.stroke();ctx.strokeStyle='#cfc7db';ctx.beginPath();ctx.ellipse(0,-1,25,7,0,0,Math.PI);ctx.stroke();ctx.restore();
}
function paintSpoons(ctx){
  ctx.save();ctx.strokeStyle='#6c6479';ctx.lineCap='round';for(const offset of [0,7]){ctx.lineWidth=2.3;ctx.beginPath();ctx.moveTo(-15+offset,76);ctx.lineTo(22+offset,83);ctx.stroke();ctx.fillStyle=silver(ctx,-25,72,-13,79);ellipse(ctx,-21+offset,75,7,2.6,.15);ctx.fill();ctx.lineWidth=.7;ctx.stroke();ctx.strokeStyle='#d0c7df';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(-15+offset,75.5);ctx.lineTo(22+offset,82.5);ctx.stroke();ctx.strokeStyle='#6c6479';}ctx.restore();
}
export function paintBrewing(ctx,width,height,{progress=0,time=0,ready=false,brewing=progress>0&&!ready}={}){
  const pose=brewingPose(progress,{ready,brewing});ctx.clearRect(0,0,width,height);const scale=Math.min(width/460,height/195);ctx.save();ctx.translate(width/2,height/2+3*scale);ctx.scale(scale,scale);
  paintTray(ctx);const lift=Math.min(1,(14-pose.pot.y)/53);ctx.fillStyle=`rgba(21,16,32,${.18-lift*.10})`;ellipse(ctx,pose.pot.x,68,48+lift*9,5+lift*3);ctx.fill();
  paintPot(ctx,pose.pot);paintMilk(ctx);paintSugar(ctx);paintSpoons(ctx);paintCup(ctx,pose.cup.x,pose.cup.y,pose.cup.width,{saucer:true,time,fill:pose.fill,steam:pose.steam,ripple:pose.impact});
  if(pose.flow>.001){
    const {source:a,target:b,control,front:f}=pose,end={x:a.x*(1-f)**2+2*control.x*f*(1-f)+b.x*f*f,y:a.y*(1-f)**2+2*control.y*f*(1-f)+b.y*f*f};
    ctx.save();ctx.globalAlpha=.94*pose.flow;ctx.lineCap='round';ctx.lineWidth=2.6*Math.sqrt(pose.flow);ctx.strokeStyle='#8e5338';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.quadraticCurveTo(a.x+(control.x-a.x)*f,a.y+(control.y-a.y)*f,end.x,end.y);ctx.stroke();ctx.lineWidth=.75*Math.sqrt(pose.flow);ctx.strokeStyle='#dca77e';ctx.stroke();ctx.restore();
  }
  for(const drop of pose.droplets){ctx.globalAlpha=drop.alpha;ctx.fillStyle='#bb7f54';ellipse(ctx,drop.x,drop.y,drop.radius*.68,drop.radius*1.35);ctx.fill();}ctx.restore();return pose;
}
