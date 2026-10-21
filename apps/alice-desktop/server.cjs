const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.vert': 'text/plain',
  '.frag': 'text/plain',
  '.wasm': 'application/wasm'
};

exports.startServer = async function startServer(root) {
  const resolvedRoot = path.resolve(root);
  const server = http.createServer(async (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405).end();
        return;
      }
      const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
      const file = path.resolve(resolvedRoot, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(resolvedRoot + path.sep)) {
        response.writeHead(403).end();
        return;
      }
      const stat = await fs.promises.stat(file);
      if (!stat.isFile()) {
        response.writeHead(404).end();
        return;
      }
      let start=0,end=stat.size-1,code=200;
      if(request.headers.range){
        const match=/^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if(!match||(!match[1]&&!match[2])){response.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}
        if(!match[1])start=Math.max(0,stat.size-Number(match[2]));
        else{start=Number(match[1]);if(match[2])end=Math.min(end,Number(match[2]));}
        if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=stat.size){response.writeHead(416,{'Content-Range':`bytes */${stat.size}`}).end();return;}
        code=206;
      }
      response.writeHead(code, {
        'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream',
        'Content-Length': end-start+1,
        'Accept-Ranges':'bytes',
        ...(code===206?{'Content-Range':`bytes ${start}-${end}/${stat.size}`} : {}),
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; connect-src 'self'"
      });
      if (request.method === 'HEAD') response.end();
      else fs.createReadStream(file,{start,end}).on('error', () => response.destroy()).pipe(response);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${server.address().port}/` };
};
