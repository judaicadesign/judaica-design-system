/* Comparador de fonética máster JD ↔ motor JD. No modifica masters.
   node scripts/compare-tehilim-generator.mjs ../fonetica-hebreo/index.html
   --all incluye borradores; --output /ruta/privada/reporte.json guarda detalle fuera de GitHub.
*/
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),args=process.argv.slice(2);
const enginePath=args[0],draft=args.includes('--all');
const outputIndex=args.indexOf('--output'),dest=outputIndex>=0?args[outputIndex+1]:null;
if(!enginePath||(outputIndex>=0&&!dest))throw Error('Indicá el index.html del motor y, opcionalmente, --output /ruta/privada/reporte.json');
const html=fs.readFileSync(enginePath,'utf8');
const source=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(x=>x[1]).find(x=>x.includes('function phonetize('));
if(!source)throw Error('Motor fonético no localizado');
const stub="const document={getElementById(){return {value:'rabbinic',addEventListener(){},focus(){},select(){}}},createElement(){return {appendChild(){},addEventListener(){},replaceChildren(){}}}};const window={addEventListener(){}};const navigator={clipboard:{}};const requestAnimationFrame=f=>f();";
const phonetize=vm.runInNewContext(stub+source+';({phonetize});',{}, {timeout:20000}).phonetize;
const chapters=JSON.parse(fs.readFileSync(path.join(root,'masters/tehilim/tehilim.json'),'utf8')).items;
const record=JSON.parse(fs.readFileSync(path.join(root,'masters/tehilim/REVISION_ESTADO.json'),'utf8'));
const approved=new Set(record.chapters.filter(x=>x.approved&&x.phoneticApproved).map(x=>x.chapter));
let checked=0,finals=0;
const mismatches=[];
for(const ch of chapters){
 if(!approved.has(ch.chapter)&&!draft)continue;
 for(const v of ch.verses){
  checked++;if(approved.has(ch.chapter))finals++;
  const actual=phonetize(v.hebrew),expected=v.phonetic;
  if(actual===expected)continue;
  const x=expected.split(/\s+/),y=actual.split(/\s+/);
  const wi=Array.from({length:Math.max(x.length,y.length)},(_,i)=>i).find(i=>x[i]!==y[i]);
  mismatches.push({salmo:ch.chapter,pasuk:v.verse,final:approved.has(ch.chapter),hebreo:v.hebrew,master:expected,motor:actual,palabra:wi===undefined?null:{numero:wi+1,esperado:x[wi]||'',obtenido:y[wi]||''},resuelto:false,causa:'pendiente'});
 }
}
console.log('Versículos '+checked+' | finales '+finals+' | diferencias '+mismatches.length);
if(dest){
 const absolute=path.resolve(dest),rel=path.relative(root,absolute);
 if(!rel.startsWith('..')&&!path.isAbsolute(rel))throw Error('Por privacidad guardá el reporte fuera del repositorio público');
 fs.mkdirSync(path.dirname(absolute),{recursive:true});
 fs.writeFileSync(absolute,JSON.stringify({motorSha256:crypto.createHash('sha256').update(html).digest('hex'),fecha:new Date().toISOString(),mismatches},null,2)+'\n',{mode:0o600});
}
if(mismatches.some(x=>x.final))process.exitCode=2;
