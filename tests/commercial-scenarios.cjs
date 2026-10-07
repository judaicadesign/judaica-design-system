const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const math=require('../assets/jd-inflation.js');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const product={id:'birkon-librito',name:'Birkón · Librito',status:'Activo',supplier:'Zloto',nusaj:true,models:['Classic'],texts:['Hebreo solo'],sizes:['Normal · 11,6 × 15,5 cm'],bindings:['Abrochado'],variants:[{id:'qa-classic',model:'Classic',texts:'Hebreo solo',nusajCount:1,nusajOptions:['Solo Ashkenazí'],pages:24,content:['Contenido de prueba']}],technical:{}};
function fixture(){return [
 {key:'jd_catalog_v6',value:[structuredClone(product)]},
 {key:'jd_cost_quotes_v2',value:[50,100,200].map((qty,i)=>({supplier:'Zloto',product:product.name,variant:'Classic',size:product.sizes[0],binding:'Abrochado',pages:24,qty,cost:[100000,180000,330000][i],date:'2026-07-01'}))},
 {key:'jd_pricing_rules_v4',value:[{id:'qa-rule',product:product.name,variant:'Classic',divisor:.5,extra:0}]},
 {key:'jd_supplier_settings_v1',value:{Zloto:{shipping:10000,production:'2 semanas'}}},
 {key:'jd_clients',value:[{id:'qa-client',name:'Ána Prueba',firstName:'Ána',lastName:'Prueba',org:'Institución de prueba',status:'Esperando respuesta',next:'Consultar respuesta',nextDate:'2026-07-15',phone:'',quoteIds:[]}]},
 {key:'jd_saved_quotes_v6',value:[]}, {key:'jd_assets',value:[]}
];}
async function boot(rows=fixture(),fetchResult){
 const remote=structuredClone(rows),writes=[],alerts=[],errors=[];
 let writeFailure=false,expired=false;
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'https://example.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;
 w.Headers=Headers;w.Request=Request;w.scrollTo=()=>{};w.alert=message=>alerts.push(message);w.confirm=()=>true;
 w.fetch=async()=>fetchResult||{ok:false,status:503,json:async()=>({ok:false,error:'Proveedor sin conexión'}),text:async()=>''};
 const session=()=>({data:{session:expired?null:{access_token:'fixture-only'}}});
 const client={auth:{getSession:async()=>session(),getUser:async()=>({data:{user:{email:'qa@example.test'}}}),onAuthStateChange:()=>{},signOut:async()=>({})},storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'https://example.test/fixture.pdf'}})})},from:table=>({
  select:()=>table==='jd_team_access'?{eq:async()=>({data:[{email:'qa@example.test'}]})}:Object.assign(Promise.resolve({data:structuredClone(remote)}),{in:async(_,keys)=>({data:structuredClone(remote.filter(row=>keys.includes(row.key)))})}),
  upsert:async updates=>{if(writeFailure)return{error:{message:'Falla de red simulada'}};const batch=Array.isArray(updates)?updates:[updates];writes.push(structuredClone(batch));for(const row of batch){const i=remote.findIndex(x=>x.key===row.key);if(i<0)remote.push(structuredClone(row));else remote[i]=structuredClone(row)}return{}},
  delete:()=>({eq:async()=>({})})
 })};
 w.supabase={createClient:()=>client};
 for(const file of ['jd-ui.js','jd-inflation.js','jd-auth.js'])w.eval(fs.readFileSync(root+'/assets/'+file,'utf8'));
 await sleep(450);
 assert.equal(writes.length,0,'bootstrap must not write');
 assert.ok(w.document.body.classList.contains('jd-authenticated'));
 const get=key=>remote.find(row=>row.key===key)?.value;
 const setLocal=(key,value)=>w.localStorage.setItem(key,JSON.stringify(value));
 return {w,remote,writes,alerts,errors,get,setLocal,fail:value=>writeFailure=value,expire:value=>expired=value,close:()=>{assert.deepEqual(errors,[]);dom.window.close()}};
}
async function save(app){return app.w.document.getElementById('sq6').onclick()}
async function invalid(label,mutate,expected){const app=await boot();app.w.document.getElementById('qClient').value='Cliente de prueba';mutate(app);await save(app);await app.w.jdSendCurrentQuoteWhatsApp();await app.w.jdPreviewCurrentPDF();assert.equal(app.get('jd_saved_quotes_v6').length,0,label);assert.match(app.alerts.at(-1),expected,label);app.close();console.log(label,'passed')}
async function scenarios(){
 assert.equal(math.adjustedAmount(100000,8.5),108500);
 assert.equal(math.adjustedAmount(100000,0),100000);
 assert.ok(Math.abs(math.indexPercent(150,165)-10)<1e-10);
 for(const args of [[100000,-1],[0,10],[100000,Infinity]])assert.throws(()=>math.adjustedAmount(...args));
 assert.throws(()=>math.indexPercent(0,10));assert.throws(()=>math.indexPercent(150,140));
 assert.equal(math.validDate('2026-02-30'),false);assert.equal(math.validDate('2026-02-28'),true);
 console.log('inflation math and invalid values passed');
 await invalid('empty client',a=>a.w.document.getElementById('qClient').value='',/Falta el nombre/);
 await invalid('empty quantities',a=>a.w.qs6=[],/cantidades/);
 await invalid('negative quantity',a=>a.w.qs6=[-50],/cantidades/);
 await invalid('fractional quantity',a=>a.w.qs6=[50.5],/cantidades/);
 await invalid('duplicate quantities',a=>a.w.qs6=[50,50],/cantidades/);
 await invalid('below minimum cost quantity',a=>a.w.qs6=[25],/Falta costo/);
 await invalid('negative discount',a=>a.w.document.getElementById('qDiscount').value=-1000,/descuento/);
 await invalid('discount exceeds total',a=>a.w.document.getElementById('qDiscount').value=99999999,/descuento/);
 const app=await boot();
 app.w.document.getElementById('qClient').value='ana prueba';
 app.w.qs6=[50,75,100,200];
 app.w.document.getElementById('qDiscount').value=10000;
 app.w.document.getElementById('qDiscountWhy').value='Cliente frecuente';
 app.w.document.getElementById('qInternal').value='Nota interna de prueba';
 // A second device added a quote after this browser loaded.
 app.get('jd_saved_quotes_v6').push({id:'other-device',client:'Otro cliente de prueba',quantities:[]});
 app.fail(true);await save(app);
 assert.equal(app.get('jd_saved_quotes_v6').length,1,'failed write must not partially create quote/client');
 assert.equal(app.get('jd_clients')[0].quoteIds.length,0);
 app.fail(false);
 const first=save(app),second=save(app);await Promise.all([first,second]);
 const quote=app.get('jd_saved_quotes_v6')[0];
 assert.equal(app.get('jd_saved_quotes_v6').length,2,'double click must create only one quote and retain remote quote');
 assert.equal(app.get('jd_clients').length,1,'normalized name must update one client');
 assert.equal(app.get('jd_clients')[0].org,'Institución de prueba');
 assert.deepEqual(quote.quantities.map(x=>x.qty),[50,75,100,200]);
 assert.deepEqual(quote.quantities.map(x=>x.price),[200000,300000,360000,660000]);
 assert.equal(quote.discount,10000);assert.equal(quote.internal,'Nota interna de prueba');
 assert.equal(app.writes.at(-1).length,2,'client and quote must be committed together');
 app.w.jdRenderSavedQuotes();
 app.w.document.querySelector('[data-open-qid]').click();
 assert.equal(app.w.document.getElementById('qDiscount').value,'10000');
 assert.equal(app.w.document.getElementById('qInternal').value,'Nota interna de prueba');
 console.log('multi-quantity, discount, retry, double click, existing client and concurrent remote quote passed');
 app.expire(true);await save(app);assert.equal(app.get('jd_saved_quotes_v6').length,2);assert.match(app.alerts.at(-1),/sesión/);app.expire(false);
 console.log('expired session passed');
 const originalCost=structuredClone(app.get('jd_cost_quotes_v2')[0]);
 app.w.jdOpenInflation(originalCost);
 const input=app.w.document.getElementById('jdAdjustmentPercent');input.value='8,5';input.dispatchEvent(new app.w.Event('input',{bubbles:true}));
 app.fail(true);await app.w.document.querySelector('[data-apply]').onclick();await sleep(30);
 assert.equal(app.get('jd_cost_quotes_v2')[0].adjustment,undefined,'failure must keep original cost');
 app.fail(false);await app.w.document.querySelector('[data-apply]').onclick();await sleep(30);
 const estimated=app.get('jd_cost_quotes_v2')[0];
 assert.equal(estimated.cost,100000);assert.equal(estimated.date,'2026-07-01');assert.equal(math.effectiveCost(estimated),108500);
 assert.equal(app.get('jd_saved_quotes_v6')[0].quantities[0].price,200000,'existing quote must keep agreed price');
 app.w.jdOpenInflation(estimated);
 const percent=app.w.document.getElementById('jdAdjustmentPercent');percent.value='20';percent.dispatchEvent(new app.w.Event('input',{bubbles:true}));
 await app.w.document.querySelector('[data-apply]').onclick();await sleep(30);
 assert.equal(math.effectiveCost(app.get('jd_cost_quotes_v2')[0]),120000,'repeated adjustment must start from original, not compound twice');
 app.w.jdOpenInflation(app.get('jd_cost_quotes_v2')[0]);await app.w.document.querySelector('[data-reset]').onclick();await sleep(30);
 assert.equal(math.effectiveCost(app.get('jd_cost_quotes_v2')[0]),100000);
 app.w.jdOpenInflation(app.get('jd_cost_quotes_v2')[0]);
 const method=app.w.document.getElementById('jdAdjustmentMethod');method.value='ipc';method.dispatchEvent(new app.w.Event('change',{bubbles:true}));
 for(const [id,value] of Object.entries({jdIndexStart:150,jdIndexEnd:165,jdIndexMonthStart:'2026-07',jdIndexMonthEnd:'2026-08'})){const field=app.w.document.getElementById(id);field.value=value;field.dispatchEvent(new app.w.Event('input',{bubbles:true}));}
 assert.equal(app.w.document.querySelector('[data-apply]').disabled,false);
 await app.w.document.querySelector('[data-apply]').onclick();await sleep(30);
 assert.equal(math.effectiveCost(app.get('jd_cost_quotes_v2')[0]),110000);
 assert.equal(app.get('jd_cost_quotes_v2')[0].adjustment.endMonth,'2026-08');
 app.w.jdOpenInflation(app.get('jd_cost_quotes_v2')[0]);await app.w.document.querySelector('[data-reset]').onclick();await sleep(30);
 console.log('inflation estimation, failed apply, original preservation, repeat adjustment, IPC period and reset passed');
 if(process.env.JD_EXPORT_PREVIEW){
  app.w.go('dashboard');
  await sleep(400);
  const snapshot=app.w.document.cloneNode(true);
  snapshot.querySelectorAll('script,iframe').forEach(node=>node.remove());
  snapshot.querySelectorAll('[onclick]').forEach(node=>node.removeAttribute('onclick'));
  snapshot.querySelectorAll('input,textarea,select').forEach(node=>{const original=node.id?app.w.document.getElementById(node.id):null;if(original){if(node.tagName==='INPUT')node.setAttribute('value',original.value);if(node.tagName==='TEXTAREA')node.textContent=original.value;if(node.tagName==='SELECT')node.querySelectorAll('option').forEach(option=>option.toggleAttribute('selected',option.value===original.value));}node.disabled=true;});
  snapshot.querySelectorAll('button').forEach(node=>{if(!node.matches('[data-screen],.jd-nav-toggle,[data-jd-dash],[data-open-qid]'))node.disabled=true;});
  snapshot.querySelectorAll('link[rel=stylesheet]').forEach(node=>{const filename=node.getAttribute('href').split('?')[0];if(!filename.startsWith('assets/'))return;const style=snapshot.createElement('style');style.textContent=fs.readFileSync(root+'/'+filename,'utf8');node.replaceWith(style)});
  snapshot.querySelectorAll('img').forEach(node=>{const src=node.getAttribute('src')||'';if(src.startsWith('assets/'))node.setAttribute('src','../'+src)});
  const serialized='<!doctype html>'+snapshot.documentElement.outerHTML;
  fs.writeFileSync(process.env.JD_EXPORT_PREVIEW,serialized);
 }
 app.close();
 const missingCosts=fixture();missingCosts.find(x=>x.key==='jd_cost_quotes_v2').value=[];
 const missing=await boot(missingCosts);missing.w.document.getElementById('qClient').value='Cliente sin costo';await save(missing);assert.equal(missing.get('jd_saved_quotes_v6').length,0);assert.match(missing.alerts.at(-1),/Falta costo/);missing.close();
 console.log('missing supplier costs passed');
 const malformed=fixture();malformed.find(x=>x.key==='jd_cost_quotes_v2').value[0].cost=-100000;
 const bad=await boot(malformed);bad.w.document.getElementById('qClient').value='Prueba costo inválido';bad.w.qs6=[50];await save(bad);assert.equal(bad.get('jd_saved_quotes_v6').length,0);assert.match(bad.alerts.at(-1),/costo.*válido/);bad.close();
 console.log('invalid supplier cost passed');
 const liveRows=fixture();const p=liveRows[0].value[0];p.name='Folleto de prueba';p.supplier='Gráfica B612';p.nusaj=false;p.models=['Díptico'];p.variants[0].model='Díptico';p.technical={openWidthMm:200,openHeightMm:200,closedWidthMm:100,closedHeightMm:200,weightGsm:300,paper:'Ilustración',lamination:'Mate',sides:'Doble faz'};
 liveRows.find(x=>x.key==='jd_pricing_rules_v4').value[0].product=p.name;liveRows.find(x=>x.key==='jd_pricing_rules_v4').value[0].variant='Díptico';
 const live=await boot(liveRows);live.w.document.getElementById('qClient').value='Proveedor fuera de línea';await sleep(100);await save(live);assert.equal(live.get('jd_saved_quotes_v6').length,0);assert.match(live.alerts.at(-1),/B612/);live.close();
 console.log('B612 offline passed');
}
scenarios().catch(error=>{console.error(error);process.exit(1)});
