import assert from 'node:assert/strict';
import {buildDraft} from '../supabase/functions/_shared/whatsapp-draft.mjs';
const request={productId:'birkon-folleto',format:'Cuadríptico',quantities:[50,100],models:1};
const technical={paper:'Papel ilustración',weightGsm:300,lamination:'Laminado mate',sides:'Doble faz',print:'Full color',openWidthMm:391,openHeightMm:190,closedWidthMm:100,closedHeightMm:190};
const catalog=[{id:request.productId,name:'Birkón · Folleto',status:'Activo',supplier:'Gráfica B612',models:['Cuadríptico'],technical,variants:[{model:'Cuadríptico',technical:{}},{model:'Cuadríptico',technical:{}}]}];
let extracted=structuredClone(request),calls=0;
const now=Date.now(),message={message_id:'fixture',sender_wa_id:'5491155512345',message_timestamp:Math.floor(now/1000),message_type:'text',body_text:'Quiero 50 o 100 cuadrípticos de birkon, un diseño.'};
const args={message,approver:'54111555512345',catalog,settings:{markupPct:26,netRoundStep:500,finalRoundStep:100},now,extract:async()=>({request:extracted,usage:{input_tokens:2000,output_tokens:300}}),quoteB612:async payload=>{calls++;assert.equal(payload.paper,'Papel ilustración');assert.equal(payload.openWidthMm,391);return {status:200,body:{ok:true,live:true,supplier:'Gráfica B612',requestedQty:payload.qty,models:payload.models,net:98325,sourceUrl:'https://www.graficab612.com/cotizador-postales-con-doblez.htm',fetchedAt:new Date(now).toISOString()}};}};
const draft=await buildDraft(args);assert.equal(draft.to,'54111555512345');assert.equal(calls,2);assert.equal(draft.prices[0].pricing.price,124200);assert.equal(draft.prices[0].pricing.shipping,0);assert.match(draft.body,/BORRADOR PARA TU APROBACIÓN/);assert.match(draft.body,/124.200/);assert.equal(draft.state,'draft');
await assert.rejects(()=>buildDraft({...args,message:{...message,sender_wa_id:'541199999999'}}),/persona aprobadora/);assert.equal(calls,2);
await assert.rejects(()=>buildDraft({...args,message:{...message,message_timestamp:message.message_timestamp-86401}}),/ventana/);
for(const invalid of [{quantities:[51]},{quantities:[50,50]},{models:null},{paper:'obra'},{lamination:'brillante'},{print:'blanco y negro'},{openWidthMm:-1},{productId:'inventado'}]){extracted={...request,...invalid};await assert.rejects(()=>buildDraft(args));}
extracted=structuredClone(request);
await assert.rejects(()=>buildDraft({...args,quoteB612:async()=>({status:200,body:{ok:true,live:false}})}),/en vivo/);
const changed=await buildDraft({...args,settings:{markupPct:30,netRoundStep:1000,finalRoundStep:500}});assert.equal(changed.prices[0].pricing.price,129000);assert.equal(draft.prices[0].pricing.price,124200,'Previous snapshot remains unchanged');
const ambiguous=structuredClone(catalog);ambiguous[0].variants[1].technical.openWidthMm=400;await assert.rejects(()=>buildDraft({...args,catalog:ambiguous}),/medidas/);
console.log('PASS draft preparation: real catalog specifications, final 124200, no shipping, approver only, 24h window, ambiguous/unsupported specifications require review. Mock AI and supplier; no sends.');
