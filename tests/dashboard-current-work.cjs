const assert=require('node:assert/strict');
const fs=require('node:fs');
const {boot,fixture}=require('./commercial-scenarios.cjs');
(async()=>{
 const rows=fixture(),oldTask='Terminar interior: revisar nusaj sefardí e incorporar dos agregados';
 rows.push({key:'jd_jobs_v1',value:[{id:'printed',clientId:'qa-client',title:'Trabajo en imprenta',stage:'ENVIADO a imprenta',next:oldTask,nextDate:'2026-10-10',quoteIds:[],history:[]}]});
 const app=await boot(rows),w=app.w,W=w.JDWorkflow,d=w.document;
 // Reproduce real dashboard ordering: portal poll inserts its own metrics before KPI refresh.
 w.fetch=async()=>({ok:true,json:async()=>({inquiries:[{id:'req',customer_id:'customer',customer_result:{description:'Cuadríptico'}}],customers:[{id:'customer',name:'Cliente del portal'}],orders:[{id:'portal-order',customer_id:'customer',status:'Solicitado',project:{title:'Pedido por revisar'}}]})});
 w.eval(fs.readFileSync('assets/jd-portal-inbox.js','utf8'));
 await w.JDPortalInbox.refresh();W.renderDashboard();w.jdRenderDashboardKpis();await w.JDPortalInbox.refresh();W.refresh();w.jdRenderDashboardKpis();
 await new Promise(r=>setTimeout(r,100));
 assert.equal(d.querySelectorAll('#jdDashboardKpis').length,1);
 assert.equal(d.querySelectorAll('#dashboard [data-jd-dash]').length,4,'one owner for global KPIs');
 assert.equal(d.querySelectorAll('#jdPortalInbox [data-jd-dash]').length,0,'portal counters are never replaced by global KPIs');
 assert.equal(d.querySelectorAll('#jdWorkPriorities [data-jd-dash]').length,0,'work counters remain distinct');
 assert.equal(d.querySelectorAll('#jdPortalInbox .grid.cards > .card').length,3);
 assert.match(d.getElementById('jdPortalInbox').textContent,/Consultas por cotizar/);
 assert.match(d.querySelector('#jdWorkPriorities .jd-daily-summary').textContent,/Trabajos internos en curso/);
 assert.doesNotMatch(d.getElementById('jdWorkPriorities').textContent,/Terminar interior|Antes de imprenta/,'legacy design action and preprint alerts do not survive print handoff');
 assert.match(d.getElementById('jdWorkPriorities').textContent,/Seguir la orden y confirmar el avance/);
 assert.equal(app.get('jd_jobs_v1')[0].next,oldTask,'read-only rendering preserves legacy original');
 W.openJob('printed');assert.equal(d.getElementById('jobNext').value,'','old design task is not offered as current');
 d.getElementById('jobNext').value='Consultar muestra firmada con imprenta';d.getElementById('jobNext').dispatchEvent(new w.Event('input'));
 await d.querySelector('.jd-work-modal [data-save]').onclick();let job=app.get('jd_jobs_v1')[0];assert.equal(job.nextStage,'ENVIADO a imprenta');assert.ok(job.history.some(h=>h.before?.text===oldTask));assert.match(d.getElementById('jdWorkPriorities').textContent,/Consultar muestra firmada/);
 W.openJob('printed');d.getElementById('jobStage').value='Imprenta terminó · pendiente de recibir';d.getElementById('jobStage').dispatchEvent(new w.Event('change'));assert.equal(d.getElementById('jobNext').value,'Coordinar el retiro de imprenta');
 await d.querySelector('.jd-work-modal [data-save]').onclick();job=app.get('jd_jobs_v1')[0];assert.equal(job.next,'Coordinar el retiro de imprenta');assert.equal(job.nextDate,'');assert.ok(job.history.some(h=>h.before?.text==='Consultar muestra firmada con imprenta'));
 // A custom action explicitly entered for the new stage must be retained.
 W.openJob('printed');d.getElementById('jobNext').value='Retirar el viernes a las 14';d.getElementById('jobNext').dispatchEvent(new w.Event('input'));d.getElementById('jobStage').value='Recibido de imprenta · CONTROL DE CALIDAD';d.getElementById('jobStage').dispatchEvent(new w.Event('change'));assert.equal(d.getElementById('jobNext').value,'Retirar el viernes a las 14');d.querySelector('[data-close]').click();
 const before={stage:'Diseño en curso',next:'Terminar diseño',nextDate:'2026-10-01',history:[]},after={...before,stage:'ENVIADO a imprenta'};W.syncNextAction(before,after,'2026-10-20T18:24:00Z');assert.equal(after.next,W.suggestedNext(after.stage));assert.equal(after.printSentAt,'2026-10-20T18:24:00Z');assert.equal(after.nextDate,'');assert.equal(after.history[0].before.text,'Terminar diseño');
 await new Promise(r=>setTimeout(r,100));app.close();console.log('PASS repeated portal/work/global refreshes keep unique KPI ownership, live stage actions replace stale design tasks, old text remains in history and explicit new actions survive.');
})().catch(e=>{console.error(e);process.exit(1)});
