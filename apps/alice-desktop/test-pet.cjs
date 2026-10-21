const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const load=()=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'web/pet-reaction.js'),'utf8')).toString('base64'));
test('手臂不穿过肘部，掌心承书且腕部在掌心下方，披肩可复原',async()=>{
  const reaction='data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'web/pet-reaction.js'),'utf8')).toString('base64');
  const source=fs.readFileSync(path.join(__dirname,'web/book-pose.js'),'utf8').replace("'./pet-reaction.js'",JSON.stringify(reaction));
  const {bookPose,capePoint,bookGrips}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  for(const width of [35,70,140]){
    const face={left:100,top:60,bottom:110,width},cape={top:110,height:width*3};let previous;
    for(let i=0;i<=1000;i++){
      const p=bookPose(i/1000,face,0),grips=bookGrips(p);
      for(const [index,g] of grips.entries()){
        const elbow=index?p.elbowR:p.elbowL,length=Math.hypot(g.wrist.x-elbow.x,g.wrist.y-elbow.y)/width;
        assert(length>.45&&length<1.6,'Forearm collapsed or stretched at '+i/1000);
        assert(elbow.y>g.wrist.y+width*.25,'Sleeve folds backwards above wrist');
        assert(g.wrist.y>g.palm.y+width*.2,'Wrist bent above the gripping fingers');
        const co=Math.cos(g.angle),si=Math.sin(g.angle),px=g.wrist.x+(g.contact.x-g.anchor.x)*g.scale*co-(g.contact.y-g.anchor.y)*g.scale*si,py=g.wrist.y+(g.contact.x-g.anchor.x)*g.scale*si+(g.contact.y-g.anchor.y)*g.scale*co;
        assert(Math.hypot(px-g.palm.x,py-g.palm.y)<1e-7,'Palm detached from book');
        if(previous)assert(Math.hypot(g.wrist.x-previous[index].wrist.x,g.wrist.y-previous[index].wrist.y)<width*.03);
      }
      assert(p.elbowR.y>p.shoulderR.y&&p.elbowL.y>p.shoulderL.y);
      if(p.hand>.99)assert(Math.abs(p.elbowR.x-p.shoulderR.x)<width*.25,'Raised elbow flared outside torso');
      for(const o of p.openings)assert(Object.values(o.axis).every(Number.isFinite)&&o.rx>0&&o.ry>0&&o.opacity>=0&&o.opacity<=1);
      previous=grips;
    }
    const p=bookPose(0,face),x=face.left-width*.8,y=face.bottom+width*2;
    assert.deepEqual(capePoint(x,y,face,cape,p),{x,y});
  }
});
test('举书弹簧在不同帧率下轨迹一致，反向和重复触发时位置速度连续',async()=>{const {BookReaction}=await load();const samples=[];for(const fps of [30,60,120]){const r=new BookReaction();r.trigger();for(let i=0;i<fps;i++)r.step(1/fps);samples.push(r.value);assert(r.value>.94&&r.value<1);const before={value:r.value,velocity:r.velocity};r.release();assert.equal(r.value,before.value);assert.equal(r.velocity,before.velocity);r.step(1/fps);const release=r.value;r.trigger();assert.equal(r.value,release);for(let i=0;i<fps*10;i++){const value=r.step(1/fps);assert(Number.isFinite(value.progress)&&Number.isFinite(value.velocity));assert(value.progress>=0&&value.progress<=1);}assert.equal(r.phase,'idle');assert.equal(r.value,0);}assert(Math.max(...samples)-Math.min(...samples)<1e-10);});
test('仅头部轻柔来回移动触发抚摸，身体和快速掠过无效',async()=>{const {BookReaction,HeadStroke}=await load();const head={left:0,right:100,top:0,bottom:80},r=new BookReaction(),stroke=new HeadStroke(r);let triggered=false;for(let i=0;i<60;i++)triggered=stroke.move({x:50+Math.sin(i*.18)*27,y:40,time:i/60,head,pressed:true})||triggered;assert(triggered);const count=r.triggers;for(let i=0;i<60;i++)stroke.move({x:50+Math.sin(i*.18)*27,y:140,time:2+i/60,head,pressed:true});assert.equal(r.triggers,count);const hover=new BookReaction(),s=new HeadStroke(hover);for(let i=0;i<140;i++)s.move({x:50+Math.sin(i*.18)*27,y:40,time:i/60,head});assert(hover.triggers>0);const jump=new BookReaction(),j=new HeadStroke(jump);j.move({x:1,y:40,time:0,head});j.move({x:99,y:40,time:.005,head});assert.equal(jump.triggers,0);});
test('桌宠位置和尺寸保持在显示器工作区，损坏位置会回退',()=>{const {fitBounds}=require('./desktop-pet.cjs'),area={x:-1920,y:0,width:1920,height:1040};for(const b of [{x:-99999,y:99999,width:10000,height:10000},{x:NaN,y:Infinity,width:NaN,height:-3},{}]){const v=fitBounds(b,area);assert(v.x>=area.x&&v.y>=area.y&&v.x+v.width<=area.x+area.width&&v.y+v.height<=area.y+area.height);assert(Object.values(v).every(Number.isFinite));}});
