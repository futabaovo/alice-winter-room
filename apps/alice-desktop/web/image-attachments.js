const $=id=>document.getElementById(id);
const MAX_FILE=20*1024*1024,MAX_IMAGE=6*1024*1024,MAX_TOTAL=12*1024*1024;
export function initAttachments({status,isBlocked}){
  let images=[],queue=Promise.resolve(),loading=0,epoch=0;
  const picker=$('chat-image-input'),tray=$('chat-attachments');
  const bytes=image=>Math.floor(image.dataUrl.split(',')[1].length*3/4);
  function render(){
    tray.hidden=!images.length;tray.replaceChildren();
    for(const [index,image]of images.entries()){
      const card=document.createElement('div');card.className='image-attachment';
      const preview=document.createElement('img');preview.src=image.dataUrl;preview.alt=image.name;
      const name=document.createElement('span');name.textContent=image.name;
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.setAttribute('aria-label','移除 '+image.name);remove.onclick=()=>{images.splice(index,1);render();};
      card.append(preview,name,remove);tray.append(card);
    }
    $('chat-panel').classList.toggle('has-images',Boolean(images.length));
  }
  async function prepare(file){
    if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw Error('请选择 PNG、JPEG 或 WebP 图片。');
    if(!file.size||file.size>MAX_FILE)throw Error('原始图片须小于 20 MB。');
    let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw Error('无法读取这张图片，请重新导出为 PNG 或 JPEG。');}
    try{
      const ratio=Math.min(1,2560/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
      const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      let dataUrl=canvas.toDataURL(file.type==='image/jpeg'?'image/jpeg':'image/png',.9);
      if(dataUrl.length>MAX_IMAGE*4/3){ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);dataUrl=canvas.toDataURL('image/jpeg',.86);}
      if(dataUrl.length>MAX_IMAGE*4/3)throw Error('压缩后的图片仍过大，请裁剪后重试。');
      return {name:(file.name||'粘贴的截图.png').slice(0,100),dataUrl};
    }finally{bitmap.close();}
  }
  function add(files){
    if(isBlocked()){status('请等本次回答完成，或先点击停止，再添加图片。');return Promise.resolve();}
    const list=Array.from(files||[]),generation=epoch;if(!list.length)return Promise.resolve();
    loading++;status('正在处理图片…');
    queue=queue.then(async()=>{
      if(generation!==epoch)return;
      try{
        for(const file of list){
          if(images.length>=3)throw Error('每次最多附上 3 张图片。');
          const image=await prepare(file);if(generation!==epoch)return;
          if(images.reduce((sum,row)=>sum+bytes(row),bytes(image))>MAX_TOTAL)throw Error('本次图片合计不能超过 12 MB，请减少图片。');
          images.push(image);render();document.dispatchEvent(new Event('alice:images-ready'));
        }
        status('已附上 '+images.length+' 张图片，补充问题后按 Enter；也可直接发送。');
      }catch(error){status(error.message);}
    }).finally(()=>{loading--;});return queue;
  }
  $('chat-attach').onclick=()=>picker.click();
  picker.onchange=()=>{void add(picker.files);picker.value='';};
  document.addEventListener('paste',event=>{
    if(document.querySelector('dialog[open]'))return;
    const files=Array.from(event.clipboardData?.items||[]).filter(item=>item.kind==='file'&&item.type.startsWith('image/')).map(item=>item.getAsFile()).filter(Boolean);
    if(files.length){event.preventDefault();void add(files);}
  });
  const fileDrag=event=>Array.from(event.dataTransfer?.types||[]).includes('Files');
  document.addEventListener('dragover',event=>{if(fileDrag(event)){event.preventDefault();event.dataTransfer.dropEffect=document.querySelector('dialog[open]')?'none':'copy';}});
  document.addEventListener('drop',event=>{if(!fileDrag(event))return;event.preventDefault();if(!document.querySelector('dialog[open]'))void add(event.dataTransfer.files);});
  return {add,choose:()=>picker.click(),take(){const selected=images;images=[];render();return selected;},restore(selected){images=[...selected,...images].slice(0,3);render();},clear(){epoch++;images=[];render();},get images(){return images;},get loading(){return loading>0;}};
}
