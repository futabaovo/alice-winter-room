const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const mod=import('data:text/javascript;base64,'+fs.readFileSync(path.join(__dirname,'web/expression-geometry.js')).toString('base64'));
test('round-eye and iris transforms are bounded, finite and nonaccumulating',async()=>{
  const {warpEye,eyeShape}=await mod,vertices=new Float32Array([-1,-1,1,-1,1,1,-1,1]),options={...eyeShape('startled'),pivot:{x:0,y:0},center:{x:0,y:0},side:1};
  const shaped=warpEye(vertices,options);assert(shaped.every(Number.isFinite));assert(shaped[3]>-1.2&&shaped[3]<-1.1);assert.deepEqual(vertices,new Float32Array([-1,-1,1,-1,1,1,-1,1]));assert.deepEqual(warpEye(vertices,options),shaped);
  const iris=warpEye(vertices,{...options,isIris:true});assert(Math.abs(iris[1])<.8);assert(Math.abs(iris[1])<Math.abs(iris[0])*.85);
  assert.deepEqual(warpEye(vertices,{...options,isBrow:true}),vertices,'Eye widening must never stretch eyebrow thickness');
});
test('mask/lash warp is shared, and both eye sides mirror their tilt',async()=>{
  const {warpEye,eyeShape,mixEyeShape}=await mod,vertices=new Float32Array([-1,0,1,0]),options={...eyeShape('stern'),pivot:{x:0,y:0},center:{x:0,y:0},side:1};
  const left=warpEye(vertices,options),right=warpEye(vertices,{...options,side:-1});assert.equal(left[1],-right[1]);assert.equal(left[3],-right[3]);
  assert.deepEqual(mixEyeShape(eyeShape('neutral'),eyeShape('startled'),0),eyeShape('neutral'));assert.deepEqual(warpEye(vertices,{...options,...eyeShape('neutral')}),vertices);
});
