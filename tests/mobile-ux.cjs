const assert=require('node:assert/strict'),fs=require('node:fs');
const {boot,fixture}=require('./commercial-scenarios.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const rows=fixture();rows.push({key:'jd_jobs_v1',value:[{id:'wedding',clientId:'qa-client',title:'Boda familiar',event:'2020-12-31',eventType:'wedding',stage:'Entregado',quoteIds:[],history:[]}]});
 const a=await boot(rows),w=a.w,W=w.JDWorkflow,f=id=>w.document.getElementById(id),j=a.get('jd_jobs_v1')[0];
 assert.equal(f('qJob').closest('.field').hidden,true,'No meaningless one-option selector');
 f('qClient').value='Ána Prueba';w.JDClientDirectory.restore(f('qClient'),'qa-client','Ána Prueba');W.bindQuoteJob();assert.equal(f('qJob').closest('.field').hidden,false);assert.equal(f('qJob').options.length,2);
 f('qJob').value='wedding';W.bindQuoteJob();assert.equal(f('qJob').value,'wedding');f('qClient').value='Cliente nuevo';f('qClient').dispatchEvent(new w.Event('input'));assert.equal(f('qJob').closest('.field').hidden,true);assert.equal(f('qJob').value,'');
 W.openClient('qa-client');assert.match(w.document.querySelector('.jd-event-dates').textContent,/31\/12\/20/);w.document.querySelector('[data-event-job="wedding"]').click();f('jobEvent').value='2020-10-30';f('jobAnniversary').checked=false;f('jobQuality').value='2020-12-30';await w.document.querySelector('.jd-work-modal:last-of-type [data-save]').onclick();assert.equal(a.get('jd_jobs_v1')[0].event,'2020-10-30');assert.equal(a.get('jd_jobs_v1')[0].anniversaryReminder,false);assert.match(w.document.querySelector('.jd-event-dates').textContent,/30\/10\/20/);assert.match(w.document.querySelector('.jd-event-dates').textContent,/desactivado/);w.document.querySelector('.jd-work-modal [data-close]').click();
 const at=date=>Array.from(W.greetingActions(j,date));assert.equal(at('2026-12-23').length,0);assert.equal(at('2026-12-24')[0].key,'anniversary-2026');assert.equal(at('2026-12-31')[0].due,'2026-12-31');assert.equal(at('2027-01-07')[0].key,'anniversary-2026');assert.equal(at('2027-01-08').length,0);assert.equal(W.nextAnniversary(j,'2026-12-31'),'2026-12-31');assert.equal(W.nextAnniversary(j,'2027-01-01'),'2027-12-31');
 assert.equal(W.greetingActions({...j,greetings:{'anniversary-2026':'sent'}},'2026-12-31').length,0);assert.equal(W.greetingActions({...j,anniversaryReminder:false},'2026-12-31').length,0);assert.equal(W.nextAnniversary({...j,event:'2024-02-29'},'2027-01-01'),'2027-02-28');assert.equal(W.greetingActions({...j,event:'2026-10-15'},'2026-10-16')[0].key,'post-event');
 const css=fs.readFileSync('assets/jd-workflow.css','utf8');assert.match(css,/#jdWorkPriorities\{margin-bottom:24px\}/);assert.match(css,/#quotes #qDeluxeContentField label\.jd-checkline\{display:flex;align-items:center/);for(const id of ['qDeluxeSongs','qDeluxeRH','qDeluxeJanuca'])assert.ok(f(id).parentElement.querySelector('span'));
 await sleep(100);a.close();
 console.log('PASS mobile form relevance, aligned Deluxe controls, dashboard spacing, client event visibility/editing, reminder persistence, upcoming/late anniversary and year/leap boundaries.');
})().catch(e=>{console.error(e);process.exit(1)});
