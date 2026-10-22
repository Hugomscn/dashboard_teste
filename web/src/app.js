import {captureTemporalCharts,animateTemporalCharts} from './time-interaction.js';
import {sum,ratio,annualChange,group,history,scopeProduction,scopeMunicipalities,comparisonRows,number,compact,money,compactMoney,percent,signedPercent} from './model.js';
import {escapeHtml as e,regionColors,palette,downloadCsv} from './utils.js';
import {pages,defaultFilters,normalizeFilters,domainFilters,filterTable} from './state.js';
import {drawBars,drawPie,drawLine,hideTooltip} from './charts.js';
import {geographicContext,geographicStepBack} from './territory.js';
import {yearRangeMarkup,bindYearRange,normalizeYearRange} from './year-range.js';
import {createDataStore} from './data-store.js';
import {themes,thematicHistory,compositionNotes} from './themes.js';
import {drawArea100} from './area-chart.js';
import {mapScale} from './map-scale.js';
import {drawCombo} from './combo-chart.js';
import {poleRecords,poleRanking,poleMunicipalities} from './poles.js';

const app=document.getElementById('app'),dialog=document.getElementById('detail-dialog');
let snapshot,page='overview',views={},level='regions',municipalityCode=null,charts=[],cards=new Map(),tables={},resizeTimer,returnFocus,seriesMode='selected';
let appTitle='Produção aquícola',store,speciesMetric='tonnes',poleId='all',poleStatus='idle',poleError='',themeId='aquaculture';
let renderedPage=null,renderedRange='';
const disclosureStates=new Map();
const disclosureAttributes=id=>`data-disclosure="${id}" ${disclosureStates.get(id)?'open':''}`;
const queryRows=id=>snapshot.queries[id].rows;
const columnLabels={label:'Espécie / território',year:'Ano',tonnes:'Produção (t)',valueReais:'Valor nominal (R$)',productionShare:'Participação na produção',annualGrowth:'Variação anual',valuePerKg:'Valor médio (R$/kg)',municipality:'Município',uf:'Estado/UF',code:'Código IBGE',region:'Região',product:'Espécie',nationalShare:'Participação da produção no Brasil',regionalShare:'Participação da produção na região'};
const formatCell=(key,value)=>key==='valueReais'?money(value):['productionShare','nationalShare','regionalShare'].includes(key)?percent(value):key==='annualGrowth'?signedPercent(value):['tonnes','valuePerKg'].includes(key)?number(value):String(value??'—');
const currentFilters=()=>views[page];

function readUrl(){
  const params=new URL(location.href).searchParams;
  const requested=params.get('pagina')??params.get('tab')??'overview';
  page=['municipalities','products','themes','poles'].includes(requested)?'territory':Object.hasOwn(pages,requested)?requested:'overview';
  let incoming={year:params.get('ano'),start:params.get('inicio'),end:params.get('fim'),region:params.get('regiao'),uf:params.get('uf'),product:params.get('especie')??params.get('produto')};
  // Accept links shared by the previous version; no browser storage migration is needed.
  if(params.has('t'))try{
    const previous=JSON.parse(params.get('t'))[requested];
    if(previous?.filters){const f=previous.filters,years=String(f.year??'').split('..');incoming={...incoming,region:f.region,uf:f.uf,product:f.product,start:years.length===2?years[0]:null,end:years.at(-1)};}
    level=previous?.focus?.territoryLevel??level;municipalityCode=previous?.focus?.municipalityCode??null;
  }catch{/* A malformed shared view falls back to the documented default scope. */}
  views[page]=normalizeFilters(incoming,snapshot);
  level=requested==='poles'?'poles':['regions','states','poles'].includes(params.get('nivel'))?params.get('nivel'):views[page].uf!=='all'||requested==='municipalities'?'states':'regions';
  seriesMode=['selected','regions','species'].includes(params.get('serie'))?params.get('serie'):'selected';
  speciesMetric=params.get('medida')==='valueReais'?'valueReais':'tonnes';
  poleId=params.get('polo')??'all';
  themeId=Object.hasOwn(themes,params.get('tema'))?params.get('tema'):'aquaculture';
  municipalityCode=params.get('municipio')??null;
}
function updateUrl(push=true){
  const f=currentFilters(),url=new URL(location.href);url.search='';
  Object.entries({pagina:page,ano:f.year,inicio:f.start,fim:f.end,...(f.region!=='all'?{regiao:f.region}:{}),...(f.product!=='all'?{especie:f.product}:{}),...(f.uf!=='all'?{uf:f.uf}:{}),...(page==='territory'?{nivel:level,medida:speciesMetric,tema:themeId,...(level==='poles'?{polo:poleId,...(municipalityCode?{municipio:municipalityCode}:{})}:{})}:{}),serie:seriesMode}).forEach(([key,value])=>url.searchParams.set(key,value));
  if(url.href!==location.href)window.history[push?'pushState':'replaceState']({},'',url);
}
function setFilters(patch){
  const old=currentFilters(),next={...old,...patch};
  if(Object.hasOwn(patch,'region')&&!Object.hasOwn(patch,'uf'))next.uf='all';
  views[page]=normalizeFilters(next,snapshot);tables={};updateUrl();render();
}
function selectRegion(region){setFilters({region:currentFilters().region===region?'all':region,uf:'all'});}
function drill(row,isState){
  if(isState){const state=queryRows('production').find(r=>r.level==='UF'&&r.place===row.label);if(!state)return;level='states';setFilters({region:state.region,uf:currentFilters().uf===state.uf?'all':state.uf});}
  else if(currentFilters().region===row.label&&currentFilters().uf==='all'){level='regions';setFilters({region:'all',uf:'all'});}
  else {level='states';setFilters({region:row.label,uf:'all'});}
}
function showDialog(title,content){
  returnFocus=document.activeElement;dialog.innerHTML=`<div class="dialog-header"><h2 id="dialog-title">${e(title)}</h2><form method="dialog"><button class="icon-button" aria-label="Fechar janela">×</button></form></div><div class="dialog-content">${content}</div>`;dialog.showModal();
}
dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus();});
dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.x||event.clientX>box.right||event.clientY<box.y||event.clientY>box.bottom)dialog.close();}});
function markActions(title,actions){
  showDialog(title,`<div class="mark-actions">${actions.map((action,index)=>`<button class="action-button" data-mark-action="${index}">${e(action.label)}<span aria-hidden="true">→</span></button>`).join('')}</div>`);
  dialog.querySelectorAll('[data-mark-action]').forEach(node=>node.onclick=()=>{dialog.close();actions[+node.dataset.markAction].run();});
}
function barActions(row,dimension){
  if(dimension==='pole'){poleId=poleId===row.id?'all':row.id;municipalityCode=null;updateUrl();render();return;}
  if(dimension==='municipal-pole'){municipalityCode=municipalityCode===row.code?null:row.code;updateUrl();render();return;}
  if(dimension==='product')setFilters({product:currentFilters().product===row.label?'all':row.label});
  else drill(row,dimension==='state');
}
function lineActions(row,series){
  const pair=normalizeYearRange(+row.year,+row.year,snapshot.metadata.years);
  const actions=[{label:`Comparar ${pair.start}–${pair.end}`,run:()=>setFilters(pair)}];
  if(+row.year>Math.min(...snapshot.metadata.years))actions.push({label:`Terminar série em ${row.year}`,run:()=>setFilters({start:Math.min(currentFilters().start,+row.year),end:+row.year})});
  if(snapshot.metadata.products.includes(series.label))actions.unshift({label:`Filtrar ${series.label}`,run:()=>setFilters({product:series.label})});
  if(Object.hasOwn(regionColors,series.label))actions.unshift({label:`Filtrar ${series.label}`,run:()=>setFilters({region:series.label,uf:'all'})});
  markActions(`${row.year} · ${series.label}`,actions);
}
function selectField(id,label,choices,value){return `<label class="filter-field" for="${id}"><span>${e(label)}</span><select id="${id}" data-filter="${id}">${choices.map(choice=>{const item=typeof choice==='object'?choice:{value:choice,label:choice};return `<option value="${e(item.value)}" ${String(item.value)===String(value)?'selected':''}>${e(item.label)}</option>`;}).join('')}</select></label>`;}
function sourceSection(queryId){
  const source=snapshot.queries[queryId].source;
  const label=source.label.replace(/\s*·?\s*Tabela 3940 \(arquivo fornecido\)/g,'');
  const provider=source.provider==='Arquivo local fornecido pelo usuário'?'':source.provider;
  const prepared=source.executedAt??snapshot.generatedAt,sourceDate=/^\d{4}-\d{2}-\d{2}$/.test(prepared)?prepared.split('-').reverse().join('/'):new Intl.DateTimeFormat('pt-BR').format(new Date(prepared));
  return `<section class="source-section"><h3>${e(label)}</h3><p class="muted">${provider?e(provider)+' · ':''}Atualizado em ${e(sourceDate)}</p>
    ${source.metricDefinitions?.length?`<dl>${source.metricDefinitions.map(item=>`<dt>${e(item.label)}</dt><dd>${e(item.definition)}</dd>`).join('')}</dl>`:''}
    <h4>Observações da fonte</h4><ul>${(source.caveats??[]).map(text=>`<li>${e(text)}</li>`).join('')}</ul>
    <details><summary>Preparação e rastreabilidade</summary>${(source.evidenceFlow??[]).map(item=>`<p><strong>${e(item.title)}:</strong> ${e(item.detail)}</p>`).join('')}<p>Arquivos: ${(source.files??[]).map(e).join(', ')}</p></details>
    ${(source.links??[]).filter(link=>/^https?:\/\//.test(link.href)).map(link=>`<p><a href="${e(link.href)}" target="_blank" rel="noopener noreferrer">${e(link.label)} ↗</a></p>`).join('')}</section>`;
}
function showSource(){
  page='methodology';views[page]??=defaultFilters(snapshot);updateUrl();render();window.scrollTo({top:0,behavior:'instant'});
}
function card(id,title,content,{rows=[],queryIds=['production'],note='',className='',columns}={}){
  cards.set(id,{id,title,rows,queryIds,note,columns});
  return `<section class="card ${className}" aria-labelledby="${id}-title"><div class="card-header"><h2 id="${id}-title">${e(title)}</h2><div class="card-tools"><button class="csv-button" data-action="csv" data-id="${id}" aria-label="Baixar CSV de ${e(title)}" title="Baixar os dados desta visualização">CSV</button></div></div>${note&&className!=='metric-card'?`<p class="card-note">${e(note)}</p>`:''}${content}</section>`;
}
function chartCard(id,title,rows,type,options={}){
  charts.push(()=>{
    const host=document.getElementById(id);if(!host)return;
    const settings={rows,title,...options};
    if(type==='line')drawLine(host,{...settings,onSelect:options.onSelect??lineActions,onRange:([start,end])=>setFilters({start,end})});
    if(type==='bar')drawBars(host,{...settings,onSelect:row=>barActions(row,options.dimension??'product')});
    if(type==='pie')drawPie(host,{...settings,onSelect:row=>selectRegion(row.label)});
    if(type==='area100')drawArea100(host,settings);
    if(type==='combo')drawCombo(host,{...settings,onSelect:lineActions,onRange:([start,end])=>setFilters({start,end})});
  });
  const columns=options.columns??(type==='line'?[{key:'year',label:'Ano'},...(options.series??[]).map(series=>({key:series.key,label:series.label}))]:undefined);
  return card(id,title,`${options.controls??''}<div id="${id}" class="chart-host ${type==='pie'?'pie-host':''} ${type==='bar'?'bar-host':''}"></div>${options.after??''}`,{rows:options.exportRows??rows,queryIds:options.queryIds,note:options.note,columns,className:options.className??''});
}
function metrics(scope,year,queryIds=['production']){
  const rows=scope.filter(row=>+row.year===year),quantity=sum(rows,'tonnes'),value=sum(rows,'valueReais'),unit=ratio(rows);
  const values=[['volume','Produção (t)',compact(quantity),signedPercent(annualChange(scope,'tonnes',year)),'Variação sobre o ano anterior, com grupos observados em ambos os anos.'],['value','Valor da produção',compactMoney(value),signedPercent(annualChange(scope,'valueReais',year)),'Reais nominais. Variação sobre o ano anterior, com grupos comparáveis.'],['unit-value','Valor médio por kg',unit==null?'—':'R$ '+number(unit),'','Razão de somas entre valor e quantidade em kg. Não é preço de varejo.']];
  return `<div class="metric-grid">${values.map(([id,title,text,change,note])=>card(`metric-${id}`,title,`<p class="metric-value">${e(text)}</p>${change?`<p class="metric-change">${e(change)} <span>em relação a ${year-1}</span></p>`:'<p class="metric-change muted">Relação entre valor e quantidade</p>'}`,{rows:[{year:String(year),tonnes:quantity,valueReais:value,valuePerKg:unit}],queryIds,note,className:'metric-card'})).join('')}</div>`;
}
function tableCard(id,title,rows,columns,{onSelect,queryIds=['production'],note=''}={}){
  const view=tables[id]??={search:'',page:0,sort:null,direction:'asc'};
  const filtered=filterTable(rows,view),pageSize=10,pagesCount=Math.max(1,Math.ceil(filtered.length/pageSize));view.page=Math.min(view.page,pagesCount-1);
  const shown=filtered.slice(view.page*pageSize,(view.page+1)*pageSize);
  const html=`<div class="table-toolbar"><label class="search-field" for="search-${id}"><span>Buscar</span><input type="search" id="search-${id}" data-table-search="${id}" value="${e(view.search)}" placeholder="${id==='municipal-table'?'Município, Estado/UF ou código IBGE':'Espécie ou território'}"></label><span class="muted table-count">${number(filtered.length)} registros</span></div><div class="table-scroll"><table><caption class="sr-only">${e(title)}</caption><thead><tr>${columns.map(column=>`<th scope="col" class="${['label','municipality','uf','code'].includes(column.key)?'':'numeric'}" aria-sort="${view.sort===column.key?(view.direction==='asc'?'ascending':'descending'):'none'}"><button data-sort-table="${id}" data-key="${column.key}">${e(column.label??columnLabels[column.key]??column.key)} ${view.sort===column.key?(view.direction==='asc'?'↑':'↓'):'↕'}</button></th>`).join('')}${onSelect?'<th scope="col"><span class="sr-only">Detalhar</span></th>':''}</tr></thead><tbody>${shown.map(row=>`<tr ${row.code===municipalityCode?'class="selected-row"':''}>${columns.map(column=>`<td class="${['label','municipality','uf','code'].includes(column.key)?'':'numeric'}">${e(formatCell(column.key,row[column.key]))}</td>`).join('')}${onSelect?`<td><button class="row-action" data-table-action="${id}" data-row="${e(row.code??row.label)}" aria-label="Detalhar ${e(row.municipality??row.label)}" title="Abrir detalhamento">→</button></td>`:''}</tr>`).join('')||`<tr><td colspan="${columns.length+1}">Nenhum registro encontrado para este recorte.</td></tr>`}</tbody></table></div><div class="pagination"><span>${filtered.length?view.page*pageSize+1:0}–${Math.min(filtered.length,(view.page+1)*pageSize)} de ${filtered.length}</span><div><button data-page-table="${id}" data-direction="-1" ${view.page===0?'disabled':''} aria-label="Página anterior de ${e(title)}">←</button><span>Página ${view.page+1} de ${pagesCount}</span><button data-page-table="${id}" data-direction="1" ${view.page===pagesCount-1?'disabled':''} aria-label="Próxima página de ${e(title)}">→</button></div></div>`;
  if(onSelect)charts.push(()=>app.querySelectorAll(`[data-table-action="${id}"]`).forEach(node=>node.onclick=()=>onSelect(rows.find(row=>String(row.code??row.label)===node.dataset.row))));
  return card(id,title,html,{rows:filtered,queryIds,note,columns:columns.map(column=>({key:column.key,label:column.label??columnLabels[column.key]??column.key}))});
}
const comparisonColumns=dimension=>[{key:'label',label:dimension},...['tonnes','productionShare','annualGrowth','valueReais','valuePerKg'].map(key=>({key}))];
function multiHistory(rows,dimension,labels,metric='tonnes'){
  const years=[...new Set(rows.map(row=>row.year))].sort();
  return {rows:years.map(year=>({year,...Object.fromEntries(labels.map((label,index)=>['series'+index,sum(rows.filter(row=>row.year===year&&row[dimension]===label),metric)]))})),series:labels.map((label,index)=>({key:'series'+index,label}))};
}
function mapCard(context,year){
  const f=currentFilters(),isRegion=level==='regions',isPole=level==='poles',metric=speciesMetric;
  const geometry=queryRows('geography').filter(row=>row.level===(isRegion?'GR':'UF'));
  const rows=isPole?context.mapRows:isRegion?context.regionRows:context.allStateRows;
  const scale=mapScale(rows,metric),metricLabel=metric==='tonnes'?'Produção (t)':'Valor da produção (R$)';
  const features=geometry.map(shape=>({...shape,record:rows.find(row=>row.label===shape.place),selected:isPole?context.involved.has(shape.uf):isRegion?shape.region===f.region:shape.uf===f.uf,outside:isPole?!context.involved.has(shape.uf):!isRegion&&f.region!=='all'&&shape.region!==f.region}));
  const scope=isPole?context.label:f.uf!=='all'?f.uf:f.region!=='all'?f.region:'Brasil';
  const base=`<strong>${e(scope)} · ${year}</strong><span>${isPole?'Estados/UF abrangidos; valores somente dos municípios cadastrados.':isRegion?'Clique em uma região para detalhar.':'Clique em um Estado/UF para selecionar ou desmarcar.'}</span>`;
  charts.push(()=>app.querySelectorAll('[data-map-code]').forEach(node=>{
    const feature=features.find(row=>row.code===node.dataset.mapCode);
    if(!isPole){const activate=()=>drill({label:feature.place},!isRegion);node.onclick=activate;node.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}};}
    const show=()=>{
      const row=feature.record,value=row?.[metric];
      const denominator=isPole?context.total[metric]:metric==='tonnes'?context.national:context.nationalValue;
      const share=Number.isFinite(value)&&denominator>0?percent(value/denominator):'—';
      const regional=context.regionRows?.find(r=>r.label===feature.region)?.[metric];
      const regionShare=!isPole&&!isRegion&&f.region!=='all'&&feature.region===f.region&&regional>0&&Number.isFinite(value)?` · ${percent(value/regional)} da região ${feature.region}`:'';
      document.getElementById('map-readout').innerHTML=`<strong>${e(feature.place)}</strong><span>${Number.isFinite(value)?`${e(formatCell(metric,value))}${metric==='tonnes'?' t':''} · ${e(share)} ${isPole?'do recorte de polos':'do Brasil'}${e(regionShare)}`:feature.outside?'Fora do recorte':'Dado indisponível'}</span>`;
    };
    node.onpointerenter=show;node.onfocus=show;
    node.onpointerleave=()=>document.getElementById('map-readout').innerHTML=base;
    node.onblur=()=>document.getElementById('map-readout').innerHTML=base;
  }));
  const title=isRegion?'Mapa das regiões':isPole?'Estados/UF abrangidos':'Mapa de Estados/UF';
  const legendMax=metric==='tonnes'?compact(scale.maximum)+' t':compactMoney(scale.maximum);
  return card('territory-map',title,`<svg class="territory-map" viewBox="0 0 620 580" role="group" aria-label="${e(title)} · ${e(metricLabel)} · ${year}"><defs><pattern id="map-no-data" width="7" height="7" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="var(--map-zero)"/><path d="M0 7L7 0" stroke="var(--muted)" stroke-width="1"/></pattern></defs>${features.map(shape=>`<path class="map-shape ${shape.outside?'outside-scope':''} ${shape.selected?'selected-area':''}" d="${e(shape.path)}" fill="${shape.outside?'var(--excluded)':scale.color(shape.record?.[metric])}" fill-rule="evenodd" role="${isPole?'img':'button'}" tabindex="0" ${isPole?'':`aria-pressed="${shape.selected}"`} data-map-code="${shape.code}" aria-label="${e(shape.place)}: ${e(formatCell(metric,shape.record?.[metric]))}${metric==='tonnes'?' t':''}${isPole?'. Somente municípios cadastrados dos polos.':'. Selecionar ou desmarcar.'}"><title>${e(shape.place)} · ${e(formatCell(metric,shape.record?.[metric]))}</title></path>`).join('')}</svg><div class="map-readout" id="map-readout" role="status">${base}</div><div class="map-scale"><div class="map-scale-ramp"></div><div class="map-scale-labels"><span>0</span><strong>${e(legendMax)}</strong></div><p>${e(metricLabel)} · escala ${isPole?'do recorte de polos':'nacional, por nível territorial'}</p></div><div class="map-status-legend"><span><i class="map-key zero"></i>Zero</span><span><i class="map-key missing"></i>Sem dados</span><span><i class="map-key excluded"></i>Fora do recorte</span></div>`,{rows:features.map(({path,record,...shape})=>({...shape,...record})),queryIds:isPole?['poleProduction','poles','geography']:['production','geography'],note:isPole?'Destaque dos Estados/UF com municípios cadastrados. As áreas exibidas não são os limites dos polos.':'A intensidade indica o valor; a borda destaca a seleção. Clicar em um território preserva a referência nacional da escala.'});
}
function temporalSection(scope,f,source,scopeLabel=''){
  const isPole=page==='territory'&&level==='poles';
  const mode=page==='overview'||isPole?'selected':seriesMode;
  const within=rows=>rows.filter(row=>+row.year>=f.start&&+row.year<=f.end);
  let quantity,value,note;
  if(mode==='regions'){
    const records=within(scopeProduction(source,{...domainFilters(f,true),region:'all',uf:'all'},'GR'));
    quantity=multiHistory(records,'region',Object.keys(regionColors));value=multiHistory(records,'region',Object.keys(regionColors),'valueReais');
    note='Comparação das cinco regiões, mantendo a espécie selecionada. O filtro geográfico não restringe esta comparação.';
  }else if(mode==='species'){
    const records=scopeProduction(source,{...domainFilters(f,true),product:'all'},f.uf!=='all'?'UF':f.region!=='all'?'GR':'BR');
    const leading=comparisonRows(records,'product',f.end).slice(0,5).map(row=>row.label);
    quantity=multiHistory(within(records),'product',leading);value=multiHistory(within(records),'product',leading,'valueReais');
    note=`Comparação das cinco maiores espécies em ${f.end} no território selecionado. As mesmas espécies são mantidas em toda a série.`;
  }else{
    quantity={rows:history(within(scope)),series:[{key:'tonnes',label:'Produção (t)'}]};
    value={rows:quantity.rows,series:[{key:'valueReais',label:'Valor nominal (R$)'}]};
    note='Séries do território e da espécie selecionados. O intervalo é independente do ano dos indicadores anuais.';
  }
  if(isPole)note=scopeLabel?`Tilápia em ${scopeLabel}, município do polo selecionado.`:'Tilápia nos municípios cadastrados do polo selecionado; todos os polos usa a união dos códigos IBGE, sem duplicação.';
  const selector=page==='territory'&&!isPole?`<label class="filter-field" for="series-mode"><span>Comparação</span><select id="series-mode" data-series-mode><option value="selected" ${mode==='selected'?'selected':''}>Território e espécie selecionados</option><option value="regions" ${mode==='regions'?'selected':''}>Comparar regiões</option><option value="species" ${mode==='species'?'selected':''}>Comparar espécies</option></select></label>`:'';
  const slider=`<div class="range-under-chart ${page==='overview'?'combo-range':''}">${yearRangeMarkup(f,snapshot.metadata.years)}</div><p class="temporal-note">${e(note)}</p>`;
  if(page==='overview')return chartCard('overview-history','Evolução da produção e do valor nominal',quantity.rows,'combo',{className:'overview-temporal',columns:[{key:'year',label:'Ano'},{key:'tonnes',label:'Produção (t)'},{key:'valueReais',label:'Valor nominal (R$)'}],after:slider});
  const chosen=speciesMetric==='tonnes'?quantity:value,metric=speciesMetric,queryIds=isPole?['poleProduction','poles']:['production'];
  return `<section class="production-temporal" aria-labelledby="temporal-heading"><div class="temporal-section-heading"><h2 id="temporal-heading">Série temporal${scopeLabel?' · '+e(scopeLabel):''}</h2>${selector}</div>${chartCard('production-series-history',speciesMetric==='tonnes'?'Evolução da produção (t)':'Evolução do valor nominal (R$)',chosen.rows,'line',{metric,series:chosen.series,queryIds,className:'temporal-chart',after:slider})}</section>`;

}
function speciesCard(rows,f){
  const title=`Espécies · ${f.uf!=='all'?f.uf:f.region!=='all'?f.region:'Brasil'}`;
  return chartCard('species-detail',title,sortMeasure(rows),'bar',{metric:speciesMetric,selectedLabel:f.product,note:'Selecione um território no mapa ou no ranking para detalhar suas espécies.'});
}
function sortMeasure(rows){return [...rows].sort((a,b)=>(b[speciesMetric]??-Infinity)-(a[speciesMetric]??-Infinity));}
function thematicPage(f,source){
  const years=snapshot.metadata.years,theme=themes[themeId],isValue=speciesMetric==='valueReais',unit=isValue?'R$':'t',format=isValue?money:number,measure=isValue?'Valor nominal':'Produção',shareField=isValue?'valueShare':'productionShare';
  const records=scopeProduction(source,{...domainFilters(f,true),product:'all'},f.uf!=='all'?'UF':f.region!=='all'?'GR':'BR');
  const data=thematicHistory(records,themeId,years,snapshot.metadata.products,speciesMetric);
  const columns=[{key:'year',label:'Ano'},{key:'group',label:'Grupo'},{key:speciesMetric,label:`${measure} (${unit})`},{key:shareField,label:'Participação (fração de 0 a 1)'},{key:'total',label:`Total (${unit})`}];
  const table=`<div class="table-scroll"><table class="theme-matrix"><caption class="sr-only">${e(theme.title)} · ${measure.toLowerCase()} e participação em todos os anos</caption><thead><tr><th scope="col">Ano</th>${data.series.map((g,i)=>`<th scope="col" class="numeric"><i class="legend-dot" style="background:${palette[i]}"></i> ${e(g.label)}</th>`).join('')}<th scope="col" class="numeric">Total (${unit})</th></tr></thead><tbody>${data.rows.map(row=>`<tr ${+row.year===f.year?'class="annual-highlight"':''}><th scope="row">${row.year}${+row.year===Math.max(...years)?' *':''}</th>${data.series.map(g=>`<td class="numeric"><strong>${e(format(row[g.key]))}</strong><small>${e(percent(row[g.key+'Share']))}</small></td>`).join('')}<td class="numeric">${e(format(row.total))}</td></tr>`).join('')}</tbody></table></div>`;
  const composition=`<section class="theme-definition" aria-label="Composição dos grupos"><h3>Composição dos grupos</h3>${compositionNotes[themeId]?compositionNotes[themeId].map(text=>`<p>${e(text)}</p>`).join(''):`<dl>${data.definitions.map(g=>`<dt>${e(g.label)}</dt><dd>${g.products.map(e).join('; ')}.</dd>`).join('')}</dl>`}</section>`;
  const buttons=`<div class="theme-buttons" role="group" aria-label="Comparação temática">${Object.entries(themes).map(([id,t])=>`<button type="button" data-theme-select="${id}" aria-pressed="${id===themeId}">${e(t.title)}</button>`).join('')}</div>`;
  return `<section id="thematic-section" class="theme-section thematic-panel"><div class="thematic-panel-header"><h2>Painéis temáticos</h2>${buttons}</div><p class="theme-scope">${e(f.uf!=='all'?f.uf:f.region!=='all'?f.region:'Brasil')} · todas as espécies disponíveis · ${Math.min(...years)}–${Math.max(...years)}. ${isValue?'Valores nominais em reais':'Toneladas'} e participação no ${isValue?'valor total':'total'} de cada ano, incluindo “Outros”. * Último ano preliminar conforme o arquivo.</p><div class="thematic-workspace">${card('theme-annual',`${measure} (${unit}) e participação (%) por ano`,table,{rows:data.exportRows,columns})}${chartCard('theme-share-history',`Participação ${isValue?'no valor da produção':'na produção'} · 100%`,data.rows,'area100',{series:data.series,exportRows:data.exportRows,columns,metric:speciesMetric,after:composition})}</div></section>`;

}
function ensurePoles(){
  if(poleStatus==='loading'||poleStatus==='ready')return;
  poleStatus='loading';
  Promise.all([store.ensure('poleProduction'),store.ensure('poles')]).then(()=>{
    poleStatus='ready';if(!queryRows('poles').some(p=>p.id===poleId))poleId='all';if(page==='territory'&&level==='poles'){updateUrl(false);render();}
  }).catch(error=>{poleStatus='error';poleError=error.message;if(page==='territory'&&level==='poles')render();});
}
function productionHeader(){
  return `<div class="production-panel-header"><h2>Exploração da produção</h2><div class="production-controls"><label class="filter-field" for="territory-level"><span>Nível</span><select id="territory-level" data-territory-level>${[['regions','Regiões'],['states','Estado/UF'],['poles','Polos de tilápia']].map(([id,label])=>`<option value="${id}" ${level===id?'selected':''}>${label}</option>`).join('')}</select></label></div></div>`;
}
function productionPage(f,source){
  const isPole=level==='poles',year=f.year,measure=speciesMetric==='tonnes'?'Produção (t)':'Valor da produção (R$)';
  if(isPole&&poleStatus!=='ready'){
    if(poleStatus==='idle')ensurePoles();
    return `<section class="production-panel">${productionHeader()}<div class="panel-loading">${poleStatus==='error'?`<p role="alert">${e(poleError)}</p><button data-action="retry-poles">Tentar novamente</button>`:'<p role="status">Carregando os dados dos polos…</p>'}</div></section>`;
  }
  if(isPole){
    const poles=queryRows('poles'),municipal=queryRows('poleProduction'),products=snapshot.metadata.products;
    if(poleId!=='all'&&!poles.some(p=>p.id===poleId)){poleId='all';updateUrl(false);}
    const choice=poles.find(p=>p.id===poleId),label=choice?.label??'Todos os polos cadastrados';
    const records=poleRecords(municipal,poles,poleId,products),ranking=sortMeasure(poleRanking(municipal,poles,year,products));
    const municipalities=choice?sortMeasure(poleMunicipalities(municipal,poles,poleId,year,products)):[];
    if(municipalityCode&&!municipalities.some(r=>r.code===municipalityCode)){municipalityCode=null;updateUrl(false);}
    const selected=municipalities.find(r=>r.code===municipalityCode);
    const geography=queryRows('geography').filter(r=>r.level==='UF');
    const codes=new Set(poles.filter(p=>poleId==='all'||p.id===poleId).flatMap(p=>p.codes));
    const involved=new Set(geography.filter(g=>[...codes].some(code=>code.slice(0,2)===g.code)).map(g=>g.uf));
    const annual=records.filter(r=>+r.year===year),mapRows=group(annual,'uf').map(r=>({...r,label:geography.find(g=>g.uf===r.label)?.place??r.label}));
    const context={mapRows,involved,label,total:{tonnes:sum(annual,'tonnes'),valueReais:sum(annual,'valueReais')}};
    const missing=poles.filter(p=>poleId==='all'||p.id===poleId).flatMap(p=>p.unavailableMembers??[]);
    const coverage=missing.length?`<p class="coverage-note" role="note">Sem registros na base local: ${missing.map(m=>e(`${m.name} (${m.uf})`)).join(', ')}. Totais somam apenas dados disponíveis; ausência não é zero.</p>`:'';
    const choiceControl=`<label class="filter-field" for="pole-choice"><span>Polo</span><select id="pole-choice" data-pole-choice><option value="all">Todos os polos cadastrados</option>${poles.map(p=>`<option value="${p.id}" ${p.id===poleId?'selected':''}>${e(p.label)}</option>`).join('')}</select></label>`;
    let detail=choice?`<details class="species-table-details" ${disclosureAttributes('pole-indicators')}><summary>Indicadores dos municípios do polo</summary>${tableCard('pole-municipal-table','Municípios do polo',municipalities,[{key:'label',label:'Município'},{key:'uf'},{key:'tonnes'},{key:'productionShare',label:'Participação no polo'},{key:'valueReais'},{key:'annualGrowth'}],{queryIds:['poleProduction','poles'],onSelect:row=>barActions(row,'municipal-pole')})}</details>`:'';

    return `${metrics(records,year,['poleProduction','poles'])}<section class="production-panel">${productionHeader()}<div class="production-context"><strong>Tilápia · ${e(label)} · ${year}</strong>${choiceControl}</div><div class="territory-workspace">${mapCard(context,year)}${chartCard('pole-ranking',`${measure} por polo`,ranking,'bar',{metric:speciesMetric,dimension:'pole',selectedLabel:choice?.label,queryIds:['poleProduction','poles']})}${choice?chartCard('pole-municipalities','Municípios do polo',municipalities,'bar',{metric:speciesMetric,dimension:'municipal-pole',selectedLabel:selected?.label,queryIds:['poleProduction','poles'],note:'Somente tilápia. Clique em um município para consultar seu histórico abaixo.'}):card('pole-prompt','Municípios do polo','<p class="empty">Selecione um polo no ranking ou no menu para detalhar seus municípios.</p>',{queryIds:['poleProduction','poles']})}</div><p class="panel-footnote">Os polos cadastrados não representam toda a produção brasileira de tilápia. Composição observada em 20/10/2026, aplicada à série local; o mapa não delimita os polos.</p>${temporalSection(selected?records.filter(r=>r.code===selected.code):records,f,source,selected?.label??'')}</section>${coverage}${detail}`;
  }
  const context=geographicContext(source,f),scope=scopeProduction(source,domainFilters(f,true),f.uf!=='all'?'UF':f.region!=='all'?'GR':'BR');
  const allSpecies=scopeProduction(source,{...domainFilters(f,true),product:'all'},f.uf!=='all'?'UF':f.region!=='all'?'GR':'BR'),speciesRows=comparisonRows(allSpecies,'product',year);
  const isRegion=level==='regions',territorialRows=isRegion?context.regionRows:context.stateRows;
  const previous=f.uf!=='all'?'Voltar aos Estados/UF':!isRegion?'Voltar às regiões':null;
  const breadcrumb=`<nav class="territory-breadcrumb" aria-label="Caminho territorial"><button data-action="territory-home">Brasil</button>${f.region!=='all'?`<span>›</span><button data-action="region-home">${e(f.region)}</button>`:''}${f.uf!=='all'?`<span>›</span><strong>${e(f.uf)}</strong>`:''}</nav>`;
  const columns=[{key:'label',label:isRegion?'Região':'Estado/UF'},{key:'tonnes'},{key:'nationalShare'},...(!isRegion&&f.region!=='all'?[{key:'regionalShare'}]:[]),{key:'annualGrowth'},{key:'valueReais'},{key:'valuePerKg'}];
  return `${metrics(scope,year)}<section class="production-panel">${productionHeader()}<div class="map-navigation">${breadcrumb}${previous?`<button class="back-button" data-action="territory-back">← ${previous}</button>`:''}</div><div class="territory-workspace">${mapCard(context,year)}${chartCard(isRegion?'region-production':'state-production',`${measure} por ${isRegion?'região':'Estado/UF'}`,sortMeasure(territorialRows),'bar',{metric:speciesMetric,dimension:isRegion?'region':'state',selectedLabel:isRegion?f.region:context.stateRows.find(r=>r.uf===f.uf)?.label})}${speciesCard(speciesRows,f)}</div>${temporalSection(scope,f,source)}</section>${thematicPage(f,source)}<details class="species-table-details" ${disclosureAttributes('territory-indicators')}><summary>Indicadores por ${isRegion?'região':'Estado/UF'}</summary>${tableCard('territory-table',isRegion?'Indicadores por região':'Indicadores por Estado/UF',territorialRows,columns,{onSelect:row=>drill(row,!isRegion)})}</details><details class="species-table-details" ${disclosureAttributes('species-indicators')}><summary>Indicadores por espécie</summary>${tableCard('species-table','Indicadores por espécie',speciesRows,comparisonColumns('Espécie'),{onSelect:row=>setFilters({product:currentFilters().product===row.label?'all':row.label})})}</details>`;
}
function methodologyPage(){
  return `<article class="methodology-page"><div class="section-heading"><h2>Fontes e metodologia</h2></div><section class="card"><h3>Leitura dos filtros e dos indicadores</h3><dl><dt>Ano</dt><dd>Define o ano das quantidades, dos valores, dos mapas e das tabelas. Não altera o período da série temporal.</dd><dt>Período da série</dt><dd>O controle de duas extremidades e a seleção por arraste alteram somente as séries. Os dois limites podem ser ajustados também pelo teclado e mantêm ao menos dois anos disponíveis, inclusive em links e seleção por arraste.</dd><dt>Espécie</dt><dd>Nome de exibição para as categorias do arquivo do IBGE. Algumas categorias agrupam mais de uma espécie, como “Outros peixes” e “Ostras, vieiras e mexilhões”. Os nomes e valores originais foram preservados.</dd><dt>Participação territorial</dt><dd>O mapa usa uma escala sequencial para produção ou valor. Zero, dados ausentes e áreas fora do recorte têm representações distintas. Nos polos, mostra Estados/UF abrangidos e somente valores dos municípios cadastrados. Selecionar um Estado/UF não transforma seu próprio valor em denominador. A escala usa o domínio nacional do nível territorial, ano, espécie e medida escolhidos.</dd><dt>Comparações</dt><dd>A visualização escolhida no cabeçalho orienta mapa, ranking territorial e detalhamento. Os temáticos apresentam todos os anos disponíveis na medida escolhida (toneladas ou valor nominal em reais) e porcentagens, com uma comparação selecionada de cada vez. A composição por espécie apresenta todas as categorias do território, destacando a escolhida. A série permite comparar regiões ou as cinco maiores espécies, com o escopo descrito junto ao controle.</dd><dt>Dados municipais</dt><dd>A consulta municipal geral continua fora da interface. Municípios são detalhados somente dentro dos polos de tilápia. A composição dos polos é um cadastro observado no painel da Embrapa em 20/10/2026 e aplicado à série local; seus limites não são reconstruídos ano a ano.</dd></dl></section>${['production','municipalities','geography','poles','poleProduction'].map(sourceSection).join('')}</article>`;
}
function render(){
  const rangeKey=`${currentFilters().start}:${currentFilters().end}`,animateRange=renderedPage===page&&renderedRange!==rangeKey,previousCharts=animateRange?captureTemporalCharts(app):null;
  app.querySelectorAll('details[data-disclosure]').forEach(node=>disclosureStates.set(node.dataset.disclosure,node.open));
  hideTooltip();const focused=document.activeElement,focusId=focused?.id,selectionStart=focused?.selectionStart,selectionEnd=focused?.selectionEnd;
  charts=[];cards=new Map();
  const f=currentFilters(),year=f.year,source=queryRows('production'),isPole=page==='territory'&&level==='poles';
  const regionChoices=[{value:'all',label:'Todas'},...Object.keys(regionColors)];
  const stateChoices=[{value:'all',label:'Todos'},...queryRows('geography').filter(row=>row.level==='UF'&&(f.region==='all'||row.region===f.region)).sort((a,b)=>a.place.localeCompare(b.place,'pt-BR')).map(row=>({value:row.uf,label:`${row.place} (${row.uf})`}))];
  let body;
  if(page==='methodology')body=methodologyPage();
  else if(page==='territory')body=productionPage(f,source);
  else{
    const scope=scopeProduction(source,domainFilters(f,true),f.uf!=='all'?'UF':f.region!=='all'?'GR':'BR');
    const allSpecies=scopeProduction(source,{...domainFilters(f,true),product:'all'},f.uf!=='all'?'UF':f.region!=='all'?'GR':'BR');
    const speciesRows=comparisonRows(allSpecies,'product',year),context=geographicContext(source,f);
    body=metrics(scope,year)+`<div class="section-heading"><h2>Distribuição anual · ${year}</h2></div><div class="chart-grid">${chartCard('regional-share','Participação das regiões na produção',context.regionRows,'pie',{selectedLabel:f.region,note:'Brasil, com a espécie selecionada. As cinco regiões permanecem na comparação.'})}${chartCard('leading-species','Produção (t) das principais espécies',speciesRows.filter(row=>row.tonnes!=null).slice(0,6),'bar',{selectedLabel:f.product,note:'Principais espécies no território selecionado. Clique em uma barra para selecionar a espécie.'})}</div>${temporalSection(scope,f,source)}`;
  }
  const measureControl=page==='territory'?`<div class="measure-switch" role="group" aria-label="Visualização">${[['tonnes','Produção (t)'],['valueReais','Valor (R$)']].map(([id,label])=>`<button type="button" id="measure-${id}" data-measure="${id}" aria-pressed="${speciesMetric===id}">${label}</button>`).join('')}</div>`:'';
  const filterBar=page==='methodology'?'':`<section class="filter-bar" aria-label="Filtros dos dados">${selectField('year','Ano',snapshot.metadata.years,year)}${!isPole?selectField('region','Região',regionChoices,f.region):''}${page==='territory'&&!isPole?selectField('uf','Estado/UF',stateChoices,f.uf):''}${!isPole?selectField('product','Espécie',[{value:'all',label:'Todas'},...snapshot.metadata.products],f.product):''}${measureControl}<button class="reset-button" data-action="reset">Limpar seleção</button></section>`;
  const viewContext=page==='methodology'?'':`<div class="view-context" aria-live="polite"><p>${isPole?'Polos cadastrados · Tilápia':`${e(f.region==='all'?'Brasil':f.region)}${f.uf!=='all'?' / '+e(f.uf):''} · ${e(f.product==='all'?'Todas as espécies disponíveis':f.product)}`} · Ano ${year}</p>${year===Math.max(...snapshot.metadata.years)?'<span class="preliminary">Resultado preliminar</span>':''}</div>`;
  app.innerHTML=`<header class="site-header"><div class="header-main"><h1>${e(appTitle)}</h1><div class="header-tools"><button class="icon-button" data-action="theme" aria-label="Alternar tema claro e escuro" title="Alternar tema">◐</button><button class="icon-button" data-action="print" aria-label="Imprimir dashboard" title="Imprimir">⎙</button></div></div><nav aria-label="Páginas do dashboard">${Object.entries(pages).map(([id,label])=>`<button data-tab="${id}" ${id===page?'aria-current="page"':''}>${e(label)}</button>`).join('')}</nav>${filterBar}</header><main id="conteudo">${viewContext}<div class="page-content ${renderedPage!==null&&renderedPage!==page?'page-enter':''}">${body}</div><footer>Fonte: IBGE/SIDRA · Pesquisa da Pecuária Municipal <button data-action="sources">Fontes e metodologia</button></footer></main>`;
  document.documentElement.style.setProperty('--header-height',app.querySelector('.site-header').offsetHeight+'px');
  renderedPage=page;renderedRange=rangeKey;
  charts.forEach(draw=>draw());if(previousCharts)animateTemporalCharts(app,previousCharts);bindYearRange(app,patch=>setFilters(patch));
  if(focusId){const target=document.getElementById(focusId);target?.focus({preventScroll:true});if(typeof selectionStart==='number'&&target?.type==='search')target.setSelectionRange(selectionStart,selectionEnd);}
}
app.addEventListener('change',event=>{
  const target=event.target;
  if(target.dataset.filter){const key=target.dataset.filter;setFilters({[key]:key==='year'?+target.value:target.value});if(key==='uf'&&target.value!=='all'){level='states';updateUrl();render();}}
  if(target.hasAttribute('data-series-mode')){seriesMode=target.value;updateUrl();render();}
  if(target.hasAttribute('data-territory-level')){level=target.value;seriesMode='selected';municipalityCode=null;if(level==='regions')views[page]={...currentFilters(),uf:'all'};tables={};updateUrl();render();}
  if(target.hasAttribute('data-pole-choice')){poleId=target.value;municipalityCode=null;updateUrl();render();}
});
app.addEventListener('input',event=>{const target=event.target;if(target.dataset.tableSearch){const state=tables[target.dataset.tableSearch];state.search=target.value;state.page=0;render();}});
app.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target)return;
  if(target.dataset.measure){speciesMetric=target.dataset.measure;updateUrl();render();document.getElementById(`measure-${speciesMetric}`)?.focus({preventScroll:true});}
  if(target.dataset.tab){page=target.dataset.tab;views[page]??=defaultFilters(snapshot);tables={};updateUrl();render();window.scrollTo({top:0,behavior:'instant'});}
  if(target.dataset.themeSelect){themeId=target.dataset.themeSelect;updateUrl();render();app.querySelector(`[data-theme-select="${themeId}"]`)?.focus({preventScroll:true});}
  if(target.dataset.level){level=target.dataset.level;if(level==='regions')views[page]={...currentFilters(),uf:'all'};updateUrl();render();}
  if(target.dataset.regionCompare)selectRegion(target.dataset.regionCompare);
  if(target.dataset.sortTable){const state=tables[target.dataset.sortTable];state.direction=state.sort===target.dataset.key&&state.direction==='asc'?'desc':'asc';state.sort=target.dataset.key;state.page=0;render();}
  if(target.dataset.pageTable){tables[target.dataset.pageTable].page+=+target.dataset.direction;render();}
  const action=target.dataset.action;
  if(action==='reset'){const f=currentFilters();views[page]={...defaultFilters(snapshot),start:f.start,end:f.end};level=page==='territory'&&level==='poles'?'poles':'regions';poleId='all';municipalityCode=null;tables={};updateUrl();render();}
  if(action==='retry-poles'){poleStatus='idle';render();}
  if(action==='territory-back'){const previous=geographicStepBack(currentFilters(),level);level=previous.level;views[page]=previous.filters;updateUrl();render();}
  if(action==='territory-home'){level='regions';setFilters({region:'all',uf:'all'});}
  if(action==='region-home'){level='states';setFilters({uf:'all'});}
  if(action==='source'||action==='sources')showSource();
  if(action==='csv'){const card=cards.get(target.dataset.id),period=target.dataset.id.startsWith('theme-')?`${Math.min(...snapshot.metadata.years)}-${Math.max(...snapshot.metadata.years)}`:target.dataset.id.endsWith('history')?`${currentFilters().start}-${currentFilters().end}`:currentFilters().year;downloadCsv(card.rows,`${card.id}-${period}.csv`,card.columns??Object.keys(card.rows[0]??{}).filter(key=>!['records','productData','path'].includes(key)).map(key=>({key,label:columnLabels[key]??key})));}
  if(action==='theme'){const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('aquicultura:theme',theme);}catch{}}
  if(action==='print')window.print();
});
window.addEventListener('popstate',()=>{level='regions';readUrl();tables={};render();});
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{const header=app.querySelector('.site-header');if(header)document.documentElement.style.setProperty('--header-height',header.offsetHeight+'px');charts.forEach(draw=>draw());},120);});
async function start(){
  try{
    store=await createDataStore(new URL('../data/',import.meta.url));snapshot=store.snapshot;
    if(!snapshot.queries?.production?.rows?.length||!snapshot.queries?.geography?.rows?.length)throw new Error('O arquivo de dados está incompleto.');
    Object.keys(pages).forEach(id=>views[id]=defaultFilters(snapshot));
    try{document.documentElement.dataset.theme=localStorage.getItem('aquicultura:theme')??(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}catch{document.documentElement.dataset.theme='light';}
    appTitle=snapshot.title.replace(/\s*[·—-]\s*IBGE\b/g,'');document.title=appTitle;readUrl();updateUrl(false);render();
  }catch(error){app.innerHTML=`<main class="loading"><h1>Produção aquícola</h1><p role="alert">${e(error.message)}</p><p>Verifique se a pasta de dados foi incluída junto aos arquivos da aplicação.</p><button data-action="retry">Tentar novamente</button></main>`;app.querySelector('button').onclick=()=>location.reload();}
}
start();
