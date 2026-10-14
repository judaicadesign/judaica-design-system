// Inbound only. This module has no messaging or AI client and cannot send quotes.
const MAX_BYTES = 256 * 1024;
const encoder = new TextEncoder();
const reply = (status, text) => new Response(text, {status, headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
function equal(a,b){
  const x=encoder.encode(a),y=encoder.encode(b);let diff=x.length^y.length;
  for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]||0)^(y[i]||0);
  return diff===0;
}
async function readBody(req){
  if(Number(req.headers.get('content-length')||0)>MAX_BYTES)throw new Error('too_large');
  const reader=req.body?.getReader();if(!reader)return new Uint8Array();
  const chunks=[];let length=0;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>MAX_BYTES){await reader.cancel();throw new Error('too_large');}chunks.push(value);}
  const result=new Uint8Array(length);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
export function createHandler({env,persist,crypto=globalThis.crypto}){
  return async req=>{
    const secret=env('JD_META_APP_SECRET'),verify=env('JD_WA_VERIFY_TOKEN');
    if(!secret||!verify)return reply(503,'Webhook not configured');
    if(req.method==='GET'){
      const q=new URL(req.url).searchParams,challenge=q.get('hub.challenge');
      return q.get('hub.mode')==='subscribe'&&equal(q.get('hub.verify_token')||'',verify)&&challenge&&challenge.length<=256
        ?reply(200,challenge):reply(403,'Verification denied');
    }
    if(req.method!=='POST')return reply(405,'Method not allowed');
    const signature=req.headers.get('x-hub-signature-256')||'';
    if(!/^sha256=[0-9a-f]{64}$/.test(signature))return reply(401,'Invalid signature');
    let raw;try{raw=await readBody(req);}catch{return reply(413,'Payload too large');}
    const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
    const bytes=Uint8Array.from(signature.slice(7).match(/../g),h=>parseInt(h,16));
    if(!await crypto.subtle.verify('HMAC',key,bytes,raw))return reply(401,'Invalid signature');
    let payload;try{payload=JSON.parse(new TextDecoder().decode(raw));}catch{return reply(400,'Invalid JSON');}
    if(payload?.object!=='whatsapp_business_account'||!Array.isArray(payload.entry))return reply(400,'Invalid event');
    const waba=env('JD_WA_WABA_ID'),phone=env('JD_WA_PHONE_NUMBER_ID');
    if(!waba||!phone)return reply(503,'Webhook not configured');
    const rows=new Map();
    for(const entry of payload.entry){
      if(String(entry?.id)!==waba)return reply(403,'Unexpected account');
      if(!Array.isArray(entry.changes))return reply(400,'Invalid event');
      for(const change of entry.changes){
        if(change?.field!=='messages')continue;
        const value=change.value;
        if(String(value?.metadata?.phone_number_id)!==phone)return reply(403,'Unexpected phone');
        if(value.messages===undefined)continue; // Delivery receipts never create work.
        if(!Array.isArray(value.messages))return reply(400,'Invalid messages');
        for(const message of value.messages){
          if(typeof message?.id!=='string'||message.id.length>256||!message.id||!/^\d{6,20}$/.test(String(message.from||'')))return reply(400,'Invalid message');
          const timestamp=Number(message.timestamp);
          if(!Number.isSafeInteger(timestamp)||timestamp<=0)return reply(400,'Invalid timestamp');
          if(typeof message.type!=='string'||message.type.length>32)return reply(400,'Invalid type');
          const text=message.type==='text'?message.text?.body:null;
          if(message.type==='text'&&(typeof text!=='string'||text.length>16000))return reply(400,'Invalid text');
          rows.set(message.id,{message_id:message.id,waba_id:waba,phone_number_id:phone,sender_wa_id:String(message.from),message_timestamp:timestamp,message_type:message.type,body_text:text??null,state:message.type==='text'?'received':'needs_review'});
        }
      }
    }
    try{if(rows.size)await persist([...rows.values()]);}catch{return reply(503,'Persistence unavailable');}
    return reply(200,'EVENT_RECEIVED');
  };
}
