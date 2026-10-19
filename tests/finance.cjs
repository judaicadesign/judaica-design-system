const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
(async()=>{
 const dom=new JSDOM('<!doctype html><html><body><section class="screen active" id="finance"></section></body></html>',{runScripts:'outside-only',url:'https://judaicadesign.github.io/judaica-design-system/'});
 const w=dom.window;
 w.go=()=>{};
 if(!w.crypto.randomUUID)w.crypto.randomUUID=()=>String(Date.now()+Math.random()).replace('.','-');
 w.JDWorkflow={jobs:()=>[{id:'j-max',title:'Birkón Max Alperovich',clientId:'c-max'}]};
 w.localStorage.setItem('jd_clients',JSON.stringify([{id:'c-max',name:'Max Alperovich'}]));
 w.localStorage.setItem('jd_finance_legacy_v1',JSON.stringify([
  {id:'legacy-max',date:'2026-06-23',label:'JD - Birkon - Max Alperovich',revenue:1263000,cost:741948,currency:'ARS',classification:'Birkonim',source:{sheet:'Ingresos',row:372}},
  {id:'legacy-ian',date:'2026-06-16',label:'JD - Birkon - Ian Bruck',revenue:1058400,cost:1053233,currency:'ARS',classification:'Birkonim',source:{sheet:'Ingresos',row:376}},
  {id:'legacy-adobe',date:'2026-06-14',label:'Adobe suscripcion',revenue:0,cost:59000,currency:'ARS',classification:'Software y suscripciones',source:{sheet:'Ingresos',row:370}}
 ]));
 w.jdUpdateSharedState=async(keys,fn)=>{
  const current=Object.fromEntries(keys.map(k=>[k,JSON.parse(w.localStorage.getItem(k)||'[]')]));
  const update=fn(current);
  for(const [key,value] of Object.entries(update))w.localStorage.setItem(key,JSON.stringify(value));
 };
 w.eval(fs.readFileSync('assets/jd-finance.js','utf8'));
 w.JDFinance.render();
 assert.match(w.document.getElementById('finance').textContent,/Caja y Finanzas/);
 assert.match(w.document.getElementById('finance').textContent,/2.321.400/);
 assert.match(w.document.getElementById('finance').textContent,/No equivale a cobrado/);
 const breakButton=w.document.querySelector('[data-breakdown="legacy-max"]');
 assert.ok(breakButton,'el costo histórico debe poder abrirse');
 breakButton.click();
 const input=w.document.getElementById('jdBreakAmount');input.value='1500';
 w.document.getElementById('jdBreakCategory').value='Uber / mensajería';
 w.document.querySelector('[data-add]').click();
 await new Promise(r=>setTimeout(r,40));
 const alloc=JSON.parse(w.localStorage.getItem('jd_finance_allocations_v1'));
 assert.equal(alloc[0].items[0].amount,1500);
 assert.equal(JSON.parse(w.localStorage.getItem('jd_finance_legacy_v1'))[0].cost,741948,'desglosar no duplica costo');
 assert.match(w.document.body.textContent,/740.448/,'saldo sin desglosar');
 w.document.querySelector('.jd-fin-modal [data-close]').click();
 w.document.getElementById('jdFinAdd').click();
 w.document.getElementById('finAmount').value='3000';
 w.document.getElementById('finDetail').value='Uber retiro de imprenta';
 w.document.getElementById('finJob').value='j-max';
 w.document.getElementById('finCategory').value='Uber / mensajería';
 w.document.querySelector('.jd-fin-modal [data-save]').click();
 await new Promise(r=>setTimeout(r,40));
 let saved=JSON.parse(w.localStorage.getItem('jd_finance_moves_v1'));
 assert.equal(saved.length,1);
 assert.equal(saved[0].amount,3000);
 assert.equal(saved[0].jobId,'j-max');
 assert.equal(saved[0].category,'Uber / mensajería');
 assert.equal(JSON.parse(w.localStorage.getItem('jd_finance_legacy_v1'))[0].cost,741948);
 w.JDFinance.openForJob('j-max');
 assert.match(w.document.getElementById('jdFinBody').textContent,/Rentabilidad por trabajo/);
 assert.match(w.document.getElementById('jdFinBody').textContent,/3.000/);
 console.log('PASS: caja, resumen separado, desglose histórico no duplicado y costo por proyecto');
})().catch(e=>{console.error(e);process.exit(1)});