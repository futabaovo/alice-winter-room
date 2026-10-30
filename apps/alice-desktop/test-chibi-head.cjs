const test=require('node:test'),assert=require('node:assert/strict');
const api=import('./web/chibi-head.js'),face={left:150,right:350,top:200,bottom:320,width:200,height:120};
test('头部摆动幅度克制，待机和轻微视线倾向均不超过1.2度',async()=>{
 const {chibiHeadPose}=await api;let low=0,high=0;
 for(let i=0;i<2000;i++){const p=chibiHeadPose({idle:true,clock:i*.02,look:{x:i%2?1:-1,y:.7}});low=Math.min(low,p.angle);high=Math.max(high,p.angle);assert(Math.abs(p.angle)<=1.2*Math.PI/180+.00001);assert(Math.abs(p.nod)<1.21);}
 assert(low<0&&high>0);
});
test('头部帽子五官整体旋转保持距离，颈部以下与专属动作不受影响',async()=>{
 const {chibiHeadPose,chibiHeadPoint}=await api,p=chibiHeadPose({idle:true,clock:2,look:{x:1,y:0}}),a={x:180,y:210},b={x:320,y:270};
 const ar=chibiHeadPoint(a.x,a.y,face,p),br=chibiHeadPoint(b.x,b.y,face,p);
 assert(Math.abs(Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(ar.x-br.x,ar.y-br.y))<1e-8);
 assert.deepEqual(chibiHeadPoint(200,600,face,p),{x:200,y:600});
 for(const action of ['book','feeding','tea','peek','brewing'])assert.deepEqual(chibiHeadPose({idle:true,clock:2,action}),{angle:0,nod:0});
 assert.deepEqual(chibiHeadPose({idle:false,clock:2}),{angle:0,nod:0});
});
test('所有头部摆动时刻的网格均连续，不翻折',async()=>{
 const {chibiHeadMesh,chibiHeadPose,chibiHeadPoint}=await api,m=chibiHeadMesh();
 for(let t=0;t<20;t+=.25){const p=chibiHeadPose({idle:true,clock:t,look:{x:Math.sin(t),y:Math.cos(t)}}),points=[];for(let i=0;i<m.local.length;i+=2)points.push(chibiHeadPoint(m.local[i],m.local[i+1],face,p));for(let i=0;i<m.indices.length;i+=3){const [a,b,c]=Array.from(m.indices.slice(i,i+3),n=>points[n]);assert((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)>0);}}
});
test('同一注视方向保持稳定，时钟不再使头部循环摇摆',async()=>{
 const {chibiHeadPose}=await api,a=chibiHeadPose({idle:true,clock:0,look:{x:.8,y:.2}});
 for(const clock of [1,3,10,20])assert.deepEqual(chibiHeadPose({idle:true,clock,look:{x:.8,y:.2}}),a);
});
