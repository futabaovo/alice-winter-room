const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const load=()=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'web/feeding-state.js'),'utf8')).toString('base64'));
test('投喂等候语音/书本释放，只接收一份，完成一次后可再次投喂',async()=>{
  const {FeedingState}=await load(),s=new FeedingState();assert(s.request({x:100,y:200}));assert.equal(s.request({x:1,y:2}),false);
  for(let i=0;i<100;i++){const p=s.step(.05,{available:false});assert.equal(p.phase,'queued');assert.equal(p.mouth,0);assert.equal(p.weight,0);}
  s.step(.01,{available:true});for(let i=0;i<130;i++){const p=s.step(.05);for(const n of [p.mouth,p.weight,p.travel,p.consumed])assert(Number.isFinite(n)&&n>=0&&n<=1);}
  assert.equal(s.completed,1);assert.equal(s.phase,'idle');assert(s.request({x:5,y:8}));
});
test('咀嚼中被对话接管会连续收回，不产生延迟完成',async()=>{
  const {FeedingState}=await load(),s=new FeedingState();s.request({x:0,y:0});for(let i=0;i<55;i++)s.step(.05);assert.equal(s.phase,'chew');const w=s.pose().weight;
  s.cancel();assert.equal(s.pose().weight,w);for(let i=0;i<60;i++)s.step(.05);assert.equal(s.completed,0);assert.equal(s.phase,'idle');assert.equal(s.pose().foodVisible,false);
});
test('拖拽取消、排队超时和切换窗口后均不残留食物',async()=>{
  const {FeedingState}=await load(),s=new FeedingState();s.beginDrag({x:10,y:20});s.move({x:30,y:40});assert.equal(s.drop(false),false);assert.equal(s.phase,'idle');s.request({x:0,y:0});for(let i=0;i<420;i++)s.step(.05,{available:false});assert.equal(s.phase,'idle');assert.equal(s.completed,0);s.beginDrag({x:1,y:2});s.reset();assert.equal(s.pose().drag,null);
});
test('握寿司保留半份咀嚼后再吃第二口，细卷只吃一口',async()=>{
  const {FeedingState}=await load();for(const bites of [1,2]){const s=new FeedingState(),seen=new Set();s.request({x:2,y:3},{kind:bites===1?'maki':'salmon',bites});let half=false;for(let i=0;i<500&&s.completed===0;i++){const p=s.step(1/60);seen.add(p.phase);if(p.phase==='chew'&&bites===2){assert(p.consumed>.4&&p.consumed<.6);assert(p.foodVisible);assert.equal(p.hold,.65);half=true;}}assert.equal(s.completed,1);assert.equal(seen.has('second-bite'),bites===2);assert.equal(half,bites===2);}
});
test('说话期间拖入的寿司保留种类，松手后排队等候',async()=>{
  const {FeedingState}=await load(),s=new FeedingState();s.beginDrag({x:1,y:2},{kind:'roe',bites:1});s.step(.05,{interrupted:true,available:false});assert.equal(s.phase,'dragging');assert(s.drop(true));assert.equal(s.kind,'roe');assert.equal(s.bites,1);s.step(.05,{available:false});assert.equal(s.phase,'queued');assert.equal(s.pose().mouth,0);
});
