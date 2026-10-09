const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const d=path.resolve(__dirname,'../masters/tehilim'),all=JSON.parse(fs.readFileSync(path.join(d,'tehilim.json'),'utf8')),
rev=JSON.parse(fs.readFileSync(path.join(d,'ARTSCROLL_002_REVISION.json'),'utf8'));
const a=all.items[0].verses,v=all.items[1].verses;
assert.equal(rev.approved,true);assert.equal(v.length,12);assert.equal(v.reduce((n,x)=>n+(x.hebrew.match(/\u05bd/g)||[]).length,0),21);
for(const x of v){const r=rev.verses[x.verse-1];assert.equal(x.hebrew,r.hebrew);assert.equal(x.phonetic,r.phonetic);assert.ok(!/יהוה/.test(x.hebrew));}
for(const x of a)assert.ok(!/יהוה/.test(x.hebrew));
assert.match(v[1].phonetic,/yitiatsevú.*nósedu/);assert.match(v[2].phonetic,/moserotémo/);assert.match(v[9].phonetic,/hivaserú shófete/);assert.match(v[10].hebrew,/וְגִֽילוּ/);
assert.ok(!/אַפּֽוֹ/.test(v[11].hebrew));
console.log('PASS: Tehilim 2 approved, 21 meteg, final Hebrew/phonetic alignment and no Salmo 1 regression');
