import {readFile,writeFile} from 'node:fs/promises';
import {normalize} from '../web/src/utils.js';
const root=new URL('../',import.meta.url);
const source=JSON.parse(await readFile(new URL('data/tilapia-poles-membership.json',root),'utf8'));
const data=JSON.parse(await readFile(new URL('data/aquicultura.json',root),'utf8'));
const municipal=[...new Map(data.queries.municipalities.rows.map(r=>[r.code,r])).values()];
const rows=source.poles.map(p=>{
  const codes=p.municipalities.map(name=>{
    const matches=municipal.filter(r=>p.states.includes(r.uf)&&normalize(r.municipality.replace(/ \([A-Z]{2}\)$/,''))===normalize(name));
    if(!matches.length){
      const absent=source.membersAbsentFromLocalData?.find(m=>p.states.includes(m.uf)&&normalize(m.name)===normalize(name));
      if(absent)return absent.code;
    }
    if(matches.length!==1)throw new Error(`${p.label}: ${name}: ${matches.length} correspondências; conferir a fonte antes de continuar.`);
    return matches[0].code;
  });
  return {...p,codes,unavailableMembers:(source.membersAbsentFromLocalData??[]).filter(m=>codes.includes(m.code)&&!municipal.some(row=>row.code===m.code))};
});
const output={rows,source:{label:'Embrapa · CIAqui · composição dos polos de tilápia',provider:'Consulta visual ao painel público Produocompleto/Modelo2',executedAt:source.observedAt,files:['tilapia-poles-membership.json'],links:[{label:'Produção brasileira · CIAqui',href:source.sourceUrl},{label:'Painel público da Embrapa',href:source.workbookUrl}],caveats:['Composição observada em 20/10/2026, com nível Polos de Tilápia e ano 2025 selecionados. Não é uma delimitação legal ou uma série histórica de limites dos polos.','O cadastro conserva os nomes e associações exibidos no painel, inclusive municípios fora da UF sugerida pelo nome do polo.','A composição consultada é aplicada a todos os anos da base local; municípios não observados na consulta podem não estar incluídos.','Os valores são calculados exclusivamente da planilha local, para Tilápia; não foram copiados os totais do painel.','Todos os polos cadastrados representa a união dos códigos IBGE, sem duplicação, e não a produção nacional.'],evidenceFlow:[{title:'Consulta',detail:'Página Embrapa → primeiro painel Tableau → Nível de visualização: Polos de Tilápia → Ano 2025 → clicar em cada um dos 11 polos → registrar a lista Municipios.'},{title:'Vinculação',detail:'Executar node scripts/prepare-poles.mjs. Vincular nome normalizado e UF ao código IBGE da base local; falhar se faltar correspondência ou houver ambiguidade. Os estados são usados para desambiguar nomes, sem delimitar o polo pelo seu título.'},{title:'Cálculos',detail:'Decodificar a categoria Tilápia em productData; somar municípios cadastrados por ano. Ausências e zeros seguem as regras da base original.'}]}};
if(rows.some(p=>p.unavailableMembers.length))output.source.caveats.push('Wenceslau Braz (PR), código 4128500, consta no polo Norte do Paraná, mas não possui registros na base local. Totais desse polo somam somente os municípios disponíveis; ausência não é zero.');
output.source.links.push(...(source.membersAbsentFromLocalData??[]).map(m=>({label:`IBGE · ${m.name} (${m.uf}) · ${m.code}`,href:m.sourceUrl})));
await writeFile(new URL('data/tilapia-poles.json',root),JSON.stringify(output,null,2));
console.log(`${rows.length} polos; ${new Set(rows.flatMap(p=>p.codes)).size} municípios vinculados por código IBGE.`);
