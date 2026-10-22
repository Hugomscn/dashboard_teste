import {escapeHtml as e,palette} from './utils.js';
import {number,money,percent} from './model.js';

export function drawArea100(host,{rows,series,title,metric='tonnes'}){
  const format=value=>metric==='valueReais'?money(value):`${number(value)} t`;
  const portal=host.ownerDocument.documentElement.hasAttribute('data-embed');
  const width=Math.max(280,host.clientWidth),height=315,left=portal?64:46,right=portal?30:18,top=16,bottom=266,w=width-left-right;
  const x=i=>left+(rows.length===1?w/2:i/(rows.length-1)*w),y=v=>bottom-v*(bottom-top);
  let body='';
  for(const value of [0,.25,.5,.75,1])body+=`<line class="grid-line" x1="${left}" x2="${width-right}" y1="${y(value)}" y2="${y(value)}"/><text class="axis-text" x="${left-8}" y="${y(value)+4}" text-anchor="end">${value*100}%</text>`;
  const valid=row=>row.total>0&&series.every(s=>Number.isFinite(row[s.key+'Share']));
  const groups=[];let segment=[];
  rows.forEach((row,i)=>{if(valid(row))segment.push(i);else if(segment.length){groups.push(segment);segment=[];}});if(segment.length)groups.push(segment);
  series.forEach((s,k)=>{
    const lower=i=>series.slice(0,k).reduce((total,p)=>total+rows[i][p.key+'Share'],0),upper=i=>lower(i)+rows[i][s.key+'Share'];
    for(const indexes of groups){
      const first=indexes[0],last=indexes.at(-1);
      const half=rows.length===1?w/2:Math.min(10,w/(rows.length-1)/3);
      const path=indexes.length===1?`M ${x(first)-half} ${y(lower(first))} H ${x(first)+half} V ${y(upper(first))} H ${x(first)-half} Z`:
        `M ${indexes.map(i=>`${x(i)},${y(upper(i))}`).join(' L ')} L ${[...indexes].reverse().map(i=>`${x(i)},${y(lower(i))}`).join(' L ')} Z`;
      body+=`<path d="${path}" fill="${palette[k]}" opacity=".85"/>`;
      indexes.forEach(i=>{
        const row=rows[i],text=`${row.year} · ${s.label}: ${format(row[s.key])} · ${percent(row[s.key+'Share'])} do total de ${format(row.total)}`;
        body+=`<circle class="area-point" cx="${x(i)}" cy="${y((lower(i)+upper(i))/2)}" r="5" fill="${palette[k]}" tabindex="0" role="img" data-area-row="${i}" data-area-series="${k}" aria-label="${e(text)}"><title>${e(text)}</title></circle>`;
      });
    }
  });
  const step=Math.max(1,Math.ceil(rows.length/(w/(portal?64:55))));
  rows.forEach((row,i)=>{if(i===rows.length-1||(i%step===0&&rows.length-1-i>=step*.7))body+=`<text class="axis-text" x="${x(i)}" y="${bottom+23}" text-anchor="middle">${row.year}</text>`;});
  host.innerHTML=`<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="group" aria-label="${e(title)}">${body}</svg><div class="chart-legend">${series.map((s,i)=>`<span><i class="legend-dot" style="background:${palette[i]}"></i>${e(s.label)}</span>`).join('')}</div><p class="chart-hint">${rows.some(r=>!valid(r))?'Anos sem total positivo ou com categorias ausentes ficam sem área. ':''}Passe o cursor ou use Tab para consultar ${metric==='valueReais'?'valor nominal e participação no valor':'toneladas e participação'}.</p>`;
  host.querySelectorAll('[data-area-row]').forEach(node=>{
    const show=event=>{const tip=document.getElementById('chart-tooltip'),box=node.getBoundingClientRect();tip.textContent=node.getAttribute('aria-label');tip.hidden=false;tip.style.left=Math.max(8,Math.min(innerWidth-280,event?.clientX??box.x))+'px';tip.style.top=Math.max(8,(event?.clientY??box.y)-75)+'px';};
    const hide=()=>document.getElementById('chart-tooltip').hidden=true;
    node.onpointerenter=show;node.onpointerleave=hide;node.onfocus=()=>show();node.onblur=hide;
  });
}
