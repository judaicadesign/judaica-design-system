const fs=require('node:fs'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');
const modal=html.slice(html.indexOf('const modal3='),html.indexOf('// ---------------- PRESUPUESTOS GUARDADOS'));
const startMasters=html.indexOf('// ---------------- MASTERS POR ÍTEM DE ÍNDICE');
const endMasters=html.indexOf('\ndrawMasters3();\n\n// Development catalog',startMasters);
assert.ok(startMasters>=0&&endMasters>startMasters,'must extract the entire Masters UI block, not an inner callback');
const block=html.slice(startMasters,endMasters+'\ndrawMasters3();'.length);
const data=JSON.parse(fs.readFileSync('masters/tehilim/tehilim.json','utf8'));
assert.equal(data.items.length,150);assert.equal(data.items.reduce((a,c)=>a+c.verses.length,0),2527);
assert.equal(data.items[118].verses.length,176);
const heb=fs.readFileSync('masters/tehilim/TEHILIM_001-150_HEBREO_EN_REVISION.txt','utf8'),phon=fs.readFileSync('masters/tehilim/TEHILIM_001-150_FONETICA_EN_REVISION.txt','utf8');
for(const text of [heb,phon])assert.equal((text.match(/^\d+:\d+  /gm)||[]).length,2527);
assert.deepEqual([...heb.matchAll(/^(\d+:\d+)  /gm)].map(m=>m[1]),[...phon.matchAll(/^(\d+:\d+)  /gm)].map(m=>m[1]));
assert.equal(data.items[22].verses.reduce((n,v)=>n+(v.hebrew.match(/ֽ/g)||[]).length,0),16);assert.match(phon,/23:4 .*Atá .*Shivtejá uMish'anteja/);assert.match(phon,/23:6 .*veshavtí/);
assert.match(phon,/37:20 .*yovedu/i);assert.match(phon,/47:2 .*harí'u/i);
const dom=new JSDOM('<section id="masters"></section>',{url:'https://example.test/',runScripts:'outside-only'}),w=dom.window;
w.JDTehilimExport=require('../assets/jd-tehilim-export.js');w.JDPassageLinks={...require('../assets/jd-passage-links.js'),load:async()=>({corpus:data,states:JSON.parse(fs.readFileSync('masters/tehilim/REVISION_ESTADO.json','utf8'))})};let downloaded;w.Blob=Blob;w.URL.createObjectURL=b=>{downloaded=b;return 'blob:test'};w.URL.revokeObjectURL=()=>{};w.HTMLAnchorElement.prototype.click=function(){assert.match(this.download,/TEHILIM_001-150_/)};
w.fetch=async url=>({ok:true,text:async()=>fs.readFileSync(url,'utf8')});
w.eval(`const esc3=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');const LS3=(k,d)=>JSON.parse(localStorage.getItem(k)||JSON.stringify(d));const SAVE3=(k,v)=>localStorage.setItem(k,JSON.stringify(v));`+modal+block+`;window.setStoredDraft=()=>{masterCells=LS3('jd_master_cells',{})};`);
async function main(){
 for(const [language,expected,dir]of [['hebrew',heb,'rtl'],['phonetic',phon,'ltr']]){
  await w.openTehilimMaster(language);const field=w.document.getElementById('jdTehilimText');assert.equal(field.value,expected);assert.equal(field.dir,dir);assert.equal(field.readOnly,false);
  field.value=expected+'\nEDICIÓN DE PRUEBA';w.document.querySelector('.modal .primary').click();
  await w.openTehilimMaster(language);assert.equal(w.document.getElementById('jdTehilimText').value,expected+'\nEDICIÓN DE PRUEBA');w.document.getElementById('jdTehilimDownload').click();assert.equal(await downloaded.text(),expected+'\nEDICIÓN DE PRUEBA');w.document.querySelector('.modal .jd-x').click();
  for(const mode of ['continuous','numbered']){
   w.document.getElementById('jdTehilimMatrix').click();const buttons=w.document.querySelectorAll('[data-language]');assert.equal(buttons.length,4);w.document.querySelector('[data-language="'+language+'"][data-mode="'+mode+'"]').click();await new Promise(r=>setTimeout(r,0));
   const view=w.document.getElementById('jdTehilimText');assert.equal(view.value,w.JDTehilimExport.format(expected,language,mode).text);assert.equal(view.readOnly,true);assert.equal(view.dir,dir);assert.equal(w.document.querySelector('.modal .primary').hidden,true);assert.equal(w.document.getElementById('jdTehilimFormat'),null);
   w.document.getElementById('jdTehilimDownload').click();assert.equal(await downloaded.text(),view.value);w.document.getElementById('jdTehilimEdit').click();await new Promise(r=>setTimeout(r,0));assert.equal(w.document.getElementById('jdTehilimText').readOnly,false);w.document.querySelector('.modal .jd-x').click();
  }
 }
 // Reproduce the mobile report: a saved full draft has no Psalm 14 commas,
 // and a canonical resource was already loaded before the chapter was closed.
 const stalePhon=phon.split('\n').map(line=>/^14:/.test(line)?line.replace(/[,;]/g,''):line).join('\n');
 const staleOther=stalePhon.replace('8:1  ','8:1  EDICIÓN LOCAL ');
 w.localStorage.setItem('jd_master_cells',JSON.stringify({'Tehilim 1–150||General||Fonética':{body:staleOther}}));
 w.setStoredDraft();
 const originalLoad=w.JDPassageLinks.load;let freshRequests=0;
 w.JDPassageLinks.load=async options=>{assert.equal(options?.fresh,true,'reopening must renew canonical source');freshRequests++;return originalLoad();};
 for(const mode of ['review','continuous','numbered']){
  await w.openTehilimMaster('phonetic',mode);
  const text=w.document.getElementById('jdTehilimText').value;
  const expected=mode==='review'?phon.replace('8:1  ','8:1  EDICIÓN LOCAL '):w.JDTehilimExport.format(phon.replace('8:1  ','8:1  EDICIÓN LOCAL '),'phonetic',mode).text;
  assert.equal(text,expected,'14 punctuation must reach '+mode+' while preserving non-FINAL edits');
  assert.ok(text.includes("Lamenatséaj leDavid; amar naval belibó en Elohim,"));
  assert.ok(text.includes("Hakol sar, yajdav neelaju; en 'ose tov, en gam ejad."));
  w.document.getElementById('jdTehilimDownload').click();assert.equal(await downloaded.text(),text);
  w.document.querySelector('.modal .jd-x').click();
 }
 assert.equal(freshRequests,3);assert.equal(JSON.parse(w.localStorage.getItem('jd_master_cells'))['Tehilim 1–150||General||Fonética'].body,staleOther,'viewing never overwrites saved edits');
 const wrong=heb.replace('בְמַעְגְּלֵי','בְּמַעְגְּלֵי');assert.equal(w.refreshReviewedTehilim(wrong,'hebrew'),heb,'Retract our erroneous dagesh in saved copies');assert.equal(w.refreshReviewedTehilim(wrong.replace('23:3  ','23:3  EDICIÓN '),'hebrew'),wrong.replace('23:3  ','23:3  EDICIÓN '),'Preserve user-modified lines');
 assert.equal(JSON.parse(w.localStorage.getItem('jd_content_items')||'null'),null);
 console.log('PASS: four matrix views, editable shared bases, live downloads, saved-copy correction and custom-edit preservation');dom.window.close();
}main().catch(e=>{console.error(e);process.exitCode=1});
