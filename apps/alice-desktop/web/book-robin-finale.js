// Full-body poses keep the gloves, sleeves, bird and book connected.
const clamp=n=>Math.max(0,Math.min(1,n)),ease=n=>{n=clamp(n);return n*n*(3-2*n);};
export async function loadBookFinale(){
  const image=new Image();image.src='chibi/game-finale.png';await image.decode();
  const cells=[[0,580,280],[580,1145,260],[1145,1715,270],[1715,2172,240]];
  return {image,draw(g,index,x,bottom,height=365,angle=0){
    const [left,right,pivot]=cells[index],scale=height/680;
    g.save();g.translate(x,bottom);g.rotate(angle);g.drawImage(image,left,0,right-left,724,-pivot*scale,-680*scale,(right-left)*scale,724*scale);g.restore();
  }};
}
export function finaleDialogue(f){
  if(!f)return {speaker:'',text:''};
  if(f.stage==='taunt')return {speaker:'Robin',text:f.robinLine};
  if(f.stage==='grab')return {speaker:'Robin',text:'欸？等、等一下，Alice-sama！'};
  if(f.stage==='windup'||f.stage==='strike')return {speaker:'有珠',text:'……吵死了。'};
  if(f.stage==='fly')return {speaker:'Robin',text:'My angel——！！'};
  if(f.stage==='impact'||f.stage==='slide')return {speaker:'Robin',text:'……我、我会安静的。'};
  return {speaker:'有珠',text:f.aliceLine};
}
export function paintBookFinale(g,s,{poses,bird,figure,label,pill,reducedMotion=false}){
  const f=s.finale,p=f.progress,stage=f.stage;
  const bg=g.createLinearGradient(0,0,980,560);bg.addColorStop(0,'#ded0e5');bg.addColorStop(.5,'#f9efdd');bg.addColorStop(1,'#d4bbcf');g.fillStyle=bg;g.fillRect(0,0,980,560);
  g.save();
  if(stage==='impact'&&!reducedMotion){const amount=8*(1-p);g.translate(Math.sin(p*57)*amount,Math.cos(p*43)*amount*.6);}
  // All camera motion is contained in the game canvas, never the desktop window.
  g.fillStyle='#b59eaa';g.fillRect(0,422,980,138);g.fillStyle='#cdb6bc';g.fillRect(0,424,980,5);
  for(let i=0;i<9;i++){g.strokeStyle='#ad919f66';g.beginPath();g.moveTo(490+(i-4)*60,428);g.lineTo(490+(i-4)*180,560);g.stroke();}
  g.fillStyle='#a18f9d22';g.beginPath();g.ellipse(390,485,126,18,0,0,Math.PI*2);g.fill();
  const birdAt=(x,y,size,angle=0,squash=1)=>{g.save();g.translate(x,y);g.rotate(angle);g.scale(1,squash);g.drawImage(bird,49,41,446,491,-size/2,-size*.55,size,size*1.1);g.restore();};
  label('THE LAST WORD',490,39,13,'#997e96');label('本局 '+s.score+' 分 · '+s.difficultyLabel,490,72,20,'#65506c');
  if(stage==='taunt'){
    figure(365,485,330,8,-.015);
    const laugh=f.tier==='low',bounce=reducedMotion?0:Math.sin(f.elapsed*(laugh?18:7))*(laugh?9:3);
    birdAt(626,337+bounce,125,laugh?Math.sin(f.elapsed*16)*.09:0);
    if(laugh){label('哈  哈  哈！',637,239,27,'#7c6396');label('♪',737,287,29,'#b498c9');}
  }else if(stage==='grab'){
    // Draw the caught bird as part of the pose, rather than a floating overlay.
    poses.draw(g,0,365+ease(p)*25,485-ease(p)*8,365,-.025*(1-p));
    if(p<.4)pill('？！',595,254,70);
  }else if(stage==='windup'){
    poses.draw(g,1,390,477,365,-Math.sin(p*Math.PI)*.035);
    label('……',281,141,25,'#756381');
  }else if(stage==='strike'){
    poses.draw(g,p<.27?1:2,390+Math.sin(p*Math.PI)*9,477,365,p<.27?0:.025);
    if(p>=.27){
      birdAt(510,310,76,.2+p*.4);
      g.strokeStyle='#fffaf0';g.lineWidth=13;g.beginPath();g.arc(390,300,145,-2.5,.3);g.stroke();
      g.strokeStyle='#d8af69';g.lineWidth=4;g.beginPath();g.arc(390,300,156,-2.5,.3);g.stroke();
      label('啪！',543,248,40,'#725374');
    }
  }else if(stage==='fly'){
    poses.draw(g,2,390,477,365,.025);
    const q=p*p,x=510+q*125,y=310-q*32,size=76+q*(reducedMotion?150:260);
    for(let i=0;i<14;i++){const a=i*Math.PI*2/14;g.strokeStyle='#fff9eda0';g.lineWidth=2+i%3;g.beginPath();g.moveTo(x+Math.cos(a)*size*.65,y+Math.sin(a)*size*.55);g.lineTo(x+Math.cos(a)*(size*.8+q*90),y+Math.sin(a)*(size*.75+q*55));g.stroke();}
    birdAt(x,y,size,.8*Math.sin(p*Math.PI));
  }else if(stage==='impact'||stage==='slide'){
    poses.draw(g,3,365,477,365);
    const slide=stage==='slide'?ease(p):0,y=278+slide*470,size=reducedMotion?226:336;
    // Squash at contact, hold, then drag down the glass. A local glass ring and
    // streaks sell the screen plane without pretending the user's screen broke.
    g.save();g.globalAlpha=1-slide*.85;g.strokeStyle='#fffdf1bb';g.lineWidth=5;g.beginPath();g.ellipse(635,278,size*.65,size*.45,0,0,Math.PI*2);g.stroke();
    for(let i=0;i<3;i++){g.strokeStyle='#faf9ed88';g.lineWidth=3-i*.7;g.beginPath();g.moveTo(550+i*71,321);g.lineTo(550+i*71,Math.min(550,y+60));g.stroke();}g.restore();
    birdAt(635,y,size,stage==='slide'?p*.12:Math.sin(p*13)*.015,stage==='impact'?.8+Math.min(1,p*2)*.07:.87);
    if(stage==='impact'){label('咚！',805,190,55,'#71547b');
      for(let i=0;i<5;i++){const a=i*1.25+p*2;label('✦',635+Math.cos(a)*206,278+Math.sin(a)*153,20,'#b69a55');}
    }
  }else{
    poses.draw(g,3,365,477,365);pill('终于安静了。',643,302,220);
    if(stage==='result'){label('最高 '+s.maxCombo+' 连击',640,365,18,'#836882');label('选择难度，再来一局。',640,398,14,'#9e849a');}
  }
  g.restore();
  const line=finaleDialogue(f);g.fillStyle='#30273be8';g.beginPath();g.roundRect(40,493,900,55,14);g.fill();
  label(line.speaker,67,527,15,'#ddbd7e','left');label(line.text,150,527,18,'#f7ecdf','left');
}
