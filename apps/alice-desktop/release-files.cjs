// Application-only boundary: never traverse profiles or training data.
const fs=require('node:fs'),path=require('node:path');
const runtimeFiles=['package.json','main.cjs','preload.cjs','desktop-pet.cjs','desktop-pet-window.cjs','pet-edge-state.cjs','server.cjs','voice-host.cjs','voice_service.py','chat-host.cjs','image-input.cjs','companion-store.cjs','proactive-host.cjs','reply-plan.cjs','codex-host.cjs','tea-host.cjs','farewell-host.cjs','character-persona.zh-CN.txt','icon.ico'];
const unusedWardrobe=new Set(['clean-bob-neck.png','white-coat.png','white-cap-v7.png','white-cap-v8.png','white-cap-v9-draft.png','white-cap-v11.png','white-hair-v6.png','white-head-v3.png','white-head-v4.png']);
const allowed=name=>!(/\.(?:cmo3|can3|psd2live\.json)$/i.test(name)||name==='model/expressions/expressions'||/^startup-art\./.test(name)||name.startsWith('wardrobe/')&&unusedWardrobe.has(path.posix.basename(name)));
function scrub(value){
  if(Array.isArray(value))return value.map(scrub);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,scrub(v)]));
  if(typeof value!=='string')return value;
  // Anchor the drive prefix so https:// links are never mistaken for paths.
  return /^[A-Za-z]:[\\/]/.test(value)?path.win32.basename(value.replace(/\//g,'\\'))||'[local reference]':value;
}
function copyFile(source,target){fs.mkdirSync(path.dirname(target),{recursive:true});if(path.extname(source)==='.json')fs.writeFileSync(target,JSON.stringify(scrub(JSON.parse(fs.readFileSync(source,'utf8'))),null,2)+'\n');else fs.copyFileSync(source,target);}
function copyTree(source,target,prefix=''){
  for(const entry of fs.readdirSync(source,{withFileTypes:true})){
    if(entry.isSymbolicLink())throw Error('Release tree must not contain links: '+entry.name);
    const relative=prefix+entry.name;if(!allowed(relative))continue;
    if(entry.isDirectory())copyTree(path.join(source,entry.name),path.join(target,entry.name),relative+'/');else copyFile(path.join(source,entry.name),path.join(target,entry.name));
  }
}
function copyApplication(destination,{source=false}={}){
  const names=new Set([...runtimeFiles,...fs.readdirSync(__dirname).filter(name=>/^verify.*\.cjs$/.test(name))]);
  if(source)for(const name of fs.readdirSync(__dirname))if(/^test-.*\.cjs$/.test(name)||['package.cjs','release-files.cjs','Launcher.cs','prepare-expressions.cjs'].includes(name))names.add(name);
  for(const name of names)copyFile(path.join(__dirname,name),path.join(destination,name));
  for(const name of ['character','web','release-docs'])copyTree(path.join(__dirname,name),path.join(destination,name));
}
exports.copyApplication=copyApplication;
