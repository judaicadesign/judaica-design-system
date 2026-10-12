/* One corpus; presentation markers are metadata, never part of a prayer's source. */
(function(root){
 'use strict';
 function letter(n){
  if(!Number.isInteger(n)||n<1||n>199)throw Error('Número de pasuk fuera de rango.');
  let s='';if(n>=100){s+='ק';n-=100;}if(n===15)return s+'טו';if(n===16)return s+'טז';
  return s+['','י','כ','ל','מ','נ','ס','ע','פ','צ'][Math.floor(n/10)]+['','א','ב','ג','ד','ה','ו','ז','ח','ט'][n%10];
 }
 function parse(text){
  const chapters=new Map();
  for(const line of text.split(/\r?\n/)){
   const m=line.match(/^(\d+):(\d+)\s{2}(.*)$/);if(!m)continue;
   const chapter=+m[1],verse=+m[2];if(!chapters.has(chapter))chapters.set(chapter,[]);
   const rows=chapters.get(chapter);if(chapter<1||chapter>150||verse!==rows.length+1||!m[3].trim())throw Error('Referencia inválida en '+m[1]+':'+m[2]);
   rows.push({verse,text:m[3]});
  }
  if(chapters.size!==150||[...chapters.values()].reduce((s,v)=>s+v.length,0)!==2527)throw Error('Conservá las referencias del master: deben existir 150 capítulos y 2.527 pesukim.');
  return chapters;
 }
 const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 const rtf=s=>String(s).split('').map(c=>{const n=c.charCodeAt(0);return n>127?'\\u'+(n>32767?n-65536:n)+'?':/[{}\\]/.test(c)?'\\'+c:c}).join('');
 const markerStyle='.jd-pasuk{font-size:.7em;color:#888;font-weight:normal;margin-inline:.3em;unicode-bidi:isolate;white-space:nowrap}';
 function render(text,language){
  const heb=language==='hebrew';
  return [...parse(text)].map(([n,v])=>'<section data-chapter="'+n+'"><h3>'+esc('Tehilim '+n+' · '+letter(n))+'</h3><p dir="'+(heb?'rtl':'ltr')+'">'+v.map(x=>'<span class="jd-pasuk" dir="rtl" data-verse="'+x.verse+'" aria-label="Pasuk '+x.verse+'">'+letter(x.verse)+'</span> '+esc(x.text)).join(' ')+'</p></section>').join('');
 }
 function format(text,language,mode){
  if(!['hebrew','phonetic'].includes(language))throw Error('Idioma no disponible.');
  if(mode==='review')return {text,type:'text/plain;charset=utf-8',ext:'txt'};
  if(!['continuous','numbered','numbered-rtf','numbered-html'].includes(mode))throw Error('Presentación no disponible.');
  const chapters=parse(text),heb=language==='hebrew';
  if(mode==='continuous'||mode==='numbered')return {
   text:'Judaica Design® · Tehilim 1–150\nEN REVISIÓN\n\n'+[...chapters].map(([n,v])=>'TEHILIM '+n+' · '+letter(n)+'\n'+v.map(x=>(mode==='numbered'?letter(x.verse)+'\u00a0':'')+x.text).join(' ')).join('\n\n')+'\n',type:'text/plain;charset=utf-8',ext:'txt'};
  if(mode==='numbered-rtf')return {
   text:'{\\rtf1\\ansi\\deff0\\uc1{\\fonttbl{\\f0 Arial;}{\\f1 Arial;}}{\\colortbl;\\red0\\green0\\blue0;\\red136\\green136\\blue136;}{\\stylesheet{\\s0\\f0\\fs28 Normal;}{\\*\\cs1\\additive\\f1\\fs20\\cf2 JD Pasuk;}}\\viewkind4\\s0\\fs28 '+rtf('Judaica Design® · Tehilim 1–150 · EN REVISIÓN')+'\\par '+[...chapters].map(([n,v])=>'\\pard\\ltrpar\\b '+rtf('Tehilim '+n)+'\\b0\\par\\pard'+(heb?'\\rtlpar\\qr ':'\\ltrpar\\ql ')+v.map(x=>'{\\cs1\\rtlch\\f1\\fs20\\cf2 '+rtf(letter(x.verse))+'} {\\f0\\fs28\\cf1 '+(heb?'\\rtlch ':'\\ltrch ')+rtf(x.text)+'} ').join('')+'\\par\\par ').join('')+'}',type:'application/rtf',ext:'rtf'};
  return {text:'<!doctype html><html lang="'+(heb?'he':'es')+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tehilim 1–150 · En revisión</title><style>body{max-width:900px;margin:32px auto;padding:0 20px;font:20px/1.9 Arial,sans-serif;color:#111}h1{font-size:26px}h3{font-size:22px;margin-top:32px}'+markerStyle+'</style><h1>Judaica Design® · Tehilim 1–150</h1><p>En revisión. Las letras de pasuk tienen estilo propio y no forman parte del texto maestro.</p>'+render(text,language)+'</html>',type:'text/html;charset=utf-8',ext:'html'};
 }
 const api={letter,parse,format,render,markerStyle};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.JDTehilimExport=api;
})(typeof window!=='undefined'?window:globalThis);
