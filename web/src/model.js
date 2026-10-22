export const sum = (rows, field) => {
  const values = rows.map(row => row[field]).filter(Number.isFinite);
  return values.length ? values.reduce((a, b) => a + b, 0) : null;
};
export const number = value => Number.isFinite(value) ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value) : '—';
export const compact = value => Number.isFinite(value) ? new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 2 }).format(value) : '—';
export const money = value => Number.isFinite(value) ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value) : '—';
export const compactMoney = value => Number.isFinite(value) ? 'R$ ' + compact(value) : '—';
export const percent = value => Number.isFinite(value) ? new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(value) : '—';
export const signedPercent = value => Number.isFinite(value) ? (value > 0 ? '+' : '') + percent(value) : '—';
export const applyFilters = (shell, values) => Object.entries(values).forEach(([id,value])=>shell.setFilter(id,value));
export const ratio = rows => {
  const pairs = rows.filter(row => Number.isFinite(row.tonnes) && Number.isFinite(row.valueReais));
  const quantity = sum(pairs, 'tonnes');
  return quantity > 0 ? sum(pairs, 'valueReais') / (quantity * 1000) : null;
};
export function annualChange(rows, field, year) {
  const current = rows.filter(row => +row.year === +year);
  const previous = rows.filter(row => +row.year === +year - 1);
  const identity = row => [row.level ?? '', row.code, row.product ?? ''].join('|');
  const prior = new Map(previous.map(row => [identity(row), row]));
  const pairs = current.filter(row => Number.isFinite(row[field]) && Number.isFinite(prior.get(identity(row))?.[field]));
  const base = sum(pairs.map(row => prior.get(identity(row))), field);
  return base > 0 ? sum(pairs, field) / base - 1 : null;
}
export function group(rows, dimension) {
  const groups = new Map();
  for (const row of rows) {
    const key = row[dimension];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups].map(([label, records]) => ({ label, tonnes: sum(records, 'tonnes'), valueReais: sum(records, 'valueReais'), valuePerKg: ratio(records), records }));
}
export function yearBounds(value, years = [2013, 2025]) {
  const minimum = Math.min(...years), maximum = Math.max(...years);
  if (!value || value === 'all') return [minimum, maximum];
  const parts = String(value).split('..').map(part=>Number(part.match(/^\d{4}/)?.[0]));
  if(parts.some(part=>!Number.isFinite(part))) return [minimum,maximum];
  return parts.length === 2 ? [Math.max(minimum, parts[0]), Math.min(maximum, parts[1])] : [minimum, Math.min(maximum, parts[0])];
}
const productionIndexes=new WeakMap();
function productionIndex(rows){
  if(!productionIndexes.has(rows)){
    const levels=new Map();
    for(const row of rows){if(!levels.has(row.level))levels.set(row.level,[]);levels.get(row.level).push(row);}
    productionIndexes.set(rows,{levels,selections:new Map()});
  }
  return productionIndexes.get(rows);
}
export function scopeProduction(rows, filters, level) {
  const index=productionIndex(rows),key=JSON.stringify([level,filters.year,filters.uf,filters.region,filters.product]);
  if(index.selections.has(key))return index.selections.get(key);
  const [start, end] = yearBounds(filters.year, rows.reduce((bounds,row)=>[Math.min(bounds[0],+row.year),Math.max(bounds[1],+row.year)],[Infinity,-Infinity]));
  const selected=(index.levels.get(level)??[]).filter(row =>
    +row.year >= start && +row.year <= end &&
    (level !== 'UF' || filters.uf === 'all' || !filters.uf || row.uf === filters.uf) &&
    (filters.region === 'all' || !filters.region || row.region === filters.region) &&
    (filters.product === 'all' || !filters.product || row.product === filters.product));
  if(index.selections.size>=200)index.selections.clear();
  index.selections.set(key,selected);return selected;
}
export function history(rows) {
  return group(rows, 'year').sort((a, b) => +a.label - +b.label).map(({ label, tonnes, valueReais, valuePerKg }) => ({ year: String(label), tonnes, valueReais, valuePerKg }));
}
export function comparisonRows(rows, dimension, year) {
  const current = rows.filter(row => +row.year === +year);
  const denominator = sum(current, 'tonnes');
  return group(current, dimension).map(item => {
    const allYears = rows.filter(row => row[dimension] === item.label);
    return { label: item.label, year: String(year), tonnes: item.tonnes, valueReais: item.valueReais, valuePerKg: item.valuePerKg, productionShare: denominator > 0 && Number.isFinite(item.tonnes) ? item.tonnes / denominator : null, annualGrowth: annualChange(allYears, 'tonnes', year) };
  }).sort((a, b) => (b.tonnes ?? -Infinity) - (a.tonnes ?? -Infinity));
}
export function scopeMunicipalities(rows, filters, products = []) {
  const [start, end] = yearBounds(filters.year, rows.reduce((bounds,row)=>[Math.min(bounds[0],+row.year),Math.max(bounds[1],+row.year)],[Infinity,-Infinity]));
  const index = products.indexOf(filters.product);
  return rows.filter(row => +row.year >= start && +row.year <= end &&
    (filters.region === 'all' || !filters.region || row.region === filters.region) &&
    (filters.uf === 'all' || !filters.uf || row.uf === filters.uf)).map(row => {
      if (!filters.product || filters.product === 'all') return row;
      const pair = index >= 0 && row.productData != null ? (JSON.parse(row.productData)[index] ?? [0,0]) : [null,null];
      return {...row, product: filters.product, tonnes: pair[0], valueReais: pair[1]};
    });
}
