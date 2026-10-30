// Semantic reactions only: no key text or clipboard data is retained.
export const REACTIONS = Object.freeze({
  copy: {label:'复制 · 留一份书页', line:'……这一页，留一份。', gesture:'copy', duration:2.65},
  cut: {label:'剪切 · 抽出书页', line:'……先收起来。', sprite:0, duration:1.65},
  paste: {label:'粘贴 · 递下书页', line:'……放在这里。', gesture:'paste', duration:2.35},
  save: {label:'保存 · 合书珍藏', line:'……这样就不会丢了。', sprite:1, duration:1.9},
  undo: {label:'撤销 · 扶额侧目', line:'……再想一遍。', sprite:2, duration:1.7},
  redo: {label:'重做 · 轻轻颔首', line:'……还是刚才那样。', sprite:1, duration:1.7},
  find: {label:'查找 · 举书检视', line:'……让我找找。', sprite:3, duration:2.1},
  select: {label:'全选 · 圈起书页', line:'……这些都要？', sprite:3, duration:1.8},
  confirm: {label:'Enter · 轻敲确认', line:'……嗯。', frame:2, duration:.85},
  dismiss: {label:'Esc · 闭眼收手', line:'……先放下吧。', frame:3, duration:1.15},
});

export function shortcutFromEvent(e) {
  if(e.repeat||e.isComposing||e.keyCode===229||e.altKey||e.metaKey)return null;
  if(e.ctrlKey){
    const code=e.code||'Key'+String(e.key).toUpperCase();
    if(code==='KeyZ')return e.shiftKey?'redo':'undo';
    if(e.shiftKey)return null;
    return {KeyC:'copy',KeyX:'cut',KeyV:'paste',KeyS:'save',KeyY:'redo',KeyF:'find',KeyA:'select'}[code]||null;
  }
  if(!e.shiftKey)return {Enter:'confirm',Escape:'dismiss'}[e.key]||null;
  return null;
}

export class ShortcutReactions {
  constructor(){this.reset();}
  reset(){this.time=0;this.current=null;this.pending=null;this.last=new Map();this.lastStart=-Infinity;this.started=0;}
  trigger(id,{preview=false}={}){
    if(!Object.hasOwn(REACTIONS,id))return false;
    if(preview){this.current=null;this.pending=null;this.start(id);return true;}
    if(this.current?.id===id||this.pending?.id===id||this.time-(this.last.get(id)??-Infinity)<5)return false;
    if(this.current||this.time-this.lastStart<1){
      const remaining=this.current?REACTIONS[this.current.id].duration-this.current.age:0;
      this.pending={id,expires:this.time+Math.max(2.4,remaining+.5)};return true;
    }
    this.start(id);return true;
  }
  start(id){this.current={id,age:0};this.last.set(id,this.time);this.lastStart=this.time;this.started++;}
  step(dt,{enabled=true}={}){
    dt=Math.max(0,Math.min(.05,dt));this.time+=dt;
    if(!enabled){this.current=null;this.pending=null;return null;}
    if(this.current){this.current.age+=dt;if(this.current.age>=REACTIONS[this.current.id].duration)this.current=null;}
    if(this.pending&&this.pending.expires<this.time)this.pending=null;
    if(!this.current&&this.pending&&this.time-this.lastStart>=1){const {id}=this.pending;this.pending=null;this.start(id);}
    return this.snapshot();
  }
  snapshot(){
    if(!this.current)return null;
    const {id,age}=this.current,def=REACTIONS[id],remaining=def.duration-age;
    const stage=age<.16?'prepare':remaining<.18?'release':'hold';
    const amount=Math.min(1,age/.25,remaining/.28);
    return {id,...def,age,stage,amount,progress:age/def.duration};
  }
}

// Small pixel effects communicate the command without changing anatomy.
export function drawReactionEffect(g,r){
  if(!r||r.stage!=='hold')return;
  const t=r.progress;g.save();g.globalAlpha=Math.max(0,Math.min(1,r.amount));g.lineWidth=1;g.strokeStyle='#e7cca0';g.fillStyle='#f4e3bf';
  const page=(x,y)=>{x=Math.round(x);y=Math.round(y);g.fillStyle='#efdfba';g.fillRect(x,y,11,14);g.fillStyle='#9f8096';g.fillRect(x+2,y+4,7,1);g.fillRect(x+2,y+7,5,1);};
  if(r.id==='cut'){
    const travel=Math.sin(Math.min(1,t*1.5)*Math.PI/2)*16;
    page(32-travel,118-travel);
  } else if(r.id==='save'||r.id==='redo'){
    const y=Math.round(96+Math.sin(t*Math.PI)*3);g.beginPath();g.moveTo(164,y);g.lineTo(167,y+4);g.lineTo(173,y-5);g.stroke();
    for(const [x,y0]of [[27,91],[164,135]]){g.fillRect(x,y0,1,5);g.fillRect(x-2,y0+2,5,1);}
  } else if(r.id==='undo'){
    const x=25,y=99;g.beginPath();g.moveTo(x+9,y+9);g.lineTo(x+12,y+9);g.lineTo(x+12,y);g.lineTo(x,y);g.moveTo(x+4,y-3);g.lineTo(x,y);g.lineTo(x+4,y+3);g.stroke();
  } else if(r.id==='find'){
    const y=Math.round(110+Math.sin(t*Math.PI*3)*9);g.strokeRect(164,y,8,8);g.fillRect(172,y+8,4,2);
  } else if(r.id==='select'){
    g.setLineDash([3,3]);g.strokeRect(16,104,20,25);
  } else if(r.id==='confirm'){
    g.strokeRect(143,195,17,7);
  }
  g.restore();
}
