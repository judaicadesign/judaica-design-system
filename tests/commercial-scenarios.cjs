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
 let writeFailure=false,expired=false,raceKey=null;
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'https://example.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;
 w.Headers=Headers;w.Request=Request;w.Response=Response;w.structuredClone=structuredClone;w.scrollTo=()=>{};w.URL.createObjectURL=()=> 'blob:fixture';w.URL.revokeObjectURL=()=>{};w.alert=message=>alerts.push(message);w.confirm=()=>true;
 w.fetch=async()=>fetchResult||{ok:false,status:503,json:async()=>({ok:false,error:'Proveedor sin conexión'}),text:async()=>''};
 const session=()=>({data:{session:expired?null:{access_token:'fixture-only'}}});
 const client={auth:{getSession:async()=>session(),getUser:async()=>({data:{user:{email:'qa@example.test'}}}),onAuthStateChange:()=>{},signOut:async()=>({})},storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'https://example.test/fixture.pdf'}})})},from:table=>({
  select:()=>table==='jd_team_access'?{eq:async()=>({data:[{email:'qa@example.test'}]})}:Object.assign(Promise.resolve({data:structuredClone(remote)}),{in:async(_,keys)=>({data:structuredClone(remote.filter(row=>keys.includes(row.key)))})}),
  upsert:async updates=>{if(writeFailure)return{error:{message:'Falla de red simulada'}};const batch=Array.isArray(updates)?updates:[updates];writes.push(structuredClone(batch));for(const row of batch){const i=remote.findIndex(x=>x.key===row.key);if(i<0)remote.push(structuredClone(row));else remote[i]=structuredClone(row)}return{}},
  delete:()=>({eq:async()=>({})})
 })};
 client.rpc=async(name,{changes})=>{
   assert.equal(name,'jd_commit_state');if(writeFailure)return {error:{message:'Falla de red simulada'}};
   if(raceKey){remote.find(r=>r.key===raceKey).value.push({id:'racing-device',client:'Dispositivo simultáneo'});raceKey=null;}
   for(const c of changes){const current=remote.find(r=>r.key===c.key);if(!!current!==c.exists||current&&JSON.stringify(current.value)!==JSON.stringify(c.expected))return {error:{code:'40001',message:'Datos modificados por otro dispositivo'}};}
   const updates=changes.map(c=>({key:c.key,value:c.value}));writes.push(structuredClone(updates));
   for(const c of changes){const i=remote.findIndex(r=>r.key===c.key);if(c.remove){if(i>=0)remote.splice(i,1)}else if(i<0)remote.push(structuredClone({key:c.key,value:c.value}));else remote[i]=structuredClone({key:c.key,value:c.value});}
   return {data:updates,error:null};
 };
 w.supabase={createClient:()=>client};
 w.jdNativeQuote={version:'20261008-master-v9'};
 w.jdVectorQuotePdf=async sheets=>new w.Blob(['fixture-native-pdf-'+sheets.length]);
 for(const file of ['jd-ui.js','jd-asset-match.js','jd-inflation.js','jd-orders.js','jd-quote-edit.js','jd-price.js','jd-quote-share.js','jd-legal.js','jd-auth.js'])w.eval(fs.readFileSync(root+'/assets/'+file,'utf8'));
 await sleep(450);
 assert.equal(writes.length,0,'bootstrap must not write');
 assert.ok(w.document.body.classList.contains('jd-authenticated'));
 const get=key=>remote.find(row=>row.key===key)?.value;
 const setLocal=(key,value)=>w.localStorage.setItem(key,JSON.stringify(value));
 return {w,remote,writes,alerts,errors,get,setLocal,race:key=>raceKey=key,fail:value=>writeFailure=value,expire:value=>expired=value,close:()=>{assert.deepEqual(errors,[]);dom.window.close()}};
}
async function save(app){return app.w.document.getElementById('sq6').onclick()}
async function invalid(label,mutate,expected){const app=await boot();app.w.document.getElementById('qClient').value='Cliente de prueba';mutate(app);await save(app);await app.w.jdSendCurrentQuoteWhatsApp();await app.w.jdPreviewCurrentPDF();assert.equal(app.get('jd_saved_quotes_v6').length,0,label);assert.match(app.alerts.at(-1),expected,label);app.close();console.log(label,'passed')}
async function scenarios(){
 const brokenPreview=new JSDOM('<div id="quotePreview"><div class="jd-master-sheet jd-has-art"><div class="jd-full-legal">Texto auxiliar</div><svg class="jd-master-art"></svg></div></div>',{runScripts:'outside-only'});
 brokenPreview.window.jdNativeQuote={readSheet:()=>({})};brokenPreview.window.jdQuotePreviewSVG=async()=>{throw Error('Fallo de render de prueba')};brokenPreview.window.eval(fs.readFileSync(root+'/assets/jd-quote-fit.js','utf8'));
 await sleep(30);await brokenPreview.window.jdRefreshQuoteArt();assert.equal(brokenPreview.window.document.querySelector('.jd-master-art'),null);assert.equal(brokenPreview.window.document.querySelector('.jd-preview-error').textContent,'Fallo de render de prueba');
 assert.ok(fs.readFileSync(root+'/assets/jd-quote-layout.css','utf8').includes('.jd-master-sheet>*:not(.jd-master-art):not(.jd-preview-error){visibility:hidden!important}'));
 brokenPreview.window.jdQuotePreviewSVG=async()=>'<svg class="jd-master-art"></svg>';await brokenPreview.window.jdRefreshQuoteArt();assert.ok(brokenPreview.window.document.querySelector('.jd-master-art'));assert.equal(brokenPreview.window.document.querySelector('.jd-preview-error'),null);brokenPreview.window.close();
 console.log('preview failure removes stale artwork, suppresses malformed HTML fallback and recovers cleanly passed');

 const eventRows=fixture();eventRows.find(r=>r.key==='jd_assets').value=[
  {id:'generic',product:product.name,role:'Mockup principal',data:'https://example.test/generic.png',mockCanvas:true},
  {id:'bar',product:product.name,role:'Mockup principal',eventType:'bar_mitzvah',binding:'Abrochado',data:'https://example.test/bar.png',mockCanvas:true},
  {id:'wedding',product:product.name,role:'Mockup principal',eventType:'wedding',data:'https://example.test/wedding.png'},
  {id:'bar-bg',product:'Todos los productos',role:'Fondo de evento',eventType:'bar_mitzvah',data:'https://example.test/bar-bg.jpg'}
 ];
 const evApp=await boot(eventRows);evApp.w.document.getElementById('qClient').value='QA evento';
 const eventSelect=evApp.w.document.getElementById('qEventType');eventSelect.value='bar_mitzvah';eventSelect.dispatchEvent(new evApp.w.Event('change'));
 assert.match(evApp.w.document.querySelector('.jd-pdf-product-img').src,/bar.png/);assert.match(evApp.w.document.querySelector('.jd-pdf-background').src,/bar-bg.jpg/);
 assert.doesNotMatch(evApp.w.document.getElementById('quotePreview').textContent,/Tipo de evento|Bar Mitzvá/);
 const evSaved=await save(evApp);assert.equal(evSaved.eventType,'bar_mitzvah');
 evApp.w.document.getElementById('jdNewQuoteBtn').click();assert.equal(eventSelect.value,'generic');assert.match(evApp.w.document.querySelector('.jd-pdf-product-img').src,/generic.png/);
 evApp.w.jdRenderSavedQuotes();evApp.w.document.querySelector('[data-edit-qid]').click();assert.equal(eventSelect.value,'bar_mitzvah');
 evApp.w.document.getElementById('jdAddAlternative').click();eventSelect.value='wedding';eventSelect.dispatchEvent(new evApp.w.Event('change'));
 assert.equal(evApp.w.document.querySelectorAll('.jd-pdf-sheet').length,2);for(const img of evApp.w.document.querySelectorAll('.jd-pdf-product-img'))assert.match(img.src,/wedding.png/);
 const evEdited=await save(evApp);assert.ok(evEdited.alternatives.every(a=>a.eventType==='wedding'));evApp.close();
 console.log('event assignment, matching background/mockup, internal-only field, save/edit, global alternatives and legacy fallback passed');


 const kidushRows=fixture();kidushRows[0].value[0].variants[0].content=['Kidush del día (Shabat y Yom Tov)','Birkat Hamazón'];
 const kidush=await boot(kidushRows);kidush.w.renderQuote();assert.match(kidush.w.document.querySelector('.index-list').textContent,/Kidush del día - Shabat y Yom Tov/);kidush.w.go('products');kidush.w.document.querySelector('[data-pvars="0"]').click();kidush.w.document.querySelector('[data-ve="0"]').click();assert.match(kidush.w.document.getElementById('vc6').value,/Kidush del día - Shabat y Yom Tov/);await sleep(80);kidush.close();

 const materialRows=fixture();materialRows[0].value[0].technical={customMetadata:'preservar'};
 const materials=await boot(materialRows);
 materials.w.renderQuote();
 assert.deepEqual([...materials.w.document.querySelectorAll('.jd-tech span')].map(x=>x.textContent),['Tapa: papel ilustración 300 grs.','laminado mate/brillante','Interior: papel ilustración 115 grs. - Full color']);
 materials.w.go('products');materials.w.document.querySelector('[data-pedit="0"]').click();
 for(const [id,value] of Object.entries({ptpaper6:'Papel de tapa QA',ptgsm6:'250',ptlam6:'Laminado brillante',ptinteriorpaper6:'Obra',ptinteriorgsm6:'90',ptprint6:'Blanco y negro'}))materials.w.document.getElementById(id).value=value;
 await materials.w.document.querySelector('.modal .s6').onclick(new materials.w.Event('click'));await sleep(350);
 const savedMaterials=materials.get('jd_catalog_v6')[0];assert.equal(savedMaterials.technical.customMetadata,'preservar');assert.equal(savedMaterials.variants.length,1);assert.deepEqual(savedMaterials.sizes,['Normal · 11,6 × 15,5 cm']);assert.equal(savedMaterials.technical.interiorWeightGsm,90);
 materials.w.renderQuote();assert.deepEqual([...materials.w.document.querySelectorAll('.jd-tech span')].map(x=>x.textContent),['Tapa: Papel de tapa QA 250 grs.','Laminado brillante','Interior: Obra 90 grs. - Blanco y negro']);
 materials.w.go('products');materials.w.document.querySelector('[data-pedit="0"]').click();materials.w.document.getElementById('ptlam6').value='';
 await materials.w.document.querySelector('.modal .s6').onclick(new materials.w.Event('click'));await sleep(350);
 materials.w.renderQuote();assert.equal(materials.get('jd_catalog_v6')[0].technical.lamination,'');assert.ok(!materials.w.document.querySelector('.jd-tech').textContent.includes('laminado mate/brillante'));await sleep(80);materials.close();
 const reloadMaterials=await boot(materials.remote);reloadMaterials.w.go('products');reloadMaterials.w.document.querySelector('[data-pedit="0"]').click();assert.equal(reloadMaterials.w.document.getElementById('ptinteriorpaper6').value,'Obra');assert.equal(reloadMaterials.w.document.getElementById('ptlam6').value,'');await sleep(80);reloadMaterials.close();
 console.log('editable book cover/interior, lamination newline, metadata preservation, intentional blanks and reload passed');
 const zlotoRows=fixture();zlotoRows[0].value[0].variants[0].pages=72;zlotoRows[0].value[0].sizes.push('Grande · 14 × 18,5 cm');zlotoRows.find(r=>r.key==='jd_cost_quotes_v2').value=[{supplier:'Zloto',product:product.name,variant:'Classic',size:'Normal · 11,6 × 15,5 cm',binding:'Abrochado',pages:72,qty:100,cost:560770,date:'2026-08-25'}];
 const zloto=await boot(zlotoRows);zloto.w.go('products');zloto.w.document.querySelector('[data-pedit="0"]').click();await zloto.w.document.querySelector('.modal .s6').onclick(new zloto.w.Event('click'));await sleep(350);assert.deepEqual(zloto.get('jd_catalog_v6')[0].sizes,['Normal · 11,6 × 15,5 cm','Grande · 14 × 18,5 cm']);zloto.w.document.getElementById('qClient').value='Prueba costo Zloto';zloto.w.qs6=[100];zloto.w.renderQuote();assert.equal(zloto.w.jdCollectQuote().quantities[0].cost,560770);await sleep(80);zloto.close();console.log('saving product preserves decimal dimensions and exact Zloto Classic 72-page/100-unit cost passed');


 const foldRows=fixture();const fold=foldRows.find(r=>r.key==='jd_catalog_v6').value[0];fold.name='Birkón · Folleto';fold.id='birkon-folleto';fold.technical={paper:'Obra folleto QA',weightGsm:170,lamination:'Sin laminado',print:'Dos tintas',sides:'Doble faz'};fold.models=['Bífold','Tríptico','Cuadríptico'];fold.variants=fold.models.map((model,i)=>({...structuredClone(fold.variants[0]),id:'fold-'+i,model,pages:36}));
 const foldApp=await boot(foldRows);
 for(const [model,count,svg] of [['Bífold',4,'08_bifold'],['Tríptico',6,'09_triptico'],['Cuadríptico',8,'10_cuadriptico']]){
  const input=foldApp.w.document.getElementById('qModel');input.value=model;input.dispatchEvent(new foldApp.w.Event('change',{bubbles:true}));foldApp.w.renderQuote();
  const sheet=foldApp.w.document.querySelector('.jd-master-sheet');const row=[...sheet.querySelectorAll('.jd-spec-icon-row')].find(x=>x.querySelector('small')?.textContent==='Carillas');assert.equal(row.querySelector('strong').textContent,String(count));assert.ok(sheet.querySelector('img[src="assets/quote-icons/'+svg+'.svg"]'));assert.ok(![...sheet.querySelectorAll('small')].some(x=>x.textContent==='Páginas'));
 }
 assert.deepEqual([...foldApp.w.document.querySelectorAll('.jd-tech span')].map(x=>x.textContent),['Papel: Obra folleto QA · 170 g','Terminación: Sin laminado','Impresión: Dos tintas · Doble faz']);
 await sleep(80);foldApp.close();
 const bindingRows=fixture();bindingRows.find(r=>r.key==='jd_catalog_v6').value[0].bindings=['Abrochado','Binder','Anillado'];bindingRows.find(r=>r.key==='jd_assets').value=['Abrochado','Binder'].map(variant=>({product:product.name,role:'Mockup principal',variant,data:'data:image/png;base64,'+variant}));
 const bindingApp=await boot(bindingRows);
 for(const [binding,svg] of [['Abrochado','05_abrochado'],['Binder','06_binder_lomo_cuadrado'],['Anillado','07_anillado']]){
  const input=bindingApp.w.document.getElementById('qBind');input.value=binding;input.dispatchEvent(new bindingApp.w.Event('change',{bubbles:true}));bindingApp.w.renderQuote();const sheet=bindingApp.w.document.querySelector('.jd-master-sheet');assert.ok(sheet.querySelector('img[src="assets/quote-icons/'+svg+'.svg"]'));assert.ok(sheet.querySelector('img[src="assets/quote-icons/11_libro_abierto.svg"]'));
  if(binding!=='Anillado')assert.equal(sheet.querySelector('.jd-pdf-product-img').getAttribute('src'),'data:image/png;base64,'+binding);
  assert.equal([...sheet.querySelectorAll('.jd-spec-icon-row')].find(x=>x.querySelector('small')?.textContent==='Páginas').querySelector('strong').textContent,'24');assert.ok(sheet.querySelector('.jd-master-left>.jd-content-box'));assert.equal(sheet.querySelector('.jd-quote-page').textContent,'» 1 / 1');
 }
 await sleep(80);bindingApp.close();console.log('leaflet faces, book pages, supplied format/binding SVGs, existing mockup selection and fixed footer structure passed');
 const matching=require('../assets/jd-asset-match.js');
 const choices=[{id:'tri',product:'Birkón · Folleto',role:'Mockup principal',model:'Tríptico',mockCanvas:true,data:'data:image/png;base64,tri'},{id:'cua',product:'Birkón · Folleto',role:'Mockup principal',model:'Cuadríptico',data:'data:image/png;base64,cua'}];
 assert.equal(matching.select(choices,{product:'Birkón · Folleto',model:'Tríptico'}).id,'tri');assert.equal(matching.select(choices,{product:'Birkón · Folleto',model:'Cuadríptico'}).id,'cua');assert.equal(matching.select(choices,{product:'Birkón · Folleto',model:'Díptico'}),null);
 const contentRows=fixture();contentRows.find(r=>r.key==='jd_catalog_v6').value[0]={...structuredClone(product),name:'Birkón · Folleto',models:['Tríptico'],bindings:[],variants:[{id:'tri-content',model:'Tríptico',texts:'Hebreo solo',nusajCount:1,pages:0,content:['Birkat Hamazón']}]};contentRows.find(r=>r.key==='jd_cost_quotes_v2').value.forEach(c=>{c.product='Birkón · Folleto';c.variant='Tríptico'});contentRows.find(r=>r.key==='jd_pricing_rules_v4').value.forEach(c=>c.product='Birkón · Folleto');contentRows.find(r=>r.key==='jd_assets').value=choices;
 const leaflet=await boot(contentRows);leaflet.w.document.getElementById('qClient').value='Folleto de prueba';const editContent=leaflet.w.document.getElementById('qLeafletContent');assert.equal(editContent.value,'Birkat Hamazón');editContent.value='Birkat Hamazón\nKidush del día - Shabat y Yom Tov';editContent.dispatchEvent(new leaflet.w.Event('input',{bubbles:true}));assert.equal(leaflet.w.document.querySelectorAll('.index-list li').length,2);assert.equal(leaflet.w.document.querySelector('.jd-pdf-product-img').dataset.mockCanvas,'true');const savedContent=await save(leaflet);leaflet.w.jdRenderSavedQuotes();leaflet.w.document.querySelector('[data-edit-qid]').click();assert.equal(leaflet.w.document.getElementById('qLeafletContent').value,'Birkat Hamazón\nKidush del día - Shabat y Yom Tov');assert.equal(leaflet.get('jd_catalog_v6')[0].variants[0].content.length,1,'quote-specific content must not modify catalog');leaflet.close();
 const assetRows=fixture();assetRows.find(r=>r.key==='jd_assets').value=[{id:'qa-mock',name:'Mockup prueba',product:product.name,role:'Mockup principal',variant:'Abrochado',data:'data:image/png;base64,fixture',storagePath:'',notes:''}];const assetApp=await boot(assetRows);const beforeCosts=structuredClone(assetApp.get('jd_cost_quotes_v2'));assetApp.w.go('assets');assetApp.w.document.querySelector('[data-ea]').click();assetApp.w.document.getElementById('jaModel').value='Classic';assetApp.w.document.getElementById('jaCanvas').checked=true;assetApp.fail(true);await assetApp.w.document.querySelector('.modal .jd-s').onclick();assert.equal(assetApp.get('jd_assets')[0].model,undefined);assetApp.fail(false);await assetApp.w.document.querySelector('.modal .jd-s').onclick();assert.equal(assetApp.get('jd_assets')[0].model,'Classic');assert.equal(assetApp.get('jd_assets')[0].mockCanvas,true);assert.deepEqual(assetApp.get('jd_cost_quotes_v2'),beforeCosts);assetApp.close();
 console.log('explicit mockup mapping, canonical canvas, editable leaflet content, saved reload and catalog preservation passed');
 const dates=require('../assets/jd-legal.js');
 for(const [from,to] of [['2027-05-05','2027-06-05'],['2027-01-31','2027-02-28'],['2028-01-31','2028-02-29'],['2026-12-31','2027-01-31']])assert.equal(dates.nextMonth(from),to);
 assert.equal(dates.today(new Date('2027-05-06T01:00:00Z')),'2027-05-05','Argentina date around midnight');
 const luaj=JSON.parse(fs.readFileSync(root+'/tests/fixtures/legal-luaj.json','utf8'));
 assert.equal(luaj.clauses.length,12);assert.equal(luaj.clauses.filter(c=>c[1].includes('{{vencimiento}}')).length,1);
 const luajRows=fixture();luajRows.find(r=>r.key==='jd_catalog_v6').value[0].legalSetId='legal-luaj';
 luajRows.push({key:'jd_legal_sets_v1',value:[luaj]});const luajApp=await boot(luajRows);
 luajApp.w.jdLegalDates.today=()=> '2027-05-05';luajApp.w.document.getElementById('qClient').value='Cliente Luaj de prueba';luajApp.w.qs6=[50];luajApp.w.renderQuote();
 const luajPreview=luajApp.w.document.querySelector('.jd-full-legal').textContent;
 assert.match(luajPreview,/vence el 5\/6\/2027/);assert.ok(!luajPreview.includes('{{vencimiento}}'));assert.match(luajPreview,/Correcciones y modificaciones/);assert.match(luajPreview,/70%/);
 const savedLuaj=await save(luajApp);assert.equal(savedLuaj.issuedDate,'2027-05-05');assert.equal(savedLuaj.validUntil,'2027-06-05');assert.equal(savedLuaj.legalClauses.length,12);
 luajApp.w.jdLegalDates.today=()=> '2027-05-10';luajApp.w.renderQuote();
 assert.equal(luajApp.get('jd_saved_quotes_v6')[0].validUntil,'2027-06-05','saved expiry remains fixed');
 luajApp.w.go('legal');assert.ok(!luajApp.w.document.getElementById('legal').textContent.includes('pendiente de incorporar'));
 luajApp.w.document.querySelector('[data-legal-edit="legal-luaj"]').click();assert.equal(luajApp.w.document.querySelectorAll('.jd-legal-editor textarea').length,12);
 assert.match(luajApp.w.document.getElementById('jdLegalBody7').value,/{{vencimiento}}/);await luajApp.w.document.getElementById('jdLegalSave').onclick();assert.equal(luajApp.get('jd_legal_sets_v1')[0].clauses.length,12);
 luajApp.close();console.log('Luaj complete clauses, calendar-month dates, Argentina timezone, PDF text and fixed saved validity passed');

 const configRows=fixture();configRows.find(r=>r.key==='jd_pricing_rules_v4').value.unshift({id:'general-first',product:product.name,variant:'*',marginPct:36});
 const config=await boot(configRows);config.w.document.getElementById('qClient').value='Cliente de prueba';config.w.qs6=[50];config.w.renderQuote();
 assert.equal(config.w.jdCollectQuote().quantities[0].price,210000,'specific format rule wins over general rule');
 config.w.jdRefreshRules();assert.match(config.w.document.getElementById('rules').textContent,/10\.000/);
 config.w.document.querySelector('[data-rule-supplier="Zloto"]').click();
 config.w.document.getElementById('supplierShipping').value=-1;await config.w.document.querySelector('.modal.open .ss').onclick();assert.match(config.w.document.getElementById('supplierMessage').textContent,/válido/);
 config.w.document.getElementById('supplierShipping').value=25000;config.fail(true);await config.w.document.querySelector('.modal.open .ss').onclick();assert.equal(config.get('jd_supplier_settings_v1').Zloto.shipping,10000);
 config.fail(false);await config.w.document.querySelector('.modal.open .ss').onclick();assert.equal(config.get('jd_supplier_settings_v1').Zloto.shipping,25000);assert.equal(config.get('jd_supplier_settings_v1').Zloto.production,'2 semanas');assert.equal(config.w.jdCollectQuote().quantities[0].shipping,25000);
 config.w.document.getElementById('newProd6').click();config.w.document.getElementById('pn6').value='Producto nuevo QA';config.w.document.getElementById('psup6').value='Zloto';config.w.document.getElementById('pmargin6').value=42;
 config.fail(true);await config.w.document.querySelector('.modal.open .s6').onclick(new config.w.Event('click'));assert.equal(config.get('jd_catalog_v6').length,1);assert.ok(!config.get('jd_pricing_rules_v4').some(r=>r.product==='Producto nuevo QA'));
 config.fail(false);await config.w.document.querySelector('.modal.open .s6').onclick(new config.w.Event('click'));await sleep(300);
 assert.equal(config.get('jd_catalog_v6').length,2);assert.equal(config.get('jd_pricing_rules_v4').find(r=>r.product==='Producto nuevo QA').marginPct,42);
 config.w.document.querySelector('[data-pedit="0"]').click();config.w.document.getElementById('pn6').value='Birkón renombrado QA';config.w.document.getElementById('pmargin6').value=40;
 await config.w.document.querySelector('.modal.open .s6').onclick(new config.w.Event('click'));await sleep(300);
 assert.equal(config.get('jd_pricing_rules_v4').find(r=>r.id==='qa-rule').product,'Birkón renombrado QA');assert.equal(config.get('jd_pricing_rules_v4').find(r=>r.id==='qa-rule').divisor,.5);
 assert.equal(config.get('jd_pricing_rules_v4').find(r=>r.id==='general-first').marginPct,40);assert.ok(!config.get('jd_pricing_rules_v4').find(r=>r.id==='general-first').divisor);
 config.close();console.log('supplier shipping source, validation/retry, atomic product and margin creation, rename and variant priority passed');
 const legalRows=fixture();
 const originalClauses=[['Título primero','Párrafo original\nSegunda línea'],['Título segundo','Otro párrafo']];
 legalRows.push({key:'jd_legal_sets_v1',value:[{id:'legal-birkonim',name:'Legales Birkonim',clauses:structuredClone(originalClauses)},{id:'legal-luaj',name:'Legales & aclaraciones Luaj',clauses:[['Luaj','Texto exclusivo de Luaj']]}]},{key:'jd_legal_librito_v4',value:structuredClone(originalClauses)});
 const legalEditor=await boot(legalRows);legalEditor.w.go('legal');
 legalEditor.w.document.getElementById('jdLegalNew').click();legalEditor.w.document.getElementById('jdLegalName').value='Legales & aclaraciones Otro producto';
 legalEditor.w.document.getElementById('jdLegalTitle0').value='Primera aclaración';legalEditor.w.document.getElementById('jdLegalBody0').value='Texto nuevo';
 legalEditor.w.document.getElementById('jdLegalAdd').click();legalEditor.w.document.getElementById('jdLegalTitle1').value='Otra aclaración';legalEditor.w.document.getElementById('jdLegalBody1').value='Otro texto';
 await legalEditor.w.document.getElementById('jdLegalSave').onclick();assert.equal(legalEditor.get('jd_legal_sets_v1').length,3);assert.equal(legalEditor.get('jd_legal_sets_v1')[2].clauses.length,2);assert.deepEqual(legalEditor.get('jd_legal_librito_v4'),originalClauses);
 assert.match(legalEditor.w.document.getElementById('legal').textContent,/Legales & aclaraciones Birkonim/);
 legalEditor.w.document.querySelector('[data-legal-edit="legal-birkonim"]').click();
 assert.equal(legalEditor.w.document.querySelectorAll('.jd-legal-editor textarea').length,2);
 legalEditor.w.document.getElementById('jdLegalBody0').value='Texto actualizado\nSegunda línea conservada';
 legalEditor.w.document.getElementById('jdLegalAdd').click();legalEditor.w.document.getElementById('jdLegalTitle2').value='Aclaración adicional';legalEditor.w.document.getElementById('jdLegalBody2').value='Texto adicional';
 assert.match(legalEditor.w.document.getElementById('jdLegalAdd').textContent,/Agregar ítem\/cláusula/);
 legalEditor.w.document.getElementById('jdLegalAdd').click();legalEditor.w.document.getElementById('jdLegalAdd').click();
 const originalSection=legalEditor.w.document.getElementById('jdLegalTitle1').parentElement;
 originalSection.querySelector('[data-legal-remove]').click();assert.equal(originalSection.isConnected,false);
 legalEditor.w.document.getElementById('jdLegalAdd').nextSibling.click();assert.equal(originalSection.isConnected,true);
 const unwanted=legalEditor.w.document.getElementById('jdLegalTitle3').parentElement;unwanted.querySelector('[data-legal-remove]').click();
 legalEditor.w.document.getElementById('jdLegalAdd').click();assert.equal(new Set([...legalEditor.w.document.querySelectorAll('.jd-legal-editor [id]')].map(n=>n.id)).size,legalEditor.w.document.querySelectorAll('.jd-legal-editor [id]').length,'removed items do not duplicate field IDs');
 legalEditor.w.document.getElementById('jdLegalTitle5').value='Cláusula incompleta';await legalEditor.w.document.getElementById('jdLegalSave').onclick();
 assert.match(legalEditor.w.document.getElementById('jdLegalMessage').textContent,/incompleta/);assert.equal(legalEditor.w.document.activeElement.id,'jdLegalBody5');assert.deepEqual(legalEditor.get('jd_legal_librito_v4'),originalClauses);
 legalEditor.w.document.getElementById('jdLegalTitle5').parentElement.querySelector('[data-legal-remove]').click();
 legalEditor.fail(true);await legalEditor.w.document.getElementById('jdLegalSave').onclick();
 assert.deepEqual(legalEditor.get('jd_legal_librito_v4'),originalClauses);
 assert.equal(legalEditor.w.document.getElementById('jdLegalBody0').value,'Texto actualizado\nSegunda línea conservada');
 legalEditor.fail(false);await legalEditor.w.document.getElementById('jdLegalSave').onclick();
 assert.equal(legalEditor.get('jd_legal_sets_v1')[0].clauses[0][1],'Texto actualizado\nSegunda línea conservada');
 assert.deepEqual(legalEditor.get('jd_legal_sets_v1')[0].clauses,legalEditor.get('jd_legal_librito_v4'));
 assert.equal(legalEditor.get('jd_legal_librito_v4').length,3,'blank added items are ignored when saving');
 assert.equal(legalEditor.get('jd_legal_sets_v1')[1].clauses[0][1],'Texto exclusivo de Luaj');
 legalEditor.w.renderQuote();assert.match(legalEditor.w.document.querySelector('.jd-full-legal').textContent,/Texto actualizado/);
 legalEditor.w.document.querySelector('[data-legal-edit="legal-birkonim"]').click();legalEditor.w.document.getElementById('jdLegalTitle1').parentElement.querySelector('[data-legal-remove]').click();
 legalEditor.fail(true);await legalEditor.w.document.getElementById('jdLegalSave').onclick();assert.equal(legalEditor.get('jd_legal_librito_v4').length,3);
 legalEditor.fail(false);await legalEditor.w.document.getElementById('jdLegalSave').onclick();assert.equal(legalEditor.get('jd_legal_librito_v4').length,2);assert.equal(legalEditor.get('jd_legal_librito_v4')[1][0],'Aclaración adicional');
 legalEditor.w.document.querySelector('[data-legal-edit="legal-birkonim"]').click();
 legalEditor.remote.find(r=>r.key==='jd_legal_sets_v1').value[0].clauses[0][1]='Cambio en otro dispositivo';
 await legalEditor.w.document.getElementById('jdLegalSave').onclick();
 assert.match(legalEditor.w.document.getElementById('jdLegalMessage').textContent,/otro dispositivo/);
 assert.equal(legalEditor.get('jd_legal_sets_v1')[0].clauses[0][1],'Cambio en otro dispositivo');
 legalEditor.close();console.log('complete legal document, multiline text, atomic retry, Luaj preservation, current PDF and conflict passed');
 {
 const altRows=fixture();const altCatalog=altRows.find(r=>r.key==='jd_catalog_v6').value[0];
 altCatalog.texts.push('Hebreo + español + fonética');altCatalog.variants.push({...structuredClone(altCatalog.variants[0]),id:'qa-three-languages',texts:'Hebreo + español + fonética',content:['Contenido trilingüe']});
 const multi=await boot(altRows);multi.w.document.getElementById('qClient').value='Cliente alternativas';multi.w.qs6=[50];multi.w.jdDrawQuoteQuantities();multi.w.renderQuote();
 const field=(id,value)=>{const el=multi.w.document.getElementById(id);el.value=value;el.dispatchEvent(new multi.w.Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));};
 field('qManualPrice-0','260000');field('qDiscount','10000');
 multi.w.document.getElementById('jdAddAlternative').click();assert.equal(multi.w.document.querySelectorAll('button[data-alternative]').length,2);
 field('qLang','Hebreo + español + fonética');field('qManualPrice-0','400000');field('qDiscount','20000');
 multi.w.document.querySelector('[data-alternative="0"]').click();assert.equal(multi.w.document.getElementById('qLang').value,'Hebreo solo');assert.equal(multi.w.document.getElementById('qManualPrice-0').value,'260000');
 multi.w.document.querySelector('button[data-alternative="1"]').click();assert.equal(multi.w.document.getElementById('qManualPrice-0').value,'400000');
 const grouped=await save(multi);assert.equal(grouped.alternatives.length,2);assert.deepEqual(Array.from(grouped.alternatives,a=>a.quantities[0].price),[250000,380000]);assert.equal(multi.get('jd_saved_quotes_v6').length,1);
 assert.equal(multi.w.document.querySelectorAll('#quotePreview>.jd-pdf-sheet').length,2);assert.match(multi.w.document.querySelectorAll('#quotePreview>.jd-pdf-sheet')[0].textContent,/Hebreo solo.*250\.000/);assert.match(multi.w.document.querySelectorAll('#quotePreview>.jd-pdf-sheet')[1].textContent,/Hebreo \+ español \+ fonética.*380\.000/);
 let pages=0;multi.w.jdVectorQuotePdf=async sheets=>{pages=sheets.length;for(const sheet of sheets)assert.doesNotMatch(sheet.textContent,/Ganancia bruta|Antes de impuestos/);return new multi.w.Blob(['native-pdf'])};multi.w.URL.createObjectURL=()=> 'blob:fixture';multi.w.URL.revokeObjectURL=()=>{};
 await multi.w.jdPreviewCurrentPDF();assert.equal(pages,2);multi.w.document.querySelectorAll('.jd-pdf-modal').forEach(n=>n.remove());
 multi.w.jdRenderSavedQuotes();multi.w.document.querySelector('[data-edit-qid]').click();assert.equal(multi.w.document.querySelectorAll('button[data-alternative]').length,2);assert.equal(multi.w.document.getElementById('qManualPrice-0').value,'260000');
 multi.w.document.querySelector('button[data-alternative="1"]').click();assert.equal(multi.w.document.getElementById('qLang').value,'Hebreo + español + fonética');assert.equal(multi.w.document.getElementById('qManualPrice-0').value,'400000');
 multi.fail(true);assert.equal(await save(multi),null);assert.equal(multi.get('jd_saved_quotes_v6')[0].alternatives.length,2);multi.fail(false);
 const groupEdit=await save(multi);assert.equal(groupEdit.id,grouped.id);assert.equal(groupEdit.revisions[0].snapshot.alternatives.length,2);
 multi.w.jdOpenOrder(groupEdit.id);const choose=multi.w.document.getElementById('jdOrderQty');assert.match(choose.options[1].textContent,/Alternativa 2.*Hebreo \+ español \+ fonética/);choose.value='1';choose.dispatchEvent(new multi.w.Event('change'));multi.w.document.getElementById('jdOrderPaid').value='100000';await multi.w.document.querySelector('.jd-crm-modal [data-save]').onclick();assert.equal(multi.get('jd_orders_v1')[0].quantity.price,380000);assert.equal(multi.get('jd_orders_v1')[0].selectedAlternative.texts,'Hebreo + español + fonética');
 multi.w.document.getElementById('jdRemoveAlternative').click();assert.equal(multi.w.jdCollectQuote().alternatives.length,0);const oneOption=await save(multi);assert.equal(oneOption.alternatives.length,0,'Removing an alternative is persisted on same-record edits');multi.w.document.getElementById('jdAddAlternative').click();assert.equal(multi.w.document.querySelectorAll('button[data-alternative]').length,2);
 multi.w.document.getElementById('jdNewQuoteBtn').click();assert.equal(multi.w.document.querySelectorAll('button[data-alternative]').length,1);assert.equal(multi.w.jdCollectQuote().alternatives,undefined);
 multi.close();console.log('multi-product alternatives, independent price/discount, two A4 pages, edit/history, failed save, accepted choice and reset passed');
 }
 {
 const rush=await boot();rush.w.document.getElementById('qClient').value='Cliente urgencia';rush.w.qs6=[100];rush.w.jdDrawQuoteQuantities();
 const box=rush.w.document.getElementById('qRush');const plain=rush.w.jdCollectQuote().quantities[0].price;box.checked=true;box.dispatchEvent(new rush.w.Event('change'));const urgent=rush.w.jdCollectQuote();assert.equal(urgent.rushPercent,30);assert.equal(urgent.quantities[0].price,plain*1.3);assert.ok(!rush.w.document.querySelector('.jd-pdf-price-breakdown').textContent.includes('Prioridad de agenda'));rush.w.document.getElementById('qRushShow').checked=true;rush.w.renderQuote();assert.match(rush.w.document.querySelector('.jd-pdf-price-breakdown').textContent,/Prioridad de agenda/);
 const saved=await save(rush);rush.w.jdRenderSavedQuotes();rush.w.document.querySelector('[data-edit-qid]').click();assert.equal(rush.w.document.getElementById('qRush').checked,true);assert.equal(rush.w.jdCollectQuote().quantities[0].price,saved.quantities[0].price,'editing must not compound rush');
 rush.w.document.getElementById('qRush').checked=false;rush.w.renderQuote();assert.equal(rush.w.jdCollectQuote().quantities[0].price,plain);rush.close();
 const auto=await boot();auto.w.fetch=async()=>({ok:true,json:async()=>({data:[['2026-06-01',150],['2026-07-01',150],['2026-08-01',165]]})});auto.w.go('costs');
 const card=auto.w.document.querySelector('[data-ce]');assert.ok(card.parentElement.classList.contains('jd-cost-option'));assert.equal(card.parentElement.querySelectorAll('button').length,2);
 auto.w.jdOpenInflation(auto.get('jd_cost_quotes_v2')[0]);await sleep(40);assert.equal(auto.w.document.getElementById('jdAdjustmentMethod').value,'auto');assert.equal(auto.w.document.querySelector('[data-apply]').disabled,false);assert.match(auto.w.document.querySelector('[data-result]').textContent,/2026-08/);await auto.w.document.querySelector('[data-apply]').onclick();await sleep(50);assert.equal(auto.get('jd_cost_quotes_v2')[0].cost,100000);assert.ok(math.effectiveCost(auto.get('jd_cost_quotes_v2')[0])>110000);assert.equal(auto.w.document.getElementById('jdAdjustmentMethod'),null);auto.close();
 const offline=await boot();offline.w.jdOpenInflation(offline.get('jd_cost_quotes_v2')[0]);await sleep(30);assert.equal(offline.w.document.querySelector('[data-apply]').disabled,true);assert.match(offline.w.document.querySelector('[data-result]').textContent,/fuente oficial/);assert.equal(offline.get('jd_cost_quotes_v2')[0].adjustment,undefined);offline.close();
 console.log('rush checkbox, saved edit without compounding, removal, per-cost buttons, automatic IPC, publication lag and offline safety passed');
 }
 const pricing=require('../assets/jd-price.js');
 assert.equal(pricing.calculate(100000,null,10000,30).price,120000);assert.equal(pricing.calculate(100000,200000,10000,30).price,250000);assert.equal(pricing.calculate(100000,null,10000,0).price,90000);
 assert.equal(pricing.calculate(116135/0.5+10000,'',0).price,245000,'El redondeo no reduce el margen objetivo');
 assert.equal(pricing.calculate(240000,'',0).price,240000,'Un múltiplo exacto no se incrementa');
 assert.deepEqual(pricing.calculate(211111,260000,50000),{basePrice:260000,rushAmount:0,calculatedPrice:215000,priceBeforeDiscount:260000,discountAmount:50000,price:210000,manualPrice:260000});
 assert.equal(pricing.calculate(210000,250123.45,20123.45).price,230000);
 assert.equal(pricing.calculate(210000,190000,1234).price,188766);
 assert.equal(pricing.calculate(211111,'',1234).price,213766);
 for(const args of [[210000,0,0],[210000,-1000,0],[210000,Infinity,0],[210000,NaN,0],[210000,260000,-0.001],[210000,260000,NaN],[210000,260000,260000]])assert.throws(()=>pricing.calculate(...args));
 const manual=await boot();manual.w.document.getElementById('qClient').value='Cliente precio negociado';manual.w.qs6=[50,100];manual.w.jdDrawQuoteQuantities();
 const setManual=(i,value)=>{const input=manual.w.document.getElementById('qManualPrice-'+i);input.value=value;input.dispatchEvent(new manual.w.Event('input',{bubbles:true}));};
 setManual(0,260000);setManual(1,400000);manual.w.document.getElementById('qDiscount').value=50000;manual.w.renderQuote();
 assert.match(manual.w.document.querySelector('.jd-client-price').textContent,/Precio antes del descuento:.*260\.000.*Descuento:.*50\.000.*Total:.*210\.000/);
 assert.doesNotMatch(manual.w.document.getElementById('quotePreview').textContent,/Cálculo sugerido|Ganancia bruta|precio manual/);
 let capturedPrice=false;manual.w.jdVectorQuotePdf=async sheets=>{assert.match(sheets[0].querySelector('.jd-client-price').textContent,/260\.000.*50\.000.*210\.000/);assert.equal(sheets[0].querySelectorAll('.jd-client-price').length,2);capturedPrice=true;return new manual.w.Blob(['native-pdf'])};manual.w.URL.createObjectURL=()=> 'blob:fixture';manual.w.URL.revokeObjectURL=()=>{};
 await manual.w.jdPreviewCurrentPDF();assert.ok(capturedPrice);manual.w.document.querySelectorAll('.jd-pdf-modal').forEach(node=>node.remove());
 const negotiated=await save(manual);assert.deepEqual(Array.from(negotiated.quantities,q=>q.price),[210000,350000]);assert.deepEqual(Array.from(negotiated.quantities,q=>q.priceBeforeDiscount),[260000,400000]);assert.deepEqual(Array.from(negotiated.quantities,q=>q.discountAmount),[50000,50000]);assert.equal(negotiated.quantities[0].profit,100000);assert.equal(manual.get('jd_cost_quotes_v2')[0].cost,100000);
 manual.w.jdRenderSavedQuotes();manual.w.document.querySelector('[data-edit-qid]').click();assert.equal(manual.w.document.getElementById('qManualPrice-0').value,'260000');assert.equal(manual.w.document.getElementById('qDiscount').value,'50000');
 manual.w.document.getElementById('qDiscount').value=60000;const revised=await save(manual);assert.equal(revised.quantities[0].price,200000);assert.equal(revised.revisions[0].snapshot.quantities[0].price,210000);assert.equal(revised.revisions[0].snapshot.quantities[0].priceBeforeDiscount,260000);
 manual.w.document.querySelector('[data-price-reset="0"]').click();assert.equal(manual.w.document.getElementById('qManualPrice-0').value,'');assert.equal(manual.w.jdCollectQuote().quantities[0].price,150000);
 setManual(0,190000);assert.equal(manual.w.jdCollectQuote().quantities[0].price,130000);
 manual.w.document.getElementById('qNusaj').dispatchEvent(new manual.w.Event('change',{bubbles:true}));assert.equal(manual.w.document.getElementById('qManualPrice-0').value,'');
 manual.w.jdRenderSavedQuotes();manual.w.document.querySelector('[data-open-qid]').click();assert.equal(manual.w.document.getElementById('qManualPrice-0').value,'');manual.close();
 console.log('manual increase/decrease, exact discount, customer PDF breakdown, persistence, revision and automatic reset passed');
 assert.equal(math.adjustedAmount(100000,8.5),108500);
 assert.equal(math.adjustedAmount(100000,0),100000);
 assert.ok(Math.abs(math.indexPercent(150,165)-10)<1e-10);
 for(const args of [[100000,-1],[0,10],[100000,Infinity]])assert.throws(()=>math.adjustedAmount(...args));
 assert.throws(()=>math.indexPercent(0,10));assert.throws(()=>math.indexPercent(150,140));
 assert.equal(math.validDate('2026-02-30'),false);assert.equal(math.validDate('2026-02-28'),true);
 assert.equal(math.ipcEstimate([['2026-06-01',150],['2026-07-01',150],['2026-08-01',165]],'2026-07-10','2026-10-08').endMonth,'2026-08');assert.ok(math.ipcEstimate([['2026-06-01',150],['2026-07-01',150],['2026-08-01',165]],'2026-08-25','2026-10-08').percent>0);assert.equal(math.ipcEstimate([['2026-06-01',150],['2026-07-01',150],['2026-08-01',165]],'2026-08-25','2026-10-08').days,44);assert.throws(()=>math.ipcEstimate([['2026-08-01',165]],'2026-09-01','2026-10-08'));
 console.log('inflation math and invalid values passed');
 const editRows=fixture();editRows.find(r=>r.key==='jd_saved_quotes_v6').value=[{id:'edit-original',client:'Ána Prueba',product:product.name,productId:product.id,model:'Classic',nusaj:'Solo Ashkenazí',texts:'Hebreo solo',size:product.sizes[0],binding:'Abrochado',pages:24,created:'2026-09-01T12:00:00Z',status:'Presupuesto enviado',pdfUrl:'https://example.test/original.pdf',sentConfirmedAt:'2026-09-02T12:00:00Z',quantities:[{qty:50,price:210000,cost:100000},{qty:100,price:370000,cost:180000}]}];
 editRows.find(r=>r.key==='jd_clients').value[0].phone='5491100000000';
 editRows.push({key:'jd_orders_v1',value:[{id:'accepted-order',quoteId:'edit-original',quantity:{qty:100,price:370000},paid:100000,balance:270000}]});
 const editor=await boot(editRows,{ok:true,status:200});editor.w.jdRenderSavedQuotes();editor.w.document.querySelector('[data-edit-qid]').click();
 assert.equal(editor.w.document.getElementById('sq6').textContent,'Guardar cambios');editor.w.qs6=[75];editor.w.renderQuote();
 editor.fail(true);await save(editor);assert.deepEqual(editor.get('jd_saved_quotes_v6')[0].quantities.map(q=>q.qty),[50,100]);assert.ok(editor.w.jdQuoteEdit);
 editor.fail(false);const edited=await save(editor);assert.equal(editor.get('jd_saved_quotes_v6').length,1);assert.equal(edited.id,'edit-original');assert.equal(edited.created,'2026-09-01T12:00:00Z');assert.deepEqual(Array.from(edited.quantities,q=>q.qty),[75]);assert.equal(edited.quantities[0].price,310000);assert.equal(edited.revisions.length,1);assert.equal(edited.revisions[0].snapshot.pdfUrl,'https://example.test/original.pdf');assert.deepEqual(Array.from(edited.revisions[0].snapshot.quantities,q=>q.qty),[50,100]);assert.equal(edited.pdfUrl,undefined);assert.equal(edited.sentConfirmedAt,undefined);
 editor.w.document.querySelector('[data-quote-history]').click();assert.match(editor.w.document.querySelector('.jd-crm-modal').textContent,/Versión 2/);assert.ok(editor.w.document.querySelector('.jd-crm-modal a[href="https://example.test/original.pdf"]'));editor.w.document.querySelector('.jd-crm-modal [data-close]').click();
 const uploadPaths=[],rawFetch=editor.w.fetch;editor.w.fetch=async(input,init)=>{if(String(input).includes('/storage/v1/object/jd-quotes/'))uploadPaths.push(String(input));return rawFetch(input,init)};
 editor.w.open=()=>({location:'',close(){}});editor.w.html2canvas=async()=>({width:794,height:1000,toDataURL:()=> 'data:image/jpeg;base64,AA=='});editor.w.jspdf={jsPDF:class{addImage(){}output(){return new editor.w.Blob(['fixture'])}}};
 await editor.w.jdSendCurrentQuoteWhatsApp();await sleep(100);await editor.w.jdSendCurrentQuoteWhatsApp();await sleep(100);
 assert.equal(editor.get('jd_saved_quotes_v6').length,1);assert.equal(editor.get('jd_saved_quotes_v6')[0].id,'edit-original');assert.equal(editor.get('jd_saved_quotes_v6')[0].status,'Preparado para compartir');assert.equal(editor.get('jd_saved_quotes_v6')[0].revisions[0].snapshot.pdfUrl,'https://example.test/original.pdf');assert.equal(uploadPaths.length,2);assert.notEqual(uploadPaths[0],uploadPaths[1]);assert.equal(editor.get('jd_orders_v1')[0].quantity.price,370000);assert.equal(editor.get('jd_orders_v1')[0].quantity.qty,100);
 const revisionCount=editor.get('jd_saved_quotes_v6')[0].revisions.length;
 editor.get('jd_saved_quotes_v6')[0].internal='Cambio de otro dispositivo';await save(editor);assert.equal(editor.get('jd_saved_quotes_v6').length,1);assert.equal(editor.get('jd_saved_quotes_v6')[0].revisions.length,revisionCount);assert.match(editor.alerts.at(-1),/otro dispositivo/);editor.close();
 const helpers=require('../assets/jd-quote-edit.js');const signedA={pdfUrl:'https://athiruoimehofqzrplnl.supabase.co/storage/v1/object/sign/jd-quotes/q.pdf?token=old'};const signedB={pdfUrl:signedA.pdfUrl.replace('old','new')};assert.equal(helpers.fingerprint(signedA),helpers.fingerprint(signedB));
 console.log('edit 50/100 to 75, same ID, history/PDF preservation, network retry and conflict passed');
 const concurrent=await boot();concurrent.w.document.getElementById('qClient').value='Cliente simultáneo';concurrent.race('jd_saved_quotes_v6');await save(concurrent);
 assert.equal(concurrent.get('jd_saved_quotes_v6').length,1);assert.equal(concurrent.get('jd_saved_quotes_v6')[0].id,'racing-device');assert.equal(concurrent.get('jd_clients').length,1);assert.match(concurrent.alerts.at(-1),/otro dispositivo/);concurrent.close();
 console.log('race between read and commit rejects entire quote/client batch passed');
 const shareRows=fixture();shareRows.find(r=>r.key==='jd_clients').value[0].phone='5491100000000';
 const share=await boot(shareRows,{ok:true,status:200});share.w.document.getElementById('qClient').value='Ána Prueba';
 const draft={location:'',close(){}};share.w.open=href=>{draft.location=href;return draft};let downloads=0;share.w.HTMLAnchorElement.prototype.click=function(){downloads++};
 share.w.html2canvas=async()=>({width:794,height:1000,toDataURL:()=> 'data:image/jpeg;base64,AA=='});
 share.w.jspdf={jsPDF:class{addImage(){}output(){return new share.w.Blob(['fixture'])}}};
 await share.w.jdSendCurrentQuoteWhatsApp();await sleep(100);
 assert.equal(draft.location,'','preparing the file does not launch a draft');share.w.document.querySelector('[data-wa-file]').click();assert.equal(downloads,1);assert.match(draft.location,/^https:\/\/wa.me\//);assert.doesNotMatch(decodeURIComponent(draft.location.split('?text=')[1]),/https?:|supabase|token=/);assert.equal(share.get('jd_saved_quotes_v6')[0].status,'Preparado para compartir');
 assert.ok(share.get('jd_saved_quotes_v6')[0].pdfSnapshot);assert.notEqual(share.get('jd_clients')[0].status,'Presupuesto enviado');
 share.w.jdRenderSavedQuotes();await sleep(30);await share.w.document.querySelector('[data-confirm-sent]').onclick();
 assert.equal(share.get('jd_saved_quotes_v6')[0].status,'Presupuesto enviado');assert.ok(share.get('jd_saved_quotes_v6')[0].sentConfirmedAt);
 let payload;Object.defineProperty(share.w.navigator,'canShare',{configurable:true,value:data=>data.files[0].type==='application/pdf'});Object.defineProperty(share.w.navigator,'share',{configurable:true,value:async data=>{payload=data}});await share.w.jdSendCurrentQuoteWhatsApp();assert.ok(!payload,'sharing awaits a fresh user click');await share.w.document.querySelector('[data-share-file]').onclick();assert.equal(payload.files[0].type,'application/pdf');assert.match(payload.files[0].name,/Ána Prueba.*pdf$/);assert.ok(payload.files[0].size>0);assert.equal(payload.url,undefined);assert.doesNotMatch(payload.text,/https?:|supabase|token=/);assert.equal(share.get('jd_saved_quotes_v6')[0].status,'Preparado para compartir');share.w.navigator.share=async()=>{throw Object.assign(new Error('cancelled'),{name:'AbortError'})};await share.w.document.querySelector('[data-share-file]').onclick();assert.equal(share.w.document.querySelector('[data-share-file]').disabled,false);
 share.close();console.log('WhatsApp draft is not sent, PDF snapshot and explicit sent confirmation passed');
 const orgApp=await boot();orgApp.w.jdRenderClients();orgApp.w.document.getElementById('jdNewClient').click();
 orgApp.w.document.getElementById('crmOrg').value='Institución sin contacto';await orgApp.w.document.querySelector('.jd-crm-modal [data-save]').onclick();
 const institution=orgApp.get('jd_clients').find(c=>c.org==='Institución sin contacto');assert.ok(institution);assert.equal(institution.firstName,'');assert.equal(institution.lastName,'');
 orgApp.w.document.getElementById('qClient').value=institution.name;await save(orgApp);assert.equal(orgApp.get('jd_clients').find(c=>c.id===institution.id).firstName,'');orgApp.close();console.log('institution without person names remains distinct passed');
 await invalid('empty client',a=>a.w.document.getElementById('qClient').value='',/Falta el nombre/);
 await invalid('empty quantities',a=>a.w.qs6=[],/cantidades/);
 await invalid('negative quantity',a=>a.w.qs6=[-50],/cantidades/);
 await invalid('fractional quantity',a=>a.w.qs6=[50.5],/cantidades/);
 await invalid('duplicate quantities',a=>a.w.qs6=[50,50],/cantidades/);
 await invalid('below minimum cost quantity',a=>a.w.qs6=[25],/Falta costo/);
 await invalid('negative discount',a=>a.w.document.getElementById('qDiscount').value=-1000,/descuento/);
 await invalid('discount exceeds total',a=>a.w.document.getElementById('qDiscount').value=99999999,/descuento/);
 await invalid('zero manual price',a=>a.w.jdManualPrices={60:'0'},/precio manual/);
 await invalid('negative manual price',a=>a.w.jdManualPrices={60:'-1000'},/precio manual/);
 await invalid('manual price cannot bypass missing cost',a=>{a.w.qs6=[25];a.w.jdManualPrices={25:'300000'}},/Falta costo/);
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
 assert.deepEqual(quote.quantities.map(x=>x.profit),[90000,140000,170000,320000]);
 assert.equal(quote.quantities[0].shipping,10000);
 assert.equal(quote.quantities[0].marginPct,45);
 app.w.jdRenderSavedQuotes();
 const search=app.w.document.getElementById('jdQuoteSearch');search.value='otro cliente';search.oninput();
 assert.equal(app.w.document.querySelectorAll('.jd-savedquotes-table tbody tr:not([hidden])').length,1);
 search.value='';search.oninput();
 app.w.document.querySelector('[data-open-qid]').click();
 assert.equal(app.w.document.getElementById('qDiscount').value,'10000');
 assert.equal(app.w.document.getElementById('qInternal').value,'Nota interna de prueba');
 console.log('multi-quantity, discount, retry, double click, existing client and concurrent remote quote passed');
 // Rich client fields survive retries, other-device additions and a quote save.
 app.w.jdRenderClients();app.w.document.querySelector('[data-open="0"]').click();
 const field=(id,value)=>app.w.document.getElementById(id).value=value;
 field('crmEmail','cliente@example.test');field('crmAddress','Calle de prueba 123, piso 2');field('crmCity','CABA');field('crmPostal','C1000');field('crmCountry','Argentina');field('crmRecipient','Recepción de prueba');field('crmNotes','Datos ficticios');
 app.get('jd_clients').push({id:'remote-new-client',name:'Cliente de otro dispositivo',status:'Consulta recibida'});
 app.fail(true);await app.w.document.querySelector('.jd-crm-modal [data-save]').onclick();
 assert.ok(app.w.document.getElementById('crmEmail'),'failed write must keep form open');
 assert.equal(app.get('jd_clients')[0].email,undefined);
 app.fail(false);await app.w.document.querySelector('.jd-crm-modal [data-save]').onclick();
 assert.equal(app.get('jd_clients')[0].address,'Calle de prueba 123, piso 2');
 assert.equal(app.get('jd_clients')[0].email,'cliente@example.test');assert.equal(app.get('jd_clients').length,2);
 await save(app);assert.equal(app.get('jd_clients')[0].address,'Calle de prueba 123, piso 2');
 // A concurrent edit to the same client is rejected instead of overwriting it.
 app.w.jdRenderClients();app.w.document.querySelector('[data-open="0"]').click();field('crmNotes','Cambio local');
 app.get('jd_clients')[0].notes='Cambio remoto';
 await app.w.document.querySelector('.jd-crm-modal [data-save]').onclick();
 assert.equal(app.get('jd_clients')[0].notes,'Cambio remoto');assert.match(app.alerts.at(-1),/otro dispositivo/);
 app.w.document.querySelector('.jd-crm-modal [data-cancel]').click();
 console.log('client address, email, retry, remote addition and same-client conflict passed');
 // Export the complete semantic sheet to the vector renderer, without a capture clone.
 let rendered=0;app.w.jdVectorQuotePdf=async sheets=>{assert.equal(sheets.length,1);assert.ok(sheets[0].querySelector('.jd-pdf-logo'));assert.ok(!app.w.document.getElementById('jdPdfCapture'));rendered++;return new app.w.Blob(['native-pdf'])};
 app.w.URL.createObjectURL=()=> 'blob:fixture';app.w.URL.revokeObjectURL=()=>{};
 await app.w.jdPreviewCurrentPDF();assert.equal(rendered,1);
app.w.document.querySelectorAll('.jd-pdf-modal').forEach(node=>node.remove());
 app.w.jdNativeQuote.version='obsolete';await app.w.jdPreviewCurrentPDF();assert.equal(rendered,1);assert.match(app.alerts.at(-1),/desactualizada/);app.w.jdNativeQuote.version='20261008-master-v9';
 console.log('complete semantic A4 sheet reaches native renderer without raster capture passed');
 app.w.jdOpenOrder(quote.id);
 field('jdOrderQty','2');field('jdOrderPaid','99999999');
 await app.w.document.querySelector('.jd-crm-modal [data-save]').onclick();assert.equal(app.get('jd_orders_v1'),undefined);assert.match(app.alerts.at(-1),/total del pedido/);
 field('jdOrderPaid','100000');field('jdOrderStage','Diseño');
 app.fail(true);await app.w.document.querySelector('.jd-crm-modal [data-save]').onclick();assert.equal(app.get('jd_orders_v1'),undefined);assert.ok(app.w.document.getElementById('jdOrderPaid'));
 app.fail(false);await app.w.document.querySelector('.jd-crm-modal [data-save]').onclick();
 const order=app.get('jd_orders_v1')[0];assert.equal(order.quantity.qty,100);assert.equal(order.quantity.price,360000);assert.equal(order.quantity.profit,170000);assert.equal(order.paid,100000);assert.equal(order.balance,260000);assert.equal(order.stage,'Diseño');
 assert.equal(order.address,'Recepción de prueba · Calle de prueba 123, piso 2 · CABA · C1000 · Argentina');
 app.w.jdOpenOrder(quote.id);assert.ok(app.w.document.getElementById('jdOrderQty').disabled);field('jdOrderPaid','360000');field('jdOrderStage','Entregado');
 await app.w.document.querySelector('.jd-crm-modal [data-save]').onclick();assert.equal(app.get('jd_orders_v1').length,1);assert.equal(app.get('jd_orders_v1')[0].balance,0);assert.equal(app.get('jd_orders_v1')[0].history.length,2);
 console.log('accepted quantity, deposit, balance, delivery, frozen price and order retry passed');
 app.expire(true);await save(app);assert.equal(app.get('jd_saved_quotes_v6').length,3);assert.match(app.alerts.at(-1),/sesión/);app.expire(false);
 console.log('expired session passed');
 const originalCost=structuredClone(app.get('jd_cost_quotes_v2')[0]);
 app.w.jdOpenInflation(originalCost);
 app.w.document.getElementById('jdAdjustmentMethod').value='manual';
 const input=app.w.document.getElementById('jdAdjustmentPercent');input.value='8,5';input.dispatchEvent(new app.w.Event('input',{bubbles:true}));
 app.fail(true);await app.w.document.querySelector('[data-apply]').onclick();await sleep(30);
 assert.equal(app.get('jd_cost_quotes_v2')[0].adjustment,undefined,'failure must keep original cost');
 app.fail(false);await app.w.document.querySelector('[data-apply]').onclick();await sleep(30);
 const estimated=app.get('jd_cost_quotes_v2')[0];
 assert.equal(estimated.cost,100000);assert.equal(estimated.date,'2026-07-01');assert.equal(math.effectiveCost(estimated),108500);
 assert.equal(app.get('jd_saved_quotes_v6')[0].quantities[0].price,200000,'existing quote must keep agreed price');
 app.w.jdOpenInflation(estimated);
 app.w.document.getElementById('jdAdjustmentMethod').value='manual';
 const percent=app.w.document.getElementById('jdAdjustmentPercent');percent.value='20';percent.dispatchEvent(new app.w.Event('input',{bubbles:true}));
 await app.w.document.querySelector('[data-apply]').onclick();await sleep(30);
 assert.equal(math.effectiveCost(app.get('jd_cost_quotes_v2')[0]),120000,'repeated adjustment must start from original, not compound twice');
 app.w.jdOpenInflation(app.get('jd_cost_quotes_v2')[0]);await app.w.document.querySelector('[data-reset]').onclick();await sleep(30);
 assert.equal(math.effectiveCost(app.get('jd_cost_quotes_v2')[0]),100000);
 app.w.fetch=async()=>({ok:true,json:async()=>({data:[['2026-06-01',150],['2026-07-01',150],['2026-08-01',165]]})});
 app.w.jdOpenInflation(app.get('jd_cost_quotes_v2')[0]);
 app.w.document.getElementById('jdAdjustmentMethod').dispatchEvent(new app.w.Event('change',{bubbles:true}));await sleep(40);
 assert.equal(app.w.document.getElementById('jdAdjustmentBase').value,'2026-07-01');assert.equal(app.w.document.getElementById('jdAdjustmentBase').readOnly,true);assert.equal(app.w.document.getElementById('jdAdjustmentMethod').options.length,2);assert.equal(app.w.document.querySelector('[data-apply]').disabled,false);
 await app.w.document.querySelector('[data-apply]').onclick();await sleep(30);
 assert.ok(math.effectiveCost(app.get('jd_cost_quotes_v2')[0])>110000);
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

