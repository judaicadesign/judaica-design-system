/* Confirmed supplier prices only. Inflation estimates remain separate metadata. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.JDCostHistory=api;})(typeof window==='object'?window:null,function(){
 'use strict';
 const fields=['supplier','product','variant','size','binding','pages','qty','cost','date'];
 const signature=c=>JSON.stringify(fields.slice(0,7).map(k=>String(c?.[k]??'')));
 function update(previous,next,at=new Date().toISOString()){
  if(!previous)return {...next,history:[]};
  const changed=fields.some(k=>String(previous[k]??'')!==String(next[k]??''));
  if(!changed)return {...previous,...next};
  const {history,...snapshot}=previous;
  const value={...previous,...next,history:[...(Array.isArray(history)?history:[]),{...snapshot,supersededAt:at}],updatedAt:at};
  // A confirmed quote replaces the active estimate, not the historical evidence.
  delete value.adjustment;return value;
 }
 function entries(current){
  const records=[...(Array.isArray(current.history)?current.history:[]).map(c=>({...c,current:false})),{...current,current:true}];
  records.sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
  const last=new Map();return records.map(c=>{const key=signature(c),p=last.get(key);const valid=Number.isFinite(Number(c.cost))&&Number(c.cost)>0;
   const changePct=valid&&p&&Number(p.cost)>0?(Number(c.cost)/Number(p.cost)-1)*100:null;
   if(valid)last.set(key,c);return {...c,changePct};
  });
 }
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>'$ '+Number(n||0).toLocaleString('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
 function render(current){
  const rows=entries(current),same=rows.filter(c=>signature(c)===signature(current));
  const initial=same.find(c=>!c.current&&c.date&&c.date<=current.date),pct=initial&&Number(initial.cost)>0?(Number(current.cost)/Number(initial.cost)-1)*100:null;
  const format=p=>(p>0?'+':'')+p.toLocaleString('es-AR',{maximumFractionDigits:2})+'%';
  return '<details class="jd-cost-history" style="margin-top:18px"><summary>Historial de precios · '+rows.filter(c=>!c.current).length+' antecedentes</summary><p class="small muted">Precios confirmados de imprenta, sin aplicar estimaciones por inflación. Solo se comparan fichas técnicas y cantidades iguales. Los cambios sin guardar todavía no figuran aquí.</p>'+(pct===null?'':'<p class="small"><b>Variación acumulada: '+format(pct)+'</b> desde '+esc(initial.date||'fecha desconocida')+'. No equivale al IPC.</p>')+'<div class="jd-table-scroll"><table class="table"><thead><tr><th>Fecha del precio</th><th>Ficha / cantidad</th><th>Costo confirmado</th><th>Variación</th><th>Estado</th></tr></thead><tbody>'+rows.map(c=>'<tr><td>'+esc(c.date||'Sin fecha')+'</td><td>'+esc([c.supplier,c.product,c.variant,c.size,c.binding,c.pages?c.pages+' páginas':'',c.qty+' unidades'].filter(Boolean).join(' · '))+'</td><td>'+money(c.cost)+'</td><td>'+(c.changePct===null?'Sin antecedente comparable':format(c.changePct))+'</td><td>'+(c.current?'Vigente':'Antecedente')+'</td></tr>').join('')+'</tbody></table></div><p class="small muted">Al guardar un nuevo precio se conserva el anterior con su fecha. Las cotizaciones anteriores a la incorporación del historial solo estarán disponibles si se conservaron por otro medio.</p></details>';
 }
 return {update,entries,signature,render};
});
