import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sum, ratio, annualChange, scopeProduction, scopeMunicipalities, history, comparisonRows, yearBounds } from '../web/src/model.js';
const snapshot = JSON.parse(readFileSync(new URL('../data/aquicultura.json', import.meta.url), 'utf8'));
const rows = snapshot.queries.production.rows;
const municipal = snapshot.queries.municipalities.rows;
const near = (a,b,tolerance=0.00001) => assert.ok(Math.abs(a-b)<tolerance, `${a} != ${b}`);
const national = scopeProduction(rows, {year:'2025',region:'all',product:'all'}, 'BR');
const current = national.filter(r=>r.year==='2025');
near(sum(current,'tonnes'),965365.226);
near(sum(current,'valueReais'),12253767244);
near(annualChange(national,'tonnes',2025),965365.226/886673.067-1);
assert.equal(history(national).length,13);
assert.equal(history(scopeProduction(rows,{year:'2013'},'BR')).length,1);
assert.equal(annualChange(national,'tonnes',2013),null);
const products = comparisonRows(national,'product',2025);
near(sum(products,'productionShare'),1);
assert.equal(products.length,20);
const regional = scopeProduction(rows,{year:'2025'},'GR').filter(r=>r.year==='2025');
near(sum(regional,'tonnes'),sum(current,'tonnes'));
const states = scopeProduction(rows,{year:'2025'},'UF').filter(r=>r.year==='2025');
near(sum(states,'tonnes'),sum(current,'tonnes'));
for (const year of snapshot.metadata.years) {
  const br = rows.filter(r=>r.level==='BR' && +r.year===year);
  const gr = rows.filter(r=>r.level==='GR' && +r.year===year);
  const uf = rows.filter(r=>r.level==='UF' && +r.year===year);
  near(sum(br,'tonnes'),sum(gr,'tonnes'));
  near(sum(br,'tonnes'),sum(uf,'tonnes'));
}
const subgroup = scopeProduction(rows,{region:'Sul',product:'Tilápia',year:'2020'},'GR');
assert.ok(subgroup.length>0 && subgroup.every(r=>r.region==='Sul' && r.product==='Tilápia' && +r.year<=2020));
const reset = scopeProduction(rows,{region:'all',product:'all',year:'2025'},'BR');
assert.equal(reset.length,260);
assert.equal(sum([{x:null},{x:null}],'x'),null);
assert.equal(sum([{x:0},{x:null}],'x'),0);
assert.equal(ratio([{tonnes:0,valueReais:10}]),null);
near(ratio([{tonnes:1,valueReais:2000},{tonnes:3,valueReais:24000},{tonnes:null,valueReais:100000}]),6.5);
// Missing/new categories cannot enter the annual comparison denominator.
near(annualChange([
 {year:'2024',level:'BR',code:'1',product:'a',tonnes:10},
 {year:'2025',level:'BR',code:'1',product:'a',tonnes:12},
 {year:'2025',level:'BR',code:'1',product:'b',tonnes:100},
],'tonnes',2025),0.2);
const selected = scopeMunicipalities(municipal,{year:'2020',region:'Sul',uf:'PR'});
assert.ok(selected.length>0 && selected.every(r=>+r.year<=2020 && r.uf==='PR' && r.region==='Sul'));
assert.equal(scopeMunicipalities(municipal,{region:'Norte',uf:'PR'}).length,0);
assert.equal(scopeMunicipalities(municipal,{year:'2025',region:'all',uf:'all'}).length,55640);
assert.equal(new Set(municipal.map(r=>r.code)).size,4280);
assert.equal(new Set(municipal.map(r=>`${r.code}|${r.year}`)).size,55640);
console.log('Validated: national totals, 13-year geographic reconciliation, annual comparisons, filters/reset, missing values, weighted unit value, municipal uniqueness and empty scope.');
assert.deepEqual(yearBounds('2019..2022'),[2019,2022]);
assert.deepEqual(yearBounds('2025'),[2013,2025]);
assert.equal(history(scopeProduction(rows,{year:'2019..2022'},'BR')).length,4);
assert.ok(history(national).every(row=>/^\d{4}$/.test(row.year)&&!('date' in row)));
for(const product of snapshot.metadata.products) {
  const filtered=scopeMunicipalities(municipal,{product,year:'2025..2025'},snapshot.metadata.products);
  const direct=current.filter(r=>r.product===product);
  near(sum(filtered,'tonnes'),sum(direct,'tonnes'));
  near(sum(filtered,'valueReais'),sum(rows.filter(r=>r.level==='UF'&&r.year==='2025'&&r.product===product),'valueReais'),1);
}
const missingMunicipality=municipal.find(r=>r.productData===null);
assert.equal(scopeMunicipalities([missingMunicipality],{product:'Tilápia'},snapshot.metadata.products)[0].tonnes,null);
assert.equal(snapshot.queries.geography.rows.filter(r=>r.level==='GR').length,5);
assert.equal(snapshot.queries.geography.rows.filter(r=>r.level==='UF').length,27);
assert.ok(snapshot.queries.geography.rows.every(r=>r.path.startsWith('M')&&!r.path.includes('NaN')));
console.log('Validated: annual intervals, year-only axes, all 20 municipal product totals, missing municipality preservation and 32 geographic features.');
