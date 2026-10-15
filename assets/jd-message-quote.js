/* Existing authenticated B612 endpoint and existing quote/PDF workflow. */
(function(){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>Number(n).toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2});
 function mount(){
  const host=document.getElementById(window.jdPrintRequest?'jdLegacyQuoteTool':'jdMessageQuoteTool'),bridge=window.jdB612Assistant,parser=window.jdMessageRequest;
  if(!host||host.dataset.mounted||!bridge||!parser)return;
  host.dataset.mounted='true';host.className='card jd-message-tool';
  const catalog=parser.catalogWithProfiles(bridge.catalog()).filter(p=>p.status==='Activo'&&/b612/i.test(p.supplier||'')&&p.models?.some(m=>parser.formats.includes(m)));
  host.innerHTML='<h2>Pegá el pedido de Abi</h2><p>Primero vamos a comprobar el presupuesto de imprenta: artículos, refilado, doblez, costo neto, IVA y total B612. Esta etapa no aplica reglas de Judaica Design.</p><p class="small muted">Lectura asistida de datos explícitos. Revisá las preguntas y confirmá la ficha. La conexión actual admite dípticos, trípticos y cuadrípticos de ilustración 300 g, full color, doble faz y laminado mate. Cantidades variables de 1 a 40.000 unidades. La ficha Misjag se reconoce como referencia recurrente; su tarifa B&N está pendiente de conexión.</p><div class="field"><label for="jdRequestText">Mensaje recibido</label><textarea id="jdRequestText" rows="4" maxlength="12000" placeholder="Ej.: 50 cuadrípticos de Birkón, 2 diseños. Abierto 391 × 190 mm, cerrado 100 × 190 mm."></textarea></div><button class="btn" type="button" id="jdReadRequest">Leer datos del mensaje</button><p id="jdRequestStatus" role="status" aria-live="polite" class="small"></p><div id="jdRequestReview" hidden><div class="form-grid"><div class="field"><label for="jdRequestProduct">Producto del catálogo</label><select id="jdRequestProduct"><option value="">Confirmar producto…</option>'+catalog.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.name)+'</option>').join('')+'</select></div><div class="field"><label for="jdRequestFormat">Formato</label><select id="jdRequestFormat"><option value="">Confirmar formato…</option>'+parser.formats.map(f=>'<option>'+f+'</option>').join('')+'</select></div><div class="field"><label for="jdRequestQuantities">Cantidades (separadas por coma)</label><input id="jdRequestQuantities" inputmode="numeric" placeholder="150, 200, 300"></div><div class="field"><label for="jdRequestModels">Diseños distintos</label><input id="jdRequestModels" type="number" min="1" max="20" placeholder="Confirmar"></div>'+Object.entries(parser.labels).map(([key,label])=>'<div class="field"><label for="jdRequest-'+key+'">'+esc(label)+(key.endsWith('Mm')?' (mm)':'')+'</label><input id="jdRequest-'+key+'" '+(/Mm$|Gsm$/.test(key)?'type="number" min="0.1" step="0.1"':'')+'><small class="muted" id="jdRequestOrigin-'+key+'"></small></div>').join('')+'</div><label class="jd-checkline" style="margin:14px 0"><input type="checkbox" id="jdRequestChecked"> Revisé cantidades, diseños, medidas y materiales.</label><button class="btn primary" type="button" id="jdRequestQuote">Consultar B612 ahora</button><p id="jdRequestQuoteStatus" role="status" aria-live="polite" class="small"></p></div><div id="jdRequestResults" hidden></div><div id="jdSavedB612"></div>';
  if(window.jdPrintRequest)for(const child of host.children)if(!['jdRequestResults','jdSavedB612','jdRequestStatus'].includes(child.id))child.hidden=true;
  const field=id=>host.querySelector('#'+id);let revision=0,request=null,quoted=null,baseline=null;
  const status=s=>{field('jdRequestStatus').textContent=s;field('jdRequestQuoteStatus').textContent=s;};
  const invalidate=()=>{revision++;quoted=null;field('jdRequestResults').hidden=true;field('jdRequestChecked').checked=false;};
  const read=()=>({productId:field('jdRequestProduct').value,format:field('jdRequestFormat').value,quantities:field('jdRequestQuantities').value.split(/[,;/]/).map(s=>s.trim()).filter(Boolean).map(Number),models:field('jdRequestModels').value?Number(field('jdRequestModels').value):null,spec:Object.fromEntries(Object.keys(parser.labels).map(k=>[k,field('jdRequest-'+k).value]))});
  function fillSpecs(value){
   try{const resolved=parser.resolve(value,catalog);for(const key of Object.keys(parser.labels)){field('jdRequest-'+key).value=resolved.spec[key];field('jdRequestOrigin-'+key).textContent=resolved.origins[key]==='catálogo'?'Del catálogo · revisá que coincida':resolved.origins[key]==='mensaje'?'Del mensaje':resolved.origins[key]==='referencia'?'De la ficha recurrente · revisá que coincida':'Falta confirmar';}}
   catch{for(const key of Object.keys(parser.labels)){field('jdRequest-'+key).value=value.spec?.[key]??'';field('jdRequestOrigin-'+key).textContent='Confirmar';}}
  }
  field('jdRequestText').addEventListener('input',()=>{invalidate();field('jdRequestReview').hidden=true;status('Volvé a leer los datos del mensaje actualizado.');});
  field('jdReadRequest').onclick=()=>{
   try{invalidate();request=parser.extract(field('jdRequestText').value,catalog);field('jdRequestProduct').value=request.productId;field('jdRequestFormat').value=request.format;field('jdRequestQuantities').value=request.quantities.join(', ');field('jdRequestModels').value=request.models??'';fillSpecs(request);field('jdRequestReview').hidden=false;const questions=[];if(request.productId==='b612-reference-misjag')questions.push('Ficha recurrente Misjag: cantidades independientes. Revisá medida cerrada y confirmá si lleva laminado. Tarifa B&N pendiente de conexión.');if(!request.productId)questions.push('¿Qué producto querés imprimir?');if(!request.format)questions.push('¿Díptico, tríptico o cuadríptico?');if(!request.quantities.length)questions.push('¿Cuántas unidades necesitás?');if(!request.models)questions.push('¿Cuántos diseños distintos tiene la tirada?');status([...request.warnings,...questions].join(' ')||'Revisá la ficha y las especificaciones tomadas del catálogo.');}
   catch(error){status(error.message);}
  };
  field('jdRequestReview').addEventListener('input',event=>{if(event.target.id!=='jdRequestChecked'){invalidate();if(event.target.id.startsWith('jdRequest-'))field('jdRequestOrigin-'+event.target.id.slice(10)).textContent='Confirmado manualmente';}});
  for(const id of ['jdRequestProduct','jdRequestFormat'])field(id).addEventListener('change',()=>{invalidate();fillSpecs({...read(),spec:request?.spec||{}});});
  field('jdRequestQuote').onclick=async()=>{
   const button=field('jdRequestQuote'),version=revision;
   try{
    if(!document.body.classList.contains('jd-authenticated'))throw Error('Ingresá al sistema para consultar.');
    if(!field('jdRequestChecked').checked)throw Error('Revisá y confirmá la ficha antes de consultar B612.');
    const values=read();parser.validate(values,catalog);button.disabled=true;field('jdRequestResults').hidden=true;quoted=null;baseline=null;status('Consultando precios actuales en B612…');
    const {data:rows,error}=await window.jdSupabase.from('app_state').select('key,value').in('key',['jd_catalog_v6']);
    if(error)throw Error('No se pudo verificar el catálogo actual.');
    const actualCatalog=rows.find(r=>r.key==='jd_catalog_v6')?.value;
    if(!Array.isArray(actualCatalog))throw Error('No se pudo verificar el catálogo guardado.');
    const {product,spec}=parser.validate(values,actualCatalog),prices=[];
    for(const qty of values.quantities){
     const response=await fetch('https://athiruoimehofqzrplnl.supabase.co/functions/v1/b612-quote',{method:'POST',signal:AbortSignal.timeout(120000),headers:{'Content-Type':'application/json'},body:JSON.stringify({...spec,format:values.format,qty,models:values.models})});
     const value=await response.json();
     if(!response.ok||!value.ok)throw Error(value.error||'B612 no devolvió una cotización.');
     if(value.live!==true||value.supplier!=='Gráfica B612'||value.requestedQty!==qty||value.models!==values.models||value.format!==values.format||['openWidthMm','openHeightMm','closedWidthMm','closedHeightMm'].some(k=>Number(value.specs?.[k])!==Number(spec[k])))throw Error('La respuesta de B612 no coincide con la ficha confirmada.');
     validatePrice(value);prices.push({qty,b612:value});
    }
    if(version!==revision){status('La ficha cambió durante la consulta. Consultá de nuevo para usar los datos actuales.');return;}
    quoted={id:'b612-'+crypto.randomUUID(),createdAt:new Date().toISOString(),productId:product.id,product:product.name,format:values.format,models:values.models,spec,prices,message:field('jdRequestText').value,review:{verified:false}};baseline=null;
    showResults();status('Cotización lista. Pendiente de corroborar las primeras consultas con B612.');
   }catch(error){status(error.name==='TimeoutError'?'B612 demoró demasiado. Reintentá la consulta.':error.message||'No se pudo consultar B612.');}
   finally{button.disabled=false;}
  };
  function validatePrice(value){
   if(['net','vat','gross'].some(k=>!Number.isFinite(value[k])||value[k]<0)||value.net<=0||Math.abs(value.net+value.vat-value.gross)>.011||!Array.isArray(value.lines)||!value.lines.length)throw Error('El desglose de B612 está incompleto. No se puede presentar un total confiable.');
   if(value.lines.some(l=>!Number.isFinite(l.quantity)||l.quantity<=0||!Number.isFinite(l.unitPrice)||l.unitPrice<0||!Number.isFinite(l.total)||l.total<0||Math.abs(l.quantity*l.unitPrice-l.total)>.011)||Math.abs(value.lines.reduce((sum,l)=>sum+l.total,0)-value.net)>.011)throw Error('Los artículos no suman el costo neto informado. Requiere revisión con B612.');
  }
  function showResults(){
   const results=field('jdRequestResults');results.hidden=false;
   results.innerHTML='<h3>Presupuesto de imprenta · a corroborar con B612</h3>'+quoted.prices.map((row,i)=>{
    const d=row.b612;return '<div class="card" style="margin-bottom:16px"><h3>'+esc(row.qty)+' unidades · '+esc(quoted.format)+' · '+esc(quoted.models)+' diseños</h3><p class="small">Tirada optimizada: '+esc(d.productionQty)+' unidades · '+esc(d.sheet?.postures)+' posturas por pliego · '+esc(d.sheet?.printedSheets)+' pliegos.</p><div style="overflow-x:auto"><table><thead><tr><th>Artículo / operación</th><th>Cantidad</th><th>Precio unitario</th><th>Subtotal sin IVA</th></tr></thead><tbody>'+d.lines.map(l=>'<tr><td>'+esc(l.name)+' <small class="muted">'+esc(l.code)+'</small></td><td>'+esc(l.quantity)+'</td><td>'+money(l.unitPrice)+'</td><td>'+money(l.total)+'</td></tr>').join('')+'</tbody></table></div><p><b>Neto sin IVA: '+money(d.net)+'</b><br>IVA: '+money(d.vat)+'<br><b>Total B612: '+money(d.gross)+'</b></p><p class="small muted">Consultado '+esc(new Date(d.fetchedAt).toLocaleString('es-AR'))+'.</p><div class="field"><label>Neto confirmado por B612 · '+esc(row.qty)+' unidades<input type="number" min="0.01" step="0.01" data-confirm-net="'+i+'" aria-label="Neto corroborado '+esc(row.qty)+' unidades" placeholder="Para comparar" value="'+esc(quoted.review?.confirmedNets?.[i]??'')+'"></label></div></div>';
   }).join('')+'<label class="jd-checkline" style="margin:14px 0"><input type="checkbox" data-confirm-operations '+(quoted.review?.operationsConfirmed?'checked':'')+'> Corroboré también con B612 el refilado, doblez y demás artículos de todas las tiradas.</label><button class="btn" type="button" data-verify>Comparar con lo que confirmó B612</button><p data-verification role="status" class="small"></p><button class="btn primary" type="button" data-save>Guardar consulta para corroborar</button><p data-save-status role="status" class="small"></p><p class="small muted">Se guarda como consulta de imprenta. En esta etapa no se crean presupuestos de cliente ni PDF.</p>';
   const verify=results.querySelector('[data-verification]');
   verify.textContent=quoted.review?.verified?'Corroboración manual registrada.':'Pendiente de corroboración.';
   results.querySelectorAll('[data-confirm-net]').forEach(input=>input.addEventListener('input',()=>{quoted.review={verified:false};verify.textContent='Pendiente de corroboración.';}));
   results.querySelector('[data-confirm-operations]').addEventListener('change',()=>{quoted.review={verified:false};verify.textContent='Volvé a comparar para registrar la corroboración.';});
   results.querySelector('[data-verify]').onclick=()=>{
    const values=[...results.querySelectorAll('[data-confirm-net]')].map(x=>Number(x.value));
    if(values.some(n=>!Number.isFinite(n)||n<=0)){verify.textContent='Cargá el neto confirmado de cada cantidad.';return;}
    const differences=values.map((n,i)=>Math.round((n-quoted.prices[i].b612.net)*100)/100);
    if(differences.some(n=>n!==0)){quoted.review={verified:false,confirmedNets:values,differences};verify.textContent='Hay diferencias: '+differences.map((n,i)=>quoted.prices[i].qty+' u.: '+money(n)).join(' · ')+'. Revisá con B612 antes de aprobar.';return;}
    if(!results.querySelector('[data-confirm-operations]').checked){quoted.review={verified:false,confirmedNets:values,netMatches:true};verify.textContent='El neto coincide. Falta corroborar con B612 los artículos y operaciones del desglose.';return;}
    quoted.review={verified:true,verifiedAt:new Date().toISOString(),confirmedNets:values,operationsConfirmed:true};verify.textContent='Coincide con los netos de B612 que ingresaste. Corroboración manual del neto y operaciones registrada.';
   };
   results.querySelector('[data-save]').onclick=async()=>{
    const button=results.querySelector('[data-save]'),note=results.querySelector('[data-save-status]'),snapshot=structuredClone(quoted);if(button.disabled)return;button.disabled=true;
    try{
     await window.jdUpdateSharedState(['jd_b612_requests_v1'],state=>{
      const list=state.jd_b612_requests_v1??[];if(!Array.isArray(list))throw Error('No se pudo verificar la lista de consultas.');
      const index=list.findIndex(r=>r.id===snapshot.id);
      if(index>=0){if(!baseline||JSON.stringify(list[index])!==baseline)throw Error('La consulta cambió en otro dispositivo. Volvé a abrirla.');list[index]=snapshot;}
      else{if(baseline)throw Error('La consulta ya no está disponible.');list.unshift(snapshot);}
      return {jd_b612_requests_v1:list};
     });if(quoted?.id===snapshot.id)baseline=JSON.stringify(snapshot);note.textContent='Consulta guardada. '+(snapshot.review.verified?'Corroboración registrada.':'Queda pendiente de corroboración.');drawSaved();
    }catch(error){note.textContent='No se guardó la consulta: '+error.message;}
    finally{button.disabled=false;}
   };
  }
  function drawSaved(){
   let list;try{list=JSON.parse(localStorage.getItem('jd_b612_requests_v1')||'[]');}catch{list=[];}
   if(!Array.isArray(list))list=[];
   field('jdSavedB612').innerHTML='<h3>Consultas de imprenta guardadas</h3>'+(list.length?'<div style="overflow-x:auto"><table><thead><tr><th>Fecha</th><th>Producto / formato</th><th>Corroboración</th><th></th></tr></thead><tbody>'+list.map((r,i)=>'<tr><td>'+esc(new Date(r.createdAt).toLocaleDateString('es-AR'))+'</td><td>'+esc(r.product)+' · '+esc(r.format)+'</td><td>'+esc(r.review?.verified?'Corroborado manualmente':'Pendiente')+'</td><td><button class="btn sm" type="button" data-open-b612="'+i+'">Ver consulta</button></td></tr>').join('')+'</tbody></table></div>':'<p class="small muted">Todavía no hay consultas guardadas.</p>');
   field('jdSavedB612').querySelectorAll('[data-open-b612]').forEach(button=>button.onclick=()=>{
    try{const record=structuredClone(list[Number(button.dataset.openB612)]);if(!record?.prices?.length)throw Error('Consulta incompleta.');record.prices.forEach(r=>validatePrice(r.b612));quoted=record;baseline=JSON.stringify(record);field('jdRequestText').value=record.message||'';field('jdRequestReview').hidden=true;showResults();status('Consulta guardada: se muestran sus costos originales, sin recalcular.');}catch(error){status(error.message);}
   });
  }
  drawSaved();
 }
 window.jdMessageQuoteUI={mount};
 window.addEventListener('jd-shared-ready',mount);window.addEventListener('DOMContentLoaded',mount);mount();
})();
