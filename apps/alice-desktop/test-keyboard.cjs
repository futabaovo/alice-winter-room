const {test}=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {KeyboardInput}=require('./keyboard-input.cjs');
test('rapid input is coalesced and stops without playing a backlog',async()=>{
  const {TypingMotion}=await import('./web/keyboard/motion.js'),m=new TypingMotion(()=>.5);for(let t=0;t<180;t++){for(let k=0;k<8;k++)m.pulse();m.step(1/60);}assert.equal(m.count,1440);assert(m.strikes<25&&m.strikes>6);
  for(let t=0;t<60;t++)m.step(1/60);assert.equal(m.phase,'idle');assert.equal(m.pending,false);assert.equal(m.snapshot().bob,0);
});
test('hands alternate, pause cancels pending strokes, resumed mode waits for input',async()=>{
  const {TypingMotion}=await import('./web/keyboard/motion.js'),m=new TypingMotion(()=>.5);m.pulse();const first=m.side;for(let i=0;i<50;i++)m.step(.02);m.pulse();assert.notEqual(m.side,first);m.pulse();m.step(.01,{enabled:false});assert.equal(m.phase,'idle');assert.equal(m.pending,false);for(let i=0;i<30;i++)m.step(.03);assert.equal(m.phase,'idle');
});
test('mode reset drops transient input and body movement is bounded',async()=>{
  const {TypingMotion}=await import('./web/keyboard/motion.js'),m=new TypingMotion(()=>.5);for(let i=0;i<180;i++){if(i%3===0)m.pulse();const s=m.step(.02,{intensity:1});assert(s.bob>=0&&s.bob<=1.2);}m.reset();assert.equal(m.count,0);assert.equal(m.phase,'idle');assert.equal(m.pending,false);
});
function fake(){const child=new EventEmitter();child.stdout=new EventEmitter();child.stdin=new EventEmitter();child.stdin.end=()=>{child.ended=true;};child.kill=()=>{child.killed=true;};return child;}
test('native channel accepts only ready plus anonymous pulse symbols',()=>{
  const child=fake(),states=[],pulses=[],input=new KeyboardInput({spawnImpl:()=>child,status:s=>states.push(s),pulse:p=>pulses.push(p)});input.start();child.stdout.emit('data',Buffer.from('REA'));child.stdout.emit('data',Buffer.from('DY\nT\n'));assert.deepEqual(pulses,['key']);assert.equal(states.at(-1),'listening');child.stdout.emit('data',Buffer.from('unexpected keyboard text\n'));assert.equal(states.at(-1),'unavailable');assert(child.killed);input.stop();
});
test('switching away kills helper and ignores late callbacks',()=>{
  const child=fake(),pulses=[],states=[],input=new KeyboardInput({spawnImpl:()=>child,status:s=>states.push(s),pulse:p=>pulses.push(p)});input.start();input.stop();child.stdout.emit('data',Buffer.from('READY\nT\n'));child.emit('exit',0);assert(child.killed&&child.ended);assert.equal(pulses.length,0);assert(!states.includes('unavailable'));
});
test('failed native service has an explicit unavailable state',()=>{
  const child=fake(),states=[],input=new KeyboardInput({spawnImpl:()=>child,status:s=>states.push(s),pulse:()=>{throw Error('must not emit');}});input.start();child.emit('error',Error('unavailable'));assert.equal(states.at(-1),'unavailable');assert.equal(input.child,null);input.stop();
});

test('shortcut events survive a preceding typing pulse, unknown tokens are rejected',()=>{
  const child=fake(),pulses=[],input=new KeyboardInput({spawnImpl:()=>child,status:()=>{},pulse:p=>pulses.push(p)});input.start();
  child.stdout.emit('data',Buffer.from('READY\nT\nS:copy\nS:paste\n'));assert.deepEqual(pulses,['key','S:copy','S:paste']);
  child.stdout.emit('data',Buffer.from('S:clipboard\n'));assert.equal(input.child,null);input.stop();
});

test('local shortcuts exclude modifiers, repeat and IME, support redo variants',async()=>{
  const {shortcutFromEvent:f}=await import('./web/keyboard/reactions.js');
  for(const [code,id]of Object.entries({KeyC:'copy',KeyX:'cut',KeyV:'paste',KeyS:'save',KeyZ:'undo',KeyY:'redo',KeyF:'find',KeyA:'select'})){
    assert.equal(f({code,ctrlKey:true}),id);
    for(const extra of [{altKey:true},{metaKey:true},{repeat:true},{isComposing:true},{keyCode:229}])assert.equal(f({code,ctrlKey:true,...extra}),null);
  }
  assert.equal(f({code:'KeyZ',ctrlKey:true,shiftKey:true}),'redo');assert.equal(f({code:'KeyS',ctrlKey:true,shiftKey:true}),null);
  assert.equal(f({key:'Enter'}),'confirm');assert.equal(f({key:'Escape'}),'dismiss');assert.equal(f({key:'Enter',shiftKey:true}),null);
});

test('reactions coalesce to latest, cool down, cancel on pause and never backlog',async()=>{
  const {ShortcutReactions:R}=await import('./web/keyboard/reactions.js'),r=new R(),advance=seconds=>{for(let i=0;i<seconds*100;i++)r.step(.01);};
  assert(r.trigger('copy'));advance(.3);assert(r.trigger('paste'));assert(r.trigger('save'));assert.equal(r.pending.id,'save');
  assert.equal(r.trigger('copy'),false);advance(2.5);assert.equal(r.current.id,'save');assert.equal(r.started,2);advance(2.1);assert.equal(r.current,null);assert.equal(r.pending,null);
  assert.equal(r.trigger('copy'),false);advance(1.5);assert(r.trigger('copy'));r.trigger('paste');r.step(.01,{enabled:false});assert.equal(r.current,null);assert.equal(r.pending,null);advance(3);assert.equal(r.current,null);
  assert.equal(r.trigger('constructor'),false);assert(r.trigger('find',{preview:true}));r.reset();assert.equal(r.current,null);
});

test('native classifier self-test checks Raw Input key-up, repeats and chord exclusions',()=>{
  const {execFileSync}=require('node:child_process'),exe=require('./build-keyboard.cjs').buildKeyboard();
  assert.match(execFileSync(exe,['--self-test'],{encoding:'utf8',windowsHide:true}),/SELFTEST OK/);
});

test('fast copy then paste finishes both complete gestures with no lost paste',async()=>{
  const {ShortcutReactions:R}=await import('./web/keyboard/reactions.js'),{pagePose}=await import('./web/keyboard/page-gesture.js'),r=new R(),seen=new Set();
  r.trigger('copy');r.step(.04);r.trigger('paste');
  for(let i=0;i<600;i++){const s=r.step(.01);if(s?.gesture&&s.stage==='hold')seen.add(s.id+':'+pagePose(s).phase);}
  for(const phase of ['copy:open','copy:extract','copy:duplicate','copy:keep','copy:settle','paste:ready','paste:lower','paste:contact','paste:release'])assert(seen.has(phase),'Missing gesture: '+phase);
  assert.equal(r.started,2);assert.equal(r.current,null);assert.equal(r.pending,null);
});
