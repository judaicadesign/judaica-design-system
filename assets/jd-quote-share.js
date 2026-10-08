/* Share the actual PDF file. WhatsApp draft text never contains a storage URL. */
(function(root){
 'use strict';
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function message(q){const first=q.client.trim().split(/\s+/)[0];return 'Hola '+first+', ¿cómo estás? Te envío el presupuesto de '+(q.alternatives?.length>1?'las '+q.alternatives.length+' alternativas solicitadas':q.product)+'.\n\nCualquier duda, escribime.'}
 function payload(blob,q,name){return {files:[new File([blob],name,{type:'application/pdf'})],title:'Presupuesto Judaica Design',text:message(q)}}
 function supported(data){try{return !!(navigator.share&&navigator.canShare?.({files:data.files}))}catch(e){return false}}
 function open(blob,q,options={}){
  const name=options.fileName||'Judaica Design - '+q.client+' - Presupuesto.pdf',data=payload(blob,q,name),native=supported(data),url=URL.createObjectURL(blob);
  document.querySelectorAll('.jd-file-share').forEach(el=>el.querySelector('[data-close]').click());
  const modal=document.createElement('div');modal.className='jd-pdf-modal jd-file-share';
  modal.innerHTML='<div class="jd-pdf-modal-card" style="max-width:620px"><h2>Enviar PDF · '+esc(q.client)+'</h2><p>'+(native?'Elegí WhatsApp y el destinatario en el menú de compartir. Se entrega el archivo PDF.':'Descargá el PDF y adjuntalo en WhatsApp con el clip → Documento, o arrastrá el archivo al chat.')+'</p><div class="jd-pdf-modal-actions">'+(native?'<button class="btn primary" data-share-file>Compartir archivo PDF</button>':'')+'<a class="btn" href="'+url+'" download="'+esc(name)+'" data-download>Descargar PDF</a>'+(options.getPhone?'<button class="btn '+(native?'':'primary')+'" data-wa-file>Descargar y abrir WhatsApp</button>':'')+'<button class="btn" data-close>Cerrar</button></div><p class="small muted" data-status aria-live="polite"></p><label>Mensaje para acompañar el PDF</label><textarea readonly rows="4" data-message></textarea><button class="btn sm" data-copy>Copiar mensaje</button></div>';
  modal.querySelector('[data-message]').value=data.text;
  modal.querySelector('[data-close]').onclick=()=>{URL.revokeObjectURL(url);modal.remove()};
  const status=modal.querySelector('[data-status]');
  modal.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(data.text);status.textContent='Mensaje copiado.'}catch(e){modal.querySelector('[data-message]').select();status.textContent='Copiá el texto seleccionado.'}};
  const share=modal.querySelector('[data-share-file]');
  if(share)share.onclick=()=>{share.disabled=true;return navigator.share(data).then(()=>{status.textContent='Confirmá el envío en WhatsApp.'}).catch(error=>{if(error.name!=='AbortError')status.textContent='No se pudo compartir. Podés descargar el PDF y adjuntarlo.'}).finally(()=>{share.disabled=false})};
  const wa=modal.querySelector('[data-wa-file]');
  if(wa)wa.onclick=()=>{const phone=options.getPhone();if(!phone)return;modal.querySelector('[data-download]').click();const tab=root.open('https://wa.me/'+phone+'?text='+encodeURIComponent(data.text),'_blank');status.textContent=tab?'Adjuntá el PDF descargado al chat antes de enviarlo.':'El PDF se descargó. Abrí WhatsApp y adjuntalo al chat.'};
  document.body.appendChild(modal);return modal;
 }
 function share(blob,q,options={}){const data=payload(blob,q,options.fileName||'Judaica Design - '+q.client+' - Presupuesto.pdf');if(!supported(data))return open(blob,q,options);return navigator.share(data).catch(error=>{if(error.name!=='AbortError')open(blob,q,options)})}
 root.jdQuoteShare={open,share,message};
})(window);
