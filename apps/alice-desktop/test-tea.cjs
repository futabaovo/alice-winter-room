const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {TeaHost,evaluate,LEAVES}=require('./tea-host.cjs');
const profile=()=>{fs.mkdirSync(path.resolve(__dirname,'../../output/alice-tea-v1'),{recursive:true});return fs.mkdtempSync(path.resolve(__dirname,'../../output/alice-tea-v1/test-profile-'));};
const motion=()=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'web/tea-motion.js'),'utf8')).toString('base64'));
test('茶叶档次与火候共同决定品质，珍藏茶泡坏也会苦涩或偏淡',()=>{
  const results=LEAVES.map(l=>evaluate({leaf:l.id,temperature:l.temperature,seconds:l.seconds}));assert.deepEqual(results.map(r=>r.grade),['家常','佳品','珍品']);assert.deepEqual(results.map(r=>r.feeling),['ordinary','good','exquisite']);
  const bitter=evaluate({leaf:'reserve',temperature:100,seconds:300}),weak=evaluate({leaf:'reserve',temperature:80,seconds:60});assert.equal(bitter.feeling,'bitter');assert.equal(weak.feeling,'weak');assert(bitter.score<results[0].score);assert.notEqual(bitter.feedback.expression,results[2].feedback.expression);
  for(const r of [...results,bitter,weak]){assert(r.feedback.zh&&r.feedback.ja);assert.deepEqual(evaluate(r.recipe),r);}assert.throws(()=>evaluate({leaf:'missing',temperature:95,seconds:180}));assert.throws(()=>evaluate({leaf:'daily',temperature:NaN,seconds:180}));
});
test('冲泡完成才可品饮，单杯占用阻止重复喝取，只有持杯窗口可完成或释放',()=>{
  let now=10000;const h=new TeaHost({profile:profile(),now:()=>now,timers:false});h.brew({leaf:'choice',temperature:95,seconds:180});assert.equal(h.info().phase,'brewing');assert.throws(()=>h.take(1,'wrong'));assert.throws(()=>h.brew({leaf:'daily',temperature:95,seconds:180}));now+=4200;const c=h.info().cup;assert(c);h.take(1,c.id);assert.throws(()=>h.take(2,c.id));h.release(2);assert.equal(h.info().phase,'serving');assert.throws(()=>h.finish(2,c.id));h.release(1);assert.equal(h.info().phase,'ready');h.take(2,c.id);const r=h.finish(2,c.id);assert.equal(r.history.length,1);assert.equal(r.cup,null);assert.throws(()=>h.finish(2,c.id));h.close();
});
test('中断或换窗口保留未喝的茶，重新打开后配方、成茶与品茗记录保留',()=>{
  let now=100;const p=profile(),h=new TeaHost({profile:p,now:()=>now,timers:false});h.brew({leaf:'reserve',temperature:90,seconds:150});h.close();now+=5000;const reopened=new TeaHost({profile:p,now:()=>now,timers:false});const c=reopened.info().cup;assert.equal(c.grade,'珍品');reopened.take(1,c.id);reopened.release();assert.equal(reopened.info().cup.id,c.id);reopened.take(2,c.id);now+=46000;assert.equal(reopened.info().phase,'ready');reopened.take(2,c.id);reopened.finish(2,c.id);reopened.close();const third=new TeaHost({profile:p,now:()=>now,timers:false});assert.equal(third.info().history[0].grade,'珍品');assert.equal(third.info().recipe.leaf,'reserve');assert.equal(third.info().cup,null);third.close();
});
test('喝茶等候语音和举书，品饮完成事件仅一次，30/60/120 FPS 不重复消费',async()=>{
  const {TeaMotion}=await motion();for(const fps of [30,60,120]){const m=new TeaMotion(),cup={id:'tea',feeling:'exquisite'};assert(m.request(cup));assert(!m.request(cup));for(let n=0;n<fps;n++)m.step(1/fps,{available:false});assert.equal(m.phase,'queued');let tastes=0;for(let n=0;n<fps*9;n++){const s=m.step(1/fps);if(s.taste){tastes++;assert.equal(s.phase,'feeling');assert(s.elapsed>=3.7);}for(const key of ['weight','travel','alpha','sip','tilt','feeling'])assert(Number.isFinite(s[key])&&s[key]>=0&&s[key]<=1);}assert.equal(tastes,1);assert.equal(m.completed,1);assert.equal(m.phase,'idle');}
});
test('品饮前被打断会平滑放下，超时与重复取消不触发喝完事件',async()=>{
  const {TeaMotion}=await motion();for(const start of [0,.8,1.8,3]){const m=new TeaMotion();m.request({id:'x'});m.step(.01);for(let n=0;n<start*60;n++)m.step(1/60);const before=m.pose();m.cancel();const after=m.pose();if(before.phase!=='queued')assert(Math.abs(before.travel-after.travel)<1e-9);let tastes=0;for(let n=0;n<60;n++)if(m.step(1/60,{interrupted:true}).taste)tastes++;assert.equal(tastes,0);assert.equal(m.phase,'idle');}const waiting=new TeaMotion();waiting.request({id:'wait'});let expired=false;for(let n=0;n<1300;n++)expired=waiting.step(1/60,{available:false}).expired||expired;assert(expired);assert.equal(waiting.completed,0);
});
