import {subtitleAt} from './subtitles.js';
export class SpeechPlayer {
  constructor(onChange){
    this.onChange=onChange;this.audio=new Audio();this.audio.id='voice-audio';this.audio.preload='metadata';
    this.audio.hidden=true;document.body.append(this.audio);this.item=null;this.context=null;this.level=0;this.sequence=0;this.finishedPlaybackId=null;this.loading=false;this.error='';this.volume=.8;this.objectURL=null;
    for(const name of ['playing','pause','ended','timeupdate','seeked','loadedmetadata'])this.audio.addEventListener(name,()=>{if(name==='ended'||name==='pause')this.level=0;if(name==='playing')this.finishedPlaybackId=null;if(name==='ended'&&this.audio.ended&&this.item)this.finishedPlaybackId=this.sequence;this.emit();});
    this.audio.addEventListener('error',()=>{if(this.audio.error){this.error='这段语音暂时无法播放。';this.loading=false;this.level=0;this.emit();}});
  }
  async initAudio(){
    if(!this.context){this.context=new AudioContext();this.analyser=this.context.createAnalyser();this.analyser.fftSize=1024;this.samples=new Float32Array(this.analyser.fftSize);this.gain=this.context.createGain();this.gain.gain.value=this.volume;this.source=this.context.createMediaElementSource(this.audio);this.source.connect(this.analyser);this.analyser.connect(this.gain);this.gain.connect(this.context.destination);}
    if(this.context.state==='suspended')await this.context.resume();
  }
  snapshot(){
    const time=this.audio.currentTime||0,subtitle=subtitleAt(this.item,time);
    return {id:this.item?.id||null,playbackId:this.sequence,finishedPlaybackId:this.finishedPlaybackId,title:this.item?.title||'',playing:!this.audio.paused&&!this.audio.ended,paused:Boolean(this.item)&&this.audio.paused&&!this.loading&&!this.audio.ended&&!this.error,ended:this.audio.ended,loading:this.loading,time,duration:Number.isFinite(this.audio.duration)?this.audio.duration:0,cue:subtitle.cue,cueIndex:subtitle.index,cueCount:subtitle.count,error:this.error,level:this.level};
  }
  emit(){this.onChange(this.snapshot());}
  async play(item){
    const sequence=++this.sequence;this.finishedPlaybackId=null;this.audio.pause();this.level=0;this.error='';this.loading=true;this.item=item;
    if(this.objectURL){URL.revokeObjectURL(this.objectURL);this.objectURL=null;}
    if(item.bytes){this.objectURL=URL.createObjectURL(new Blob([item.bytes],{type:'audio/wav'}));this.audio.src=this.objectURL;}
    else this.audio.src=item.src;
    this.emit();
    try{await this.initAudio();if(sequence!==this.sequence)return;await this.audio.play();if(sequence!==this.sequence)return;this.loading=false;this.emit();}
    catch(error){if(sequence!==this.sequence)return;this.loading=false;this.level=0;this.error=error.name==='NotAllowedError'?'请点击播放按钮启用声音。':'语音播放失败，请重新播放。';this.emit();throw error;}
  }
  async toggle(){if(!this.item)return;if(!this.audio.paused){this.audio.pause();this.level=0;}else{await this.initAudio();await this.audio.play();}this.emit();}
  stop(){++this.sequence;this.finishedPlaybackId=null;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();if(this.objectURL){URL.revokeObjectURL(this.objectURL);this.objectURL=null;}this.item=null;this.level=0;this.loading=false;this.error='';this.emit();}
  setVolume(value){this.volume=Math.max(0,Math.min(1,value));if(this.gain)this.gain.gain.value=this.volume;}
  mouth(dt){
    if(!this.item||this.audio.paused||this.audio.ended||this.audio.readyState<2||!this.analyser){this.level=0;return 0;}
    this.analyser.getFloatTimeDomainData(this.samples);let energy=0;for(const sample of this.samples)energy+=sample*sample;
    const rms=Math.sqrt(energy/this.samples.length);const target=rms<.004?0:Math.min(.78,Math.pow(Math.max(0,rms-.004)/.09,.8)*.78);
    const factor=1-Math.exp(-Math.max(dt,.001)/(target>this.level ? .025 : .06));this.level+=(target-this.level)*factor;
    return this.level;
  }
}
