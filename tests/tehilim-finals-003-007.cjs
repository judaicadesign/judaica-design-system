const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const dir = path.resolve(__dirname, '../masters/tehilim');
const read = file => fs.readFileSync(path.join(dir,file),'utf8');
const corpus = JSON.parse(read('tehilim.json'));
const states = JSON.parse(read('REVISION_ESTADO.json'));
const metegExpected = new Map([[1,10],[2,21],[3,14],[4,13],[5,22],[6,21],[7,19]]);

assert.equal(corpus.items.length,150);
assert.equal(corpus.items.reduce((n,c)=>n+c.verses.length,0),2527);
for (const [chapter,meteg] of metegExpected) {
 const c = corpus.items[chapter-1];
 const st = states.chapters.find(x=>x.chapter===chapter);
 assert.equal(c.chapter, chapter);
 for (const field of ['approved','hebrewApproved','phoneticApproved']) {
  assert.equal(c[field],true,chapter+': corpus '+field);
  assert.equal(st[field],true,chapter+': state '+field);
 }
 assert.equal((c.verses.map(x=>x.hebrew).join('').match(/\u05bd/g)||[]).length,meteg,chapter+': meteg');
 for (const v of c.verses) {
  assert.doesNotMatch(v.hebrew,/יהוה|יְהֹוָה|לַיהֹוָה/,chapter+': divine name '+v.verse);
  assert.ok(v.phonetic.length>0,chapter+': no phonetic '+v.verse);
 }
 if (chapter<3) continue;
 const review = JSON.parse(read('ARTSCROLL_'+String(chapter).padStart(3,'0')+'_REVISION.json'));
 assert.equal(review.approved,true,chapter+': review');
 assert.equal(review.verses.length,c.verses.length,chapter+': review count');
 for (const v of c.verses) {
  const approved = review.verses.find(x=>x.verse===v.verse);
  assert.ok(approved);
  assert.equal(v.hebrew,approved.hebrew,chapter+': Hebrew '+v.verse);
  assert.equal(v.phonetic,approved.phonetic,chapter+': phonetic '+v.verse);
 }
 for (const [lang,k] of [['HEBREO','hebrew'],['FONETICA','phonetic']]) {
  const stem='TEHILIM_'+String(chapter).padStart(3,'0')+'_'+lang+'_FINAL_';
  const continuous=c.verses.map(v=>v[k]).join(' ')+'\n';
  const numbered=c.verses.map(v=>v.verse+'\t'+v[k]).join('\n')+'\n';
  assert.equal(read(stem+'continuous.txt'),continuous,chapter+': continuous '+lang);
  assert.equal(read(stem+'numbered.txt'),numbered,chapter+': numbered '+lang);
 }
}
const c6=corpus.items[5].verses[6];
assert.match(c6.hebrew,/לַֽיְלָה/);
assert.match(c6.phonetic,/laila/); // diptongo con i (decisión 14/10)
for(const [ch,v,target] of [[3,2,'רַבּוּ'],[5,4,'וַאֲצַפֶּה'],[5,9,'לְפָנַי'],[7,5,'וָאֲחַלְּצָה'],[7,18,'וַאֲזַמְּרָה']]){
 const word=corpus.items[ch-1].verses[v-1].hebrew.split(/[\s,.]/).find(x=>x===target);
 assert.ok(word,'confirmed word missing '+ch+':'+v);
 assert.ok(!word.includes('\u05bd'),'unexpected meteg '+ch+':'+v);
}
assert.match(corpus.items[6].verses[0].phonetic,/diveré/);
assert.doesNotMatch(corpus.items[6].verses[0].phonetic,/divré/);
console.log('PASS Tehilim FINAL 1–7: 7 chapters, 78 pesukim, review/status/export agreement and confirmed meteg/shevá');
