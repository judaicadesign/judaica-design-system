import assert from 'node:assert/strict';import fs from 'node:fs';import {quotePrintRequest} from '../supabase/functions/_shared/b612-general.mjs';
const api=JSON.parse(fs.readFileSync(new URL('./fixtures/b612-folded-postals-20261016.json',import.meta.url)));
const get=async p=>{assert.ok(Object.hasOwn(api,p),'Missing supplier capture '+p);return structuredClone(api[p]);};
const r={description:'Postales con doblez',quantities:[50,75,100,150],folds:3,widthMm:391,heightMm:190,sizeScope:'abierto',paper:'Papel ilustración',weightGsm:300,print:'Full color',sides:'Doble faz',lamination:'Laminado mate',laminationSides:'Doble faz',bindingOptions:[],models:1};
const actual=await quotePrintRequest(r,get);assert.equal(actual.complete,true);assert.deepEqual(actual.alternatives.map(a=>a.net),[136829.81,186453.06,222575.31,320373.81],'All four PDF 1322415 alternatives match current public supplier operations');
for(const a of actual.alternatives){assert.equal(a.family,'quad');assert.equal(a.lines.filter(l=>l.code==='DOBX3').length,1);assert.equal(a.lines.find(l=>l.code==='DOBX3').quantity,a.qty);assert.equal(a.lines.filter(l=>l.code==='D1').length,1);assert.equal(a.lines.filter(l=>l.code==='C2').length,1);}
const named=await quotePrintRequest({...r,description:'Cuadríptico'},get);assert.deepEqual(named.alternatives.map(a=>a.net),actual.alternatives.map(a=>a.net));
const tri={...r,description:'Tríptico',quantities:[200],folds:2,heightMm:210,paper:'Papel obra',weightGsm:120,print:'Blanco y negro',lamination:'',laminationSides:''};
for(const widthMm of [390,391]){const t=await quotePrintRequest({...tri,widthMm},get);assert.equal(t.alternatives[0].net,82636);assert.equal(Math.round((83094.46-t.alternatives[0].net)*100)/100,458.46,'Mail reference is not replaced by an unexplained calibration');}
await assert.rejects(()=>quotePrintRequest({...r,folds:7},get),/dobleces/);
console.log('PASS all four folded-postcard/cuartiptico PDF totals, exact fold/setup operations, and explicit unchanged 390/391mm triptych reference difference. Supplier captured 2026-10-16.');
