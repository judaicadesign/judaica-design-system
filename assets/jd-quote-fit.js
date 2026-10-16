/* Render preview and PDF from the same point-based master. No font shrink or screenshots. */
(()=>{
 let observed=null,observer=null,revision=0,timer=null;
 async function refresh(){const preview=document.getElementById('quotePreview');if(!preview||!window.jdQuotePreviewSVG)return;const version=++revision,sheets=[...preview.querySelectorAll('.jd-master-sheet')];
  for(let i=0;i<sheets.length;i++){
   const sheet=sheets[i];sheet.setAttribute('aria-busy','true');
   if(!sheet.querySelector(':scope>.jd-master-art,:scope>.jd-preview-loading')){const pending=document.createElement('div');pending.className='jd-preview-loading';pending.textContent='Preparando vista previa…';sheet.appendChild(pending);}
   try{const svg=await window.jdQuotePreviewSVG(window.jdNativeQuote.readSheet(sheet),i+1,sheets.length);if(version!==revision||!sheet.isConnected)return;sheet.querySelectorAll(':scope>.jd-master-art,:scope>.jd-preview-error,:scope>.jd-preview-loading').forEach(el=>el.remove());sheet.insertAdjacentHTML('beforeend',svg);sheet.classList.add('jd-has-art');sheet.setAttribute('aria-busy','false')}
   catch(error){if(version!==revision||!sheet.isConnected)return;sheet.querySelectorAll(':scope>.jd-master-art,:scope>.jd-preview-error,:scope>.jd-preview-loading').forEach(el=>el.remove());sheet.classList.remove('jd-has-art');sheet.setAttribute('aria-busy','false');const notice=document.createElement('div');notice.className='jd-preview-error';notice.textContent='No se pudo dibujar la vista previa: '+error.message;const retry=document.createElement('button');retry.type='button';retry.className='btn sm';retry.textContent='Reintentar vista previa';retry.onclick=()=>refresh();notice.appendChild(retry);sheet.appendChild(notice)}
  }
 }
 function bind(){const preview=document.getElementById('quotePreview');if(!preview)return false;if(observed!==preview){observer?.disconnect();observed=preview;observer=new MutationObserver(schedule);observer.observe(preview,{childList:true});}return true;}
 function schedule(){clearTimeout(timer);timer=setTimeout(()=>{if(bind())refresh()},60);}
 function start(){if(bind())schedule();}
 document.addEventListener('jd-app-ready',start);window.addEventListener('jd-shared-ready',start);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 document.addEventListener('jd-quote-rendered',start);
 window.jdRefreshQuoteArt=()=>{clearTimeout(timer);return bind()?refresh():Promise.resolve();};
})();
