export class StartupFlight {
  constructor(){this.progress=0;this.target=.025;this.phase='loading';this.detail='正在打开冬日小室';this.elapsed=0;this.history=[];}
  stage(progress,detail){if(this.phase!=='loading'||!Number.isFinite(progress))return;this.target=Math.max(this.target,Math.min(.96,Math.max(0,progress)));this.detail=detail;this.history.push({progress:this.target,detail});}
  finish(){if(this.phase!=='loading')return false;this.phase='ready';this.target=1;this.detail='她已经在等你了';this.history.push({progress:1,detail:this.detail});return true;}
  fail(detail){this.phase='failed';this.target=this.progress;this.detail=detail;this.history.push({progress:this.target,detail,failed:true});}
  step(dt){dt=Math.max(0,Math.min(.1,dt));this.elapsed+=dt;this.progress+=(this.target-this.progress)*(1-Math.exp(-dt*7));if(Math.abs(this.target-this.progress)<.0003)this.progress=this.target;return this.progress;}
  snapshot(){return {progress:this.progress,target:this.target,phase:this.phase,detail:this.detail,elapsed:this.elapsed,history:this.history.slice()};}
}
