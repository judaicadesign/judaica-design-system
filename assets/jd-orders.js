/* Orders are explicit, quantity-specific snapshots of saved quotes. */
(() => {
  'use strict';
  const KEY='jd_orders_v1';
    const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$ '+Number(n||0).toLocaleString('es-AR',{maximumFractionDigits:2});
  window.jdOpenOrder=function(quoteId){
    const W=window.JDWorkflow,quote=read('jd_saved_quotes_v6').find(q=>q.id===quoteId);
    const confirmedOrders=window.jdConfirmedState?.(KEY);
    const existing=(Array.isArray(confirmedOrders)?confirmedOrders:read(KEY)).find(o=>o.quoteId===quoteId);
    if(!quote&&!existing)return;
    const source=quote||existing.quoteSnapshot, alternatives=source.alternatives?.length?source.alternatives:[source];
    const quantities=(existing?[existing.quantity]:alternatives.flatMap((a,i)=>(a.quantities||[]).map(q=>({...q,alternativeIndex:i,alternativeLabel:alternatives.length>1?'Alternativa '+(i+1)+' · '+[a.product,a.model,a.texts].filter(Boolean).join(' · '):''})))).filter(q=>Number.isSafeInteger(Number(q.qty))&&q.qty>0&&Number.isFinite(Number(q.price))&&q.price>0);
    if(!quantities.length){alert('Este presupuesto no tiene cantidades válidas.');return}
    const original=existing?JSON.stringify(existing):null;
    const client=read('jd_clients').find(c=>W.linked(source,c));
    const workBaseline=(window.jdConfirmedState?.('jd_jobs_v1')||read('jd_jobs_v1')).find(j=>(j.quoteIds||[]).includes(quoteId))||null,currentWork=W.jobs().find(j=>(j.quoteIds||[]).includes(quoteId));
    let ledger=structuredClone(W.payments(existing));
    const panel=document.createElement('div');panel.className='jd-crm-modal jd-work-modal';
    panel.innerHTML='<div class="jd-crm-card"><div class="jd-crm-head"><div><div class="eyebrow">PEDIDO Y COBROS</div><h2>'+esc(source.client)+'</h2></div><button class="btn" data-close>Cerrar</button></div><div class="jd-work-content"><div class="jd-work-grid">'+
      '<label class="jd-work-field">Cantidad aceptada<select id="jdOrderQty" '+(existing?'disabled':'')+'>'+quantities.map((q,i)=>'<option value="'+i+'">'+esc(q.alternativeLabel?q.alternativeLabel+' · ':'')+q.qty+' u. · '+money(q.price)+'</option>').join('')+'</select></label>'+
      '<label class="jd-work-field">Estado del trabajo<select id="jdOrderStage">'+W.stages.map(s=>'<option '+(s===W.stageOf(existing?(currentWork?.stage||existing.stage):W.stages[5])?'selected':'')+'>'+esc(s)+'</option>').join('')+'</select></label>'+
      '<label class="jd-work-field">Acuerdo de pago<select id="jdOrderTerms"><option value="full">100% antes de iniciar · regla habitual</option><option value="partial">Excepción · pagos parciales acordados</option></select></label>'+
      '<label class="jd-work-field">Vencimiento del saldo<input id="jdOrderBalanceDue" type="date" value="'+esc(existing?.balanceDue||'')+'"></label>'+
      '<label class="jd-work-field">Fecha real de aceptación del presupuesto<input id="jdOrderApprovedAt" type="date" value="'+esc(currentWork?.approvedAt??existing?.approvedAt??'')+'"></label>'+ 
 '<label class="jd-work-field">Entrega comprometida<input id="jdOrderDeadline" type="date" value="'+esc(currentWork?.deadline??existing?.deadline??source.deadline??'')+'"></label>'+
      '<label class="jd-work-field">Control de calidad aprobado<input id="jdOrderQuality" type="date" value="'+esc(currentWork?.qualityApprovedAt||existing?.qualityApprovedAt||'')+'"></label>'+
      '<label class="jd-work-field jd-work-wide">Dirección y destinatario<textarea id="jdOrderAddress">'+esc(existing?.address||[client?.deliveryRecipient,client?.address,client?.city,client?.postalCode,client?.country].filter(Boolean).join(' · '))+'</textarea></label>'+
      '<label class="jd-work-field jd-work-wide">Notas del pedido / cobros<textarea id="jdOrderNotes">'+esc(existing?.notes||'')+'</textarea></label></div><div class="jd-payment-summary" id="jdOrderTotals"></div><h3>Pagos registrados</h3><div id="jdPaymentList" class="jd-payments-list"></div><details open><summary>+ Registrar un pago</summary><div class="jd-work-grid">'+
      '<label class="jd-work-field">Importe original<input id="jdPaymentAmount" type="number" min="0.01" step="0.01"></label><label class="jd-work-field">Moneda<select id="jdPaymentCurrency"><option>ARS</option><option>USD</option><option>USDT</option></select></label>'+
      '<label class="jd-work-field">Fecha del pago<input id="jdPaymentDate" type="date" value="'+W.today()+'"></label><label class="jd-work-field">Medio<select id="jdPaymentMethod"><option>Transferencia bancaria</option><option>Efectivo</option><option>Zelle</option><option>USDT</option><option>Otro</option></select></label>'+
      '<label class="jd-work-field">Tipo de cambio aplicado · ARS por unidad<input id="jdPaymentRate" type="number" min="0.000001" step="any" value="1" readonly></label><label class="jd-work-field">Referencia / comprobante<input id="jdPaymentReference"></label></div><p id="jdPaymentEquivalent" class="small muted"></p><button class="btn sm" data-add-payment>Agregar pago al registro</button><p class="small muted">Se guarda al pulsar Guardar pedido. Conservamos la moneda, el medio y el cambio aplicado en ese momento.</p></details><p class="small muted">El precio aceptado queda congelado. Los pagos anteriores sin detalle se identifican como registro previo.</p></div><div class="jd-crm-footer"><button class="btn primary" data-save>'+ (existing?'Guardar pedido':'Crear pedido confirmado')+'</button></div></div>';
    document.body.appendChild(panel);const f=id=>panel.querySelector('#'+id), quantity=()=>quantities[Number(f('jdOrderQty').value)];
    f('jdOrderTerms').value=existing?.paymentTerms||'full';
    const totalPaid=()=>Math.round(ledger.filter(p=>!p.voidedAt).reduce((n,p)=>n+p.ars,0)*100)/100;
    const totals=()=>{const q=quantity(),paid=totalPaid();f('jdOrderTotals').innerHTML='<b>Total aceptado: '+money(q.price)+'</b><span>Cobrado: '+money(paid)+'</span><b>Saldo: '+money(q.price-paid)+'</b><span>Ganancia bruta estimada: '+(Number.isFinite(q.profit)?money(q.profit):'No disponible')+'</span>';};
    const renderPayments=()=>{totals();f('jdPaymentList').innerHTML=ledger.map((p,i)=>'<div class="jd-work-row"><div><b>'+esc(p.currency)+' '+Number(p.amount).toLocaleString('es-AR')+'</b><small>'+esc(p.legacy?'Fecha original no registrada':p.date?.slice(0,10)||'Fecha no registrada')+' · '+esc(p.method)+' · ARS '+Number(p.ars).toLocaleString('es-AR')+' · cambio '+p.rate+'</small><small>'+esc(p.reference||'')+(p.legacy?' · Importe acumulado previo; fecha original y medio desconocidos.':'')+(p.voidedAt?' · ANULADO: '+esc(p.voidReason):'')+'</small></div>'+(!p.voidedAt?'<button class="btn sm" data-void="'+i+'">Anular</button>':'')+'</div>').join('')||'<p class="muted">Todavía no hay pagos.</p>';f('jdPaymentList').querySelectorAll('[data-void]').forEach(b=>b.onclick=()=>{const reason=prompt('Motivo de la anulación (el registro se conserva):');if(!reason?.trim())return;ledger[+b.dataset.void]={...ledger[+b.dataset.void],voidedAt:W.now(),voidReason:reason.trim()};renderPayments();});};
    const equiv=()=>{f('jdPaymentEquivalent').textContent='Equivalente a registrar: '+money(Number(f('jdPaymentAmount').value)*Number(f('jdPaymentRate').value));};
    f('jdPaymentCurrency').onchange=()=>{const ars=f('jdPaymentCurrency').value==='ARS';f('jdPaymentRate').readOnly=ars;f('jdPaymentRate').value=ars?'1':'';equiv();};f('jdPaymentRate').oninput=equiv;f('jdPaymentAmount').oninput=equiv;
    panel.querySelector('[data-add-payment]').onclick=()=>{const amount=Number(f('jdPaymentAmount').value),rate=Number(f('jdPaymentRate').value),date=f('jdPaymentDate').value,ars=Math.round(amount*rate*100)/100;if(!Number.isFinite(amount)||amount<=0||!Number.isFinite(rate)||rate<=0||!date||!f('jdPaymentDate').checkValidity()||!Number.isFinite(ars)||ars<=0){alert('Revisá importe, fecha y tipo de cambio aplicado.');return}if(totalPaid()+ars>quantity().price){alert('El pago supera el total del pedido.');return}ledger.push({id:'payment-'+crypto.randomUUID(),amount,currency:f('jdPaymentCurrency').value,rate,ars,date,method:f('jdPaymentMethod').value,reference:f('jdPaymentReference').value.trim(),recordedAt:W.now()});f('jdPaymentAmount').value='';f('jdPaymentReference').value='';renderPayments();};
    f('jdOrderQty').onchange=totals;renderPayments();panel.querySelector('[data-close]').onclick=()=>panel.remove();
    panel.querySelector('[data-save]').onclick=async()=>{
      const button=panel.querySelector('[data-save]');if(button.disabled)return;
      const q=quantity(),paid=totalPaid(),stage=f('jdOrderStage').value,deadline=f('jdOrderDeadline').value,terms=f('jdOrderTerms').value,balanceDue=f('jdOrderBalanceDue').value;
      if(f('jdPaymentAmount').value){alert('Agregá el pago al registro antes de guardar.');return}
      if(!Number.isFinite(paid)||paid<0||paid>q.price){alert('El importe cobrado debe estar entre cero y el total del pedido.');return}
      if(W.stages.indexOf(stage)>=6&&W.stages.indexOf(stage)<=16&&paid<q.price&&terms!=='partial'){alert('Para iniciar o continuar el diseño falta cobrar el 100%. Si acordaste pagos parciales, registrá la excepción y el vencimiento del saldo.');return}
      if(terms==='partial'&&paid<q.price&&!balanceDue){alert('Indicá cuándo vence el saldo del acuerdo de pagos parciales.');return}
      if([W.stages[15],W.stages[16]].includes(stage)&&!f('jdOrderQuality').value){alert('Falta aprobar el control de calidad antes de coordinar o marcar la entrega.');return}
      const at=W.now(),order={...existing,id:existing?.id||'order-'+crypto.randomUUID(),quoteId,client:source.client,clientId:client?window.JDClientDirectory.stableId(client):source.clientId||null,product:existing?.product||alternatives[q.alternativeIndex||0].product,selectedAlternative:existing?.selectedAlternative||structuredClone(alternatives[q.alternativeIndex||0]),quantity:structuredClone(q),payments:ledger,paid,balance:Math.round((q.price-paid)*100)/100,paymentTerms:terms,balanceDue,stage,approvedAt:f('jdOrderApprovedAt').value||existing?.approvedAt||'',deadline,event:currentWork?.event??existing?.event??source.event??'',eventType:currentWork?.eventType??existing?.eventType??source.eventType??'generic',qualityApprovedAt:f('jdOrderQuality').value,address:f('jdOrderAddress').value.trim(),notes:f('jdOrderNotes').value.trim(),created:existing?.created||at,updatedAt:at,quoteSnapshot:existing?.quoteSnapshot||structuredClone(source),history:[...(existing?.history||[]),{at,stage,paid,type:'Pedido',text:stage+' · cobrado '+money(paid)+' · saldo '+money(q.price-paid)}]};
      button.disabled=true;
      try{await window.jdUpdateSharedState([KEY,'jd_jobs_v1','jd_finance_moves_v1'],state=>{
        const orders=state[KEY]||[];if(!Array.isArray(orders))throw Error('No se pudieron verificar los pedidos.');
        const i=orders.findIndex(o=>o.quoteId===quoteId);if((i>=0?JSON.stringify(orders[i]):null)!==original)throw Error('Este pedido cambió en otro dispositivo. Volvé a abrirlo.');
        if(i<0)orders.unshift(order);else orders[i]=order;
        const jobs=state.jd_jobs_v1||[];if(!Array.isArray(jobs))throw Error('No se pudieron verificar los trabajos.');
        let job=jobs.find(j=>(j.quoteIds||[]).includes(quoteId));if(JSON.stringify(job||null)!==JSON.stringify(workBaseline))throw Error('El trabajo cambió en otro dispositivo. Volvé a abrir el pedido.');
        if(!job){const legacy=W.jobs().find(j=>(j.quoteIds||[]).includes(quoteId));job=legacy?structuredClone(legacy):{id:'work-'+crypto.randomUUID(),clientId:order.clientId,title:source.product,created:at,quoteIds:[quoteId],history:[]};jobs.push(job);}
        const previousJob=structuredClone(job);job.orderId=order.id;job.stage=stage;job.approvedAt=order.approvedAt||job.approvedAt||'';job.deadline=deadline;job.event=order.event;job.eventType=order.eventType;job.qualityApprovedAt=order.qualityApprovedAt;job.updatedAt=at;W.syncNextAction(previousJob,job,at);
        const moves=state.jd_finance_moves_v1||[];if(!Array.isArray(moves))throw Error('No se pudo verificar Caja.');
        for(const payment of ledger){
          if(payment.legacy||!payment.id)continue;
          const id='customer-payment:'+order.id+':'+payment.id,index=moves.findIndex(x=>x.id===id),prior=index>=0?moves[index]:{};
          const movement={...prior,id,jobId:job.id,orderId:order.id,customerPaymentId:payment.id,kind:'Ingreso',category:'Cobro de cliente',status:'Realizado',currency:'ARS',amount:payment.ars,date:payment.date,method:payment.method,detail:source.client+' · '+(order.product||job.title||''),originalCurrency:payment.currency,originalAmount:payment.amount,rate:payment.rate,reference:payment.reference,voidAt:payment.voidedAt||null,voidReason:payment.voidReason||'',createdAt:prior.createdAt||payment.recordedAt||at,updatedAt:at};
          if(index<0)moves.push(movement);else moves[index]=movement;
        }
        return {[KEY]:orders,jd_jobs_v1:jobs,jd_finance_moves_v1:moves};
      });panel.remove();decorate();W.refresh();}catch(error){alert(error.message||'No se pudo guardar el pedido.')}finally{button.disabled=false}
    };
  };
  function decorate(){
    document.querySelectorAll('#savedQuotes [data-open-qid]').forEach(open=>{
      const quote=read('jd_saved_quotes_v6').find(q=>q.id===open.dataset.openQid);
      const toolbar=open.parentElement;
      if(!quote||window.JDWorkflow.quoteLifecycle(quote).lane!=='pending'||quote.status!=='Preparado para compartir'||toolbar.querySelector('[data-confirm-sent]'))return;
      const button=document.createElement('button');button.className='btn sm';button.dataset.confirmSent=quote.id;button.textContent='Confirmar enviado';
      button.onclick=async()=>{
        if(!confirm('¿Confirmás que efectivamente enviaste este presupuesto al cliente? Abrir WhatsApp no lo envía automáticamente.'))return;
        button.disabled=true;
        try{
          await window.jdUpdateSharedState(['jd_saved_quotes_v6','jd_clients','jd_jobs_v1'],state=>{
            const quotes=state.jd_saved_quotes_v6,clients=state.jd_clients;
            if(!Array.isArray(quotes)||!Array.isArray(clients))throw Error('No se pudieron verificar los datos.');
            const q=quotes.find(q=>q.id===quote.id);if(!q)throw Error('El presupuesto ya no está disponible.');
            q.status='Presupuesto enviado';q.sentConfirmedAt=new Date().toISOString();
            const jobs=state.jd_jobs_v1||[];const job=jobs.find(j=>(j.quoteIds||[]).includes(q.id));if(job){job.history=[...(job.history||[]),{at:q.sentConfirmedAt,type:'Presupuesto enviado',text:'Envío confirmado al cliente.'}];if(window.JDWorkflow.stages.indexOf(job.stage)<5){job.stage=window.JDWorkflow.stages[4];job.next='Consultar respuesta al presupuesto';}}
            return {jd_saved_quotes_v6:quotes,jd_clients:clients,jd_jobs_v1:jobs};
          });
          window.jdRenderSavedQuotes?.();
        }catch(error){alert(error.message)}finally{button.disabled=false}
      };
      toolbar.appendChild(button);
    });
    document.querySelectorAll('#savedQuotes [data-open-qid]').forEach(open=>{
      const toolbar=open.parentElement;
      const present=toolbar.querySelector('[data-order-qid]');
      const label=read(KEY).some(o=>o.quoteId===open.dataset.openQid)?'Ver pedido':'Aceptar → pedido';
      if(present){if(present.textContent!==label)present.textContent=label;return}
      const button=document.createElement('button');button.className='btn sm';button.dataset.orderQid=open.dataset.openQid;
      button.textContent=label;
      button.onclick=()=>window.jdOpenOrder(button.dataset.orderQid);toolbar.appendChild(button);
    });
  }
  document.addEventListener('jd-app-ready',()=>{decorate();new MutationObserver(decorate).observe(document.querySelector('main')||document.body,{childList:true,subtree:true})});
  window.addEventListener('jd-shared-ready',decorate);
})();


