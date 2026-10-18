const assert=require('node:assert/strict');
const fs=require('node:fs');
const {boot,fixture}=require('./commercial-scenarios.cjs');
const wait=()=>new Promise(resolve=>setTimeout(resolve,180));

(async()=>{
 const rows=fixture();
 const clients=rows.find(r=>r.key==='jd_clients').value;
 clients.push(
  {id:'same-name',name:'Ána Prueba',firstName:'Ána',lastName:'Prueba'},
  {id:'archive-client',name:'Cliente archivado',archivedAt:'2026-10-16T10:00:00Z'},
  {id:'trash-client',name:'Cliente en papelera',deletedAt:'2026-10-16T10:00:00Z'},
  {id:'legacy-client',name:'Cliente sin ID de presupuesto'}
 );
 const quotes=rows.find(r=>r.key==='jd_saved_quotes_v6').value;
 const quote=(id,client,clientId)=>({id,client,...(clientId?{clientId}:{}),product:'Birkón',created:'2026-10-16',status:'Guardado',quantities:[{qty:100,price:1000}]});
 quotes.push(
  quote('q-primary','Ána Prueba','qa-client'),
  quote('q-second','Ána Prueba','same-name'),
  quote('q-archive','Cliente archivado','archive-client'),
  quote('q-trash','Cliente en papelera','trash-client'),
  quote('q-legacy','Cliente sin ID de presupuesto')
 );

 const app=await boot(rows),w=app.w,W=w.JDWorkflow;
 const row=id=>w.document.querySelector('#clients tr[data-client="'+id+'"]');
 const badge=id=>row(id)?.querySelector('.jd-client-quote-link');
 const shownQuotes=()=>[...w.document.querySelectorAll('#savedQuotes [data-open-qid]')].map(b=>b.dataset.openQid);
 const checkActions=(id,selectors)=>{
  const tr=row(id),cell=tr?.lastElementChild;
  assert.equal(cell?.tagName,'TD','Actions must remain in a real table cell');
  assert.equal(cell.firstElementChild?.className,'jd-toolbar','Flex belongs inside the cell');
  for(const selector of selectors)assert.ok(cell.querySelector(selector),'Missing '+selector+' for '+id);
 };

 W.renderClients('active');await wait();
 checkActions('qa-client',['[data-client-open]','[data-archive]','[data-delete-client]']);
 checkActions('same-name',['[data-client-open]','[data-archive]','[data-delete-client]']);
 assert.equal(badge('qa-client').textContent,'Presupuestos (1)');
 assert.equal(badge('same-name').textContent,'Presupuestos (1)');
 badge('qa-client').click();
 assert.deepEqual(shownQuotes(),['q-primary'],'Same-name contacts must not share identified quotes');
 badge('same-name').click();
 assert.deepEqual(shownQuotes(),['q-second']);

 // The stable ID should survive a client's display-name change.
 const renamed=structuredClone(clients);
 renamed.find(c=>c.id==='qa-client').name='Ána Renombrada';
 app.setLocal('jd_clients',renamed);
 W.renderClients('active');await wait();
 assert.equal(badge('qa-client').textContent,'Presupuestos (1)');
 badge('qa-client').click();
 assert.deepEqual(shownQuotes(),['q-primary'],'Renaming the contact must not orphan identified quotes');

 // Quotes made before clientId existed still fall back to name matching.
 assert.equal(badge('legacy-client').textContent,'Presupuestos (1)');
 badge('legacy-client').click();
 assert.deepEqual(shownQuotes(),['q-legacy']);

 W.renderClients('archive');await wait();
 checkActions('archive-client',['[data-client-open]','[data-archive]','[data-delete-client]']);
 assert.match(row('archive-client').textContent,/Reactivar/);
 badge('archive-client').click();
 assert.deepEqual(shownQuotes(),['q-archive']);

 W.renderClients('trash');await wait();
 checkActions('trash-client',['[data-restore]']);
 assert.equal(row('trash-client').querySelectorAll('td:last-child button').length,1);
 badge('trash-client').click();
 assert.deepEqual(shownQuotes(),['q-trash']);
 await row('trash-client').querySelector('[data-restore]').onclick();
 assert.equal(app.get('jd_clients').find(c=>c.id==='trash-client').deletedAt,null);

 // Rerendering must never duplicate links; changing quote data must refresh or remove badges.
 W.renderClients('active');await wait();
 assert.equal(row('qa-client').querySelectorAll('.jd-client-quote-link').length,1);
 app.setLocal('jd_saved_quotes_v6',[...quotes,quote('q-new','Ána Prueba','qa-client')]);
 const trigger=()=>w.document.querySelector('#clients .topbar').appendChild(w.document.createElement('span'));
 trigger();await wait();
 assert.equal(badge('qa-client').textContent,'Presupuestos (2)');
 assert.equal(row('qa-client').querySelectorAll('.jd-client-quote-link').length,1);
 app.setLocal('jd_saved_quotes_v6',quotes.filter(q=>q.clientId!=='qa-client'));
 trigger();await wait();
 assert.equal(badge('qa-client'),null,'Stale badges should disappear when the quote count is zero');

 const css=fs.readFileSync('assets/jd-base.css','utf8');
 assert.match(css,/@media\(max-width:1150px\)/);
 assert.match(css,/#clients \.jd-crm-table tbody tr\[hidden\]\{display:none!important\}/);
 assert.match(css,/#clients \.jd-crm-table td:last-child\{min-width:0/);
 app.close();
 console.log('PASS client table action cells, archived/trash actions, quote IDs, duplicate names, renames, legacy quotes, live badge counts and responsive-card CSS.');
})().catch(error=>{console.error(error);process.exit(1)});
