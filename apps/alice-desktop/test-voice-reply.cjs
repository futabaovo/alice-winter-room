const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {VoiceHost}=require('./voice-host.cjs'),{waveDuration}=require('./system-voice.cjs');
test('portable launcher discovers a nearby trained voice workspace',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'alice-voice-discovery-'));
  try{for(const f of ['.cache/gpt-sovits-env/Scripts/python.exe','training/alice-ja/outputs/voice-pilot-v1/weights/GPT/alice_ja_pilot_v1-e10.ckpt','training/alice-ja/outputs/voice-pilot-v1/weights/SoVITS/alice_ja_pilot_v1_e8_s304.pth','.cache/GPT-SoVITS/GPT_SoVITS/pretrained_models/chinese-hubert-base/config.json']){const p=path.join(root,f);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'test');}const v=new VoiceHost({profile:path.join(root,'profile'),launchDirectory:path.join(root,'release/v1.1.2')});assert.equal(v.workspace,root);assert.equal(v.info().customAvailable,true);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('short chat uses Alice voice; long chat is spoken with an explicitly named system voice',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'alice-voice-route-'));
  try{const v=new VoiceHost({profile:root});v.valid=()=>true;v.synthesize=async()=>({engine:'alice'});assert.equal((await v.synthesizeReply('こんにちは。','你好。')).engine,'alice');let text;v.system.synthesize=async(ja,zh)=>{text=zh;const file=path.join(root,'clip.wav');fs.writeFileSync(file,'test');return {file,bytes:Buffer.from('test'),duration:2,language:'zh-CN',voiceSource:'Windows 系统中文朗读',engine:'system'};};fs.mkdirSync(v.cache);const result=await v.synthesizeReply('長い回答。'.repeat(30),'这是一段较长的回答。');assert.equal(result.engine,'system');assert.equal(text,'这是一段较长的回答。');assert.equal(result.cues[0].zh,text);assert.match(result.voiceSource,/Windows/);assert.equal(v.busy,false);await assert.rejects(v.synthesizeReply({},'测试'),/无效/);}finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('speech WAV duration accepts extra chunks and rejects truncated data',()=>{
  const b=Buffer.alloc(44+48000);b.write('RIFF');b.writeUInt32LE(b.length-8,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(1,22);b.writeUInt32LE(24000,24);b.writeUInt32LE(48000,28);b.writeUInt16LE(2,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(48000,40);assert.equal(waveDuration(b),1);assert.throws(()=>waveDuration(b.subarray(0,100)),/不完整/);
});
