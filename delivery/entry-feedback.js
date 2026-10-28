/* A failed dependency must leave an actionable entry screen. No account data is read. */
(()=>{
  const showFailure=()=>{
    const notice=document.getElementById('notice');
    if(!notice)return;
    notice.textContent='No se pudo cargar el acceso. Revisá tu conexión y volvé a intentar.';
    notice.classList.add('error');
    const retry=document.getElementById('retry');
    if(retry){retry.hidden=false;retry.onclick=()=>location.reload();}
  };
  window.addEventListener('error',event=>{
    if(event.target instanceof HTMLScriptElement)showFailure();
  },true);
})();
