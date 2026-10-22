import {scopeProduction,comparisonRows,sum} from './model.js';
import {domainFilters} from './state.js';
const cachedContexts=new WeakMap();

// Comparison denominators deliberately ignore the selected geographic item.
// They keep the species and annual year, allowing a selected area to retain context.
export function geographicContext(production,filters){
  if(!cachedContexts.has(production))cachedContexts.set(production,new Map());
  const cache=cachedContexts.get(production),key=JSON.stringify([filters.year,filters.product,filters.region]);
  if(cache.has(key))return cache.get(key);
  const base={...domainFilters(filters,true),region:'all',uf:'all'};
  const regions=scopeProduction(production,base,'GR');
  const states=scopeProduction(production,base,'UF');
  const national=sum(scopeProduction(production,base,'BR').filter(row=>+row.year===filters.year),'tonnes');
  const nationalValue=sum(scopeProduction(production,base,'BR').filter(row=>+row.year===filters.year),'valueReais');
  const regionRows=comparisonRows(regions,'region',filters.year);
  const allStateRows=comparisonRows(states,'place',filters.year).map(row=>{
    const state=states.find(record=>record.place===row.label);
    const regional=regionRows.find(region=>region.label===state.region)?.tonnes;
    return {...row,uf:state.uf,region:state.region,nationalShare:national>0&&row.tonnes!=null?row.tonnes/national:null,regionalShare:regional>0&&row.tonnes!=null?row.tonnes/regional:null};
  });
  const result={national,nationalValue,regionRows:regionRows.map(row=>({...row,nationalShare:national>0&&row.tonnes!=null?row.tonnes/national:null})),allStateRows,stateRows:allStateRows.filter(row=>filters.region==='all'||row.region===filters.region)};
  if(cache.size>=200)cache.clear();cache.set(key,result);return result;
}
export function geographicStepBack(filters,level){
  return filters.uf!=='all'?{filters:{...filters,uf:'all'},level:'states'}:{filters:{...filters,region:'all',uf:'all'},level:'regions'};
}
