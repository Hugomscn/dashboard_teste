import {escapeHtml as e} from './utils.js';
export function normalizeYearRange(start,end,years){
  const ordered=[...years].sort((a,b)=>a-b);
  if(ordered.length<2)throw new Error('A série precisa de pelo menos dois anos disponíveis.');
  let lower=ordered.includes(+start)?+start:ordered[0],upper=ordered.includes(+end)?+end:ordered.at(-1);
  if(lower>upper)[lower,upper]=[upper,lower];
  if(lower===upper){const index=ordered.indexOf(upper);if(index>0)lower=ordered[index-1];else upper=ordered[1];}
  return {start:lower,end:upper};
}
export function yearRangeMarkup({start,end},years){
  ({start,end}=normalizeYearRange(start,end,years));
  const min=Math.min(...years),max=Math.max(...years),length=max-min||1;
  return `<div class="period-control"><div class="period-caption"><span>Período da série</span><output id="period-caption">${e(start)}–${e(end)}</output></div><div class="dual-range" data-min="${min}" data-max="${max}"><div class="dual-range-track"></div><div class="dual-range-fill" style="left:${(start-min)/length*100}%;width:${(end-start)/length*100}%"></div><input id="series-start" class="dual-range-input range-lower" type="range" min="${min}" max="${max}" step="1" value="${start}" aria-label="Ano inicial da série" aria-valuetext="${start}"><input id="series-end" class="dual-range-input range-upper" type="range" min="${min}" max="${max}" step="1" value="${end}" aria-label="Ano final da série" aria-valuetext="${end}"></div><div class="range-bounds"><span>${min}</span><span>${max}</span></div></div>`;
}
export function bindYearRange(root,onCommit){
  const lower=root.querySelector('#series-start'),upper=root.querySelector('#series-end');if(!lower||!upper)return;
  const track=lower.parentElement,min=+lower.min,max=+lower.max,length=max-min||1;
  const preview=event=>{
    let start=+lower.value,end=+upper.value;
    if(start>=end){if(event.target===lower)lower.value=start=end-1;else upper.value=end=start+1;}
    lower.setAttribute('aria-valuetext',String(start));upper.setAttribute('aria-valuetext',String(end));
    lower.setAttribute('aria-valuemax',String(end-1));upper.setAttribute('aria-valuemin',String(start+1));
    root.querySelector('#period-caption').value=`${start}–${end}`;
    const fill=track.querySelector('.dual-range-fill');fill.style.left=(start-min)/length*100+'%';fill.style.width=(end-start)/length*100+'%';
    lower.style.zIndex=start===max?'5':'3';
  };
  for(const input of [lower,upper]){input.addEventListener('input',preview);input.addEventListener('change',()=>onCommit({start:+lower.value,end:+upper.value}));}
  preview({target:lower});
}
