const test=require('node:test'),assert=require('node:assert/strict');
test('眼睛先到，头部稍后跟随，目标静止后完全停稳',async()=>{
 const {ChibiAttention}=await import('./web/chibi-attention.js'),a=new ChibiAttention(()=>.5);
 let p;for(let i=0;i<6;i++)p=a.update({dt:1/60,target:{x:1,y:.5},active:true});
 assert(p.look.x>.8);assert.equal(p.head.x,0);
 for(let i=0;i<180;i++)p=a.update({dt:1/60,target:{x:1,y:.5},active:true});
 assert(p.head.x>.99);const head=p.head.x;
 for(let i=0;i<60;i++)p=a.update({dt:1/60,target:{x:.99,y:.51},active:true});
 assert(Math.abs(p.head.x-head)<.0001,'pointer noise must not restart head motion');
});
test('眨眼驱动有连续曲线与闭眼停留；暂停不前进',async()=>{
 const {ChibiAttention,blinkOpening}=await import('./web/chibi-attention.js');
 assert.equal(blinkOpening(0),1);assert.equal(blinkOpening(.1),0);assert.equal(blinkOpening(.12),0);assert.equal(blinkOpening(.285),1);
 assert(blinkOpening(.04)>0&&blinkOpening(.04)<1);assert(blinkOpening(.2)>0&&blinkOpening(.2)<1);
 const a=new ChibiAttention(()=>.5);let p;for(let i=0;i<280;i++)p=a.update({dt:1/60});
 const held=JSON.stringify(p);assert.equal(JSON.stringify(a.update({dt:0})),held);
});
test('专属动作/关闭待机禁止眨眼和摆头，离开目标平滑回正',async()=>{
 const {ChibiAttention}=await import('./web/chibi-attention.js'),a=new ChibiAttention(()=>.1);
 for(let i=0;i<120;i++)a.update({dt:1/60,target:{x:1,y:-1},active:true});
 const first=a.update({dt:1/60,active:false});assert(first.look.x>0&&first.look.x<1);
 let p;for(let i=0;i<180;i++)p=a.update({dt:1/60,blocked:true});
 assert(p.head.x<.001);assert.equal(p.blink,1);
 a.reset();p=a.update({dt:.05,idle:false,active:true,target:{x:-1,y:1}});assert.deepEqual(p.head,{x:0,y:0});assert(p.look.x<0);
});
