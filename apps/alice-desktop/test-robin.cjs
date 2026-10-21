const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const load=()=>import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path.join(__dirname,'web/robin-motion.js'),'utf8')).toString('base64'));
test('Robin flight scales to narrow desktop windows, lands continuously and exits from the current interrupted pose',async()=>{
  const {robinPose,interruptedPose}=await load();for(const width of [247,380,570]){const unit=width*.075,anchor={x:width*.36,y:width*.49};let previous;
    for(let n=144;n<1620;n++){const p=robinPose(n/120,anchor,unit,width);assert([p.x,p.y,p.wing,p.tilt,p.contact].every(Number.isFinite));if(previous)assert(Math.hypot(p.x-previous.x,p.y-previous.y)<width*.045,'Flight jumped');previous=p;}
    for(const t of [5.6,7,9,10])assert.equal(robinPose(t,anchor,unit,width).contact,1);
    for(const time of [2.8,5,7.5,11]){const from=robinPose(time,anchor,unit,width),first=interruptedPose(from,0,width),last=interruptedPose(from,1.05,width);assert.equal(first.x,from.x);assert.equal(first.y,from.y);assert.equal(last.visible,false);assert(last.x>width);}
  }
});
