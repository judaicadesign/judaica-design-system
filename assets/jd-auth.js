/* Authenticated bootstrap: never seed or upload cached data before remote hydration. */
(async function () {
  'use strict';
  const URL = 'https://athiruoimehofqzrplnl.supabase.co';
  const KEY = 'sb_publishable_zXLBKyfemFZMVE25nzyJ-w_UgeN79PP';
  const rawFetch = window.fetch.bind(window);
  const rawSet = Storage.prototype.setItem;
  const rawRemove = Storage.prototype.removeItem;
  const message = document.getElementById('jdAuthMessage');
  const fail = e => { message.textContent = e.message || String(e); };
  if (!window.supabase) { fail(new Error('No se pudo cargar el acceso seguro. Recargá la página.')); return; }
  const client = window.jdSupabase = supabase.createClient(URL, KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  let active = false, initializing = false;
  const syncKey = k => String(k).startsWith('jd_') && k !== 'jd_quote_qtys_v6';
  const status = document.createElement('div');
  status.className = 'jd-auth-status';
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  const chains = new Map();
  const confirmed = new Map();
  const clone = value => JSON.parse(JSON.stringify(value));
  const pending = new Set();
  async function privateLinks(value) {
    if(typeof value==='string' && value.startsWith(URL+'/storage/v1/object/')) {
      const match=value.match(/\/object\/(?:public|sign)\/(jd-assets|jd-quotes)\/([^?]+)/);
      if(!match)return value;
      const {data,error}=await client.storage.from(match[1]).createSignedUrl(decodeURIComponent(match[2]),604800);
      if(error)throw error;
      return data.signedUrl;
    }
    if(Array.isArray(value))return Promise.all(value.map(privateLinks));
    if(value && typeof value==='object')return Object.fromEntries(await Promise.all(Object.entries(value).map(async([k,v])=>[k,await privateLinks(v)])));
    return value;
  }
  function badge(text) { status.textContent = text; }
  async function session() {
    const { data, error } = await client.auth.getSession();
    if (error || !data.session) throw new Error('Iniciá sesión para continuar.');
    return data.session;
  }
  window.fetch = async function(input, init) {
    const target = new globalThis.URL(typeof input === 'string' ? input : input.url, location.href);
    if (target.origin === URL && !target.pathname.startsWith('/auth/')) {
      if (!active && !initializing) throw new Error('Acceso privado: iniciá sesión.');
      const s = await session();
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      if(active && target.pathname==='/rest/v1/app_state' && String(init?.method||'GET').toUpperCase()==='POST'){
        try{
          const body=JSON.parse(init.body),rows=Array.isArray(body)?body:[body];
          for(const row of rows)await enqueue(row.key,row.value,false);
          return new Response('[]',{status:200,headers:{'Content-Type':'application/json'}});
        }catch(error){return new Response(JSON.stringify({message:error.message}),{status:409,headers:{'Content-Type':'application/json'}})}
      }
      headers.set('apikey', KEY);
      headers.set('Authorization', 'Bearer ' + s.access_token);
      return rawFetch(input, { ...init, headers });
    }
    return rawFetch(input, init);
  };
  function enqueue(k, value, remove) {
    pending.add(k); badge('Guardando…');
    const next = (chains.get(k) || Promise.resolve()).catch(() => {}).then(async () => {
      const s = await session();
      const exists=confirmed.has(k),expected=exists?confirmed.get(k):null;
      if(!remove&&exists&&JSON.stringify(value)===JSON.stringify(expected))return;
      const { error } = await client.rpc('jd_commit_state',{changes:[{key:k,value,remove,exists,expected}]});
      if (error) throw error;
      if(remove)confirmed.delete(k);else confirmed.set(k,clone(value));
    });
    chains.set(k,next);
    next.then(() => { if (chains.get(k)===next) { pending.delete(k); badge(pending.size?'Guardando…':'● Sincronizado'); } },
      () => badge('⚠ Cambio local pendiente de sincronización'));
    return next;
  }
  let sharedMutation = false;
  window.jdConfirmedState = key => clone(confirmed.get(key)??null);
  window.jdUpdateSharedState = async function(keys, transform) {
    if (!active || sharedMutation) throw new Error('Esperá a que termine el cambio anterior.');
    sharedMutation = true;
    try {
      await Promise.all([...chains.values()]);
      await session();
      badge('Guardando…');
      const {data, error:readError} = await client.from('app_state').select('key,value').in('key',keys);
      if(readError) throw readError;
      const current = Object.fromEntries(data.map(row=>[row.key,row.value]));
      const baseline=clone(current);
      const updates = transform(current);
      if(!updates) { badge('● Sincronizado'); return; }
      const rows = Object.entries(updates).map(([key,value])=>({key,value,updated_at:new Date().toISOString()}));
      const changes=rows.map(row=>({key:row.key,value:row.value,exists:Object.hasOwn(baseline,row.key),expected:baseline[row.key]??null}));
      const {error} = await client.rpc('jd_commit_state',{changes});
      if(error) throw error;
      for(const row of rows){confirmed.set(row.key,clone(row.value));rawSet.call(localStorage,row.key,JSON.stringify(row.value));}
      window.dispatchEvent(new CustomEvent('jd-shared-ready'));
      badge(pending.size?'Guardando…':'● Sincronizado');
    } catch(error) {
      badge('⚠ No se pudo guardar el cambio');
      throw error;
    } finally { sharedMutation = false; }
  };
  Storage.prototype.setItem = function(k,v) {
    rawSet.call(this,k,v);
    if(this===localStorage && active && syncKey(k)) {
      let value; try {value=JSON.parse(v);} catch {value=v;}
      enqueue(k,value,false);
    }
  };
  Storage.prototype.removeItem = function(k) {
    rawRemove.call(this,k);
    if(this===localStorage && active && syncKey(k)) enqueue(k,null,true);
  };
  window.addEventListener('beforeunload',e=>{if(pending.size || sharedMutation){e.preventDefault();e.returnValue='';}});
  async function open() {
    if(active || initializing) return;
    initializing=true;
    try {
      const {data:userData,error:userError}=await client.auth.getUser();
      if(userError || !userData.user) throw new Error('La sesión no es válida. Volvé a ingresar.');
      const {data:access,error:accessError}=await client.from('jd_team_access').select('email').eq('email',userData.user.email.toLowerCase());
      if(accessError || !access?.length) throw new Error('Este correo no tiene acceso al sistema.');
      const {data:rows,error}=await client.from('app_state').select('key,value,updated_at');
      if(error) throw error;
      if(!rows?.length) throw new Error('No se pudieron verificar los datos comerciales. No se iniciará un catálogo vacío.');
      // Preserve the browser cache for recovery; remote state is authoritative.
      const cache={};
      for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(syncKey(k))cache[k]=localStorage.getItem(k);}
      rawSet.call(localStorage,'jd-recovery-cache',JSON.stringify(cache));
      for(const row of rows){confirmed.set(row.key,clone(row.value));rawSet.call(localStorage,row.key,JSON.stringify(await privateLinks(row.value)));}
      for(const inert of document.querySelectorAll('script[data-jd-app]')) {
        const script=document.createElement('script');
        if(inert.id)script.id=inert.id+'-active';
        script.textContent=inert.textContent;
        inert.replaceWith(script);
      }
      active=true;
      window.__JD_SHARED_READY=true;
      document.dispatchEvent(new Event('jd-app-ready'));
      window.dispatchEvent(new CustomEvent('jd-shared-ready'));
      document.getElementById('jdLogin').hidden=true;
      document.body.classList.add('jd-authenticated');
      const controls=document.createElement('div');controls.className='jd-session-controls';
      const logout=document.createElement('button');logout.className='jd-logout';logout.type='button';logout.textContent='Cerrar sesión';
      logout.onclick=async()=>{if(sharedMutation){badge('Esperá a que termine el cambio.');return;}await Promise.allSettled([...chains.values()]);if(pending.size){badge('No se pudo sincronizar. Reintentá antes de salir.');return;}await client.auth.signOut();location.reload();};
      controls.append(status,logout);
      document.querySelector('.sidebar').insertBefore(controls,document.getElementById('nav'));
      badge('● Sincronizado');
    } finally {initializing=false;}
  }
  document.getElementById('jdLoginForm').onsubmit=async e=>{
    e.preventDefault();message.textContent='Ingresando…';
    try {
      const {error}=await client.auth.signInWithPassword({email:document.getElementById('jdEmail').value.trim(),password:document.getElementById('jdPassword').value});
      document.getElementById('jdPassword').value='';
      if(error)throw error;
      await open();
    } catch(e){fail(e);}
  };
  document.getElementById('jdRegister').onclick=async()=>{
    const email=document.getElementById('jdEmail').value.trim();
    const password=document.getElementById('jdPassword').value;
    if(!document.getElementById('jdLoginForm').reportValidity())return;
    try {
      const {error}=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
      document.getElementById('jdPassword').value='';
      if(error)throw error;
      message.textContent='Revisá tu correo y confirmá el acceso. Luego volvé aquí e ingresá. Solo los correos autorizados pueden acceder.';
    }catch(e){fail(e);}
  };
  client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){
    active=false;
    confirmed.clear();
    for(const k of Object.keys(localStorage))if(syncKey(k)||k==='jd-recovery-cache')rawRemove.call(localStorage,k);
    document.body.classList.remove('jd-authenticated');document.getElementById('jdLogin').hidden=false;
  }});
  try {const {data,error}=await client.auth.getSession();if(error)throw error;if(data.session)await open();else message.textContent='Ingresá con tu correo y contraseña. Si es tu primera vez, creá tu acceso.';}catch(e){fail(e);}
})();
