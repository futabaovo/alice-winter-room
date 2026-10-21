const $=id=>document.getElementById(id);
export async function initCompanion({voice,replyPerformance,isBusy,cancel,replaceHistory,receiveProactive}){
  const api=window.aliceDesktop,dialog=$('companion-dialog');let lastActivity=performance.now(),latest=null,dirty=false;
  if(!api?.companionInfo){$('companion-tools').hidden=true;return null;}
  const message=value=>{$('companion-status').textContent=value;};
  const check=result=>{if(!result.ok)throw Error(result.message);return result;};
  const free=()=>{const speech=voice.player.snapshot(),acting=replyPerformance.diagnostic();return !document.documentElement.classList.contains('robin-active')&&!document.documentElement.classList.contains('tea-active')&&!document.documentElement.classList.contains('feeding-active')&&!isBusy()&&!speech.playing&&!speech.paused&&!speech.loading&&!['pending','voice','tail','text'].includes(acting.mode)&&!$('chat-input').value.trim()&&!document.querySelector('dialog[open]')&&document.visibilityState==='visible'&&document.hasFocus();};
  const report=()=>api.companionReport({available:free(),idleMs:performance.now()-lastActivity}).catch(()=>{});
  const activity=()=>{lastActivity=performance.now();void report();};
  for(const event of ['keydown','pointerdown','input','focusin'])document.addEventListener(event,activity,{passive:true});
  for(const event of ['focus','blur'])window.addEventListener(event,()=>{activity();});
  document.addEventListener('visibilitychange',activity);
  const heartbeat=setInterval(report,10000);window.addEventListener('pagehide',()=>clearInterval(heartbeat),{once:true});
  function apply(info){
    latest=info;$('memory-enabled').checked=info.settings.memoryEnabled;
    for(const key of ['summary','profile','events','promises'])$('memory-'+key).value=info.memory[key];
    $('proactive-enabled').checked=info.settings.proactiveEnabled;$('proactive-idle').value=info.settings.idleMinutes;$('proactive-limit').value=info.settings.maxPerDay;$('proactive-quiet').checked=info.settings.quietAtNight;
    $('memory-detail').textContent=(info.memoryBusy?'正在整理记忆。':info.memory.updatedAt?'上次整理或修改：'+new Date(info.memory.updatedAt).toLocaleString():'还没有整理过记忆。')+' 尚未归档 '+info.pendingMessages+' 条消息。'+(!info.remember?' 当前已关闭保留对话。':'');
    if(info.warning||info.memoryError)message(info.warning||info.memoryError);
    $('save-list').replaceChildren();
    if(!info.saves.length){const p=document.createElement('p');p.textContent='还没有存档。完成一次对话后会自动保存。';$('save-list').append(p);}
    for(const save of info.saves){const row=document.createElement('article');row.className='save-row';const description=document.createElement('div'),title=document.createElement('strong'),detail=document.createElement('small');title.textContent=save.title;detail.textContent=new Date(save.createdAt).toLocaleString()+' · '+save.messages+' 条消息';description.append(title,detail);const load=document.createElement('button');load.textContent='读取';load.onclick=async()=>{try{await cancel();const result=check(await api.saveLoad(save.id));replaceHistory(result.messages);apply(result);message('已恢复聊天与记忆；读档前的进度已保留。');}catch(error){message(error.message);}};row.append(description,load);if(!save.automatic){const remove=document.createElement('button');remove.textContent='删除';remove.onclick=async()=>{try{apply(check(await api.saveRemove(save.id)));message('已删除该存档。');}catch(error){message(error.message);}};row.append(remove);}$('save-list').append(row);}
    dirty=false;
  }
  async function refresh(){const info=check(await api.companionInfo());apply(info);return info;}
  for(const button of document.querySelectorAll('[data-companion-tab]'))button.onclick=()=>{for(const tab of document.querySelectorAll('[data-companion-tab]'))tab.setAttribute('aria-selected',String(tab===button));for(const name of ['memory','saves','proactive'])$('companion-page-'+name).hidden=name!==button.dataset.companionTab;};
  $('companion-tools').onclick=async()=>{dialog.showModal();activity();message('');try{await refresh();}catch(error){message(error.message);}};
  $('close-companion').onclick=()=>dialog.close();dialog.addEventListener('close',activity);
  $('memory-form').addEventListener('input',()=>{dirty=true;});
  $('memory-form').onsubmit=async event=>{event.preventDefault();try{const notes=Object.fromEntries(['summary','events','profile','promises'].map(key=>[key,$('memory-'+key).value]));apply(check(await api.memoryEdit(notes)));message('已保存记忆修改。');}catch(error){message(error.message);}};
  $('memory-enabled').onchange=async()=>{try{const info=check(await api.companionConfigure({memoryEnabled:$('memory-enabled').checked}));if(dirty){latest=info;message('记忆开关已保存；文本修改尚未保存。');}else{apply(info);message(info.settings.memoryEnabled?'长期记忆已开启。':'已暂停记忆整理与使用，已有记忆保留。');}}catch(error){message(error.message);}};
  $('memory-organize').onclick=async()=>{if(dirty){message('请先保存文本修改，再整理记忆。');return;}$('memory-organize').disabled=true;message('正在整理这段交流…');try{const info=check(await api.memoryOrganize());if(info.updated===false){message('暂时没有需要整理的新对话。');}else{apply(info);message('记忆已整理。');}}catch(error){message(error.message);}finally{$('memory-organize').disabled=false;}};
  $('memory-clear').onclick=async()=>{try{apply(check(await api.memoryClear()));message('当前记忆已清除，聊天和存档仍保留。');}catch(error){message(error.message);}};
  $('save-form').onsubmit=async event=>{event.preventDefault();try{apply(check(await api.saveCreate($('save-title').value)));$('save-title').value='';message('当前聊天与记忆已存档。');}catch(error){message(error.message);}};
  $('proactive-form').onsubmit=async event=>{event.preventDefault();try{apply(check(await api.companionConfigure({proactiveEnabled:$('proactive-enabled').checked,idleMinutes:Number($('proactive-idle').value),maxPerDay:Number($('proactive-limit').value),quietAtNight:$('proactive-quiet').checked})));message('相处设置已保存。');}catch(error){message(error.message);}};
  const unsubscribe=api.onProactive(async candidate=>{if(!free())return;try{await report();if(!free())return;await receiveProactive(candidate.id);}catch{}});
  window.addEventListener('pagehide',unsubscribe,{once:true});void report();
  return {refresh,activity,report,free,get latest(){return latest;}};
}
