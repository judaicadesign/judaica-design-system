/* Same-record edits with immutable revision snapshots; no storage writes here. */
(function(root){
  'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  function normalize(value){
    if(Array.isArray(value))return value.map(normalize);
    if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,normalize(value[key])]));
    if(typeof value==='string'&&value.startsWith('https://athiruoimehofqzrplnl.supabase.co/storage/v1/object/'))return value.replace('/object/public/','/object/sign/').split('?')[0];
    return value;
  }
  const fingerprint=q=>JSON.stringify(normalize(q));
  function replace(current,edited,expected){
    if(!current)throw Error('El presupuesto ya no está disponible. No se guardó ningún cambio.');
    if(fingerprint(current)!==expected)throw Error('Este presupuesto cambió en otro dispositivo. Volvé a abrirlo antes de editar.');
    const old=copy(current);delete old.revisions;
    const next={...copy(current),...copy(edited),id:current.id,created:current.created,quoteFamily:current.quoteFamily||current.id,revision:Number(current.revision||1)+1,updatedAt:new Date().toISOString(),status:'Listo para enviar',revisions:[...(current.revisions||[]),{revision:Number(current.revision||1),archivedAt:new Date().toISOString(),snapshot:old}]};
    delete next.pdfUrl;delete next.pdfSnapshot;delete next.pdfGeneratedAt;delete next.sentConfirmedAt;
    if(current.parentQuoteId)next.parentQuoteId=current.parentQuoteId;else delete next.parentQuoteId;
    return next;
  }
  const api={fingerprint,replace};
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.jdQuoteEditTools=api;
})(typeof window!=='undefined'?window:null);
