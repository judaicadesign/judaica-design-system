/* Judaica Design — Mesa de control: lectura de trabajos existentes.
   No modifica pedidos ni expone información fuera del API de equipo. */
(() => {
  'use strict';
  const URL='https://athiruoimehofqzrplnl.supabase.co';
  const KEY='sb_publishable_zXLBKyfemFZMVE25nzyJ-w_UgeN79PP';
  const sb=supabase.createClient(URL,KEY);
  const $=s=>document.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const DAY=24*60*60*1000;
  let refreshing=false;
  function notice(s,bad=false){$('#notice').textContent=s;$('#notice').className=bad?'error':'';}
  async function api(){const {data:{session}}=await sb.auth.getSession();if(!session)throw Error('Iniciá sesión.');const r=await fetch(URL+'/functions/v1/client-portal',{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:JSON.stringify({action:'admin-list'})});const data=await r.json();if(!r.ok||data.ok===false)throw Error(data.error||'Acceso restringido al equipo JD.');return data;}
  const today=()=>{const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate());};
  function dateDays(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s||''))return null;const d=new Date(s+'T12:00:00');return Number.isNaN(d.getTime())?null:Math.round((d-today())/DAY);}
  const active=o=>!['Entregado','Cancelado'].includes(o.status);
  const priority=o=>{const d=dateDays(o.due_date);if(d!=null&&d<0)return 0;if(d!=null&&d<=2)return 1;if(['Requiere corrección','Esperando pago'].includes(o.status))return 2;if(d!=null&&d<=7)return 3;return 4;};
  const next=o=>({
    'Solicitado':'Comprobar alcance, interlocutor y datos por escrito.',
    'En revisión':'Revisar factibilidad, presupuesto y siguientes datos.',
    'Requiere corrección':'Identificar el dato/archivo a corregir y quién debe confirmarlo.',
    'Esperando pago':'Validar hito de pago sin confundirlo con datos completos.',
    'Confirmado':'Preparar control editorial y fechas antes de liberar archivos.',
    'En producción':'Confirmar imprenta, cantidad por lote, versión y fecha.',
    'Listo para entregar':'Contar unidades conformes y organizar la entrega.'
  })[o.status]||'Revisar próximos pasos y registrar decisión en el trabajo.';
  function title(o){return o.project?.title||o.items?.map(i=>i.description).filter(Boolean).join(' + ')||('Trabajo '+String(o.id||'').slice(0,8));}
  function list(rows,customers){return rows.map(o=>{const d=dateDays(o.due_date),who=customers.get(o.customer_id)||'Cliente',status=o.project?.stage||o.status,flag=d!=null?(d<0?' · PLAZO VENCIDO':d===0?' · VENCE HOY':d<=2?' · VENCE PRONTO':' · '+d+' días'):'';
    return '<article class="card"><p class="eyebrow">'+esc(who)+'</p><h3>'+esc(title(o))+'</h3><p><span class="tag">'+esc(status)+'</span> '+(o.due_date?esc(o.due_date)+esc(flag):'Sin fecha de entrega registrada')+'</p><p>'+esc(next(o))+'</p><p class="muted">Abrí Administración para registrar decisiones, cambios y mensajes; este tablero no aprueba archivos.</p></article>';}).join('');}
  async function refresh(){if(refreshing)return;refreshing=true;$('#refresh').disabled=true;try{
    const data=await api(),customers=new Map((data.customers||[]).map(c=>[c.id,c.name])),orders=(data.orders||[]).filter(active).sort((a,b)=>priority(a)-priority(b)||(a.due_date||'9999').localeCompare(b.due_date||'9999'));
    const urgent=orders.filter(o=>priority(o)<=3),missing=orders.filter(o=>!o.due_date).length;
    $('#summary').innerHTML='<div class="resource-card"><strong>'+orders.length+'</strong><span>Trabajos activos compartidos</span></div><div class="resource-card"><strong>'+urgent.length+'</strong><span>Requieren revisión prioritaria</span></div><div class="resource-card"><strong>'+missing+'</strong><span>Sin fecha cargada</span></div>';
    $('#urgent').innerHTML=urgent.length?list(urgent.slice(0,8),customers):'<p class="empty">No hay trabajos urgentes en el portal; revisá igualmente pedidos por WhatsApp que aún no estén compartidos.</p>';
    $('#projects').innerHTML=orders.length?list(orders,customers):'<p class="empty">No hay trabajos activos compartidos. Podés crear el primero desde Administración. Los pedidos históricos del sistema interno no se importan automáticamente.</p>';
    notice('Actualizado. Antes de actuar, comprobá los mensajes y archivos de cada proyecto.');
  }catch(e){$('#workspace').hidden=true;$('#login').hidden=false;notice(e.message||'No se pudieron cargar los datos.',true);}finally{refreshing=false;$('#refresh').disabled=false;}}
  async function bootstrap(){const {data:{session}}=await sb.auth.getSession();$('#login').hidden=!!session;$('#workspace').hidden=!session;$('#logout').hidden=!session;if(session)await refresh();}
  $('#login-form').addEventListener('submit',async e=>{e.preventDefault();const f=e.currentTarget,b=f.querySelector('button');b.disabled=true;try{const {error}=await sb.auth.signInWithPassword({email:f.elements.email.value.trim(),password:f.elements.password.value});if(error)throw error;await bootstrap();}catch(err){notice('No se pudo ingresar. '+(err.message||''),true);}finally{b.disabled=false;}});
  $('#logout').addEventListener('click',async()=>{await sb.auth.signOut();await bootstrap();});
  $('#refresh').addEventListener('click',refresh);
  bootstrap().catch(e=>notice(e.message||'No se pudo iniciar la mesa de control.',true));
})();