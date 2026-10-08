const assert=require('node:assert/strict'),fs=require('node:fs'),E=require('../assets/jd-tehilim-export.js'),{JSDOM}=require('jsdom');
for(const [lang,name]of [['hebrew','HEBREO'],['phonetic','FONETICA']]){const text=fs.readFileSync('masters/tehilim/TEHILIM_001-150_'+name+'_EN_REVISION.txt','utf8');const rows=E.parse(text);assert.equal(rows.size,150);
const continuous=E.format(text,lang,'continuous').text;assert.equal((continuous.match(/^TEHILIM /gm)||[]).length,150);assert.doesNotMatch(continuous,/^\d+:\d+ /m);assert.ok(continuous.includes(rows.get(23).map(x=>x.text).join(' ')));
const numbered=E.format(text,lang,'numbered').text;const marker=lang==='hebrew'?/^[א-ת]+\t/gm:/^\d+\t/gm;assert.equal((numbered.match(marker)||[]).length,2527);assert.doesNotMatch(numbered,/^\d+:\d+ /m);assert.match(numbered,lang==='hebrew'?/^א\t/m:/^1\t/m);assert.ok(numbered.includes(rows.get(23)[0].text));
assert.throws(()=>E.format(text.replace(/^23:1  .*$/m,''),lang,'continuous'));
}
const data=JSON.parse(fs.readFileSync('masters/tehilim/tehilim.json'));assert.equal(data.items[125].verses.reduce((n,v)=>n+(v.hebrew.match(/ֽ/g)||[]).length,0),11);assert.equal(data.items[136].verses.reduce((n,v)=>n+(v.hebrew.match(/ֽ/g)||[]).length,0),19);assert.doesNotMatch(data.items[125].verses[3].hebrew,/שבותנו/);assert.doesNotMatch(data.items[125].verses[3].phonetic,/shvvtnv/);
console.log('PASS continuous exports, 2527 isolated Hebrew/numeric labels, tab-separated TXT markers for InDesign, 126/137 meteg and qere-only reading');
