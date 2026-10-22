import {bindTimeCrosshair} from './time-interaction.js';
import {escapeHtml as e} from './utils.js';
import {compact,number,money} from './model.js';
import {bindTimeBrush} from './charts.js';

export function axisMaximum(values){
  const maximum=Math.max(0,...values.filter(Number.isFinite)),rough=maximum/4||1,power=10**Math.floor(Math.log10(rough));
  const step=[1,2,2.5,5,10].find(n=>n*power>=rough)*power;
  return Math.max(step,Math.ceil(maximum/step)*step);
}
export function comboGeometry(rows,width){
  const layout={width:Math.max(320,width),height:360,left:72,right:100,top:32,bottom:304};
  const plotWidth=layout.width-layout.left-layout.right;
  const quantityMaximum=axisMaximum(rows.map(r=>r.tonnes)),valueMaximum=axisMaximum(rows.map(r=>r.valueReais));
  const barWidth=plotWidth/Math.max(1,rows.length)*.65;
  const points=rows.map((row,i)=>({row,x:layout.left+(rows.length===1?plotWidth/2:(i+.5)*plotWidth/rows.length),quantityY:Number.isFinite(row.tonnes)?layout.bottom-row.tonnes/quantityMaximum*(layout.bottom-layout.top):null,valueY:Number.isFinite(row.valueReais)?layout.bottom-row.valueReais/valueMaximum*(layout.bottom-layout.top):null}));
  return {...layout,quantityMaximum,valueMaximum,barWidth,points};
}
export function drawCombo(host,{rows,title,onSelect,onRange}){
  if(!rows.some(r=>Number.isFinite(r.tonnes)||Number.isFinite(r.valueReais))){host.innerHTML='<p class="empty">Não há observações para este período.</p>';return;}
  const geometry=comboGeometry(rows,host.clientWidth),{width,height,left,right,top,bottom,points,quantityMaximum,valueMaximum,barWidth}=geometry;
  let body=`<rect x="${left}" y="${top}" width="${width-left-right}" height="${bottom-top}" fill="transparent"/>`;
  if(width>=500)body+=`<text class="axis-text combo-quantity-title" x="${left}" y="16">Produção (t)</text><text class="axis-text combo-value-title" x="${width-right}" y="16" text-anchor="end">Valor nominal (R$)</text>`;
  for(let i=0;i<=4;i++){
    const y=bottom-i/4*(bottom-top);
    body+=`<line class="grid-line" x1="${left}" x2="${width-right}" y1="${y}" y2="${y}"/><text class="axis-text" x="${left-12}" y="${y+4}" text-anchor="end">${e(compact(quantityMaximum*i/4))}</text><text class="axis-text" x="${width-right+12}" y="${y+4}">R$ ${e(compact(valueMaximum*i/4))}</text>`;
  }
  const interval=Math.max(1,Math.ceil(rows.length/((width-left-right)/55)));
  points.forEach((p,i)=>{
    if(p.quantityY!==null)body+=`<rect data-motion-key="bar:${p.row.year}" class="combo-bar" x="${p.x-barWidth/2}" y="${p.quantityY}" width="${barWidth}" height="${bottom-p.quantityY}" fill="var(--combo-bars)" opacity=".85"/>`;
    if(i===rows.length-1||(i%interval===0&&rows.length-1-i>=interval*.7))body+=`<text class="axis-text" x="${p.x}" y="${bottom+24}" text-anchor="middle">${p.row.year}</text>`;
  });
  let path='',connected=false;
  points.forEach(p=>{if(p.valueY===null){connected=false;return;}path+=`${connected?'L':'M'} ${p.x} ${p.valueY} `;connected=true;});
  body+=`<path class="line-path" data-motion-points="${e(JSON.stringify(points.filter(p=>p.valueY!==null).map(p=>`combo:${p.row.year}`)))}" d="${path}" stroke="var(--combo-line)" stroke-width="3.5" fill="none"/>`;
  points.forEach((p,i)=>{
    if(p.quantityY===null&&p.valueY===null)return;
    const text=`${p.row.year} · Produção: ${number(p.row.tonnes)} t · Valor nominal: ${money(p.row.valueReais)}`;
    body+=`<g class="combo-mark mark" data-combo-row="${i}" role="button" tabindex="0" aria-label="${e(text)}. Abrir ações"><title>${e(text)}</title>${p.valueY===null?'':`<circle data-motion-key="combo:${p.row.year}" cx="${p.x}" cy="${p.valueY}" r="4" fill="var(--combo-line)" stroke="var(--card)"/>`}<rect x="${p.x-barWidth/2}" y="${Math.min(p.quantityY??bottom,p.valueY??bottom)-7}" width="${barWidth}" height="${bottom-Math.min(p.quantityY??bottom,p.valueY??bottom)+14}" fill="transparent"/></g>`;
  });
  body+=`<rect class="brush-selection" x="0" y="${top}" width="0" height="${bottom-top}"/>`;
  host.innerHTML=`<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="group" aria-label="${e(title)}">${body}</svg><div class="chart-legend"><span><i class="legend-dot" style="background:var(--combo-bars)"></i>Barras · produção (t), eixo esquerdo</span><span><i class="legend-dot" style="background:var(--combo-line)"></i>Linha · valor nominal (R$), eixo direito</span></div><p class="chart-hint">Arraste entre as barras para selecionar anos. Clique ou use Tab para consultar os valores.</p>`;
  bindTimeBrush(host,rows,geometry,onRange);
  host.querySelectorAll('[data-combo-row]').forEach(node=>{
    const row=rows[+node.dataset.comboRow],hide=()=>document.getElementById('chart-tooltip').hidden=true;
    node.onclick=()=>{hide();onSelect(row,{key:'valueReais',label:'Valor nominal (R$)'});};node.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();node.onclick();}};
  });
  bindTimeCrosshair(host,{rows,positions:points.map(p=>p.x),...geometry,series:[{key:'tonnes',label:'Produção (t)',color:'var(--combo-bars)',format:value=>`${number(value)} t`},{key:'valueReais',label:'Valor nominal (R$)',color:'var(--combo-line)',format:money}],axes:[{maximum:quantityMaximum,format:compact},{side:'right',maximum:valueMaximum,format:value=>'R$ '+compact(value)}]});
}
