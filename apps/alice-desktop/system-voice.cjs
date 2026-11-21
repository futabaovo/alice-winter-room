const path=require('node:path'),fs=require('node:fs'),crypto=require('node:crypto'),{spawn}=require('node:child_process');
class SystemVoice{
  constructor({cache,executable=path.join(__dirname,'native/SystemVoice.exe')}){this.cache=cache;this.executable=executable;this.voices=[];this.probe=null;this.child=null;}
  async available(){
    if(!this.probe)this.probe=process.platform==='win32'&&fs.existsSync(this.executable)?this.run(['--voices']).then(s=>{this.voices=JSON.parse(s).filter(v=>/^(zh|ja)(-|$)/i.test(v.language));return this.voices.length>0;}).catch(()=>false):Promise.resolve(false);
    return this.probe;
  }
  run(args,input){return new Promise((resolve,reject)=>{
    const child=spawn(this.executable,args,{windowsHide:true,stdio:['pipe','pipe','pipe']});this.child=child;let output='',size=0;
    const timer=setTimeout(()=>child.kill(),120000),finish=()=>{clearTimeout(timer);if(this.child===child)this.child=null;};
    child.stdout.on('data',data=>{size+=data.length;if(size>65536)child.kill();else output+=data.toString('utf8');});child.stderr.resume();
    child.once('error',()=>{finish();reject(Error('系统语音无法启动。'));});child.once('exit',code=>{finish();code===0?resolve(output):reject(Error('系统语音未能生成，请确认已安装中文或日语语音。'));});child.stdin.on('error',()=>{});child.stdin.end(input||'');
  });}
  async synthesize(ja,zh){
    if(!await this.available())throw Error('未找到系统中文或日语语音，请在语音面板配置有珠声线。');
    const voice=this.voices.find(v=>/^zh/.test(v.language)&&/Huihui|Yaoyao/i.test(v.name))||this.voices.find(v=>/^zh/.test(v.language))||this.voices[0],text=/^zh/.test(voice.language)?zh:ja;
    fs.mkdirSync(this.cache,{recursive:true});const file=path.join(this.cache,crypto.randomBytes(16).toString('hex')+'.wav');
    try{await this.run(['--output',file],JSON.stringify({text,voice:voice.name,language:voice.language}));const bytes=fs.readFileSync(file),duration=waveDuration(bytes);return {file,bytes,duration,language:voice.language,voiceSource:'Windows 系统'+(/^zh/.test(voice.language)?'中文':'日语')+'朗读',engine:'system'};}
    catch(e){try{fs.unlinkSync(file);}catch{}throw e;}
  }
  stop(){this.child?.kill();this.child=null;}
}
function waveDuration(bytes){
  if(bytes.length<44||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Error('系统语音格式异常。');
  let rate=0,data=0;for(let p=12;p+8<=bytes.length;){const id=bytes.toString('ascii',p,p+4),n=bytes.readUInt32LE(p+4);if(p+8+n>bytes.length)throw Error('系统语音不完整。');if(id==='fmt '&&n>=16)rate=bytes.readUInt32LE(p+16);if(id==='data')data+=n;p+=8+n+(n%2);}
  if(!rate||!data||data/rate>600)throw Error('系统语音时长异常。');return data/rate;
}
exports.SystemVoice=SystemVoice;exports.waveDuration=waveDuration;
