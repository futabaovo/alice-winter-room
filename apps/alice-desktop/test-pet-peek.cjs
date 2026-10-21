const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const data=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const motion=()=>import(data(fs.readFileSync(path.join(__dirname,'web/peek-motion.js'),'utf8')));
const book=()=>{const reaction=data(fs.readFileSync(path.join(__dirname,'web/pet-reaction.js'),'utf8'));return import(data(fs.readFileSync(path.join(__dirname,'web/book-pose.js'),'utf8').replace("'./pet-reaction.js'",JSON.stringify(reaction))));};
test('左右斜身轨迹镜像，反向运动保留速度；坐标逆变换可点击真实人物',async()=>{
  const {PeekMotion}=await motion();const left=new PeekMotion(),right=new PeekMotion();left.set({side:'left',phase:'hidden'});right.set({side:'right',phase:'hidden'});left.set({side:'left',phase:'peeking'});right.set({side:'right',phase:'peeking'});
  for(let n=0;n<120;n++){left.step(1/60);right.step(1/60);assert(Math.abs(left.offset+right.offset)<1e-10);assert(Math.abs(left.angle+right.angle)<1e-10);assert.equal(left.cover,1);const p={x:190,y:130},screen=left.screenPoint(p,380,650),local=left.localPoint(screen,380,650);assert(Math.hypot(local.x-p.x,local.y-p.y)<1e-9);}
  assert(Math.abs(left.angle-12)<.01);assert(Math.abs(left.offset+.6)<.001);assert(left.screenPoint({x:190,y:130},380,650).x>40,'Head did not lean inside the screen');
  const before=left.snapshot();left.set({side:null,phase:'free'});assert.equal(left.offset,before.offset);assert.deepEqual(left.velocity,before.velocity);for(let n=0;n<180;n++)left.step(1/60);assert.equal(left.offset,0);assert.equal(left.angle,0);assert.equal(left.cover,0);
});
test('遮脸书本与掌心袖口保持绑定，过渡中手臂不塌陷且不牵拉肩膀',async()=>{
  const {bookPose,bookGrips}=await book();const face={left:100,top:60,bottom:110,width:54,height:50};
  for(const direction of [-1,1]){let previous;for(let n=0;n<=1000;n++){const pose=bookPose(1,face,0,{peek:n/1000,direction});for(const [index,grip] of bookGrips(pose).entries()){const elbow=index?pose.elbowR:pose.elbowL,length=Math.hypot(grip.wrist.x-elbow.x,grip.wrist.y-elbow.y)/54;assert(length>.6&&length<1.8);assert(elbow.y>grip.wrist.y+face.width*.25);assert(Object.values(grip.wrist).every(Number.isFinite));}assert(pose.elbowL.y>pose.shoulderL.y);assert(pose.elbowR.y>pose.shoulderR.y);if(previous)assert(Math.hypot(pose.book.x-previous.book.x,pose.book.y-previous.book.y)<.6);previous=pose;}
    const pose=bookPose(1,face,0,{peek:1,direction});assert(pose.book.y-pose.book.height/2<face.top+face.height*.2);assert(pose.book.y+pose.book.height/2>face.bottom);assert.equal(pose.shoulderL.x,100+27-54*.95);
    const [left,right]=bookGrips(pose);assert(left.palm.x<pose.book.x-pose.book.width*.4);assert(right.palm.x>pose.book.x+pose.book.width*.4,'Right fingers did not reach outer cover');
  }
});
test('改变侧边高度后，倾斜人物的鼠标正逆变换仍一致，唤回连续回到正常高度',async()=>{
  const {PeekMotion}=await motion();for(const side of ['left','right'])for(const height of [-120,0,360]){const p=new PeekMotion();p.set({side,phase:'hidden'});p.setVertical(height,true);p.set({side,phase:'peeking'});for(let n=0;n<120;n++)p.step(1/60);const point={x:190,y:145},screen=p.screenPoint(point,380,650),local=p.localPoint(screen,380,650);assert(Math.hypot(point.x-local.x,point.y-local.y)<1e-9);p.set({side:null,phase:'free'});assert.equal(p.vertical,height);for(let n=0;n<180;n++)p.step(1/60);assert.equal(p.vertical,0);}
});
test('企鹅探头角度更轻，左右镜像且身体点击坐标保持一致',async()=>{
  const {PeekMotion}=await motion();for(const side of ['left','right']){const p=new PeekMotion();p.set({side,phase:'hidden'});p.set({side,phase:'peeking',variant:'penguin'});for(let i=0;i<120;i++)p.step(1/60);assert(Math.abs(Math.abs(p.offset)-.5)<.001);assert(Math.abs(Math.abs(p.angle)-8)<.01);const point={x:190,y:130},q=p.localPoint(p.screenPoint(point,380,650),380,650);assert(Math.hypot(q.x-point.x,q.y-point.y)<1e-9);p.set({side,phase:'hiding',variant:'penguin'});for(let i=0;i<120;i++)p.step(1/60);assert(Math.abs(Math.abs(p.offset)-1.25)<.001);}
});
