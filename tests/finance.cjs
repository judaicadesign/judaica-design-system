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
 w.document.getElementById('jdBreakDate').value='2026-06-19';
 w.document.getElementById('jdBreakVerification').value='Comprobante verificado';
 w.document.querySelector('[data-add]').click();
 await new Promise(r=>setTimeout(r,40));
 const alloc=JSON.parse(w.localStorage.getItem('jd_finance_allocations_v1'));
 assert.equal(alloc[0].items[0].amount,1500);
 assert.equal(alloc[0].items[0].date,'2026-06-19');
 assert.equal(alloc[0].items[0].verification,'Comprobante verificado');
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
 assert.match(w.document.getElementById('jdFinBody').textContent,/(Rentabilidad por trabajo|Costos reales por proyecto)/);
 assert.match(w.document.getElementById('jdFinBody').textContent,/3.000/);
 // Historical project must be accessible without first creating a CRM job.
 const picker=w.document.getElementById("jdFinJobChoice");
 picker.value="legacy:legacy-ian";picker.dispatchEvent(new w.Event("change"));
 assert.match(w.document.getElementById("jdFinBody").textContent,/5.167/,"Ian: diferencia histórica parcial debe mantenerse");
 assert.match(w.document.getElementById("jdFinBody").textContent,/1.053.233/,"Ian: costo histórico permanece sin modificar");
 w.document.getElementById("jdFinJobAdd").click();
 assert.equal(w.document.getElementById("finLegacyCase").value,"legacy-ian","Ingreso/gasto se vincula al trabajo histórico seleccionado");
 w.document.getElementById("finKind").value="Egreso";
 w.document.getElementById("finCategory").value="Reimpresión / reparación";
 w.document.getElementById("finAmount").value="7000";
 w.document.getElementById("finDetail").value="Segundo gasto posterior verificado";
 await w.document.querySelector(".jd-fin-modal [data-save]").onclick();
 await new Promise(r=>setTimeout(r,40));
 saved=JSON.parse(w.localStorage.getItem("jd_finance_moves_v1"));
 assert.equal(saved.at(-1).legacyId,"legacy-ian");
 assert.equal(saved.at(-1).amount,7000);
 assert.match(w.document.getElementById("jdFinBody").textContent,/Gastos adicionales registrados/);
 assert.equal(JSON.parse(w.localStorage.getItem("jd_finance_legacy_v1"))[1].cost,1053233,"Ningún gasto nuevo reescribe histórico");

 // Por trabajo: diferencia real registrada, margen sobre INGRESO y no el % «a dar» del Excel.
 const old=JSON.parse(w.localStorage.getItem("jd_finance_legacy_v1"));
 const max=w.JDFinance.jobReport(null,old.find(x=>x.id==="legacy-max"),"ARS");
 assert.equal(max.result,521052);
 assert.ok(Math.abs(max.margin-41.255)<0.02);
 const ian=w.JDFinance.jobReport(null,old.find(x=>x.id==="legacy-ian"),"ARS");
 assert.equal(ian.result,1058400-1053233-7000);
 assert.ok(ian.margin<0,"reimpresión no duplicada puede transformar resultado positivo en pérdida");
 // Meses completos: no dividir por los meses con ventas solamente.
 const monthly=w.JDFinance.periodStats([{date:"2025-01-17",revenue:120,cost:45},{date:"2025-03-10",revenue:240,cost:120}],"2025");
 assert.equal(monthly.fullCount,12);
 assert.equal(monthly.avgRevenue,30);
 assert.equal(monthly.peak.name,"Mar");
 // Categorías conocidas + residual desconocido, nunca adivinar costo de Uber.
 const breakdown=w.JDFinance.breakdownStats(old.filter(x=>x.currency==="ARS"),saved,alloc,"ARS");
 assert.ok(breakdown.unknown>0);
 assert.ok(breakdown.rows.some(r=>r.category==="Costos históricos sin desglosar"));
 // Sin costos reales: NO ofrecer ganancia ficticia igual al precio.
 w.localStorage.setItem("jd_orders_v1",JSON.stringify([{id:"or1",jobId:"j-max",quoteId:"q1",quantity:{price:228000,cost:116135}}]));
 const report=w.JDFinance.jobReport({id:"j-max",quoteIds:["q1"]},null,"ARS");
 assert.equal(report.baseRevenue,228000);
 assert.equal(report.estimatedCost,116135);
 assert.equal(report.result,225000,"si hay un costo real de 3.000, el costo estimado no debe duplicarse");
 const extraMoves=JSON.parse(w.localStorage.getItem('jd_finance_moves_v1'));extraMoves.push({id:'charge',jobId:'j-max',kind:'Egreso',status:'Realizado',amount:1000,currency:'ARS',notCash:true},{id:'payment',jobId:'j-max',kind:'Egreso',status:'Realizado',amount:1000,currency:'ARS',settlement:true});w.localStorage.setItem('jd_finance_moves_v1',JSON.stringify(extraMoves));assert.equal(w.JDFinance.jobReport({id:'j-max',quoteIds:['q1']},null,'ARS').actualCost,4000,'supplier payment never duplicates its charge');assert.ok(!w.JDFinance.summaryHtml({id:'j-max',quoteIds:['q1']},null,'ARS').includes('Maaser'),'maaser stays only in Sheets');
 console.log('PASS: caja, resumen separado, desglose histórico no duplicado y costo por proyecto');
})().catch(e=>{console.error(e);process.exit(1)});