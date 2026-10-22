import {sum} from './model.js';

// Wording supplied for the group-composition notes, kept independently of calculations.
export const compositionNotes={
  origin:[
    'São considerados como peixes Exóticos:Carpa, Tilápia, Truta, Camarão, Ostras, vieiras e mexilhões.',
    'São considerados como peixes Nativos: Curimatã, curimbatá, Dourado, Jatuarana, piabanha, piracanjuba, Lambari, Matrinxã, Pacu, patinga, Piau, piapara, piauçu, piava, Pintado, cachara, cachapira e pintachara, surubim, Pirapitinga, Pirarucu, Tambacu, tambatinga, Tambaqui, Traíra, trairão e Tucunaré.',
    'São considerados como outros: Outros peixes (IBGE).'
  ],
  tilapia:[
    'São considerados como peixes Nativos: Pacu, patinga, Pirapitinga, Tambacu, tambatinga e Tambaqui.',
    'São considerados como outros: Curimatã, curimbatá, Dourado, Jatuarana, piabanha, piracanjuba, Lambari, Matrinxã, Piau, piapara, piauçu, piava, Pintado, cachara, cachapira e pintachara, surubim, Pirarucu, Traíra, trairão, Tucunaré, Carpa, Truta, Outros peixes, Camarão, Ostras, vieiras e mexilhões.'
  ]
};

// These are analytical groupings from CIAqui, not a new biological taxonomy.
const exotic=['Carpa','Tilápia','Truta','Camarão','Ostras, vieiras e mexilhões'];
const round=['Pacu e patinga','Pirapitinga','Tambacu, tambatinga','Tambaqui'];
const nativeOther=['Curimatã, curimbatá','Dourado','Jatuarana, piabanha e piracanjuba','Lambari','Matrinxã','Piau, piapara, piauçu, piava','Pintado, cachara, cachapira e pintachara, surubim','Pirarucu','Traíra e trairão','Tucunaré'];
const known=new Set([...exotic,...round,...nativeOther,'Outros peixes']);
export const themes={
  aquaculture:{title:'Aquicultura',groups:['Peixes','Camarões','Ostras, vieiras e mexilhões'],classify:p=>!known.has(p)?null:p==='Camarão'?'Camarões':p==='Ostras, vieiras e mexilhões'?p:'Peixes'},
  origin:{title:'Nativos × Exóticos',groups:['Nativos','Exóticos','Outros'],classify:p=>!known.has(p)?null:p==='Outros peixes'?'Outros':exotic.includes(p)?'Exóticos':'Nativos'},
  tilapia:{title:'Tilápia × Redondos',groups:['Tilápia','Redondos','Outros'],classify:p=>!known.has(p)?null:p==='Tilápia'?'Tilápia':round.includes(p)?'Redondos':'Outros'}
};
export function themeDefinitions(id,products){
  const theme=themes[id];
  const definitions=theme.groups.map(label=>({label,products:products.filter(p=>theme.classify(p)===label)}));
  const unclassified=products.filter(p=>theme.classify(p)===null);
  if(unclassified.length)definitions.push({label:'Não classificado',products:unclassified});
  return definitions;
}
export function thematicHistory(rows,id,years,products,metric='tonnes'){
  const definitions=themeDefinitions(id,products),byYear=new Map();
  for(const row of rows){if(!byYear.has(+row.year))byYear.set(+row.year,[]);byYear.get(+row.year).push(row);}
  const series=definitions.map((g,i)=>({key:'group'+i,label:g.label}));
  const history=years.map(year=>{
    const current=byYear.get(+year)??[],result={year:String(year)};
    definitions.forEach((g,i)=>{
      const records=current.filter(row=>g.products.includes(row.product));
      // Missing categories must not silently become zero or inflate the other shares.
      result['group'+i]=g.products.every(p=>records.some(r=>r.product===p&&Number.isFinite(r[metric])))?sum(records,metric):null;
    });
    result.total=series.every(s=>Number.isFinite(result[s.key]))?series.reduce((total,s)=>total+result[s.key],0):null;
    series.forEach(s=>result[s.key+'Share']=result.total>0?result[s.key]/result.total:null);
    return result;
  });
  const exportRows=history.flatMap(row=>series.map(s=>({year:row.year,group:s.label,[metric]:row[s.key],[metric==='tonnes'?'productionShare':'valueShare']:row[s.key+'Share'],total:row.total})));
  return {rows:history,series,exportRows,definitions};
}
