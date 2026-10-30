import {loadFaceContour} from './wardrobe-contour.js';
const $=id=>document.getElementById(id),clamp=n=>Math.max(0,Math.min(1,n));
export const OUTFITS=[{id:'winter',name:'冬日披肩',description:'原有冬装',preview:'winter-preview.png'},{id:'white',name:'白色大衣',description:'软帽 · 腰间系带',preview:'white-coat-v3.png'},{id:'penguin',name:'企鹅装',description:'圆肚子 · 小领结',preview:'penguin.png'}];
const body=/^ArtMesh(?:Headwear|Topwear|Bottomwear|Handwear|Neck|Legwear|Footwear)/;
function grid(crop,size,nx=16,ny=32){const positions=new Float32Array((nx+1)*(ny+1)*2),uvs=new Float32Array(positions.length),indices=new Uint16Array(nx*ny*6);for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const i=(y*(nx+1)+x)*2;uvs[i]=(crop[0]+crop[2]*x/nx)/size[0];uvs[i+1]=1-(crop[1]+crop[3]*y/ny)/size[1];}let i=0;for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){const a=y*(nx+1)+x,b=a+1,d=a+nx+1;indices.set([a,b,d,b,d+1,d],i);i+=6;}return {positions,uvs,indices,crop,nx,ny};}
function place(mesh,c,point){const {crop,nx,ny,positions}=mesh,p=c.placement,w=c.canvas.clientWidth,h=c.canvas.clientHeight;for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){const i=(y*(nx+1)+x)*2,v=point(crop[0]+crop[2]*x/nx,crop[1]+crop[3]*y/ny);positions[i]=(v.x*2/w-1)/p.scaleX+p.centerX;positions[i+1]=(1-v.y*2/h)/p.scaleY+p.centerY;}}
export async function initWardrobe({character,getPet,onChange}){
  const c=character,images={},textures={};for(const [id,file]of [['white','white-coat-v3.png'],['penguin','penguin.png'],['head','clean-bob-neck-v2.png'],['whiteHair','white-head-v5.png'],['whiteCapErase','white-cap-v6.png'],['whiteCap','white-cap-v12.png']]){const image=new Image();image.src='wardrobe/'+file;await image.decode();images[id]=image;textures[id]=c.textureFromImage(image);}
  const meshes={white:grid([0,268,940,1404],[940,1672]),head:grid([0,0,1,1],[1,1],64,90),fringe:grid([0,0,1,.605],[1,1],64,55),whiteHair:grid([0,0,1,1],[1,1],64,100),whiteFringe:grid([0,0,1,.685],[1,1],64,64),whiteCap:grid([0,0,1,1],[1,1],40,64),lining:grid([0,0,2,2],[2,2],1,1),penguin:grid([0,0,1024,1536],[1024,1536],24,56)};
  const faceContour=await loadFaceContour(c);
  // Follow the longest opaque run per center column, ignoring detached specks.
  const capSource=document.createElement('canvas');capSource.width=images.whiteCap.width;capSource.height=images.whiteCap.height;const capContext=capSource.getContext('2d',{willReadFrequently:true});capContext.drawImage(images.whiteCap,0,0);const capPixels=capContext.getImageData(0,0,capSource.width,capSource.height).data;
  const readCapRim=center=>{const rims=[];for(let k=-4;k<=4;k++){const x=Math.round(capSource.width*(center+k*.007));let start=-1,last=0,gap=0,best=0,rim=0;for(let y=0;y<capSource.height;y++){if(capPixels[(y*capSource.width+x)*4+3]>192){if(start<0)start=y;last=y;gap=0;}else if(start>=0&&++gap>8){if(last-start>best){best=last-start;rim=last;}start=-1;}}if(start>=0&&last-start>best){best=last-start;rim=last;}if(best>capSource.height*.1)rims.push(rim/capSource.height);}return rims.sort((a,b)=>a-b)[Math.floor(rims.length/2)];};
  let capRim=readCapRim(.5);if(!Number.isFinite(capRim))throw Error('独立白帽缺少可定位的前沿。');
  // Measure the main crown above the bow. Use broad contiguous row spans so a
  // large bow or isolated alpha noise cannot inflate the hat body's fit width.
  const bands=[];for(let y=0;y<capSource.height*capRim*.84;y++){let start=-1,best=[0,0];for(let x=0;x<=capSource.width;x++){const solid=x<capSource.width&&capPixels[(y*capSource.width+x)*4+3]>192;if(solid&&start<0)start=x;else if(!solid&&start>=0){if(x-start>best[1]-best[0])best=[start,x];start=-1;}}if(best[1]-best[0]>capSource.width*.1)bands.push(best);}
  bands.sort((a,b)=>(b[1]-b[0])-(a[1]-a[0]));const broad=bands.slice(0,Math.max(3,Math.floor(bands.length*.08))),median=values=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)],capLeft=median(broad.map(b=>b[0]))/capSource.width,capRight=median(broad.map(b=>b[1]))/capSource.width,capSpan=capRight-capLeft,capCenter=(capLeft+capRight)/2,capAspect=capSource.height/capSource.width;
  if(!Number.isFinite(capSpan)||capSpan<=0)throw Error('独立白帽缺少可定位的帽身。');
  capRim=readCapRim(capCenter);if(!Number.isFinite(capRim))throw Error('白帽中央前沿缺失。');
  let capOffset=0;
  const lining=document.createElement('canvas');lining.width=lining.height=2;const ink=lining.getContext('2d');ink.fillStyle='#1b1922';ink.fillRect(0,0,2,2);textures.lining=c.textureFromImage(lining);
  let selected='winter',desired='winter',temporaryOwner=null;
  const preferences=await window.aliceDesktop?.appearanceInfo?.();
  function renderButtons(){for(const button of document.querySelectorAll('[data-outfit]'))button.setAttribute('aria-pressed',String(button.dataset.outfit===desired));$('wardrobe-current').textContent=OUTFITS.find(o=>o.id===desired).name;}
  function display(id){selected=id;c.outfit=id;getPet()?.reaction.release();}
  function set(id,{save=true}={}){if(!OUTFITS.some(o=>o.id===id))return false;const changed=desired!==id;desired=id;if(!temporaryOwner)display(id);if(changed)onChange?.();renderButtons();if(save&&changed)void window.aliceDesktop?.appearanceSave?.({outfit:id});return true;}
  // Temporary costumes affect only this renderer and never emit appearanceSave.
  function wearTemporarily(id,owner){if(!OUTFITS.some(o=>o.id===id)||!owner||temporaryOwner&&temporaryOwner!==owner)return false;temporaryOwner=owner;display(id);return true;}
  function restore(owner){if(temporaryOwner!==owner)return false;temporaryOwner=null;display(desired);return true;}
  for(const outfit of OUTFITS){const b=document.createElement('button');b.type='button';b.dataset.outfit=outfit.id;b.className='outfit-card';const i=new Image();i.src='wardrobe/'+outfit.preview;i.alt='';b.append(i);const name=document.createElement('strong'),desc=document.createElement('small');name.textContent=outfit.name;desc.textContent=outfit.description;b.append(name,desc);b.onclick=()=>set(outfit.id);$('wardrobe-options').append(b);}
  const open=section=>{if(!$('wardrobe-dialog').open)$('wardrobe-dialog').showModal();if(section==='food')$('sushi-section').scrollIntoView({block:'start'});};
  $('wardrobe-tools').onclick=()=>open();$('pet-wardrobe').onclick=()=>open();$('close-wardrobe').onclick=()=>$('wardrobe-dialog').close();
  for(const id of ['feed-sushi','pet-feed'])$(id).addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();open('food');});
  const frame=()=>{const face=c.meshBounds('ArtMeshFace'),hat=c.meshBounds('ArtMeshHeadwear'),feet=[c.meshBounds('ArtMeshFootwearL'),c.meshBounds('ArtMeshFootwearR')];if(!face||!hat||!feet[0])return null;return {face,contour:faceContour(),hat,foot:Math.max(...feet.map(f=>f.bottom)),center:(face.left+face.right)/2,bodyCenter:((c.bounds.minX+c.bounds.maxX)/2-c.placement.centerX)*c.placement.scaleX*c.canvas.clientWidth/2+c.canvas.clientWidth/2};};
  const sample=(pairs,y)=>{if(y<=pairs[0][0])return pairs[0][1];for(let i=1;i<pairs.length;i++)if(y<=pairs[i][0])return pairs[i-1][1]+(pairs[i][1]-pairs[i-1][1])*(y-pairs[i-1][0])/(pairs[i][0]-pairs[i-1][0]);return pairs.at(-1)[1];};
  const holeLeft=[[.52,.3102],[.54,.3166],[.56,.307],[.58,.3134],[.60,.3214],[.62,.3333],[.64,.3469],[.66,.3636],[.68,.3844],[.70,.4083],[.72,.4338],[.74,.4625],[.75,.4777],[.759,.5]],holeRight=[[.52,.681],[.54,.677],[.56,.6707],[.58,.6842],[.60,.677],[.62,.6659],[.64,.6523],[.66,.6356],[.68,.6156],[.70,.5933],[.72,.5686],[.74,.5407],[.75,.5263],[.759,.5]];
  const headPoint=(f,x,y)=>{
    const white=selected==='white',canonical=y-(white ? .08 : 0),lower=clamp((canonical-.565)/(.759-.565)),blend=lower*lower*(3-2*lower);
    let py=f.face.bottom+(canonical-.759)*f.face.height/.39-(f.face.bottom-f.contour.bottom)*blend;
    if(white&&y<.56)py=f.face.top+f.face.height*(-.88+(y-.01)/.55*(.88+1+(.56-.839)/.39));
    const taper=1-.13*clamp(Math.abs(x-.5)/.32)-.06*clamp((canonical-.72)/.19),base=f.center+(x-.5)*f.face.width/.39*taper;
    // Preserve the original hair's pixels and geometry. The old cap is removed
    // in UV space; only the independent cap mesh changes its wearing depth.
    if(white)return {x:base,y:py};
    const side=x<.5?-1:1,edge=sample(side<0?holeLeft:holeRight,y),overlap=Math.max(.75,f.face.width*.012),inner=f.contour.edge(side,py)-side*overlap;
    const a=clamp(side<0?(x-edge+.08)/.08:(edge+.08-x)/.08),influence=a*a*(3-2*a),fit=clamp((canonical-.555)/.045)*clamp((.80-canonical)/.03);
    const taperedEdge=f.center+(edge-.5)*f.face.width/.39*taper;return {x:base+(inner-taperedEdge)*influence*fit,y:py};
  };
  const capFit=f=>{
    // The native neutral upper lash is .195 of the face mesh height below its
    // padded top. Leave more of the bangs visible for the less enclosed fit;
    // this anchor is independent of blinking and does not move the hair.
    const eye=f.face.top+f.face.height*.195,target=eye-(f.contour.bottom-eye)*.20+f.face.height*capOffset;
    return {sourceRim:capRim,sourceSpan:capSpan,sourceCenter:capCenter,eye,target,scale:f.face.width*1.48/capSpan,gap:eye-target,depthPreservesShape:true};
  };
  // Fit the whole cap with uniform scale and translation. Wearing depth never
  // squeezes the crown, native face or original side hair.
  const capPoint=(f,x,y)=>{const fit=capFit(f);return {x:f.center+(x-capCenter)*fit.scale,y:fit.target+(y-capRim)*fit.scale*capAspect};};
  const signature=mesh=>{let hash=0;for(const v of mesh.positions)hash=(Math.imul(hash,31)+Math.round(v*1e6))|0;return hash;};
  const extent=mesh=>{let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;for(let i=0;i<mesh.positions.length;i+=2){left=Math.min(left,mesh.positions[i]);right=Math.max(right,mesh.positions[i]);top=Math.min(top,mesh.positions[i+1]);bottom=Math.max(bottom,mesh.positions[i+1]);}return {width:right-left,height:bottom-top};};
  const wardrobe={
    get selected(){return desired;},get desired(){return desired;},get displayed(){return selected;},get temporaryOwner(){return temporaryOwner;},set,wearTemporarily,restore,open,faceContour:()=>frame()?.contour,
    setCapOffset:value=>{capOffset=Math.max(-.12,Math.min(.12,Number(value)||0));},
    skip:id=>selected!=='winter'&&(body.test(id)||id.includes('Hair')),
    headBounds(){if(c.characterStyle==='chibi'||selected!=='penguin')return c.meshBounds('ArtMeshHeadwear');const f=frame();return f?{left:f.center-f.face.width*1.5,right:f.center+f.face.width*1.5,top:f.hat.top-5,bottom:f.face.bottom+f.face.height*.12,width:f.face.width*3,height:f.face.height*2}:null;},
    drawBack(){if(selected==='winter')return;const f=frame();if(!f)return;if(selected==='penguin'){place(meshes.lining,c,(x,y)=>({x:f.center+(x-1)*f.face.width*.8,y:f.face.top-f.face.height*.6+y/2*f.face.height*1.85}));c.drawTextureMesh(textures.lining,meshes.lining);}else{
      // Hair behind the cheeks closes the aperture while the coat's own neck
      // covers its lower edge. No foreground scarf or collar patch is added.
      place(meshes.lining,c,(x,y)=>({x:f.center+(x-1)*f.face.width*(.55-.19*y/2),y:f.face.top-f.face.height*.2+y/2*(f.contour.bottom-f.face.top+f.face.height*.30)}));c.drawTextureMesh(textures.lining,meshes.lining);
      const neck=f.contour.bottom-f.face.height*.07,scale=f.face.width/139,breath=c.model.parameters.values[c.parameterIndex.ParamBreath]||0;place(meshes.white,c,(x,y)=>{const t=clamp((y-280)/(1668-280)),center=f.center+(f.bodyCenter-f.center)*Math.min(1,t*2),inflate=1+Math.sin(t*Math.PI)*breath*.006;return {x:center+(x-470)*scale*inflate,y:neck+(y-280)/(1668-280)*(f.foot-neck)};});c.drawTextureMesh(textures.white,meshes.white);}
      // The collar and lower hair sit behind the native jaw. Only the fringe
      // returns to the foreground, avoiding a second chin line over the face.
      const mesh=selected==='white'?meshes.whiteHair:meshes.head,texture=selected==='white'?textures.whiteHair:textures.head;place(mesh,c,(x,y)=>headPoint(f,x,y));c.drawTextureMesh(texture,mesh,{eraseTexture:selected==='white'?textures.whiteCapErase:null});
    },
    drawFront(){if(selected==='winter')return;const f=frame();if(!f)return;const mesh=selected==='white'?meshes.whiteFringe:meshes.fringe,texture=selected==='white'?textures.whiteHair:textures.head;place(mesh,c,(x,y)=>headPoint(f,x,y));c.drawTextureMesh(texture,mesh,{eraseTexture:selected==='white'?textures.whiteCapErase:null});if(selected==='white'){place(meshes.whiteCap,c,(x,y)=>capPoint(f,x,y));c.drawTextureMesh(textures.whiteCap,meshes.whiteCap);return;}
      const top=f.hat.top-f.face.height*.08,chin=f.face.bottom+f.face.height*.13,breath=c.model.parameters.values[c.parameterIndex.ParamBreath]||0,stroke=getPet()?.reaction.value||0;
      place(meshes.penguin,c,(x,y)=>{let py;if(y<160)py=top+(y-7)/153*(f.face.top-f.face.height*.48-top);else if(y<383)py=f.face.top-f.face.height*.48+(y-160)/223*(chin-f.face.top+f.face.height*.48);else py=chin+(y-383)/(1510-383)*(f.foot-chin);const t=clamp((y-383)/1127),center=f.center+(f.bodyCenter-f.center)*Math.min(1,t*2),bulge=1+breath*.009*Math.sin(t*Math.PI),flipper=Math.sin(t*Math.PI)*Math.max(0,Math.abs(x-512)-230)/230*stroke*.03;return {x:center+(x-512)*f.face.width/160*(bulge+flipper),y:py};});c.drawTextureMesh(textures.penguin,meshes.penguin);
    },
    diagnostic:()=>({selected:desired,desired,displayed:selected,temporaryOwner,originalFace:true,nativeOutfit:selected==='winter',capFit:selected==='white'&&frame()?capFit(frame()):null,capExtent:extent(meshes.whiteCap),meshes:Object.fromEntries(Object.entries(meshes).map(([k,m])=>[k,{finite:m.positions.every(Number.isFinite),vertices:m.positions.length/2,signature:signature(m)}]))})
  };
  c.wardrobe=wardrobe;set(preferences?.outfit||'winter',{save:false});renderButtons();
  window.aliceDesktop?.onAppearance?.(value=>{if(value.outfit!==desired)set(value.outfit,{save:false});});
  return wardrobe;
}
