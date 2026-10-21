// Track the visible face, rather than its mesh's transparent padding. UV-space
// edge samples keep following the original Cubism triangles as the head moves.
export async function loadFaceContour(character){
  const d=character.model.drawables,index=d.ids.indexOf('ArtMeshFace'),uv=d.vertexUvs[index],indices=d.indices[index];
  const source=new Image();source.src=character.base+character.setting.FileReferences.Textures[d.textureIndices[index]];await source.decode();
  let minU=1,maxU=0,minV=1,maxV=0;
  for(let i=0;i<uv.length;i+=2){minU=Math.min(minU,uv[i]);maxU=Math.max(maxU,uv[i]);minV=Math.min(minV,uv[i+1]);maxV=Math.max(maxV,uv[i+1]);}
  const x0=Math.floor(minU*source.width),y0=Math.floor((1-maxV)*source.height),width=Math.ceil(maxU*source.width)-x0+1,height=Math.ceil((1-minV)*source.height)-y0+1;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const context=canvas.getContext('2d',{willReadFrequently:true});context.drawImage(source,-x0,-y0);
  const pixels=context.getImageData(0,0,width,height).data,triangles=[];
  for(let i=0;i<indices.length;i+=3){const a=indices[i]*2,b=indices[i+1]*2,c=indices[i+2]*2,den=(uv[b+1]-uv[c+1])*(uv[a]-uv[c])+(uv[c]-uv[b])*(uv[a+1]-uv[c+1]);if(Math.abs(den)>1e-12)triangles.push({a,b,c,den});}
  const locate=(u,v)=>{for(const t of triangles){const p=((uv[t.b+1]-uv[t.c+1])*(u-uv[t.c])+(uv[t.c]-uv[t.b])*(v-uv[t.c+1]))/t.den,q=((uv[t.c+1]-uv[t.a+1])*(u-uv[t.c])+(uv[t.a]-uv[t.c])*(v-uv[t.c+1]))/t.den;if(p>=-1e-5&&q>=-1e-5&&p+q<=1.00001)return {...t,p,q,r:1-p-q};}return null;};
  const left=[],right=[];
  for(let y=0;y<height;y++){
    let lo=null,hi=null;
    for(let x=0;x<width;x++){if(pixels[(y*width+x)*4+3]<192)continue;const at=locate((x0+x+.5)/source.width,1-(y0+y+.5)/source.height);if(at){lo??=at;hi=at;}}
    if(lo&&hi){left.push(lo);right.push(hi);}
  }
  if(left.length<8)throw Error('无法读取衣装所需的原脸部透明轮廓。');
  const lookup=(points,y)=>{if(y<=points[0].y)return points[0].x;if(y>=points.at(-1).y)return points.at(-1).x;let lo=0,hi=points.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(points[mid].y<y)lo=mid;else hi=mid;}const a=points[lo],b=points[hi];return a.x+(b.x-a.x)*(y-a.y)/Math.max(1e-6,b.y-a.y);};
  return ()=>{
    const vertices=d.vertexPositions[index],p=character.placement,w=character.canvas.clientWidth,h=character.canvas.clientHeight;
    const map=at=>({x:(((vertices[at.a]*at.p+vertices[at.b]*at.q+vertices[at.c]*at.r)-p.centerX)*p.scaleX+1)*w/2,y:(1-((vertices[at.a+1]*at.p+vertices[at.b+1]*at.q+vertices[at.c+1]*at.r)-p.centerY)*p.scaleY)*h/2});
    const l=left.map(map).sort((a,b)=>a.y-b.y),r=right.map(map).sort((a,b)=>a.y-b.y),bottom=Math.max(l.at(-1).y,r.at(-1).y);
    return {left:l,right:r,bottom,edge:(side,y)=>lookup(side<0?l:r,y)};
  };
}
