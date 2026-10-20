/* Client contact records, independent jobs, dated milestones and recoverable trash.
   All writes use the existing authenticated, compare-and-swap transaction. */
(() => {
 'use strict';
 const C='jd_clients',J='jd_jobs_v1',O='jd_orders_v1',Q='jd_saved_quotes_v6',T='jd_tasks_v1';
 const stages=['Primer contacto','Definiendo pedido','Presupuesto en preparación','Presupuesto listo para enviar','Presupuesto enviado · esperando respuesta','Presupuesto aprobado · esperando pago','Pago recibido · iniciar diseño','Diseño en curso','Primera muestra enviada · esperando devolución','Correcciones de diseño','Diseño aprobado · revisión interna / master','Listo para enviar a imprenta','ENVIADO a imprenta','Imprenta terminó · pendiente de recibir','Recibido de imprenta · CONTROL DE CALIDAD','Control aprobado · coordinar entrega','Entregado','Felicitación post evento enviada','Cerrado · no avanzó'];

 const PREPRINT_CHECKS=[['data','Nombres, fechas, nusaj y cantidades confirmados por escrito'],['scope','Presupuesto vigente y alcance aceptados'],['client','Arte y datos personales aprobados por el interlocutor'],['master','Contenido y másters editoriales verificados por JD'],['pdf','PDF final de tapa e interior cotejado y revisado para imprenta']];
 const missingPreprint=j=>PREPRINT_CHECKS.filter(([key])=>!j?.opsChecks?.[key]?.ok||!String(j.opsChecks[key].evidence||'').trim());
 const read=k=>{try{const a=JSON.parse(localStorage.getItem(k)||'[]');return Array.isArray(a)?a:[]}catch{return []}};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
 const now=()=>new Date().toISOString(),today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
 const fmt=x=>x?new Date(x.length===10?x+'T12:00:00':x).toLocaleString('es-AR',{dateStyle:'short',...(x.length===10?{}:{timeStyle:'short'})}):'—';
 const money=x=>'$ '+Number(x||0).toLocaleString('es-AR',{maximumFractionDigits:2});
 const identity=c=>window.JDClientDirectory.stableId(c);
 const linked=(r,c)=>r.clientId?r.clientId===identity(c):norm(r.client)===norm(c.name);
 function stageOf(s){
  const map={'Consulta recibida':stages[0],'Presupuesto listo':stages[3],'Presupuesto enviado':stages[4],'Esperando respuesta':stages[4],'Aceptado · esperando seña':stages[5],'Pago realizado · iniciar diseño':stages[6],'Diseño':stages[7],'Borrador / Calaméo / mockup enviado':stages[8],'Aprobación del cliente':stages[8],'Correcciones del cliente':stages[9],'Aprobado por cliente · revisión interna / master':stages[10],'Listo para imprenta':stages[11],'En imprenta':stages[12],'Listo para entregar':stages[14],'Retirado de imprenta · listo para entregar':stages[14],'Cancelado':stages[18]};
  return stages.includes(s)?s:map[s]||stages[0];
 }
 function jobs(){
  const saved=read(J),clients=read(C),quotes=read(Q),orders=read(O),result=[...saved];
  for(const c of clients){
   if(result.some(j=>j.clientId===identity(c)))continue;
   const qs=quotes.filter(q=>linked(q,c)),os=orders.filter(o=>linked(o,c));
   if(!c.ask&&!c.status&&!qs.length&&!os.length)continue;
   result.push({id:'legacy-work-'+identity(c),clientId:identity(c),title:c.ask||qs[0]?.product||'Consulta',stage:stageOf(c.status||os[0]?.stage),next:c.next||'',nextDate:c.nextDate||'',created:c.created||c.firstContact||qs.at(-1)?.created||'',event:qs[0]?.event||'',eventType:qs[0]?.eventType||'generic',deadline:os[0]?.deadline||qs[0]?.deadline||'',quoteIds:qs.map(q=>q.id),orderId:os[0]?.id,history:[...(c.history||[])],archivedAt:c.archivedAt,legacy:true});
  }
  return result;
 }
 function annualDate(event,year){const [birth,month,day]=String(event).split('-').map(Number);if(!birth||!month||!day)return '';const last=new Date(Date.UTC(year,month,0)).getUTCDate();return year+'-'+String(month).padStart(2,'0')+'-'+String(Math.min(day,last)).padStart(2,'0');}
 const dayDistance=(a,b)=>Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000);

 const isoDay=x=>{
  const value=String(x||"").slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return '';
  const dt=new Date(value+'T12:00:00Z');
  return !Number.isNaN(dt.valueOf())&&dt.toISOString().slice(0,10)===value?value:'';
 };
 const since=(later,earlier)=>{
  const a=isoDay(later),b=isoDay(earlier);
  return a&&b?Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000):null;
 };
 const fmtDays=value=>value===null?'Sin datos':value>=0?value+' días':Math.abs(value)+' días después';
 function firstPaymentDate(j,orders=read(O)){
  const o=orders.find(o=>o.id===j.orderId||(j.quoteIds||[]).includes(o.quoteId));
  const dates=(o?.payments||[]).filter(p=>!p.voidedAt&&!p.legacy&&Number(p.ars||0)>0).map(p=>isoDay(p.date)).filter(Boolean);
  return dates.sort()[0]||'';
 }
 function timings(j,orders=read(O)){
  const contact=isoDay(j.firstContact),approval=isoDay(j.approvedAt),paid=firstPaymentDate(j,orders),delivery=isoDay(j.deliveredAt),event=isoDay(j.event);
  return {contact,approval,paid,delivery,event,
   contactToEvent:since(event,contact),approvalToEvent:since(event,approval),
   paymentToEvent:since(event,paid),deliveryToEvent:since(event,delivery),
   contactToApproval:since(approval,contact),approvalToDelivery:since(delivery,approval),
   paymentToDelivery:since(delivery,paid)};
 }
 function aggregateLeadTimes(rows,orders=read(O)){
  const metricNames=['contactToEvent','approvalToEvent','paymentToEvent','deliveryToEvent','contactToApproval','approvalToDelivery'];
  const out={count:rows.length};
  for(const name of metricNames){
   const values=rows.map(j=>timings(j,orders)[name]).filter(n=>Number.isFinite(n)).sort((a,b)=>a-b);
   const middle=Math.floor(values.length/2);
   out[name]={count:values.length,average:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,
      median:values.length?(values.length%2?values[middle]:(values[middle-1]+values[middle])/2):null};
  }
  return out;
 }
 function timingMarkup(j){
  const t=timings(j);
  const labels=[['contactToEvent','Primer contacto → evento'],['approvalToEvent','Aprobación → evento'],['paymentToEvent','Primer pago → evento'],['deliveryToEvent','Entrega → evento'],['contactToApproval','Contacto → aprobación'],['approvalToDelivery','Aprobación → entrega']];
  return '<div class="jd-work-wide jd-timing-snapshot"><b>Anticipación registrada</b><p class="small muted">Los plazos se calculan solamente cuando las dos fechas están confirmadas. Un valor negativo indica que el hito ocurrió después del evento.</p><div class="jd-timing-small-grid">'+labels.map(([key,label])=>'<div><small>'+esc(label)+'</small><strong>'+esc(fmtDays(t[key]))+'</strong></div>').join('')+'</div></div>';
 }
 function leadTimePanel(rows,orders){
  const agg=aggregateLeadTimes(rows,orders);
  const metrics=[['contactToEvent','Primer contacto antes del evento'],['approvalToEvent','Aprobación antes del evento'],['contactToApproval','Tiempo para confirmar'],['deliveryToEvent','Entrega antes del evento']];
  const subset=key=>rows.filter(j=>j.eventType===key);
  const groups=[['wedding','Casamientos'],['bar_mitzvah','Bar Mitzvá'],['bat_mitzvah','Bat Mitzvá'],['generic','Otros eventos']];
  return '<div class="section jd-lead-analytics"><div class="section-head"><h2>Anticipación y tiempos de compra</h2><small>'+rows.length+' trabajos considerados</small></div><p class="small muted">Solo fechas efectivamente registradas; no se infieren a partir de presupuestos antiguos ni de eventos anteriores. Promedio y mediana se calculan sobre los casos con ambos hitos completos.</p><div class="jd-lead-stat-grid">'+metrics.map(([key,title])=>'<div class="jd-lead-stat"><small>'+title+'</small><strong>'+(!agg[key].count?'Sin datos':Math.round(agg[key].average)+' días')+'</strong><small>Mediana: '+(agg[key].count?agg[key].median+' días':'—')+' · '+agg[key].count+' casos</small></div>').join('')+'</div><div class="jd-lead-segments"><b>Por tipo de evento</b><div class="jd-lead-segment-list">'+groups.filter(([key])=>subset(key).length).map(([key,name])=>{const a=aggregateLeadTimes(subset(key),orders).contactToEvent;return '<span>'+name+': '+(a.count?Math.round(a.average)+' días antes':'faltan fechas')+' · '+a.count+' casos medibles</span>'}).join('')+'</div></div></div>';
 }

 function nextAnniversary(j,date=today()){if(!j.event||j.eventType!=='wedding')return '';let year=Math.max(Number(date.slice(0,4)),Number(j.event.slice(0,4))+1),next=annualDate(j.event,year);if(next<date)next=annualDate(j.event,year+1);return next;}
 function greetingActions(j,date=today()){
  if(!j.event||!/^\d{4}-\d{2}-\d{2}$/.test(j.event))return [];
  const actions=[],days=dayDistance(date,j.event);
  if(j.postEventReminder!==false&&days>=0&&days<=7&&!j.greetings?.['post-event'])actions.push({key:'post-event',due:j.event,label:'Saludar post evento',text:'Preparar felicitación · evento '+fmt(j.event)});
  if(j.eventType==='wedding'&&j.anniversaryReminder!==false){const year=Number(date.slice(0,4));for(const y of [year-1,year,year+1]){if(y<=Number(j.event.slice(0,4)))continue;const due=annualDate(j.event,y),delta=dayDistance(due,date),key='anniversary-'+y;if(delta>=-7&&delta<=7&&!j.greetings?.[key])actions.push({key,due,label:'Aniversario',text:delta>0?'Preparar saludo · en '+delta+' días · '+fmt(due):delta===0?'Saludar hoy · '+fmt(due):'Saludo pendiente · '+fmt(due)});}
  }return actions;
 }
 function clientEventDates(related){
  return '<section class="jd-event-dates"><h3>Eventos y aniversarios</h3>'+related.filter(j=>!j.deletedAt&&!j.quoteTrashAt).map(j=>'<div class="jd-work-row"><div>'+codeMarkup(j.id)+'<b>'+esc(j.title)+'</b><p>'+esc(j.eventType==='wedding'?'Casamiento: ':'Evento: ')+esc(j.event?fmt(j.event):'Sin fecha registrada')+'</p>'+(j.eventType==='wedding'&&j.event?'<small>Saludo anual: '+(j.anniversaryReminder===false?'desactivado':'activado · próximo '+esc(fmt(nextAnniversary(j))))+'</small>':'')+'</div><button class="btn sm" type="button" data-event-job="'+esc(j.id)+'">Editar fecha y avisos</button></div>').join('')+(related.length?'':'<p class="muted">La fecha se carga en el presupuesto o en un trabajo del cliente.</p>')+'<p class="small muted">Los avisos aparecen en Inicio para trabajos entregados: felicitación después del evento y aniversario de boda desde 7 días antes. Marcá el saludo enviado para dejarlo registrado.</p></section>';
 }
 function history(j){
  const ev=[...(j.history||[])];
  for(const q of read(Q).filter(q=>(j.quoteIds||[]).includes(q.id))){
   const versions=[...(q.revisions||[]).map(r=>r.snapshot).filter(Boolean),q];
   for(const v of versions){const at=v.updatedAt||v.created;if(at)ev.push({at,type:'Presupuesto',text:'Versión '+(v.revision||1)+' · '+v.product+' · '+(v.quantities||[]).map(x=>x.qty+' u. '+money(x.price)).join(' / ')});}
   if(q.sentConfirmedAt)ev.push({at:q.sentConfirmedAt,type:'Presupuesto enviado',text:'Envío confirmado al cliente.'});
  }
  const order=read(O).find(o=>o.id===j.orderId||(j.quoteIds||[]).includes(o.quoteId));
  if(order){for(const h of order.history||[])ev.push({...h,type:h.type||'Pedido',text:h.text||h.stage});for(const p of payments(order))ev.push({at:p.date,type:p.voidedAt?'Pago anulado':'Pago',text:p.amount+' '+p.currency+' · '+p.method+' · equivalente '+money(p.ars)+(p.legacy?' · registro anterior sin detalle original':'')});}
  return ev.filter(e=>e.at).sort((a,b)=>new Date(a.at)-new Date(b.at));
 }
 function payments(order){if(Array.isArray(order?.payments))return order.payments;return Number(order?.paid)>0?[{id:'legacy-paid-'+order.id,amount:Number(order.paid),currency:'ARS',rate:1,ars:Number(order.paid),date:order.updatedAt||order.created,method:'Saldo previo · medio no registrado',legacy:true}]:[];}
 const paid=order=>Math.round(payments(order).filter(p=>!p.voidedAt).reduce((n,p)=>n+Number(p.ars),0)*100)/100;
 async function update(k,id,baseline,value){
  return window.jdUpdateSharedState([k],state=>{
   const arr=state[k]||[];if(!Array.isArray(arr))throw Error('No se pudieron verificar los datos.');
   const index=arr.findIndex(x=>(k===C?identity(x):x.id)===id),current=index<0?null:arr[index];
   if(JSON.stringify(current)!==JSON.stringify(baseline))throw Error('Este registro cambió en otro dispositivo. Volvé a abrirlo.');
   if(index<0)arr.push(value);else arr[index]=value;return {[k]:arr};
  });
 }
 function shell(title,sub,body,footer=''){
  const panel=document.createElement('div');panel.className='jd-crm-modal jd-work-modal';panel.innerHTML='<div class="jd-crm-card"><div class="jd-crm-head"><div><div class="eyebrow">'+esc(sub)+'</div><h2>'+esc(title)+'</h2></div><button class="btn" data-close>Cerrar</button></div>'+body+'<div class="jd-crm-footer">'+footer+'</div></div>';document.body.append(panel);panel.querySelector('[data-close]').onclick=()=>panel.remove();return panel;
 }
 function tabs(panel){panel.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{panel.querySelectorAll('[data-pane]').forEach(p=>p.hidden=p.dataset.pane!==b.dataset.tab);panel.querySelectorAll('[data-tab]').forEach(x=>x.setAttribute('aria-selected',String(x===b)))});}
 const tabbar=names=>'<div class="jd-work-tabs" role="tablist">'+names.map((n,i)=>'<button class="btn sm" role="tab" aria-selected="'+(!i)+'" data-tab="'+i+'">'+n+'</button>').join('')+'</div>';
 const input=(id,label,value='',type='text')=>'<label class="jd-work-field">'+esc(label)+'<input id="'+id+'" type="'+type+'" value="'+esc(value)+'"></label>';
 const textarea=(id,label,value='')=>'<label class="jd-work-field jd-work-wide">'+esc(label)+'<textarea id="'+id+'">'+esc(value)+'</textarea></label>';
 async function perform(button,action){if(button.disabled)return;button.disabled=true;try{await action();refresh()}catch(e){alert(e.message||'No se pudo guardar. Tus cambios siguen abiertos.')}finally{button.disabled=false}}
 function renderClients(mode='active'){
  const sec=document.getElementById('clients');if(!sec)return;
  const all=read(C),cs=all.filter(c=>mode==='trash'?!!c.deletedAt:mode==='archive'?!c.deletedAt&&!!c.archivedAt:!c.deletedAt&&!c.archivedAt);
  sec.innerHTML='<div class="topbar"><div><div class="eyebrow">CONTACTOS</div><h1>Clientes</h1></div><div class="jd-toolbar"><button class="btn" data-view="active">Activos</button><button class="btn" data-view="archive">Archivados</button><button class="btn" data-view="trash">Papelera ('+all.filter(c=>c.deletedAt).length+')</button><button class="btn primary" id="jdNewClient">+ Nuevo cliente</button></div></div><p class="muted">La ficha guarda el contacto. Cada trabajo tiene su propia historia, fechas y cobros. Eliminar envía a la papelera y permite recuperar.</p><div class="jd-crm-search"><label for="jdCrmSearch">Buscar cliente</label><input id="jdCrmSearch" type="search" placeholder="Nombre, apellido o institución…"><small id="jdCrmSearchCount"></small></div><div class="jd-table-scroll"><table class="table jd-crm-table"><thead><tr><th>Cliente</th><th>Contacto</th><th>Trabajos</th><th></th></tr></thead><tbody>'+cs.map(c=>'<tr data-client="'+esc(identity(c))+'"><td><b>'+esc(c.name)+'</b><div class="small muted">'+esc(c.org)+'</div></td><td>'+esc(c.phone||c.email||'—')+'</td><td>'+jobs().filter(j=>j.clientId===identity(c)&&!j.deletedAt).length+'</td><td><div class="jd-toolbar">'+(c.deletedAt?'<button class="btn sm" data-restore="'+esc(identity(c))+'">Restaurar</button>':'<button class="btn sm" data-client-open="'+esc(identity(c))+'">Abrir ficha</button><button class="btn sm" data-archive="'+esc(identity(c))+'">'+(c.archivedAt?'Reactivar':'Archivar')+'</button><button class="btn sm" data-delete-client="'+esc(identity(c))+'">Eliminar</button>')+'</div></td></tr>').join('')+'</tbody></table></div>';
  sec.dataset.view=mode;
  const search=sec.querySelector('#jdCrmSearch');search.oninput=()=>{let count=0;sec.querySelectorAll('[data-client]').forEach(row=>{const c=cs.find(c=>identity(c)===row.dataset.client);row.hidden=!window.JDClientDirectory.matches(c,search.value);if(!row.hidden)count++;});sec.querySelector('#jdCrmSearchCount').textContent=count+' clientes'};search.oninput();
  sec.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>renderClients(b.dataset.view));sec.querySelector('#jdNewClient').onclick=()=>openClient();
  sec.querySelectorAll('[data-client-open]').forEach(b=>b.onclick=()=>openClient(b.dataset.clientOpen));
  for(const [selector,field] of [['data-delete-client','deletedAt'],['data-restore','deletedAt'],['data-archive','archivedAt']])sec.querySelectorAll('['+selector+']').forEach(b=>b.onclick=()=>perform(b,async()=>{const c=read(C).find(c=>identity(c)===b.getAttribute(selector));if(selector==='data-delete-client'&&!confirm('¿Enviar '+c.name+' a la papelera? Sus trabajos e historial se conservan y quedan fuera del seguimiento activo. Los presupuestos se eliminan por separado.'))return;const value={...c,[field]:selector==='data-restore'||c[field]?null:now()};await update(C,identity(c),c,value);renderClients(mode);}));
 }
 function openClient(id){
  const original=read(C).find(c=>identity(c)===id)||null,c=original||{id:'client-'+crypto.randomUUID(),created:now()},related=jobs().filter(j=>j.clientId===(id||c.id));
  const body=tabbar(['Contacto','Entrega','Trabajos'])+'<div class="jd-work-content"><div data-pane="0"><div class="jd-work-grid">'+input('crmFirst','Nombre / institución',c.firstName||(!c.lastName?c.name:''))+input('crmLast','Apellido (opcional)',c.lastName)+input('crmOrg','Institución relacionada',c.org)+input('crmPhone','WhatsApp',c.phone)+input('crmEmail','Correo',c.email,'email')+input('crmInstagram','Instagram',c.instagram)+textarea('crmNotes','Notas del contacto',c.notes)+'</div>'+clientEventDates(related)+'</div><div data-pane="1" hidden><div class="jd-work-grid">'+input('crmRecipient','Destinatario',c.deliveryRecipient)+input('crmAddress','Dirección',c.address)+input('crmCity','Localidad / provincia',c.city)+input('crmPostal','Código postal',c.postalCode)+input('crmCountry','País',c.country)+'</div></div><div data-pane="2" hidden><p class="muted">Cada evento o nuevo encargo es un trabajo independiente, aunque el cliente sea el mismo.</p><button class="btn sm" data-new-job '+(!original?'disabled':'')+'>+ Nuevo trabajo</button>'+related.map(j=>'<div class="jd-work-row"><div>'+codeMarkup(j.id)+'<b>'+esc(j.title)+'</b><small>'+esc(j.stage)+' · '+esc(j.event||'Sin fecha de evento')+'</small></div><button class="btn sm" data-job="'+esc(j.id)+'">Abrir trabajo</button></div>').join('')+(!original?'<p>Guardá primero el contacto para agregar trabajos.</p>':'')+'</div></div>';
  const p=shell(c.name||'Nuevo cliente','FICHA DEL CLIENTE',body,'<button class="btn primary" data-save>Guardar contacto</button>');tabs(p);p.dataset.clientEvents=identity(c);const f=id=>p.querySelector('#'+id);
  p.querySelectorAll('[data-job],[data-event-job]').forEach(b=>b.onclick=()=>openJob(b.dataset.job||b.dataset.eventJob));p.querySelector('[data-new-job]').onclick=()=>openJob(null,c);
  p.querySelector('[data-save]').onclick=()=>perform(p.querySelector('[data-save]'),async()=>{const first=f('crmFirst').value.trim(),last=f('crmLast').value.trim(),org=f('crmOrg').value.trim();if(!first&&!last&&!org)throw Error('Indicá nombre, apellido o institución.');if(!f('crmEmail').checkValidity())throw Error('Revisá el correo.');const value={...c,id:identity(c),firstName:first,lastName:last,name:[first,last].filter(Boolean).join(' ')||org,org,updatedAt:now()};for(const [key,field] of Object.entries({phone:'crmPhone',email:'crmEmail',instagram:'crmInstagram',notes:'crmNotes',deliveryRecipient:'crmRecipient',address:'crmAddress',city:'crmCity',postalCode:'crmPostal',country:'crmCountry'}))value[key]=f(field).value.trim();await update(C,identity(c),original,value);p.remove();});
 }
 function recordQuote(state,q,editing){
  const arr=state[J]||[];if(!Array.isArray(arr))throw Error('No se pudieron verificar los trabajos.');
  let j=arr.find(j=>(j.quoteIds||[]).includes(q.id)||(q.quoteFamily&&(j.quoteIds||[]).includes(q.quoteFamily))||(q.parentQuoteId&&(j.quoteIds||[]).includes(q.parentQuoteId)));
  if(!j&&q.jobId){j=arr.find(j=>j.id===q.jobId)||jobs().find(j=>j.id===q.jobId);if(!j||j.clientId!==q.clientId)throw Error('El trabajo elegido no pertenece al cliente.');if(!arr.includes(j)){j=structuredClone(j);arr.push(j);}}
  if(!j&&editing){const old=jobs().find(j=>(j.quoteIds||[]).includes(q.id));if(old){j=structuredClone(old);arr.push(j);}}
  if(!j){j={id:'work-'+crypto.randomUUID(),clientId:q.clientId,title:[q.product,q.model].filter(Boolean).join(' · '),created:q.created,stage:stages[3],next:'Enviar presupuesto',quoteIds:[],history:[]};arr.push(j);}
  j.clientId=q.clientId;j.quoteIds=[...new Set([...(j.quoteIds||[]),q.id])];j.event=q.event;j.eventType=q.eventType;j.deadline=q.deadline;j.updatedAt=now();
  j.history=[...(j.history||[]),{at:j.updatedAt,type:'Presupuesto',text:(editing?'Revisión guardada':'Presupuesto preparado')+' · '+q.id+' · '+(q.quantities||[]).map(x=>x.qty+' u. '+money(x.price)).join(' / ')}];
  q.jobId=j.id;return arr;
 }
 function reviewUrl(raw){
  const text=String(raw||'').trim();if(!text)return '';
  let url;try{url=new URL(/^www\./i.test(text)?'https://'+text:text);}catch{throw Error('Pegá un enlace completo de la muestra, empezando con https://.');}
  if(url.protocol!=='https:'||url.username||url.password)throw Error('El link de revisión debe usar https:// y no incluir contraseñas.');
  return url.href;
 }
 // Supplier milestones stay private in the internal job. A checked state is not an event date.
 let workCodes=new Map(),codeLoad=null,codeReload=false;
 const workCode=id=>workCodes.get('job:'+id)||'';
 const codeMarkup=id=>'<span class="jd-work-code" data-work-code="'+esc(id)+'">'+esc(workCode(id)||'Código pendiente')+'</span>';
 async function loadWorkCodes(){
  if(codeLoad){codeReload=true;return codeLoad;}if(!window.__JD_SHARED_READY||!window.jdSupabase)return;
  codeLoad=(async()=>{try{
   const keys=jobs().map(j=>'job:'+j.id),entries=[];
   for(let i=0;i<keys.length;i+=100){const {data,error}=await window.jdSupabase.from('jd_work_codes').select('source_key,code').in('source_key',keys.slice(i,i+100));if(error)throw error;entries.push(...(data||[]));}
   workCodes=new Map(entries.filter(r=>typeof r.source_key==='string'&&/^JD-\d{6,}$/.test(r.code||'')).map(r=>[r.source_key,r.code]));
   document.querySelectorAll('[data-work-code]').forEach(n=>n.textContent=workCode(n.dataset.workCode)||'Se asigna al guardar');
   document.querySelectorAll('[data-copy-work-code]').forEach(b=>b.disabled=!workCode(b.dataset.copyWorkCode));
   bindQuoteJob();
  }catch{document.querySelectorAll('[data-work-code]').forEach(n=>{if(!workCode(n.dataset.workCode))n.textContent='Código no disponible · recargá';});}finally{codeLoad=null;if(codeReload){codeReload=false;setTimeout(loadWorkCodes,0);}}})();return codeLoad;
 }
 window.addEventListener('jd-shared-ready',loadWorkCodes);
 const PRINT_MILESTONES=[['fileSentAt','Archivo enviado'],['proofApprovedAt','Muestra de imprenta firmada por JD'],['productionAt','Entró en producción'],['finishedAt','Finalizado · impresión y control de la imprenta'],['pickedUpAt','Retirado · recibido por JD']];
 const PRINT_STATES=['Sin consultar','Solicitud presupuesto','Presupuestando en la web','Presupuestado','P. Aceptado','Esperando archivo','Esperando firma de muestra','En producción','Finalizado','Retirado','P. Rechazado','Cancelado'];
 function printDate(value){
  if(!value)return '';
  const d=new Date(value);if(Number.isNaN(d.valueOf()))return '';
  return new Date(d.valueOf()-3*3600000).toISOString().slice(0,16);
 }
 function printInstant(value){
  if(!value)return '';
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw Error('Revisá la fecha y hora de imprenta.');
  const d=new Date(value+'-03:00');
  if(Number.isNaN(d.valueOf())||printDate(d.toISOString())!==value)throw Error('Revisá la fecha y hora de imprenta.');
  if(d.valueOf()>Date.now()+60000)throw Error('Los hitos de imprenta son hechos ocurridos: no pueden tener fecha futura.');
  return d.toISOString();
 }
 function printDurations(order){
  const pairs=[['fileSentAt','proofApprovedAt','Archivo → firma de muestra'],['proofApprovedAt','productionAt','Firma → producción'],['productionAt','finishedAt','Tiempo de impresión'],['finishedAt','pickedUpAt','Demora hasta retirar']];
  return pairs.map(([from,to,label])=>{const hours=order[from]&&order[to]?(Date.parse(order[to])-Date.parse(order[from]))/3600000:null;return {label,hours:Number.isFinite(hours)&&hours>=0?hours:null};});
 }
 function printTimingMarkup(order){return '<div class="jd-timing-small-grid">'+printDurations(order).map(m=>'<div><small>'+esc(m.label)+'</small><strong>'+esc(m.hours===null?'Faltan fechas':m.hours<48?m.hours.toLocaleString('es-AR',{maximumFractionDigits:1})+' h':(m.hours/24).toLocaleString('es-AR',{maximumFractionDigits:1})+' días')+'</strong></div>').join('')+'</div>';}
 function printLink(order){return order.supplier==='B612'&&/^\d+$/.test(order.code||'')?'https://www.graficab612.com/pedido.htm?pedido='+order.code:'';}
 function printCard(order,index){
  if(order.voidedAt)return '<details class="jd-print-order" data-print-index="'+index+'"><summary>Vínculo quitado · '+esc(order.supplier)+' #'+esc(order.code)+'</summary><p>Se conserva el antecedente.</p><button type="button" class="btn sm" data-print-restore>Restaurar vínculo</button></details>';
  const prefix='print-'+index+'-',link=printLink(order);
  const states=PRINT_STATES.includes(order.status)?PRINT_STATES:[order.status,...PRINT_STATES];
  return '<article class="jd-print-order" data-print-index="'+index+'"><div class="jd-work-row"><b data-print-title>'+esc([order.supplier,order.code].filter(Boolean).join(' · ')||'Nueva orden de imprenta')+'</b><button class="btn sm" type="button" data-print-void="'+index+'">Quitar vínculo</button></div><div class="jd-work-grid"><label class="jd-work-field">Imprenta<select id="'+prefix+'supplier">'+['B612','Zloto','Otra'].map(s=>'<option '+(order.supplier===s?'selected':'')+'>'+s+'</option>').join('')+'</select></label>'+input(prefix+'code','Código / referencia de la orden',order.code)+input(prefix+'description','Qué se imprime / tirada',order.description)+'<label class="jd-work-field">Costo neto total · ARS, sin IVA<input id="'+prefix+'net" type="number" min="0" step="0.01" value="'+esc(order.net??'')+'"></label><label class="jd-work-field">Estado informado por la imprenta<select id="'+prefix+'status">'+states.map(s=>'<option '+(order.status===s?'selected':'')+'>'+esc(s)+'</option>').join('')+'</select></label><div class="jd-work-field"><span>Última consulta registrada</span><small data-print-checked>'+esc(order.checkedAt?new Date(order.checkedAt).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}):'Sin consulta registrada')+'</small><label class="jd-work-check"><input type="checkbox" id="'+prefix+'checked">Verifiqué el estado y costo ahora</label></div>'+PRINT_MILESTONES.map(([key,label])=>input(prefix+key,label,printDate(order[key]),'datetime-local')).join('')+textarea(prefix+'evidence','Referencia del archivo / muestra firmada / comprobante',order.evidence)+'</div><p><a data-print-link class="btn sm" target="_blank" rel="noopener noreferrer" '+(link?'href="'+esc(link)+'"':'hidden')+'>Abrir orden en B612</a></p><div data-print-timings>'+printTimingMarkup(order)+'</div></article>';
 }
 function printPane(j){return '<div data-pane="3" hidden><h3>Órdenes de imprenta</h3><p class="small muted">Seguimiento interno, con carga manual. No hay conexión automática a B612 ni sincronización con la planilla de Zloto todavía.</p><p class="small muted"><b>Finalizado:</b> la imprenta terminó la impresión y su control. <b>Retirado:</b> JD ya lo tiene. El control de calidad de JD se registra aparte en Proceso y fechas.</p><p class="small muted">Fechas reales en horario de Argentina (UTC−3). Dejá vacío lo desconocido. La fecha de consulta del estado no reemplaza la fecha del hito. La firma de la muestra de imprenta es tuya; no es la aprobación del diseño por el cliente.</p><div data-print-orders>'+((j.supplierOrders||[]).map(printCard).join(''))+'</div><button type="button" class="btn" data-print-add>+ Orden de imprenta</button><p class="small muted">El costo queda como antecedente de esta orden. No genera un gasto ni un pago en Caja y Finanzas. Podés vincular varias órdenes, por ejemplo tapa, interior o reimpresiones.</p></div>';}
 function bindPrintPane(p,j){
  const rows=structuredClone(j.supplierOrders||[]),list=p.querySelector('[data-print-orders]');
  function bind(index){
   const card=list.querySelector('[data-print-index="'+index+'"]'),f=key=>p.querySelector('#print-'+index+'-'+key);
   const restore=card.querySelector('[data-print-restore]');
   if(restore){restore.onclick=()=>{delete rows[index].voidedAt;card.outerHTML=printCard(rows[index],index);bind(index);};return;}
   card.querySelector('[data-print-void]').onclick=()=>{rows[index].voidedAt=now();card.outerHTML=printCard(rows[index],index);bind(index);};
   const updateLink=()=>{const data={supplier:f('supplier').value,code:f('code').value.trim()},url=printLink(data),a=card.querySelector('[data-print-link]');a.hidden=!url;if(url)a.href=url;else a.removeAttribute('href');card.querySelector('[data-print-title]').textContent=[data.supplier,data.code].filter(Boolean).join(' · ');};
   f('supplier').onchange=updateLink;f('code').oninput=updateLink;
   for(const [key] of PRINT_MILESTONES)f(key).onchange=()=>{try{const data=Object.fromEntries(PRINT_MILESTONES.map(([k])=>[k,printInstant(f(k).value)]));card.querySelector('[data-print-timings]').innerHTML=printTimingMarkup(data);}catch{/* Validate on save, keep all input. */}};
  }
  rows.forEach((_,i)=>bind(i));
  p.querySelector('[data-print-add]').onclick=()=>{const index=rows.length;rows.push({id:'print-'+crypto.randomUUID(),supplier:'B612',status:'Sin consultar',createdAt:now()});list.insertAdjacentHTML('beforeend',printCard(rows[index],index));bind(index);};
  return ()=>{
   const result=rows.map((row,index)=>{
    if(row.voidedAt)return row;
    const f=key=>p.querySelector('#print-'+index+'-'+key),code=f('code').value.trim(),supplier=f('supplier').value;
    if(!code)throw Error('Indicá el código o referencia de cada orden de imprenta; también podés quitar el vínculo vacío.');
    if(supplier==='B612'&&!/^\d+$/.test(code))throw Error('El código de B612 debe contener solo números.');
    const rawNet=f('net').value,net=rawNet===''?null:Number(rawNet);
    if(net!==null&&(!Number.isFinite(net)||net<0))throw Error('El costo neto debe ser un importe positivo o cero.');
    const value={...row,supplier,code,description:f('description').value.trim(),net,currency:'ARS',taxIncluded:false,status:f('status').value,evidence:f('evidence').value.trim()};
    let previous=null;
    for(const [key,label] of PRINT_MILESTONES){value[key]=printInstant(f(key).value);if(value[key]){if(previous&&value[key]<previous)throw Error('Las fechas de imprenta están fuera de orden: '+label+'.');previous=value[key];}}
    if(value.proofApprovedAt&&!value.evidence)throw Error('Agregá una referencia de la muestra de imprenta firmada por JD.');
    if(f('checked').checked)value.checkedAt=now();
    if(JSON.stringify({...row,updatedAt:null})!==JSON.stringify({...value,updatedAt:null}))value.updatedAt=now();
    return value;
   });
   const keys=result.filter(r=>!r.voidedAt).map(r=>r.supplier+'|'+r.code);
   if(new Set(keys).size!==keys.length)throw Error('Esa orden de imprenta ya está vinculada a este trabajo.');
   return result.filter(r=>!r.voidedAt||j.supplierOrders?.some(old=>old.id===r.id));
  };
 }
 function printHistory(before,after){
  return (after||[]).flatMap(item=>{const old=(before||[]).find(r=>r.id===item.id);const changes=PRINT_MILESTONES.filter(([key])=>(old?.[key]||'')!==(item[key]||'')).map(([key,label])=>label+': '+(item[key]?new Date(item[key]).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}):'sin fecha')+' (anterior: '+(old?.[key]?new Date(old[key]).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}):'sin fecha')+')');return JSON.stringify(old)===JSON.stringify(item)?[]:[{at:now(),type:'Imprenta',text:(item.voidedAt?'Vínculo quitado: ':old?'Orden actualizada: ':'Orden vinculada: ')+item.supplier+' #'+item.code+' · '+item.status+' · neto sin IVA '+(item.net===null?'desconocido':money(item.net))+(changes.length?' · '+changes.join(' · '):''),supplierOrderId:item.id,before:old||null,after:structuredClone(item)}];});
 }
 function openJob(id,client){
  const base=read(J).find(j=>j.id===id)||null,derived=jobs().find(j=>j.id===id),c=client||read(C).find(c=>identity(c)===(base||derived)?.clientId);if(!c)return;
  const j=structuredClone(base||derived||{id:'work-'+crypto.randomUUID(),clientId:identity(c),title:'Nuevo trabajo',stage:stages[0],created:now(),quoteIds:[],history:[]});
  const operationsMarkup='<section class="jd-manual-checklist jd-work-wide"><h3>Control operativo JD · antes de imprenta</h3><p class="small muted">No marques verificaciones por memoria. Cada check exige una referencia al mensaje, archivo o revisión realizada. El OK del cliente y el control de JD son diferentes.</p>'+PREPRINT_CHECKS.map(([key,label])=>'<div class="jd-manual-check"><label class="jd-work-check"><input id="jdOp-'+key+'" type="checkbox" '+(j.opsChecks?.[key]?.ok?'checked':'')+'>'+esc(label)+'</label><input id="jdOpEvidence-'+key+'" aria-label="Evidencia de '+esc(label)+'" placeholder="Evidencia: mensaje, fecha o versión del PDF" value="'+esc(j.opsChecks?.[key]?.evidence||'')+'"></div>').join('')+'</section>';
  const order=read(O).find(o=>o.id===j.orderId||(j.quoteIds||[]).includes(o.quoteId));const events=history(j);
  const qids=[...new Set((j.quoteIds||[]).filter(Boolean))];
  const mainQuote=order?.quoteId&&qids.includes(order.quoteId)?order.quoteId:qids[qids.length-1];
  const quoteButton=qid=>'<button class="btn sm" data-order="'+esc(qid)+'">'+(order?.quoteId===qid?'Abrir cobros y pedido':'Ver / aceptar presupuesto')+'</button>';
  const quoteControls=(mainQuote?quoteButton(mainQuote):'')+(qids.length>1?'<details class="jd-work-old-quotes"><summary>Otros presupuestos · '+(qids.length-1)+'</summary><div class="jd-work-quote-list">'+qids.filter(qid=>qid!==mainQuote).map(quoteButton).join('')+'</div></details>':'');
  const financeSummary=window.JDFinance?.summaryHtml?.(j,null,"ARS")||'';
  const trail=events.map((e,i)=>{const prev=events[i-1],delta=prev?Math.max(0,(new Date(e.at)-new Date(prev.at))/86400000):null;return '<div class="jd-work-event"><b>'+esc(e.type||'Movimiento')+'</b><small>'+esc(fmt(e.at))+(delta!==null?' · '+delta.toLocaleString('es-AR',{maximumFractionDigits:1})+' días desde el anterior':'')+'</small><p>'+esc(e.text||e.stage||'')+'</p></div>';}).reverse().join('');
  const body='<div class="jd-work-reference"><div><small>Código del trabajo</small>'+codeMarkup(j.id)+'</div><button class="btn sm" type="button" data-copy-work-code="'+esc(j.id)+'" '+(workCode(j.id)?'':'disabled')+'>Copiar código</button></div>'+tabbar(['Proceso y fechas','Historia','Cobros','Imprenta'])+'<div class="jd-work-content"><div data-pane="0"><div class="jd-work-grid">'+input('jobTitle','Trabajo / evento',j.title)+'<label class="jd-work-field">Etapa<select id="jobStage">'+stages.map(s=>'<option '+(stageOf(j.stage)===s?'selected':'')+'>'+esc(s)+'</option>').join('')+'</select></label>'+'<div class="jd-work-wide">'+input('jobReviewUrl','Link de muestra / revisión · Calaméo u otro visor',j.reviewUrl,'url')+'<a class="btn sm" id="jobReviewOpen" target="_blank" rel="noopener noreferrer" hidden>Abrir muestra</a><small style="display:block;margin-top:8px">Pegá el link de lectura para el cliente, no el de tu cuenta. El visor controla descarga e impresión. Guardar el link no registra aprobación: asentá la confirmación del cliente y la versión revisada en Historia antes de pasar a imprenta.</small></div>'+input('jobContact','Primer contacto (real)',j.firstContact||'','date')+input('jobApproved','Aprobación del presupuesto',j.approvedAt||'','date')+input('jobEvent','Fecha del evento / casamiento',j.event,'date')+input('jobDelivered','Entrega efectiva del producto',j.deliveredAt||'','date')+timingMarkup(j)+'<label class="jd-work-field">Tipo de evento<select id="jobEventType">'+window.jdAssetMatch.events.map(([id,l])=>'<option value="'+id+'" '+(j.eventType===id?'selected':'')+'>'+esc(l)+'</option>').join('')+'</select></label>'+input('jobDeadline','Última fecha de entrega',j.deadline,'date')+'<div class="jd-work-wide"><label class="jd-work-check"><input id="jobPostEvent" type="checkbox" '+(j.postEventReminder!==false?'checked':'')+'>Avisar para felicitar después del evento</label><label class="jd-work-check"><input id="jobAnniversary" type="checkbox" '+(j.anniversaryReminder!==false?'checked':'')+'>Avisar aniversario de boda cada año</label><small>En Inicio, desde 7 días antes del aniversario y hasta 7 días después. Se activa al marcar el trabajo como entregado.</small></div>'+input('jobNext','Próxima acción concreta',j.next)+input('jobNextDate','Fecha de la próxima acción',j.nextDate,'date')+'<label class="jd-work-field">Prioridad<select id="jobPriority">'+['Normal','Alta','Urgente'].map(s=>'<option '+(s===j.priority?'selected':'')+'>'+s+'</option>').join('')+'</select></label>'+input('jobQuality','Control de calidad aprobado',j.qualityApprovedAt?.slice(0,10),'date')+textarea('jobNotes','Notas / selección de contenido (Deluxe: límite página 86)',j.notes)+operationsMarkup+'</div><p class="small muted">El cambio de etapa registra la fecha. La aprobación del presupuesto y la del diseño son etapas distintas. Para coordinar o marcar la entrega, registrá el control de calidad aprobado.</p></div><div data-pane="1" hidden><div class="jd-work-grid"><label class="jd-work-field">Movimiento<select id="jobHistType">'+['Contacto','Pedido','Presupuesto','Diseño','Corrección','Contenido aprobado','Master','Imprenta','Control de calidad','Entrega','Nota'].map(s=>'<option>'+s+'</option>').join('')+'</select></label>'+input('jobHistAt','Fecha y hora del movimiento','','datetime-local')+textarea('jobHistText','Registrar ida y vuelta, cambio o aprobación')+'</div>'+trail+'</div><div data-pane="2" hidden><p><button class="btn" data-open-finance>Ver / registrar costos reales en Caja y Finanzas</button></p>'+(order?'<p>Total aceptado: <b>'+money(order.quantity.price)+'</b> · Cobrado: '+money(paid(order))+' · <b>Saldo: '+money(order.quantity.price-paid(order))+'</b></p>':'<p>Para registrar cobros, aceptá una alternativa y cantidad del presupuesto. El precio queda congelado.</p>')+financeSummary+quoteControls+'<p class="small muted">Los importes originales de ARS, USD y USDT conservan su equivalencia en pesos al registrar el pago.</p></div>'+printPane(j)+'</div>';
  const p=shell(j.title,c.name+' · TRABAJO',body,'<button class="btn" data-archive-job>'+(j.archivedAt?'Reactivar seguimiento':'Archivar trabajo')+'</button><button class="btn primary" data-save>Guardar trabajo</button>');tabs(p);const collectPrint=bindPrintPane(p,j);p.querySelector('[data-copy-work-code]').onclick=()=>perform(p.querySelector('[data-copy-work-code]'),async()=>{const code=workCode(j.id);if(!code)throw Error('Guardá el trabajo y recargá para consultar su código.');await navigator.clipboard.writeText(code);p.querySelector('[data-copy-work-code]').textContent='Copiado';});const f=id=>p.querySelector('#'+id);
  const syncReviewLink=()=>{const a=f('jobReviewOpen');try{const url=reviewUrl(f('jobReviewUrl').value);a.hidden=!url;if(url)a.href=url;else a.removeAttribute('href');}catch{a.hidden=true;a.removeAttribute('href');}};f('jobReviewUrl').addEventListener('input',syncReviewLink);syncReviewLink();
  p.querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>window.jdOpenOrder(b.dataset.order));
  p.querySelector('[data-open-finance]').onclick=()=>{p.remove();window.JDFinance?.openForJob(j.id);};
  f('jobStage').addEventListener('change',()=>{if(f('jobStage').value===stages[4]&&/terminar.*enviar.*presup|preparar.*presup/i.test(f('jobNext').value)){f('jobNext').value='Esperar respuesta del cliente y responder consultas pendientes';f('jobNextDate').value='';}});
  p.querySelector('[data-archive-job]').onclick=()=>perform(p.querySelector('[data-archive-job]'),async()=>{await update(J,j.id,base,{...j,archivedAt:j.archivedAt?null:now()});p.remove();});
  p.querySelector('[data-save]').onclick=()=>perform(p.querySelector('[data-save]'),async()=>{
   const value={...j,title:f('jobTitle').value.trim(),stage:f('jobStage').value,event:f('jobEvent').value,eventType:f('jobEventType').value,postEventReminder:f('jobPostEvent').checked,anniversaryReminder:f('jobAnniversary').checked,firstContact:f('jobContact').value,approvedAt:f('jobApproved').value,deliveredAt:f('jobDelivered').value,deadline:f('jobDeadline').value,next:f('jobNext').value.trim(),nextDate:f('jobNextDate').value,priority:f('jobPriority').value,notes:f('jobNotes').value.trim(),reviewUrl:reviewUrl(f('jobReviewUrl').value),qualityApprovedAt:f('jobQuality').value,updatedAt:now(),legacy:false};
   const supplierOrders=collectPrint();if(supplierOrders.length||j.supplierOrders)value.supplierOrders=supplierOrders;
   value.opsChecks=Object.fromEntries(PREPRINT_CHECKS.map(([key])=>{const old=j.opsChecks?.[key]||{};const ok=f('jdOp-'+key).checked,evidence=f('jdOpEvidence-'+key).value.trim();return [key,{ok,evidence,checkedAt:ok?(old.ok&&old.evidence===evidence?old.checkedAt||now():now()):null}];}));
   const enteringProduction=stages.indexOf(value.stage)>=11&&stages.indexOf(stageOf(j.stage))<11;
   const remaining=missingPreprint(value);
   if(!value.title)throw Error('Indicá el trabajo.');if(order&&value.stage!==stageOf(j.stage)&&stages.indexOf(value.stage)>=6&&stages.indexOf(value.stage)<=16&&paid(order)<order.quantity.price&&order.paymentTerms!=='partial')throw Error('Falta cobrar el 100%. Si acordaste un pago parcial, registrá la excepción y su vencimiento desde Cobros.');if([stages[15],stages[16]].includes(value.stage)&&!value.qualityApprovedAt)throw Error('Falta aprobar el control de calidad de lo recibido de imprenta.');
   if(enteringProduction&&remaining.length)throw Error('Antes de liberar a imprenta faltan controles del Manual JD: '+remaining.map(x=>x[1]).join(' · '));

   value.history=[...(j.history||[])];
   value.history.push(...printHistory(j.supplierOrders,value.supplierOrders));
   if(stageOf(j.stage)!==value.stage)value.history.push({at:now(),type:'Etapa',text:stageOf(j.stage)+' → '+value.stage,stage:value.stage});
   if((j.reviewUrl||'')!==value.reviewUrl)value.history.push({at:now(),type:'Muestra / revisión',text:value.reviewUrl?'Link de revisión '+(j.reviewUrl?'actualizado':'registrado')+': '+value.reviewUrl+(j.reviewUrl?' · Anterior: '+j.reviewUrl:''):'Link de revisión quitado. Anterior: '+j.reviewUrl});
   if(PREPRINT_CHECKS.some(([key])=>Boolean(j.opsChecks?.[key]?.ok)!==Boolean(value.opsChecks?.[key]?.ok)||String(j.opsChecks?.[key]?.evidence||'')!==String(value.opsChecks?.[key]?.evidence||'')))value.history.push({at:now(),type:'Control operativo',text:'Checklist preimpresión actualizado; verificaciones completas: '+(PREPRINT_CHECKS.length-remaining.length)+' de '+PREPRINT_CHECKS.length+'. No equivale a aprobación automática del PDF.'});
   const text=f('jobHistText').value.trim(),date=f('jobHistAt').value;if(text)value.history.push({at:date?new Date(date).toISOString():now(),type:f('jobHistType').value,text});
   for(const [key,label] of [['firstContact','Primer contacto'],['approvedAt','Aprobación del presupuesto'],['deliveredAt','Entrega efectiva'],['event','Fecha del evento']]){
    if((j[key]||'')!==value[key])value.history.push({at:now(),type:'Hito de fecha',text:label+': '+(value[key]||'Sin fecha registrada')+' (anterior: '+(j[key]||'sin fecha')+')'});
   }
   if(!base&&!value.history.length)value.history.push({at:now(),type:'Trabajo',text:'Trabajo registrado; las fechas anteriores no registradas se conservan como desconocidas.'});
   await update(J,j.id,base,value);p.remove();
  });
 }
 function activeJobs(){const cs=read(C);return jobs().filter(j=>!j.archivedAt&&!j.deletedAt&&!j.quoteTrashAt&&stageOf(j.stage)!==stages[18]&&cs.some(c=>identity(c)===j.clientId&&!c.deletedAt&&!c.archivedAt));}
 function renderDashboard(){
  const dash=document.getElementById('dashboard');if(!dash)return;let section=dash.querySelector('#jdWorkPriorities');if(!section){section=[...dash.querySelectorAll('.section')].find(s=>s.querySelector('h2')?.textContent==='Seguimientos prioritarios');if(!section){section=document.createElement('div');section.className='section';dash.append(section);}section.id='jdWorkPriorities';}
  const grid=dash.querySelector(':scope > .grid.cards');if(grid&&section.nextElementSibling!==grid)grid.before(section);
  const cs=read(C),js=activeJobs(),orders=read(O),tasks=read(T).filter(t=>!t.doneAt),date=today();
  const actions=js.filter(j=>stageOf(j.stage)!==stages[16]&&stageOf(j.stage)!==stages[17]).map(j=>({job:j,title:cs.find(c=>identity(c)===j.clientId)?.name+' · '+j.title,text:j.next||j.stage,due:j.nextDate||j.deadline||'',priority:j.priority||'Normal'}));
  for(const j of js){if(stages.indexOf(stageOf(j.stage))>=10&&stages.indexOf(stageOf(j.stage))<14){const missing=missingPreprint(j);if(missing.length)actions.push({job:j,title:'CONTROL JD · '+(cs.find(c=>identity(c)===j.clientId)?.name||j.title),text:'Antes de imprenta: '+missing.map(x=>x[1]).join(' · '),due:j.nextDate||j.deadline||'',priority:'Alta'});}}
  const financialJobs=jobs().filter(j=>!j.deletedAt&&cs.some(c=>identity(c)===j.clientId&&!c.deletedAt));
  for(const j of financialJobs){const o=orders.find(o=>o.id===j.orderId||(j.quoteIds||[]).includes(o.quoteId));if(o&&o.quantity.price-paid(o)>0)actions.push({job:j,title:'Saldo pendiente · '+o.client,text:money(o.quantity.price-paid(o))+(o.paymentTerms==='partial'?' · excepción de pago parcial':' · 100% antes de iniciar'),due:o.balanceDue||j.deadline||'',priority:'Alta',quoteId:o.quoteId});}
  for(const t of tasks)actions.push({task:t,title:t.title,text:'Tarea interna',due:t.due||'',priority:t.priority||'Normal'});
  const greetingJobs=jobs().filter(j=>!j.deletedAt&&!j.quoteTrashAt&&[stages[16],stages[17]].includes(stageOf(j.stage))&&cs.some(c=>identity(c)===j.clientId&&!c.deletedAt&&!c.archivedAt));
  for(const j of greetingJobs)for(const a of greetingActions(j,date))actions.push({job:j,title:a.label+' · '+cs.find(c=>identity(c)===j.clientId)?.name,text:a.text,due:a.due,priority:'Normal',greeting:a.key});
  const weight={Urgente:0,Alta:1,Normal:2};actions.sort((a,b)=>(a.due&&a.due<=date?0:1)-(b.due&&b.due<=date?0:1)||(weight[a.priority]-weight[b.priority])||(a.due||'9999').localeCompare(b.due||'9999'));
  section.innerHTML='<div class="section-head"><h2>Prioridades y próximos pasos</h2><button class="btn sm" data-task-new>+ Tarea interna</button></div><div class="jd-action-list">'+(actions.map((a,i)=>'<div class="jd-action-item '+(a.due&&a.due<date?'overdue':'')+'"><div class="jd-action-main">'+(a.job?codeMarkup(a.job.id):'')+'<b>'+esc(a.title)+'</b><small>'+esc(a.priority)+' · '+esc(a.due?fmt(a.due):'Sin fecha')+'</small></div><div class="jd-action-copy">'+esc(a.text)+'</div><div class="jd-action-cta"><button class="btn sm" data-action="'+i+'">'+(a.task?'Completar':a.greeting?'Marcar saludo enviado':'Abrir trabajo')+'</button></div></div>').join('')||'<p class="muted">No hay tareas pendientes.</p>')+'</div>';
  let seasonPanel=dash.querySelector('#jdSeasonalPlanner');
  if(!seasonPanel){seasonPanel=document.createElement('div');seasonPanel.id='jdSeasonalPlanner';dash.append(seasonPanel);}
  const seasons=[
    {id:'luaj',name:'Lúaj institucional',window:'4–6 meses antes de Rosh Hashaná',audience:'Kehilot, colegios e instituciones',offer:'Lúaj personalizado, coordinación de avisos, maquetación y edición anual',content:'Mostrar interiores reales, continuidad entre ediciones y plazos para anunciantes'},
    {id:'rosh',name:'Rosh Hashaná',window:'2–4 meses antes de la festividad',audience:'Familias, comunidades y regalos institucionales',offer:'Simanim, Birkonim, tarjetas y piezas coordinadas de Yamim Noraim',content:'Carruseles de productos, opciones de personalización y ejemplos de textos aprobados'},
    {id:'pesaj',name:'Pésaj',window:'2–4 meses antes de la festividad',audience:'Familias, instituciones y eventos comunitarios',offer:'Hagadot, tarjetas, materiales de Seder y piezas editoriales',content:'Interiores, versiones y guía para pedir con anticipación'}
  ];
  seasonPanel.innerHTML='<div class="section jd-marketing-season"><div class="section-head"><h2>Marketing por temporada · basado en el Lúaj</h2><small>Planificación, no publicación automática</small></div><p class="small muted">El Lúaj editorial verificado define festividades y fechas; las campañas se planifican hacia atrás considerando plazos de diseño, imprenta y entrega. No usamos fechas inventadas, ni publicamos contenido halájico sin revisar su máster.</p><div class="jd-seasons-grid">'+seasons.map((x,i)=>'<article class="jd-season-card"><b>'+esc(x.name)+'</b><small>'+esc(x.window)+'</small><p><strong>Para:</strong> '+esc(x.audience)+'</p><p><strong>Ofrecer:</strong> '+esc(x.offer)+'</p><p><strong>Publicar:</strong> '+esc(x.content)+'</p><button class="btn sm" data-season-task="'+esc(x.id)+'">Planificar campaña</button></article>').join('')+'</div><p class="small muted"><strong>Contenido del Lúaj:</strong> efemérides, Parashá y fechas judías verificadas pueden alimentar posts útiles y mostrar productos afines con llamados a WhatsApp. Nunca incluir información privada de instituciones ni anunciar disponibilidad sin verificarla.</p></div>';
  seasonPanel.querySelectorAll('[data-season-task]').forEach(b=>b.onclick=()=>{
   const idea=seasons.find(x=>x.id===b.dataset.seasonTask);if(!idea)return;
   const form=shell('Planificar campaña · '+idea.name,'MARKETING JD','<div class="jd-work-content jd-work-grid">'+input('seasonTaskTitle','Próxima acción','Preparar campaña '+idea.name)+input('seasonTaskDue','Fecha a realizar','','date')+'<div class="jd-work-wide"><p><b>Momento recomendado:</b> '+esc(idea.window)+'</p><small>Elegí una fecha real según el Lúaj verificado y la capacidad de producción; no se programará ninguna tarea sin tu confirmación.</small></div></div>','<button class="btn primary" data-save>Guardar tarea</button>');
   form.querySelector('[data-save]').onclick=()=>perform(form.querySelector('[data-save]'),async()=>{
     const label=form.querySelector('#seasonTaskTitle').value.trim(),due=form.querySelector('#seasonTaskDue').value;
     if(!label||!due)throw Error('Indicá la tarea y su fecha según el Lúaj.');
     const newTask={id:'task-'+crypto.randomUUID(),title:label,due,priority:'Normal',created:now(),type:'marketing',season:idea.id};
     await update(T,newTask.id,null,newTask);form.remove();
   });
  });
  let leadPanel=dash.querySelector('#jdLeadTimeAnalytics');if(!leadPanel){leadPanel=document.createElement('div');leadPanel.id='jdLeadTimeAnalytics';dash.append(leadPanel);}leadPanel.innerHTML=leadTimePanel(jobs().filter(j=>!j.deletedAt&&!j.legacy&&!j.archivedAt),orders);
  section.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{const a=actions[Number(b.dataset.action)];if(a.task)return perform(b,()=>update(T,a.task.id,a.task,{...a.task,doneAt:now()}));if(a.greeting)return perform(b,async()=>{const base=read(J).find(j=>j.id===a.job.id)||null;await update(J,a.job.id,base,{...a.job,greetings:{...a.job.greetings,[a.greeting]:now()},history:[...(a.job.history||[]),{at:now(),type:'Saludo',text:a.greeting==='post-event'?'Felicitación post evento enviada':'Saludo de aniversario enviado'}]});});if(a.quoteId)window.jdOpenOrder(a.quoteId);else openJob(a.job.id);});
  section.querySelector('[data-task-new]').onclick=()=>{const p=shell('Nueva tarea interna','PRIORIDADES','<div class="jd-work-content jd-work-grid">'+input('taskTitle','Qué hay que hacer')+input('taskDue','Para cuándo','','date')+'<label class="jd-work-field">Prioridad<select id="taskPriority"><option>Normal</option><option>Alta</option><option>Urgente</option></select></label></div>','<button class="btn primary" data-save>Guardar tarea</button>');p.querySelector('[data-save]').onclick=()=>perform(p.querySelector('[data-save]'),async()=>{const title=p.querySelector('#taskTitle').value.trim();if(!title)throw Error('Indicá la tarea.');const t={id:'task-'+crypto.randomUUID(),title,due:p.querySelector('#taskDue').value,priority:p.querySelector('#taskPriority').value,created:now()};await update(T,t.id,null,t);p.remove();});};
 }
 function bindQuoteJob(){
  const input=document.getElementById('qClient'),select=document.getElementById('qJob');if(!input||!select)return;
  const fill=()=>{const id=window.JDClientDirectory.selectedId(input),old=select.value,options=jobs().filter(j=>j.clientId===id&&!j.deletedAt&&!j.archivedAt&&!j.quoteTrashAt);select.innerHTML='<option value="">Nuevo trabajo</option>'+options.map(j=>'<option value="'+esc(j.id)+'">'+esc((workCode(j.id)?workCode(j.id)+' · ':'')+j.title)+(j.event?' · '+esc(j.event):'')+'</option>').join('');select.value=options.some(j=>j.id===old)?old:'';select.closest('.field').hidden=!id||options.length===0;};
  if(!input.dataset.workBound){input.dataset.workBound='true';input.addEventListener('input',fill);input.addEventListener('change',fill);}fill();
 }
 function refresh(){bindQuoteJob();renderClients(document.getElementById('clients')?.dataset.view||'active');renderDashboard();document.querySelectorAll('[data-client-events]').forEach(p=>{const section=p.querySelector('.jd-event-dates');if(!section)return;section.outerHTML=clientEventDates(jobs().filter(j=>j.clientId===p.dataset.clientEvents));p.querySelectorAll('[data-event-job]').forEach(b=>b.onclick=()=>openJob(b.dataset.eventJob));});}
 function mount(){refresh();loadWorkCodes();const nav=document.getElementById('nav');if(nav)new MutationObserver(()=>renderDashboard()).observe(nav,{subtree:true,attributes:true,attributeFilter:['class']});}
 window.JDWorkflow={stages,stageOf,jobs,activeJobs,history,payments,paid,read,esc,money,now,today,linked,recordQuote,openClient,openJob,renderClients,renderDashboard,bindQuoteJob,nextAnniversary,greetingActions,timings,aggregateLeadTimes,firstPaymentDate,printDurations,workCode,loadWorkCodes,refresh,mount};
})();
