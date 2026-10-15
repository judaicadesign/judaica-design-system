const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {stripTypeScriptTypes}=require('node:module');
const root=path.resolve(__dirname,'..');
// Public B612 API responses captured 2026-10-11; no account, customer or order data.
const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/b612-quadriptico-api.json'),'utf8'));
const source=stripTypeScriptTypes(fs.readFileSync(root+'/supabase/functions/b612-quote/index.ts','utf8').replace(/^import .*;$/gm,''));
function boot({mutate=()=>{},denied=false,fail=false}={}){
 let handler;const calls=[],data=structuredClone(fixture);mutate(data);
 vm.runInNewContext(source,{Request,Response,URL,AbortSignal,Deno:{serve:f=>handler=f,env:{get:k=>k==='SUPABASE_URL'?'https://auth.test':'fixture-only'}},fetch:async(url)=>{
   calls.push(url);
   if(url.startsWith('https://auth.test/auth/'))return new Response(JSON.stringify({email:'qa@example.test',email_confirmed_at:'2026-01-01',is_anonymous:false}));
   if(url.startsWith('https://auth.test/rest/'))return new Response(JSON.stringify(denied?[]:[{email:'qa@example.test'}]));
   if(fail)return new Response('',{status:503});
   const key=url.replace('https://www.graficab612.com','');assert.ok(Object.hasOwn(data,key),'Unexpected B612 call '+key);
   return new Response(JSON.stringify(data[key]));
 }});
 return {calls,quote:async(payload,authenticated=true)=>{
   const response=await handler(new Request('https://local.test',{method:'POST',headers:authenticated?{authorization:'Bearer fixture-only'}:{},body:JSON.stringify(payload)}));
   return {status:response.status,data:await response.json()};
 }};
}
(async()=>{
 const nets={50:136292.96,75:185568.71,100:221233.96,150:318320.96};
 for(const qty of [50,75,100,150])for(const models of [1,2]){
   const result=await boot().quote({format:'Cuadríptico',qty,models});assert.equal(result.status,200);const d=result.data;
   assert.equal(d.net,Math.round((nets[qty]+(models-1)*5950)*100)/100);assert.equal(d.models,models);assert.equal(d.productionQty,qty);assert.equal(d.sheet.postures,1);assert.equal(d.folds,3);
   const line=code=>d.lines.filter(l=>l.code===code);assert.equal(line('DOBX3').length,1);assert.equal(line('DOBX3')[0].quantity,qty);assert.equal(line('D1').length,1);assert.equal(line('C2').length,1);
   assert.equal(line('VARIANTE-POSTALES').length,models-1);assert.equal(line('CORTE-FC300-SA3DF').length,1);assert.equal(line('CORTE-FC300-SA3SF').length,0);assert.equal(line('DOBX2').length,0);
 }
 // Simulated extra price tiers verify quantity routing; these are not supplier quotes.
 for(const qty of [200,300]){
  const variable=boot({mutate:data=>{for(const [key,value] of Object.entries({...data}))if(/\/precio\/150$/.test(key))data[key.replace(/150$/,String(qty))]=structuredClone(value);}});
  const result=await variable.quote({format:'Cuadríptico',qty,models:1});assert.equal(result.status,200);assert.equal(result.data.requestedQty,qty);assert.equal(result.data.productionQty,qty);assert.equal(result.data.lines.find(l=>l.code==='DOBX3').quantity,qty);assert.ok(variable.calls.some(p=>p.endsWith('/precio/'+qty)));
 }
 const reference=(await boot().quote({format:'Cuadríptico',qty:50,models:2})).data;
 assert.equal(reference.net,142242.96,'B612 PDF 1291996 exact net');assert.equal(reference.gross,172113.98,'B612 PDF 1291996 exact VAT total');
 const unauth=boot();assert.equal((await unauth.quote({format:'Cuadríptico',qty:50},false)).status,401);assert.equal(unauth.calls.length,0);
 assert.equal((await boot({denied:true}).quote({format:'Cuadríptico',qty:50})).status,403);
 for(const payload of [{format:'Cuadríptico',qty:0},{format:'Cuadríptico',qty:40001},{format:'Cuadríptico',qty:150.5},{format:'Tríptico',qty:200,paper:'Papel obra',weightGsm:120,print:'Blanco y negro'},{format:'Postal',qty:50},{format:'Cuadríptico',qty:50,models:0},{format:'Cuadríptico',qty:50,models:1.5},{format:'Cuadríptico',qty:50,openWidthMm:0}])assert.equal((await boot().quote(payload)).status,422);
 const missing=boot({mutate:data=>{data['/api/cotizador/etapa/105/6']=data['/api/cotizador/etapa/105/6'].filter(x=>x.articulo.codigoInterno!=='DOBX3')}});
 const failure=await missing.quote({format:'Cuadríptico',qty:50});assert.equal(failure.status,502);assert.match(failure.data.error,/Doblado x 3/);
 assert.equal((await boot({fail:true}).quote({format:'Cuadríptico',qty:50})).status,502);
 assert.equal((await boot({mutate:d=>d['/api/cotizador/get?idCategoria=105'][0].id=999}).quote({format:'Cuadríptico',qty:50})).status,502);
 console.log('PASS B612: exact PDF 1291996, all four quantities, model surcharge, double-sided paper, three folds and fail-closed auth/provider errors');
})().catch(e=>{console.error(e);process.exit(1)});
