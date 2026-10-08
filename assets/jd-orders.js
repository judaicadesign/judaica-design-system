/* Orders are explicit, quantity-specific snapshots of saved quotes. */
(() => {
  'use strict';
  const KEY='jd_orders_v1';
  const stages=['Aceptado · esperando seña','Diseño','Aprobación del cliente','Listo para imprenta','En imprenta','Listo para entregar','Entregado','Cancelado'];
  const read=key=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return []}};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>'$ '+Number(n||0).toLocaleString('es-AR',{maximumFractionDigits:2});
  window.jdOpenOrder=function(quoteId){
    const quote=read('jd_saved_quotes_v6').find(q=>q.id===quoteId);
    if(!quote)return;
    const existing=read(KEY).find(o=>o.quoteId===quoteId);
    const quantities=(existing?[existing.quantity]:quote.quantities||[]).filter(q=>Number.isSafeInteger(Number(q.qty))&&q.qty>0&&Number.isFinite(Number(q.price))&&q.price>0);
    if(!quantities.length){alert('Este presupuesto no tiene cantidades válidas.');return}
    const original=existing?JSON.stringify(existing):null;
    const client=read('jd_clients').find(c=>c.name===quote.client);
    const panel=document.createElement('div');panel.className='jd-crm-modal';
    panel.innerHTML='<div class="jd-crm-card"><div class="jd-crm-head"><div><div class="eyebrow">PEDIDO</div><h2>'+esc(quote.client)+'</h2><p>'+esc(quote.product)+'</p></div><button class="btn" data-close>Cerrar</button></div><div class="jd-crm-panel"><div class="jd-crm-form">'+
      '<div class="jd-crm-field"><label>Cantidad aceptada</label><select id="jdOrderQty" '+(existing?'disabled':'')+'>'+quantities.map((q,i)=>'<option value="'+i+'">'+q.qty+' u. · '+money(q.price)+'</option>').join('')+'</select></div>'+
      '<div class="jd-crm-field"><label>Estado del trabajo</label><select id="jdOrderStage">'+stages.map(s=>'<option '+(s===existing?.stage?'selected':'')+'>'+esc(s)+'</option>').join('')+'</select></div>'+
      '<div class="jd-crm-field"><label>Importe cobrado acumulado (seña + pagos)</label><input id="jdOrderPaid" inputmode="decimal" type="number" min="0" step="0.01" value="'+Number(existing?.paid||0)+'"></div>'+
      '<div class="jd-crm-field"><label>Entrega comprometida</label><input id="jdOrderDeadline" type="date" value="'+esc(existing?.deadline||quote.deadline||'')+'"></div>'+
      '<div class="jd-crm-field jd-crm-span2"><label>Dirección y destinatario de entrega</label><textarea id="jdOrderAddress">'+esc(existing?.address||[client?.deliveryRecipient,client?.address,client?.city,client?.postalCode,client?.country].filter(Boolean).join(' · '))+'</textarea></div>'+
      '<div class="jd-crm-field jd-crm-span2"><label>Notas del trabajo</label><textarea id="jdOrderNotes">'+esc(existing?.notes||'')+'</textarea></div></div><div class="jd-profit" id="jdOrderTotals"></div><p class="small muted">El precio aceptado queda congelado. Actualizar costos por inflación no modifica este pedido.</p></div><div class="jd-crm-footer"><button class="btn primary" data-save>'+ (existing?'Guardar pedido':'Crear pedido confirmado')+'</button></div></div>';
    document.body.appendChild(panel);
    const field=id=>panel.querySelector('#'+id);
    const quantity=()=>quantities[Number(field('jdOrderQty').value)];
    const totals=()=>{const q=quantity();const paid=Number(field('jdOrderPaid').value||0);field('jdOrderTotals').innerHTML='<b>Total aceptado: '+money(q.price)+'</b><span>Saldo: '+money(q.price-paid)+'</span><span>Ganancia bruta estimada: '+(Number.isFinite(q.profit)?money(q.profit):'No disponible en esta versión anterior')+'</span><small>Antes de impuestos.</small>'};
    field('jdOrderQty').onchange=totals;field('jdOrderPaid').oninput=totals;totals();
    panel.querySelector('[data-close]').onclick=()=>panel.remove();
    panel.querySelector('[data-save]').onclick=async()=>{
      const button=panel.querySelector('[data-save]');if(button.disabled)return;
      const q=quantity(),raw=field('jdOrderPaid').value,paid=Number(raw);
      if(!raw||!Number.isFinite(paid)||paid<0||paid>q.price){alert('El importe cobrado debe estar entre cero y el total del pedido.');return}
      const stage=field('jdOrderStage').value,deadline=field('jdOrderDeadline').value;
      if(deadline&&!field('jdOrderDeadline').checkValidity()){alert('Revisá la fecha de entrega.');return}
      const at=new Date().toISOString();
      const order={...existing,id:existing?.id||'order-'+crypto.randomUUID(),quoteId,client:quote.client,clientId:client?.id||null,product:quote.product,quantity:structuredClone(q),paid,balance:Math.round((q.price-paid)*100)/100,stage,deadline,address:field('jdOrderAddress').value.trim(),notes:field('jdOrderNotes').value.trim(),created:existing?.created||at,updatedAt:at,quoteSnapshot:existing?.quoteSnapshot||structuredClone(quote),history:[...(existing?.history||[]),{at,stage,paid}]};
      button.disabled=true;
      try{
        await window.jdUpdateSharedState([KEY],state=>{
          const orders=state[KEY]||[];if(!Array.isArray(orders))throw Error('No se pudieron verificar los pedidos.');
          const i=orders.findIndex(o=>o.quoteId===quoteId);
          if(i>=0&&JSON.stringify(orders[i])!==original)throw Error('Este pedido cambió en otro dispositivo. Volvé a abrirlo.');
          if(original&&i<0)throw Error('No se encontró el pedido original.');
          if(i<0)orders.unshift(order);else orders[i]=order;
          return {[KEY]:orders};
        });
        panel.remove();decorate();
      }catch(error){alert(error.message||'No se pudo guardar el pedido.')}finally{button.disabled=false}
    };
  };
  function decorate(){
    document.querySelectorAll('#savedQuotes [data-open-qid]').forEach(open=>{
      const quote=read('jd_saved_quotes_v6').find(q=>q.id===open.dataset.openQid);
      const toolbar=open.parentElement;
      if(!quote||quote.status!=='Preparado para compartir'||toolbar.querySelector('[data-confirm-sent]'))return;
      const button=document.createElement('button');button.className='btn sm';button.dataset.confirmSent=quote.id;button.textContent='Confirmar enviado';
      button.onclick=async()=>{
        if(!confirm('¿Confirmás que efectivamente enviaste este presupuesto al cliente? Abrir WhatsApp no lo envía automáticamente.'))return;
        button.disabled=true;
        try{
          await window.jdUpdateSharedState(['jd_saved_quotes_v6','jd_clients'],state=>{
            const quotes=state.jd_saved_quotes_v6,clients=state.jd_clients;
            if(!Array.isArray(quotes)||!Array.isArray(clients))throw Error('No se pudieron verificar los datos.');
            const q=quotes.find(q=>q.id===quote.id);if(!q)throw Error('El presupuesto ya no está disponible.');
            q.status='Presupuesto enviado';q.sentConfirmedAt=new Date().toISOString();
            const client=clients.find(c=>c.name===q.client);
            if(client){client.history=[...(client.history||[]),{at:q.sentConfirmedAt,type:'Presupuesto',text:'Envío confirmado por el equipo: '+q.id}];if(/consulta|presupuesto listo|esperando respuesta/i.test(client.status||''))client.status='Presupuesto enviado';}
            return {jd_saved_quotes_v6:quotes,jd_clients:clients};
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
