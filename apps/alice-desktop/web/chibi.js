// The illustrated model still supplies the common speech/emotion parameters.
// Q版 draws its own transparent sprites into the SAME character WebGL canvas,
// keeping hit testing, screenshots and native desktop transparency consistent.
import {ChibiEyeLayers} from './chibi-eyes.js';
import {chibiHeadMesh,chibiHeadPose,chibiHeadPoint} from './chibi-head.js';
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const ids=['neutral','smile','displeased','surprised','reserved','thinking','rest','cold','downcast','aside','bow','softSmile','stern','speechless','skeptical','smug','sigh','startled','puzzled','dizzy'];
const rect=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height,width,height});
export class ChibiCharacter{
  constructor(character){this.character=character;this.surface=document.createElement('canvas');this.surface.width=512;this.surface.height=640;this.ctx=this.surface.getContext('2d');this.images={};this.frames={};this.last=null;this.bounds={};this.cacheKey='';}
  async load(){
    const manifest=await fetch('chibi/atlas.json').then(r=>{if(!r.ok)throw Error('Q 版动作目录缺失。');return r.json();});
    await Promise.all(Object.entries(manifest.sheets).map(async([id,sheet])=>{const image=new Image();image.src='chibi/'+sheet.image;await image.decode();if(image.width!==sheet.width||image.height!==sheet.height)throw Error('Q 版动作图尺寸不符：'+id);this.images[id]=image;this.frames[id]=sheet.grid?this.readGrid(image,...sheet.grid):sheet.frames.map(f=>f.rect);}));
    this.texture=this.character.textureFromImage(this.surface);
    this.mesh=chibiHeadMesh();this.eyes=new ChibiEyeLayers();
    // Texture coordinates follow the renderer's top-left UV convention.
    this.ready=true;const preview=document.getElementById('character-chibi-preview');if(preview)this.preview(preview);
  }
  readGrid(image,columns,rows){
    const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0);const p=g.getImageData(0,0,c.width,c.height).data,hist=Array.from({length:c.height},()=>0);
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(p[(y*c.width+x)*4+3]>180)hist[y]++;
    const inkRows=hist.flatMap((v,y)=>v>columns?[y]:[]),inkTop=inkRows[0],inkBottom=inkRows.at(-1)+1,cellHeight=(inkBottom-inkTop)/rows;
    const edges=[0];for(let n=1;n<rows;n++){const center=inkTop+cellHeight*n,span=cellHeight*.18;let best=Math.round(center),score=Infinity;for(let y=Math.round(center-span);y<center+span;y++){let v=0;for(let k=-2;k<=2;k++)v+=hist[y+k]||0;v+=Math.abs(y-center)*.005;if(v<score){best=y;score=v;}}edges.push(best);}edges.push(c.height);
    const out=[];for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){const x0=Math.floor(c.width*col/columns),x1=Math.floor(c.width*(col+1)/columns),y0=edges[row],y1=edges[row+1];let left=x1,right=x0,top=y1,bottom=y0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(p[(y*c.width+x)*4+3]>180){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}if(right<=left||bottom<=top)throw Error('Q 版表情帧缺失。');out.push([Math.max(x0,left-2),Math.max(y0,top-2),Math.min(x1,right+3)-Math.max(x0,left-2),Math.min(y1,bottom+3)-Math.max(y0,top-2)]);}return out;
  }
  preview(canvas){const g=canvas.getContext('2d'),f=this.frames.basic[0],s=Math.min(canvas.width/f[2],canvas.height/f[3]);g.clearRect(0,0,canvas.width,canvas.height);g.drawImage(this.images.basic,...f,(canvas.width-f[2]*s)/2,(canvas.height-f[3]*s)/2,f[2]*s,f[3]*s);}
  value(id){const c=this.character;return c.model.parameters.values[c.parameterIndex[id]]||0;}
  choose(){
    const c=this.character,s=c.chibiState||{},outfit=c.outfit||'winter',meal=s.meal,cup=s.cup,book=c.bookProgress||0;let sheet=outfit==='winter'?'basic':'outfits',index=outfit==='penguin'?4:0,action='idle',face=true;
    if(outfit==='winter'){
      if(meal?.busy&&!['queued','dragging','cancelled'].includes(meal.phase)){sheet='tea';index=meal.phase==='approach'||meal.phase==='offer'||meal.phase==='second-bite'?0:meal.phase==='bite'?1:meal.phase==='swallow'?3:2;action='feeding';face=false;}
      else if(cup?.busy&&cup.weight>.01){sheet='tea';index=cup.phase==='approach'?7:cup.phase==='inspect'?8:cup.phase==='sip'?9:cup.phase==='lower'?7:['bitter','weak','flat'].includes(cup.cup?.feeling)?11:10;action='tea';face=false;}
      else if(s.brewing){sheet='tea';index=s.brewProgress<.25?4:s.brewProgress<.76?5:6;action='brewing';face=false;}
      else if(book>.015){sheet='book';face=false;action='book';index=(c.peekCover||0)>.5?(c.peekDirection>0?5:6):book<.2?0:book<.48?1:book<.78?2:s.book?.phase==='thinking'?8:3;}
      else if(s.gesture?.type==='bow'){sheet='basic';index=9;action='bow';face=false;}
    }else if(outfit==='white'){
      if(cup?.busy&&cup.weight>.05){index=3;action='tea';face=false;}
      else if(book>.04){index=(c.peekCover||0)>.5?1:book>.75?9:1;action='book';face=false;}
      else if(s.gesture?.type==='bow'){index=8;action='bow';face=false;}
      else if(meal?.busy&&!['dragging','queued'].includes(meal.phase)){index=2;action='feeding';}
    }else{
      if((c.peekCover||0)>.1){index=c.peekDirection>0?7:6;action='peek';face=false;}
      else if(book>.04){index=5;action='petting';}
      else if(meal?.phase==='swallow'||cup?.feeling>.1){index=['bitter','flat','weak'].includes(cup?.cup?.feeling)?11:10;action='pleased';face=false;}
    }
    if(document.documentElement.classList.contains('farewell-active')){sheet=outfit==='winter'?'basic':'outfits';index=outfit==='winter'?11:outfit==='white'?8:5;action='goodbye';face=false;}
    if(face){
      let mood=ids.indexOf(s.moodId);if(mood<0)mood=0;
      if(action==='idle'&&(s.blink??1)<.22&&![1,5,6,9,10,16,18,19].includes(mood))mood=6;
      // Direction comes from independent pupils. Thinking and
      // aside are authored emotions, and both original sprites face right.
      if((s.speaking||action==='feeding')&&this.value('ParamMouthOpenY')>.12)mood=mood===6||mood===1?16:3;
      sheet='idle-'+outfit;index=mood;face=false;
    }
    return {sheet,index,action,face,outfit};
  }
  paint(pose){
    const g=this.ctx,W=this.surface.width,H=this.surface.height,f=this.frames[pose.sheet][pose.index],unit=pose.sheet.startsWith('idle-')?this.frames[pose.sheet][0][3]:pose.sheet==='outfits'?(pose.outfit==='penguin'?290:354):337;
    const scale=570/unit,w=f[2]*scale,h=f[3]*scale,x=(W-w)/2,y=H-25-h;
    g.clearRect(0,0,W,H);g.drawImage(this.images[pose.sheet],...f,x,y,w,h);
    const metrics=pose.outfit==='winter'?{x:.50,y:.42,w:.56,h:.19,mouth:.477,hat:.33}:pose.outfit==='white'?{x:.50,y:.372,w:.53,h:.19,mouth:.427,hat:.28}:{x:.50,y:pose.sheet.startsWith('idle-')?.40:.37,w:.39,h:.24,mouth:pose.sheet.startsWith('idle-')?.48:.445,hat:.23};
    if(pose.sheet==='idle-winter')metrics.mouth=.453;
    // The eating frames turn her face toward the offered bite. Their lips are
    // right of the body center; using the frontal anchor feeds her cheek.
    if(pose.sheet==='tea'&&pose.index<4){metrics.x=.68;metrics.mouth=.443;}
    const face=rect(x+w*(metrics.x-metrics.w/2),y+h*(metrics.y-metrics.h/2),w*metrics.w,h*metrics.h),mouth={x:x+w*metrics.x,y:y+h*metrics.mouth};
    const body=rect(x,y,w,h),hat=rect(x+w*.08,y,w*.84,h*metrics.hat);
    this.local={body,face,mouth,hat};this.painted={...pose,expression:this.character.chibiState?.moodId};
    this.eyes.prepare(this.surface,face,pose);
  }
  render(){
    const c=this.character,g=c.gl,cv=c.canvas,l=c.locations,dpr=Math.min(devicePixelRatio,2),width=Math.round(cv.clientWidth*dpr),height=Math.round(cv.clientHeight*dpr);
    if(cv.width!==width||cv.height!==height){cv.width=width;cv.height=height;}
    const pose=this.choose(),s=c.chibiState||{},opening=this.value('ParamMouthOpenY')>.12;
    const cache=[pose.sheet,pose.index,pose.outfit,s.moodId,opening].join(':');
    const look=pose.action==='idle'&&!s.gesture?s.look:{x:0,y:0},blink=pose.action==='idle'?(s.blink??1):1,eyeKey=[cache,Math.round((look?.x||0)*1000),Math.round((look?.y||0)*1000),Math.round(blink*1000)].join(':');
    const poseChanged=cache!==this.cacheKey;
    if(poseChanged){this.paint(pose);this.cacheKey=cache;}
    if(poseChanged||eyeKey!==this.eyeKey){this.eyes.paint(this.ctx,look,blink);g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,this.texture);g.texSubImage2D(g.TEXTURE_2D,0,0,0,g.RGBA,g.UNSIGNED_BYTE,this.surface);this.eyeKey=eyeKey;}
    g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,width,height);g.useProgram(c.program);g.disable(g.STENCIL_TEST);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);g.uniform2f(l.scale,1,1);g.uniform2f(l.center,0,0);g.uniform2f(l.viewport,width,height);g.activeTexture(g.TEXTURE1);g.bindTexture(g.TEXTURE_2D,c.dummyMask);g.activeTexture(g.TEXTURE0);
    const W=cv.clientWidth,H=cv.clientHeight,mode=c.mode,zoom=c.zoom||1;
    let bodyHeight=(mode==='pet'?(c.petHeight??.78)*.94:mode==='room'?.64:mode==='full'?.83:mode==='face'?2.25:1.16)*H*zoom;
    if(mode!=='face'&&mode!=='portrait')bodyHeight=Math.min(bodyHeight,W*(mode==='pet'?1.32:1.15));
    const dock=document.getElementById('chat-panel')?.getBoundingClientRect(),roomBottom=(mode==='room'||mode==='full')&&dock?.top>H*.3?Math.min(H*.89,dock.top-14):H*.89;
    if(mode==='full')bodyHeight=Math.min(bodyHeight,roomBottom-H*.05);
    const scale=bodyHeight/570,breath=1+Math.sin((s.clock||0)*1.5)*.003*(s.idle?1:0);
    let angle=this.value('ParamAngleZ')*.0035,dx=this.value('ParamAngleX')*.0015*bodyHeight,dy=this.value('ParamAngleY')*.00065*bodyHeight;
    const elapsed=s.gesture?(s.clock-s.gesture.start):2;if(elapsed<1.5&&s.gesture?.type==='nod')dy+=Math.sin(elapsed*7)*bodyHeight*.01*Math.sin(elapsed*Math.PI/1.5);
    const centerX=(c.anchorX??.69)*W+dx,bottom=(mode==='pet'?(c.petGround??.945)*H:mode==='room'||mode==='full'?roomBottom:mode==='face'?1.61*H:1.19*H)+dy;
    const head=chibiHeadPose({idle:s.idle,action:pose.action,gesture:s.gesture,look:s.headLook||look});
    const pivot={x:centerX,y:bottom},basePoint=(x,y)=>{const px=(x-256)*scale*breath,py=(y-615)*scale;return {x:pivot.x+px*Math.cos(angle)-py*Math.sin(angle),y:pivot.y+px*Math.sin(angle)+py*Math.cos(angle)};},point=(x,y)=>{const p=chibiHeadPoint(x,y,this.local.face,head);return basePoint(p.x,p.y);};
    for(let i=0;i<this.mesh.local.length;i+=2){const p=point(this.mesh.local[i],this.mesh.local[i+1]);this.mesh.positions[i]=p.x*2/W-1;this.mesh.positions[i+1]=1-p.y*2/H;}
    c.drawTextureMesh(this.texture,this.mesh);g.uniform1i(l.useMask,0);c.frames++;c.drawn=1;
    c.placement={anchorX:c.anchorX,scaleX:1,scaleY:1,centerX:0,centerY:0,ground:bottom/H,chibi:true};
    const bounds=r=>{const pts=[point(r.left,r.top),point(r.right,r.top),point(r.left,r.bottom),point(r.right,r.bottom)],xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return rect(Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys));};
    const local=this.local;this.bounds={face:bounds(local.face),hat:bounds(local.hat),body:bounds(local.body)};const m=point(local.mouth.x,local.mouth.y);this.bounds.mouth=rect(m.x-bodyHeight*.012,m.y-bodyHeight*.009,bodyHeight*.024,bodyHeight*.018);
    this.last={...this.painted,height:bodyHeight,angle,position:pivot,bounds:this.bounds};
    const a=basePoint(local.face.left,local.face.top),b=basePoint(local.face.right,local.face.bottom);
    this.trackingFace=rect(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.abs(b.x-a.x),Math.abs(b.y-a.y));
    this.last.look={x:look?.x||0,y:look?.y||0};
    this.last.head=head;
  }
  meshBounds(id){if(!this.last)return null;if(id==='ArtMeshFace')return this.bounds.face;if(id==='ArtMeshHeadwear')return this.bounds.hat;if(id.startsWith('ArtMeshMouth'))return this.bounds.mouth;if(id.startsWith('ArtMeshFootwear'))return rect(this.bounds.body.left,this.bounds.body.bottom-this.bounds.body.height*.035,this.bounds.body.width,this.bounds.body.height*.035);if(id==='ArtMeshTopwear')return this.bounds.body;return this.bounds.body;}
  diagnostic(){return {ready:this.ready,frameCount:Object.values(this.frames).reduce((n,a)=>n+a.length,0),pose:this.last,eyes:this.eyes?.diagnostic(),cacheKey:this.cacheKey};}
}
