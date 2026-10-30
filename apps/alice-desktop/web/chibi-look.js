const clamp=(n,a=-1,b=1)=>Math.max(a,Math.min(b,n));
const deadZone=(n,zone=.08)=>Math.abs(n)<=zone?0:Math.sign(n)*(Math.abs(n)-zone)/(1-zone);

// CSS-pixel coordinates relative to the rendered face, not the window midpoint.
// The same function handles the room, a resized window and the desktop pet.
export function chibiPointerLook(point,face,viewport,range={x:.75,y:.55}){
  if(!point||!face||![point.x,point.y,face.left,face.top,face.width,face.height,viewport.width,viewport.height].every(Number.isFinite)||face.width<=0||face.height<=0)return {x:0,y:0,active:false};
  const cx=face.left+face.width/2,cy=face.top+face.height/2;
  const spanX=Math.max(face.width*2.6,viewport.width*.32,1),spanY=Math.max(face.height*3,viewport.height*.32,1);
  return {x:deadZone(clamp((point.x-cx)/spanX))*range.x,y:deadZone(clamp((cy-point.y)/spanY))*range.y,active:true};
}

