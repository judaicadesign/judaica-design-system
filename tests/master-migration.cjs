const fs=require('node:fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const html=fs.readFileSync('index.html','utf8');const source=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(x=>x.includes('/* JD seed Birkat Hamazon'));
const key='Birkat Hamazón||Ashkenazí||Hebreo';const previous=JSON.parse(source.match(/const previousAshkenaz=(.*);/)[1]);
for(const custom of [false,true]){const d=new JSDOM('',{url:'https://test.example/',runScripts:'outside-only'}),w=d.window;
w.localStorage.setItem('jd_master_cells',JSON.stringify({[key]:{body:custom?previous+'\nMI CAMBIO':previous,status:'Aprobado',ref:'ArtScroll impreso'}}));w.eval(source);
const cell=JSON.parse(w.localStorage.getItem('jd_master_cells'))[key];if(custom)assert.equal(cell.body,previous+'\nMI CAMBIO');else{assert.equal((cell.body.match(/ֽ/g)||[]).length,242);assert.equal(cell.status,'Revisión fina');}d.window.close();}
const document=new JSDOM(html).window.document;assert.equal(document.querySelectorAll('#nav>.jd-nav-group').length,5);
for(const group of document.querySelectorAll('.jd-nav-group')){assert.ok(group.querySelector('.sep'));assert.equal(group.querySelectorAll('button').length,2);}
console.log('PASS: legacy Ashkenaz migration adds 242 meteg; customized text preserved; five navigation groups');
