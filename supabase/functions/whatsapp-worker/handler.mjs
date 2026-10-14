import {buildDraft,checkApproverMessage} from '../_shared/whatsapp-draft.mjs';
const reply=(status,body)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
const equal=(a,b)=>{let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;};

export function createWorker({env,store,extract,quoteB612,send,now=Date.now}){
 return async req=>{
  const key=env('JD_WA_WORKER_TOKEN');
  if(!key||key.length<32)return reply(503,{status:'not_configured'});
  if(!equal(req.headers.get('Authorization')||'','Bearer '+key))return reply(401,{status:'unauthorized'});
  if(req.method!=='POST')return reply(405,{status:'method_not_allowed'});
  if(env('JD_WA_AI_ENABLED')!=='true')return reply(200,{status:'disabled'});
  for(const secret of ['JD_OPENAI_API_KEY','JD_WA_ACCESS_TOKEN','JD_WA_APPROVER_NUMBER','JD_WA_PHONE_NUMBER_ID','JD_WA_WABA_ID'])if(!env(secret))return reply(503,{status:'not_configured'});
  let payload;
  try{const text=await req.text();if(text.length>4096)return reply(413,{status:'too_large'});payload=JSON.parse(text);}catch{return reply(400,{status:'invalid_request'});}
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||typeof payload.messageId!=='string'||!payload.messageId||payload.messageId.length>256||Object.keys(payload).some(k=>k!=='messageId'))return reply(400,{status:'invalid_request'});
  const id=payload.messageId;
  let claimed=false,outboundStarted=false;
  try{
   const message=await store.getMessage(id);
   if(!message||message.waba_id!==env('JD_WA_WABA_ID')||message.phone_number_id!==env('JD_WA_PHONE_NUMBER_ID'))return reply(403,{status:'unexpected_source'});
   try{checkApproverMessage(message,env('JD_WA_APPROVER_NUMBER'),now());}catch{return reply(200,{status:'needs_review'});}
   const settings=await store.getSettings();
   const claim=await store.claim(id);
   if(claim.status!=='claimed')return reply(200,{status:claim.status});
   claimed=true;
   const draft=await buildDraft({message,approver:env('JD_WA_APPROVER_NUMBER'),catalog:settings.catalog,settings:settings.rule,extract,quoteB612,now:now()});
   if(!await store.transition(id,'processing',{state:'draft',draft}))throw Error('draft_persistence');
   // Check again after supplier/AI latency. There are no templates or sends to
   // clients: only the existing approver and an open service reply window.
   checkApproverMessage(message,env('JD_WA_APPROVER_NUMBER'),now());
   if(!await store.transition(id,'draft',{state:'sending'}))throw Error('send_claim');
   outboundStarted=true;
   const providerId=await send(draft.body);
   if(!await store.transition(id,'sending',{state:'sent',provider_message_id:providerId}))throw Error('send_receipt_persistence');
   return reply(200,{status:'sent_to_approver'});
  }catch{
   if(claimed){try{await store.transition(id,null,{state:outboundStarted?'delivery_uncertain':'needs_review',error_code:outboundStarted?'outbound_result_unknown':'processing_requires_review'});}catch{/* Leave processing/sending for manual review; never resend automatically. */}}
   return reply(503,{status:outboundStarted?'delivery_uncertain':'needs_review'});
  }
 };
}
