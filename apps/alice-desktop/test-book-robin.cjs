const assert=require('node:assert/strict');
(async()=>{
  const {BookRobinGame,GAME_DIFFICULTIES,FINAL_SEQUENCE,FINALE_DURATION}=await import('./web/book-robin-state.js');
  const advance=(g,t)=>{for(let i=0;i<Math.round(t/.01);i++)g.tick(.01);};
  const g=new BookRobinGame({random:()=>0,duration:2});
  assert.equal(g.hit(0).accepted,false);g.start();advance(g,.6);
  const first=g.targets[0];assert(first&&first.age>.1);
  assert.equal(g.hit(first.hole).hit,true);assert.equal(g.score,10);
  assert.equal(g.hit(first.hole).accepted,false,'cooldown prevents repeat scoring');advance(g,.2);
  assert.equal(g.hit(first.hole).hit,false,'one bird only scores once');assert.equal(g.score,9);assert.equal(g.combo,0);
  const elapsed=g.elapsed;g.pause();advance(g,1);assert.equal(g.elapsed,elapsed);assert.equal(g.hit(0).accepted,false);
  assert.equal(g.setDifficulty('hard'),false,'no paused-round difficulty change');g.pause();advance(g,g.duration-g.elapsed);
  assert.equal(g.phase,'finale');assert.equal(g.snapshot().remaining,0);assert.equal(g.best,9);assert.equal(g.hit(0).accepted,false);
  const ending=g.finaleElapsed;g.pause();advance(g,1);assert.equal(g.finaleElapsed,ending);assert.equal(g.snapshot().resumePhase,'finale');g.pause();
  const stages=[];
  for(const part of FINAL_SEQUENCE){assert.equal(g.snapshot().finale.stage,part.stage);stages.push(part.stage);advance(g,part.duration);}
  assert.equal(g.phase,'finished');assert.equal(g.snapshot().finale.stage,'result');assert.equal(g.finaleElapsed,FINALE_DURATION);
  assert.equal(g.hit(0).accepted,false);g.start();assert.equal(g.best,9);assert.equal(g.score,0);assert.equal(g.snapshot().finale,null);
  let seed=123456;
  const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  const counts=[];
  for(const id of ['easy','normal','hard']){
    const q=new BookRobinGame({difficulty:id,random}),seen=new Set();q.start();let max=0,life=0,n=0;
    for(let i=0;i<900;i++){
      q.tick(.05);
      assert.equal(new Set(q.targets.map(t=>t.hole)).size,q.targets.length,'one target per hole');
      max=Math.max(max,q.targets.length);assert(max<=GAME_DIFFICULTIES[id].maxTargets);
      for(const t of q.targets){assert(Number.isInteger(t.hole)&&t.hole>=0&&t.hole<9);seen.add(t.hole);life+=t.life;n++;}
    }
    assert.equal(seen.size,9,'all nine positions can spawn');counts.push({id,spawned:q.serial,averageLife:life/n});
    assert.equal(q.phase,'finale');advance(q,8.3);assert.equal(q.phase,'finished');
    for(const [score,tier] of [[0,'low'],[GAME_DIFFICULTIES[id].mediumScore,'medium'],[GAME_DIFFICULTIES[id].highScore,'high']]){
      q.start();q.score=score;advance(q,45);assert.equal(q.snapshot().finale.tier,tier);
      if(tier==='low')assert.match(q.snapshot().finale.robinLine,/哈哈/);
      assert.equal(q.setDifficulty('normal'),false);
      advance(q,8.3);assert.equal(q.phase,'finished','every tier plays the whole ending');
    }
  }
  assert(counts[0].spawned<counts[1].spawned&&counts[1].spawned<counts[2].spawned);
  assert(counts[0].averageLife>counts[1].averageLife&&counts[1].averageLife>counts[2].averageLife);
  const b=new BookRobinGame({duration:.5});b.start();b.score=123;advance(b,.5);advance(b,8.3);assert.equal(b.best,123);
  assert(b.setDifficulty('easy'));assert.equal(b.best,0);assert(b.setDifficulty('normal'));assert.equal(b.best,123);
  assert.equal(b.setDifficulty('__proto__'),false);b.tick(NaN);assert(Number.isFinite(b.elapsed));
  const combo=new BookRobinGame();combo.start();
  for(let i=0;i<20;i++){combo.elapsed=i*.2;combo.targets=[{hole:i%9,id:i,age:.5,life:2,hit:false}];const r=combo.hit(i%9);assert(r.hit);assert(r.points<=30);}
  assert.equal(combo.maxCombo,20);
  console.log(JSON.stringify({ok:true,coverage:['9 holes','three difficulty rates','score tiers','all finale stages','pause and resume','cooldown and no repeat points','best by difficulty','restart'],counts,stages},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});

