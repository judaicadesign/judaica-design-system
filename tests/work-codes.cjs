const assert=require('node:assert/strict');
const {boot,fixture}=require('./commercial-scenarios.cjs');
(async()=>{
 const rows=fixture();rows.push({key:'jd_jobs_v1',value:[{id:'work-a',clientId:'qa-client',title:'Birkón boda',stage:'Primer contacto',history:[]},{id:'work-c',clientId:'qa-client',title:'Lúaj',stage:'Primer contacto',history:[]}]});
 const app=await boot(rows),w=app.w,W=w.JDWorkflow,d=w.document;
 const original=w.jdSupabase.from.bind(w.jdSupabase),codes=[{source_key:'job:work-a',code:'JD-777001'},{source_key:'job:work-c',code:'JD-777002'}];
 w.jdSupabase.from=t=>t!=='jd_work_codes'?original(t):{select:()=>({in:async(_,keys)=>({data:codes.filter(c=>keys.includes(c.source_key))})})};
 let copied='';Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async s=>copied=s}});
 await W.loadWorkCodes();assert.equal(W.workCode('work-a'),'JD-777001');W.refresh();assert.ok(d.querySelector('#jdWorkPriorities').textContent.includes('JD-777001'));
 W.openJob('work-c');assert.equal(d.querySelector('.jd-work-reference [data-work-code]').textContent,'JD-777002');await d.querySelector('[data-copy-work-code]').onclick();assert.equal(copied,'JD-777002');
 d.getElementById('jobTitle').value='Lúaj renombrado';await d.querySelector('.jd-work-modal [data-save]').onclick();await W.loadWorkCodes();W.openJob('work-c');assert.equal(d.querySelector('.jd-work-reference [data-work-code]').textContent,'JD-777002');d.querySelector('[data-close]').click();
 W.openClient('qa-client');assert.ok(d.querySelector('[data-job="work-a"]').parentNode.textContent.includes('JD-777001'));assert.ok(d.querySelector('[data-job="work-c"]').parentNode.textContent.includes('JD-777002'));d.querySelector('[data-close]').click();
 W.openJob(null,W.read('jd_clients')[0]);assert.equal(d.querySelector('[data-copy-work-code]').disabled,true,'Nunca inventar un número en el navegador');d.querySelector('[data-close]').click();
 app.close();
 const blank=fixture();blank.find(r=>r.key==='jd_clients').value=[];const empty=await boot(blank);await empty.w.JDWorkflow.loadWorkCodes();const orig=empty.w.jdSupabase.from.bind(empty.w.jdSupabase);empty.w.jdSupabase.from=t=>t==='jd_work_codes'?{select:()=>({in:async()=>({data:[{source_key:'job:first',code:'JD-888001'}]})})}:orig(t);await empty.w.jdUpdateSharedState(['jd_jobs_v1'],()=>({jd_jobs_v1:[{id:'first',clientId:'future-client',title:'Primer trabajo'}]}));await empty.w.JDWorkflow.loadWorkCodes();assert.equal(empty.w.JDWorkflow.workCode('first'),'JD-888001','Crear el primer trabajo también refresca su código');empty.close();
 console.log('PASS visible immutable work references, same-client concurrent jobs, dashboard/client cards, copy, rename and unsaved work.');
})().catch(e=>{console.error(e);process.exit(1)});
