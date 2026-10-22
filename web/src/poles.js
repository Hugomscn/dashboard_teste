import {scopeMunicipalities,history,comparisonRows,sum,annualChange,ratio} from './model.js';

const indexes=new WeakMap();
function indexed(rows,products){
  if(!indexes.has(rows)){
    const selected=scopeMunicipalities(rows,{year:'all',product:'Tilápia'},products),byCode=new Map();
    for(const row of selected){if(!byCode.has(row.code))byCode.set(row.code,[]);byCode.get(row.code).push(row);}
    indexes.set(rows,byCode);
  }
  return indexes.get(rows);
}
export function poleRecords(rows,poles,id,products){
  const codes=new Set(poles.filter(p=>id==='all'||p.id===id).flatMap(p=>p.codes));
  const index=indexed(rows,products);
  return [...codes].flatMap(code=>index.get(code)??[]);
}
export function poleHistory(rows,poles,id,products){return history(poleRecords(rows,poles,id,products));}
export function poleRanking(rows,poles,year,products){
  return poles.map(p=>{
    const records=poleRecords(rows,poles,p.id,products),annual=records.filter(r=>+r.year===+year);
    return {id:p.id,label:p.label,tonnes:sum(annual,'tonnes'),valueReais:sum(annual,'valueReais'),valuePerKg:ratio(annual),annualGrowth:annualChange(records,'tonnes',year)};
  }).sort((a,b)=>(b.tonnes??-Infinity)-(a.tonnes??-Infinity));
}
export function poleMunicipalities(rows,poles,id,year,products){
  const records=poleRecords(rows,poles,id,products),lookup=new Map(records.map(r=>[r.municipality,r]));
  const observed=comparisonRows(records,'municipality',year).map(r=>({...r,code:lookup.get(r.label).code,uf:lookup.get(r.label).uf}));
  const unavailable=poles.filter(p=>p.id===id).flatMap(p=>p.unavailableMembers??[]).map(m=>({label:`${m.name} (${m.uf})`,uf:m.uf,code:m.code,year:String(year),tonnes:null,valueReais:null,valuePerKg:null,productionShare:null,annualGrowth:null}));
  return [...observed,...unavailable];
}
