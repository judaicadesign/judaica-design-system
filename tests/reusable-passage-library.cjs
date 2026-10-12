'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const lib=require('../assets/jd-passage-links.js'),ui=require('../assets/jd-passage-library-ui.js'),exportsAPI=require('../assets/jd-tehilim-export.js');
const corpus=JSON.parse(fs.readFileSync('masters/tehilim/tehilim.json'));
const states=JSON.parse(fs.readFileSync('masters/tehilim/REVISION_ESTADO.json'));
const manifest=JSON.parse(fs.readFileSync('masters/compositions/BIRKAT_HAMAZON_ASHKENAZI.json'));
const resources={corpus,states,manifest};
const chapter=n=>corpus.items.find(c=>c.chapter===n);
const canonical=(n,from=1,to=chapter(n).verses.length,l='hebrew')=>chapter(n).verses.slice(from-1,to).map(v=>v[l]).join(' ');
for(const language of ['hebrew','phonetic']){
 const template='Condición local\n{{tehilim:137}}\nShabat y Yom Tov\n{{tehilim:126}}\nResto del rezo';
 const r=lib.resolveTemplate({template,language,...resources});
 assert.equal(r.text,'Condición local\n'+canonical(137,1,9,language)+'\nShabat y Yom Tov\n'+canonical(126,1,6,language)+'\nResto del rezo');
 assert.equal(r.references.length,2);assert.equal(r.allApproved,true);assert.ok(!/137:1|JD Pasuk/.test(r.text),'prayer contains no display markers');
 const source=fs.readFileSync(manifest.languages[language].source,'utf8');
 const adopted=lib.legacyToTemplate({body:source,language,spec:manifest.languages[language],...resources});
 assert.match(adopted,/\{\{tehilim:137\}\}/);assert.match(adopted,/\{\{tehilim:126\}\}/);
 assert.ok(!adopted.includes(canonical(137,1,9,language)),'draft stores reference, not copied Psalm');
 assert.equal(lib.resolveTemplate({template:adopted,language,...resources}).text,source,'legacy context and separators unchanged');
}
// Same source, distinct local headings and different products/nusajim.
for(const title of ['Kidush diurno · Sefaradí','Otro rezo · General']){
 const t=title+'\nMizmor LeDavid\n{{tehilim:23}}\nTexto local posterior';
 const r=lib.resolveTemplate({template:t,language:'hebrew',...resources,allowDraft:true});
 assert.equal(r.text,title+'\nMizmor LeDavid\n'+canonical(23)+'\nTexto local posterior');
 assert.throws(()=>lib.makeSnapshot({template:t,language:'hebrew',...resources}),/no tiene las dos aprobaciones FINAL/,'23 is not silently promoted to FINAL');
 assert.equal(lib.isSupportedMaster(title,'Sefaradí','Hebreo'),true);
}
const fragment=lib.resolveTemplate({template:'{{tehilim:14:2-4}}',language:'hebrew',...resources});assert.equal(fragment.text,canonical(14,2,4));
assert.equal(lib.resolveTemplate({template:'{{tehilim:14:1-1}}\n{{tehilim:14:1-1}}',language:'hebrew',...resources}).references.length,2,'intentional repeated use is valid');
for(const template of ['{{tehilim:23:0-2}}','{{tehilim:151}}','{{tehilim:14:1-8}}','{{tehilim:14:4-2}}','{{tehilim:abc}}','{{tehilim:14'])assert.throws(()=>lib.resolveTemplate({template,language:'hebrew',...resources,allowDraft:true}),/./,template);
assert.throws(()=>lib.resolveTemplate({template:'{{tehilim:14}}',language:'spanish',...resources}),/Idioma/);
const template='Encabezado propio\n{{tehilim:14}}\nCondición posterior';
const snap=lib.makeSnapshot({template,language:'hebrew',...resources,createdAt:'test-version'});
const approved={status:'Aprobado',body:snap.text,composition:{template,snapshot:snap}},draft={status:'Revisión fina',body:template,composition:{template}};
const modified=JSON.parse(JSON.stringify(corpus));modified.items[13].verses[0].hebrew+=' CORRECCIÓN FUTURA';
assert.equal(lib.resolveMasterCell({cell:approved,language:'hebrew',corpus:modified,states}).text,snap.text,'released edition never changes');
assert.ok(lib.resolveMasterCell({cell:draft,language:'hebrew',corpus:modified,states}).text.includes('CORRECCIÓN FUTURA'),'draft follows source');
assert.ok(Object.isFrozen(snap));assert.ok(Object.isFrozen(snap.references));
const cells={'Kidush diurno||Sefaradí||Hebreo':{status:'Revisión fina',body:'{{tehilim:23}}'},'Otro contenido||General||Fonética':{status:'Revisión fina',composition:{template:'Condición\n{{tehilim:23:2-5}}'}},'Edición||General||Hebreo':approved};
assert.equal(lib.listUsages({cells,chapter:23}).length,2,'reverse usage registry covers distinct contexts');
assert.equal(lib.listUsages({cells,chapter:14})[0].frozen,true,'reverse registry identifies frozen consumer');
const heb=fs.readFileSync('masters/tehilim/TEHILIM_001-150_HEBREO_EN_REVISION.txt','utf8');
const continuous=exportsAPI.format(heb,'hebrew','continuous').text,numbered=exportsAPI.format(heb,'hebrew','numbered').text;
assert.equal(continuous.split('\n').length,numbered.split('\n').length,'no extra paragraph per pasuk');
assert.ok(numbered.includes('א\u00a0'+chapter(14).verses[0].hebrew+' ב\u00a0'+chapter(14).verses[1].hebrew));
const doc=new JSDOM(exportsAPI.format(heb,'hebrew','numbered-html').text).window.document;
assert.equal(doc.querySelectorAll('.jd-pasuk').length,2527);assert.equal(doc.querySelectorAll('section > p').length,150);
assert.equal(doc.querySelector('section[data-chapter="14"] .jd-pasuk').textContent,'א');
assert.ok(!doc.querySelector('section[data-chapter="14"] p').querySelector('br'));
assert.match(exportsAPI.markerStyle,/color:#888/);assert.match(exportsAPI.markerStyle,/font-size:\.7em/);
const rtf=exportsAPI.format(heb,'hebrew','numbered-rtf').text;
assert.match(rtf,/\\cs1\\additive.*JD Pasuk;/);assert.equal((rtf.match(/\{\\cs1\\rtlch/g)||[]).length,2527);
assert.equal((rtf.match(/\\par(?=[\\ ])/g)||[]).length,451,'only header/chapter paragraphs, never verse paragraphs');
async function domTest(){
 function editor(cell,item='Kidush diurno',nusaj='Sefaradí',language='Hebreo',fail=false){
  const dom=new JSDOM('<div id="root"><select id="mcStatus"><option>Revisión fina</option><option>Aprobado</option></select><input id="mcRef"><textarea id="mcBody"></textarea><div id="jdLinkedPassages"></div><button class="jd-s">Guardar</button></div>',{url:'https://example.test/'});
  const w=dom.window;w.confirm=()=>true;w.Blob=Blob;w.URL.createObjectURL=()=> 'blob:edition';w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){};
  const root=w.document.getElementById('root');root.querySelector('#mcBody').value=cell.body||'';root.querySelector('#mcStatus').value=cell.status||'Revisión fina';
  const api={...lib,load:async o=>{assert.equal(o.fresh,true);if(fail)throw Error('provider unavailable');return resources;}};
  return {dom,w,root,controller:ui.mount({root,item,nusaj,lang:language,cell,api,getCells:()=>cells})};
 }
 let e=editor({status:'Revisión fina',body:'Kidush local\n',customMetadata:42});await e.controller.ready;
 const select=e.root.querySelector('[data-library-chapter]');select.value='23';select.onchange();
 assert.match(e.root.querySelector('[data-library-usages]').textContent,/Kidush diurno/);e.root.querySelector('[data-library-source]').click();assert.equal(e.root.querySelector('[data-library-source-preview]').value,canonical(23));
 const field=e.root.querySelector('#mcBody');field.selectionStart=field.selectionEnd=field.value.length;
 e.root.querySelector('[data-library-heading]').value='Mizmor LeDavid';e.root.querySelector('[data-library-condition]').value='Antes del Kidush diurno';
 e.root.querySelector('[data-library-insert]').click();
 assert.match(field.value,/Mizmor LeDavid\nAntes del Kidush diurno\n\{\{tehilim:23:1-6\}\}/);
 assert.ok(e.root.querySelector('[data-library-preview]').value.includes(canonical(23)));
 assert.throws(()=>e.controller.prepareSave({status:'Aprobado',ref:'ArtScroll'}),/no tiene las dos aprobaciones FINAL/);
 const saved=e.controller.prepareSave({status:'Revisión fina',ref:'ArtScroll'});assert.equal(saved.customMetadata,42);assert.match(saved.body,/\{\{tehilim:23/);e.dom.window.close();
 e=editor(JSON.parse(JSON.stringify(saved)));await e.controller.ready;assert.ok(e.root.querySelector('[data-library-preview]').value.includes(canonical(23)),'reload persisted reference');e.dom.window.close();
 e=editor({...approved,ref:'fuente original',customMetadata:7});await e.controller.ready;
 assert.equal(e.root.querySelector('#mcBody').value,snap.text);assert.equal(e.root.querySelector('#mcBody').readOnly,true);
 assert.deepEqual(e.controller.prepareSave({status:'Aprobado',ref:'otra'}),{...approved,ref:'fuente original',customMetadata:7},'opening/review does not write approved source');
 e.root.querySelector('[data-library-unlock]').click();assert.equal(e.root.querySelector('#mcBody').value,template);
 const newReview=e.controller.prepareSave({status:'Revisión fina',ref:'nueva'});assert.equal(newReview.editions[0].body,snap.text);assert.equal(newReview.status,'Revisión fina');e.dom.window.close();
 e=editor({status:'Revisión fina',body:template});await e.controller.ready;const published=e.controller.prepareSave({status:'Aprobado',ref:'fuente'});assert.equal(published.body,snap.text);assert.equal(published.composition.snapshot.text,snap.text);e.dom.window.close();
 e=editor({status:'Aprobado',body:'EDICIÓN ENTREGADA'},'Otro contenido','General','Hebreo',true);await e.controller.ready;assert.equal(e.controller.prepareSave({status:'Aprobado'}).body,'EDICIÓN ENTREGADA');e.dom.window.close();
 e=editor({status:'Revisión fina',body:'{{tehilim:14}}'},'Otro contenido','General','Hebreo',true);await e.controller.ready;assert.throws(()=>e.controller.prepareSave({status:'Aprobado'}),/faltan fuentes/);e.dom.window.close();
 console.log('PASS reusable library: any catalog item, ranges, contextual headings, live drafts, frozen editions, approval/network gates, persisted links and 2527 inline character-style markers');
}
domTest().catch(error=>{console.error(error);process.exitCode=1});
