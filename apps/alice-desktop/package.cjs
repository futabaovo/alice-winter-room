// Build from committed application assets; training and profiles are never inputs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {copyApplication}=require('./release-files.cjs');
const root=path.resolve(__dirname,'../..'),version=require('./package.json').version;
const outputArg=process.argv.find(a=>a.startsWith('--output='));
const output=outputArg?path.resolve(outputArg.slice(9)):path.join(root,'release','v'+version);
const runtimeName=`AliceKuonji-Windows-x64-v${version}`,exeName=`AliceKuonji-Winter-v${version}.exe`,zipName=`AliceKuonji-Windows-x64-v${version}.zip`;
if(fs.existsSync(output))throw Error('Refusing to overwrite an existing release. Choose a new --output directory: '+output);
const electron=path.join(root,'node_modules/electron/dist');
const sevenZip=process.env.SEVEN_ZIP||'C:/Program Files/7-Zip/7z.exe';
const compiler=process.env.CSC_PATH||'C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe';
for(const file of [path.join(electron,'electron.exe'),sevenZip,compiler])if(!fs.existsSync(file))throw Error('Build dependency missing: '+file);
const voices=JSON.parse(fs.readFileSync(path.join(__dirname,'web/voice/manifest.json'),'utf8'));
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for(const clip of voices.clips)if(sha(path.join(__dirname,'web',clip.src))!==clip.sha256)throw Error('Bundled voice checksum mismatch: '+clip.id);
fs.mkdirSync(output,{recursive:true});
const runtime=path.join(output,runtimeName);fs.mkdirSync(runtime);
for(const name of fs.readdirSync(electron)){
  if(['resources','electron.exe','version'].includes(name))continue;
  fs.cpSync(path.join(electron,name),path.join(runtime,name),{recursive:true});
}
fs.copyFileSync(path.join(electron,'electron.exe'),path.join(runtime,'AliceKuonji.exe'));
copyApplication(path.join(runtime,'resources/app'));
for(const name of ['使用说明.txt','RELEASE-NOTES.md','THIRD-PARTY-NOTICES.md'])fs.copyFileSync(path.join(__dirname,'release-docs',name),path.join(runtime,name));
const zip=path.join(output,zipName);
execFileSync(sevenZip,['a','-tzip','-mx=5','-mmt=4',zip,'.\\*'],{cwd:runtime,stdio:'inherit',windowsHide:true});
const key=version+'-'+sha(zip).slice(0,16);
const build=path.join(root,'.cache','alice-packaging',key);fs.mkdirSync(build,{recursive:true});
const launcher=fs.readFileSync(path.join(__dirname,'Launcher.cs'),'utf8').replace('__PAYLOAD_KEY__',key).replace('__EXE_LENGTH__',String(fs.statSync(path.join(runtime,'AliceKuonji.exe')).size));
const generated=path.join(build,'Launcher.build.cs');fs.writeFileSync(generated,launcher);
const single=path.join(output,exeName);
execFileSync(compiler,['/nologo','/target:winexe','/platform:x64','/optimize+','/win32icon:'+path.join(__dirname,'icon.ico'),'/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll','/reference:System.IO.Compression.dll','/reference:System.IO.Compression.FileSystem.dll','/resource:'+zip+',Alice.Payload','/resource:'+path.join(__dirname,'web/scene/winter-room-restored.png')+',Alice.SplashBackground','/resource:'+path.join(__dirname,'web/startup/robin-flight.png')+',Alice.SplashRobin','/out:'+single,generated],{stdio:'inherit',windowsHide:true});
for(const name of ['使用说明.txt','RELEASE-NOTES.md','THIRD-PARTY-NOTICES.md'])fs.copyFileSync(path.join(__dirname,'release-docs',name),path.join(output,name));
const artifacts=[exeName,zipName].map(file=>({file,bytes:fs.statSync(path.join(output,file)).size,sha256:sha(path.join(output,file))}));
const report={version,platform:'win32-x64',electron:require(path.join(root,'node_modules/electron/package.json')).version,runtimeCache:key,artifacts,voiceClips:voices.clips.length,modelSHA256:sha(path.join(runtime,'resources/app/web/model/AliceKuonjiWinter.moc3')),includesProfiles:false,includesTrainingData:false,includesNeuralWeights:false,voiceSynthesis:'Requires separately configured local voice workspace',codeSigned:false};
fs.writeFileSync(path.join(output,'build-manifest.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(output,'SHA256SUMS.txt'),artifacts.map(a=>a.sha256+'  '+a.file).join('\n')+'\n');
console.log(JSON.stringify({output,...report},null,2));
