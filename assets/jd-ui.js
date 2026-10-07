/* Progressive interface enhancements; no commercial data writes. */
(function () {
  'use strict';
  const nav=document.getElementById('nav');
  const sidebar=document.querySelector('.sidebar');
  const toggle=document.createElement('button');
  toggle.type='button';toggle.className='jd-nav-toggle';toggle.textContent='Menú';
  toggle.setAttribute('aria-controls','nav');toggle.setAttribute('aria-expanded','false');
  sidebar.insertBefore(toggle,nav);
  nav.setAttribute('aria-label','Secciones del sistema');
  function closeNav(){sidebar.classList.remove('jd-nav-open');toggle.setAttribute('aria-expanded','false');toggle.textContent='Menú';}
  toggle.addEventListener('click',()=>{
    const open=sidebar.classList.toggle('jd-nav-open');
    toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'Cerrar':'Menú';
  });
  nav.addEventListener('click',event=>{if(event.target.closest('button[data-screen]'))closeNav();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&sidebar.classList.contains('jd-nav-open')){closeNav();toggle.focus();}});
  const skip=document.createElement('a');skip.href='#jdMain';skip.className='jd-skip';skip.textContent='Ir al contenido';
  document.body.prepend(skip);document.getElementById('jdMain').tabIndex=-1;
  const password=document.getElementById('jdPassword');
  const wrap=document.createElement('div');wrap.className='jd-password-wrap';password.before(wrap);wrap.append(password);
  const reveal=document.createElement('button');reveal.type='button';reveal.className='jd-password-toggle';reveal.textContent='Mostrar';
  reveal.setAttribute('aria-label','Mostrar contraseña');reveal.setAttribute('aria-pressed','false');wrap.append(reveal);
  reveal.addEventListener('click',()=>{
    const shown=password.type==='password';password.type=shown?'text':'password';
    reveal.textContent=shown?'Ocultar':'Mostrar';reveal.setAttribute('aria-label',shown?'Ocultar contraseña':'Mostrar contraseña');reveal.setAttribute('aria-pressed',String(shown));
  });
  function enhanceTable(table){
    const headings=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    table.querySelectorAll('thead th').forEach(th=>th.setAttribute('scope','col'));
    table.querySelectorAll('tbody tr').forEach(row=>[...row.children].forEach((cell,index)=>cell.dataset.label=headings[index]||'Acciones'));
    if(!table.closest('.jd-table-scroll,.table-wrap,.jd-table-wrap,.jd-panel,.quote-preview,.jd-pdf-modal')&&!table.classList.contains('jd-matrix')){
      const container=document.createElement('div');container.className='jd-table-wrap';table.before(container);container.append(table);
    }
    table.dataset.jdUiReady='true';
  }
  function enhance(){
    document.querySelectorAll('.main table').forEach(enhanceTable);
    nav.querySelectorAll('[data-screen]').forEach(button=>{
      if(button.classList.contains('active'))button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
    document.querySelectorAll('.jd-dashboard-card').forEach(card=>{
      if(card.dataset.jdKeyboard)return;
      card.tabIndex=0;card.setAttribute('role','button');card.dataset.jdKeyboard='true';
      card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();card.click();}});
    });
  }
  let scheduled=false;
  const observer=new MutationObserver(()=>{
    if(scheduled)return;scheduled=true;
    (window.requestAnimationFrame||window.setTimeout)(()=>{scheduled=false;enhance();});
  });
  observer.observe(document.getElementById('jdMain'),{childList:true,subtree:true});
  observer.observe(nav,{attributes:true,attributeFilter:['class'],subtree:true});
  document.addEventListener('jd-app-ready',enhance);
  enhance();
})();
