import {sum,ratio,annualChange,group,history,scopeProduction,scopeMunicipalities,comparisonRows,number,compact,money,compactMoney,percent,signedPercent} from './model.js';
import {escapeHtml as e,regionColors,downloadCsv} from './utils.js';
import {pages,defaultFilters,normalizeFilters,domainFilters,filterTable} from './state.js';
import {drawBars,drawPie,drawLine,hideTooltip} from './charts.js';

const app=document.getElementById('app'),dialog=document.getElementById('detail-dialog');
let snapshot,page='overview',views={},level='regions',municipalityCode=null,charts=[],cards=new Map(),tables={},resizeTimer,returnFocus;
const queryRows=id=>snapshot.queries[id].rows;
const columnLabels={label:'Produto / território',year:'Ano',tonnes:'Produção (t)',valueReais:'Valor nominal (R$)',productionShare:'Participação na produção',annualGrowth:'Variação anual',valuePerKg:'Valor médio (R$/kg)',municipality:'Município',uf:'UF',code:'Código IBGE',region:'Região',product:'Produto'};
const formatCell=(key,value)=>key==='valueReais'?money(value):key==='productionShare'?percent(value):key==='annualGrowth'?signedPercent(value):['tonnes','valuePerKg'].includes(key)?number(value):String(value??'—');
const currentFilters=()=>views[page];

function readUrl(){
  const params=new URL(location.href).searchParams;
  const requested=params.get('pagina')??params.get('tab')??'overview';
  page=requested==='municipalities'?'territory':Object.hasOwn(pages,requested)?requested:'overview';
  let incoming={start:params.get('inicio'),end:params.get('fim'),region:params.get('regiao'),uf:params.get('uf'),product:params.get('produto')};
  // Accept links shared by the previous version; no browser storage migration is needed.
  if(params.has('t'))try{
    const previous=JSON.parse(params.get('t'))[requested];
    if(previous?.filters){const f=previous.filters,years=String(f.year??'').split('..');incoming={...incoming,region:f.region,uf:f.uf,product:f.product,start:years.length===2?years[0]:null,end:years.at(-1)};}
    level=previous?.focus?.territoryLevel??level;municipalityCode=previous?.focus?.municipalityCode??null;
  }catch{/* A malformed shared view falls back to the documented default scope. */}
  views[page]=normalizeFilters(incoming,snapshot);
  level=['regions','states','municipalities'].includes(params.get('nivel'))?params.get('nivel'):requested==='municipalities'?'municipalities':level;
  municipalityCode=params.get('municipio')??municipalityCode;
}
function updateUrl(push=true){
  const f=currentFilters(),url=new URL(location.href);url.search='';
  Object.entries({pagina:page,inicio:f.start,fim:f.end,...(f.region!=='all'?{regiao:f.region}:{}),...(f.product!=='all'?{produto:f.product}:{}),...(page==='territory'&&f.uf!=='all'?{uf:f.uf}:{}),...(page==='territory'?{nivel:level}:{}),...(page==='territory'&&municipalityCode?{municipio:municipalityCode}:{})}).forEach(([key,value])=>url.searchParams.set(key,value));
  if(url.href!==location.href)window.history[push?'pushState':'replaceState']({},'',url);
}
function setFilters(patch){
  const old=currentFilters(),next={...old,...patch};
  if(Object.hasOwn(patch,'region')&&!Object.hasOwn(patch,'uf'))next.uf='all';
  views[page]=normalizeFilters(next,snapshot);tables={};updateUrl();render();
}
function selectRegion(region){setFilters({region:currentFilters().region===region?'all':region,uf:'all'});}
function drill(row,isState){
  if(isState){const state=queryRows('production').find(r=>r.level==='UF'&&r.place===row.label);if(!state)return;level='municipalities';municipalityCode=null;setFilters({region:state.region,uf:state.uf});}
  else {level='states';municipalityCode=null;setFilters({region:row.label,uf:'all'});}
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
  markActions(row.label,[{label:dimension==='product'?`Filtrar ${row.label}`:dimension==='state'?`Ver municípios de ${row.label}`:`Ver UFs de ${row.label}`,run:()=>dimension==='product'?setFilters({product:row.label}):drill(row,dimension==='state')}]);
}
function lineActions(row,series){
  const actions=[{label:`Usar somente ${row.year}`,run:()=>setFilters({start:+row.year,end:+row.year})},{label:`Terminar série em ${row.year}`,run:()=>setFilters({start:Math.min(currentFilters().start,+row.year),end:+row.year})}];
  if(snapshot.metadata.products.includes(series.label))actions.unshift({label:`Filtrar ${series.label}`,run:()=>setFilters({product:series.label})});
  if(Object.hasOwn(regionColors,series.label))actions.unshift({label:`Filtrar ${series.label}`,run:()=>setFilters({region:series.label,uf:'all'})});
  markActions(`${row.year} · ${series.label}`,actions);
}
function selectField(id,label,choices,value){return `<label class="filter-field" for="${id}"><span>${e(label)}</span><select id="${id}" data-filter="${id}">${choices.map(choice=>{const item=typeof choice==='object'?choice:{value:choice,label:choice};return `<option value="${e(item.value)}" ${String(item.value)===String(value)?'selected':''}>${e(item.label)}</option>`;}).join('')}</select></label>`;}
function sourceSection(queryId){
  const source=snapshot.queries[queryId].source;
  return `<section class="source-section"><h3>${e(source.label)}</h3><p class="muted">${e(source.provider??'')} · Preparado em ${e(new Intl.DateTimeFormat('pt-BR').format(new Date(source.executedAt??snapshot.generatedAt)))}</p>
    ${source.metricDefinitions?.length?`<dl>${source.metricDefinitions.map(item=>`<dt>${e(item.label)}</dt><dd>${e(item.definition)}</dd>`).join('')}</dl>`:''}
    <h4>Observações da fonte</h4><ul>${(source.caveats??[]).map(text=>`<li>${e(text)}</li>`).join('')}</ul>
    <details><summary>Preparação e rastreabilidade</summary>${(source.evidenceFlow??[]).map(item=>`<p><strong>${e(item.title)}:</strong> ${e(item.detail)}</p>`).join('')}<p>Arquivos: ${(source.files??[]).map(e).join(', ')}</p></details>
    ${(source.links??[]).filter(link=>/^https?:\/\//.test(link.href)).map(link=>`<p><a href="${e(link.href)}" target="_blank" rel="noopener noreferrer">${e(link.label)} ↗</a></p>`).join('')}</section>`;
}
function showSource(id){
  const card=cards.get(id),f=currentFilters();
  showDialog(card?`Fonte · ${card.title}`:'Fontes e metodologia',`<p class="source-scope">${e(f.region==='all'?'Brasil':f.region)}${f.uf!=='all'?' / '+e(f.uf):''} · ${f.start}–${f.end} · ${e(f.product==='all'?'Todos os produtos':f.product)}</p>${card?.note?`<p>${e(card.note)}</p>`:''}${(card?.queryIds??['production','municipalities','geography']).map(sourceSection).join('')}${card?`<details><summary>Dados desta visualização · ${card.rows.length} registros</summary><pre>${e(JSON.stringify(card.rows.slice(0,8),null,2))}</pre><p>O CSV contém todos os registros desta visualização, com os filtros e a busca aplicados.</p></details>`:''}`);
}
function card(id,title,content,{rows=[],queryIds=['production'],note='',className='',columns}={}){
  cards.set(id,{id,title,rows,queryIds,note,columns});
  return `<section class="card ${className}" aria-labelledby="${id}-title"><div class="card-header"><h2 id="${id}-title">${e(title)}</h2><div class="card-tools"><button class="icon-button" data-action="source" data-id="${id}" aria-label="Fonte de ${e(title)}" title="Fonte e metodologia">ⓘ</button><button class="csv-button" data-action="csv" data-id="${id}" aria-label="Baixar CSV de ${e(title)}" title="Baixar os dados desta visualização">CSV</button></div></div>${content}</section>`;
}
function chartCard(id,title,rows,type,options={}){
  charts.push(()=>{
    const host=document.getElementById(id);if(!host)return;
    const settings={rows,title,...options};
    if(type==='line')drawLine(host,{...settings,onSelect:lineActions,onRange:([start,end])=>setFilters({start,end})});
    if(type==='bar')drawBars(host,{...settings,onSelect:row=>barActions(row,options.dimension??'product')});
    if(type==='pie')drawPie(host,{...settings,onSelect:row=>selectRegion(row.label)});
  });
  const f=currentFilters(),slider=type==='line'?`<details id="range-${id}" class="range-details"><summary>Intervalo de anos · ${f.start}–${f.end}</summary><div class="year-ranges"><label for="${id}-start">Ano inicial <output>${f.start}</output><input id="${id}-start" data-range="start" type="range" min="${Math.min(...snapshot.metadata.years)}" max="${Math.max(...snapshot.metadata.years)}" step="1" value="${f.start}"></label><label for="${id}-end">Ano final <output>${f.end}</output><input id="${id}-end" data-range="end" type="range" min="${Math.min(...snapshot.metadata.years)}" max="${Math.max(...snapshot.metadata.years)}" step="1" value="${f.end}"></label></div></details>`:'';
  const columns=type==='line'?[{key:'year',label:'Ano'},...(options.series??[]).map(series=>({key:series.key,label:series.label}))]:undefined;
  return card(id,title,slider+`<div id="${id}" class="chart-host ${type==='pie'?'pie-host':''}"></div>`,{rows,queryIds:options.queryIds,note:options.note,columns});
}
function metrics(scope,year){
  const rows=scope.filter(row=>+row.year===year),quantity=sum(rows,'tonnes'),value=sum(rows,'valueReais'),unit=ratio(rows);
  const values=[['volume','Produção (t)',compact(quantity),signedPercent(annualChange(scope,'tonnes',year)),'Variação sobre o ano anterior, com produtos observados em ambos os anos.'],['value','Valor da produção',compactMoney(value),signedPercent(annualChange(scope,'valueReais',year)),'Reais nominais. Variação sobre o ano anterior, com produtos comparáveis.'],['unit-value','Valor médio por kg',unit==null?'—':'R$ '+number(unit),'','Razão de somas entre valor e quantidade em kg. Não é preço de varejo.']];
  return `<div class="metric-grid">${values.map(([id,title,text,change,note])=>card(`metric-${id}`,title,`<p class="metric-value">${e(text)}</p>${change?`<p class="metric-change">${e(change)} <span>em relação a ${year-1}</span></p>`:'<p class="metric-change muted">Relação entre valor e quantidade</p>'}`,{rows:[{year:String(year),tonnes:quantity,valueReais:value,valuePerKg:unit}],note,className:'metric-card'})).join('')}</div>`;
}
function tableCard(id,title,rows,columns,{onSelect,queryIds=['production'],note=''}={}){
  const view=tables[id]??={search:'',page:0,sort:null,direction:'asc'};
  const filtered=filterTable(rows,view),pageSize=10,pagesCount=Math.max(1,Math.ceil(filtered.length/pageSize));view.page=Math.min(view.page,pagesCount-1);
  const shown=filtered.slice(view.page*pageSize,(view.page+1)*pageSize);
  const html=`<div class="table-toolbar"><label class="search-field" for="search-${id}"><span>Buscar</span><input type="search" id="search-${id}" data-table-search="${id}" value="${e(view.search)}" placeholder="${id==='municipal-table'?'Município, UF ou código IBGE':'Produto ou território'}"></label><span class="muted table-count">${number(filtered.length)} registros</span></div><div class="table-scroll"><table><caption class="sr-only">${e(title)}</caption><thead><tr>${columns.map(column=>`<th scope="col" class="${['label','municipality','uf','code'].includes(column.key)?'':'numeric'}" aria-sort="${view.sort===column.key?(view.direction==='asc'?'ascending':'descending'):'none'}"><button data-sort-table="${id}" data-key="${column.key}">${e(column.label??columnLabels[column.key]??column.key)} ${view.sort===column.key?(view.direction==='asc'?'↑':'↓'):'↕'}</button></th>`).join('')}${onSelect?'<th scope="col"><span class="sr-only">Detalhar</span></th>':''}</tr></thead><tbody>${shown.map(row=>`<tr ${row.code===municipalityCode?'class="selected-row"':''}>${columns.map(column=>`<td class="${['label','municipality','uf','code'].includes(column.key)?'':'numeric'}">${e(formatCell(column.key,row[column.key]))}</td>`).join('')}${onSelect?`<td><button class="row-action" data-table-action="${id}" data-row="${e(row.code??row.label)}" aria-label="Detalhar ${e(row.municipality??row.label)}" title="Abrir detalhamento">→</button></td>`:''}</tr>`).join('')||`<tr><td colspan="${columns.length+1}">Nenhum registro encontrado para este recorte.</td></tr>`}</tbody></table></div><div class="pagination"><span>${filtered.length?view.page*pageSize+1:0}–${Math.min(filtered.length,(view.page+1)*pageSize)} de ${filtered.length}</span><div><button data-page-table="${id}" data-direction="-1" ${view.page===0?'disabled':''} aria-label="Página anterior de ${e(title)}">←</button><span>Página ${view.page+1} de ${pagesCount}</span><button data-page-table="${id}" data-direction="1" ${view.page===pagesCount-1?'disabled':''} aria-label="Próxima página de ${e(title)}">→</button></div></div>`;
  if(onSelect)charts.push(()=>app.querySelectorAll(`[data-table-action="${id}"]`).forEach(node=>node.onclick=()=>onSelect(rows.find(row=>String(row.code??row.label)===node.dataset.row))));
  return card(id,title,html,{rows:filtered,queryIds,note,columns:columns.map(column=>({key:column.key,label:column.label??columnLabels[column.key]??column.key}))});
}
const comparisonColumns=dimension=>[{key:'label',label:dimension},...['tonnes','productionShare','annualGrowth','valueReais','valuePerKg'].map(key=>({key}))];
function multiHistory(rows,dimension,labels,metric='tonnes'){
  const years=[...new Set(rows.map(row=>row.year))].sort();
  return {rows:years.map(year=>({year,...Object.fromEntries(labels.map((label,index)=>['series'+index,sum(rows.filter(row=>row.year===year&&row[dimension]===label),metric)]))})),series:labels.map((label,index)=>({key:'series'+index,label}))};
}
function mapCard(regions,states,year){
  const isRegion=level==='regions',rows=isRegion?regions:states,geometry=queryRows('geography').filter(row=>row.level===(isRegion?'GR':'UF'));
  const features=geometry.map(shape=>({...shape,record:rows.find(row=>row.label===shape.place)}));
  charts.push(()=>app.querySelectorAll('[data-map-code]').forEach(node=>{
    const feature=features.find(row=>row.code===node.dataset.mapCode);
    const activate=()=>drill({label:feature.place},!isRegion);
    node.onclick=activate;node.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();activate();}};
    const show=()=>{const box=document.getElementById('map-readout');box.innerHTML=`<strong>${e(feature.place)}</strong><span>${feature.record?`${e(number(feature.record.tonnes))} t · ${e(percent(feature.record.productionShare))} do recorte`:'Fora do recorte selecionado'}</span>`;};
    node.onpointerenter=show;node.onfocus=show;
  }));
  return card('territory-map',isRegion?'Mapa das regiões':'Mapa das UFs',`<svg class="territory-map" viewBox="0 0 620 580" role="group" aria-label="Mapa do Brasil: produção de ${year}">${features.map(shape=>`<path class="map-shape ${shape.record?'':'outside-scope'}" d="${e(shape.path)}" fill="${shape.record?regionColors[shape.region]:'var(--excluded)'}" fill-rule="evenodd" role="button" tabindex="0" data-map-code="${shape.code}" aria-label="${e(shape.place)}: ${shape.record?e(number(shape.record.tonnes))+' toneladas':'fora do recorte'}. ${isRegion?'Ver UFs':'Ver municípios'}"><title>${e(shape.place)} · ${shape.record?e(number(shape.record.tonnes))+' t':'fora do recorte'}</title></path>`).join('')}</svg><div id="map-readout" class="map-readout" role="status"><strong>Brasil · ${year}</strong><span>${isRegion?'Selecione uma região para abrir suas UFs':'Selecione uma UF para abrir seus municípios'}</span></div><div class="chart-legend">${Object.entries(regionColors).map(([name,color])=>`<span><i class="legend-dot" style="background:${color}"></i>${e(name)}</span>`).join('')}</div>`,{rows:features.map(({path,record,...shape})=>({...shape,...record})),queryIds:['production','geography'],note:'Malha oficial simplificada do IBGE. As cores identificam regiões; áreas cinza estão fora do recorte e não representam produção zero. Não há malha municipal nesta versão.'});
}
function municipalities(f,year){
  const records=scopeMunicipalities(queryRows('municipalities'),domainFilters(f),snapshot.metadata.products);
  const current=records.filter(row=>+row.year===year).map(row=>({...row,valuePerKg:row.tonnes>0&&row.valueReais!=null?row.valueReais/(row.tonnes*1000):null})).sort((a,b)=>(b.tonnes??-Infinity)-(a.tonnes??-Infinity));
  const selected=current.find(row=>row.code===municipalityCode);
  let content=`<div class="section-heading"><h2>Detalhamento municipal</h2><p>${number(current.filter(row=>row.tonnes>0).length)} municípios com produção no recorte</p></div>`;
  content+=tableCard('municipal-table','Consulta municipal',current,['municipality','uf','code','tonnes','valueReais','valuePerKg'].map(key=>({key})),{queryIds:['municipalities'],note:'Soma municipal respeitando ano, região, UF e produto. Pequenas diferenças em relação aos agregados originais estão documentadas nas fontes.',onSelect:row=>{municipalityCode=row.code;updateUrl();render();document.getElementById('municipal-history')?.scrollIntoView({block:'start',behavior:'smooth'});}});
  if(selected){const series=history(records.filter(row=>row.code===selected.code));content+=`<section id="municipal-history" class="municipal-detail"><div class="section-heading"><h2>${e(selected.municipality)} · ${e(selected.uf)}</h2><button data-action="close-municipality">Fechar detalhe</button></div><div class="chart-grid">${chartCard('municipal-production','Histórico da produção (t)',series,'line',{series:[{key:'tonnes',label:'Produção (t)'}],queryIds:['municipalities']})}${chartCard('municipal-value','Histórico do valor nominal (R$)',series,'line',{metric:'valueReais',series:[{key:'valueReais',label:'Valor nominal (R$)'}],queryIds:['municipalities']})}</div></section>`;}
  else content+='<p class="help-text">Selecione um município na tabela para abrir sua série histórica.</p>';
  return content;
}
function render(){
  hideTooltip();const focused=document.activeElement,focusId=focused?.id,selectionStart=focused?.selectionStart,selectionEnd=focused?.selectionEnd;
  const openedRanges=[...app.querySelectorAll('details[id][open]')].map(node=>node.id);
  charts=[];cards=new Map();
  const f=currentFilters(),year=f.end,source=queryRows('production');
  const all=domainFilters(f,true),scope=scopeProduction(source,all,page==='territory'&&f.uf!=='all'?'UF':f.region!=='all'?'GR':'BR');
  const regional=scopeProduction(source,all,page==='territory'&&f.uf!=='all'?'UF':'GR'),states=scopeProduction(source,all,'UF');
  const within=rows=>rows.filter(row=>+row.year>=f.start&&+row.year<=f.end);
  const products=comparisonRows(scope,'product',year),regions=comparisonRows(regional,'region',year),stateRows=comparisonRows(states,'place',year);
  const regionChoices=[{value:'all',label:'Todas'},...Object.keys(regionColors)];
  const stateChoices=[{value:'all',label:'Todas'},...queryRows('geography').filter(row=>row.level==='UF'&&(f.region==='all'||row.region===f.region)).sort((a,b)=>a.uf.localeCompare(b.uf)).map(row=>({value:row.uf,label:row.uf}))];
  const barProducts=products.filter(row=>row.tonnes!=null).slice(0,page==='overview'?6:8),valueProducts=[...products].filter(row=>row.valueReais!=null).sort((a,b)=>b.valueReais-a.valueReais).slice(0,8);
  let body=metrics(scope,year);
  if(page==='overview'){
    const annual=history(within(scope));
    body+=`<div class="section-heading"><h2>Evolução anual</h2></div><div class="chart-grid">${chartCard('production-history','Produção (t)',annual,'line',{series:[{key:'tonnes',label:'Produção (t)'}]})}${chartCard('value-history','Valor nominal da produção (R$)',annual,'line',{metric:'valueReais',series:[{key:'valueReais',label:'Valor nominal (R$)'}]})}</div><div class="section-heading"><h2>Distribuição da produção</h2></div><div class="chart-grid">${chartCard('regional-share','Participação das regiões na produção',regions,'pie',{note:'Proporção da produção no ano final selecionado. Fatias e legenda filtram a mesma região no menu.'})}${chartCard('leading-products','6 maiores produtos por produção (t)',barProducts,'bar')}</div>`;
  }
  if(page==='products'){
    const leading=products.slice(0,5).map(row=>row.label),annual=multiHistory(within(scope),'product',leading);
    body+=`<div class="section-heading"><h2>Composição por produto</h2></div><div class="chart-grid">${chartCard('product-volume','8 maiores produtos por produção (t)',barProducts,'bar')}${chartCard('product-value','8 maiores produtos por valor (R$)',valueProducts,'bar',{metric:'valueReais'})}</div>${tableCard('product-table','Indicadores por produto',products,comparisonColumns('Produto'))}<div class="section-heading"><h2>Trajetória dos principais produtos</h2></div>${chartCard('product-history','Produção anual dos 5 maiores produtos (t)',annual.rows,'line',{series:annual.series,note:'Produtos selecionados pela quantidade no ano final; a seleção permanece constante na série.'})}`;
  }
  if(page==='territory'){
    const annual=multiHistory(within(regional),'region',[...new Set(regional.map(row=>row.region))]);
    body+=`<div class="section-heading"><h2>Exploração territorial</h2><div class="segmented" role="group" aria-label="Nível territorial">${[['regions','Regiões'],['states','UFs'],['municipalities','Municípios']].map(([id,label])=>`<button data-level="${id}" aria-pressed="${level===id}">${label}</button>`).join('')}</div></div><div class="chart-grid">${mapCard(regions,stateRows,year)}${level==='regions'?chartCard('regional-share','Participação das regiões na produção',regions,'pie'):chartCard('state-production','10 maiores UFs por produção (t)',stateRows.filter(row=>row.tonnes!=null).slice(0,10),'bar',{dimension:'state'})}</div>`;
    body+=level==='municipalities'?municipalities(f,year):tableCard('territory-table',level==='regions'?'Indicadores por região':'Indicadores por UF',level==='regions'?regions:stateRows,comparisonColumns(level==='regions'?'Região':'UF'),{onSelect:row=>drill(row,level!=='regions')});
    body+=`<div class="section-heading"><h2>Evolução territorial</h2></div>${chartCard('regional-history','Evolução da produção por região (t)',annual.rows,'line',{series:annual.series})}`;
  }
  app.innerHTML=`<header class="site-header"><div class="header-main"><h1>${e(snapshot.title)}</h1><div class="header-tools"><button data-action="sources">Fontes e metodologia</button><button class="icon-button" data-action="theme" aria-label="Alternar tema claro e escuro" title="Alternar tema">◐</button><button class="icon-button" data-action="print" aria-label="Imprimir dashboard" title="Imprimir">⎙</button></div></div><nav aria-label="Páginas do dashboard">${Object.entries(pages).map(([id,label])=>`<button data-tab="${id}" ${id===page?'aria-current="page"':''}>${e(label)}</button>`).join('')}</nav></header>
  <main id="conteudo"><section class="filter-bar" aria-label="Filtros da página">${selectField('start','Ano inicial',snapshot.metadata.years,f.start)}${selectField('end','Ano final',snapshot.metadata.years,f.end)}${selectField('region','Região',regionChoices,f.region)}${selectField('product','Produto',[{value:'all',label:'Todos'},...snapshot.metadata.products],f.product)}${page==='territory'?selectField('uf','UF',stateChoices,f.uf):''}<button class="reset-button" data-action="reset">Limpar filtros</button></section><div class="view-context" aria-live="polite"><p>${e(f.region==='all'?'Brasil':f.region)}${page==='territory'&&f.uf!=='all'?' / '+e(f.uf):''} · Série ${f.start}–${f.end} · Indicadores de ${year} · ${e(f.product==='all'?'Todos os produtos disponíveis':f.product)}</p>${year===Math.max(...snapshot.metadata.years)?'<span class="preliminary">Resultado preliminar</span>':''}</div><div class="page-content">${body}</div><footer>Fonte: IBGE · Pesquisa da Pecuária Municipal · Tabela 3940 · Arquivo fornecido, ${Math.min(...snapshot.metadata.years)}–${Math.max(...snapshot.metadata.years)}. Valores monetários nominais. Totais dos 20 produtos selecionados no arquivo. <button data-action="sources">Consultar metodologia</button></footer></main>`;
  openedRanges.forEach(id=>{const node=document.getElementById(id);if(node)node.open=true;});
  charts.forEach(draw=>draw());
  if(focusId){const target=document.getElementById(focusId);target?.focus({preventScroll:true});if(typeof selectionStart==='number'&&target?.type==='search')target.setSelectionRange(selectionStart,selectionEnd);}
}
app.addEventListener('change',event=>{
  const target=event.target;
  if(target.dataset.filter){const key=target.dataset.filter,patch={[key]:['start','end'].includes(key)?+target.value:target.value};if(key==='start')patch.end=Math.max(+target.value,currentFilters().end);if(key==='end')patch.start=Math.min(+target.value,currentFilters().start);setFilters(patch);}
  if(target.dataset.range){const key=target.dataset.range;setFilters(key==='start'?{start:+target.value,end:Math.max(+target.value,currentFilters().end)}:{end:+target.value,start:Math.min(+target.value,currentFilters().start)});}
});
app.addEventListener('input',event=>{const target=event.target;if(target.dataset.range)target.parentElement.querySelector('output').value=target.value;if(target.dataset.tableSearch){const state=tables[target.dataset.tableSearch];state.search=target.value;state.page=0;render();}});
app.addEventListener('click',event=>{
  const target=event.target.closest('button');if(!target)return;
  if(target.dataset.tab){page=target.dataset.tab;views[page]??=defaultFilters(snapshot);tables={};updateUrl();render();window.scrollTo({top:0,behavior:'instant'});}
  if(target.dataset.level){level=target.dataset.level;municipalityCode=null;if(level==='regions')views[page]={...currentFilters(),uf:'all'};updateUrl();render();}
  if(target.dataset.sortTable){const state=tables[target.dataset.sortTable];state.direction=state.sort===target.dataset.key&&state.direction==='asc'?'desc':'asc';state.sort=target.dataset.key;state.page=0;render();}
  if(target.dataset.pageTable){tables[target.dataset.pageTable].page+=+target.dataset.direction;render();}
  const action=target.dataset.action;
  if(action==='reset'){views[page]=defaultFilters(snapshot);level='regions';municipalityCode=null;tables={};updateUrl();render();}
  if(action==='source')showSource(target.dataset.id);
  if(action==='sources')showSource();
  if(action==='csv'){const card=cards.get(target.dataset.id);downloadCsv(card.rows,`${card.id}-${currentFilters().end}.csv`,card.columns??Object.keys(card.rows[0]??{}).filter(key=>!['records','productData','path'].includes(key)).map(key=>({key,label:columnLabels[key]??key})));}
  if(action==='theme'){const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('aquicultura:theme',theme);}catch{}}
  if(action==='print')window.print();
  if(action==='close-municipality'){municipalityCode=null;updateUrl();render();}
});
window.addEventListener('popstate',()=>{level='regions';municipalityCode=null;readUrl();tables={};render();});
window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>charts.forEach(draw=>draw()),120);});
async function start(){
  try{
    const response=await fetch(new URL('../data/aquicultura.json',import.meta.url));if(!response.ok)throw new Error(`Não foi possível carregar os dados (${response.status}).`);
    snapshot=await response.json();
    if(!snapshot.queries?.production?.rows?.length||!snapshot.queries?.municipalities?.rows?.length||!snapshot.queries?.geography?.rows?.length)throw new Error('O arquivo de dados está incompleto.');
    Object.keys(pages).forEach(id=>views[id]=defaultFilters(snapshot));
    try{document.documentElement.dataset.theme=localStorage.getItem('aquicultura:theme')??(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}catch{document.documentElement.dataset.theme='light';}
    document.title=snapshot.title;readUrl();updateUrl(false);render();
  }catch(error){app.innerHTML=`<main class="loading"><h1>Produção aquícola · IBGE</h1><p role="alert">${e(error.message)}</p><p>Verifique se a pasta de dados foi incluída junto aos arquivos da aplicação.</p><button data-action="retry">Tentar novamente</button></main>`;app.querySelector('button').onclick=()=>location.reload();}
}
start();
