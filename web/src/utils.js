export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const regionColors={'Norte':'var(--c-teal)','Nordeste':'var(--c-ochre)','Centro-Oeste':'var(--c-slate)','Sudeste':'var(--c-sudeste)','Sul':'var(--c-green)'};
export const seriesColors={...regionColors,'Produção (t)':'var(--c-blue)','Valor nominal (R$)':'var(--c-teal)','Tilápia':'var(--c-blue)','Camarão':'var(--c-ochre)','Tambaqui':'var(--c-teal)','Tambacu, tambatinga':'var(--c-green)','Pintado, cachara, cachapira e pintachara, surubim':'var(--c-slate)'};
export const palette=['var(--c-blue)','var(--c-teal)','var(--c-green)','var(--c-ochre)','var(--c-slate)','var(--c-purple)','var(--c-brown)'];
export const normalize=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR');
export function csv(rows,columns=Object.keys(rows[0]??{}).map(key=>({key,label:key}))) {
  const quote=value=>{
    let text=String(value??'');
    if(typeof value==='string'&&/^[\s]*[=+@-]/.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  return '\ufeff'+[columns.map(c=>quote(c.label)).join(';'),...rows.map(row=>columns.map(c=>quote(row[c.key])).join(';'))].join('\r\n');
}
export function downloadCsv(rows,filename,columns) {
  const url=URL.createObjectURL(new Blob([csv(rows,columns)],{type:'text/csv;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
