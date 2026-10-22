import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {thematicHistory,themes,themeDefinitions} from '../web/src/themes.js';
import {poleHistory,poleRanking,poleMunicipalities,poleRecords} from '../web/src/poles.js';
import {sum,scopeProduction} from '../web/src/model.js';
import {createDataStore} from '../web/src/data-store.js';
const data=JSON.parse(readFileSync(new URL('../data/aquicultura.json',import.meta.url),'utf8'));
const poles=JSON.parse(readFileSync(new URL('../data/tilapia-poles.json',import.meta.url),'utf8')).rows;
const products=data.metadata.products,years=data.metadata.years;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);

test('All thematic classifications partition the 20 categories and reconcile at every territory/year',()=>{
  for(const id of Object.keys(themes)){
    const definitions=themeDefinitions(id,products),assigned=definitions.flatMap(g=>g.products);
    assert.equal(assigned.length,20);assert.equal(new Set(assigned).size,20);
    for(const code of new Set(data.queries.production.rows.map(r=>r.level+'|'+r.code))){
      const records=data.queries.production.rows.filter(r=>r.level+'|'+r.code===code);
      const result=thematicHistory(records,id,years,products);
      for(const row of result.rows){
        near(row.total,sum(records.filter(r=>r.year===row.year),'tonnes'));
        const shares=result.series.map(s=>row[s.key+'Share']);
        if(row.total>0)near(shares.reduce((a,b)=>a+b,0),1);else assert.ok(shares.every(v=>v===null));
      }
    }
  }
  assert.deepEqual(themeDefinitions('tilapia',products).find(g=>g.label==='Redondos').products,['Pacu e patinga','Pirapitinga','Tambacu, tambatinga','Tambaqui']);
  assert.equal(themes.origin.classify('Camarão'),'Exóticos');
  assert.equal(themes.origin.classify('Outros peixes'),'Outros');
  for(const id of Object.keys(themes))assert.deepEqual(themeDefinitions(id,[...products,'Categoria nova']).at(-1),{label:'Não classificado',products:['Categoria nova']});
});

test('Value composition uses monetary totals and shares, preserving quantity results and missing values',()=>{
  const records=data.queries.production.rows.filter(r=>r.level==='BR');
  for(const id of Object.keys(themes)){
    const values=thematicHistory(records,id,years,products,'valueReais');
    for(const row of values.rows){
      near(row.total,sum(records.filter(r=>r.year===row.year),'valueReais'));
      near(values.series.reduce((total,s)=>total+row[s.key+'Share'],0),1);
      values.series.forEach(s=>near(row[s.key+'Share'],row[s.key]/row.total));
    }
    assert.ok(values.exportRows.every(r=>'valueReais' in r&&'valueShare' in r&&!('tonnes' in r)&&!('productionShare' in r)));
  }
  const sample=[{year:'2025',product:'Tilápia',tonnes:100,valueReais:10},{year:'2025',product:'Tambaqui',tonnes:100,valueReais:90},{year:'2025',product:'Outros peixes',tonnes:0,valueReais:0}];
  const quantity=thematicHistory(sample,'tilapia',[2025],['Tilápia','Tambaqui','Outros peixes']).rows[0];
  const value=thematicHistory(sample,'tilapia',[2025],['Tilápia','Tambaqui','Outros peixes'],'valueReais').rows[0];
  near(quantity.group0Share,.5);near(value.group0Share,.1);
  sample[0].valueReais=null;
  const missing=thematicHistory(sample,'tilapia',[2025],['Tilápia','Tambaqui','Outros peixes'],'valueReais').rows[0];
  assert.equal(missing.total,null);assert.equal(missing.group0Share,null);
});

test('Missing categories cannot become zeros or generate a false 100%; zero totals remain undefined',()=>{
  const rows=products.map(product=>({year:'2025',product,tonnes:0}));
  let result=thematicHistory(rows,'origin',[2025],products);
  assert.equal(result.rows[0].total,0);assert.equal(result.rows[0].group0Share,null);
  rows[0].tonnes=null;rows[1].tonnes=10;
  result=thematicHistory(rows,'origin',[2025],products);
  assert.equal(result.rows[0].total,null);assert.equal(result.rows[0].group1,null);
  assert.ok(result.series.every(s=>result.rows[0][s.key+'Share']===null));
});

test('Poles sum only tilapia, reconcile through their municipalities, preserve the missing member and never double count',()=>{
  const municipal=data.queries.municipalities.rows,index=products.indexOf('Tilápia');
  assert.equal(poles.length,11);assert.equal(new Set(poles.flatMap(p=>p.codes)).size,222);
  for(const year of years){
    const ranking=poleRanking(municipal,poles,year,products);
    const union=new Set(poles.flatMap(p=>p.codes));
    const expected=municipal.filter(r=>+r.year===year&&union.has(r.code)).reduce((total,r)=>total+(JSON.parse(r.productData)?.[index]?.[0]??0),0);
    near(sum(ranking,'tonnes'),expected);
    near(poleHistory(municipal,poles,'all',products).find(r=>+r.year===year).tonnes,expected);
    for(const pole of poles)near(sum(poleMunicipalities(municipal,poles,pole.id,year,products),'tonnes'),ranking.find(r=>r.id===pole.id).tonnes);
  }
  const absent=poleMunicipalities(municipal,poles,'norte-pr',2025,products).find(r=>r.code==='4128500');
  assert.equal(absent.tonnes,null);assert.equal(absent.productionShare,null);
  assert.ok(poles.find(p=>p.id==='boa-esperanca').codes.includes('2111102'));
  assert.deepEqual(poleRecords(municipal,[poles[0],poles[0]],'all',products),poleRecords(municipal,[poles[0]],'all',products));
});

test('Query loading is lazy, deduplicates requests, retries failures and reconstructs the original data',async()=>{
  const root=new URL('../web/dist/data/',import.meta.url),calls=[];
  const fetcher=async url=>{calls.push(url.pathname.split('/').at(-1));return {ok:true,json:async()=>JSON.parse(readFileSync(url,'utf8'))};};
  const store=await createDataStore(root,fetcher);
  assert.deepEqual(new Set(calls),new Set(['catalog.json','production.json','geography.json']));
  assert.equal(store.snapshot.queries.municipalities.rows.length,0);
  await Promise.all([store.ensure('municipalities'),store.ensure('municipalities')]);
  assert.equal(calls.filter(f=>f==='municipalities.json').length,1);
  for(const id of ['production','geography','municipalities'])assert.deepEqual(store.snapshot.queries[id].rows,data.queries[id].rows);
  await store.ensure('poleProduction');
  const registered=new Set(poles.flatMap(p=>p.codes));
  assert.deepEqual(store.snapshot.queries.poleProduction.rows,data.queries.municipalities.rows.filter(r=>registered.has(r.code)));
  assert.equal(store.snapshot.queries.poleProduction.rows.length,2873);
  let failed=false;
  const retry=await createDataStore(root,async url=>{
    if(url.pathname.endsWith('municipalities.json')&&!failed){failed=true;return {ok:false,status:503};}return fetcher(url);
  });
  await assert.rejects(retry.ensure('municipalities'),/503/);
  await retry.ensure('municipalities');assert.equal(retry.snapshot.queries.municipalities.rows.length,55640);
  const filters={year:'all',region:'Sul',uf:'PR',product:'Tilápia'};
  assert.deepEqual(scopeProduction(data.queries.production.rows,filters,'UF'),data.queries.production.rows.filter(r=>r.level==='UF'&&r.uf==='PR'&&r.product==='Tilápia'));
});
