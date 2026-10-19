import assert from 'node:assert/strict';
import fs from 'node:fs';
import intake from '../assets/jd-print-request.js';
import {quotePrintRequest} from '../supabase/functions/_shared/b612-general.mjs';
const fixture=JSON.parse(fs.readFileSync('tests/fixtures/b612-common-sheets-20261019.json'));
const request=intake.analyze('impresion A3\nsimple faz\nfull color\nilustracion 115 gramos\n5 copias');
assert.equal(request.totalPages,1);assert.deepEqual(request.bindingOptions,['Hojas sueltas']);assert.deepEqual(intake.questions(request),[]);
assert.deepEqual(intake.questions({...request,bindingOptions:['hojas sueltas']}),[]);
let calls=[];const get=async p=>{calls.push(p);assert.ok(Object.hasOwn(fixture,p),'Uncaptured supplier endpoint: '+p);return structuredClone(fixture[p]);};
for(const r of [request,{...request,widthMm:301,heightMm:447}]){
 calls=[];const result=await quotePrintRequest(r,get);assert.equal(result.complete,true);const a=result.alternatives[0];assert.equal(a.net,7267.2);assert.equal(a.vat,1526.11);assert.equal(a.sheetFormat,'SA3');assert.equal(a.lines.length,1);assert.equal(a.lines[0].quantity,5);assert.equal(a.lines[0].unitPrice,1453.44);assert.equal(a.lines[0].code,'60-FC115-SA3SF');assert.ok(!calls.some(p=>p.startsWith('/api/grilla/')));
}
const pdf=intake.analyze('PDF de 21 paginas\n5 copias A5\nobra 120gr\nblanco y negro\nsimple faz\nhojas sueltas');assert.equal(pdf.totalPages,21);assert.deepEqual(intake.questions(pdf),[]);assert.ok(!intake.cleanText(request,null,'Hojas sueltas',true).includes('Total 1 páginas'));
console.log('PASS common print: A3/SA3, five plain sheets, lowercase loose binding, no cover questions, live captured net $7267.20, real stock and no invented cut.');
