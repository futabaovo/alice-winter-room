const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const load=name=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'web',name),'utf8')).toString('base64'));
test('注水从真实壶嘴向下落入杯口，茶汤在水流到达后持续上升，壶最后回到原位',async()=>{
  const {brewingPose,potPoint}=await load('tea-animation.js');let previous=null,streams=0,drips=0;
  for(let n=0;n<=2000;n++){
    const p=n/2000,s=brewingPose(p,{brewing:true});assert(s.fill>=0&&s.fill<=1&&s.flow>=0&&s.flow<=1);if(previous){assert(s.fill>=previous.fill-1e-12,'Tea level fell while pouring');assert(Math.hypot(s.pot.x-previous.pot.x,s.pot.y-previous.pot.y)<.9,'Pot jumped');assert(Math.abs(s.pot.angle-previous.pot.angle)<.006);}
    if(s.flow>.001){streams++;const tip=potPoint(s.pot);assert(Math.hypot(tip.x-s.source.x,tip.y-s.source.y)<1e-9);assert(s.source.y<s.control.y&&s.control.y<s.target.y,'Water arced upwards');assert(Math.abs(s.target.x-s.cup.x)<s.cup.width*.35);assert(Math.abs(s.target.y-s.cup.y)<s.cup.width*.10);}
    for(const d of s.droplets){drips++;assert(d.y<=s.target.y&&d.radius>0&&d.alpha>=0&&d.alpha<=1);}
    if(p<.305)assert.equal(s.fill,0,'Tea rose before the jet arrived');previous=s;
  }
  assert(streams>500&&drips>50);assert.deepEqual(brewingPose(0).pot,brewingPose(1,{ready:true}).pot);assert.equal(previous.fill,1);assert.equal(previous.flow,0);assert.equal(previous.droplets.length,0);
});
test('杯口接触嘴唇时倾斜不滑动，喝茶期间液面连续降低，取消保留当前液位',async()=>{
  const {cupPlacement}=await load('tea-animation.js'),{TeaMotion}=await load('tea-motion.js'),m={x:180,y:140,face:{width:70}};
  for(const width of [18,45,75])for(let n=0;n<=100;n++){const p=cupPlacement({x:300,y:300},m,width,{travel:1,tilt:n/100}),c=Math.cos(p.angle),s=Math.sin(p.angle),x=p.x-width*.20*c+width*.025*s,y=p.y-width*.20*s-width*.025*c;assert(Math.hypot(x-m.x,y-m.y)<1e-9);}
  const motion=new TeaMotion();motion.request({id:'cup'});let previous=0;
  for(let n=0;n<390;n++){const s=motion.step(1/60);if(s.phase==='idle')break;assert(s.consumed>=previous-1e-12&&s.consumed<=.36);assert(s.consumed-previous<.02,'Liquid level snapped down');previous=s.consumed;}
  assert.equal(previous,.36);const interrupted=new TeaMotion();interrupted.request({id:'cancel'});for(let n=0;n<140;n++)interrupted.step(1/60);const before=interrupted.pose();interrupted.cancel();assert.equal(interrupted.pose().consumed,before.consumed);
});
