const test=require('node:test'),assert=require('node:assert/strict');
test('眼球定位提取紫色虹膜，忽略肤色、眼睑和区域外的头发',async()=>{
  const {findChibiEyes}=await import('./web/chibi-eyes.js'),width=100,height=100,p=new Uint8ClampedArray(width*height*4);
  const fill=(left,top,w,h,rgb)=>{for(let y=top;y<top+h;y++)for(let x=left;x<left+w;x++)p.set([...rgb,255],(y*width+x)*4);};
  fill(0,0,width,height,[250,222,199]);fill(0,0,width,10,[55,50,80]);
  fill(26,31,11,13,[60,55,88]);fill(62,31,11,13,[60,55,88]);
  fill(25,29,14,2,[22,20,22]);fill(60,29,15,2,[22,20,22]);
  const face={left:18,right:82,top:15,bottom:60,width:64,height:45},eyes=findChibiEyes(p,width,height,face,'winter');
  assert.equal(eyes.length,2);assert(eyes[0].cx<50&&eyes[1].cx>50);assert(eyes.every(e=>e.top>=30&&e.bottom<45));
});
test('没有可信的眼部色块时不创建假瞳孔',async()=>{
  const {findChibiEyes}=await import('./web/chibi-eyes.js'),p=new Uint8ClampedArray(40*40*4);
  for(let i=0;i<p.length;i+=4)p.set([245,220,195,255],i);
  assert.equal(findChibiEyes(p,40,40,{left:5,right:35,top:5,bottom:35,width:30,height:30}).length,0);
});
