const test=require('node:test'),assert=require('node:assert/strict');
const {EdgePeek,scaledBounds,scaleLimits,edgeBounds,nearestEdge,dockLayout,dockPosition,EDGE_HANDLE_HEIGHT,PEEK_MIN,PEEK_MAX,PEEK_DURATION,HIDE_DURATION}=require('./pet-edge-state.cjs');
test('自动偷看交替企鹅服与原衣装，重复请求和忙碌不跳过顺序',()=>{
  let time=1000;const edge=new EdgePeek({now:()=>time,random:()=>0});edge.dock('left');assert.equal(edge.peek(),false);time=edge.nextAt;edge.tick();assert.equal(edge.peek({busy:true}),false);
  for(const expected of ['penguin','original','penguin','original']){assert(edge.peek());assert.equal(edge.variant,expected);const id=edge.peekId,deadline=edge.nextAt;assert.equal(edge.peek(),false);assert.equal(edge.peekId,id);assert.equal(edge.nextAt,deadline);time=edge.nextAt;edge.tick();time=edge.nextAt;edge.tick();}
  edge.recall();edge.dock('right');time=edge.nextAt;edge.tick();assert(edge.peek());assert.equal(edge.variant,'penguin');
});
test('手动指定偷看衣装不改自动顺序，暂停与唤回清除出场状态',()=>{
  let time=1000;const edge=new EdgePeek({now:()=>time,random:()=>0});edge.dock('right');time=edge.nextAt;edge.tick();assert.equal(edge.peek({variant:'unknown'}),false);assert(edge.peek({variant:'original'}));assert.equal(edge.variant,'original');edge.pause();edge.resume();assert(edge.peek());assert.equal(edge.variant,'penguin');edge.recall();assert.equal(edge.variant,'original');assert.equal(edge.nextAt,0);
});
test('收起后每 3–5 分钟偷看，停留后重新收起；忙碌时延迟',()=>{
  for(const random of [0,.43,1]){let time=10000;const edge=new EdgePeek({now:()=>time,random:()=>random});edge.dock('left');assert.equal(edge.phase,'hiding');time+=HIDE_DURATION-1;assert.equal(edge.tick(),false);time++;assert(edge.tick());assert.equal(edge.phase,'hidden');assert(edge.nextAt-time>=PEEK_MIN&&edge.nextAt-time<=PEEK_MAX);time=edge.nextAt;assert.equal(edge.tick({busy:true}),false);assert.equal(edge.phase,'hidden');assert.equal(edge.nextAt-time,15000);time=edge.nextAt;assert(edge.tick());assert.equal(edge.phase,'peeking');assert.equal(edge.nextAt-time,PEEK_DURATION);time=edge.nextAt;assert(edge.tick());assert.equal(edge.phase,'hiding');time=edge.nextAt;edge.tick();assert.equal(edge.phase,'hidden');assert(edge.nextAt-time>=PEEK_MIN);}
});
test('唤回取消倒计时，锁屏恢复重新等待，不补播积压偷看',()=>{
  let time=1000;const edge=new EdgePeek({now:()=>time,random:()=>0});edge.dock('right');edge.pause();time+=900000;assert.equal(edge.tick(),false);assert.equal(edge.peek(),false);edge.resume();assert.equal(edge.phase,'hidden');assert.equal(edge.nextAt,time+PEEK_MIN);assert(edge.peek());edge.recall();time+=900000;assert.equal(edge.tick(),false);assert.equal(edge.nextAt,0);assert.equal(edge.side,null);assert.throws(()=>edge.dock('top'));
});
test('65–150% 连续尺寸保持底边与中心，越界值按工作区收敛',()=>{
  const area={x:0,y:0,width:1920,height:1040},original={x:700,y:390,width:380,height:650};const widths=new Set();
  for(let percent=65;percent<=150;percent++){const {scale,bounds:b}=scaledBounds(original,percent/100,area);assert.equal(scale,percent/100);assert(Math.abs(b.x+b.width/2-890)<=.5);assert.equal(b.y+b.height,1040);widths.add(b.width);}
  assert.equal(widths.size,86);assert.equal(scaledBounds(original,99,area).scale,1.5);assert.equal(scaledBounds(original,-99,area).scale,.65);for(const value of [NaN,Infinity,'1',null])assert.throws(()=>scaledBounds(original,value,area));
});
test('边缘定位和缩放不跨显示器；含负坐标、任务栏及较小工作区',()=>{
  for(const area of [{x:-1920,y:-220,width:1920,height:1040},{x:1920,y:0,width:1280,height:680},{x:0,y:0,width:800,height:500}]){
    let b={x:area.x+50,y:area.y+20,width:380,height:650};for(const factor of [.65,.83,1,1.17,1.5]){const result=scaledBounds(b,factor,area);assert(result.scale*100<=scaleLimits(area).max);b=result.bounds;assert(b.x>=area.x&&b.y>=area.y&&b.x+b.width<=area.x+area.width&&b.y+b.height<=area.y+area.height);for(const side of ['left','right']){const docked=edgeBounds(b,area,side);assert.equal(nearestEdge(docked,area),side);assert(docked.x>=area.x&&docked.x+docked.width<=area.x+area.width);}}
    assert.equal(nearestEdge({...b,x:area.x+80,width:200},area),null);
  }
});
test('侧边标签可覆盖整条工作区，缩放后位置保持且负坐标显示器不越界',()=>{
  for(const area of [{x:0,y:0,width:2560,height:1392},{x:-1920,y:-200,width:1920,height:1040}])for(const scale of [.65,1,1.5]){
    const b=scaledBounds({x:area.x+100,y:area.y+200,width:380,height:650},scale,area).bounds;
    for(const side of ['left','right'])for(const position of [0,.23,.7,1]){const layout=dockLayout(b,area,side,position),n=layout.bounds;assert(n.x>=area.x&&n.x+n.width<=area.x+area.width&&n.y>=area.y&&n.y+n.height<=area.y+area.height);assert(Math.abs(dockPosition(layout.centerY,area)-position)<1e-9);assert(layout.centerY-EDGE_HANDLE_HEIGHT/2>=area.y&&layout.centerY+EDGE_HANDLE_HEIGHT/2<=area.y+area.height);assert(layout.centerY-n.y>=52&&layout.centerY-n.y<=n.height-52);}
    assert.throws(()=>dockLayout(b,area,'left',NaN));assert.throws(()=>dockLayout(b,area,'left','0.5'));
  }
});
