import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nearestYearIndex} from '../web/src/time-interaction.js';
import {comboGeometry,axisMaximum} from '../web/src/combo-chart.js';

test('Shorter intervals widen bars without clipping or overlapping at desktop and mobile widths',()=>{
  const rows=Array.from({length:13},(_,i)=>({year:String(2013+i),tonnes:i,valueReais:i*10}));
  for(const width of [320,600,1400]){
    const full=comboGeometry(rows,width);
    for(const size of [2,4,8]){
      const short=comboGeometry(rows.slice(-size),width);
      assert.ok(short.barWidth>full.barWidth);
      assert.ok(short.points[0].x-short.barWidth/2>=short.left);
      assert.ok(short.points.at(-1).x+short.barWidth/2<=short.width-short.right);
      assert.ok(short.points[1].x-short.points[0].x>short.barWidth);
    }
  }
});

test('Hover finds the closest annual observation, including plot edges and gaps',()=>{
  assert.equal(nearestYearIndex([10,30,50],-100),0);
  assert.equal(nearestYearIndex([10,30,50],29),1);
  assert.equal(nearestYearIndex([10,30,50],1000),2);
  assert.equal(nearestYearIndex([25],70),0);
});

test('Quantity bars and nominal-value line use independent axes and the same ordered years',()=>{
  const rows=[{year:'2020',tonnes:10,valueReais:1000},{year:'2021',tonnes:20,valueReais:500}];
  const g=comboGeometry(rows,900);
  assert.ok(g.points[1].quantityY<g.points[0].quantityY);
  assert.ok(g.points[1].valueY>g.points[0].valueY);
  assert.deepEqual(g.points.map(p=>p.row.year),['2020','2021']);
  assert.ok(g.points[0].x-g.barWidth/2>=g.left);
  assert.ok(g.points.at(-1).x+g.barWidth/2<=g.width-g.right);
  const changed=comboGeometry(rows.map(r=>({...r,valueReais:r.valueReais*100})),900);
  assert.deepEqual(changed.points.map(p=>p.quantityY),g.points.map(p=>p.quantityY));
  assert.equal(changed.valueMaximum,g.valueMaximum*100);
});

test('Missing measures retain gaps while measured zero stays on the baseline',()=>{
  const g=comboGeometry([{year:'2020',tonnes:null,valueReais:0},{year:'2021',tonnes:0,valueReais:null}],600);
  assert.equal(g.points[0].quantityY,null);assert.equal(g.points[0].valueY,g.bottom);
  assert.equal(g.points[1].quantityY,g.bottom);assert.equal(g.points[1].valueY,null);
  assert.ok(Number.isFinite(axisMaximum([null,0]))&&axisMaximum([null,0])>0);
});
