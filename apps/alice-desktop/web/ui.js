import {initRail} from './tool-rail.js';
export function installUI(){
  const ns='http://www.w3.org/2000/svg',sheet=document.createElementNS(ns,'svg');sheet.setAttribute('aria-hidden','true');sheet.classList.add('ui-symbols');
  const paths={
    chat:'M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 3v-3H3V6a2 2 0 0 1 2-2Z M7 9h10 M7 13h7',
    image:'M4 4h16v16H4Z M4 16l5-5 4 4 3-3 4 4 M15 8h.01',
    tea:'M4 9h13v5a6.5 6.5 0 0 1-13 0Z M17 10h1a3 3 0 0 1 0 6h-1 M3 22h16 M8 3v2 M12 2v3',
    sushi:'M4 11h16v7H4Z M3 10c1-4 5-5 9-5s8 1 9 5Z M8 6l2 4 M13 5l2 5',
    robin:'M20 6c-2-2-5-1-6 1-3 0-5 1-6 4l-5 1 5 4c1 3 7 4 10 1 2-2 2-5 1-8l3-2-3-1Z M16 7h.01 M11 12l4 1-3 3 M12 19v3',
    wardrobe:'M8 4l4 3 4-3 6 5-4 4-2-2v10H8V11l-2 2-4-4Z',
    size:'M9 3H3v6 M15 21h6v-6 M3 3l7 7 M21 21l-7-7 M15 3h6v6 M9 21H3v-6',
    home:'m3 11 9-8 9 8 M5 10v11h5v-6h4v6h5V10',
    move:'M12 2v20 M2 12h20 M8 6l4-4 4 4 M8 18l4 4 4-4 M6 8l-4 4 4 4 M18 8l4 4-4 4',
    menu:'M5 12h.01 M12 12h.01 M19 12h.01',
    send:'m3 3 19 9-19 9 4-9-4-9Z M7 12h15',
    attach:'m9 14 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9',
    stop:'M6 6h12v12H6Z',
    pause:'M8 5v14 M16 5v14',
    play:'m8 4 12 8-12 8Z',
    close:'m6 6 12 12 M18 6 6 18',
    caption:'M3 5h18v14H3Z M10 9H7v6h3 M18 9h-3v6h3'
  };
  Object.assign(paths,{
    mood:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M7 10h2 M15 10h2 M8 15c2 2 6 2 8 0',
    voice:'M4 10v4 M8 6v12 M12 3v18 M16 6v12 M20 10v4',
    memory:'M12 6C9 3 5 3 3 4v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-2-1-6-1-9 2Z M12 6v14 M6 8h3 M6 12h3 M15 8h3 M15 12h3',
    desktop:'M3 3h18v14H3Z M8 21h8 M12 17v4 M10 8a2 2 0 1 0 4 0 2 2 0 1 0-4 0 M8 14c0-4 8-4 8 0',
    pin:'m8 3 8 0-1 6 4 4H5l4-4-1-6Z M12 13v8',
    help:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M9.5 8.5a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4 M12 16h.01'
  });
  for(const [id,d]of Object.entries(paths)){const symbol=document.createElementNS(ns,'symbol');symbol.id='icon-'+id;symbol.setAttribute('viewBox','0 0 24 24');const p=document.createElementNS(ns,'path');p.setAttribute('d',d);symbol.append(p);sheet.append(symbol);}document.body.prepend(sheet);
  const buttons={'pet-drag':['move','移动'],'pet-chat':['chat','对话'],'pet-image':['image','看图'],'pet-feed':['sushi','寿司'],'pet-tea':['tea','红茶'],'pet-robin':['robin','Robin'],'pet-wardrobe':['wardrobe','衣装'],'pet-size':['size','大小'],'pet-return':['home','返回小室'],'pet-menu':['menu','更多'],'chat-attach':['attach','附图'],'chat-cancel':['stop','停止'],'chat-send':['send','发送']};
  for(const [id,[name,label]]of Object.entries(buttons)){const button=document.getElementById(id);if(!button)continue;const svg=document.createElementNS(ns,'svg');svg.classList.add('ui-icon');svg.setAttribute('aria-hidden','true');const use=document.createElementNS(ns,'use');use.setAttribute('href','#icon-'+name);svg.append(use);const text=document.createElement('span');text.className='button-label';text.textContent=label;button.replaceChildren(svg,text);button.setAttribute('title',button.getAttribute('title')||label);if(!button.hasAttribute('aria-label'))button.setAttribute('aria-label',label);}
  const railButtons={'tools-toggle':['mood','情态','表情与待机动作'],'voice-tools':['voice','语音','本地台词与日语朗读'],'companion-tools':['memory','记忆','记忆、存档与主动交流'],'pet-enter':['desktop','桌宠','让有珠来到桌面'],'feed-sushi':['sushi','寿司','投喂寿司，按住可拖到嘴边'],'tea-open':['tea','红茶','泡一杯红茶，请她品尝'],'wardrobe-tools':['wardrobe','衣装','选择衣装与寿司种类'],'pin':['pin','置顶','让小室保持在其他窗口上方'],'help':['help','说明','查看操作与互动说明']};
  for(const [id,[name,label,hint]]of Object.entries(railButtons)){
    const button=document.getElementById(id),svg=document.createElementNS(ns,'svg'),use=document.createElementNS(ns,'use');svg.classList.add('ui-icon');svg.setAttribute('aria-hidden','true');use.setAttribute('href','#icon-'+name);svg.append(use);
    const text=document.createElement('small');text.textContent=label;button.replaceChildren(svg,text);button.dataset.railLabel=label;button.dataset.railHint=hint;button.removeAttribute('title');
  }
  initRail();
  const robin=document.getElementById('robin-dialog');robin.addEventListener('toggle',()=>document.getElementById('pet-robin').setAttribute('aria-expanded',String(robin.open)));
  if(document.documentElement.classList.contains('pet-mode'))document.getElementById('chat-input').placeholder='和有珠说些什么…';
}
