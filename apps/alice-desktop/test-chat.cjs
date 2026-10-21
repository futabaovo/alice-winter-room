// Protocol and credential tests use a local fake API, never a real account.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {ChatHost,normalizeModel,persona,replySchema}=require('./chat-host.cjs');

(async()=>{
  fs.mkdirSync(path.resolve(__dirname,'../../.cache/alice-v2.4'),{recursive:true});
  const profile=fs.mkdtempSync(path.resolve(__dirname,'../../.cache/alice-v2.4/chat-contract-'));
  const secret='test-only-api-key-not-a-real-credential';
  const key=crypto.randomBytes(32);
  const safeStorage={isEncryptionAvailable:()=>true,encryptString(text){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const bytes=Buffer.concat([cipher.update(text),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]);},decryptString(bytes){const decipher=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));return Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString();}};
  const requests=[];let mode='good',slowSeen;
  const server=http.createServer(async(req,res)=>{
    let raw='';for await(const chunk of req)raw+=chunk;
    requests.push({url:req.url,authorization:req.headers.authorization,body:JSON.parse(raw)});
    if(mode==='slow'){slowSeen?.();return;}
    res.setHeader('Content-Type','application/json');
    if(mode==='unauthorized'){res.writeHead(401);res.end('{}');return;}
    const content=mode==='refusal'?[{type:'refusal',refusal:'Cannot respond.'}]:[{type:'output_text',text:mode==='bad'?'not JSON':JSON.stringify({ja:'寒いわ。お茶を飲みましょう。',zh:'很冷。喝杯茶吧。',emotion:'neutral'})}];
    res.end(JSON.stringify({status:'completed',output:[{type:'message',role:'assistant',content}]}));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{
    const catalog=require('./character/expressions.json');
    assert.deepEqual(replySchema.properties.emotion.enum,catalog.map(item=>item.id));
    assert.equal(catalog.length,20);for(const item of catalog)assert(persona.includes(item.id));
    const host=new ChatHost({profile,safeStorage});
    await assert.rejects(host.ask('你好'),/密钥/);
    const settings={baseUrl:`http://127.0.0.1:${server.address().port}/v1`,model:'gpt-5.4-mini',reasoning:'low',remember:true,key:secret};
    const info=host.save(settings);assert.equal(info.keyConfigured,true);assert.equal(info.keyPersistence,'encrypted');
    assert(!fs.readFileSync(host.file,'utf8').includes(secret));assert(!JSON.stringify(info).includes(secret));
    const first=await host.ask('今天冷吗');assert.equal(first.ja,'寒いわ。お茶を飲みましょう。');assert.equal(first.zh,'很冷。喝杯茶吧。');assert.equal(first.voiceEligible,true);assert.deepEqual(first.expressionEvents,[]);
    assert.equal(requests[0].url,'/v1/responses');assert.equal(requests[0].authorization,'Bearer '+secret);assert.equal(requests[0].body.store,false);assert.equal(requests[0].body.text.format.strict,true);assert.equal(requests[0].body.reasoning.effort,'low');
    await host.ask('那就喝茶吧');assert.equal(requests[1].body.input.length,3);assert.equal(host.transcript().length,4);
    const restored=new ChatHost({profile,safeStorage});assert.equal(restored.info().keyConfigured,true);assert.equal(restored.transcript().length,4);
    for(const [failure,pattern]of [['unauthorized',/密钥/],['bad',/双语/],['refusal',/换一种/]]){mode=failure;await assert.rejects(host.ask('测试失败分支'),pattern);assert.equal(host.transcript().length,4);}
    mode='slow';const seen=new Promise(resolve=>{slowSeen=resolve;});const pending=host.ask('取消这一次');await seen;host.cancel();await assert.rejects(pending,/取消/);assert.equal(host.transcript().length,4);
    mode='good';host.clear();assert.equal(host.transcript().length,0);assert.equal(JSON.parse(fs.readFileSync(host.historyFile,'utf8')).length,0);
    host.save({...settings,key:'',remember:false});await host.ask('不持久化历史');assert.equal(host.transcript().length,2);assert.deepEqual(JSON.parse(fs.readFileSync(host.historyFile,'utf8')),[]);
    host.forgetKey();assert.equal(host.info().keyConfigured,false);assert(!fs.readFileSync(host.file,'utf8').includes(secret));
    assert.throws(()=>host.save({...settings,baseUrl:'http://example.com/v1'}),/HTTPS/);
    assert.equal(normalizeModel('模型\t倍率\tToken\t标准 gpt-6.1-sol'),'gpt-6.1-sol');
    assert.throws(()=>normalizeModel('gpt-6.1-sol gpt-6-sol'),/一个模型/);
    const migrated=JSON.parse(fs.readFileSync(host.file,'utf8'));migrated.model='模型\tToken\tgpt-6.1-sol';fs.writeFileSync(host.file,JSON.stringify(migrated));
    assert.equal(new ChatHost({profile,safeStorage}).info().model,'gpt-6.1-sol');
    let codexRequest;
    const fakeCodex={async ask(request){codexRequest=request;return JSON.stringify({ja:'お茶にしましょう。',zh:'喝茶吧。',emotion:'neutral'});},async status(){return {loggedIn:true,authType:'chatgpt',models:[{id:'gpt-6.1-sol'}]};},stop(){}};
    const codexHost=new ChatHost({profile,safeStorage,codexHost:fakeCodex});
    codexHost.save({...settings,provider:'codex',codexModel:'gpt-6.1-sol',remember:true,key:''});
    assert.equal(codexHost.info().ready,true);assert.equal(codexHost.info().keyConfigured,false);
    const before=codexHost.history.length;const tested=await codexHost.test();assert.equal(tested.provider,'codex');assert.equal(codexHost.history.length,before);assert.equal(codexRequest.history.length,0);
    await codexHost.ask('泡杯茶吧');assert.equal(codexRequest.model,'gpt-6.1-sol');assert.equal(codexHost.transcript().length,before+2);
    await codexHost.ask('记得刚才说了什么吗');assert.equal(codexRequest.history.length,before+2);
    assert.equal((await codexHost.codexStatus()).loggedIn,true);codexHost.close();
    const result={ok:true,transport:'local fake Responses API and Codex adapter',liveOpenAIRequest:false,checked:['bilingual reply','emotion','strict JSON schema','request authentication','store:false','encrypted credential round trip','bounded conversation context','error and refusal handling','cancel without committing history','clear and disable persisted history','credential removal','pasted model table normalization','ambiguous model rejection','legacy settings migration','Codex dialogue without API key','connection test without history commit']};
    fs.writeFileSync(path.resolve(__dirname,'../../.cache/alice-v2.4/chat-contract.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});

