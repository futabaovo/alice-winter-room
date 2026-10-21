const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {CompanionStore}=require('./companion-store.cjs');
const {ChatHost}=require('./chat-host.cjs');
const {ProactiveHost}=require('./proactive-host.cjs');
const base=path.resolve(__dirname,'../../.cache/alice-v3.0/tests');fs.mkdirSync(base,{recursive:true});
const profile=()=>fs.mkdtempSync(path.join(base,'case-'));
const notes={summary:'正在谈童话。',events:'一起讨论过一本童话。',profile:'用户喜欢安静。',promises:'双方约定下次继续讨论。'};
const reply={ja:'お茶にしましょう。',zh:'喝茶吧。',emotion:'neutral',expressionEvents:[]};
const settings={provider:'codex',codexModel:'gpt-6.1-sol',model:'gpt-5.4-mini',baseUrl:'https://api.openai.com/v1',reasoning:'low',remember:true,key:''};
function host(extra={}){const requests=[];const fake={async ask(request){requests.push(request);return JSON.stringify(request.schema.properties.summary?notes:reply);},stop(){}};const value=new ChatHost({profile:profile(),safeStorage:{isEncryptionAvailable:()=>false},codexHost:fake,auxCodexHost:fake,...extra});value.save(settings);return {value,requests};}

test('旧版记录迁移、进程重开、手动存档及读档回退',()=>{
  const directory=profile();fs.writeFileSync(path.join(directory,'chat-history.json'),JSON.stringify([{role:'user',content:'你好'},{role:'assistant',content:JSON.stringify(reply)}]));
  let store=new CompanionStore({profile:directory});assert.equal(store.state.history.length,2);store.editMemory(notes);store.save('最初的约定');const saved=store.list().find(s=>!s.automatic);
  store.append([{role:'user',content:'第二次来访'}]);store.editMemory({...notes,profile:'用户喜欢安静，也喜欢茶。'});
  store=new CompanionStore({profile:directory});assert.equal(store.state.history.length,3);store.load(saved.id);assert.equal(store.state.history.length,2);assert.equal(store.state.memory.profile,notes.profile);
  assert(store.list().some(s=>s.id==='before-load'));store.load('before-load');assert.equal(store.state.history.length,3);assert.match(store.state.memory.profile,/茶/);
  const disk=fs.readFileSync(store.savePath(saved.id),'utf8');for(const forbidden of ['encryptedKey','api_key','codex-chat','baseUrl'])assert(!disk.includes(forbidden));
  assert.throws(()=>store.load('../../openai-settings'),/编号/);assert.throws(()=>store.remove('latest'),/维护/);store.remove(saved.id);assert(!store.list().some(s=>s.id===saved.id));
});

test('四项记忆注入真实对话接口，测试连接不带记忆，关闭保留后不写入新聊天',async()=>{
  const {value,requests}=host();await value.ask('我喜欢安静。');await value.summarizeMemory({force:true});await value.ask('你记得我的偏好吗？');assert(requests.at(-1).instructions.includes(notes.profile));assert.equal(value.companion.pending().length,2);
  await value.test();assert(!requests.at(-1).instructions.includes(notes.profile));
  value.save({...settings,remember:false});await value.ask('只在这次运行中谈论的内容');assert(!requests.at(-1).instructions.includes(notes.profile));assert.deepEqual(JSON.parse(fs.readFileSync(value.companion.file,'utf8')).history,[]);assert.throws(()=>value.companion.save('不应写入'),/开启/);value.close();
});

test('对话上下文保持最近 12 轮，完整记录独立保存并在阈值后归档',async()=>{
  const {value,requests}=host();for(let i=0;i<15;i++)await value.ask('第 '+i+' 次来访');assert.equal(value.history.length,30);assert.equal(requests.at(-1).history.length,24);
  assert.equal((await value.summarizeMemory()).updated,true);assert.equal(value.companion.pending().length,0);assert.equal(value.companion.state.memory.promises,notes.promises);
  assert.equal((await value.summarizeMemory()).updated,false);value.close();
});

test('读取存档和手动修改使旧的记忆摘要失效',async()=>{
  let finish;const aux={ask:()=>new Promise(resolve=>{finish=resolve;}),stop(){}};const {value}=host({auxCodexHost:aux});await value.ask('原来的话题');
  const pending=value.summarizeMemory({force:true});value.companion.clearMemory();finish(JSON.stringify(notes));assert.equal((await pending).updated,false);assert.equal(value.companion.state.memory.profile,'');
  value.close();
});

test('用户发言取消后台整理，失败或不完整结果不损坏旧记忆',async()=>{
  let finish;const aux={ask:()=>new Promise(resolve=>{finish=resolve;}),stop(){}};const {value}=host({auxCodexHost:aux});await value.ask('你好');value.companion.editMemory(notes);
  await value.ask('可以整理的新消息');const pending=value.summarizeMemory({force:true});const cancelled=assert.rejects(pending,/停止/);await value.ask('先回答我');finish(JSON.stringify({...notes,profile:'不应写入'}));await cancelled;assert.equal(value.companion.state.memory.profile,notes.profile);assert.equal(value.memoryError,'');
  value.auxCodex={ask:async()=>JSON.stringify({summary:'格式不完整'}),stop(){}};await assert.rejects(value.summarizeMemory({force:true}),/记忆/);assert.equal(value.companion.state.memory.profile,notes.profile);value.close();
});

test('关闭记忆不注入摘要，清空聊天与清空记忆相互独立',async()=>{
  const {value,requests}=host();await value.ask('第一次');value.companion.editMemory(notes);value.companion.configure({memoryEnabled:false});await value.ask('第二次');assert(!requests.at(-1).instructions.includes(notes.profile));value.clear();assert.equal(value.history.length,0);assert.equal(value.companion.state.memory.profile,notes.profile);value.companion.clearMemory();assert.equal(value.companion.state.memory.profile,'');value.close();
});

test('主动交流只在空闲窗口投放，候选与接受分离，记录不伪造用户消息',async()=>{
  let clock=new Date(2026,9,17,12,0).getTime(),visible=true,candidate;const {value}=host({now:()=>clock});await value.ask('你好');
  const proactive=new ProactiveHost({chat:value,available:()=>visible,deliver:event=>{candidate=event;},now:()=>clock});value.companion.configure({proactiveEnabled:true,idleMinutes:5,maxPerDay:2});clock+=6*60000;proactive.report({available:true,idleMs:6*60000});
  const before=value.history.length;assert.equal(await proactive.tick(),true);assert.equal(value.history.length,before);assert(candidate.id);proactive.report({available:false,idleMs:0});assert.equal(proactive.accept(candidate.id).accepted,false);
  proactive.report({available:true,idleMs:6*60000});assert.equal(await proactive.tick(),true);assert.equal(proactive.accept(candidate.id).accepted,true);assert.equal(value.history.length,before+1);assert.equal(value.history.at(-1).role,'assistant');assert.equal(value.history.at(-1).source,'proactive');assert.equal(proactive.accept(candidate.id).accepted,false);assert.equal(proactive.eligible(),false);
  clock+=61*60000;proactive.report({available:true,idleMs:61*60000});visible=false;assert.equal(proactive.eligible(),false);visible=true;assert.equal(proactive.eligible(),true);
  assert.equal(await proactive.tick(),true);proactive.accept(candidate.id);clock+=61*60000;proactive.report({available:true,idleMs:61*60000});assert.equal(proactive.eligible(),false);value.close();
});

test('主动交流遵守夜间静默、过期报告、默认关闭与跨重启每日上限',async()=>{
  let clock=new Date(2026,9,17,23,15).getTime();const {value}=host({now:()=>clock});await value.ask('你好');const p=new ProactiveHost({chat:value,available:()=>true,deliver(){},now:()=>clock});clock+=6*60000;p.report({available:true,idleMs:6*60000});assert.equal(p.eligible(),false);value.companion.configure({proactiveEnabled:true,idleMinutes:5});assert.equal(p.eligible(),false);value.companion.configure({quietAtNight:false});assert.equal(p.eligible(),true);clock+=26000;assert.equal(p.eligible(),false);
  value.companion.state.proactive={day:'2026-10-17',count:2,lastAt:clock-61*60000};value.companion.persist();const restored=new CompanionStore({profile:value.profile,now:()=>clock});assert.equal(restored.state.proactive.count,2);value.close();
});

test('记忆整理结果在重启后保留，损坏状态文件会留副本供恢复',()=>{
  const directory=profile();const store=new CompanionStore({profile:directory});store.append([{role:'user',content:'明确事实'}]);const through=store.state.history.at(-1).id;assert(store.commitMemory(notes,{epoch:store.epoch,version:store.memoryVersion,through}));const restored=new CompanionStore({profile:directory});assert.equal(restored.pending().length,0);assert.equal(restored.state.memory.profile,notes.profile);
  fs.writeFileSync(store.file,'invalid-json');const recovered=new CompanionStore({profile:directory});assert(recovered.warning);assert(fs.readdirSync(directory).some(name=>name.includes('.unreadable-')));assert(recovered.list().some(s=>s.id==='latest'));
});

test('手动修订不被之前尚未归档的旧对话覆盖',()=>{const store=new CompanionStore({profile:profile()});store.append([{role:'user',content:'旧偏好：红茶'}]);store.editMemory({...notes,profile:'用户已手动修正为喜欢绿茶。'});assert.equal(store.pending().length,0);store.append([{role:'user',content:'新的交流'}]);assert.equal(store.pending().length,1);assert.match(store.prompt(),/绿茶/);});
