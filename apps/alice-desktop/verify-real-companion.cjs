const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {ChatHost}=require('./chat-host.cjs');
(async()=>{
  const root=path.resolve(__dirname,'../../.cache/alice-v3.0');fs.mkdirSync(root,{recursive:true});const profile=fs.mkdtempSync(path.join(root,'real-memory-'));
  const options={profile,safeStorage:{isEncryptionAvailable:()=>false}};let chat=new ChatHost(options);
  try{
    chat.save({provider:'codex',codexModel:'gpt-6.1-sol',model:'gpt-5.4-mini',baseUrl:'https://api.openai.com/v1',reasoning:'low',remember:true,key:''});
    const greeting=await chat.ask('这是程序的虚构测试：我叫小林，喜欢无糖红茶。我想下次和你聊《青鸟》这本童话，可以吗？');console.log('Real dialogue completed.');
    const organized=await chat.summarizeMemory({force:true});assert(organized.updated);assert.match(chat.companion.state.memory.profile,/红茶/);console.log('Real structured memory update completed.');
    chat.companion.save('真实记忆验收');const memory=structuredClone(chat.companion.state.memory);chat.clear();chat.close();chat=new ChatHost(options);
    assert.equal(chat.history.length,0);const recalled=await chat.ask('我喜欢什么茶？我上次说想和你聊哪一本童话？');assert.match(recalled.zh,/红茶/);assert.match(recalled.zh,/青鸟/);console.log('Restarted app recalls preferences with empty recent history.');
    const proactive=await chat.generateProactive();assert(proactive.ja&&proactive.zh&&proactive.ja.length<=120);
    const report={ok:true,model:'gpt-6.1-sol',profile,liveRequests:4,greeting,memory,recalled,proactive,externalLingChatRequired:false};fs.writeFileSync(path.join(root,'real-companion-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  }finally{chat.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
