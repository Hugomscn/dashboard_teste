import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('../web/dist',import.meta.url)));
const port=Number(process.env.PORT||4173);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try {
    const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=resolve(root,'.'+(path==='/'?'/index.html':path));
    if(!file.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const info=await stat(file);
    if(!info.isFile())throw new Error('Not a file');
    let body=await readFile(file),encoding={};
    const acceptsGzip=String(req.headers['accept-encoding']??'').split(',').some(part=>{const [name,...parameters]=part.trim().split(';');return name==='gzip'&&!parameters.some(p=>/^\s*q\s*=\s*0(?:\.0*)?\s*$/.test(p));});
    if(acceptsGzip)try{body=await readFile(file+'.gz');encoding={'Content-Encoding':'gzip'};}catch{}
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Content-Length':body.length,'Cache-Control':'no-cache','Vary':'Accept-Encoding',...encoding,'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Frame-Options':'SAMEORIGIN'});
    res.end(req.method==='HEAD'?undefined:body);
  } catch {res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Arquivo não encontrado.');}
}).listen(port,'127.0.0.1',()=>console.log(`Dashboard independente: http://127.0.0.1:${port}/`)).on('error',error=>{console.error(error.message);process.exitCode=1;});
