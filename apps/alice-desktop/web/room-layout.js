const $=id=>document.getElementById(id);
export function initRoomLayout(character){
  let open=false,tab='moods';
  function setTools(value,page=tab){
    open=Boolean(value);tab=page==='voice'?'voice':'moods';
    const panel=$('tools-panel');panel.hidden=!open;panel.inert=!open;
    $('room').classList.toggle('tools-open',open);character.toolsOpen=open;
    $('mood-tools').hidden=tab!=='moods';$('voice-panel').hidden=tab!=='voice';
    for(const button of document.querySelectorAll('[data-tool-tab]')){const active=button.dataset.toolTab===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
    $('tools-toggle').setAttribute('aria-expanded',String(open&&tab==='moods'));
    $('voice-tools').setAttribute('aria-expanded',String(open&&tab==='voice'));
    $('tools-toggle').setAttribute('aria-label',open&&tab==='moods'?'收起情态工具栏':'展开情态工具栏');
    $('voice-tools').setAttribute('aria-label',open&&tab==='voice'?'收起语音工具栏':'展开语音工具栏');
  }
  $('tools-toggle').onclick=()=>setTools(!(open&&tab==='moods'),'moods');
  $('voice-tools').onclick=()=>setTools(!(open&&tab==='voice'),'voice');
  $('tools-close').onclick=()=>{setTools(false);$(tab==='voice'?'voice-tools':'tools-toggle').focus();};
  for(const button of document.querySelectorAll('[data-tool-tab]')){
    button.onclick=()=>setTools(true,button.dataset.toolTab);
    button.onkeydown=event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();setTools(true,tab==='voice'?'moods':'voice');$('tab-'+(tab==='voice'?'voice':'moods')).focus();};
  }
  setTools(false);
  return {setTools,showPanel:name=>setTools(name==='voice',name==='voice'?'voice':'moods'),diagnostic:()=>({open,tab})};
}
