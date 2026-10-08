/* Keep the footer fixed. The spec card uses the available space above it first. */
(()=>{
 window.jdFitQuoteSheet=sheet=>{
  if(!sheet)return;
  let fits=true;
  for(const [selector,property,overflow] of [['.jd-legal-flow','--legal-scale','width'],['.jd-content-box','--content-scale','height'],['.jd-compact-specs','--spec-scale','body']]){
   const block=sheet.querySelector(selector);if(!block||!block.clientHeight)continue;
   sheet.style.setProperty(property,'1');
   for(let scale=1;scale>.5;scale-=.025){
    const exceeds=overflow==='width'?block.scrollWidth>block.clientWidth+2:overflow==='body'?block.scrollHeight>block.parentElement.clientHeight+2:block.scrollHeight>block.clientHeight+2;
    if(!exceeds)break;sheet.style.setProperty(property,String(scale-.025));
   }
   if(overflow==='width'?block.scrollWidth>block.clientWidth+2:overflow==='body'?block.scrollHeight>block.parentElement.clientHeight+2:block.scrollHeight>block.clientHeight+2)fits=false;
  }
  sheet.dataset.layoutOverflow=String(!fits);return fits;
 };
 let pending=false;
 const fit=()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;document.querySelectorAll('#quotePreview .jd-master-sheet').forEach(window.jdFitQuoteSheet)})};
 const start=()=>{const preview=document.getElementById('quotePreview');if(!preview)return;new MutationObserver(fit).observe(preview,{childList:true,subtree:true});preview.addEventListener('load',fit,true);window.addEventListener('resize',fit);document.fonts?.ready.then(fit);fit()};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
