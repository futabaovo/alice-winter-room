const $=id=>document.getElementById(id);
const styles=['illustration','chibi'];
export async function initCharacterStyle({character,onChange}){
  const release=await window.aliceDesktop?.appVersion?.(),version=release?.version||'';
  let selected='illustration';
  function set(id,{save=true}={}){
    if(!styles.includes(id))return false;
    const changed=selected!==id;selected=id;character.characterStyle=id;
    document.documentElement.dataset.characterStyle=id;
    for(const b of document.querySelectorAll('[data-character-style]'))b.setAttribute('aria-pressed',String(b.dataset.characterStyle===id));
    $('character-style-current').textContent=id==='chibi'?'Q 版':'立绘';
    const live=document.querySelector('.stage-top .live');if(live)for(const node of live.childNodes)if(node.nodeType===3)node.textContent=(id==='chibi'?' Q 版':' Live2D')+(version?' · v'+version:'');
    $('stage').setAttribute('aria-label','夜晚的玻璃花房与'+(id==='chibi'?'Q版':'立绘')+'有珠');
    if(changed)onChange?.(id);
    if(save&&changed)void window.aliceDesktop?.appearanceSave?.({characterStyle:id});
    return true;
  }
  for(const b of document.querySelectorAll('[data-character-style]'))b.onclick=()=>set(b.dataset.characterStyle);
  const preferences=await window.aliceDesktop?.appearanceInfo?.();set(preferences?.characterStyle||'illustration',{save:false});
  window.aliceDesktop?.onAppearance?.(value=>{if(styles.includes(value.characterStyle)&&value.characterStyle!==selected)set(value.characterStyle,{save:false});});
  return {get selected(){return selected;},set,diagnostic:()=>({selected,available:styles})};
}
