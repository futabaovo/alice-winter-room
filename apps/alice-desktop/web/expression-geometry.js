const clamp=n=>Math.max(0,Math.min(1,n));
const shapes={
  surprised:{round:.7,iris:.98,irisY:.82},startled:{round:1,iris:.96,irisY:.8},puzzled:{round:.4,iris:.99,irisY:.86},dizzy:{round:.65,iris:.95,irisY:.78},
  stern:{tilt:.10,brow:.18},displeased:{tilt:.035,brow:.12},cold:{brow:.09},skeptical:{brow:.10},smug:{brow:-.055}
};
export function eyeShape(id){return {round:0,iris:1,irisY:1,tilt:0,brow:0,...shapes[id]};}
export function mixEyeShape(base,active,weight){return Object.fromEntries(Object.keys(base).map(k=>[k,base[k]+(active[k]-base[k])*weight]));}
export function warpEye(vertices,{pivot,round=0,iris=1,irisY=1,tilt=0,brow=0,shiftY=0,side=1,isIris=false,isBrow=false,center}){
  const out=new Float32Array(vertices.length),sx=isIris?iris:1,sy=isBrow?1:isIris?iris*irisY:1+round*.16;
  const origin=isIris||isBrow?center:pivot;
  for(let i=0;i<vertices.length;i+=2){const x=vertices[i]-origin.x,y=vertices[i+1]-origin.y;out[i]=origin.x+x*sx;out[i+1]=origin.y+y*sy+x*side*(isBrow?brow:tilt)+shiftY;}
  return out;
}
const bounds=vertices=>{let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity;for(let n=0;n<vertices.length;n+=2){left=Math.min(left,vertices[n]);right=Math.max(right,vertices[n]);bottom=Math.min(bottom,vertices[n+1]);top=Math.max(top,vertices[n+1]);}return {x:(left+right)/2,y:(bottom+top)/2,bottom,top};};
// Rebuild from this frame's native vertices; never accumulate deformations or
// alter the head/hair meshes. White mask and lashes share the same affine warp.
export function prepareExpressionGeometry(character){
  const c=character,d=c.model.drawables,shape=c.expressionShape||eyeShape('neutral');c.expressionGeometry??=new Map();c.expressionGeometry.clear();
  if(!shape.round&&!shape.tilt&&!shape.brow&&shape.iris===1&&shape.irisY===1)return;
  const center=bounds(d.vertexPositions[d.ids.indexOf('ArtMeshFace')]);
  for(const side of ['L','R']){
    const white=d.ids.indexOf('ArtMeshEyewhite'+side),pivot=bounds(d.vertexPositions[white]),open=c.model.parameters.values[c.parameterIndex['ParamEye'+side+'Open']],amount=clamp(open/.8);
    for(const type of ['Eyewhite','Eyelash','Irides','Eyebrow']){
      const index=d.ids.indexOf('ArtMesh'+type+side);if(index<0)continue;
      const vertices=d.vertexPositions[index],origin=bounds(vertices),round=shape.round*amount,iris=1+(shape.iris-1)*amount,irisY=1+(shape.irisY-1)*amount;
      // Round the normally elongated iris without exposing a lower white crescent.
      const lowerLid=pivot.y+(pivot.bottom-pivot.y)*(1+round*.16),irisBottom=origin.y+(origin.bottom-origin.y)*iris*irisY;
      const shiftY=type==='Irides'&&irisY<1?Math.min(0,lowerLid-irisBottom-(pivot.top-pivot.bottom)*.04):0;
      c.expressionGeometry.set(index,warpEye(vertices,{...shape,round,tilt:shape.tilt*amount,iris,irisY,shiftY,pivot,center:origin,side:pivot.x<center.x?-1:1,isIris:type==='Irides',isBrow:type==='Eyebrow'}));
    }
  }
}
