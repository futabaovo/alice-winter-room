// Only user-supplied inline image bytes cross this boundary. Never fetch a URL
// or open a renderer-supplied local path. Originals are not saved in chat state.
const MAX_IMAGE_BYTES=6*1024*1024,MAX_TOTAL_BYTES=12*1024*1024,MAX_IMAGES=3;
function normalizeMessage(value){
  const payload=typeof value==='string'?{text:value}:value;
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||typeof payload.text!=='string'||payload.text.length>1000)throw Error('请输入不超过 1000 字的消息。');
  const list=payload.images??[];
  if(!Array.isArray(list)||list.length>MAX_IMAGES)throw Error('每次最多附上 3 张图片。');
  let total=0;
  const images=list.map((item,index)=>{
    if(!item||typeof item.dataUrl!=='string'||item.dataUrl.length>Math.ceil(MAX_IMAGE_BYTES/3)*4+100)throw Error('图片过大或格式无效，请重新选择。');
    const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(item.dataUrl);
    if(!match||match[2].length%4)throw Error('只支持 PNG、JPEG、WebP 图片附件。');
    const bytes=Buffer.from(match[2],'base64');
    if(bytes.toString('base64')!==match[2]||!bytes.length||bytes.length>MAX_IMAGE_BYTES)throw Error('图片过大或编码无效。');
    const kind=match[1];
    const valid=kind==='png'?bytes.length>=33&&bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))&&bytes.toString('ascii',12,16)==='IHDR'&&bytes.readUInt32BE(16)>0&&bytes.readUInt32BE(20)>0&&bytes.readUInt32BE(16)<=8192&&bytes.readUInt32BE(20)<=8192:kind==='jpeg'?bytes.length>4&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217:bytes.length>=20&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
    if(!valid)throw Error('图片内容损坏或与格式不符，请重新选择。');
    total+=bytes.length;if(total>MAX_TOTAL_BYTES)throw Error('本次图片合计不能超过 12 MB。');
    return {name:typeof item.name==='string'?item.name.replace(/[\u0000-\u001f\\/]/g,'_').slice(0,100):`图片 ${index+1}`,dataUrl:item.dataUrl};
  });
  const text=payload.text.trim();if(!text&&!images.length)throw Error('请输入消息，或附上一张图片。');
  const prompt=text||'请看看我附上的图片，告诉我你注意到了什么。';
  const historyText=prompt+(images.length?`\n[本轮附图 ${images.length} 张：${images.map(image=>image.name).join('、')}。原图不保存在历史中，后续看图需要重新附图。]`:'');
  return {text:prompt,images,historyText};
}
module.exports={normalizeMessage,MAX_IMAGE_BYTES,MAX_TOTAL_BYTES,MAX_IMAGES};
