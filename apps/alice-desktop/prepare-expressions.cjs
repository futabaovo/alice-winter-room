const fs=require('node:fs'),path=require('node:path');
const base={ParamAngleX:0,ParamAngleY:0,ParamAngleZ:0,ParamBodyAngleX:0,ParamBodyAngleY:0,ParamBodyAngleZ:0,ParamBodyLean:0,ParamEyeLOpen:.98,ParamEyeROpen:.98,ParamEyeBallX:0,ParamEyeBallY:0,ParamEyeBallForm:0,ParamBrowLY:-.08,ParamBrowRY:-.08,ParamMouthForm:-.12,ParamMouthOpenY:0};
function prepareExpressions(directories){
  const moods=require('./character/expressions.json'),manifest=moods.map(({parameters:overrides,...definition})=>{
    const file=definition.id+'.exp3.json',expression={Type:'Live2D Expression',FadeInTime:.35,FadeOutTime:.35,Parameters:Object.entries({...base,...overrides}).map(([Id,Value])=>({Id,Value,Blend:'Overwrite'}))};
    for(const directory of directories){const folder=path.join(directory,'expressions');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,file),JSON.stringify(expression,null,2));}
    const preview=definition.id+'.png';return {...definition,file,faceShadow:definition.faceShadow||0,...(fs.existsSync(path.join(__dirname,'web/expression-previews',preview))?{preview}:{})};
  });
  for(const directory of directories){
    fs.writeFileSync(path.join(directory,'expressions/manifest.json'),JSON.stringify(manifest,null,2));
    const model=path.join(directory,'AliceKuonjiWinter.model3.json'),settings=JSON.parse(fs.readFileSync(model,'utf8'));
    settings.FileReferences.Expressions=manifest.map(m=>({Name:m.name,File:'expressions/'+m.file}));fs.writeFileSync(model,JSON.stringify(settings,null,2));
  }
  return manifest;
}
if(require.main===module)console.log(JSON.stringify({expressions:prepareExpressions([path.join(__dirname,'web/model'),path.resolve(__dirname,'../../comfyui/assets/alice-v2/model')]).length}));
module.exports={prepareExpressions,base};
