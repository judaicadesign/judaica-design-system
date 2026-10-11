'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const j=relative=>JSON.parse(read(relative));
const linked=require('../assets/jd-passage-links.js');
const corpus=j('masters/tehilim/tehilim.json');
const states=j('masters/tehilim/REVISION_ESTADO.json');
const manifest=j('masters/compositions/BIRKAT_HAMAZON_ASHKENAZI.json');
const finals=states.chapters.filter(x=>x.approved&&x.hebrewApproved&&x.phoneticApproved).map(x=>x.chapter);
assert.deepEqual(finals,[1,2,3,4,5,6,7,14,126,137],'approval count protected');
assert.deepEqual(corpus.approvedChapters,finals,'canonical approval metadata must match review state');
for(const language of ['hebrew','phonetic']){
 const cfg=manifest.languages[language],src=read(cfg.source);
 const out=linked.compose({body:src,language,spec:{...cfg,documentId:manifest.documentId},corpus,states});
 assert.equal(src,read(cfg.source),'composing must not mutate original files');
 assert.equal(out.references.length,2,'137 and 126 are the two linked passages');
 assert.deepEqual(out.references.map(r=>r.chapter),[137,126],'liturgical order preserved');
 for(const ref of out.references){
  const chapter=corpus.items[ref.chapter-1];
  assert.ok(out.text.includes(chapter.verses.map(v=>v[language]).join(' ')), 'canonical Tehilim '+ref.chapter+' inserted verbatim');
  assert.equal(out.text.split(chapter.verses[0][language]).length-1,1,'do not duplicate Psalm '+ref.chapter);
  assert.equal(ref.verses,chapter.verses.length);
 }
 assert.ok(out.text.length>src.length-500,'non-Psalm parts cannot disappear silently');
 if(language==='phonetic'){
  assert.match(out.text,/En días que se dice tajanún:\n'Al naharot Bavél,/);
  assert.match(out.text,/En Shabat, Yom Tov y en una comida de mitsvá\nShir hama'alot,/);
  assert.ok(!out.text.includes('Bável'),'legacy incorrect stress must never leak from Birkat into linked composition');
  assert.ok(out.text.includes('Tehilat Ad-nai yedaber pi.'),'post-Psalm prayers retained');
  assert.ok(out.text.includes('Rabotái nevarej'),'zimun retained');
  assert.ok(out.text.includes('En Janucá y Purim se agrega:'),'liturgical conditions retained');
  assert.ok(out.references.every(r=>!r.replacedCopyWasDifferent),'checked-in working copies now match canonical FINAL');
 }else{
  assert.ok(out.text.includes('בימות החול– עַל נַהֲרוֹת'),'Hebrew opening context unchanged');
  assert.ok(out.text.includes('בשבת, יום טוב ובסעודת מצוה– שִׁיר'),'Hebrew Shabat context unchanged');
  assert.ok(out.text.includes('תְּהִלַּת יְיָ'),'Hebrew post-Psalm prayers retained');
  assert.ok(out.text.includes('זימון'),'Hebrew zimun retained');
 }
 // Idempotent: viewing or staging and recomposing cannot make verses multiply.
 const again=linked.compose({body:out.text,language,spec:{...cfg,documentId:manifest.documentId},corpus,states});
 assert.equal(again.text,out.text,'linked export idempotent in '+language);
 const broken={...states,chapters:states.chapters.map(c=>c.chapter===137?{...c,phoneticApproved:false}:c)};
 assert.throws(()=>linked.compose({body:src,language,spec:cfg,corpus,states:broken}),/no tiene las dos aprobaciones FINAL/);
 assert.throws(()=>linked.compose({body:src.replace(cfg.references[0].start,'FALTANTE'),language,spec:cfg,corpus,states}),/No se encontró/);
}
// A browser may retain a complete OLD Tehilim draft. The displayed FINAL verses
// are always projected from the canonical corpus while edits to 140 non-FINAL
// chapters remain byte-for-byte untouched. No implicit localStorage overwrite.
for (const language of ['hebrew','phonetic']){
 const file='masters/tehilim/TEHILIM_001-150_'+(language==='hebrew'?'HEBREO':'FONETICA')+'_EN_REVISION.txt';
 const source=read(file);
 const clean=linked.overlayFinalVerses({body:source,language,corpus,states});
 assert.equal(clean.text,source,'current GitHub matrix text must be canonical for FINAL '+language);
 assert.equal(clean.changedVerses,0,'no changes on an already-current projection');
 assert.deepEqual(clean.finalChapters,finals,'project only approved chapters');
 const canonical137=corpus.items[136].verses[0][language];
 const old137=language==='phonetic'?canonical137.replace('Bavél','Bável'):canonical137.replace('בָּבֶל,','בָּבֶל');
 assert.notEqual(old137,canonical137);
 const stale=source.replace('137:1  '+canonical137,'137:1  '+old137)
   .replace('8:1  ','8:1  EDICIÓN LOCAL ');
 const projection=linked.overlayFinalVerses({body:stale,language,corpus,states});
 assert.equal(projection.changedVerses,1,'stale 137 must be repaired from canonical');
 assert.equal(projection.text,source.replace('8:1  ','8:1  EDICIÓN LOCAL '),'non-FINAL local changes must survive');
 assert.ok(projection.text.includes('137:1  '+canonical137));
 assert.throws(()=>linked.overlayFinalVerses({body:stale.replace('137:8  ','XXX:8  '),language,corpus,states}),/incompleto/,'never silently export incomplete FINAL chapters');
}
// Deliberately out-of-date Birkat copies are still corrected via references;
// headings and local material outside the Psalm slots remain unchanged.
{
 const src=read(manifest.languages.phonetic.source);
 const stale=src.replaceAll('Bavél','Bável');
 const live=linked.compose({body:stale,language:'phonetic',spec:manifest.languages.phonetic,corpus,states});
 assert.ok(!live.text.includes('Bável'));
 assert.ok(live.text.includes('En días que se dice tajanún:'));
 assert.ok(live.text.includes('En Janucá y Purim se agrega:'));
 assert.ok(live.references.some(r=>r.replacedCopyWasDifferent),'stale historical copy flagged');
}
const fourteen=corpus.items.find(c=>c.chapter===14).verses[2];
assert.ok(fourteen.hebrew.includes('עֹֽשֵׂה'),'14:3 user-confirmed meteg on ayin');
assert.ok(fourteen.phonetic.includes("en 'ose tov"),'14:3 mil\u2019el corresponds to 14:1; no redundant accent');
assert.ok(!fourteen.phonetic.includes("'osé"),'legacy wrong final stress must not return');

assert.equal(fourteen.hebrew,'הַכֹּל סָר, יַחְדָּו נֶאֱלָֽחוּ; אֵין עֹֽשֵׂה טוֹב, אֵין גַּם אֶחָד.','14:3 ArtScroll punctuation exactly');
assert.equal(fourteen.phonetic,"Hakol sar, yajdav neelaju; en 'ose tov, en gam ejad.",'14:3 phonetic commas and semicolon parallel Hebrew');
for(const [filename,body] of [
 ['TEHILIM_001-150_HEBREO_EN_REVISION.txt',fourteen.hebrew],
 ['TEHILIM_001-150_FONETICA_EN_REVISION.txt',fourteen.phonetic],
 ['TEHILIM_001-150_HEBREO_continuous.txt',fourteen.hebrew],
 ['TEHILIM_001-150_FONETICA_continuous.txt',fourteen.phonetic],
 ['TEHILIM_001-150_HEBREO_numbered.txt',fourteen.hebrew],
 ['TEHILIM_001-150_FONETICA_numbered.txt',fourteen.phonetic]
]) {
 assert.ok(read('masters/tehilim/'+filename).includes(body),'14:3 not exported in '+filename);
}

// Psalm 14 screenshot-close: ArtScroll punctuation on all seven verses, both languages.
const punc=s=>[...s].filter(ch=>',.;:!?'.includes(ch)).join('');
const chapter14=corpus.items.find(c=>c.chapter===14).verses;
assert.equal(chapter14.length,7);
const marks=[';,,.',' ,.'.replace(' ',''),',;,.',';,.',',.',',.',';,.'];
for(let i=0;i<chapter14.length;i++){
 const v=chapter14[i];
 assert.equal(punc(v.hebrew),punc(v.phonetic),'Psalm 14 punctuation mismatch verse '+v.verse);
 assert.equal(punc(v.hebrew),marks[i],'Psalm 14 ArtScroll screenshot punctuation '+v.verse);
 for(const lang of ['HEBREO','FONETICA']){
  const name=lang==='HEBREO'?'hebrew':'phonetic';
  const text=v[name];
  for(const mode of ['continuous','numbered'])
   assert.ok(read('masters/tehilim/TEHILIM_014_'+lang+'_FINAL_'+mode+'.txt').includes(text));
 }
}
assert.equal(chapter14.reduce((n,v)=>n+(v.hebrew.match(/ֽ/g)||[]).length,0),14,'meteg evidence ArtScroll 14');

// Ensure every protected FINAL has its four published production exports.
for(const chapter of finals){
 const n=String(chapter).padStart(3,'0');
 for(const lang of ['HEBREO','FONETICA'])
  for(const mode of ['continuous','numbered']){
   const f=path.join(root,'masters/tehilim',`TEHILIM_${n}_${lang}_FINAL_${mode}.txt`);
   assert.ok(fs.existsSync(f),'missing production artifact: '+path.basename(f));
  }
}
console.log('PASS canonical links: Birkat 137/126 + contexts, Bavél, punctuation, 14:3, fail-closed approvals, 40 protected FINAL exports');

// Snapshot for editorial review must be byte-identical to canonical composition.
const workingHebrew=linked.compose({body:read(manifest.languages.hebrew.source),language:'hebrew',spec:{...manifest.languages.hebrew,documentId:manifest.documentId},corpus,states}).text;
assert.equal(read('masters/bircat-hamazon/ASHKENAZ_HEBREO_VINCULADO_EN_REVISION.txt'),workingHebrew,'linked Hebrew working copy must never drift from Tehilim FINAL');
assert.equal(workingHebrew.split('ברכת המזון · נוסח אשכנז').length-1,1,'duplicate title removed only from linked review copy');
assert.ok(workingHebrew.includes('זימון לשבע ברכות'),'additional liturgical material preserved for separate ArtScroll review');
