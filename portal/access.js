/* Accessible password guidance and international contact input. No credentials are stored here. */
(() => {
 'use strict';
 const lib=globalThis.libphonenumber;
 const rules=[['length','12 caracteres como mínimo',v=>v.length>=12],['upper','Una mayúscula',v=>/[A-Z]/.test(v)],['lower','Una minúscula',v=>/[a-z]/.test(v)],['number','Un número',v=>/[0-9]/.test(v)]];
 function passwords(root=document){
  root.querySelectorAll('input[type="password"]').forEach((input,i)=>{
   if(input.dataset.enhanced)return;input.dataset.enhanced='true';input.id ||= 'access-password-'+i;
   const wrapper=document.createElement('span');wrapper.className='password-control';input.before(wrapper);wrapper.append(input);
   const b=document.createElement('button');b.type='button';b.className='password-toggle secondary';b.textContent='Ver';b.setAttribute('aria-label','Mostrar contraseña');b.setAttribute('aria-controls',input.id);b.setAttribute('aria-pressed','false');wrapper.append(b);
   b.onclick=()=>{const visible=input.type==='password';input.type=visible?'text':'password';b.textContent=visible?'Ocultar':'Ver';b.setAttribute('aria-label',visible?'Ocultar contraseña':'Mostrar contraseña');b.setAttribute('aria-pressed',String(visible));};
   const f=input.form;if(input.autocomplete!=='new-password')return;
   if(input.name==='confirmation'){
    const msg=document.createElement('span');msg.className='password-match muted';msg.setAttribute('role','status');wrapper.after(msg);
    const update=()=>{const v=input.value,ok=v===f.elements.password.value;input.setCustomValidity(v&&!ok?'Las contraseñas no coinciden.':'');msg.textContent=v?(ok?'✓ Las contraseñas coinciden':'Las contraseñas todavía no coinciden') : '';msg.classList.toggle('met',!!v&&ok);};input.addEventListener('input',update);f.elements.password.addEventListener('input',update);f.addEventListener('reset',()=>setTimeout(update));return;
   }
   const panel=document.createElement('div');panel.className='password-guide';panel.id=input.id+'-rules';panel.innerHTML='<p>Tu contraseña debe tener:</p><ul>'+rules.map(([key,label])=>'<li data-rule="'+key+'"><span aria-hidden="true">○</span> '+label+'</li>').join('')+'</ul>';
   wrapper.before(panel);input.setAttribute('aria-describedby',panel.id);input.maxLength=200;
   const update=()=>{const v=input.value;for(const [key,,check] of rules){const n=panel.querySelector('[data-rule="'+key+'"]'),ok=check(v);n.classList.toggle('met',ok);n.querySelector('span').textContent=ok?'✓':'○';}input.setCustomValidity(v&&!rules.every(r=>r[2](v))?'Completá los requisitos indicados arriba.':'');};input.addEventListener('input',update);f.addEventListener('reset',()=>setTimeout(update));update();
  });
 }
 function phone(form){
  const original=form.elements.phone;if(!original||!lib)return;
  const label=original.closest('label'),box=document.createElement('fieldset');box.className='phone-fields';box.innerHTML='<legend>WhatsApp</legend><div class="phone-country"><label>País<select name="phone_country" autocomplete="country"></select></label></div><div class="fields"><label>Código de área<input name="phone_area" type="tel" inputmode="numeric" placeholder="11 o 381" aria-describedby="'+form.id+'-phone-help"></label><label>Número<input name="phone_number" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="5822 4686" required></label></div><p class="muted" id="'+form.id+'-phone-help">Incluí tu código de área. No hace falta escribir 0, 15 ni +54 9.</p><p class="phone-preview muted" role="status"></p>';
  original.type='hidden';original.required=false;label.replaceWith(box);box.append(original);
  const country=form.elements.phone_country,area=form.elements.phone_area,number=form.elements.phone_number,preview=box.querySelector('.phone-preview'),help=box.querySelector('#'+form.id+'-phone-help'),names=new Intl.DisplayNames(['es'],{type:'region'});
  const countries=lib.getCountries().sort((a,b)=>names.of(a).localeCompare(names.of(b),'es'));
  for(const c of countries){const opt=document.createElement('option');opt.value=c;opt.textContent=names.of(c)+' (+'+lib.getCountryCallingCode(c)+')';country.append(opt);}country.value='AR';
  function setCountry(){const ar=country.value==='AR';area.required=ar;area.placeholder=ar?'11 o 381':'Código de área';help.textContent=ar?'Incluí tu código de área: 11 para CABA, 381 para Tucumán, etc. Sin 0 ni 15; agregamos +54 9.':'Escribí el código de área y número. Si tu país no usa código de área separado, dejalo vacío e ingresá el número nacional completo.';}
  function parsed(){let a=area.value.replace(/\D/g,''),n=number.value.replace(/\D/g,'');if(!a&&!n)return null;let candidate;
   if(/^\s*(\+|00)/.test(number.value)){candidate=number.value.replace(/^\s*00/,'+');}
   else if(country.value==='AR'){a=a.replace(/^0/,'');if(!a)return null;if(n.startsWith('15'))n=n.slice(2);candidate='+549'+a+n;}
   else candidate='+'+lib.getCountryCallingCode(country.value)+a.replace(/^0/,'')+n.replace(/^0/,'');
   const p=lib.parsePhoneNumberFromString(candidate);return p&&p.isValid()&&p.country===country.value?p:null;
  }
  function sync(){setCountry();const p=parsed(),has=!!number.value;original.value=p?p.number:'';number.setCustomValidity(has&&!p?'Revisá país, código de área y número.':'');preview.textContent=p?'Se guardará como '+p.formatInternational():has?'Falta completar o corregir el número.':'';preview.classList.toggle('met',!!p);return !!p;}
  function fill(value){area.value='';number.value='';const p=lib.parsePhoneNumberFromString(value||'');if(p?.country){country.value=p.country;let national=p.nationalNumber;if(p.country==='AR'){const m=p.formatNational().match(/^0(\d{2,4})\s/);if(m){area.value=m[1];national=national.replace(/^9/,'').slice(m[1].length);}}number.value=national;}else if(value)number.value=value;sync();}
  country.addEventListener('change',sync);area.addEventListener('input',sync);number.addEventListener('input',sync);
  number.addEventListener('change',()=>{if(/^\s*(\+|00)/.test(number.value)){const p=lib.parsePhoneNumberFromString(number.value.replace(/^\s*00/,'+'));if(p?.country)fill(p.number);}else sync();});
  form.addEventListener('submit',e=>{if(!sync()){e.preventDefault();e.stopImmediatePropagation();number.reportValidity();}},true);
  form.addEventListener('reset',()=>setTimeout(()=>{country.value='AR';sync();}));form._phone={fill,sync};fill(original.value);
 }
 globalThis.JDPortalAccess={passwords,phone};passwords();document.querySelectorAll('#signup-form,#profile-form').forEach(phone);
})();
