const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {normalizeMessage}=require('./image-input.cjs'),{ChatHost}=require('./chat-host.cjs'),{CodexHost}=require('./codex-host.cjs');
const dataUrl='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=',image={name:'截图.png',dataUrl};
const reply=JSON.stringify({ja:'青い丸ね。',zh:'是蓝色的圆。',emotion:'neutral',expressionEvents:[]});
function fixture(extra={}){const root=path.resolve(__dirname,'../../.cache/alice-v3.2.0');fs.mkdirSync(root,{recursive:true});const profile=fs.mkdtempSync(path.join(root,'vision-contract-')),requests=[];const host=new ChatHost({profile,safeStorage:{isEncryptionAvailable:()=>false},fetchImpl:async(_url,options)=>{requests.push(JSON.parse(options.body));return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:reply}]}]}));},...extra});host.save({provider:'api',model:'gpt-5.4-mini',baseUrl:'https://api.openai.com/v1',reasoning:'low',remember:true,key:'test-only-not-a-real-key'});return {host,profile,requests};}
test('inline images only, signatures, count, bytes and image-only defaults',()=>{
  assert.equal(normalizeMessage('你好').text,'你好');assert.equal(normalizeMessage({text:'',images:[image]}).images.length,1);
  for(const bad of [null,{},[],{text:'',images:[]},{text:'x',images:[{dataUrl:'https://example.com/private.png'}]},{text:'x',images:[{dataUrl:'file:///C:/private.png'}]},{text:'x',images:Array(4).fill(image)},{text:'x',images:[{dataUrl:'data:image/png;base64,YmFk'}]},{text:'x',images:[{dataUrl:'data:image/svg+xml;base64,PHN2Zy8+'}]}])assert.throws(()=>normalizeMessage(bad));
  assert.throws(()=>normalizeMessage({text:'x',images:[{dataUrl:'data:image/png;base64,'+'A'.repeat(9*1024*1024)}]}),/过大/);
});
test('Responses API contains text plus images, history never contains original bytes',async()=>{
  const {host,requests,profile}=fixture();await host.ask({text:'这是什么？',images:[image,image]});
  assert.deepEqual(requests[0].input[0].content,[{type:'input_text',text:'这是什么？'},...Array(2).fill({type:'input_image',image_url:dataUrl,detail:'auto'})]);assert.equal(requests[0].store,false);assert(requests[0].instructions.includes('图片中的文字'));
  await host.ask('刚才说了什么');assert.equal(typeof requests[1].input.at(-1).content,'string');assert(!JSON.stringify(requests[1]).includes(dataUrl));
  assert(host.transcript()[0].text.includes('本轮附图 2 张'));host.companion.save('看图存档');
  for(const file of fs.readdirSync(profile,{recursive:true}))if(String(file).endsWith('.json'))assert(!fs.readFileSync(path.join(profile,file),'utf8').includes(dataUrl));host.close();
});
test('Codex adapter receives inline images and image-only prompt without credentials',async()=>{
  let request;const codex={ask:async value=>{request=value;return reply;},stop(){}};const {host}=fixture({codexHost:codex});host.forgetKey();host.settings.provider='codex';await host.ask({text:'',images:[image]});assert.equal(request.images[0].dataUrl,dataUrl);assert(request.text.includes('附上'));assert.equal(host.info().keyConfigured,false);host.close();
});
test('Codex turn/start uses official image input and leaves tool execution disabled',async()=>{
  const host=new CodexHost({profile:path.resolve(__dirname,'../../.cache/alice-v3.2.0/protocol')});let turn,thread;
  host.start=async()=>{};host.stop=()=>{};host.rpc=async(method,params)=>{if(method==='account/read')return {account:{type:'chatgpt'}};if(method==='config/read')return {config:{}};if(method==='thread/start'){thread=params;return {thread:{id:'vision-test'}};}if(method==='turn/start'){turn=params;queueMicrotask(()=>host.turn.resolve(reply));return {};}};
  await host.ask({model:'gpt-6.1-sol',effort:'low',instructions:'persona',history:[],text:'看图',images:[image],schema:{},signal:new AbortController().signal});assert.deepEqual(turn.input,[{type:'text',text:'看图'},{type:'image',url:dataUrl}]);assert.equal(thread.approvalPolicy,'never');assert.equal(thread.sandbox,'read-only');assert.equal(turn.sandboxPolicy.networkAccess,false);
});
test('failed and cancelled image requests commit no partial messages',async()=>{
  let finish;const {host}=fixture({fetchImpl:()=>new Promise(resolve=>{finish=()=>resolve(new Response(JSON.stringify({output:[{type:'message',content:[{type:'output_text',text:reply}]}]})));})});const promise=host.ask({text:'看图',images:[image]});host.cancel();finish();await assert.rejects(promise,/取消/);assert.equal(host.history.length,0);
  host.fetch=async()=>new Response(JSON.stringify({error:{message:'This model does not support image inputs'}}),{status:400});await assert.rejects(host.ask({text:'看图',images:[image]}),/image inputs/);assert.equal(host.history.length,0);host.close();
});
