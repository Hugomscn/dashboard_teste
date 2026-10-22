// Query loading is generic: new datasets only require a descriptor in catalog.json.
export async function createDataStore(base,fetcher=fetch){
  const read=async file=>{const response=await fetcher(new URL(file,base));if(!response.ok)throw new Error(`Não foi possível carregar os dados (${response.status}).`);return response.json();};
  const catalog=await read('catalog.json'),pending=new Map();
  const snapshot={...catalog,queries:Object.fromEntries(Object.entries(catalog.queries).map(([id,q])=>[id,{...q,rows:[]}]))};
  const ensure=id=>{
    if(!catalog.queries[id])return Promise.reject(new Error(`Conjunto desconhecido: ${id}`));
    if(!pending.has(id))pending.set(id,read(catalog.queries[id].file).then(rows=>{
      if(!Array.isArray(rows)||rows.length!==catalog.queries[id].rowCount)throw new Error(`Dados incompletos: ${id}`);
      snapshot.queries[id].rows=rows;return rows;
    }).catch(error=>{pending.delete(id);throw error;}));
    return pending.get(id);
  };
  await Promise.all(Object.entries(catalog.queries).filter(([,q])=>q.preload).map(([id])=>ensure(id)));
  return {snapshot,ensure};
}
