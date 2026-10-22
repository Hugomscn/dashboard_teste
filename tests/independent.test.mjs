import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {csv} from '../web/src/utils.js';
import {defaultFilters,normalizeFilters,domainFilters,filterTable} from '../web/src/state.js';
import {createHash} from 'node:crypto';
const snapshot=JSON.parse(readFileSync(new URL('../data/aquicultura.json',import.meta.url),'utf8'));
test('Annual scope and state/region consistency survive independent URL state',()=>{
  assert.deepEqual(defaultFilters(snapshot),{year:2025,start:2013,end:2025,region:'all',uf:'all',product:'all'});
  const normalized=normalizeFilters({start:2022,end:2019,region:'Norte',uf:'PR',product:'Tilápia'},snapshot);
  assert.deepEqual(normalized,{year:2019,start:2019,end:2022,region:'Sul',uf:'PR',product:'Tilápia'});
  assert.equal(domainFilters(normalized).year,'2019..2022');
  assert.equal(domainFilters(normalized,true).year,'all');
  assert.deepEqual(normalizeFilters({start:'bad',end:'2099',region:'bad',uf:'bad',product:'bad'},snapshot),defaultFilters(snapshot));
});
test('Search, sort and CSV operate on the entire filtered table, preserving zeros/nulls',()=>{
  const rows=[{label:'Tilápia',value:0},{label:'Camarão',value:null},{label:'Tambaqui',value:20}];
  assert.equal(filterTable(rows,{search:'tilapia'})[0].value,0);
  assert.deepEqual(filterTable(rows,{sort:'value',direction:'desc'}).map(row=>row.value),[20,0,null]);
  const text=csv([{label:'=command',value:0},{label:'a;"b',value:null}]);
  assert.ok(text.startsWith('\ufeff'));
  assert.ok(text.includes('"\'=command";"0"'));
  assert.ok(text.includes('"a;""b";""'));
});
test('Delivered application contains no platform scripts, remote dependencies or API calls',()=>{
  const root=new URL('../web/dist/',import.meta.url),html=readFileSync(new URL('index.html',root),'utf8');
  assert.match(html,/connect-src 'self'/);
  assert.doesNotMatch(html,/<script[^>]+src=["']https?:|data-app|chatgpt|codex/i);
  for(const file of readdirSync(new URL('assets/',root))){
    const code=readFileSync(new URL('assets/'+file,root),'utf8');
    // The SVG namespace identifies local DOM nodes; it is not a network request.
    assert.doesNotMatch(code.replaceAll('http://www.w3.org/2000/svg',''),/chatgpt|codex|data-app-public|\.chatgpt\.site|https?:\/\//i,file);
  }
  const delivered=JSON.parse(readFileSync(new URL('data/aquicultura.json',root),'utf8'));
  const manifest=JSON.parse(readFileSync(new URL('build-manifest.json',root),'utf8'));
  for(const [path,expected] of Object.entries(manifest.files))assert.equal(createHash('sha256').update(readFileSync(new URL(path,root))).digest('hex'),expected,path);
  assert.equal(delivered.id,snapshot.id);
  for(const [id,query] of Object.entries(snapshot.queries))assert.deepEqual(delivered.queries[id],query);
  assert.equal(delivered.queries.poles.rows.length,11);
  assert.equal(createHash('sha256').update(readFileSync(new URL('../prod_anual_aquicultura_ibge.xlsx',import.meta.url))).digest('hex'),snapshot.metadata.sourceSha256);
});
