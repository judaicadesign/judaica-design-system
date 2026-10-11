/* Judaica Design® — avance editorial verificable, sin inferir aprobaciones.
   Fuente de verdad: masters/tehilim/REVISION_ESTADO.json. */
(function(root){
 "use strict";
 const endpoint="masters/tehilim/REVISION_ESTADO.json";
 const TOTAL=150;
 let pending=null;
 const esc=x=>String(x==null?"":x).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 function fetchState(force=false){
  if(!pending||force)pending=fetch(endpoint,{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("HTTP "+r.status);return r.json()}).catch(e=>{pending=null;throw e});
  return pending;
 }
 function classify(ch,hasHebrewSource){
  if(ch?.hebrewApproved===true&&ch?.phoneticApproved===true&&ch?.approved===true)return "final";
  if(ch?.hebrewApproved===true)return "hebreo";
  return hasHebrewSource?"obtenido":"sinTexto";
 }
 function inventory(data){
  const known=new Map((data.chapters||[]).map(c=>[Number(c.chapter),c]));
  const fromWikisource=Number(data.corpus?.hebrewWikisourceChapters||0);
  return Array.from({length:TOTAL},(_,i)=>{
   const chapter=i+1,detail=known.get(chapter)||null;
   const hasHebrewSource=chapter<=fromWikisource || !!detail;
   return {chapter,detail,hasHebrewSource,status:classify(detail,hasHebrewSource)};
  });
 }
 function stats(rows){
  const counts={final:0,hebreo:0,obtenido:0,sinTexto:0,reviewing:0};
  for(const item of rows){
    counts[item.status]++;
    if(item.detail && item.status==="obtenido")counts.reviewing++;
  }
  return counts;
 }
 function style(){
  if(document.getElementById("jd-master-progress-css"))return;
  const tag=document.createElement("style");tag.id="jd-master-progress-css";
  tag.textContent=`
  .jd-tp-stat{font-size:1.15rem;font-weight:750;line-height:1.35;margin:10px 0 6px}
  .jd-tp-stat strong{color:#087348}
  .jd-tp-bar{height:9px;background:#e9eee9;border-radius:99px;overflow:hidden;display:flex;margin:9px 0}
  .jd-tp-bar span{display:block;background:#20865b;height:100%;min-width:0}
  .jd-tp-help{color:#61706b;font-size:.85em;line-height:1.4}
  .jd-tp-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin:13px 0}
  .jd-tp-summary div{border:1px solid #e2e9e5;border-radius:9px;padding:10px;background:transparent}
  .jd-tp-summary b{font-size:1.15rem}
  .jd-tp-tools{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0}
  .jd-tp-filter{border:1px solid #cfd9d3;border-radius:22px;background:transparent;color:inherit;padding:7px 11px;cursor:pointer;font:inherit;font-size:13px}
  .jd-tp-filter[aria-pressed="true"]{border-color:#087348;background:#e8f6ee;color:#086e42;font-weight:700}
  .jd-tp-items{display:grid;gap:7px;max-height:52vh;overflow-y:auto;padding-right:3px}
  .jd-tp-item{border:1px solid #e1e8e4;border-radius:9px;padding:10px 12px}
  .jd-tp-item summary{display:flex;justify-content:space-between;gap:8px;cursor:pointer;align-items:center;list-style:none}
  .jd-tp-item summary::-webkit-details-marker{display:none}
  .jd-tp-item summary b{font-size:14px}
  .jd-tp-label{font-size:12px;text-align:right}
  .jd-tp-final{color:#087348}.jd-tp-hebreo{color:#a45d04}.jd-tp-obtenido{color:#936a00}.jd-tp-sinTexto{color:#62716e}
  .jd-tp-details{color:inherit;font-size:13px;line-height:1.5;margin-top:9px;border-top:1px solid #e8eeea;padding-top:8px}
  .jd-tp-details p{margin:5px 0}
  @media(min-width:720px){.jd-tp-summary{grid-template-columns:repeat(4,minmax(0,1fr))}}
  `;
  document.head.appendChild(tag);
 }
 const captions={final:"✅ Hebreo y fonética FINAL",hebreo:"⚠️ Hebreo FINAL · falta fonética",obtenido:"🟡 Hebreo obtenido · falta cotejo",sinTexto:"○ Aún no existe texto hebreo"};
 function progress(rows){
  const s=stats(rows),percent=(100*s.final/TOTAL).toFixed(2);
  return {s,percent};
 }
 function mountCard(el){
  if(!el)return;
  style();
  el.innerHTML='<p class="jd-tp-help">Consultando aprobaciones…</p>';
  fetchState().then(data=>{
   if(!el.isConnected)return;
   const {s,percent}=progress(inventory(data));
   el.innerHTML='<div class="jd-tp-stat"><strong>'+s.final+'/'+TOTAL+'</strong> Tehilim FINAL ✅</div>'+
    '<div class="jd-tp-bar" role="progressbar" aria-label="Tehilim terminados" aria-valuemin="0" aria-valuemax="150" aria-valuenow="'+s.final+'"><span style="width:'+percent+'%"></span></div>'+
    '<p class="jd-tp-help">'+(TOTAL-s.sinTexto)+' con hebreo base · '+s.reviewing+' cotejos abiertos · '+s.hebreo+' con hebreo FINAL y fonética pendiente</p>';
  }).catch(()=>{if(el.isConnected)el.textContent="No se pudo consultar el progreso. Tocá «Ver avance» para reintentar."});
 }
 function renderRows(rows,filter){
  const subset=filter==="todos"?rows:rows.filter(x=>x.status===filter);
  if(!subset.length)return '<p class="jd-tp-help">Todavía no hay capítulos en esta etapa.</p>';
  return subset.map(({chapter,detail,status})=>
   '<details class="jd-tp-item"><summary><b>Tehilim '+chapter+'</b><span class="jd-tp-label jd-tp-'+status+'">'+captions[status]+'</span></summary>'+
   '<div class="jd-tp-details">'+
   (detail?'<p><b>Hebreo:</b> '+esc(detail.hebrewApproved===true?"Aprobado. "+(detail.hebrew||""):(detail.hebrew||"Aún sin aprobación integral."))+'</p>'+
    '<p><b>Fonética:</b> '+esc(detail.phoneticApproved===true?"Aprobada. "+(detail.phonetic||""):(detail.phonetic||"Pendiente."))+'</p>'+
    (detail.source?'<p><b>Fuente registrada:</b> '+esc(detail.source)+'</p>':'')+
    (detail.editorialNext?'<p><b>Próxima comprobación:</b> '+esc(detail.editorialNext)+'</p>':''):
    '<p>'+ (status==="obtenido"?"Hebreo base extraído de Wikisource; no hay aprobación editorial integral registrada.":"Todavía no hay texto hebreo registrado.")+'</p>')+
    '</div></details>').join("");
 }
 function renderModal(data,host){
  const rows=inventory(data),{s,percent}=progress(rows);
  host.innerHTML='<div class="jd-tp-stat"><strong>'+s.final+'/'+TOTAL+'</strong> salmos terminados ✅</div>'+
  '<div class="jd-tp-bar" role="progressbar" aria-label="Tehilim FINAL" aria-valuenow="'+s.final+'" aria-valuemin="0" aria-valuemax="150"><span style="width:'+percent+'%"></span></div>'+
  '<p class="jd-tp-help">'+(TOTAL-s.sinTexto)+'/150 ya tienen hebreo extraído de Wikisource. El cotejo integral, la fonética FINAL y el generador son etapas distintas.</p>'+
  '<div class="jd-tp-summary"><div><b>✅ '+s.final+'</b><div class="jd-tp-help">Ambos másters listos</div></div>'+
  '<div><b>⚠️ '+s.hebreo+'</b><div class="jd-tp-help">Hebreo aprobado</div></div>'+
  '<div><b>🟡 '+s.obtenido+'</b><div class="jd-tp-help">Hebreo obtenido</div></div>'+
  '<div><b>○ '+s.sinTexto+'</b><div class="jd-tp-help">Sin texto hebreo</div></div></div>'+
  '<div class="jd-tp-tools" aria-label="Filtrar Tehilim">'+
   [["todos","Todos (150)"],["final","✅ Finales"],["hebreo","⚠️ Hebreo FINAL"],["obtenido","🟡 Obtenidos"],["sinTexto","○ Sin texto"]]
   .map(([k,l])=>'<button type="button" class="jd-tp-filter" data-filter="'+k+'" aria-pressed="'+(k==="todos")+'">'+l+'</button>').join("")+
  '</div><div class="jd-tp-items" id="jd-tp-list">'+renderRows(rows,"todos")+'</div>'+
  '<p class="jd-tp-help"><a href="https://github.com/judaicadesign/judaica-design-system/blob/main/masters/tehilim/REVISION_003-007_PENDIENTES.md" target="_blank" rel="noopener">Ver auditoría y preguntas de Tehilim 3–7</a></p>'+
  '<p class="jd-tp-help">Datos de REVISION_ESTADO.json · actualización consultada al abrir. Los capítulos sin cotejo aprobado pero con base Wikisource figuran como «obtenidos», no como finales.</p>';
  host.querySelectorAll("[data-filter]").forEach(btn=>btn.addEventListener("click",()=>{
    host.querySelectorAll("[data-filter]").forEach(b=>b.setAttribute("aria-pressed",String(b===btn)));
    host.querySelector("#jd-tp-list").innerHTML=renderRows(rows,btn.dataset.filter);
  }));
 }
 async function show(modal3){
  style();
  const wrap=modal3("Avance editorial · Tehilim 1–150",'<div id="jd-tp-progress"><p>Actualizando progreso…</p></div>',"Cerrar",x=>x.remove());
  const target=wrap.querySelector("#jd-tp-progress");
  try{const d=await fetchState(true);if(target?.isConnected)renderModal(d,target)}
  catch(e){if(target?.isConnected)target.innerHTML='<p>No se pudo cargar el registro de progreso. Verificá la conexión y volvé a abrir.</p>';}
 }
 root.JDMasterProgress={mountCard,show,inventory,stats};
})(window);
