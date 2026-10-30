export class PixelSprites {
  async load(source='alice-pixel-atlas-round.png',columns=4){
    this.image=new Image();this.image.src=source;await this.image.decode();
    const c=document.createElement('canvas');c.width=this.image.width;c.height=this.image.height;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(this.image,0,0);const data=g.getImageData(0,0,c.width,c.height).data;
    const histogram=new Uint32Array(c.height);for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>100)histogram[y]++;
    const edges=[0];for(let row=1;row<3;row++){const center=c.height*row/3;let best=Math.round(center),score=Infinity;for(let y=Math.floor(center-c.height*.055);y<center+c.height*.055;y++){const s=histogram[y]+Math.abs(y-center)*.005;if(s<score){score=s;best=y;}}edges.push(best);}edges.push(c.height);
    this.frames=[];for(let row=0;row<3;row++){const frames=[];for(let col=0;col<columns;col++){
      const x0=Math.floor(c.width*col/columns),x1=Math.floor(c.width*(col+1)/columns),y0=edges[row],y1=edges[row+1],width=x1-x0,height=y1-y0,seen=new Uint8Array(width*height),queue=new Int32Array(width*height);let largest=null;
      // A neighboring sprite can leave a few stray pixels inside this cell.
      // Register the connected character, so those pixels cannot shrink a pose.
      for(let start=0;start<seen.length;start++){
        if(seen[start])continue;seen[start]=1;const sx=start%width,sy=Math.floor(start/width);if(data[((sy+y0)*c.width+sx+x0)*4+3]<=100)continue;
        let head=0,tail=1,l=sx,t=sy,r=sx,b=sy;queue[0]=start;
        while(head<tail){const p=queue[head++],x=p%width,y=Math.floor(p/width);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
          for(const [nx,ny]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){if(nx<0||nx>=width||ny<0||ny>=height)continue;const q=ny*width+nx;if(seen[q])continue;seen[q]=1;if(data[((ny+y0)*c.width+nx+x0)*4+3]>100)queue[tail++]=q;}
        }
        if(!largest||tail>largest.count)largest={count:tail,box:[l+x0,t+y0,r-l+1,b-t+1]};
      }
      if(!largest||largest.box[2]<80||largest.box[3]<80)throw Error('像素动作素材不完整');frames.push(largest.box);
    }this.frames.push(frames);}
  }
  draw(g,{outfit='winter',frame=0,bob=0}={}){
    const row=Math.max(0,['winter','white','penguin'].indexOf(outfit)),f=this.frames[row][frame];
    // Match head-to-keyboard height with the idle atlas using a uniform scale.
    // Hand/prop width must not shrink the whole character during a reaction.
    const anchor=this.reference?.frames[row][0],height=anchor?Math.round(anchor[3]*Math.min(156/anchor[2],198/anchor[3])):null;
    const scale=height?Math.min(176/f[2],height/f[3]):Math.min(156/f[2],198/f[3]);
    const w=Math.round(f[2]*scale),h=Math.round(f[3]*scale),x=Math.round((192-w)/2),y=216-h+Math.round(bob);
    g.clearRect(0,0,192,224);g.imageSmoothingEnabled=false;g.drawImage(this.image,...f,x,y,w,h);
    return {row,frame,x,y,w,h};
  }
}
