const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
function buildSystemVoice(){
  const source=path.join(__dirname,'native/SystemVoice.cs'),target=path.join(__dirname,'native/SystemVoice.exe');
  if(fs.existsSync(target)&&fs.statSync(target).mtimeMs>=fs.statSync(source).mtimeMs)return target;
  const compiler=process.env.CSC_PATH||'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe';
  const speech=path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET/assembly/GAC_MSIL/System.Speech/v4.0_4.0.0.0__31bf3856ad364e35/System.Speech.dll');
  execFileSync(compiler,['/nologo','/target:exe','/platform:x64','/optimize+','/reference:'+speech,'/reference:System.Web.Extensions.dll','/out:'+target,source],{windowsHide:true,stdio:'pipe'});return target;
}
exports.buildSystemVoice=buildSystemVoice;if(require.main===module)console.log(buildSystemVoice());
