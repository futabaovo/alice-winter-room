const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {startServer}=require('./server.cjs');
test('empty assets, HEAD and media byte ranges remain valid without crashing the local server',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'alice-assets-'));fs.writeFileSync(path.join(root,'empty.txt'),'');fs.writeFileSync(path.join(root,'clip.wav'),'0123456789');
  const {server,url}=await startServer(root);
  try{
    const empty=await fetch(url+'empty.txt');assert.equal(empty.status,200);assert.equal(empty.headers.get('content-length'),'0');assert.equal(await empty.text(),'');
    const head=await fetch(url+'clip.wav',{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-length'),'10');assert.equal(await head.text(),'');
    for(const [range,want,content]of [['bytes=2-5','2345','bytes 2-5/10'],['bytes=-3','789','bytes 7-9/10'],['bytes=8-99','89','bytes 8-9/10']]){const response=await fetch(url+'clip.wav',{headers:{Range:range}});assert.equal(response.status,206);assert.equal(await response.text(),want);assert.equal(response.headers.get('content-range'),content);}
    for(const [file,range]of [['empty.txt','bytes=0-'],['clip.wav','bytes=10-'],['clip.wav','bytes=-0'],['clip.wav','bytes=3-1']]){const response=await fetch(url+file,{headers:{Range:range}});assert.equal(response.status,416);await response.text();}
    assert.equal((await fetch(url+'missing.png')).status,404);assert.equal((await fetch(url+'%ZZ')).status,404);assert.equal(await(await fetch(url+'clip.wav')).text(),'0123456789');
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});}
});
