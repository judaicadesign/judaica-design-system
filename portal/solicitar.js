(() => {
 'use strict';
 const $=s=>document.querySelector(s),endpoint='https://athiruoimehofqzrplnl.supabase.co/functions/v1/client-portal',key='sb_publishable_zXLBKyfemFZMVE25nzyJ-w_UgeN79PP';
 let token=new URLSearchParams(location.hash.slice(1)).get('activar');
 if(token){history.replaceState(null,'',location.pathname+location.search);$('#request-account').hidden=true;$('#activate-account').hidden=false;}
 function say(s,error=false){$('#notice').textContent=s;$('#notice').className=error?'error':'';}
 async function send(body){const r=await fetch(endpoint,{method:'POST',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok||d.ok===false)throw Error(d.error||'No pudimos completar la operación. Reintentá.');return d;}
 function done(title,copy){$('#request-account').hidden=true;$('#activate-account').hidden=true;$('#done-title').textContent=title;$('#done-copy').textContent=copy;$('#done').hidden=false;say('');}
 async function run(form,fn){const b=form.querySelector('button');b.disabled=true;say('Procesando…');try{await fn();}catch(e){say(e.message||'Reintentá en unos instantes.',true);}finally{b.disabled=false;}}
 $('#request-form').onsubmit=e=>{e.preventDefault();const form=e.target,f=form.elements;run(form,async()=>{await send({action:'request-account',name:f.name.value,email:f.email.value,phone:f.phone.value,consent:f.consent.checked,website:f.website.value});form.reset();done('Recibimos tu solicitud.','Si tu cuenta aún no está habilitada, revisaremos tu solicitud y te contactaremos para que puedas activarla. Si ya tenés cuenta, podés ingresar al portal.');});};
 $('#activate-form').onsubmit=e=>{e.preventDefault();const form=e.target,f=form.elements;run(form,async()=>{if(f.password.value!==f.confirmation.value)throw Error('Las contraseñas no coinciden.');const d=await send({action:'activate-account',token,password:f.password.value});token=null;form.reset();done('Tu cuenta está lista.', 'Ingresá al portal con '+d.email+' y la contraseña que elegiste.');});};
})();
