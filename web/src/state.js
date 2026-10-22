import {normalize} from './utils.js';
import {normalizeYearRange} from './year-range.js';
export const pages={overview:'Visão geral',territory:'Produção',methodology:'Fontes e metodologia'};
export function defaultFilters(snapshot){return {year:Math.max(...snapshot.metadata.years),start:Math.min(...snapshot.metadata.years),end:Math.max(...snapshot.metadata.years),region:'all',uf:'all',product:'all'};}
export function normalizeFilters(input,snapshot){
  const defaults=defaultFilters(snapshot),years=snapshot.metadata.years;
  const validYear=value=>years.includes(+value);
  let start=validYear(input.start)?+input.start:defaults.start,end=validYear(input.end)?+input.end:defaults.end;
  ({start,end}=normalizeYearRange(start,end,years));
  const year=validYear(input.year)?+input.year:validYear(input.end)?+input.end:defaults.year;
  const regions=new Set(snapshot.queries.production.rows.filter(r=>r.level==='GR').map(r=>r.region));
  const state=snapshot.queries.production.rows.find(r=>r.level==='UF'&&r.uf===input.uf);
  return {year,start,end,region:state?.region??(regions.has(input.region)?input.region:'all'),uf:state?.uf??'all',product:snapshot.metadata.products.includes(input.product)?input.product:'all'};
}
export function domainFilters(filters,allYears=false){return {year:allYears?'all':`${filters.start}..${filters.end}`,region:filters.region,uf:filters.uf,product:filters.product};}
export function filterTable(rows,view={}){
  const text=normalize(view.search??'');
  const filtered=text?rows.filter(row=>normalize(Object.values(row).filter(v=>typeof v==='string').join(' ')).includes(text)):rows;
  if(!view.sort)return [...filtered];
  const sign=view.direction==='desc'?-1:1;
  return [...filtered].sort((a,b)=>{
    const left=a[view.sort],right=b[view.sort];
    if(left==null&&right==null)return 0;if(left==null)return 1;if(right==null)return -1;
    return (typeof left==='number'&&typeof right==='number'?left-right:String(left).localeCompare(String(right),'pt-BR',{numeric:true}))*sign;
  });
}
