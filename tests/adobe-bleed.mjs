import assert from 'node:assert/strict';
import {expandBleedImage} from '../supabase/functions/_shared/adobe-bleed.mjs';
function png(w,h){const p=new Uint8Array(24);p.set([137,80,78,71,13,10,26,10]);const v=new DataView(p.buffer);v.setUint32(16,w);v.setUint32(20,h);return p;}
const input={png:png(100,200),width:120,height:220,insetPixels:10},credentials={clientId:'test-client',clientSecret:'test-secret'},calls=[];
const json=x=>new Response(JSON.stringify(x),{headers:{'content-type':'application/json'}});
const responses=[json({access_token:'private-token'}),json({images:[{id:'upload'}]}),json({statusUrl:'https://firefly-api.adobe.io/v3/status/job'}),json({status:'running'}),json({status:'succeeded',result:{outputs:[{image:{url:'https://pre-signed-firefly-prod.s3-accelerate.amazonaws.com/image'}}]}}),new Response(png(120,220),{headers:{'content-type':'image/png'}})];
const result=await expandBleedImage(input,{...credentials,fetcher:async(url,options)=>{calls.push({url,options});return responses.shift();},delay:async()=>{}});assert.equal(result.format,'png');assert.equal(result.width,120);assert.equal(calls.at(-1).options.headers,undefined);assert(!JSON.stringify(result).includes('test-secret'));assert.deepEqual(JSON.parse(calls[2].options.body).placement,{alignment:{horizontal:'center',vertical:'center'}});
await assert.rejects(()=>expandBleedImage(input,{}),/credenciales/);await assert.rejects(()=>expandBleedImage({...input,width:10000},credentials),/dimensiones/);
const malicious=[json({access_token:'private-token'}),json({images:[{id:'upload'}]}),json({statusUrl:'https://example.com/steal'})];await assert.rejects(()=>expandBleedImage(input,{...credentials,fetcher:async()=>malicious.shift()}),/estado no válido/);
console.log('PASS Adobe server adapter: credential gate, PNG dimensions, centered expansion, async polling, result recovery and no credential leakage to image host. Live Adobe entitlement remains unverified.');
