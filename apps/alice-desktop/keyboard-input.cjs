const {spawn}=require('node:child_process');
const path=require('node:path');
const SHORTCUTS=new Set(['copy','cut','paste','save','undo','redo','find','select','confirm','dismiss']);
class KeyboardInput {
  constructor({pulse,status,spawnImpl=spawn}){this.pulse=pulse;this.status=status;this.spawnImpl=spawnImpl;this.child=null;this.buffer='';this.generation=0;this.lastPulse=-Infinity;}
  start(mouse=false){
    this.stop();const generation=this.generation;let child;
    try{child=this.spawnImpl(path.join(__dirname,'native/KeyboardPulse.exe'),mouse?['--mouse']:[],{windowsHide:true,stdio:['pipe','pipe','ignore']});}
    catch{this.status('unavailable');return;}
    this.child=child;child.stdin?.on('error',()=>{});this.status('starting');let ready=false;
    const fail=()=>{if(generation!==this.generation)return;this.stop();this.status('unavailable');};
    this.timer=setTimeout(fail,5000);this.timer.unref?.();
    child.stdout.on('data',chunk=>{
      if(generation!==this.generation)return;this.buffer+=chunk.toString('utf8');if(this.buffer.length>256){fail();return;}
      let end;while((end=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,end).trim();this.buffer=this.buffer.slice(end+1);
        if(line==='READY'){ready=true;clearTimeout(this.timer);this.status('listening');}
        else if(ready&&(line==='T'||line==='M')){const now=Date.now();if(now-this.lastPulse>=22){this.lastPulse=now;this.pulse(line==='M'?'mouse':'key');}}
        else if(ready&&line.startsWith('S:')&&SHORTCUTS.has(line.slice(2)))this.pulse(line);
        else{fail();return;}
      }
    });
    child.on('error',fail);child.on('exit',fail);
  }
  stop(){this.generation++;clearTimeout(this.timer);const child=this.child;this.child=null;this.buffer='';this.lastPulse=-Infinity;if(child){child.stdin?.end();child.kill();}}
}
module.exports={KeyboardInput};
