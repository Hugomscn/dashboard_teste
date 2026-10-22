import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {defaultFilters,normalizeFilters,pages} from '../web/src/state.js';
import {geographicContext,geographicStepBack} from '../web/src/territory.js';
import {yearRangeMarkup} from '../web/src/year-range.js';
const snapshot=JSON.parse(readFileSync(new URL('../data/aquicultura.json',import.meta.url),'utf8'));
const rows=snapshot.queries.production.rows;
test('Annual year is independent from both temporal bounds, expanding single-year links to two available years',()=>{
  const base=defaultFilters(snapshot);
  const f=normalizeFilters({...base,year:2020,start:2016,end:2023},snapshot);
  assert.deepEqual([f.year,f.start,f.end],[2020,2016,2023]);
  const moved=normalizeFilters({...f,start:2022,end:2022},snapshot);
  assert.equal(moved.year,2020);
  const annual=normalizeFilters({...moved,year:2025},snapshot);
  assert.deepEqual([annual.start,annual.end],[2021,2022]);
});
test('State selection retains national and regional denominators and all comparison regions',()=>{
  const base={...defaultFilters(snapshot),region:'Sul',uf:'PR'};
  const context=geographicContext(rows,base),pr=context.allStateRows.find(row=>row.uf==='PR');
  assert.equal(context.regionRows.length,5);assert.equal(context.stateRows.length,3);
  assert.ok(pr.nationalShare>0&&pr.nationalShare<1);assert.ok(pr.regionalShare>0&&pr.regionalShare<1);
  assert.ok(Math.abs(pr.nationalShare-pr.tonnes/context.national)<1e-12);
  const unselected=geographicContext(rows,{...base,uf:'all'});
  assert.deepEqual(context.regionRows,unselected.regionRows);
  assert.deepEqual(context.allStateRows,unselected.allStateRows);
  assert.ok(Math.abs(context.regionRows.reduce((sum,row)=>sum+row.nationalShare,0)-1)<1e-9);
  const tilapia=geographicContext(rows,{...base,product:'Tilápia'});
  assert.notEqual(tilapia.national,context.national);
});
test('Map back clears only one geographic level and preserves species, annual year and interval',()=>{
  const f={...defaultFilters(snapshot),year:2020,start:2016,end:2023,region:'Sul',uf:'PR',product:'Tilápia'};
  const first=geographicStepBack(f,'states');assert.equal(first.level,'states');assert.equal(first.filters.uf,'all');assert.equal(first.filters.region,'Sul');
  const second=geographicStepBack(first.filters,'states');assert.equal(second.level,'regions');assert.equal(second.filters.region,'all');
  assert.deepEqual([second.filters.product,second.filters.year,second.filters.start,second.filters.end],['Tilápia',2020,2016,2023]);
});
test('One track exposes two named year handles; municipal source and implementation stay preserved',()=>{
  const html=yearRangeMarkup({start:2016,end:2023},snapshot.metadata.years);
  assert.equal((html.match(/class="dual-range"/g)||[]).length,1);assert.equal((html.match(/type="range"/g)||[]).length,2);
  assert.match(html,/Ano inicial da série/);assert.match(html,/Ano final da série/);
  assert.equal(Object.values(pages).includes('Municípios'),false);assert.equal(pages.territory,'Produção');
  assert.ok(snapshot.queries.municipalities.rows.length>55000);
  assert.match(readFileSync(new URL('../web/archive/app-com-consulta-municipal.js',import.meta.url),'utf8'),/function municipalities\(/);
  const active=readFileSync(new URL('../web/src/app.js',import.meta.url),'utf8');
  assert.doesNotMatch(active,/function municipalities\(|Consulta municipal|Ver municípios|10 maiores UFs|label:'Produto'/);
});
