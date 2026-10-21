const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const load=()=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'web/subtitles.js'),'utf8')).toString('base64'));
test('刚开始就在零秒暂停也保留暂停状态，准备播放和停止不误判为暂停',async()=>{
  const url='data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'web/subtitles.js'),'utf8')).toString('base64'),code=fs.readFileSync(path.join(__dirname,'web/speech.js'),'utf8').replace("'./subtitles.js'",JSON.stringify(url)),{SpeechPlayer}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const p=Object.create(SpeechPlayer.prototype);Object.assign(p,{audio:{currentTime:0,duration:3,paused:true,ended:false},item:{id:'test',cues:[]},loading:false,error:'',level:0});assert.equal(p.snapshot().paused,true);p.loading=true;assert.equal(p.snapshot().paused,false);p.loading=false;p.item=null;assert.equal(p.snapshot().paused,false);
});
test('字幕使用真实分句时序，静音间隙保留上一句，拖动进度可前后跳转',async()=>{
  const {subtitleAt}=await load(),item={duration:8,cues:[{start:0,end:8,ja:'お帰り。お茶をどうぞ。',zh:'欢迎回来。请喝茶。'}],speechCues:[{start:.2,end:2,ja:'お帰り。'},{start:3.5,end:7.8,ja:'お茶をどうぞ。'}]};
  assert.equal(subtitleAt(item,0).cue.zh,'欢迎回来。');assert.equal(subtitleAt(item,2.9).cue.zh,'欢迎回来。');assert.equal(subtitleAt(item,5).cue.zh,'请喝茶。');assert.equal(subtitleAt(item,1).cue.zh,'欢迎回来。');assert.equal(subtitleAt(item,8).index,1);assert.equal(subtitleAt(item,5).count,2);
});
test('翻译分句不一致时保留完整中文，损坏时序退回原字幕，预置音频继续可用',async()=>{
  const {subtitleAt}=await load(),base={duration:5,cues:[{start:0,end:5,ja:'一。二。',zh:'这是完整的一句翻译。'}],speechCues:[{start:0,end:1,ja:'一。'},{start:2,end:4,ja:'二。'}]};
  assert.equal(subtitleAt(base,3).cue.zh,'这是完整的一句翻译。');assert.equal(subtitleAt(base,3).cue.ja,'二。');const broken={...base,speechCues:[{start:0,end:3,ja:'一。'},{start:2,end:4,ja:'二。'}]};assert.equal(subtitleAt(broken,3).count,1);assert.equal(subtitleAt(null,0).cue,null);const preset={cues:[{start:.2,end:2.72,ja:'♪',zh:'哼唱'},{start:3.72,end:5.44,ja:'♪♪',zh:'下一段'}]};assert.equal(subtitleAt(preset,3).cue.zh,'哼唱');assert.equal(subtitleAt(preset,4).cue.zh,'下一段');
});
