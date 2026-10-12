/* Generic catalog editor for references, local context and frozen approved editions. */
(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.JDPassageLibraryUI=api;})(typeof window==='undefined'?null:window,function(){
 'use strict';
 function mount({root,item,nusaj,lang,cell={},api,getCells=()=>({})}){
  const doc=root.ownerDocument,win=doc.defaultView,holder=root.querySelector('#jdLinkedPassages'),field=root.querySelector('#mcBody');
  if(!holder||!field)return null;
  const language=lang==='Hebreo'?'hebrew':'phonetic',status=root.querySelector('#mcStatus'),refField=root.querySelector('#mcRef'),save=root.querySelector('.jd-s');
  const originalCell=JSON.parse(JSON.stringify(cell));
  field.dir=language==='hebrew'?'rtl':'ltr';
  let locked=cell.status==='Aprobado',resources=null,current=null,legacySpec=null,template='',requestId=0,legacyDifferent=false;
  holder.innerHTML='<div class="jd-panel" style="padding:14px;margin:12px 0"><h3>Biblioteca de Tehilim · referencia reutilizable</h3>'+
   '<p class="small muted">El texto local conserva los encabezados y las condiciones de este rezo. Cada referencia toma el salmo del único corpus maestro, de corrido y sin numeración. No edites el salmo dentro de este contenido.</p>'+
   '<p data-library-state role="status">Cargando biblioteca…</p>'+
   '<p><button type="button" class="btn sm" data-library-unlock>Crear nueva revisión de esta edición aprobada</button> <button type="button" class="btn sm" data-library-frozen>Descargar edición aprobada conservada</button></p>'+
   '<div class="jd-grid"><label>Salmo <select data-library-chapter disabled><option value="">Elegir Tehilim…</option></select></label><label>Desde pasuk <input data-library-from type="number" min="1" value="1"></label><label>Hasta pasuk <input data-library-to type="number" min="1" value="1"></label><label>Encabezado local (opcional) <input data-library-heading></label><label>Condición litúrgica local (opcional) <input data-library-condition></label></div>'+
   '<p><button type="button" class="btn sm" data-library-insert disabled>Insertar referencia donde está el cursor</button> <button type="button" class="btn sm" data-library-source disabled>Ver pasaje fuente</button> <button type="button" class="btn sm" data-library-adopt hidden>Activar referencias de los salmos existentes</button></p>'+
   '<p class="small" data-library-usages></p><textarea readonly hidden data-library-source-preview style="width:100%;min-height:160px" aria-label="Pasaje fuente, solo lectura"></textarea>'+
   '<details data-library-preview-panel><summary>Ver resultado compuesto · solo lectura</summary><p class="small muted">Esta es una vista calculada, no otro máster. Corregí el texto local en el editor de arriba; los salmos se corrigen en Tehilim.</p><textarea readonly data-library-preview aria-label="Resultado compuesto, solo lectura; no es otro máster" style="width:100%;min-height:220px;line-height:1.7"></textarea></details>'+
   '<p><button type="button" class="btn sm" data-library-download disabled>Descargar composición EN REVISIÓN</button> <button type="button" class="btn sm" data-library-refresh>Actualizar fuentes</button></p>'+
   '<p class="small muted">Una edición aprobada conserva su texto congelado. Para incorporar una corrección posterior, creá una nueva revisión y aprobala expresamente. No se modifican archivos de trabajos entregados. Un salmo en revisión puede previsualizarse, pero bloquea la aprobación de la composición.</p></div>';
  const el=name=>holder.querySelector('[data-library-'+name+']');
  el('preview').dir=language==='hebrew'?'rtl':'ltr';
  el('unlock').hidden=!locked;el('frozen').hidden=!locked;
  function controls(){
   field.readOnly=locked;if(status)status.disabled=locked;if(refField)refField.disabled=locked;
   el('insert').disabled=locked||!resources||!el('chapter').value;
   el('source').disabled=!resources||!el('chapter').value;
   el('adopt').disabled=locked;el('adopt').hidden=!legacySpec||api.hasReferences(field.value);
   if(save)save.disabled=locked||((api.hasReferences(field.value)||legacySpec)&&!current);
  }
  function refresh(){
   if(!resources){controls();return;}
   try{
    template=locked?(cell.composition?.template??field.value):field.value;
    legacyDifferent=false;
    if(!api.hasReferences(template)&&legacySpec){
     legacyDifferent=api.compose({body:template,language,spec:legacySpec,...resources}).oldCopiesDiffer;
     template=api.legacyToTemplate({body:template,language,spec:legacySpec,...resources});
    }
    current=api.resolveTemplate({template,language,...resources,allowDraft:true});
    el('preview').value=current.text;
    el('state').textContent=(locked?'Edición aprobada intacta. Vista propuesta de nueva revisión: ':'Vista actual: ')+
     (current.references.length?current.references.map(r=>'Tehilim '+r.chapter+':'+r.from+'–'+r.to+' · '+(r.approved?'FINAL':'EN REVISIÓN')).join(' | '):'sin referencias; texto local.')+
     (current.allApproved?'':' No se puede aprobar mientras un salmo esté en revisión.')+
     (locked&&current.text!==originalCell.body?' Actualización disponible; requiere una nueva revisión.':'')+
     (legacyDifferent?' Las copias antiguas de los salmos difieren de Tehilim. Revisá la composición antes de activar los vínculos.':'');
    el('download').disabled=false;
   }catch(error){current=null;el('preview').value='';el('download').disabled=true;el('state').textContent='Vinculación bloqueada: '+error.message;}
   controls();
  }
  function download(text,name){
   const url=win.URL.createObjectURL(new win.Blob([text],{type:'text/plain;charset=utf-8'})),a=doc.createElement('a');
   a.href=url;a.download=name;doc.body.appendChild(a);a.click();a.remove();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);
  }
  const filename=String(item+'_'+nusaj+'_'+lang).replace(/[^\p{L}\p{N}_-]+/gu,'_');
  el('frozen').onclick=()=>download(originalCell.body||'',filename+'_EDICION_APROBADA.txt');
  el('unlock').onclick=()=>{
   if(!win.confirm('¿Crear una nueva revisión? La edición aprobada anterior se conservará sin cambios.'))return;
   locked=false;field.value=cell.composition?.template??field.value;if(status)status.value='Revisión fina';
   el('unlock').hidden=true;refresh();
  };
  el('chapter').onchange=()=>{
   const chapter=resources?.corpus.items.find(c=>c.chapter===Number(el('chapter').value));
   el('from').value='1';el('to').value=String(chapter?.verses.length??1);
   const usages=api.listUsages({cells:getCells(),chapter:chapter?.chapter,manifest:resources?.manifest});
   el('usages').textContent=chapter?'Usos guardados: '+(usages.length?usages.map(u=>u.item+' · '+u.nusaj+' · '+u.lang+(u.historical?' (edición histórica)':u.frozen?' (edición congelada)':' (borrador)')).join(' | '):'ninguno todavía.') : '';
   controls();
  };
  el('source').onclick=()=>{
   try{
    const token=api.referenceToken(Number(el('chapter').value),Number(el('from').value),Number(el('to').value));
    const result=api.resolveTemplate({template:token,language,...resources,allowDraft:true});
    el('source-preview').hidden=false;el('source-preview').dir=language==='hebrew'?'rtl':'ltr';el('source-preview').value=result.text;
   }catch(error){el('state').textContent=error.message;}
  };
  el('insert').onclick=()=>{
   if(locked||!resources)return;
   try{
    const token=api.referenceToken(Number(el('chapter').value),Number(el('from').value),Number(el('to').value));
    api.resolveTemplate({template:token,language,...resources,allowDraft:true});
    let context=[el('heading').value.trim(),el('condition').value.trim(),token].filter(Boolean).join('\n');
    const start=field.selectionStart??field.value.length,end=field.selectionEnd??start;
    if(start>0&&!/\s/.test(field.value[start-1]))context='\n'+context;
    if(end<field.value.length&&!/\s/.test(field.value[end]))context+='\n';
    field.value=field.value.slice(0,start)+context+field.value.slice(end);
    if(status)status.value='Revisión fina';refresh();field.focus();
   }catch(error){el('state').textContent=error.message;}
  };
  el('adopt').onclick=()=>{if(locked||!current)return;if(legacyDifferent&&!win.confirm('Las copias antiguas difieren de los salmos maestros. ¿Activar las referencias actuales conservando el contexto local? La copia anterior se conservará al guardar.'))return;field.value=template;legacySpec=null;if(status)status.value='Revisión fina';refresh();};
  el('download').onclick=()=>{if(current)download(current.text,filename+'_EN_REVISION.txt');};
  field.addEventListener('input',refresh);
  async function renew(){
   const request=++requestId;
   const selected=el('chapter').value;
   resources=null;current=null;el('chapter').disabled=true;el('download').disabled=true;el('state').textContent='Comprobando biblioteca actual…';controls();
   try{
    const loaded=await api.load({fresh:true});if(request!==requestId)return;resources=loaded;
    // The sole legacy adapter is data-driven by its manifest, not a special composer.
    const candidate=item==='Birkat Hamazón'&&nusaj==='Ashkenazí'?resources.manifest?.languages?.[language]:null;
    legacySpec=!cell.composition&&!api.hasReferences(field.value)&&candidate?.references?.every(r=>[r.start,...(r.startAlternatives||[])].some(s=>field.value.includes(s)))?candidate:null;
    el('chapter').replaceChildren(new win.Option('Elegir Tehilim…',''),...resources.corpus.items.map(c=>{
      const s=resources.states.chapters.find(s=>s.chapter===c.chapter),final=!!(s?.approved===true&&s.hebrewApproved===true&&s.phoneticApproved===true&&s.visualCoverageComplete===true);
      return new win.Option('Tehilim '+c.chapter+' · '+(final?'FINAL':'EN REVISIÓN'),String(c.chapter));
    }));el('chapter').value=selected;
    el('chapter').disabled=false;refresh();
   }catch(error){if(request!==requestId)return;el('state').textContent='No se pudo cargar la biblioteca: '+error.message;controls();}
  }
  el('refresh').onclick=renew;controls();const ready=renew();
  return {ready,prepareSave({status:chosen,ref}){
   if(locked)return {...originalCell};
   const body=field.value;
   if(api.hasReferences(body)||legacySpec){
    if(!resources||!current)throw Error('No se guardó: faltan fuentes o hay una referencia inválida.');
    refresh();if(!current)throw Error('No se guardó: referencia inválida.');
    if(legacyDifferent&&!win.confirm('La nueva composición usará los salmos actuales y conservará el resto del rezo. ¿Guardar la vinculación y conservar la copia anterior en el historial?'))throw Error('Guardado cancelado; no se modificó la copia anterior.');
   }
   let next={...originalCell,status:chosen,ref,body};
   if(api.hasReferences(body)||legacySpec){
    const snapshot=chosen==='Aprobado'?api.makeSnapshot({template,language,...resources}):undefined;
    next.composition={schemaVersion:1,source:'tehilim',language,template,...(snapshot?{snapshot}: {})};
    next.body=snapshot?snapshot.text:template;
   }else delete next.composition;
   if(originalCell.status==='Aprobado'||!originalCell.composition&&next.composition&&originalCell.body?.trim())next.editions=[...(originalCell.editions||[]),{
    savedAt:new Date().toISOString(),status:originalCell.status,body:originalCell.body,ref:originalCell.ref,
    ...(originalCell.composition?{composition:originalCell.composition}:{})}];
   return next;
  }};
 }
 return {mount};
});
