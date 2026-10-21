import {StartupFlight} from './startup-state.js';
export function initStartup(){
  const root=document.getElementById('loading'),canvas=document.getElementById('startup-flight'),detail=document.getElementById('load-detail'),ctx=canvas.getContext('2d'),state=new StartupFlight(),bird=new Image(),started=performance.now(),isPet=document.documentElement.classList.contains('pet-mode');
  let previous=started,frameId=0,ended=false,decoded=false;bird.src='startup/robin-flight.png';bird.decode().then(()=>{decoded=true;}).catch(()=>{});
  function draw(time){
    const dt=(time-previous)/1000;previous=time;state.step(dt);const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio,2);if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const left=50,right=w-50,p=state.progress,x=left+(right-left)*p,y=h*.57-Math.sin(p*Math.PI)*15+Math.sin(state.elapsed*3.8)*2;
    ctx.lineWidth=.7;ctx.strokeStyle='#d7ba7a39';ctx.beginPath();ctx.moveTo(left,h*.57);ctx.bezierCurveTo(w*.3,h*.57-21,w*.7,h*.57-21,right,h*.57);ctx.stroke();
    for(let i=0;i<7;i++){const a=p-i*.017;if(a<0)continue;ctx.fillStyle=`rgba(221,194,129,${.24*(1-i/7)})`;ctx.beginPath();ctx.arc(left+(right-left)*a,h*.57-Math.sin(a*Math.PI)*15,Math.max(.5,1.6-i*.15),0,Math.PI*2);ctx.fill();}
    if(decoded){const frame=state.phase==='failed'?0:Math.floor(state.elapsed*108)%24;ctx.globalAlpha=state.phase==='failed'?.6:1;ctx.drawImage(bird,frame%8*128,Math.floor(frame/8)*128,128,128,x-56,y-58,112,112);ctx.globalAlpha=1;}
    detail.textContent=state.detail;root.setAttribute('aria-valuenow',String(Math.round(p*100)));if(!ended)frameId=requestAnimationFrame(draw);
  }
  frameId=requestAnimationFrame(draw);
  const controller={stage:(progress,text)=>state.stage(progress,text),snapshot:()=>({...state.snapshot(),birdLoaded:decoded,hidden:root.hidden}),
    async finish(){if(!state.finish())return;await new Promise(resolve=>setTimeout(resolve,isPet?0:Math.max(0,400-(performance.now()-started))));root.classList.add('startup-leaving');await new Promise(resolve=>setTimeout(resolve,isPet?80:300));root.hidden=true;ended=true;cancelAnimationFrame(frameId);},
    fail(error){const reason=error?.message||String(error);state.fail(/Failed to fetch|NetworkError|Load failed/i.test(reason)?'本地资源未能读取，请检查程序文件是否完整。':reason);root.hidden=false;root.classList.remove('startup-leaving');root.classList.add('startup-failed');document.getElementById('startup-title').textContent='小室暂时未能打开';document.getElementById('startup-note').textContent='请关闭后重试，或检查本地资源是否完整。';ended=true;cancelAnimationFrame(frameId);draw(performance.now());void Promise.resolve(window.aliceDesktop?.startupFailed?.()).catch(()=>{});}
  };window.aliceStartup=controller;return controller;
}
