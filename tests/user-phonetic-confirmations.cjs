'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('index.html','utf8');
const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes('/* JD seed Birkat Hamazon golden masters */'))[1];
const record=JSON.parse(fs.readFileSync('masters/bircat-hamazon/PHONETIC_CONFIRMATIONS_20261011.json'));
const key='Birkat Hamazón||Ashkenazí||Fonética';
function boot(cells){let saved=JSON.stringify(cells);vm.runInNewContext(script,{localStorage:{getItem(){return saved},setItem(k,v){saved=v}}});return JSON.parse(saved);}
const current=fs.readFileSync('masters/bircat-hamazon/ASHKENAZ_FONETICA_EN_REVISION.txt','utf8');
for(const [old,newLine]of record.masterPatches){
 assert.ok(current.includes(newLine));assert.ok(!current.includes(old));
 const oldCopy=boot({[key]:{body:old,status:'Revisión fina'}});assert.equal(oldCopy[key].body,newLine);
 const custom=old+' EDICIÓN LOCAL';assert.equal(boot({[key]:{body:custom}})[key].body,custom,'Preserve modified paragraphs');
 assert.equal(boot(oldCopy)[key].body,newLine,'Migration is idempotent');
}
const fresh=boot({})[key].body;assert.match(fresh,/Ná'ar hayíti/);assert.match(fresh,/miná'ar ve'ad zakén/);
assert.match(current,/lidvir beteja,/);assert.match(current,/David 'avdeja,/);
const corpus=JSON.parse(fs.readFileSync('masters/tehilim/tehilim.json'));const v=corpus.items[36].verses[24];assert.match(v.phonetic,/^Ná'ar hayíti/);
for(const f of ['TEHILIM_001-150_FONETICA_EN_REVISION.txt','TEHILIM_001-150_FONETICA_numbered.txt','TEHILIM_001-150_FONETICA_continuous.txt'])assert.ok(fs.readFileSync('masters/tehilim/'+f,'utf8').includes(v.phonetic),f);
assert.equal(record.approvedGlobally,false,'No global FINAL promotion');
console.log('PASS source confirmations, corpus exports, new-user seed, exact-paragraph migration and custom-copy preservation');
