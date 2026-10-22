import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapScale} from '../web/src/map-scale.js';
import {normalizeYearRange} from '../web/src/year-range.js';
import {normalizeFilters,pages} from '../web/src/state.js';
import {geographicContext} from '../web/src/territory.js';
const snapshot=JSON.parse(readFileSync(new URL('../data/aquicultura.json',import.meta.url),'utf8'));

test('Every available interval retains at least two years, including legacy single-year URLs and domain edges',()=>{
  const years=snapshot.metadata.years;
  for(const start of years)for(const end of years){
    const result=normalizeFilters({start,end,year:2020},snapshot);
    assert.ok(years.indexOf(result.end)>years.indexOf(result.start));
    assert.equal(result.year,2020);
    if(start!==end)assert.deepEqual([result.start,result.end],[Math.min(start,end),Math.max(start,end)]);
  }
  assert.deepEqual(normalizeYearRange(2013,2013,years),{start:2013,end:2014});
  assert.deepEqual(normalizeYearRange(2025,2025,years),{start:2024,end:2025});
  assert.deepEqual(normalizeYearRange(2015,2015,[2013,2015,2020]),{start:2013,end:2015});
});

test('Map intensity changes with measure, distinguishing zero and missing values',()=>{
  const rows=[{tonnes:10,valueReais:500},{tonnes:100,valueReais:50}];
  const quantity=mapScale(rows,'tonnes'),value=mapScale(rows,'valueReais');
  assert.equal(quantity.maximum,100);assert.equal(value.maximum,500);
  assert.notEqual(quantity.color(rows[0].tonnes),value.color(rows[0].valueReais));
  assert.equal(quantity.color(0),'var(--map-zero)');
  assert.equal(quantity.color(null),'url(#map-no-data)');
  assert.notEqual(quantity.color(0),quantity.color(null));
  assert.doesNotMatch(mapScale([{tonnes:0}], 'tonnes').color(0),/NaN|Infinity/);
});

test('National intensity domains and monetary denominators stay stable when selecting a state',()=>{
  const source=snapshot.queries.production.rows,base={year:2025,product:'all',region:'Sul',uf:'all'};
  const before=geographicContext(source,base),after=geographicContext(source,{...base,uf:'PR'});
  for(const metric of ['tonnes','valueReais'])assert.equal(mapScale(before.allStateRows,metric).maximum,mapScale(after.allStateRows,metric).maximum);
  const official=source.filter(r=>r.level==='BR'&&r.year==='2025').reduce((total,r)=>total+r.valueReais,0);
  assert.equal(after.nationalValue,official);
  assert.deepEqual(Object.keys(pages),['overview','territory','methodology']);
  assert.equal(pages.territory,'Produção');
});
