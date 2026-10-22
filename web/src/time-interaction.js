import {escapeHtml as e} from './utils.js';

const ns='http://www.w3.org/2000/svg';
const node=(tag,attributes={})=>{const n=document.createElementNS(ns,tag);for(const [key,value] of Object.entries(attributes))n.setAttribute(key,value);return n;};
export function nearestYearIndex(positions,x){
  return positions.reduce((best,p,i)=>Math.abs(p-x)<Math.abs(positions[best]-x)?i:best,0);
}

// One interaction layer for both temporal renderers. Values stay in each axis's units.
export function bindTimeCrosshair(host,{rows,positions,width,height,left,right,top,bottom,series,axes}){
  const svg=host.querySelector('svg'),tip=document.getElementById('chart-tooltip');
  const overlay=node('g',{class:'time-crosshair','pointer-events':'none',visibility:'hidden','aria-hidden':'true'});
  const vertical=node('line',{class:'crosshair-line',y1:top,y2:bottom}),horizontal=node('line',{class:'crosshair-line',x1:left,x2:width-right});
  overlay.append(vertical,horizontal);svg.append(overlay);
  const badge=(x,y,text,anchor='middle')=>{
    const w=Math.max(38,text.length*6.2+12),start=Math.max(0,Math.min(width-w,anchor==='end'?x-w:anchor==='start'?x:x-w/2));
    const group=node('g'),rect=node('rect',{x:start,y:y-12,width:w,height:21,class:'crosshair-badge'}),label=node('text',{x:start+w/2,y:y+3,'text-anchor':'middle',class:'crosshair-text'});
    label.textContent=text;group.append(rect,label);overlay.append(group);
  };
  const hide=()=>{overlay.setAttribute('visibility','hidden');tip.hidden=true;tip.classList.remove('time-tooltip');};
  const show=(index,cy,clientX,clientY)=>{
    const row=rows[index],x=positions[index],y=Math.max(top,Math.min(bottom,cy));
    overlay.setAttribute('visibility','visible');vertical.setAttribute('x1',x);vertical.setAttribute('x2',x);horizontal.setAttribute('y1',y);horizontal.setAttribute('y2',y);
    while(overlay.children.length>2)overlay.lastChild.remove();
    badge(x,bottom+22,String(row.year));
    axes.forEach(axis=>badge(axis.side==='right'?width-right+4:left-4,y,axis.format((bottom-y)/(bottom-top)*axis.maximum),axis.side==='right'?'start':'end'));
    const items=series.map(s=>({...s,value:row[s.key]}));
    if(axes.length===1)items.sort((a,b)=>(b.value??-Infinity)-(a.value??-Infinity));
    tip.innerHTML=`<strong>Ano: ${e(row.year)}</strong>${items.map(s=>`<div class="time-tooltip-row"><i style="background:${s.color}"></i><span>${e(s.label)}</span><strong>${e(s.format(s.value))}</strong></div>`).join('')}`;
    tip.classList.add('time-tooltip');tip.hidden=false;
    const box=tip.getBoundingClientRect();
    tip.style.left=Math.max(8,Math.min(innerWidth-box.width-8,clientX+16))+'px';tip.style.top=Math.max(8,Math.min(innerHeight-box.height-8,clientY+16))+'px';
  };
  const pointer=event=>{
    if(event.pointerType==='touch'||event.buttons){hide();return;}
    const box=svg.getBoundingClientRect(),x=(event.clientX-box.x)/box.width*width,y=(event.clientY-box.y)/box.height*height;
    if(x<left||x>width-right||y<top||y>bottom){hide();return;}
    show(nearestYearIndex(positions,x),y,event.clientX,event.clientY);
  };
  svg.addEventListener('pointermove',pointer);svg.addEventListener('pointerover',pointer);
  svg.addEventListener('pointerleave',hide);svg.addEventListener('pointerdown',hide);
  svg.addEventListener('focusin',event=>{
    const mark=event.target.closest('[data-row],[data-combo-row]');if(!mark)return;
    const index=+(mark.dataset.row??mark.dataset.comboRow),box=mark.getBoundingClientRect();
    const value=rows[index][series[0].key],axis=axes[0],y=Number.isFinite(value)?bottom-value/axis.maximum*(bottom-top):(top+bottom)/2;
    show(index,y,box.x,box.y);
  });
  svg.addEventListener('focusout',hide);
}

export function captureTemporalCharts(root){
  const charts=new Map();
  root.querySelectorAll('.temporal-chart .chart-host,.overview-temporal .chart-host').forEach(host=>{
    const marks=new Map();host.querySelectorAll('[data-motion-key]').forEach(n=>marks.set(n.dataset.motionKey,Object.fromEntries(['x','y','width','height','cx','cy'].filter(a=>n.hasAttribute(a)).map(a=>[a,n.getAttribute(a)]))));
    charts.set(host.id,marks);
  });return charts;
}
export function animateTemporalCharts(root,before){
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const animate=(target,attribute,from,to)=>{
    if(from===undefined||from===to)return;
    const motion=node('animate',{attributeName:attribute,from,to,dur:'280ms',begin:'indefinite',calcMode:'spline',keyTimes:'0;1',keySplines:'.2 0 .2 1'});
    target.append(motion);motion.beginElement();motion.addEventListener('endEvent',()=>motion.remove(),{once:true});
  };
  for(const [id,previous] of before){
    const host=root.querySelector(`#${id}`);if(!host)continue;
    host.querySelectorAll('[data-motion-key]').forEach(mark=>{
      const old=previous.get(mark.dataset.motionKey);if(old)for(const attribute of Object.keys(old))animate(mark,attribute,old[attribute],mark.getAttribute(attribute));
    });
    host.querySelectorAll('[data-motion-points]').forEach(path=>{
      const keys=JSON.parse(path.dataset.motionPoints),to=path.getAttribute('d');let index=0;
      const from=to.replace(/([ML])\s*([\d.e+-]+)[ ,]+([\d.e+-]+)/gi,(match,command)=>{const old=previous.get(keys[index++]);return old?`${command} ${old.cx} ${old.cy}`:match;});
      animate(path,'d',from,to);
    });
  }
}
