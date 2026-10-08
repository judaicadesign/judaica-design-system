import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import os from 'node:os';
import {JSDOM} from 'jsdom';
const root=path.resolve(import.meta.dirname,'..');
const cache=process.env.TEHILIM_CACHE||path.join(os.tmpdir(),'jd-wikisource-tehilim');fs.mkdirSync(cache,{recursive:true});
const enginePath=process.argv[2];if(!enginePath)throw Error('Supply canonical generator index.html');
const html=fs.readFileSync(enginePath,'utf8');
const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).find(s=>s.includes('function phonetize('));
const stub=`const document={getElementById(){return {value:'rabbinic',addEventListener(){},focus(){},select(){}}},createElement(){return {appendChild(){},addEventListener(){},replaceChildren(){}}}};const window={addEventListener(){}};const navigator={clipboard:{}};const requestAnimationFrame=f=>f();`;
const api=vm.runInNewContext(stub+source+';({phonetize});',{}, {timeout:20000});
function hebnum(n){let s='';if(n>=100){s+='ק';n-=100}const tens=['','י','כ','ל','מ','נ','ס','ע','פ','צ'];if(n===15)return s+'טו';if(n===16)return s+'טז';s+=tens[Math.floor(n/10)];return s+['','א','ב','ג','ד','ה','ו','ז','ח','ט'][n%10]}
const chapters=Array(150);let done=0;
async function load(n){
 const name=hebnum(n),url='https://he.wikisource.org/wiki/'+encodeURIComponent('תהלים_'+name+'/ניקוד'),file=path.join(cache,n+'.html');
 let raw;if(fs.existsSync(file))raw=fs.readFileSync(file,'utf8');else{await new Promise(r=>setTimeout(r,1200));const r=await fetch(url,{signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(url+' HTTP '+r.status);raw=await r.text();fs.writeFileSync(file,raw)}
 const doc=new JSDOM(raw).window.document;
 const section=doc.querySelector('.mw-parser-output > section[data-mw-section-id="0"]');if(!section)throw Error(n+': chapter section missing');
 const links=[...section.querySelectorAll('link[typeof="mw:Extension/קטע"]')];let active=null,verses=[];
 for(const link of links){const a=JSON.parse(link.getAttribute('data-mw')).attrs;
  if(a['התחלה'] && /^[א-ת]+$/.test(a['התחלה']) && a['התחלה']!=='סימן' && a['התחלה']!=='פרק'){
   if(a['התחלה']!==hebnum(verses.length+1))throw Error(n+': verse order '+a['התחלה']);
   let text='',node=link.nextSibling;while(node){if(node.nodeType===1&&node.matches('link[typeof="mw:Extension/קטע"]')){const b=JSON.parse(node.getAttribute('data-mw')).attrs;if(b['סוף']===a['התחלה'])break}text+=node.textContent||'';node=node.nextSibling}
   text=text.replace(/[\u200e\u200f]/g,'').replace(/\s+/g,' ').trim();if(!text||!/[\u05b0-\u05bc\u05c7]/.test(text))throw Error(n+': missing vocalized verse '+a['התחלה']);verses.push({verse:verses.length+1,label:a['התחלה'],hebrew:text,phonetic:api.phonetize(text)});
  }
 }
 if(!verses.length)throw Error(n+': no verses');
 chapters[n-1]={chapter:n,hebrewNumber:name,url,sha256:crypto.createHash('sha256').update(raw).digest('hex'),verses};done++;if(done%10===0)console.log('Fetched '+done+'/150');
}
let next=1;await Promise.all(Array.from({length:1},async()=>{while(next<=150)await load(next++)}));
// Reapply versioned visual reviews after extraction.
const review=JSON.parse(fs.readFileSync(path.join(root,'masters/tehilim/ARTSCROLL_023_REVISION.json'),'utf8'));
for(const patch of review.verses){const verse=chapters[22].verses[patch.verse-1];
 if(verse.hebrew!==patch.previousHebrew)throw Error('Wikisource 23:'+patch.verse+' changed; review patch before rebuilding');
 verse.hebrew=patch.hebrew;verse.phonetic=patch.phonetic;
}
chapters[22].artscrollReview=review.source;
const count=chapters.reduce((a,c)=>a+c.verses.length,0);if(count!==2527)throw Error('Verse count '+count+' != 2527');
const header='Judaica Design® · Tehilim 1–150\nEN REVISIÓN · No aprobado para producción\nHebreo: Wikisource, edición con nikud. Fonética: generador JD con decisiones editoriales disponibles.\nRevisión visual de ArtScroll y acentos: en curso.\n\n';
for(const [lang,file] of [['hebrew','TEHILIM_001-150_HEBREO_EN_REVISION.txt'],['phonetic','TEHILIM_001-150_FONETICA_EN_REVISION.txt']]){
 const text=header+chapters.map(c=>'TEHILIM '+c.chapter+' · '+c.hebrewNumber+'\n'+c.verses.map(v=>c.chapter+':'+v.verse+'  '+v[lang]).join('\n')).join('\n\n')+'\n';fs.writeFileSync(path.join(root,'masters/tehilim',file),text);
}
const data={version:'2026-10-07',status:'Revisión fina',source:'Wikisource / ניקוד',chapters:150,verses:count,engineSha256:crypto.createHash('sha256').update(html).digest('hex'),items:chapters};
fs.writeFileSync(path.join(root,'masters/tehilim/tehilim.json'),JSON.stringify(data));console.log('PASS: 150 chapters, '+count+' aligned Hebrew/phonetics verses');
