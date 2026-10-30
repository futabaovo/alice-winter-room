const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
function buildKeyboard(){
  const source=path.join(__dirname,'native/KeyboardPulse.cs'),target=path.join(__dirname,'native/KeyboardPulse.exe');
  if(fs.existsSync(target)&&fs.statSync(target).mtimeMs>=fs.statSync(source).mtimeMs)return target;
  const compiler=process.env.CSC_PATH||'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe';
  execFileSync(compiler,['/nologo','/target:exe','/platform:x64','/optimize+','/reference:System.Windows.Forms.dll','/out:'+target,source],{stdio:'pipe',windowsHide:true});return target;
}
module.exports={buildKeyboard};if(require.main===module)console.log(buildKeyboard());
