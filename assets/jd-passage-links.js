/* Judaica Design® — composition of canonical passages without losing local liturgical context.
 * Pure compose() function works in Node/browser; browser panel never silently changes a saved master.
 * Hebrew/phonetic approval comes from REVISION_ESTADO.json, NOT stale approvedChapters metadata.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.JDPassageLinks = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  const BASE = 'masters/tehilim/';
  const MANIFEST = 'masters/compositions/BIRKAT_HAMAZON_ASHKENAZI.json';
  let cachedResources = null;
  const squash = s => String(s || '').replace(/\s+/g, ' ').trim();
  const ensure = (yes, reason) => { if (!yes) throw new Error(reason); };
  function normalizedBody(raw, cfg) {
    let text = String(raw || '');
    for (const rule of cfg.headingNormalize || []) {
      if (text.includes(rule.before))
        text = text.replace(rule.before, rule.after);
    }
    return text;
  }
  function approvedChapter(corpus, states, chapter, language) {
    const item = (corpus.items || []).find(c => c.chapter === chapter);
    const state = (states.chapters || []).find(c => c.chapter === chapter);
    ensure(item && Array.isArray(item.verses), 'Falta Tehilim ' + chapter + ' en el corpus canónico.');
    ensure(state && state.approved === true && state.hebrewApproved === true &&
      state.phoneticApproved === true && state.visualCoverageComplete === true,
      'Tehilim ' + chapter + ' no tiene las dos aprobaciones FINAL verificadas.');
    ensure(language === 'hebrew' || language === 'phonetic', 'Capa aún no vinculable: ' + language);
    ensure(item.verses.every((v,i) => v.verse === i+1 && typeof v[language] === 'string' && v[language].length),
      'Faltan versículos ' + language + ' en Tehilim ' + chapter);
    return {text: item.verses.map(v => v[language]).join(' '), status: state, count: item.verses.length};
  }
  /** Compose ordered canonical refs, preserving literally all original local text outside the slots.
   * No substring replacement of "Bável": entire verse-based references are re-resolved.
   * Throws (rather than silently duplicating) when source section anchors are ambiguous.
   */
  function compose({body, language, spec, corpus, states}) {
    ensure(spec && Array.isArray(spec.references) && spec.references.length, 'Documento sin referencias declaradas.');
    const original = normalizedBody(body,spec);
    let result = '', cursor = 0;
    const references = [];
    for (let i = 0; i < spec.references.length; i++) {
      const ref = spec.references[i];
      const starts = [ref.start, ...(ref.startAlternatives || [])]
        .map(marker => ({marker, position:original.indexOf(marker,cursor)}))
        .filter(v=>v.position>=cursor).sort((a,b)=>a.position-b.position);
      ensure(starts.length, 'No se encontró el inicio del pasaje ' + ref.passageId + '. No se cambió el documento.');
      const start=starts[0].position;
      const end = original.indexOf(ref.endAt, start + starts[0].marker.length);
      ensure(!starts.some(v=>v.position>start && v.position<end),
        'Inicio ambiguo de ' + ref.passageId + '. Revisión manual necesaria.');
      ensure(end > start, 'Falta delimitador de contexto después de ' + ref.passageId + '. No se cambió el documento.');
      const next = spec.references[i+1];
      if(next) {
        const nextStart=[next.start,...(next.startAlternatives || [])]
          .map(marker=>original.indexOf(marker,end)).filter(i=>i>=0).sort((a,b)=>a-b)[0];
        ensure(nextStart > end, 'Se alteró el orden del documento antes de ' + next.passageId + '.');
      }
      const selected = approvedChapter(corpus,states,ref.chapter,language);
      const previous = original.slice(start,end).trim();
      result += original.slice(cursor,start);
      result += selected.text;
      result += i === spec.references.length - 1 ? '\n' : '\n\n';
      references.push({
        passageId:ref.passageId,chapter:ref.chapter,label:ref.label,
        verses:selected.count,approvedDate:selected.status.approvedDate || '',
        replacedCopyWasDifferent: squash(previous) !== squash(selected.text),
        canonicalText:selected.text,previousText:previous
      });
      cursor = end;
    }
    result += original.slice(cursor);
    return {text:result, documentId:spec.documentId || 'document', language, references,
      oldCopiesDiffer: references.some(r=>r.replacedCopyWasDifferent)};
  }
  /** Merge protected FINAL verses into the 150-chapter editor's saved/local draft.
   * Only approved verses are projected from tehilim.json; all non-FINAL lines
   * and local edits stay untouched. This is a read-time view, never a silent save.
   */
  function overlayFinalVerses({body,language,corpus,states}) {
    ensure(language==='hebrew'||language==='phonetic','Idioma no compatible para Tehilim.');
    const finals=new Map();
    for(const state of states.chapters||[]) {
      if(state.approved===true && state.hebrewApproved===true &&
         state.phoneticApproved===true && state.visualCoverageComplete===true) {
        const chapter=(corpus.items||[]).find(x=>x.chapter===state.chapter);
        approvedChapter(corpus,states,state.chapter,language);
        finals.set(state.chapter,chapter.verses.map(v=>v[language]));
      }
    }
    ensure(finals.size>0,'No hay capítulos FINAL verificados; no se actualizó el texto.');
    const seen=new Map([...finals.keys()].map(k=>[k,new Set()]));
    let changed=0;
    const text=String(body).replace(/^(\\d+):(\\d+)([ \\t]{2})(.*)$/gm,(line,chapterNumber,verseNumber,separator,oldText)=>{
      const chapter=+chapterNumber,verse=+verseNumber,source=finals.get(chapter);
      if(!source)return line;
      ensure(verse>=1 && verse<=source.length,'Versículo fuera del máster FINAL: '+chapter+':'+verse);
      ensure(!seen.get(chapter).has(verse),'Versículo duplicado en capítulo FINAL: '+chapter+':'+verse);
      seen.get(chapter).add(verse);
      const canonical=source[verse-1];
      if(oldText!==canonical)changed++;
      return chapterNumber+':'+verseNumber+separator+canonical;
    });
    for(const [chapter,verses] of finals)ensure(seen.get(chapter).size===verses.length,
      'Capítulo FINAL incompleto en el texto de edición: '+chapter+'. No se guardó ningún cambio.');
    return {text,changedVerses:changed,finalChapters:[...finals.keys()]};
  }
  async function fetchJson(path) {
    const response = await fetch(path, {cache:'no-store'});
    if(!response.ok) throw new Error('No se pudo cargar ' + path + ' (HTTP ' + response.status + ')');
    return response.json();
  }
  function load() {
    if(!cachedResources) {
      cachedResources=Promise.all([
        fetchJson(BASE+'tehilim.json'),
        fetchJson(BASE+'REVISION_ESTADO.json'),
        fetchJson(MANIFEST)
      ]).then(([corpus,states,manifest])=>({corpus,states,manifest}))
        .catch(err=>{cachedResources=null;throw err;});
    }
    return cachedResources;
  }
  function isSupportedMaster(item,nusaj,lang) {
    return item==='Birkat Hamazón' && nusaj==='Ashkenazí' && (lang==='Hebreo' || lang==='Fonética');
  }
  function makeDownload(text, language) {
    const blob = new Blob([text],{type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download='BIRKAT_HAMAZON_ASHKENAZI_'+(language==='hebrew'?'HEBREO':'FONETICA')+'_VINCULADO.txt';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function mountForMaster({root, item, nusaj, lang, status}) {
    if(!isSupportedMaster(item,nusaj,lang)) return false;
    const holder=root.querySelector('#jdLinkedPassages');
    const field=root.querySelector('#mcBody');
    if(!holder || !field) return false;
    holder.innerHTML=
      '<div class="jd-panel" style="margin:12px 0;padding:14px">'+
      '<h3>Composición vinculada a Tehilim</h3>'+
      '<p class="small muted">Tehilim es la fuente única del texto de cada salmo. Los encabezados (tajanún / Shabat y Yom Tov) y el resto de Birkat Hamazón se conservan como texto local. La vista y el TXT siempre usan el máster actual.</p>'+
      '<p class="small" data-jd-linkstatus role="status">Comprobando capítulos FINAL…</p>'+
      '<p class="small" data-jd-impact></p>'+
      '<textarea readonly data-jd-linkedpreview style="width:100%;min-height:240px;line-height:1.65" aria-label="Texto compuesto con referencias canónicas"></textarea>'+
      '<p><button type="button" class="btn sm" data-jd-down disabled>Descargar TXT vinculado</button> '+
      '<button type="button" class="btn sm" data-jd-stage disabled>Pasar esta composición al editor (requiere revisión)</button></p>'+
      '<p class="small muted">La copia anterior y cualquier publicación FINAL permanecen intactas. Guardar una nueva composición es una decisión editorial explícita; no se modifican PDFs ya entregados.</p>'+
      '</div>';
    const label=holder.querySelector('[data-jd-linkstatus]');
    const impact=holder.querySelector('[data-jd-impact]');
    const preview=holder.querySelector('[data-jd-linkedpreview]');
    const down=holder.querySelector('[data-jd-down]');
    const stage=holder.querySelector('[data-jd-stage]');
    const language=lang==='Hebreo'?'hebrew':'phonetic';
    preview.dir=language==='hebrew'?'rtl':'ltr';
    const save=root.querySelector('.jd-s');
    const originalSave=save?.onclick;
    field.readOnly=true;
    if(save)save.disabled=true;
    let current=null, resources=null;
    // Guardar nunca persiste una copia divergente de los salmos FINAL.
    if(save && originalSave)save.onclick=()=>{if(!current)return;field.value=current.text;originalSave();};
    function refresh() {
      if(!resources)return;
      try {
        const spec=resources.manifest.languages[language];
        current=compose({...resources,body:field.value,language,
          spec:{...spec,documentId:resources.manifest.documentId}});
        preview.value=current.text;
        label.textContent=current.references.map(r=>'Tehilim '+r.chapter+' · '+r.verses+' pesukim · FINAL').join('  |  ');
        impact.textContent=current.oldCopiesDiffer
          ?'La copia incorporada difiere del máster de Tehilim. La vista vinculada usa la versión canónica y deja el resto del rezo intacto.'
          :'Los pasajes incorporados coinciden con Tehilim; se conserva el contexto litúrgico.';
        down.disabled=false; stage.disabled=false;
      } catch(err) {
        current=null;preview.value='';down.disabled=true;stage.disabled=true;
        label.textContent='Vinculación bloqueada: '+err.message;
        impact.textContent='Revisá las delimitaciones del texto original; no se perdió ni se reemplazó contenido.';
      }
    }
    down.onclick=()=>{if(current) makeDownload(current.text,language);};
    stage.onclick=()=>{
      if(!current || !window.confirm('¿Copiar el texto vinculado al editor como REVISIÓN FINA? Los capítulos Tehilim FINAL no cambian y el master original no se guarda hasta pulsar Guardar Master.'))return;
      field.value=current.text;
      const s=root.querySelector('#mcStatus');if(s) s.value='Revisión fina';
      refresh();
    };
    field.addEventListener('input',refresh);
    load().then(data=>{
      resources=data;
      refresh();
      if(!current)return;
      const wasOutdated=current.oldCopiesDiffer;
      // Show canonical verses in the TOP editor too, not only far below it.
      // Local storage is not touched until the user explicitly clicks Guardar Master.
      field.value=current.text;
      refresh();
      field.readOnly=false;
      if(save)save.disabled=false;
      stage.hidden=true;
      if(wasOutdated)impact.textContent='Salmos 137 y 126 actualizados desde Tehilim FINAL en esta vista. El contexto litúrgico se conserva. Tu copia guardada no se modifica hasta elegir Guardar Master.';
    }).catch(err=>{label.textContent='No se pudo cargar Tehilim: '+err.message;});
    return true;
  }
  return {compose,overlayFinalVerses,load,isSupportedMaster,mountForMaster,approvedChapter};
});
