const fs=require('node:fs');
const path=require('node:path');
const readline=require('node:readline');
const {spawn,execFile}=require('node:child_process');
const {validateSpeechCues}=require('./reply-plan.cjs');

class VoiceHost {
  constructor({profile,developmentRoot,launchDirectory,override}){
    this.profile=profile;this.cache=path.join(profile,'speech-cache');this.child=null;this.pending=new Map();this.counter=0;this.ready=false;this.busy=false;this.starting=null;this.device=null;
    this.config=path.join(profile,'voice-workspace.json');
    let saved;try{saved=JSON.parse(fs.readFileSync(this.config,'utf8')).workspace;}catch{}
    this.workspace=[override,saved,developmentRoot,launchDirectory&&path.resolve(launchDirectory,'..')].find(root=>this.valid(root))||null;
  }
  valid(root){return typeof root==='string'&&['.cache/gpt-sovits-env/Scripts/python.exe','training/alice-ja/outputs/voice-pilot-v1/weights/GPT/alice_ja_pilot_v1-e10.ckpt','training/alice-ja/outputs/voice-pilot-v1/weights/SoVITS/alice_ja_pilot_v1_e8_s304.pth','.cache/GPT-SoVITS/GPT_SoVITS/pretrained_models/chinese-hubert-base/config.json'].every(p=>fs.existsSync(path.join(root,p)));}
  info(){return {available:this.valid(this.workspace),ready:this.ready,busy:this.busy,starting:Boolean(this.starting),device:this.device};}
  async configure(root){if(!this.valid(root))throw Error('所选文件夹里没有完整的语音训练环境，请选择 live2d 项目文件夹。');await this.stop();this.workspace=path.resolve(root);fs.mkdirSync(this.profile,{recursive:true});fs.writeFileSync(this.config,JSON.stringify({workspace:this.workspace}));return this.info();}
  start(){
    if(this.ready)return Promise.resolve(this.info());if(this.starting)return this.starting;
    if(!this.valid(this.workspace))return Promise.reject(Error('请先选择已配置的 live2d 项目文件夹。'));
    fs.mkdirSync(this.cache,{recursive:true});
    const child=spawn(path.join(this.workspace,'.cache/gpt-sovits-env/Scripts/python.exe'),['-u',path.join(__dirname,'voice_service.py'),'--workspace',this.workspace,'--output-dir',this.cache],{cwd:this.workspace,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,PYTHONIOENCODING:'utf-8',PYTHONUNBUFFERED:'1',OMP_NUM_THREADS:'4',HF_HUB_OFFLINE:'1',TRANSFORMERS_OFFLINE:'1'}});
    this.child=child;this.ready=false;
    const log=fs.createWriteStream(path.join(this.profile,'voice-service.log'),{flags:'a'});
    child.stderr.on('data',data=>log.write(data));
    this.starting=new Promise((resolve,reject)=>{
      let settled=false;
      const fail=message=>{if(!settled){settled=true;clearTimeout(timer);this.starting=null;reject(Error(message));}};
      const timer=setTimeout(()=>{fail('语音模型加载超时，请关闭后重试。');void this.stop();},180000);
      readline.createInterface({input:child.stdout}).on('line',line=>{
        if(!line.startsWith('ALICE_VOICE:'))return;
        let message;try{message=JSON.parse(line.slice('ALICE_VOICE:'.length));}catch{return;}
        if(message.type==='ready'){
          if(this.child!==child)return;
          this.ready=true;this.device=message.device;
          if(!settled){settled=true;clearTimeout(timer);this.starting=null;resolve(this.info());}
        }else if(message.id){const pending=this.pending.get(message.id);if(!pending)return;this.pending.delete(message.id);clearTimeout(pending.timer);if(message.type==='error')pending.reject(Error(message.message));else pending.resolve(message);}
      });
      child.once('error',()=>fail('本机语音环境无法启动，请重新选择项目文件夹。'));
      child.once('exit',()=>{
        log.end();fail('语音模型启动失败，请检查本机训练环境。');
        if(this.child===child){this.child=null;this.ready=false;this.device=null;for(const request of this.pending.values()){clearTimeout(request.timer);request.reject(Error('语音模型已关闭。'));}this.pending.clear();}
      });
    });
    return this.starting;
  }
  async synthesize(ja,zh){
    if(typeof ja!=='string'||!ja.trim()||ja.trim().length>120||typeof zh!=='string'||zh.length>240)throw Error('日语台词最多 120 字，中文字幕最多 240 字。');
    if(this.busy)throw Error('正在生成上一句，请稍候。');
    this.busy=true;
    try{
      await this.start();
      const id=String(++this.counter);
      const result=await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('语音生成超时，请关闭模型后重试。'));void this.stop();},180000);
        this.pending.set(id,{resolve,reject,timer});
        this.child.stdin.write(JSON.stringify({id,text:ja.trim()})+'\n',error=>{if(error){clearTimeout(timer);this.pending.delete(id);reject(Error('语音模型连接中断。'));}});
      });
      const file=path.resolve(result.path);
      if(!file.startsWith(path.resolve(this.cache)+path.sep)||path.extname(file)!=='.wav')throw Error('语音输出路径无效。');
      const stat=fs.statSync(file);if(stat.size<44||stat.size>8*1024*1024)throw Error('语音输出大小异常。');
      const bytes=fs.readFileSync(file);if(bytes.toString('ascii',0,4)!=='RIFF')throw Error('语音输出格式异常。');
      this.lastGenerated=file;
      const cached=fs.readdirSync(this.cache).filter(name=>/^[a-f0-9]{32}\.wav$/.test(name)).map(name=>({file:path.join(this.cache,name),modified:fs.statSync(path.join(this.cache,name)).mtimeMs})).sort((a,b)=>b.modified-a.modified);
      for(const entry of cached.slice(20))try{fs.unlinkSync(entry.file);}catch{}
      return {id:'generated-'+id,title:'刚刚生成的台词',bytes:new Uint8Array(bytes),duration:result.duration,speechCues:validateSpeechCues(result.cues,ja.trim(),result.duration),cues:[{start:0,end:result.duration,ja:ja.trim(),zh:zh.trim()||'（未填写中文字幕）'}]};
    }finally{this.busy=false;}
  }
  async stop(){
    const child=this.child;if(!child)return this.info();this.child=null;this.ready=false;this.device=null;
    for(const request of this.pending.values()){clearTimeout(request.timer);request.reject(Error('语音模型已关闭。'));}this.pending.clear();
    // The Python venv launcher owns a Python child on Windows. Stop only this
    // app-owned process tree so closing the window releases GPU memory as well.
    await new Promise(resolve=>{if(process.platform==='win32')execFile('taskkill.exe',['/pid',String(child.pid),'/t','/f'],{windowsHide:true},()=>resolve());else{child.kill();resolve();}});
    return this.info();
  }
}
exports.VoiceHost=VoiceHost;
