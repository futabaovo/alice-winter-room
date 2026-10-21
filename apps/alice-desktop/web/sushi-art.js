export const SUSHI_TYPES=[
  {id:'salmon',name:'三文鱼握寿司',short:'三文鱼',ja:'サーモン',bites:2,size:1,description:'柔和的橙色纹理，分两口慢慢尝。'},
  {id:'tuna',name:'金枪鱼握寿司',short:'金枪鱼',ja:'まぐろ',bites:2,size:1,description:'深红鱼肉与细腻光泽，分两口进食。'},
  {id:'shrimp',name:'鲜虾握寿司',short:'鲜虾',ja:'海老',bites:2,size:1.06,description:'粉白虾身与扇形虾尾，咬下后稍作咀嚼。'},
  {id:'egg',name:'玉子握寿司',short:'玉子',ja:'玉子',bites:2,size:.95,description:'金黄玉子烧、海苔束带，分两口尝。'},
  {id:'roe',name:'鱼籽军舰',short:'鱼籽',ja:'いくら',bites:1,size:.82,description:'海苔围边和晶亮鱼籽，小份一口。'},
  {id:'maki',name:'海苔细卷',short:'细卷',ja:'海苔巻き',bites:1,size:.72,description:'能看到米饭、黄瓜和鱼肉的切面，一口后轻轻咀嚼。'}
];
export const sushiType=id=>SUSHI_TYPES.find(s=>s.id===id)||SUSHI_TYPES[0];
const ellipse=(c,x,y,rx,ry)=>{c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);};
function rice(c){const g=c.createLinearGradient(0,-9,0,25);g.addColorStop(0,'#fffdf2');g.addColorStop(1,'#cdc5b6');c.fillStyle=g;c.strokeStyle='#958678';c.lineWidth=1.2;c.beginPath();c.roundRect(-43,-8,86,34,[12,12,16,16]);c.fill();c.stroke();for(let i=0;i<42;i++){const x=-35+(i*23%72),y=-1+(i*11%22);c.strokeStyle=i%3?'#fffdf3':'#bdb5a6';c.lineWidth=1.8;ellipse(c,x,y,3,1.2);c.stroke();}}
function seaweed(c){const g=c.createLinearGradient(-40,-7,40,28);g.addColorStop(0,'#1c3027');g.addColorStop(.5,'#394537');g.addColorStop(1,'#14231d');c.fillStyle=g;c.strokeStyle='#0e1c17';c.lineWidth=1.4;c.beginPath();c.roundRect(-42,-14,84,43,12);c.fill();c.stroke();c.strokeStyle='#7d82604d';for(let x=-36;x<40;x+=7){c.beginPath();c.moveTo(x,-10);c.lineTo(x+2,23);c.stroke();}}
export function paintSushi(c,x,y,width,consumed=0,angle=-.06,alpha=1,type='salmon'){
  if(consumed>=.999||alpha<=0)return;c.save();c.translate(x,y);c.rotate(angle);c.scale(width/100,width/100);c.globalAlpha=alpha;
  // Rounded tooth impressions replace the old straight rectangular wipe.
  const edge=-55+consumed*110;c.beginPath();c.moveTo(edge,-42);c.lineTo(57,-42);c.lineTo(57,42);c.lineTo(edge,42);for(let k=3;k>=0;k--){const by=-42+k*21;c.bezierCurveTo(edge-5,by+18,edge+6,by+10,edge,by);}c.closePath();c.clip();
  c.fillStyle='#1b122928';ellipse(c,1,29,45,6);c.fill();
  if(type==='maki'||type==='roe'){
    seaweed(c);ellipse(c,0,-10,40,18);c.fillStyle='#f3ebd8';c.fill();c.strokeStyle='#11261b';c.lineWidth=4;c.stroke();
    if(type==='maki'){for(let i=0;i<26;i++){const a=i*2.4,r=10+i%6*3;c.fillStyle='#fffdf0';ellipse(c,Math.cos(a)*r,Math.sin(a)*r*.42-10,2.5,1.4);c.fill();}c.fillStyle='#456e3c';c.fillRect(-16,-16,13,12);c.fillStyle='#dc8c67';ellipse(c,7,-10,12,8);c.fill();c.fillStyle='#d1d798';c.fillRect(-12,-12,6,7);}
    else{for(let i=0;i<30;i++){const a=i*2.399,r=Math.sqrt((i+.5)/30)*33,xx=Math.cos(a)*r,yy=-11+Math.sin(a)*r*.44;const g=c.createRadialGradient(xx-1,yy-2,0,xx,yy,6);g.addColorStop(0,'#ffd29b');g.addColorStop(.4,'#ed9348');g.addColorStop(1,'#af4528');c.fillStyle=g;ellipse(c,xx,yy,5.6,4.4);c.fill();c.fillStyle='#ffdebba6';ellipse(c,xx-1,yy-1.6,1.4,.9);c.fill();}}
  }else{
    rice(c);
    if(type==='egg'){const g=c.createLinearGradient(0,-25,0,5);g.addColorStop(0,'#ffdf7b');g.addColorStop(1,'#d5a13f');c.fillStyle=g;c.strokeStyle='#ac7c36';c.beginPath();c.roundRect(-45,-26,90,29,6);c.fill();c.stroke();c.strokeStyle='#f5c864';for(let y=-17;y<0;y+=5){c.beginPath();c.moveTo(-40,y);c.lineTo(40,y+1);c.stroke();}c.fillStyle='#26382a';c.fillRect(-8,-27,16,48);c.fillStyle='#60704d77';c.fillRect(-6,-25,3,42);}
    else if(type==='shrimp'){c.fillStyle='#f1c2a2';c.strokeStyle='#c08069';c.beginPath();c.moveTo(-45,-7);c.bezierCurveTo(-39,-38,23,-32,39,-9);c.lineTo(43,4);c.quadraticCurveTo(0,-6,-44,5);c.closePath();c.fill();c.stroke();for(let i=0;i<6;i++){c.fillStyle=i%2?'#fff2db':'#df9d82';c.beginPath();c.ellipse(-32+i*12,-12-i%2*3,5,14,-.3,0,Math.PI);c.fill();}c.fillStyle='#d76f5d';c.beginPath();c.moveTo(38,-8);c.lineTo(55,-20);c.lineTo(52,-3);c.lineTo(57,9);c.lineTo(38,3);c.closePath();c.fill();}
    else{const tuna=type==='tuna',g=c.createLinearGradient(0,-28,0,8);g.addColorStop(0,tuna?'#da6f79':'#f0ae87');g.addColorStop(.55,tuna?'#b64556':'#df8568');g.addColorStop(1,tuna?'#87313e':'#b76252');c.fillStyle=g;c.strokeStyle=tuna?'#842f40':'#a16b56';c.beginPath();c.moveTo(-49,-12);c.bezierCurveTo(-43,-35,29,-34,49,-12);c.lineTo(45,3);c.quadraticCurveTo(0,-9,-45,4);c.closePath();c.fill();c.stroke();c.save();c.clip();c.strokeStyle=tuna?'#ec9aa17d':'#fbd6b2c7';c.lineWidth=tuna?1.6:3;for(let i=-55;i<60;i+=tuna?11:16){c.beginPath();c.moveTo(i,-30);c.bezierCurveTo(i+7,-21,i+10,-12,i+18,5);c.stroke();}c.restore();}
  }
  c.restore();
}
export function paintChopsticks(c,x,y,width,alpha=1){c.save();c.globalAlpha=alpha;c.lineCap='round';for(const [dy,tilt]of [[1,.36],[7,.45]]){c.strokeStyle='#71503a';c.lineWidth=Math.max(1,width*.047);c.beginPath();c.moveTo(x+width*.27,y+dy*width/100);c.lineTo(x+width*2.9,y+width*tilt);c.stroke();c.strokeStyle='#e0bd80';c.lineWidth=Math.max(.6,width*.023);c.beginPath();c.moveTo(x+width*.28,y+(dy-1)*width/100);c.lineTo(x+width*2.88,y+width*tilt-1);c.stroke();}c.restore();}
