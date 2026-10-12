const assert=require('node:assert/strict'),fs=require('node:fs'),E=require('../assets/jd-tehilim-export.js'),{JSDOM}=require('jsdom');
for(const [lang,name]of [['hebrew','HEBREO'],['phonetic','FONETICA']]){const text=fs.readFileSync('masters/tehilim/TEHILIM_001-150_'+name+'_EN_REVISION.txt','utf8');const rows=E.parse(text);assert.equal(rows.size,150);
const continuous=E.format(text,lang,'continuous').text;assert.equal((continuous.match(/^TEHILIM /gm)||[]).length,150);assert.doesNotMatch(continuous,/^\d+:\d+ /m);assert.ok(continuous.includes(rows.get(23).map(x=>x.text).join(' ')));
const numbered=E.format(text,lang,'numbered').text;assert.equal(numbered.split('\n').length,continuous.split('\n').length,'book output has one paragraph per chapter');assert.doesNotMatch(numbered,/^\d+:\d+ /m);assert.ok(numbered.includes('א\u00a0'+rows.get(23)[0].text+' ב\u00a0'+rows.get(23)[1].text));
const document=new JSDOM(E.format(text,lang,'numbered-html').text).window.document;assert.equal(document.querySelectorAll('.jd-pasuk').length,2527);assert.equal(document.querySelectorAll('section > p').length,150);assert.equal(document.querySelectorAll('section > p br').length,0);
assert.throws(()=>E.format(text.replace(/^23:1  .*$/m,''),lang,'continuous'));
}
const data=JSON.parse(fs.readFileSync('masters/tehilim/tehilim.json'));assert.equal(data.items[125].verses.reduce((n,v)=>n+(v.hebrew.match(/ֽ/g)||[]).length,0),11);assert.equal(data.items[136].verses.reduce((n,v)=>n+(v.hebrew.match(/ֽ/g)||[]).length,0),19);assert.doesNotMatch(data.items[125].verses[3].hebrew,/שבותנו/);assert.doesNotMatch(data.items[125].verses[3].phonetic,/shvvtnv/);
console.log('PASS continuous exports, 2527 styled inline Hebrew verse markers, 150 chapter paragraphs, 126/137 meteg and qere-only reading');
