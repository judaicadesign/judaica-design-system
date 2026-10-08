/* Render preview and PDF from the same point-based master. No font shrink or screenshots. */
(()=>{
 let observed=null,revision=0;
 async function refresh(){const preview=document.getElementById('quotePreview');if(!preview||!window.jdQuotePreviewSVG)return;const version=++revision,sheets=[...preview.querySelectorAll('.jd-master-sheet')];
  for(let i=0;i<sheets.length;i++){
   const sheet=sheets[i];try{const svg=await window.jdQuotePreviewSVG(window.jdNativeQuote.readSheet(sheet),i+1,sheets.length);if(version!==revision||!sheet.isConnected)return;sheet.querySelectorAll(':scope>.jd-master-art,:scope>.jd-preview-error').forEach(el=>el.remove());sheet.insertAdjacentHTML('beforeend',svg);sheet.classList.add('jd-has-art')}
   catch(error){if(version!==revision||!sheet.isConnected)return;sheet.querySelectorAll(':scope>.jd-master-art,:scope>.jd-preview-error').forEach(el=>el.remove());sheet.classList.remove('jd-has-art');const notice=document.createElement('div');notice.className='jd-preview-error';notice.textContent=error.message;sheet.appendChild(notice)}
  }
 }
 function start(){const preview=document.getElementById('quotePreview');if(!preview||observed===preview)return;observed=preview;new MutationObserver(refresh).observe(preview,{childList:true});refresh()}
 document.addEventListener('jd-app-ready',start);window.addEventListener('jd-shared-ready',start);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
 window.jdRefreshQuoteArt=refresh;
})();
