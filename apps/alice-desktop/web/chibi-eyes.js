// Independent iris layers clipped by fixed eyelids; the character mesh stays rigid.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const closed=new Set([1,6,10,16,19]);
const purple=(p,i)=>p[i+3]>200&&p[i+2]-p[i]>5&&(p[i]+p[i+1]+p[i+2])/3<190;
const white=(p,i)=>p[i+3]>200&&p[i]>170&&p[i+1]>165&&p[i+2]>160&&Math.max(p[i],p[i+1],p[i+2])-Math.min(p[i],p[i+1],p[i+2])<42;
export function findChibiEyes(p,width,height,face,outfit='winter',index=0){
  const eyes=[],cx=face.left+face.width/2;
  const eyeY=face.top+face.height*(outfit==='winter'?.34:outfit==='white'?.53:.55);
  for(const side of [-1,1]){
    const split=cx+(outfit==='winter'&&index===9?face.width*.15:0);
    const x0=Math.max(1,Math.floor(side<0?face.left-face.width*.18:split)),x1=Math.min(width-2,Math.ceil(side<0?split:face.right+face.width*.18));
    const y0=Math.max(1,Math.floor(face.top+face.height*(outfit==='winter'?-.05:.1))),y1=Math.min(height-2,Math.ceil(face.bottom-face.height*.02));
    const seen=new Set(),groups=[];
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
      const at=y*width+x;if(seen.has(at)||!purple(p,at*4))continue;
      const stack=[at],pixels=[];seen.add(at);let left=x,right=x,top=y,bottom=y,edge=false;
      while(stack.length){
        const n=stack.pop(),px=n%width,py=Math.floor(n/width);pixels.push(n);left=Math.min(left,px);right=Math.max(right,px);top=Math.min(top,py);bottom=Math.max(bottom,py);
        if(px===x0||px===x1||py===y0||py===y1)edge=true;
        for(const next of [n-1,n+1,n-width,n+width]){
          const nx=next%width,ny=Math.floor(next/width);
          if(nx<x0||nx>x1||ny<y0||ny>y1||seen.has(next)||!purple(p,next*4))continue;
          seen.add(next);stack.push(next);
        }
      }
      const w=right-left+1,h=bottom-top+1;
      if(edge||w<face.width*.065||w>face.width*.34||h<face.height*.07||h>face.height*.57||pixels.length<28)continue;
      const mid=(top+bottom)/2,expectedX=cx+side*face.width*.25;
      const score=pixels.length*Math.exp(-Math.abs(mid-eyeY)/(face.height*.28)-Math.abs((left+right)/2-expectedX)/(face.width*.3));
      groups.push({side,left,right,top,bottom,width:w,height:h,cx:(left+right)/2,cy:mid,pixels,score});
    }
    const e=groups.sort((a,b)=>b.score-a.score)[0];if(!e)continue;
    const rows=[];
    for(let y=e.top;y<=e.bottom;y++){
      const line=e.pixels.filter(n=>Math.floor(n/width)===y),xs=line.map(n=>n%width);
      if(xs.length)rows.push({y,left:Math.min(...xs),right:Math.max(...xs)});
    }
    let light=[242,239,235],bestLight=0;
    const opening=rows.map(row=>{
      let l=row.left,r=row.right;const limitL=Math.max(x0,l-e.width*.3),limitR=Math.min(x1,r+e.width*.3);
      for(let x=l-1;x>=limitL;x--){const i=(row.y*width+x)*4;if(!white(p,i))break;l=x;}
      for(let x=r+1;x<=limitR;x++){const i=(row.y*width+x)*4;if(!white(p,i))break;r=x;}
      for(const x of [l,r]){const i=(row.y*width+x)*4,b=p[i]+p[i+1]+p[i+2];if(white(p,i)&&b>bestLight){bestLight=b;light=[p[i],p[i+1],p[i+2]];}}
      return {y:row.y,left:l,right:r,irisLeft:row.left,irisRight:row.right};
    });
    const rgb=(x,y)=>{const i=(Math.round(y)*width+Math.round(x))*4;return Array.from(p.slice(i,i+3));};
    eyes.push({...e,rows:opening,light,inkTop:rgb(e.cx,e.top+e.height*.28),inkBottom:rgb(e.cx,e.top+e.height*.76),socketX:(Math.min(...opening.map(r=>r.left))+Math.max(...opening.map(r=>r.right)))/2});
  }
  return eyes;
}
export class ChibiEyeLayers{
  constructor(){this.ready=false;this.eyes=[];this.last=[];this.cache=new Map();}
  prepare(source,face,pose){
    const key=[pose.sheet,pose.index,pose.outfit].join(':');
    if(this.cache.has(key)){const saved=this.cache.get(key);this.cache.delete(key);this.cache.set(key,saved);Object.assign(this,saved);this.last=[];this.pose=pose;this.ready=true;return;}
    this.basePixels=source.getContext('2d').getImageData(0,0,512,640);this.eyes=[];this.last=[];this.pose=pose;this.ready=true;
    if(!pose.sheet.startsWith('idle-')||closed.has(pose.index))return;
    const found=findChibiEyes(this.basePixels.data,512,640,face,pose.outfit,pose.index);if(found.length!==2)return;
    for(const eye of found){const left=Math.min(...eye.rows.map(r=>r.left)),right=Math.max(...eye.rows.map(r=>r.right))+1;this.eyes.push({...eye,aperture:{left:left-1,right:right+1,top:eye.top,bottom:eye.bottom}});}
    this.cache.set(key,{basePixels:this.basePixels,eyes:this.eyes});if(this.cache.size>6)this.cache.delete(this.cache.keys().next().value);
  }
  paint(g,look){
    const frame=new ImageData(new Uint8ClampedArray(this.basePixels.data),512,640),p=frame.data,original=this.basePixels.data;this.last=[];
    const x=clamp(Number.isFinite(look?.x)?look.x:0,-1,1),y=clamp(Number.isFinite(look?.y)?look.y:0,-1,1);
    const sample=(sx,sy,k)=>{sx=clamp(sx,0,510);sy=clamp(sy,0,638);const ix=Math.floor(sx),iy=Math.floor(sy),fx=sx-ix,fy=sy-iy,a=(iy*512+ix)*4;return (original[a+k]*(1-fx)+original[a+4+k]*fx)*(1-fy)+(original[a+2048+k]*(1-fx)+original[a+2052+k]*fx)*fy;};
    for(const eye of this.eyes){
      const dx=x*eye.width*.16,dy=-y*eye.height*.1,a=eye.aperture;
      // Displace the original iris texture, retaining its highlights and shading.
      if(Math.abs(dx)+Math.abs(dy)>.001)for(let py=Math.ceil(eye.top);py<=eye.bottom;py++)for(let px=Math.ceil(a.left);px<=a.right;px++){
        const u=clamp((px-a.left)/(a.right-a.left),0,1),v=clamp((py-eye.top)/(eye.bottom-eye.top+1),0,1),weight=Math.pow(Math.sin(u*Math.PI),.8)*Math.pow(Math.sin(v*Math.PI),.45);
        if(weight<.001)continue;const at=(py*512+px)*4;for(let k=0;k<3;k++)p[at+k]=sample(px-dx*weight,py-dy*weight,k);
      }
      this.last.push({side:eye.side,dx,dy,cx:eye.cx+dx,cy:eye.cy+dy});
    }
    g.putImageData(frame,0,0);
  }
  diagnostic(){return {mode:'original-iris-layers',count:this.eyes.length,eyes:this.eyes.map(({side,left,right,top,bottom,width,height,cx,cy,socketX})=>({side,left,right,top,bottom,width,height,cx,cy,socketX})),pupils:this.last};}
}
