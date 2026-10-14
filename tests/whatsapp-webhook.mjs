import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createHandler} from '../supabase/functions/whatsapp-webhook/handler.mjs';
const config={JD_META_APP_SECRET:'fixture-only-secret',JD_WA_VERIFY_TOKEN:'fixture-only-verification',JD_WA_WABA_ID:'1103365929264394',JD_WA_PHONE_NUMBER_ID:'1341871429015169'};
let writes=[],fail=false;
const handler=createHandler({env:name=>config[name],crypto:webcrypto,persist:async rows=>{if(fail)throw new Error('offline');writes.push(rows);}});
const event={object:'whatsapp_business_account',entry:[{id:config.JD_WA_WABA_ID,changes:[{field:'messages',value:{metadata:{phone_number_id:config.JD_WA_PHONE_NUMBER_ID},messages:[{id:'wamid.fixture',from:'5491100000000',timestamp:'1791966000',type:'text',text:{body:'Quiero 100 trípticos'}}]}}]}]};
async function sign(body){const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(config.JD_META_APP_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign']);return 'sha256='+Buffer.from(await webcrypto.subtle.sign('HMAC',key,new TextEncoder().encode(body))).toString('hex');}
async function post(payload=event,options={}){const body=typeof payload==='string'?payload:JSON.stringify(payload);return handler(new Request('https://callback.test/',{method:'POST',body,headers:{'x-hub-signature-256':options.signature??await sign(body),...options.headers}}));}
let response=await handler(new Request('https://callback.test/?hub.mode=subscribe&hub.verify_token=fixture-only-verification&hub.challenge=12345'));assert.equal(response.status,200);assert.equal(await response.text(),'12345');
assert.equal((await handler(new Request('https://callback.test/?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345'))).status,403);
assert.equal((await post(event,{signature:''})).status,401);assert.equal(writes.length,0);
assert.equal((await post(event,{signature:'sha256='+'0'.repeat(64)})).status,401);assert.equal(writes.length,0);
assert.equal((await post(JSON.stringify(event)+' ',{signature:await sign(JSON.stringify(event))})).status,401);
assert.equal((await post()).status,200);assert.equal(writes.length,1);assert.equal(writes[0][0].body_text,'Quiero 100 trípticos');assert.equal(writes[0][0].state,'received');
const duplicate=structuredClone(event);duplicate.entry[0].changes[0].value.messages.push(duplicate.entry[0].changes[0].value.messages[0]);await post(duplicate);assert.equal(writes.at(-1).length,1);
const status=structuredClone(event);delete status.entry[0].changes[0].value.messages;status.entry[0].changes[0].value.statuses=[{id:'wamid.fixture',status:'delivered'}];const before=writes.length;assert.equal((await post(status)).status,200);assert.equal(writes.length,before);
const other=structuredClone(event);other.entry[0].id='other';assert.equal((await post(other)).status,403);assert.equal(writes.length,before);
other.entry[0].id=config.JD_WA_WABA_ID;other.entry[0].changes[0].value.metadata.phone_number_id='other';assert.equal((await post(other)).status,403);
const audio=structuredClone(event);audio.entry[0].changes[0].value.messages[0].type='audio';assert.equal((await post(audio)).status,200);assert.equal(writes.at(-1)[0].state,'needs_review');assert.equal(writes.at(-1)[0].body_text,null);
assert.equal((await post('{')).status,400);assert.equal((await post(event,{headers:{'content-length':'300000'}})).status,413);
assert.equal((await post('x'.repeat(300000))).status,413);
fail=true;assert.equal((await post()).status,503);fail=false;
const missing=createHandler({env:()=>undefined,persist:()=>{throw new Error('must not run');}});assert.equal((await missing(new Request('https://callback.test'))).status,503);
assert.equal((await handler(new Request('https://callback.test',{method:'PUT'}))).status,405);
console.log('PASS WhatsApp webhook: handshake, raw-byte HMAC, missing secrets, account/phone scope, deduplication, status-only events, review for media, bounded payload and retry on storage failure. No outbound client.');
