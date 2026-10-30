const clamp=v=>Math.max(0,Math.min(1,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};

// Frame changes happen at hand/prop contact points; head dimensions stay fixed.
export function pagePose(reaction){
  const t=reaction.age;
  if(reaction.id==='copy'){
    if(t<.64)return {frame:0,phase:'open',phaseProgress:clamp((t-.16)/.48)};
    if(t<1.02)return {frame:1,phase:'extract',phaseProgress:(t-.64)/.38};
    if(t<1.79)return {frame:2,phase:'duplicate',phaseProgress:(t-1.02)/.77};
    if(t<2.14)return {frame:1,phase:'keep',phaseProgress:(t-1.79)/.35};
    return {frame:0,phase:'settle',phaseProgress:clamp((t-2.14)/.33)};
  }
  if(t<.66)return {frame:3,phase:'ready',phaseProgress:clamp((t-.16)/.5)};
  if(t<1.46)return {frame:4,phase:'lower',phaseProgress:(t-.66)/.8};
  if(t<1.93)return {frame:5,phase:'contact',phaseProgress:(t-1.46)/.47};
  return {frame:5,phase:'release',phaseProgress:clamp((t-1.93)/.24)};
}

export function drawPageEffect(g,reaction,pose){
  const t=pose.phaseProgress;g.save();g.imageSmoothingEnabled=false;
  // Dust appears by the duplicated leaves, not as a floating clipboard icon.
  if(pose.phase==='duplicate'){
    const fade=Math.sin(Math.PI*t);g.globalAlpha=fade*.8;g.fillStyle='#f3d994';
    for(const [i,x,y]of [[0,38,135],[1,48,123],[2,31,146]]){const d=Math.round(smooth(t)*5);g.fillRect(x-d,y-d-i,2,2);if(i===1){g.fillRect(x-d-2,y-d-i+1,6,1);g.fillRect(x-d+1,y-d-i-2,1,6);}}
  }
  if(pose.phase==='lower'){
    // A small shadow grows under the page as both hands lower it to the keys.
    const spread=Math.round(10+smooth(t)*13);g.globalAlpha=.12+smooth(t)*.16;g.fillStyle='#665074';g.fillRect(96-spread,200,spread*2,2);
  }
  if(pose.phase==='contact'){
    // Contact happens before the brief outward glint; the page has already gone.
    const spread=Math.round(5+smooth(t)*29);g.globalAlpha=(1-t)*.8;g.strokeStyle='#f6deb0';g.lineWidth=1;g.strokeRect(96-spread,195,spread*2,8);
    g.fillStyle='#f6deb0';for(const [x,y]of [[66,189],[127,191],[84,185],[109,187]])g.fillRect(x,y-Math.round(t*4),2,2);
  }
  g.restore();
}
