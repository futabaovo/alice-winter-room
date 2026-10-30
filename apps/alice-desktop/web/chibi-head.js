const clamp=n=>Math.max(0,Math.min(1,n)),smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
export function chibiHeadPose({idle=false,action='idle',gesture=null,look={}}={}){
  if(!idle||action!=='idle'||gesture)return {angle:0,nod:0};
  const x=Math.max(-1,Math.min(1,look.x||0)),y=Math.max(-1,Math.min(1,look.y||0));
  // A small inclination toward the attended target, with no clock-driven sway.
  return {angle:x*.95*Math.PI/180,nod:-y*.95};
}
export function chibiHeadPoint(x,y,face,pose){
  if(!face||(!pose.angle&&!pose.nod))return {x,y};
  const cx=face.left+face.width/2,pivotY=face.bottom+face.height*.38;
  // The complete face, hair and hat rotate rigidly. Only the scarf/neck joins
  // fade into the stationary body, so there is no head scaling or squeezing.
  const weight=smooth((pivotY-y)/(face.height*.32)),angle=pose.angle*weight,dx=x-cx,dy=y-pivotY;
  return {x:cx+dx*Math.cos(angle)-dy*Math.sin(angle),y:pivotY+dx*Math.sin(angle)+dy*Math.cos(angle)+pose.nod*weight};
}
export function chibiHeadMesh(columns=16,rows=24){
  const positions=new Float32Array((columns+1)*(rows+1)*2),uvs=new Float32Array(positions.length),local=new Float32Array(positions.length),indices=[];
  for(let row=0;row<=rows;row++)for(let col=0;col<=columns;col++){
    const i=(row*(columns+1)+col)*2;local[i]=512*col/columns;local[i+1]=640*row/rows;uvs[i]=col/columns;uvs[i+1]=1-row/rows;
    if(row<rows&&col<columns){const n=row*(columns+1)+col;indices.push(n,n+1,n+columns+1,n+1,n+columns+2,n+columns+1);}
  }
  return {positions,uvs,local,indices:new Uint16Array(indices)};
}
