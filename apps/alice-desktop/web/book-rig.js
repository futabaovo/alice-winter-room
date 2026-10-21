import {bookPose,capePoint,bookGrips} from './book-pose.js';
export class BookRig{
  constructor(character,back,front){
    Object.assign(this,{character,back,front});this.arm=document.createElement('canvas');this.backContext=back.getContext('2d');this.frontContext=front.getContext('2d');this.draws=0;this.pose=null;
    this.openingUniform=new Float32Array(8);this.axisUniform=new Float32Array(6);character.prepareClothing=()=>this.prepare();
  }
  async load(){
    this.manifest=await fetch('pet/atlas.json').then(r=>r.json());this.image=new Image();this.image.src=this.manifest.image;await this.image.decode();if(this.image.naturalWidth!==this.manifest.size[0])throw Error('举书素材尺寸与分层清单不一致。');
    this.supportedBook=new Image();this.supportedBook.src=this.manifest.pairedBook.image;await this.supportedBook.decode();if(this.supportedBook.naturalWidth!==1254||this.supportedBook.naturalHeight!==1254)throw Error('托书素材尺寸与绑定锚点不一致。');
    this.capeIndex=this.character.model.drawables.ids.indexOf('ArtMeshTopwear');this.capeVertices=new Float32Array(this.character.model.drawables.vertexPositions[this.capeIndex].length);
  }
  resize(canvas){
    const c=this.character.canvas;if(canvas.width!==c.width||canvas.height!==c.height){canvas.width=c.width;canvas.height=c.height;}
    const ctx=canvas.getContext('2d');ctx.setTransform(c.width/c.clientWidth,0,0,c.height/c.clientHeight,0,0);ctx.clearRect(0,0,c.clientWidth,c.clientHeight);return ctx;
  }
  prepare(){
    const c=this.character,p=c.outfit&&c.outfit!=='winter'?0:c.bookProgress||0;c.drawOverrides??=new Map();c.drawOverrides.delete(this.capeIndex);c.garmentOpenings=null;this.pose=null;if(p<.0004)return;
    const face=c.meshBounds('ArtMeshFace'),cape=c.meshBounds('ArtMeshTopwear');if(!face||!cape)return;
    const pose=bookPose(p,face,c.bookTime||0,{peek:c.peekCover||0,direction:c.peekDirection||1}),v=c.model.drawables.vertexPositions[this.capeIndex],t=c.placement,w=c.canvas.clientWidth,h=c.canvas.clientHeight;let maxShift=0;
    for(let i=0;i<v.length;i+=2){
      const x=((v[i]-t.centerX)*t.scaleX+1)*w/2,y=(1-(v[i+1]-t.centerY)*t.scaleY)*h/2,next=capePoint(x,y,face,cape,pose);
      this.capeVertices[i]=((next.x*2/w-1)/t.scaleX)+t.centerX;this.capeVertices[i+1]=(1-next.y*2/h)/t.scaleY+t.centerY;maxShift=Math.max(maxShift,Math.hypot(next.x-x,next.y-y));
    }
    const dpr=c.canvas.width/w;
    pose.openings.forEach((o,i)=>{this.openingUniform.set([o.x*dpr,o.y*dpr,o.rx*dpr,o.ry*dpr],i*4);this.axisUniform.set([o.axis.x,o.axis.y,o.opacity],i*3);});
    c.garmentOpenings=this.openingUniform;c.garmentAxes=this.axisUniform;c.drawOverrides.set(this.capeIndex,this.capeVertices);this.pose={...pose,grips:bookGrips(pose),capeShift:maxShift,face,cape};
  }
  openingPath(ctx,o,margin=1){ctx.beginPath();ctx.ellipse(o.x,o.y,o.rx*margin,o.ry*margin,Math.atan2(o.axis.y,o.axis.x)-Math.PI/2,0,Math.PI*2);}
  upperArm(ctx,shoulder,elbow,opening,unit,alpha){
    // Draw the continuous upper arm behind the cape. When the elbow passes
    // below its hem, this also fills the bridge to the visible forearm.
    ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='#24212a';this.openingPath(ctx,opening,1.08);ctx.fill();
    const r=this.manifest.parts.sleeve,length=Math.hypot(elbow.x-shoulder.x,elbow.y-shoulder.y);
    ctx.translate(shoulder.x,shoulder.y);ctx.rotate(Math.atan2(elbow.y-shoulder.y,elbow.x-shoulder.x)-Math.PI/2);ctx.drawImage(this.image,...r,-unit*.33,-unit*.06,unit*.66,length+unit*.22);ctx.restore();
  }
  limb(ctx,part,root,unit,alpha,grip){
    const targetContext=ctx;ctx=this.resize(this.arm);const support=part==='support',r=this.manifest.parts[part],{wrist,scale,angle:rotation,anchor}=grip;
    const axis=Math.atan2(wrist.y-root.y,wrist.x-root.x),span=Math.hypot(wrist.x-root.x,wrist.y-root.y),width=unit*(support?.54:.49),cut=320,sleeveX=support?155:0;
    ctx.save();ctx.globalAlpha=alpha;ctx.translate(root.x,root.y);ctx.rotate(axis+Math.PI/2);ctx.drawImage(this.image,r[0]+sleeveX,r[1]+cut,r[2]-sleeveX,r[3]-cut,-width/2,-span-unit*.08,width,span+unit*.15);ctx.restore();
    const limb={wrist,rotation,scale,anchor,span,width,handLength:Math.hypot(grip.palm.x-wrist.x,grip.palm.y-wrist.y)};
    ctx.save();ctx.translate(root.x,root.y);ctx.rotate(axis+Math.PI/2);ctx.globalCompositeOperation='destination-in';const fade=ctx.createLinearGradient(0,0,0,-unit*.1);fade.addColorStop(0,'rgba(255,255,255,0)');fade.addColorStop(1,'white');ctx.fillStyle=fade;const extent=Math.max(this.arm.width,this.arm.height)*3;ctx.fillRect(-extent,-extent,extent*2,extent*2);ctx.restore();
    targetContext.drawImage(this.arm,0,0,this.front.clientWidth,this.front.clientHeight);return limb;
  }
  draw(){
    const back=this.resize(this.back),front=this.resize(this.front),p=this.pose;if(!p)return;const {unit:u,alpha,book,elbowL,elbowR,face}=p;
    this.upperArm(back,p.shoulderL,elbowL,p.openings[0],u,alpha);this.upperArm(back,p.shoulderR,elbowR,p.openings[1],u,alpha);
    const left=this.limb(front,'support',elbowL,u,alpha,p.grips[0]),right=this.limb(front,'thinking',elbowR,u,alpha,p.grips[1]);
    front.save();front.translate(book.x,book.y);front.rotate(book.angle);front.scale(p.grips[0].scale,p.grips[0].scale);front.translate(-650,-485);front.globalAlpha=alpha;
    // Keep the complete painted palm/cuff. Only the sleeve tail behind the
    // forearm attachment is clipped, inside the overlap with the animated arm.
    front.beginPath();front.rect(0,0,1254,995);front.clip();front.drawImage(this.supportedBook,0,0);front.restore();
    p.leftHandPoint=p.grips[0].palm;p.rightHandPoint=p.grips[1].palm;
    const cx=face.left+u/2;
    for(const direction of [-1,1]){const x=cx+direction*u*.23,cy=face.top+face.height*.66;front.save();front.translate(x,cy);front.scale(u*.14,face.height*.055);const gradient=front.createRadialGradient(0,0,0,0,0,1);gradient.addColorStop(0,'rgba(194,83,104,'+(p.hand*.18)+')');gradient.addColorStop(1,'rgba(194,83,104,0)');front.fillStyle=gradient;front.beginPath();front.arc(0,0,1,0,Math.PI*2);front.fill();front.restore();}
    p.leftLimb=left;p.rightLimb=right;this.draws++;
  }
  hit(x,y){
    if(!this.pose||x<0||y<0||x>=this.front.clientWidth||y>=this.front.clientHeight)return false;
    const sx=this.front.width/this.front.clientWidth,sy=this.front.height/this.front.clientHeight;
    return this.frontContext.getImageData(Math.floor(x*sx),Math.floor(y*sy),1,1).data[3]>28||this.backContext.getImageData(Math.floor(x*sx),Math.floor(y*sy),1,1).data[3]>28;
  }
}
