import fs from 'node:fs';import vm from 'node:vm';import crypto from 'node:crypto';import path from 'node:path';
const file=process.argv[2];if(!file)throw Error('Pass canonical generator index.html');
const html=fs.readFileSync(file,'utf8'),source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(x=>x.includes('function phonetize('));
const stub=`const document={getElementById(){return {value:'rabbinic',addEventListener(){},focus(){},select(){}}},createElement(){return {appendChild(){},addEventListener(){},replaceChildren(){}}}};const window={addEventListener(){}};const navigator={clipboard:{}};const requestAnimationFrame=f=>f();`;
const api=vm.runInNewContext(stub+source+';({phonetize});',{}, {timeout:20000});
const dir=path.resolve(import.meta.dirname,'../masters/tehilim'),data=JSON.parse(fs.readFileSync(path.join(dir,'tehilim.json'),'utf8'));
const cases=[];for(const n of [23,126,137])for(const verse of data.items[n-1].verses){const actual=api.phonetize(verse.hebrew);cases.push({chapter:n,verse:verse.verse,hebrew:verse.hebrew,master:verse.phonetic,generator:actual,matches:actual===verse.phonetic});}
fs.writeFileSync(path.join(dir,'AUDITORIA_MOTOR_REVISADOS.json'),JSON.stringify({date:'2026-10-08',engineSha256:crypto.createHash('sha256').update(html).digest('hex'),status:'Open differences, not engine approval',cases},null,2)+'\n');console.log(JSON.stringify({cases:cases.length,matches:cases.filter(x=>x.matches).length,differences:cases.filter(x=>!x.matches).map(x=>({ref:x.chapter+':'+x.verse,master:x.master,generator:x.generator}))},null,2));
