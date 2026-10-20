/* Private portal inbox in the internal workspace. No outgoing mail or push. */
(() => {
  'use strict';
  const endpoint='https://athiruoimehofqzrplnl.supabase.co/functions/v1/client-portal';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let busy=false,timer=null;
  function openInbox(){
    const frame=document.getElementById('jdPortalAdmin');
    if(!frame)return;
    if(!frame.getAttribute('src'))frame.src='portal/equipo.html';
    frame.hidden=false;
    window.go?.('portalInbox');
  }
  function panels(){
    const dash=document.getElementById('dashboard');if(!dash)return null;
    let box=document.getElementById('jdPortalInbox');
    if(!box){box=document.createElement('section');box.id='jdPortalInbox';box.className='section';(dash.querySelector('#jdDashboardKpis')||dash.querySelector('.jd-dashboard-intro'))?.after(box);}
    return box;
  }
  async function refresh(){
    if(busy||!window.__JD_SHARED_READY||!window.jdSupabase)return;
    busy=true;const box=panels();if(!box){busy=false;return;}
    try{
      const {data:{session}}=await window.jdSupabase.auth.getSession();
      if(!session){box.replaceChildren();document.getElementById('jdPortalBadge').hidden=true;return;}
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({action:'admin-list'})});
      const data=await response.json();if(!response.ok||data.ok===false)throw Error(data.error||'No se pudo consultar el portal.');
      const inquiries=data.inquiries||[],requested=(data.orders||[]).filter(o=>['Solicitado','En revisión'].includes(o.status)),active=(data.orders||[]).filter(o=>!['Entregado','Cancelado'].includes(o.status));
      const customers=new Map((data.customers||[]).map(c=>[c.id,c.name]));
      const count=inquiries.length+requested.length,badge=document.getElementById('jdPortalBadge');badge.textContent=String(count);badge.hidden=count===0;
      const items=[...inquiries.map(q=>({who:customers.get(q.customer_id),label:q.customer_result?.description||'Consulta de presupuesto',status:'Por cotizar'})),...requested.map(o=>({who:customers.get(o.customer_id),label:[o.work_code,o.project?.title||o.items?.map(i=>i.description).filter(Boolean).join(' + ')||'Pedido'].filter(Boolean).join(' · '),status:o.status}))];
      box.innerHTML='<div class="section-head"><h2>Solicitudes de clientes</h2><button class="btn sm" data-portal-open>Gestionar solicitudes</button></div><div class="grid cards"><div class="card"><div class="metric">'+inquiries.length+'</div><span>Consultas por cotizar</span></div><div class="card"><div class="metric">'+requested.length+'</div><span>Pedidos por revisar</span></div><div class="card"><div class="metric">'+active.length+'</div><span>Pedidos del portal en curso</span></div></div><div class="jd-action-list">'+(items.map(x=>'<article class="jd-action-item"><div class="jd-action-main"><b>'+esc(x.who||'Cliente')+'</b><small>'+esc(x.status)+'</small></div><div class="jd-action-copy">'+esc(x.label)+'</div><button class="btn sm" data-portal-open>Revisar</button></article>').join('')||'<p class="small muted">No hay solicitudes pendientes de revisión.</p>')+'</div><p class="small muted">Se actualiza cada minuto mientras el sistema está abierto. Sin avisos por correo con el sistema cerrado.</p>';
      box.querySelectorAll('[data-portal-open]').forEach(b=>b.onclick=openInbox);
    }catch(error){
      box.innerHTML='<div class="section-head"><h2>Solicitudes de clientes</h2></div><p role="status">No se pudo actualizar la bandeja. No significa que no haya solicitudes.</p><button class="btn sm" data-portal-retry>Reintentar</button>';
      box.querySelector('[data-portal-retry]').onclick=refresh;
      const badge=document.getElementById('jdPortalBadge');badge.textContent='!';badge.hidden=false;
    }finally{busy=false;}
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-screen="portalInbox"]'))openInbox();});
  document.addEventListener('jd-app-ready',()=>{refresh();if(!timer)timer=setInterval(refresh,60000);});
  window.addEventListener('focus',refresh);
  window.addEventListener('message',e=>{const frame=document.getElementById('jdPortalAdmin');if(e.origin===location.origin&&e.source===frame?.contentWindow&&e.data?.type==='jd-portal-updated')refresh();});
  window.JDPortalInbox={refresh,open:openInbox};
})();
