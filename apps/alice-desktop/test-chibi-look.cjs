const test=require('node:test'),assert=require('node:assert/strict');
const modulePromise=import('./web/chibi-look.js');
const face={left:840,top:200,width:120,height:90,bottom:290},viewport={width:1360,height:900};
test('Q版以人物头部判断左右，窗口右半边也可以位于人物左边',async()=>{
  const {chibiPointerLook}=await modulePromise;
  assert(chibiPointerLook({x:720,y:245},face,viewport).x<0);
  assert.equal(chibiPointerLook({x:900,y:245},face,viewport).x,0);
  assert(chibiPointerLook({x:1150,y:245},face,viewport).x>0);
  assert.equal(chibiPointerLook({x:910,y:246},face,viewport).x,0,'center dead zone prevents jitter');
  for(const p of [{x:0,y:0},{x:1360,y:900}]){const v=chibiPointerLook(p,face,viewport);assert(Math.abs(v.x)<=.75&&Math.abs(v.y)<=.55);}
  assert.deepEqual(chibiPointerLook(null,face,viewport),{x:0,y:0,active:false});
  assert.equal(chibiPointerLook({x:NaN,y:0},face,viewport).active,false);
});
test('窗口和人物同步缩放后保持相同方向与强度',async()=>{
  const {chibiPointerLook}=await modulePromise,point={x:700,y:500},a=chibiPointerLook(point,face,viewport);
  const b=chibiPointerLook({x:350,y:250},Object.fromEntries(Object.entries(face).map(([k,v])=>[k,v/2])),{width:680,height:450});
  assert.deepEqual(a,b);
});
test('鼠标左右与高低不再强制切到思考、侧目或垂眸表情',async()=>{
  const {ChibiCharacter}=await import('./web/chibi.js'),original=global.document;
  global.document={documentElement:{classList:{contains:()=>false}}};
  try{
    const ids=['ParamEyeBallX','ParamEyeBallY','ParamEyeLOpen','ParamEyeROpen','ParamMouthOpenY'];
    const character={outfit:'winter',chibiState:{moodId:'neutral'},parameterIndex:Object.fromEntries(ids.map((id,i)=>[id,i])),model:{parameters:{values:new Float32Array([0,0,1,1,0])}}},chibi=Object.create(ChibiCharacter.prototype);chibi.character=character;
    for(const outfit of ['winter','white','penguin'])for(const x of [-.7,0,.7])for(const y of [-.5,0,.5]){character.outfit=outfit;character.model.parameters.values[0]=x;character.model.parameters.values[1]=y;assert.equal(chibi.choose().index,0);}
    character.chibiState.moodId='thinking';assert.equal(chibi.choose().index,5,'authored emotion remains selectable');
    character.chibiState.moodId='neutral';character.chibiState.speaking=true;character.model.parameters.values[4]=.3;assert.equal(chibi.choose().index,3,'speech mouth still animates');
  }finally{global.document=original;}
});
