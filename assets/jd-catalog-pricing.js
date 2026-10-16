/* One pricing hierarchy: product → model → exact variant; quote extras are separate. */
(function(root){
 'use strict';
 const has=(o,k)=>o?.[k]!==undefined&&o[k]!==null&&o[k]!=='';
 const pct=r=>r?.marginPct!=null?Number(r.marginPct):r?.divisor!=null?Math.round((1-Number(r.divisor))*10000)/100:null;
 const clean=o=>Object.fromEntries(['marginPct','extra'].filter(k=>has(o,k)).map(k=>[k,Number(o[k])]));
 function normalize(p,rules=[]){
  if(p.pricingVersion===1)return {...p,pricing:{...p.pricing},modelPricing:{...p.modelPricing}};
  let own=rules.filter(r=>r.product===p.name);
  if(!own.length&&/b612/i.test(p.supplier||'')&&(p.models||[]).some(m=>/^(Díptico|Tríptico|Cuadríptico)$/i.test(m)))own=rules.filter(r=>r.product==='Birkón · Folleto');
  const general=own.find(r=>r.variant==='*'),margins=own.map(pct).filter(x=>x!==null),counts=new Map();for(const n of margins)counts.set(n,(counts.get(n)||0)+1);
  const common=[...counts].sort((a,b)=>b[1]-a[1])[0]?.[0]??null;
  const pricing={marginPct:general?pct(general):common,extra:Number(general?.extra||0),...clean(p.pricing)},modelPricing={...p.modelPricing};
  for(const r of own.filter(r=>r.variant!=='*')){
   const entry={};if(pct(r)!==pricing.marginPct)entry.marginPct=pct(r);if(Number(r.extra||0)!==pricing.extra)entry.extra=Number(r.extra||0);
   if(Object.keys(entry).length)modelPricing[r.variant]={...entry,...clean(modelPricing[r.variant])};
  }
  return {...p,pricingVersion:1,pricing,modelPricing};
 }
 function resolve(p,v,rules=[],quoteExtra=0){
  const normalized=normalize(p,rules),general=clean(normalized.pricing),model=clean(normalized.modelPricing[v?.model||'']),variant=clean(v?.pricing),result={...general,...model,...variant};
  const extra=Number(quoteExtra||0);
  if(result.marginPct==null)return {error:'Definí la ganancia del producto o de esta variante en Productos & variantes.'};
  if(!Number.isFinite(result.marginPct)||result.marginPct<0||result.marginPct>=100)return {error:'Revisá la ganancia del producto o variante: debe estar entre 0% y menos de 100%.'};
  if(!Number.isFinite(extra)||extra<0||!Number.isFinite(Number(result.extra||0))||Number(result.extra||0)<0)return {error:'El adicional fijo debe ser un importe válido mayor o igual a cero.'};
  return {...result,extra:Number(result.extra||0)+extra,catalogExtra:Number(result.extra||0),quoteExtra:extra,source:has(variant,'marginPct')||has(variant,'extra')?'Variante':Object.keys(model).length?'Modelo':'Producto'};
 }
 function compatibility(p,rules=[],oldName=p.name){
  const result=rules.filter(r=>r.product!==oldName&&r.product!==p.name),old=rules.filter(r=>r.product===oldName||r.product===p.name);
  const add=(model,config)=>{if(config.marginPct==null)return;const previous=old.find(r=>r.variant===model);const r={...(previous||{}),id:previous?.id||'r-'+p.id+'-'+encodeURIComponent(model),product:p.name,variant:model,marginPct:Number(config.marginPct),extra:Number(config.extra||0)};delete r.divisor;result.push(r);};
  add('*',p.pricing||{});for(const [model,override] of Object.entries(p.modelPricing||{}))if(Object.keys(clean(override)).length)add(model,{...p.pricing,...clean(override)});
  return result;
 }
 const api={normalize,resolve,compatibility,clean,pct};if(root)root.JDCatalogPricing=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
