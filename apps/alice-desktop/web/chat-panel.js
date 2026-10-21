import {initCompanion} from './companion-panel.js';
import {initAttachments} from './image-attachments.js';
import {STICKERS} from './sticker-state.js';
const $=id=>document.getElementById(id);

export async function initChat({voice,replyPerformance,showPanel,isPet=false,petOptions,stickers}){
  let sequence=0,busy=false,preparing=false,composing=false,compositionEnd=0;
  let companion,inFlight=null,presentation=null;
  petOptions?.subscribe((value,old)=>{if(isPet&&old.voiceReply&&!value.voiceReply){voice.stop();if(presentation){replyPerformance.startText(presentation.token);stickers.text(presentation.stickerToken);}$('chat-status').textContent='已切换为文字回复。';}});
  const input=$('chat-input'),form=$('chat-form');
  const resizeInput=()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight+2,84)+'px';};
  input.addEventListener('input',resizeInput);
  input.addEventListener('compositionstart',()=>{composing=true;});
  input.addEventListener('compositionend',()=>{composing=false;compositionEnd=performance.now();});
  input.addEventListener('keydown',event=>{
    if(event.key!=='Enter'||event.shiftKey||event.isComposing||composing||event.keyCode===229||performance.now()-compositionEnd<80)return;
    event.preventDefault();
    if(event.repeat||busy||preparing||attachments.loading||(!input.value.trim()&&!attachments.images.length))return;
    form.requestSubmit();
  });
  const status=text=>{$('chat-status').textContent=text;};
  const attachments=initAttachments({status,isBlocked:()=>busy||preparing});
  const updateCancel=()=>{const speech=voice.player.snapshot(),acting=replyPerformance.diagnostic();$('chat-cancel').disabled=!(busy||(speech.id&&(speech.playing||speech.paused||speech.loading))||(acting.mode==='text'&&acting.timeline.length));};
  const previousSpeechChange=voice.player.onChange;
  voice.player.onChange=snapshot=>{previousSpeechChange(snapshot);updateCancel();if(presentation?.speechId===snapshot.id&&snapshot.ended)status('朗读结束。');};
  $('chat-expressions').onchange=()=>{replyPerformance.setEnabled($('chat-expressions').checked);updateCancel();};
  function providerFields(){const codex=$('chat-provider').value==='codex';$('codex-fields').hidden=!codex;$('api-fields').hidden=codex;for(const id of ['api-model','api-base-url'])$(id).required=!codex;$('codex-model').required=codex;}
  $('chat-provider').onchange=providerFields;
  function append(row){
    const article=document.createElement('article');article.className='chat-message '+row.role;
    if(row.replyId)article.dataset.replyId=row.replyId;
    const name=document.createElement('small');name.textContent=row.role==='user'?'你':row.source==='proactive'?'有珠 · 主动交流':'有珠';article.append(name);
    if(row.role==='user'){const text=document.createElement('p');text.textContent=row.text;article.append(text);}
    else{const japanese=document.createElement('p');japanese.lang='ja';japanese.textContent=row.ja;const chinese=document.createElement('p');chinese.className='chat-translation';chinese.textContent=row.zh;article.append(japanese,chinese);}
    $('chat-messages').append(article);$('chat-messages').scrollTop=$('chat-messages').scrollHeight;
    $('history-count').textContent=String($('chat-messages').children.length);
    if(row.role==='assistant'){$('reply-ja').textContent=row.ja;$('reply-zh').textContent=row.zh;}
    if(row.stickerSent){appendSticker(article,row.sticker);$('chat-messages').scrollTop=$('chat-messages').scrollHeight;}
    return article;
  }
  function appendSticker(article,id){if(!STICKERS[id]||article.querySelector('.chat-sticker'))return;const image=document.createElement('img');image.className='chat-sticker';image.src=STICKERS[id].src;image.alt='有珠的表情包：'+STICKERS[id].label;image.loading='lazy';article.append(image);}
  document.addEventListener('alice:sticker-sent',event=>{const row=event.detail,article=Array.from($('chat-messages').children).find(node=>node.dataset.replyId===row.replyId),history=$('chat-messages'),follow=history.scrollHeight-history.scrollTop-history.clientHeight<40;if(article)appendSticker(article,row.sticker);else append(row);if(follow)history.scrollTop=history.scrollHeight;if(!busy)status('有珠发来了一张表情包。');});
  function replaceHistory(rows){$('chat-messages').replaceChildren();$('history-count').textContent='0';$('reply-zh').textContent='有什么想说的，就说吧。';$('reply-ja').textContent='話したいことがあるなら、どうぞ。';for(const row of rows)append(row);}
  async function presentReply(reply,performanceToken,request){
    const stickerToken=stickers.plan({id:reply.sticker,source:'chat',replyId:reply.replyId,ja:reply.ja,zh:reply.zh});
    presentation={token:performanceToken,request,stickerToken};
    const text=()=>{replyPerformance.startText(performanceToken);stickers.text(stickerToken);};
    document.dispatchEvent(new CustomEvent('alice:reply-present',{detail:{ja:reply.ja,zh:reply.zh}}));
    replyPerformance.accept(performanceToken,reply);status(reply.source==='proactive'?'有珠主动说了一句。':'已回答。');
    if($('chat-auto-voice').checked){
      if(!reply.voiceEligible){text();status('回答较长，本次显示文字。');return reply;}
      const available=await window.aliceDesktop.voiceInfo();if(request!==sequence)return;
      if(!$('chat-auto-voice').checked){text();return reply;}
      if(!available.available){text();status('已回答；选择本机语音环境后可朗读新回答。');return reply;}
      status('正在用有珠的声音朗读…');
      try{const result=await voice.speakText(reply.ja,reply.zh,{preserveMood:true,beforePlay:item=>replyPerformance.attachSpeech(performanceToken,item)});if(request===sequence&&result.played){presentation.speechId=voice.player.snapshot().id;stickers.speech(stickerToken,voice.player.snapshot());status('正在朗读…');}}
      catch(error){if(request===sequence){text();status('文字已保留；'+error.message);}}
    }else text();
    return reply;
  }
  function applyInfo(info){
    if(!info.ok)throw Error(info.message);
    $('api-model').value=info.model;$('api-base-url').value=info.baseUrl;$('api-reasoning').value=info.reasoning;$('api-remember').checked=info.remember;
    $('chat-provider').value=info.provider||'api';$('codex-model').value=info.codexModel||'gpt-6.1-sol';providerFields();
    $('chat-source').textContent=info.provider==='codex'?'本机 Codex · '+info.codexModel:'API · '+info.model;
    $('api-key').value='';$('api-key').placeholder=info.keyConfigured?'已配置；留空继续使用现有密钥':'填入你自己的 API 密钥';
    $('api-forget-key').disabled=!info.keyConfigured;
    $('api-config-status').textContent=info.provider==='codex'?'已选择本机 Codex，无需填写 API 密钥。可点击“保存并测试回复”确认连接。':info.keyConfigured?(info.keyPersistence==='encrypted'?'密钥已用本机系统加密保存。':'密钥仅在本次运行中使用。'):'尚未配置 API 密钥。';
    status(info.ready?'可以开始对话。':'点击“对话设置”，选择本机 Codex 或填写 API 密钥。');
    return info;
  }
  async function submit(text){
    if(busy||preparing)return;
    if(!window.aliceDesktop)throw Error('请在桌面程序中使用对话。');
    if(attachments.loading){status('图片仍在处理中，请稍候。');return;}
    const message=text.trim();if(!message&&!attachments.images.length)return;
    const gate=sequence;let info;preparing=true;
    try{info=await window.aliceDesktop.chatInfo();}finally{preparing=false;}
    if(gate!==sequence)return;
    if(!info.ready){$('api-dialog').showModal();applyInfo(info);return;}
    const request=++sequence;busy=true;$('chat-send').disabled=true;$('chat-cancel').disabled=false;stickers.cancel();voice.stop();
    const performanceToken=replyPerformance.reserve();
    const images=attachments.take(),pending=append({role:'user',text:(message||'请看看我附上的图片。')+(images.length?'\n[附图 '+images.length+' 张：'+images.map(image=>image.name).join('、')+']':'')});inFlight={request,pending,message,images};$('chat-input').value='';status(images.length?'有珠正在看图…':'有珠正在思考…');
    resizeInput();
    try{
      const reply=await window.aliceDesktop.chatAsk(images.length?{text:message,images}:message);
      if(request!==sequence)return;
      if(!reply.ok)throw Error(reply.message);
      pending.dataset.saved='true';inFlight=null;append({role:'assistant',...reply});
      return await presentReply(reply,performanceToken,request);
    }catch(error){if(request===sequence){replyPerformance.cancel('request-failed');if(!pending.dataset.saved){pending.remove();$('history-count').textContent=String($('chat-messages').children.length);$('chat-input').value=message;attachments.restore(images);resizeInput();}status(error.message);}}
    finally{if(request===sequence){inFlight=null;busy=false;$('chat-send').disabled=false;updateCancel();}}
  }
  async function cancel(){++sequence;presentation=null;busy=false;if(inFlight){inFlight.pending.remove();$('history-count').textContent=String($('chat-messages').children.length);input.value=inFlight.message;attachments.restore(inFlight.images);inFlight=null;resizeInput();}document.dispatchEvent(new Event('alice:reply-stop'));replyPerformance.cancel('cancelled');voice.stop();await window.aliceDesktop?.chatCancel();$('chat-send').disabled=false;$('chat-cancel').disabled=true;status('已停止本次回答或朗读。');}
  $('chat-form').onsubmit=event=>{event.preventDefault();submit($('chat-input').value).catch(error=>status(error.message));};
  $('chat-cancel').onclick=cancel;
  $('chat-clear').onclick=async()=>{await cancel();attachments.clear();const result=await window.aliceDesktop.chatClear();if(result.ok){replaceHistory([]);status('当前聊天记录已清空，长期记忆与已有存档保留。');}else status(result.message);};
  $('chat-settings').onclick=async()=>{try{applyInfo(await window.aliceDesktop.chatInfo());$('api-dialog').showModal();}catch(error){status(error.message);}};
  $('chat-persona').onclick=async()=>{try{const result=await window.aliceDesktop.chatPersona();if(!result.ok)throw Error(result.message);$('persona-content').textContent=result.persona;$('persona-dialog').showModal();}catch(error){status(error.message);}};
  $('close-persona').onclick=()=>$('persona-dialog').close();
  $('close-api').onclick=()=>$('api-dialog').close();
  const saveForm=async()=>applyInfo(await window.aliceDesktop.chatSave({provider:$('chat-provider').value,codexModel:$('codex-model').value,model:$('api-model').value,baseUrl:$('api-base-url').value,reasoning:$('api-reasoning').value,remember:$('api-remember').checked,key:$('api-key').value}));
  $('api-form').onsubmit=async event=>{
    event.preventDefault();$('api-save').disabled=true;
    try{await saveForm();$('api-config-status').textContent+=' 保存完成。';}
    catch(error){$('api-config-status').textContent=error.message;}
    finally{$('api-save').disabled=false;}
  };
  $('api-test').onclick=async()=>{
    $('api-test').disabled=true;$('api-save').disabled=true;
    try{await saveForm();$('api-config-status').textContent='设置已保存，正在请求一条真实测试回复…';const result=await window.aliceDesktop.chatTest();if(!result.ok)throw Error(result.message);$('api-config-status').textContent='连接成功 · '+result.model+'\n'+result.ja+'\n'+result.zh;status('连接测试通过，可以开始对话。');}
    catch(error){$('api-config-status').textContent=error.message;}
    finally{$('api-test').disabled=false;$('api-save').disabled=false;}
  };
  $('codex-check').onclick=async()=>{
    $('codex-check').disabled=true;$('codex-status').textContent='正在检测本机 Codex…';
    try{const result=await window.aliceDesktop.codexStatus();if(!result.ok)throw Error(result.message);$('codex-models').replaceChildren(...result.models.map(model=>{const option=document.createElement('option');option.value=model.id;option.label=model.name;return option;}));$('codex-status').textContent=result.loggedIn?'已登录 '+(result.authType==='chatgpt'?'ChatGPT':'Codex')+(result.plan?' · '+result.plan:'')+' · 可选择 '+result.models.length+' 个模型。模型权限以实际回复测试为准。':'Codex 尚未登录，请先打开 Codex 登录后重试。';}
    catch(error){$('codex-status').textContent=error.message;}
    finally{$('codex-check').disabled=false;}
  };
  $('api-forget-key').onclick=async()=>{try{applyInfo(await window.aliceDesktop.chatForgetKey());}catch(error){$('api-config-status').textContent=error.message;}};
  if(window.aliceDesktop){const info=applyInfo(await window.aliceDesktop.chatInfo());const history=await window.aliceDesktop.chatHistory();if(history.ok)for(const row of history.messages)append(row);if(info.ready)showPanel('chat');}
  else{$('chat-send').disabled=true;status('请在桌面程序中打开对话。');}
  window.aliceDesktop?.onSessionRefresh?.(async()=>{if(busy||preparing)return;try{const history=await window.aliceDesktop.chatHistory();if(history.ok)replaceHistory(history.messages);applyInfo(await window.aliceDesktop.chatInfo());}catch(error){status(error.message);}});
  companion=await initCompanion({voice,replyPerformance,isBusy:()=>busy||preparing||attachments.loading||attachments.images.length>0,cancel,replaceHistory,receiveProactive:async id=>{
    if(busy||preparing||!companion.free())return;
    preparing=true;let reply;try{reply=await window.aliceDesktop.proactiveAccept(id);}finally{preparing=false;}
    if(!reply?.ok||!reply.accepted)return;
    const request=++sequence;companion.activity();append({role:'assistant',source:'proactive',...reply});
    if(!companion.free())return;
    busy=true;$('chat-send').disabled=true;const token=replyPerformance.reserve();
    try{await presentReply({...reply,source:'proactive'},token,request);}finally{if(request===sequence){busy=false;$('chat-send').disabled=false;updateCancel();}}
  }});
  return {submit,cancel,append,updateCancel,companion,attachments,get busy(){return busy;}};
}
