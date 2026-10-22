import {mkdir, readFile, writeFile, copyFile, readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const root=fileURLToPath(new URL('../',import.meta.url));
const output=join(root,'web/dist');
const source=JSON.parse(await readFile(join(root,'data/aquicultura.json'),'utf8'));
await import('./prepare-poles.mjs');
const poles=JSON.parse(await readFile(join(root,'data/tilapia-poles.json'),'utf8'));
for(const key of ['production','municipalities','geography']) {
  if(!Array.isArray(source.queries?.[key]?.rows)||!source.queries[key].rows.length) throw new Error(`Dados ausentes: ${key}`);
}
const data={id:source.id,title:source.title,generatedAt:source.generatedAt,metadata:source.metadata,queries:source.queries};
data.queries={...data.queries,poles:{rows:poles.rows,source:poles.source}};
const poleCodes=new Set(poles.rows.flatMap(p=>p.codes));
data.queries.poleProduction={...source.queries.municipalities,rows:source.queries.municipalities.rows.filter(row=>poleCodes.has(row.code)),source:{...source.queries.municipalities.source,label:'IBGE · Municípios cadastrados nos polos de tilápia',caveats:[...source.queries.municipalities.source.caveats,'Subconjunto dos municípios do cadastro de polos; registros originais preservados. O painel seleciona somente a categoria Tilápia.']}};
await mkdir(join(output,'assets'),{recursive:true});
await mkdir(join(output,'data'),{recursive:true});
await copyFile(join(root,'web/index.html'),join(output,'index.html'));
await copyFile(join(root,'web/IMPLANTACAO.md'),join(output,'IMPLANTACAO.md'));
const files=(await readdir(join(root,'web/src'))).filter(file=>/\.(js|css)$/.test(file));
const hashes={};
for(const file of files) {
  const bytes=await readFile(join(root,'web/src',file));
  if(/chatgpt|codex|data-app-public|data-app-runtime|\.chatgpt\.site/i.test(bytes.toString())) throw new Error(`Dependência de plataforma encontrada em ${file}`);
  await writeFile(join(output,'assets',file),bytes);
  hashes[`assets/${file}`]=createHash('sha256').update(bytes).digest('hex');
}
const bytes=JSON.stringify(data);
await writeFile(join(output,'data/aquicultura.json'),bytes);
hashes['data/aquicultura.json']=createHash('sha256').update(bytes).digest('hex');
// Retain the complete portable snapshot for compatibility; the browser uses the
// small catalog and independently cacheable queries instead of this monolith.
const catalog={...data,queries:{}};
for(const [id,query] of Object.entries(data.queries)){
  const file=`${id}.json`,content=JSON.stringify(query.rows);
  await writeFile(join(output,'data',file),content);
  hashes[`data/${file}`]=createHash('sha256').update(content).digest('hex');
  const {rows,...metadata}=query;
  catalog.queries[id]={...metadata,file,rowCount:rows.length,preload:!['municipalities','poles','poleProduction'].includes(id)};
}
await writeFile(join(output,'data/catalog.json'),JSON.stringify(catalog));
hashes['data/catalog.json']=createHash('sha256').update(JSON.stringify(catalog)).digest('hex');
for(const file of ['index.html','IMPLANTACAO.md'])hashes[file]=createHash('sha256').update(await readFile(join(output,file))).digest('hex');
for(const file of Object.keys(hashes).filter(file=>/\.(js|css|json|html)$/.test(file))){
  const content=gzipSync(await readFile(join(output,file)));
  await writeFile(join(output,file+'.gz'),content);
  hashes[file+'.gz']=createHash('sha256').update(content).digest('hex');
}
await writeFile(join(output,'build-manifest.json'),JSON.stringify({name:'aquicultura-dashboard',builtAt:new Date().toISOString(),sourceSha256:data.metadata.sourceSha256,files:hashes},null,2));
console.log(`Dashboard independente preparado em ${output}. ${files.length} módulos/estilos; ${(Buffer.byteLength(bytes)/1e6).toFixed(2)} MB de dados. Sem dependências externas.`);
