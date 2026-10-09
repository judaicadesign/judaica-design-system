import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

// Expected texts were fixed by visual review BEFORE running the generator.
const root=path.resolve(import.meta.dirname,'..');
const expected=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/artscroll-final-001.json'),'utf8'));
const dir=path.join(root,'masters/tehilim');
const master=JSON.parse(fs.readFileSync(path.join(dir,'tehilim.json'),'utf8')).items[0];
const review=JSON.parse(fs.readFileSync(path.join(dir,'ARTSCROLL_001_REVISION.json'),'utf8'));
const engineFile=process.argv[2];
assert.ok(engineFile,'Supply the independently retrieved generator index.html');
const html=fs.readFileSync(engineFile,'utf8');
const sources=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(s=>s.includes('function phonetize('));
assert.equal(sources.length,1);
const stub=`const document={getElementById(){return {value:'rabbinic',addEventListener(){},focus(){},select(){}}},createElement(){return {appendChild(){},addEventListener(){},replaceChildren(){}}}};const window={addEventListener(){}};const navigator={clipboard:{}};const requestAnimationFrame=f=>f();`;
const api=vm.runInNewContext(stub+sources[0]+';({phonetize});',{}, {timeout:20000});
assert.equal(master.approved,true);
assert.equal(master.hebrewApproved,true);
assert.equal(master.phoneticApproved,true);
assert.equal(review.source.sourceSha256,crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'sources/ARTSCROLL_001.png'))).digest('hex'));
assert.equal(expected.reduce((n,v)=>n+(v.hebrew.match(/ֽ/g)||[]).length,0),10);
assert.equal(review.vocalSheva.length,2);
const cases=[];
for(const [i,v] of expected.entries()){
 assert.equal(master.verses[i].hebrew,v.hebrew,v.ref+' Hebrew');
 assert.equal(master.verses[i].phonetic,v.phonetic,v.ref+' master');
 for(const input of [v.hebrew,v.hebrew.normalize('NFD')])assert.equal(api.phonetize(input),v.phonetic,v.ref+' generator');
 cases.push({ref:v.ref,hebrew:v.hebrew,master:v.phonetic,generator:api.phonetize(v.hebrew),matches:true});
}
const continuousHebrew=expected.map(v=>v.hebrew).join(' ');
const continuousPhonetic=expected.map(v=>v.phonetic).join(' ');
assert.equal(api.phonetize(continuousHebrew),continuousPhonetic,'Whole chapter');
for(const [lang,tag] of [['hebrew','HEBREO'],['phonetic','FONETICA']]){
 const corpus=fs.readFileSync(path.join(dir,`TEHILIM_001-150_${tag}_EN_REVISION.txt`),'utf8');
 for(const v of expected)assert.ok(corpus.includes(v.ref+'  '+v[lang]+'\n'),v.ref+' canonical TXT');
 for(const mode of ['continuous','numbered']){
  const finalText=fs.readFileSync(path.join(dir,`TEHILIM_001_${tag}_FINAL_${mode}.txt`),'utf8').trimEnd();
  const wanted=mode==='continuous'?expected.map(v=>v[lang]).join(' '):expected.map((v,i)=>(lang==='hebrew'?master.verses[i].label:String(i+1))+'\t'+v[lang]).join('\n');
  assert.equal(finalText,wanted,tag+' '+mode);
 }
}
const result={date:'2026-10-09',chapter:1,approved:true,engineSha256:crypto.createHash('sha256').update(html).digest('hex'),cases,continuous:{matches:true}};
if(process.argv.includes('--write-audit'))fs.writeFileSync(path.join(dir,'AUDITORIA_FINAL_001.json'),JSON.stringify(result,null,2)+'\n');
console.log('PASS: Psalm 1 final; 6/6 verses, NFC/NFD, whole chapter, canonical TXT and four final exports');
