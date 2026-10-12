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
        startPosition:start,endPosition:end,
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
    const text=String(body).replace(/^(\d+):(\d+)([ \t]{2})(.*)$/gm,(line,chapterNumber,verseNumber,separator,oldText)=>{
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
    const response = await fetch(path+'?revision='+Date.now(), {cache:'no-store'});
    if(!response.ok) throw new Error('No se pudo cargar ' + path + ' (HTTP ' + response.status + ')');
    return response.json();
  }
  function load({fresh=false}={}) {
    if(fresh)cachedResources=null;
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
    return typeof item==='string' && !!item.trim() && typeof nusaj==='string' &&
      (lang==='Hebreo' || lang==='Fonética');
  }
  function hasReferences(body){return /\{\{tehilim:/i.test(String(body||''));}
  function referenceToken(chapter,from=1,to){
    ensure(Number.isInteger(chapter)&&chapter>=1&&chapter<=150,'Salmo inválido (1–150).');
    ensure(Number.isInteger(from)&&from>=1,'Inicio de pasaje inválido.');
    ensure(to===undefined || Number.isInteger(to)&&to>=from,'Fin de pasaje inválido.');
    return '{{tehilim:'+chapter+(to===undefined&&from===1?'':':'+from+'-'+(to??from))+'}}';
  }
  /** All catalog consumers use the same reference syntax; no copied Psalm in a draft. */
  function resolveTemplate({template,language,corpus,states,allowDraft=false}){
    ensure(language==='hebrew'||language==='phonetic','Idioma aún no disponible en la biblioteca: '+language);
    const source=String(template||''),references=[];
    const text=source.replace(/\{\{tehilim:([^{}]*)\}\}/gi,(token,id)=>{
      const m=id.match(/^(\d{1,3})(?::(\d{1,3})-(\d{1,3}))?$/);
      ensure(m,'Referencia Tehilim inválida: '+token);
      const chapter=+m[1],from=m[2]?+m[2]:1;
      const item=(corpus.items||[]).find(c=>c.chapter===chapter);
      ensure(item&&Array.isArray(item.verses),'Falta Tehilim '+chapter+' en la biblioteca.');
      const to=m[3]?+m[3]:item.verses.length;
      ensure(chapter>=1&&chapter<=150&&from>=1&&to>=from&&to<=item.verses.length,'Rango fuera de Tehilim '+chapter+'.');
      const state=(states.chapters||[]).find(c=>c.chapter===chapter);
      const approved=!!(state?.approved===true&&state.hebrewApproved===true&&state.phoneticApproved===true&&state.visualCoverageComplete===true);
      if(!allowDraft)approvedChapter(corpus,states,chapter,language);
      const verses=item.verses.slice(from-1,to);
      ensure(verses.length===to-from+1&&verses.every((v,i)=>v.verse===from+i&&typeof v[language]==='string'&&v[language].trim()),'Pasaje incompleto: '+token);
      const canonicalText=verses.map(v=>v[language]).join(' ');
      references.push({passageId:'tehilim:'+chapter+':'+from+'-'+to,chapter,from,to,
        verses:verses.length,approved,approvedDate:state?.approvedDate||'',canonicalText});
      return canonicalText;
    });
    ensure(!/\{\{tehilim:/i.test(text),'Referencia Tehilim incompleta; no se exportó el documento.');
    return {text,references,allApproved:references.every(r=>r.approved),language};
  }
  /** Adapter for the two existing anchored slots. Run only by explicit editorial choice. */
  function legacyToTemplate({body,language,spec,corpus,states}){
    const result=compose({body,language,spec,corpus,states});
    let template=normalizedBody(body,spec);
    for(const ref of [...result.references].reverse()){
      const old=template.slice(ref.startPosition,ref.endPosition);
      const trailing=old.slice(old.trimEnd().length);
      template=template.slice(0,ref.startPosition)+referenceToken(ref.chapter)+trailing+template.slice(ref.endPosition);
    }
    return template;
  }
  function makeSnapshot({template,language,corpus,states,createdAt=new Date().toISOString()}){
    const resolved=resolveTemplate({template,language,corpus,states});
    return Object.freeze({schemaVersion:1,createdAt,language,text:resolved.text,
      references:Object.freeze(resolved.references.map(r=>Object.freeze({...r})))});
  }
  function resolveMasterCell({cell,language,corpus,states,allowDraft=false}){
    // Approved/released text is an edition, not a live pointer. Never re-resolve it.
    if(cell.status==='Aprobado')return {text:cell.body||'',references:cell.composition?.snapshot?.references||[],frozen:true};
    const template=cell.composition?.template??cell.body??'';
    return {...resolveTemplate({template,language,corpus,states,allowDraft}),frozen:false};
  }
  function listUsages({cells,chapter,manifest}){
    const usages=[];
    for(const [key,active]of Object.entries(cells||{})){
      const [item,nusaj,lang]=key.split('||');
     for(const [edition,cell]of [[null,active],...(active.editions||[]).map((c,i)=>[i,c])]){
      const source=cell.composition?.template??cell.body??'';
      let ranges=[...String(source).matchAll(/\{\{tehilim:(\d{1,3})(?::(\d{1,3})-(\d{1,3}))?\}\}/gi)]
        .map(m=>({chapter:+m[1],from:m[2]?+m[2]:1,to:m[3]?+m[3]:null}));
      if(!ranges.length&&item==='Birkat Hamazón'&&nusaj==='Ashkenazí'){
        const cfg=manifest?.languages?.[lang==='Hebreo'?'hebrew':lang==='Fonética'?'phonetic':'unsupported'];
        ranges=(cfg?.references||[]).filter(r=>[r.start,...(r.startAlternatives||[])].some(s=>String(source).includes(s))).map(r=>({chapter:r.chapter,from:1,to:null}));
      }
      for(const range of ranges)if(chapter===undefined||chapter===range.chapter)usages.push({key,item,nusaj,lang,...range,status:cell.status,frozen:cell.status==='Aprobado',historical:edition!==null,edition});
     }
    }
    return usages;
  }
  function mountForMaster(options){
    if(!isSupportedMaster(options.item,options.nusaj,options.lang))return false;
    if(typeof window!=='undefined'&&window.JDPassageLibraryUI)return window.JDPassageLibraryUI.mount({...options,api});
    return false; // Fail closed if the generic editor did not load.
  }
  const api={compose,overlayFinalVerses,load,isSupportedMaster,mountForMaster,approvedChapter,
    referenceToken,hasReferences,resolveTemplate,legacyToTemplate,makeSnapshot,resolveMasterCell,listUsages};
  return api;
});
