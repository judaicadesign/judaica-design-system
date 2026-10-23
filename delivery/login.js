/* Public entry point: no commercial code or pricing data. */
(()=>{
'use strict';
const client=supabase.createClient('https://athiruoimehofqzrplnl.supabase.co','sb_publishable_zXLBKyfemFZMVE25nzyJ-w_UgeN79PP');
const $=id=>document.getElementById(id),root=document.body.dataset.deliveryRoot,entry=document.body.dataset.deliveryEntry;
const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
let busy=false;
function deadline(promise){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('La conexión está tardando demasiado. Volvé a intentar.')),30000);})]).finally(()=>clearTimeout(timer));}
async function open(){
 if(busy)return;busy=true;$('submit').disabled=true;
 try{
  $('retry').hidden=true;$('login').hidden=true;$('notice').classList.remove('error');
  const {data,error}=await deadline(client.auth.getUser());
  if(error||!data.user){$('notice').textContent='Ingresá para continuar.';$('login').hidden=false;return;}
  $('signout').hidden=false;$('login').hidden=true;
  const keyResult=await deadline(client.from('jd_internal_delivery_keys').select('private_key').eq('id','v1').maybeSingle());
  if(keyResult.error||!keyResult.data?.private_key)throw Error('Tu cuenta no tiene acceso al sistema interno.');
  $('notice').textContent='Abriendo tu espacio de trabajo…';
  // The private key is never written to localStorage, HTML, logs, or shared state.
  const privateKey=await crypto.subtle.importKey('pkcs8',bytes(keyResult.data.private_key),{name:'RSA-OAEP',hash:'SHA-256'},false,['unwrapKey']);
  keyResult.data.private_key=null;
  const response=await fetch(root+'delivery/'+entry+'.json',{cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('No se pudo cargar el sistema. Actualizá la página.');
  const envelope=await response.json();
  const aes=await crypto.subtle.unwrapKey('raw',bytes(envelope.wrappedKey),privateKey,{name:'RSA-OAEP'},{name:'AES-GCM',length:256},false,['decrypt']);
  const cipherParts=await Promise.all(envelope.parts.map(async p=>{if(!/^[a-z0-9.-]+$/.test(p))throw Error('Archivo de publicación inválido.');const r=await fetch(root+'delivery/'+p,{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('No se pudo cargar el sistema.');return bytes(await r.text());}));
  const cipher=new Uint8Array(cipherParts.reduce((n,p)=>n+p.length,0));let offset=0;for(const part of cipherParts){cipher.set(part,offset);offset+=part.length;}
  const plaintext=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv)},aes,cipher);
  const html=new TextDecoder().decode(plaintext);
  // Reuse the very same authenticated client, including memory-only sessions.
  window.jdSupabase=client;window.__JD_PROTECTED_ENTRY=true;
  document.open();document.write(html);document.close();
 }catch(e){$('notice').textContent=e.name==='TimeoutError'?'La conexión está tardando demasiado. Volvé a intentar.':e.message||'No se pudo abrir el sistema. Volvé a ingresar.';$('notice').classList.add('error');$('login').hidden=false;$('retry').hidden=false;}
 finally{busy=false;if($('submit'))$('submit').disabled=false;}
}
$('login').addEventListener('submit',async e=>{e.preventDefault();$('submit').disabled=true;$('notice').textContent='Verificando acceso…';try{const {error}=await client.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});$('password').value='';if(error)throw Error('No se pudo ingresar. Revisá tu correo y contraseña.');await open();}catch(e){$('notice').textContent=e.message;}finally{if($('submit'))$('submit').disabled=false;}});
$('retry').onclick=open;
$('show-password').onclick=()=>{const show=$('password').type==='password';$('password').type=show?'text':'password';$('show-password').textContent=show?'Ocultar':'Mostrar';$('show-password').setAttribute('aria-pressed',String(show));};
$('signout').onclick=async()=>{await client.auth.signOut();location.reload();};
open();
})();

