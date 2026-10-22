import {bindTimeCrosshair} from './time-interaction.js';
import {escapeHtml as e,palette,seriesColors,regionColors} from './utils.js';
import {compact,number,percent,money} from './model.js';
const svgStart=(width,height,label)=>`<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="group" aria-label="${e(label)}">`;
const tick=(x,y,text,anchor='middle')=>`<text class="axis-text" x="${x}" y="${y}" text-anchor="${anchor}">${e(text)}</text>`;
const format=(value,metric)=>metric==='valueReais'?money(value):number(value)+' t';
function tooltip(node,text,event){
  const tip=document.getElementById('chart-tooltip');tip.textContent=text;tip.hidden=false;
  const box=node.getBoundingClientRect();
  tip.style.left=Math.max(8,Math.min(innerWidth-280,event?.clientX??box.x+box.width/2))+'px';
  tip.style.top=Math.max(8,Math.min(innerHeight-85,(event?.clientY??box.y)-65))+'px';
}
export function hideTooltip(){document.getElementById('chart-tooltip').hidden=true;}
function mark(node,text,activate,sharedTooltip=false){
  if(!sharedTooltip){node.addEventListener('pointerenter',event=>tooltip(node,text,event));
  node.addEventListener('pointerleave',hideTooltip);
  node.addEventListener('focus',()=>tooltip(node,text));node.addEventListener('blur',hideTooltip);}
  node.addEventListener('click',event=>{hideTooltip();activate(event);});
  node.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();hideTooltip();activate(event);}});
}
export function drawBars(host,{rows,metric='tonnes',title,onSelect,selectedLabel}) {
  if(!rows.length){host.innerHTML='<p class="empty">Não há observações para este recorte.</p>';return;}
  const width=Math.max(240,host.clientWidth),height=Math.max(230,rows.length*53+42),left=2,right=16,bottom=height-30,plotWidth=width-left-right;
  const maximum=Math.max(...rows.map(row=>row[metric]??0),0),max=maximum||1;
  let body='';
  for(let i=0;i<3;i++){const value=max*i/2,x=left+plotWidth*i/2;body+=`<line class="grid-line" x1="${x}" y1="8" x2="${x}" y2="${bottom-8}"/>`+tick(x,bottom+20,(metric==='valueReais'?'R$ ':'')+compact(maximum*i/2),i===0?'start':i===2?'end':'middle');}
  rows.forEach((row,index)=>{
    const y=20+index*53;
    const available=Math.floor(plotWidth/6.4);
    const label=row.label.length>available?row.label.slice(0,available-1)+'…':row.label;
    const barWidth=Math.max(0,(row[metric]??0)/max*plotWidth),value=Number.isFinite(row[metric])?(metric==='valueReais'?'R$ ':'')+compact(row[metric])+(metric==='tonnes'?' t':''):'—';
    const inside=barWidth>value.length*7+18;
    body+=`<g class="bar-mark mark ${row.label===selectedLabel?'selected-mark':''}" data-index="${index}" role="button" tabindex="0" aria-pressed="${row.label===selectedLabel}" aria-label="${e(row.label)}: ${e(format(row[metric],metric))}. Selecionar"><title>${e(row.label)} · ${e(format(row[metric],metric))}</title><rect class="bar-hit" x="0" y="${y-14}" width="${width}" height="50" fill="transparent"/>${tick(left,y-3,label,'start')}<rect x="${left}" y="${y+4}" width="${barWidth}" height="23" rx="0" fill="${metric==='tonnes'?'var(--c-blue)':'var(--c-teal)'}"/><text class="bar-value ${inside?'inside':''}" x="${inside?left+barWidth-7:left+barWidth+7}" y="${y+20}" text-anchor="${inside?'end':'start'}">${e(value)}</text></g>`;
  });
  host.innerHTML=svgStart(width,height,title)+body+'</svg>';
  host.querySelectorAll('[data-index]').forEach(node=>{const row=rows[+node.dataset.index];mark(node,`${row.label} · ${format(row[metric],metric)}`,event=>onSelect(row,event));});
}
export function drawPie(host,{rows,title,onSelect,selectedLabel}) {
  const positive=rows.filter(row=>row.tonnes>0),total=positive.reduce((sum,row)=>sum+row.tonnes,0);
  if(!total){host.innerHTML='<p class="empty">Não há produção positiva para calcular a participação.</p>';return;}
  const width=360,height=320,cx=180,cy=156,radius=125,inner=76;
  let angle=-Math.PI/2,body='';
  positive.forEach((row,index)=>{
    const share=row.tonnes/total,full=share>0.999999,end=angle+share*2*Math.PI-(positive.length>1?.009:0);
    const point=(r,a)=>[cx+r*Math.cos(a),cy+r*Math.sin(a)].join(' ');
    const endAngle=full?angle+2*Math.PI-.00001:end;
    const path=`M ${point(radius,angle)} A ${radius} ${radius} 0 ${share>.5?1:0} 1 ${point(radius,endAngle)} L ${point(inner,endAngle)} A ${inner} ${inner} 0 ${share>.5?1:0} 0 ${point(inner,angle)} Z`;
    const text=`${row.label}: ${percent(share)} · ${number(row.tonnes)} t`;
    body+=`<path class="pie-mark mark ${row.label===selectedLabel?'selected-slice':''}" data-index="${index}" d="${path}" fill="${regionColors[row.label]??palette[index%palette.length]}" role="button" tabindex="0" aria-pressed="${row.label===selectedLabel}" aria-label="${e(text)}. Filtrar região"><title>${e(text)}</title></path>`;angle+=share*2*Math.PI;
  });
  body+=`<text class="donut-value" x="${cx}" y="${cy-2}" text-anchor="middle">${e(compact(total))}</text><text class="axis-text" x="${cx}" y="${cy+22}" text-anchor="middle">Produção (t)</text>`;
  host.innerHTML=svgStart(width,height,title)+body+'</svg>'+`<div class="chart-legend" aria-label="Regiões">${positive.map((row,index)=>`<button data-region-index="${index}" title="Filtrar ${e(row.label)}"><span class="legend-dot" style="background:${regionColors[row.label]}"></span>${e(row.label)} <strong>${e(percent(row.tonnes/total))}</strong></button>`).join('')}</div>`;
  host.querySelectorAll('[data-index]').forEach(node=>{const row=positive[+node.dataset.index];mark(node,`${row.label} · ${percent(row.tonnes/total)} · ${number(row.tonnes)} t`,event=>onSelect(row,event));});
  host.querySelectorAll('[data-region-index]').forEach(node=>node.onclick=()=>onSelect(positive[+node.dataset.regionIndex]));
}
export function drawLine(host,{rows,series,title,metric='tonnes',onSelect,onRange}) {
  const values=rows.flatMap(row=>series.map(s=>row[s.key])).filter(Number.isFinite);
  if(!values.length){host.innerHTML='<p class="empty">Não há observações para este período.</p>';return;}
  const width=Math.max(280,host.clientWidth),height=300,left=66,right=20,top=18,bottom=258,plotWidth=width-left-right;
  const maximum=Math.max(...values,0),rough=maximum/4||1,power=10**Math.floor(Math.log10(rough));
  const step=[1,2,2.5,5,10].find(n=>n*power>=rough)*power,max=Math.max(step,Math.ceil(maximum/step)*step);
  const x=index=>left+(rows.length===1?plotWidth/2:index/(rows.length-1)*plotWidth),y=value=>bottom-value/max*(bottom-top);
  let body=`<rect class="plot-background" x="${left}" y="${top}" width="${plotWidth}" height="${bottom-top}" fill="transparent"/>`;
  for(let value=0;value<=max+step*.001;value+=step){body+=`<line class="grid-line" x1="${left}" y1="${y(value)}" x2="${width-right}" y2="${y(value)}"/>`+tick(left-10,y(value)+4,(metric==='valueReais'?'R$ ':'')+compact(value),'end');}
  const interval=Math.max(1,Math.ceil(rows.length/(plotWidth/47)));
  rows.forEach((row,i)=>{if(i%interval===0||i===rows.length-1)body+=tick(x(i),bottom+23,row.year);});
  series.forEach((s,seriesIndex)=>{
    const color=s.color??seriesColors[s.label]??palette[seriesIndex%palette.length];let path='',connected=false;
    rows.forEach((row,i)=>{if(!Number.isFinite(row[s.key])){connected=false;return;}path+=`${connected?'L':'M'} ${x(i)} ${y(row[s.key])} `;connected=true;});
    body+=`<path class="line-path" data-motion-points="${e(JSON.stringify(rows.filter(row=>Number.isFinite(row[s.key])).map(row=>`line:${seriesIndex}:${row.year}`)))}" d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    rows.forEach((row,i)=>{if(Number.isFinite(row[s.key]))body+=`<circle class="line-point mark${rows.length===1?' single-point':''}" data-motion-key="line:${seriesIndex}:${row.year}" data-row="${i}" data-series="${seriesIndex}" role="button" tabindex="0" aria-label="${e(row.year)}: ${e(s.label)} · ${e(format(row[s.key],metric))}. Abrir ações" cx="${x(i)}" cy="${y(row[s.key])}" r="5" fill="${color}"><title>${e(row.year)} · ${e(s.label)} · ${e(format(row[s.key],metric))}</title></circle>`;});
  });
  body+=`<rect class="brush-selection" x="0" y="${top}" width="0" height="${bottom-top}"/>`;
  host.innerHTML=svgStart(width,height,title)+body+'</svg>'+(series.length>1?`<div class="chart-legend">${series.map((s,i)=>`<span><i class="legend-dot" style="background:${s.color??seriesColors[s.label]??palette[i%palette.length]}"></i>${e(s.label)}</span>`).join('')}</div>`:'')+'<p class="chart-hint">Arraste sobre a série para selecionar anos. Clique em um ponto para abrir ações.</p>';
  bindTimeBrush(host,rows,{width,height,left,right,top,bottom},onRange);
  host.querySelectorAll('[data-row]').forEach(node=>{const row=rows[+node.dataset.row],s=series[+node.dataset.series];mark(node,`${row.year} · ${s.label} · ${format(row[s.key],metric)}`,event=>onSelect(row,s,event),true);});
  bindTimeCrosshair(host,{rows,positions:rows.map((_,i)=>x(i)),width,height,left,right,top,bottom,series:series.map((s,i)=>({...s,color:s.color??seriesColors[s.label]??palette[i%palette.length],format:value=>format(value,metric)})),axes:[{maximum:max,format:value=>(metric==='valueReais'?'R$ ':'')+compact(value)}]});
}
export function bindTimeBrush(host,rows,{width,height,left,right,top,bottom},onRange){
  const plotWidth=width-left-right;
  let gesture=null,suppressClick=false;
  const svg=host.querySelector('svg'),shade=host.querySelector('.brush-selection');
  svg.classList.add('time-brush');
  svg.addEventListener('selectstart',event=>event.preventDefault());
  const localX=event=>{const box=svg.getBoundingClientRect();return Math.max(left,Math.min(width-right,(event.clientX-box.x)/box.width*width));};
  svg.addEventListener('pointerdown',event=>{if(event.button!==0||event.target.closest('.mark')||rows.length<2)return;const box=svg.getBoundingClientRect(),cy=(event.clientY-box.y)/box.height*height;if(cy<top||cy>bottom)return;event.preventDefault();gesture={start:localX(event),end:localX(event)};});
  svg.addEventListener('pointermove',event=>{if(!gesture)return;gesture.end=localX(event);if(Math.abs(gesture.end-gesture.start)>10){svg.setPointerCapture(event.pointerId);shade.setAttribute('x',Math.min(gesture.start,gesture.end));shade.setAttribute('width',Math.abs(gesture.end-gesture.start));}});
  svg.addEventListener('pointerup',()=>{if(!gesture)return;const current=gesture;gesture=null;shade.setAttribute('width',0);if(Math.abs(current.end-current.start)<10)return;suppressClick=true;const index=value=>Math.max(0,Math.min(rows.length-1,Math.round((value-left)/plotWidth*(rows.length-1))));onRange([+rows[index(Math.min(current.start,current.end))].year,+rows[index(Math.max(current.start,current.end))].year]);});
  svg.addEventListener('pointercancel',()=>{gesture=null;shade.setAttribute('width',0);});
  svg.addEventListener('click',event=>{if(suppressClick){event.stopImmediatePropagation();suppressClick=false;}},true);
}
