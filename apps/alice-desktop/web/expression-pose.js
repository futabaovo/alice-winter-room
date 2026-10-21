const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const expressionCategory=definition=>definition.category||(['smile','rest','bow'].includes(definition.id)?'closed':['displeased','cold','surprised','reserved'].includes(definition.id)?'reaction':'daily');
export function expressionPose({definitions,mood,acting,defaults,intensity}){
  const base=definitions[acting?.baseIndex??mood],active=acting?definitions[acting.index]:base;
  const scaled=item=>item.Value===0&&/^ParamEye[LR]Open$/.test(item.Id)?0:defaults[item.Id]+(item.Value-defaults[item.Id])*intensity;
  const targets=Object.fromEntries(base.expression.Parameters.filter(p=>Number.isFinite(defaults[p.Id])).map(item=>[item.Id,scaled(item)]));
  // Small face changes must remain readable; keep head/body motion restrained.
  const faceWeight=acting?clamp(acting.strength/.6)*acting.weight:1;
  if(acting)for(const item of active.expression.Parameters){
    if(!Number.isFinite(defaults[item.Id]))continue;
    const closed=item.Value===0&&/^ParamEye[LR]Open$/.test(item.Id),facial=/^Param(?:Eye|Brow|Mouth)/.test(item.Id);
    const amount=closed?acting.weight:facial?faceWeight:acting.strength*acting.weight;
    const from=targets[item.Id]??defaults[item.Id];targets[item.Id]=from+(scaled(item)-from)*amount;
  }
  const mix=(a,b,w)=>a+(b-a)*w,weight=acting?faceWeight:1;
  const gain=definition=>definition.gazeInfluence??({thinking:.3,downcast:.2,reserved:.25,cold:.2,rest:0,smile:0,bow:0}[definition.id]??1);
  return {targets,faceShadow:mix(base.faceShadow||0,active.faceShadow||0,weight)*intensity,
    spiral:mix(base.effects?.spiral||0,active.effects?.spiral||0,weight)*intensity,
    gazeInfluence:mix(gain(base),gain(active),weight)};
}
