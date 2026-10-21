const $=id=>document.getElementById(id);

export function initDialogueAppearance(options){
  const root=document.documentElement,dialog=$('dialogue-appearance'),slider=$('dialogue-opacity'),status=$('dialogue-appearance-status');
  let draft=null,pending=null,writing=false,timer;
  function render(percent){
    slider.value=percent;$('dialogue-opacity-value').value=percent+'%';
    slider.setAttribute('aria-valuetext',percent+'% 不透明');
    root.style.setProperty('--dialogue-alpha',percent/100);
    root.classList.toggle('dialogue-clear',percent<35);
  }
  // Keep the current gesture visible while older IPC acknowledgements arrive.
  const unsubscribe=options.subscribe(value=>render(draft??value.dialogueOpacity));
  async function drain(){
    if(writing)return;writing=true;
    try{
      while(pending!==null){
        const percent=pending;pending=null;status.textContent='正在保存…';
        await options.save({dialogueOpacity:percent});
        if(pending===null&&draft===percent)draft=null;
      }
      status.textContent='已保存，下次打开时沿用。';
    }catch(error){
      pending=null;draft=null;status.textContent='保存失败：'+error.message;
    }finally{
      writing=false;render(draft??options.value.dialogueOpacity);
    }
  }
  function flush(){
    clearTimeout(timer);
    if(draft===null)return;
    pending=draft;void drain();
  }
  slider.oninput=()=>{draft=Number(slider.value);render(draft);status.textContent='实时预览…';clearTimeout(timer);timer=setTimeout(flush,180);};
  slider.onchange=flush;
  $('chat-appearance').onclick=()=>{dialog.showModal();slider.focus();};
  $('close-dialogue-appearance').onclick=()=>dialog.close();
  dialog.addEventListener('close',flush);
  $('dialogue-opacity-reset').onclick=()=>{draft=96;render(draft);flush();};
  window.addEventListener('pagehide',()=>{flush();unsubscribe();},{once:true});
  render(options.value.dialogueOpacity);
}
