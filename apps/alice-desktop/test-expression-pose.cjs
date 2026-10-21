const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const catalog=require('./character/expressions.json'),{base}=require('./prepare-expressions.cjs'),{moods,normalizeEvents}=require('./reply-plan.cjs'),{replySchema,persona}=require('./chat-host.cjs');
const definitions=catalog.map(d=>({...d,expression:{Parameters:Object.entries({...base,...d.parameters}).map(([Id,Value])=>({Id,Value}))}}));
const modulePromise=import('data:text/javascript;base64,'+fs.readFileSync(path.join(__dirname,'web/expression-pose.js')).toString('base64'));
const index=id=>moods.indexOf(id);
test('new expressions reach model-facing catalog, schema and persona without changing old indices',()=>{
  assert.equal(moods.length,20);assert.equal(new Set(moods).size,20);assert.equal(index('bow'),10);assert.deepEqual(replySchema.properties.expressionEvents.items.properties.emotion.enum,moods);
  for(const id of moods){assert(persona.includes(id),id);const event={sentenceIndex:0,emotion:id,strength:.35,hold:1};if(id!=='neutral')assert.equal(normalizeEvents([event],'そう。')[0].emotion,id);}
});
test('subtle facial differential is visible at ordinary auto strength while head motion stays restrained',async()=>{
  const {expressionPose}=await modulePromise,pose=expressionPose({definitions,mood:0,acting:{baseIndex:0,index:index('speechless'),strength:.35,weight:1},defaults:base,intensity:.8});
  assert(pose.targets.ParamEyeLOpen<.75);assert(pose.targets.ParamEyeLOpen>.43);assert(Math.abs(pose.targets.ParamAngleY)<1);assert(pose.gazeInfluence<.6);
});
test('all authored closures stay closed at every intensity; optional effects clear on neutral',async()=>{
  const {expressionPose}=await modulePromise;
  for(const id of ['smile','rest','bow','sigh'])for(const intensity of [.2,.8,1]){const pose=expressionPose({definitions,mood:index(id),defaults:base,intensity});assert.equal(pose.targets.ParamEyeLOpen,0);assert.equal(pose.targets.ParamEyeROpen,0);}
  assert.equal(expressionPose({definitions,mood:index('dizzy'),defaults:base,intensity:1}).spiral,1);
  assert.equal(expressionPose({definitions,mood:0,defaults:base,intensity:1}).spiral,0);
});
test('event envelopes release every parameter and effect exactly to the selected base',async()=>{
  const {expressionPose}=await modulePromise;
  for(const id of moods)for(const intensity of [.2,.8,1]){
    const resting=expressionPose({definitions,mood:index(id),defaults:base,intensity});
    const released=expressionPose({definitions,mood:index('dizzy'),acting:{baseIndex:index(id),index:index('dizzy'),strength:.4,weight:0},defaults:base,intensity});assert.deepEqual(released,resting);
  }
});
test('half-lidded and side-glance profiles reduce pointer influence rather than overwrite it',async()=>{
  const {expressionPose,expressionCategory}=await modulePromise;
  const get=id=>expressionPose({definitions,mood:index(id),defaults:base,intensity:1});
  assert.equal(get('neutral').gazeInfluence,1);assert(get('thinking').gazeInfluence<.5);assert(get('skeptical').gazeInfluence<.3);assert.equal(get('dizzy').gazeInfluence,0);
  assert.equal(expressionCategory(definitions[index('sigh')]),'closed');assert.equal(expressionCategory(definitions[index('dizzy')]),'special');
});
