// Keep the reference domain independent from the clicked geographic item.
export function mapScale(rows,metric){
  const maximum=Math.max(0,...rows.map(row=>Number.isFinite(row[metric])?row[metric]:0));
  return {maximum,color(value){
    if(!Number.isFinite(value))return 'url(#map-no-data)';
    if(value===0)return 'var(--map-zero)';
    const weight=Math.max(0,Math.min(1,value/(maximum||1)))*100;
    return `color-mix(in srgb, var(--map-low) ${100-weight}%, var(--map-high) ${weight}%)`;
  }};
}
