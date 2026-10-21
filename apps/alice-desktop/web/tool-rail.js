const $=id=>document.getElementById(id);
export function initRail(){
  if(document.documentElement.classList.contains('pet-mode'))return;
  const rail=document.querySelector('.tool-rail'),dock=$('chat-panel'),tooltip=$('rail-tooltip'),buttons=Array.from(rail.querySelectorAll('button'));
  let current=null,timer;
  function hide(){clearTimeout(timer);current?.removeAttribute('aria-describedby');current=null;tooltip.hidden=true;}
  function refreshTip(){
    if(!current||tooltip.hidden)return;
    $('rail-tooltip-label').textContent=current.dataset.railLabel;
    const selected=current.getAttribute('aria-expanded')==='true';
    $('rail-tooltip-detail').textContent=selected?(current.getAttribute('aria-haspopup')==='dialog'?'窗口已打开':'已展开 · 再次点击可收起'):current.id==='pin'&&current.getAttribute('aria-pressed')==='true'?'已置顶 · 再次点击取消':current.dataset.railHint;
    const r=current.getBoundingClientRect(),t=tooltip.getBoundingClientRect();tooltip.style.left=Math.max(8,r.left-t.width-12)+'px';tooltip.style.top=Math.max(8,Math.min(innerHeight-t.height-8,r.top+(r.height-t.height)/2))+'px';
  }
  function show(button,immediate=false){
    hide();current=button;timer=setTimeout(()=>{if(current!==button||document.querySelector('dialog[open]'))return;tooltip.hidden=false;button.setAttribute('aria-describedby','rail-tooltip');refreshTip();},immediate?0:280);
  }
  for(const button of buttons){button.addEventListener('pointerenter',()=>show(button));button.addEventListener('pointerleave',hide);button.addEventListener('focus',()=>show(button,true));button.addEventListener('blur',hide);button.addEventListener('click',hide);}
  function layout(){
    const dockRect=dock.getBoundingClientRect(),top=Number.parseFloat(getComputedStyle(rail).top),available=Math.max(180,dockRect.top-top-18),height=Math.max(34,Math.min(48,Math.floor((available-76)/buttons.length)));
    document.documentElement.style.setProperty('--room-tools-bottom',Math.max(20,innerHeight-dockRect.top+12)+'px');
    rail.style.setProperty('--rail-item-height',height+'px');rail.style.maxHeight=available+'px';rail.dataset.compact=String(height<42);hide();
  }
  const observer=new ResizeObserver(layout);observer.observe(dock);observer.observe(document.documentElement);layout();
  const stateObserver=new MutationObserver(refreshTip);stateObserver.observe(rail,{subtree:true,attributes:true,attributeFilter:['aria-expanded','aria-pressed','data-rail-hint']});
  for(const [buttonId,dialogId]of [['companion-tools','companion-dialog'],['tea-open','tea-dialog'],['wardrobe-tools','wardrobe-dialog'],['help','help-dialog']]){
    const button=$(buttonId),dialog=$(dialogId);button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls',dialogId);button.setAttribute('aria-expanded','false');dialog.addEventListener('toggle',()=>button.setAttribute('aria-expanded',String(dialog.open)));
  }
  rail.addEventListener('scroll',hide);window.addEventListener('blur',hide);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hide();});
  window.addEventListener('pagehide',()=>{observer.disconnect();stateObserver.disconnect();hide();},{once:true});
}
