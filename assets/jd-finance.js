/* JD® · Caja y finanzas v1 · ONLY authenticated internal application.
 Historical rows remain read-only provisional snapshots; new costs/cobros are separate
 so they are never silently added twice to legacy costs. */
(function(){
"use strict";
const LEGACY="jd_finance_legacy_v1",MOVES="jd_finance_moves_v1";
const $=id=>document.getElementById(id);
const esc=v=>String(v??"").replace(/[&<>"']/g,x=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[x]));
const read=k=>{try{const v=JSON.parse(localStorage.getItem(k)||"[]");return Array.isArray(v)?v:[]}catch(e){return []}};
const fmt=(v,c)=>new Intl.NumberFormat("es-AR",{style:"currency",currency:c==="USD"?"USD":"ARS",maximumFractionDigits:0}).format(Number(v)||0)+(c==="USDT"?" USDT":"");
const date=()=>new Date().toLocaleDateString("en-CA");
const years=()=>Array.from({length:8},(_,i)=>String(2027-i));
const validAmount=x=>{const n=Number(String(x||"").trim().replace(",","."));return Number.isFinite(n)&&n>0?n:null};
const slug=s=>String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const CATS=["Imprenta","Uber / mensajería","Reimpresión / reparación","Materiales / terminación","Empaque","Software y suscripciones","Publicidad y marketing","Comisiones e impuestos","Servicio de diseño","Otros"];
const ROUTES=["Sin recorrido","Imprenta → JD","JD → cliente","Cliente → JD","JD → imprenta","Imprenta → cliente","Ida y vuelta","Otro"];
let state={year:"2026",currency:"ARS",query:"",tab:"historico",job:"",selected:""};
const jobs=()=>window.JDWorkflow?.jobs?.().filter(j=>!j.deletedAt)||[];
function classification(a){
 const v=slug(a.label);
 if(/adobe|claude|suscrip/.test(v))return"Software y suscripciones";
 if(/luaj/.test(v))return"Lúaj";
 if(/birk/.test(v))return"Birkonim";
 if(/abi iskandarani/.test(v))return"Abi · B2B";
 if(/hagad|simanim|sidur|tehil|perek shira/.test(v))return"Editoriales";
 return"Otros JD";
}
const total=(rows,k)=>rows.reduce((n,a)=>n+Number(a[k]||0),0);
function selectedLegacy(){return read(LEGACY).filter(a=>a.currency===state.currency&&String(a.date||"").slice(0,4)===state.year);}
function selectedMoves(){return read(MOVES).filter(a=>!a.voidAt&&a.currency===state.currency&&String(a.date||"").slice(0,4)===state.year);}
function selectOptions(items,current){return items.map(x=>'<option value="'+esc(x)+'"'+(x===current?' selected':'')+'>'+esc(x)+'</option>').join("");}
function status(){const all=read(LEGACY);const moves=read(MOVES);return {historical:all.length,manual:moves.length,unDated:all.filter(x=>!x.date).length};}
function render(){
 const root=$("finance");if(!root)return;
 const all=selectedLegacy(),moves=selectedMoves(),registered=all.filter(x=>x.classification!=="Software y suscripciones");
 const billed=total(registered,"revenue"),cost=total(registered,"cost"),fixed=total(all.filter(x=>x.classification==="Software y suscripciones"),"cost");
 const income=total(moves.filter(x=>x.kind==="Ingreso"&&x.status==="Realizado"),"amount");
 const expense=total(moves.filter(x=>x.kind==="Egreso"&&x.status==="Realizado"),"amount");
 const st=status();
 root.innerHTML='<div class="topbar"><div><div class="eyebrow">Gestión interna · Finanzas</div><h1>Caja y Finanzas</h1></div><div class="jd-fin-actions"><button class="btn primary" id="jdFinAdd">+ Registrar movimiento</button></div></div>'+
 '<p class="muted">Histórico importado con el desglose original de tu planilla. Los importes históricos son ingresos y costos anotados, <strong>NO cobros comprobados ni utilidad neta</strong>. Los nuevos cobros y egresos no se suman a ese histórico sin conciliación.</p>'+
 '<div class="jd-fin-filters"><label>Año <select id="jdFinYear">'+selectOptions(years(),state.year)+'</select></label><label>Moneda <select id="jdFinCurrency">'+selectOptions(["ARS","USD","USDT"],state.currency)+'</select></label><button class="btn" id="jdFinRefresh">Actualizar vista</button></div>'+
 '<div class="jd-fin-kpis">'+[
 ["Ingresos históricos identificados",billed,"No equivale a cobrado"],
 ["Costos históricos agrupados",cost+fixed,"Incluye software identificado"],
 ["Diferencia histórica parcial",billed-cost-fixed,"NO es ganancia neta"],
 ["Variación de caja verificada",income-expense,"Solo movimientos nuevos realizados, no saldo bancario"]
 ].map(x=>'<div class="jd-fin-kpi"><span>'+esc(x[0])+'</span><strong>'+fmt(x[1],state.currency)+'</strong><small>'+esc(x[2])+'</small></div>').join('')+'</div>'+
 '<div class="jd-fin-tabs"><button type="button" data-tab="historico" aria-pressed="'+(state.tab==="historico")+'">Histórico y gráficos</button><button type="button" data-tab="movimientos" aria-pressed="'+(state.tab==="movimientos")+'">Movimientos individuales</button><button type="button" data-tab="trabajos" aria-pressed="'+(state.tab==="trabajos")+'">Rentabilidad por trabajo</button></div>'+
 '<div id="jdFinBody"></div><p class="small muted">Fuente histórica: 2021–2026 · '+st.historical+' registros clasificados · '+st.unDated+' sin fecha válida. No se incluyen movimientos personales ni los que requieren clasificación manual. Los gastos con valor agregado permanecen sin desglosar hasta que se registren sus componentes.</p>';
 $("jdFinYear").onchange=e=>{state.year=e.target.value;render()};
 $("jdFinCurrency").onchange=e=>{state.currency=e.target.value;render()};
 $("jdFinRefresh").onclick=render;
 $("jdFinAdd").onclick=()=>openEditor();
 root.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{state.tab=b.dataset.tab;render()});
 if(state.tab==="historico")renderHistorical(all);
 if(state.tab==="movimientos")renderMoves(moves);
 if(state.tab==="trabajos")renderJobs();
}
function renderHistorical(all){
 const groups=new Map(),monthly=Array.from({length:12},(_,i)=>({month:i,rev:0,cost:0}));
 for(const a of all){
  const cat=a.classification||classification(a),g=groups.get(cat)||{name:cat,rev:0,cost:0,count:0};g.rev+=Number(a.revenue||0);g.cost+=Number(a.cost||0);g.count++;groups.set(cat,g);
  const m=Number((a.date||"").slice(5,7))-1;if(m>=0&&m<12){monthly[m].rev+=Number(a.revenue||0);monthly[m].cost+=Number(a.cost||0)}
 }
 const max=Math.max(1,...monthly.map(a=>Math.max(a.rev,a.cost))),months=["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
 const rows=all.filter(a=>!state.query||slug(a.label).includes(slug(state.query))).sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,160);
 $("jdFinBody").innerHTML='<section class="jd-fin-panel"><h2>Evolución mensual (importes nominales)</h2><p class="small muted">Evolución de registros, no flujo de caja ni comparación ajustada por inflación. Las barras de ingresos y costos están en la misma escala.</p><div class="jd-fin-legend"><span>■ Ingresos</span><span>■ Costos</span></div><div class="jd-fin-chart">'+monthly.map(a=>'<div class="jd-fin-chart-col" title="'+months[a.month]+' · Ingresos '+fmt(a.rev,state.currency)+' · Costos '+fmt(a.cost,state.currency)+'"><div class="jd-fin-bars"><i class="rev" style="height:'+Math.max(0,a.rev/max*100)+'%"></i><i class="cost" style="height:'+Math.max(0,a.cost/max*100)+'%"></i></div><small>'+months[a.month]+'</small></div>').join("")+'</div></section>'+
 '<section class="jd-fin-panel"><h2>¿En qué se concentra el negocio?</h2><div class="jd-fin-scroll"><table class="table"><thead><tr><th>Rubro</th><th>Registros</th><th>Ingresos</th><th>Costos anotados</th><th>Diferencia parcial</th></tr></thead><tbody>'+[...groups.values()].sort((a,b)=>b.rev-a.rev).map(a=>'<tr><td>'+esc(a.name)+'</td><td>'+a.count+'</td><td>'+fmt(a.rev,state.currency)+'</td><td>'+fmt(a.cost,state.currency)+'</td><td>'+fmt(a.rev-a.cost,state.currency)+'</td></tr>').join("")+'</tbody></table></div></section>'+
 '<section class="jd-fin-panel"><div class="jd-fin-bar"><h2>Historial de JD · sin desglose</h2><input id="jdFinSearch" type="search" placeholder="Buscar cliente o producto" value="'+esc(state.query)+'"/></div><div class="jd-fin-scroll"><table class="table"><thead><tr><th>Fecha</th><th>Trabajo / concepto</th><th>Ingreso</th><th>Costo conjunto</th><th>Origen</th></tr></thead><tbody>'+rows.map(a=>'<tr><td>'+esc(a.date||"Sin fecha")+'</td><td>'+esc(a.label)+'</td><td>'+fmt(a.revenue,state.currency)+'</td><td>'+fmt(a.cost,state.currency)+'</td><td><small>'+esc(a.source?.sheet||"Histórico")+' / '+esc(a.source?.row||"")+'</small></td></tr>').join("")+'</tbody></table></div><small>Mostrando como máximo 160 registros del período. Ningún gasto de Uber ha sido separado artificialmente del costo conjunto.</small></section>';
 $("jdFinSearch").oninput=e=>{state.query=e.target.value;const pos=e.target.selectionStart;render();$("jdFinSearch")?.focus();try{$("jdFinSearch").setSelectionRange(pos,pos)}catch{}};
}
function renderMoves(moves){
 let q=slug(state.query);
 const rows=moves.filter(a=>!q||slug([a.category,a.detail,a.provider,a.jobTitle].join(" ")).includes(q)).sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 const typeOptions=jobs();
 $("jdFinBody").innerHTML='<section class="jd-fin-panel"><div class="jd-fin-bar"><h2>Movimientos individuales</h2><input id="jdFinSearch" type="search" placeholder="Buscar costo, proveedor o pedido" value="'+esc(state.query)+'"/></div>'+
 '<p class="small muted">Cada Uber, flete, impresión, reimpresión o cobro se registra por separado y puede asociarse con un trabajo. Si corresponde a un costo histórico ya sumado, marcarlo como «incluido en registro anterior» para conciliarlo, evitando contarlo dos veces.</p>'+
 '<div class="jd-fin-scroll"><table class="table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Trabajo</th><th>Movimiento</th><th>Importe</th><th>Estado</th><th></th></tr></thead><tbody>'+
 rows.map(a=>'<tr><td>'+esc(a.date)+'</td><td><b>'+esc(a.category||"")+'</b><small>'+esc(a.detail||"")+' · '+esc(a.provider||"")+'</small></td><td>'+esc(a.jobTitle||"Sin asociar")+'</td><td>'+esc(a.kind)+'</td><td>'+fmt(a.amount,a.currency)+'</td><td>'+esc(a.status||"")+(a.legacyOverlap?'<small>En costo histórico · conciliar</small>':'')+'</td><td><button class="btn sm" data-edit="'+esc(a.id)+'">Editar</button></td></tr>').join("")+
 '</tbody></table></div><p class="small muted">Movimientos activos '+rows.length+'. No incluyen automáticamente ventas o cobros históricos.</p></section>';
 $("jdFinSearch").oninput=e=>{state.query=e.target.value;const pos=e.target.selectionStart;render();$("jdFinSearch")?.focus();try{$("jdFinSearch").setSelectionRange(pos,pos)}catch{}};
 $("jdFinBody").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>openEditor(b.dataset.edit));
}
function renderJobs(){
 const jj=jobs(),l=read(LEGACY),mv=read(MOVES).filter(a=>!a.voidAt);
 const options=jj.map(j=>'<option value="'+esc(j.id)+'"'+(j.id===state.job?' selected':'')+'>'+esc((read("jd_clients").find(c=>c.id===j.clientId)?.name||"")+' · '+j.title)+'</option>').join("");
 const selected=jj.find(j=>j.id===state.job),detail=selected?mv.filter(m=>m.jobId===selected.id):[],valid=detail.filter(m=>m.status==="Realizado");
 const rev=total(valid.filter(m=>m.kind==="Ingreso"),"amount"),cost=total(valid.filter(m=>m.kind==="Egreso"),"amount");
 $("jdFinBody").innerHTML='<section class="jd-fin-panel"><h2>Costos reales por proyecto</h2><p class="small muted">Seleccioná un pedido. No asignamos automáticamente la fila histórica por parecido de nombre: primero hay que conciliarla, porque puede incluir adelantos y gastos que no son del proyecto actual.</p><label>Trabajo registrado <select id="jdFinJobChoice"><option value="">Elegí un proyecto…</option>'+options+'</select></label>'+
 (selected?'<div class="jd-fin-kpis"><div class="jd-fin-kpi"><span>Cobros detallados</span><strong>'+fmt(rev,state.currency)+'</strong></div><div class="jd-fin-kpi"><span>Egresos detallados</span><strong>'+fmt(cost,state.currency)+'</strong></div><div class="jd-fin-kpi"><span>Diferencia detallada</span><strong>'+fmt(rev-cost,state.currency)+'</strong><small>Solo importes nuevos realizados de la moneda elegida; NO es margen total del pedido.</small></div></div><button id="jdFinJobAdd" class="btn primary">+ Costo o cobro de este trabajo</button><div class="jd-fin-scroll"><table class="table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Importe</th><th>Estado</th></tr></thead><tbody>'+
 detail.filter(x=>x.currency===state.currency).map(x=>'<tr><td>'+esc(x.date)+'</td><td>'+esc(x.category)+' · '+esc(x.detail)+'</td><td>'+fmt(x.amount,x.currency)+'</td><td>'+esc(x.status)+'</td></tr>').join("")+'</tbody></table></div>':'<p class="muted">Seleccioná un trabajo para registrar costos separados de imprenta, Uber, correcciones, software asignable y otros.</p>')+'</section>';
 $("jdFinJobChoice").onchange=e=>{state.job=e.target.value;render()};
 if(selected)$("jdFinJobAdd").onclick=()=>openEditor(null,selected.id);
}
function openEditor(id,jobId){
 const existing=read(MOVES).find(a=>a.id===id)||null,x=existing||{};
 const arr=jobs(),opts=arr.map(j=>'<option value="'+esc(j.id)+'"'+(j.id===(jobId||x.jobId)?' selected':'')+'>'+esc((read("jd_clients").find(c=>c.id===j.clientId)?.name||"")+' · '+j.title)+'</option>').join("");
 const form=document.createElement("div");form.className="jd-fin-modal";form.setAttribute("role","dialog");form.setAttribute("aria-modal","true");
 form.innerHTML='<div class="jd-fin-dialog"><div class="jd-fin-bar"><h2>'+(existing?"Editar":"Registrar")+' movimiento</h2><button class="btn" data-close>Cerrar</button></div><div class="jd-fin-form">'+
 '<label>Fecha<input id="finDate" type="date" value="'+esc(x.date||date())+'"></label>'+
 '<label>Tipo<select id="finKind">'+selectOptions(["Egreso","Ingreso"],x.kind||"Egreso")+'</select></label>'+
 '<label>Moneda<select id="finCurrency">'+selectOptions(["ARS","USD","USDT"],x.currency||state.currency)+'</select></label>'+
 '<label>Importe<input id="finAmount" inputmode="decimal" type="number" min="0.01" step="0.01" value="'+esc(x.amount||"")+'"></label>'+
 '<label>Rubro<select id="finCategory">'+selectOptions(CATS,x.category||"Imprenta")+'</select></label>'+
 '<label>Estado<select id="finStatus">'+selectOptions(["Realizado","Pendiente"],x.status||"Realizado")+'</select></label>'+
 '<label>Trabajo<select id="finJob"><option value="">Sin asociar (gasto general)</option>'+opts+'</select></label>'+
 '<label>Proveedor / transportista<input id="finSupplier" value="'+esc(x.provider||"")+'" placeholder="Zloto, Uber, otra imprenta…"></label>'+
 '<label>Recorrido (si corresponde)<select id="finRoute">'+selectOptions(ROUTES,x.route||"Sin recorrido")+'</select></label>'+
 '<label class="span2">Descripción / motivo<textarea id="finDetail" rows="2" placeholder="Ej.: Uber desde Zloto hasta casa; reimpresión de tapa">'+esc(x.detail||"")+'</textarea></label>'+
 '<label class="span2">Comprobante o referencia<input id="finEvidence" value="'+esc(x.evidence||"")+'" placeholder="Factura, mensaje, remito o referencia"></label>'+
 '<label class="jd-fin-check span2"><input type="checkbox" id="finLegacy" '+(x.legacyOverlap?'checked':'')+'> Está incluido en el costo agrupado de un registro histórico (pendiente de conciliación; no duplicar).</label>'+
 '</div><p class="small muted">No borres gastos que ya están contabilizados: al editar conservamos una traza de cambios. El saldo real de caja exige balance inicial y conciliación bancaria.</p><div class="jd-fin-bar"><span id="finError" class="jd-fin-error" role="alert"></span><div><button class="btn" data-cancel>Cancelar</button> <button class="btn primary" data-save>Guardar movimiento</button></div></div></div>';
 document.body.append(form);
 const f=id=>form.querySelector("#"+id),close=()=>form.remove();
 form.querySelector("[data-close]").onclick=close;form.querySelector("[data-cancel]").onclick=close;
 form.querySelector("[data-save]").onclick=async()=>{
  const btn=form.querySelector("[data-save]"),amount=validAmount(f("finAmount").value),d=f("finDate").value;
  if(!amount||!d){f("finError").textContent="Indicá fecha e importe positivo.";return}
  const jb=arr.find(z=>z.id===f("finJob").value);
  const item={...x,id:x.id||"fin-"+crypto.randomUUID(),date:d,kind:f("finKind").value,currency:f("finCurrency").value,amount,category:f("finCategory").value,status:f("finStatus").value,jobId:jb?.id||null,jobTitle:jb?.title||"",provider:f("finSupplier").value.trim(),route:f("finRoute").value,detail:f("finDetail").value.trim(),evidence:f("finEvidence").value.trim(),legacyOverlap:f("finLegacy").checked,updatedAt:new Date().toISOString(),history:[...(x.history||[])]};
  if(existing)item.history.push({at:item.updatedAt,type:"Edición",before:{amount:x.amount,date:x.date,category:x.category,jobId:x.jobId,status:x.status}});
  else item.createdAt=item.updatedAt;
  btn.disabled=true;f("finError").textContent="";
  try{
   await window.jdUpdateSharedState([MOVES],current=>{
    const list=Array.isArray(current[MOVES])?current[MOVES]:[];
    const prev=list.find(a=>a.id===item.id)||null;
    if(JSON.stringify(prev)!==JSON.stringify(existing))throw new Error("Este movimiento cambió desde otro dispositivo. Actualizá la vista.");
    return {[MOVES]:prev?list.map(a=>a.id===item.id?item:a):[...list,item]};
   });close();render();
  }catch(e){f("finError").textContent=e.message||"No se pudo guardar";btn.disabled=false}
 };
}
function init(){if(!$("finance"))return;render()}
window.JDFinance={render,openEditor,openForJob:id=>{state.tab="trabajos";state.job=id;window.go?.("finance");render();}};
document.addEventListener("jd-app-ready",init);
window.addEventListener("jd-shared-ready",()=>{if($("finance")?.classList.contains("active"))render()});
if(document.readyState!=="loading")setTimeout(init,0);else document.addEventListener("DOMContentLoaded",init);
})();