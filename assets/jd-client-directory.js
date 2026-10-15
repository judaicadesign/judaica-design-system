/* Judaica Design® · buscador y vinculación de clientes (v1) */
(function () {
 'use strict';
 const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/\s+/g,' ').trim();
 const nameOf=c=>String(c?.name||[c?.firstName,c?.lastName].filter(Boolean).join(' ')||c?.org||'').trim();
 const stableId=c=>c?.id||'legacy-'+encodeURIComponent([c?.name||[c?.firstName,c?.lastName].filter(Boolean).join(' '),c?.org||'',c?.created||''].join('|'));
 const clients=()=>{try{const a=JSON.parse(localStorage.getItem('jd_clients')||'[]');return Array.isArray(a)?a.filter(c=>!c.deletedAt):[]}catch(_){return []}};
 const findById=id=>clients().find(c=>stableId(c)===id);
 const exact=(value)=>clients().find(c=>norm(nameOf(c))===norm(value));
 const digits=s=>String(s||'').replace(/\D/g,'').replace(/^00/,'');
 const matches=(c,q)=>{
   const hay=norm([nameOf(c),c.firstName,c.lastName,c.org,c.phone,c.address,c.city].filter(Boolean).join(' '));
   return norm(q).split(/\s+/).filter(Boolean).every(part=>hay.includes(part));
 };
 const css=document.createElement('style');css.textContent=`
 .jd-client-pick-wrap{position:relative}
 .jd-client-pick-list{position:absolute;top:100%;left:0;right:0;z-index:120;background:var(--paper,#fffdfa);border:1px solid #c8bdab;border-radius:12px;box-shadow:0 12px 26px rgba(0,0,0,.18);max-height:285px;overflow:auto;padding:4px}
 .jd-client-pick-list[hidden]{display:none}
 .jd-client-pick-option{display:block;width:100%;text-align:left;background:transparent;border:0;border-radius:7px;padding:10px 12px;cursor:pointer;color:inherit;font:inherit}
 .jd-client-pick-option:hover,.jd-client-pick-option[aria-selected="true"]{background:#e6efed}
 .jd-client-pick-option small{display:block;color:#5c6565;margin-top:2px}
 .jd-client-pick-detail{margin-top:6px;color:#53665f;font-size:.86em;line-height:1.5}
 .jd-client-pick-detail a{color:#245e62;text-decoration:underline}
 .jd-crm-search{max-width:550px;margin:0 0 14px}
 .jd-crm-search input{width:100%;min-height:42px}
 .jd-crm-search-count{font-size:.86em;color:#646c68;margin-top:5px}
 `;document.head.appendChild(css);
 function attach(input) {
   if(!input)return null;
   if(input._jdClientAutocomplete)return input._jdClientAutocomplete;
   const parent=input.parentElement;parent.classList.add('jd-client-pick-wrap');
   input.autocomplete='off';input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');
   input.setAttribute('aria-expanded','false');
   const list=document.createElement('div');list.className='jd-client-pick-list';list.setAttribute('role','listbox');list.hidden=true;
   const detail=document.createElement('div');detail.className='jd-client-pick-detail';detail.setAttribute('aria-live','polite');
   parent.append(list,detail);
   let filtered=[],active=-1, selected=null,lock=false;
   const close=()=>{list.hidden=true;input.setAttribute('aria-expanded','false');active=-1;};
   const renderDetail=()=>{
     detail.replaceChildren();
     const c=selected ? findById(selected) : null;
     if(!c)return;
     detail.append(document.createTextNode('Cliente vinculado: '+nameOf(c)));
     if(c.address)detail.append(document.createTextNode(' · '+c.address));
     if(c.phone) {
       const a=document.createElement('a');const phone=digits(c.phone);
       if(phone.length>=9){a.href='https://wa.me/'+phone;a.target='_blank';a.rel='noopener';a.textContent='WhatsApp: '+c.phone;detail.append(document.createTextNode(' · '),a);}
       else detail.append(document.createTextNode(' · WhatsApp: '+c.phone));
     }
   };
   function pick(c) {
     selected=stableId(c);input.dataset.jdClientId=selected;input.value=nameOf(c);const last=document.getElementById('qClientLast');if(input.id==='qClient'&&last)last.value='';
     close();renderDetail();
     lock=true;input.dispatchEvent(new Event('input',{bubbles:true}));lock=false;
   }
   function show() {
     const all=clients(),q=input.value;
     filtered=all.filter(c=>nameOf(c)&&matches(c,q)).sort((a,b)=>{
       const aName=norm(nameOf(a)),bName=norm(nameOf(b)),v=norm(q);
       return (aName.startsWith(v)?0:1)-(bName.startsWith(v)?0:1)||aName.localeCompare(bName,'es');
     }).slice(0,40);
     list.replaceChildren();active=-1;
     if(!filtered.length){close();return;}
     filtered.forEach((c,i)=>{
       const b=document.createElement('button');b.type='button';b.className='jd-client-pick-option';b.setAttribute('role','option');b.setAttribute('aria-selected','false');
       b.textContent=nameOf(c);
       if(c.org&&norm(c.org)!==norm(nameOf(c))){const s=document.createElement('small');s.textContent=c.org;b.appendChild(s);}
       b.addEventListener('pointerdown',e=>e.preventDefault());
       b.addEventListener('click',()=>pick(c));
       list.appendChild(b);
     });
     list.hidden=false;input.setAttribute('aria-expanded','true');
   }
   input.addEventListener('input',()=>{
      if(lock)return;
      const c=selected ? findById(selected) : null;
      if(c&&norm(input.value)!==norm(nameOf(c))){selected=null;delete input.dataset.jdClientId;}
      renderDetail();show();
   });
   input.addEventListener('focus',show);
   input.addEventListener('blur',()=>setTimeout(close,150));
   input.addEventListener('keydown',event=>{
     if(event.key==='Escape'){close();return;}
     if(!filtered.length || list.hidden){if(event.key==='ArrowDown'){show();event.preventDefault()}return;}
     if(event.key==='ArrowDown'||event.key==='ArrowUp'){
       event.preventDefault();active=(active+(event.key==='ArrowDown'?1:-1)+filtered.length)%filtered.length;
       [...list.children].forEach((b,i)=>b.setAttribute('aria-selected',String(i===active)));
       list.children[active]?.scrollIntoView({block:'nearest'});
     } else if(event.key==='Enter'&&active>=0){event.preventDefault();pick(filtered[active]);}
   });
   const api={pick,restore:(id,value)=>{
     const c=id?findById(id):exact(value);
     if(c&&norm(input.value)===norm(value??input.value)){selected=stableId(c);input.dataset.jdClientId=selected;}
     else {selected=null;delete input.dataset.jdClientId;}
     close();renderDetail();
   },selectedId:()=>{const c=selected?findById(selected):exact(input.value);return c&&norm(nameOf(c))===norm(input.value)?stableId(c):null;},close};
   input._jdClientAutocomplete=api;api.restore(null,input.value);
   return api;
 }
 window.JDClientDirectory={norm,nameOf,stableId,clients,exact,findById,matches,attach,
   bindQuote:()=>attach(document.getElementById('qClient')),
   selectedId:input=>input?attach(input)?.selectedId()||null:null,
   restore:(input,id,value)=>attach(input)?.restore(id,value)};
})();
