const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {FarewellHost}=require('./farewell-host.cjs'),{ChatHost,replySchema}=require('./chat-host.cjs');
const load=()=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'web/sticker-state.js'),'utf8')).toString('base64'));
test('表情包等真实播放结束，暂停不触发，重播不重发',async()=>{
  const {StickerDelivery}=await load(),sent=[],queue=new StickerDelivery({send:item=>sent.push(item)}),token=queue.plan({id:'smug'});
  queue.speech(token,{id:'same',playbackId:1});queue.step({id:'same',playbackId:1,paused:true});assert.equal(sent.length,0);
  queue.step({id:'same',playbackId:1,playing:true});assert.equal(sent.length,0);queue.step({id:'same',playbackId:1,ended:true});assert.equal(sent.length,0);queue.step({id:'same',playbackId:1,finishedPlaybackId:1,ended:true});assert.equal(sent.length,1);
  queue.step({id:'same',playbackId:1,ended:true});queue.step({id:'same',playbackId:1,playing:true});assert.equal(sent.length,1);
});
test('同一语音文件的新播放、停止和错误都不冒充说完',async()=>{
  const {StickerDelivery}=await load();for(const snapshot of [{id:'same',playbackId:2,ended:true},{id:null,playbackId:2},{id:'same',playbackId:1,error:'failed'}]){
    let sent=0;const queue=new StickerDelivery({send:()=>sent++}),token=queue.plan({id:'nope'});queue.speech(token,{id:'same',playbackId:1});queue.step(snapshot);assert.equal(sent,0);assert.equal(queue.pending,null);
  }
});
test('文字留出阅读间隔，新回复与取消清除旧队列',async()=>{
  const {StickerDelivery}=await load();let now=0;const sent=[],queue=new StickerDelivery({now:()=>now,send:item=>sent.push(item)});
  const old=queue.plan({id:'smug',zh:'好了。'});queue.text(old);now=1199;queue.step({});assert.equal(sent.length,0);
  const latest=queue.plan({id:'speechless',zh:'……'});queue.text(old);assert.equal(queue.pending.mode,'pending');queue.text(latest);now+=1200;queue.step({playing:true});assert.equal(sent.length,0);queue.step({});assert.equal(sent[0].id,'speechless');
  const cancel=queue.plan({id:'satisfied'});queue.text(cancel);queue.cancel();now+=10000;queue.step({});assert.equal(sent.length,1);assert.equal(queue.plan({id:'none'}),null);
});
test('模型表情包枚举与记录只允许实际发送的类型',()=>{
  const profile=fs.mkdtempSync(path.join(os.tmpdir(),'alice-sticker-')),host=new ChatHost({profile,safeStorage:{isEncryptionAvailable:()=>false}});
  try{
    assert(replySchema.required.includes('sticker'));assert(!replySchema.properties.sticker.enum.includes('goodbye'));
    const base={ja:'これは違うわ。',zh:'这个不行。',emotion:'neutral'};assert.equal(host.parseReply(JSON.stringify(base)).sticker,'none');assert.equal(host.parseReply(JSON.stringify({...base,sticker:'https://bad'})).sticker,'none');
    const parsed=host.parseReply(JSON.stringify({...base,sticker:'nope'}));host.companion.append([{role:'assistant',content:JSON.stringify(parsed)}]);const replyId=host.history[0].id;
    assert.equal(host.recordSticker({replyId,sticker:'smug'}).recorded,false);assert.equal(host.recordSticker({replyId,sticker:'nope'}).recorded,true);assert.equal(host.recordSticker({replyId,sticker:'nope'}).recorded,false);
    assert(host.transcript()[0].stickerSent);assert.equal(host.transcript()[0].replyId,replyId);assert.throws(()=>host.recordSticker({sticker:'goodbye',source:'feeding',ja:'',zh:''}),/无效/);
    host.recordSticker({sticker:'satisfied',source:'feeding',ja:'ありがとう。',zh:'……谢谢。'});assert.equal(host.transcript().length,2);assert(new ChatHost({profile,safeStorage:{isEncryptionAvailable:()=>false}}).transcript()[1].stickerSent);
  }finally{host.close();fs.rmSync(profile,{recursive:true,force:true});}
});
test('退出只接受当前窗口的正确确认，重复退出不重复告别',async()=>{
  let presented=0,finished=0;const host=new FarewellHost({present:()=>presented++,finish:()=>finished++});host.request('room');host.request('pet');await Promise.resolve();assert.equal(presented,1);
  assert(!host.done('pet',host.operation.token));assert(!host.done('room','invalid'));assert.equal(finished,0);assert(host.done('room',host.operation.token));assert.equal(finished,1);assert(!host.done('room',host.operation.token));host.request('room');assert.equal(finished,1);
});
test('窗口无响应时退出有有界兜底',async()=>{
  let reason;const host=new FarewellHost({present:()=>{},finish:value=>reason=value,timeout:15});host.request('room');await new Promise(r=>setTimeout(r,35));assert.equal(reason,'timeout');
});
