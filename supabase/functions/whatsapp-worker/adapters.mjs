export function createStore({env,fetch=globalThis.fetch}){
 const request=async(path,options={})=>{
  const url=env('SUPABASE_URL'),key=env('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!key)throw Error('server_configuration');
  const result=await fetch(url+'/rest/v1/'+path,{signal:AbortSignal.timeout(10000),...options,headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'return=representation',...options.headers}});
  if(!result.ok)throw Error('database_unavailable');
  return result.json();
 };
 return {
  getMessage:async id=>(await request('jd_whatsapp_inbox?select=*&message_id=eq.'+encodeURIComponent(id)))[0],
  getSettings:async()=>{
   const rows=await request('app_state?select=key,value&key=in.(jd_catalog_v6,jd_whatsapp_pricing_v1)');
   const catalog=rows.find(r=>r.key==='jd_catalog_v6')?.value,rule=rows.find(r=>r.key==='jd_whatsapp_pricing_v1')?.value;
   if(!Array.isArray(catalog)||!rule)throw Error('missing_shared_settings');
   return {catalog,rule};
  },
  claim:id=>request('rpc/jd_claim_whatsapp_job',{method:'POST',body:JSON.stringify({p_message_id:id})}),
  transition:async(id,expected,patch)=>{
   const rows=await request('jd_whatsapp_jobs?message_id=eq.'+encodeURIComponent(id)+(expected?'&state=eq.'+expected:'&state=in.(processing,draft,sending)'),{method:'PATCH',body:JSON.stringify({...patch,updated_at:new Date().toISOString()})});
   return rows.length===1;
  }
 };
}
export function createApproverSender({env,fetch=globalThis.fetch}){
 return async body=>{
  const token=env('JD_WA_ACCESS_TOKEN'),phone=env('JD_WA_PHONE_NUMBER_ID'),to=env('JD_WA_APPROVER_NUMBER');
  if(!token||!/^\d+$/.test(phone||'')||!/^\d{6,20}$/.test(to||'')||typeof body!=='string'||body.length>4096)throw Error('outbound_configuration');
  const result=await fetch('https://graph.facebook.com/v26.0/'+phone+'/messages',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to,type:'text',text:{preview_url:false,body}})});
  if(!result.ok)throw Error('outbound_failed');
  const data=await result.json(),id=data.messages?.[0]?.id;
  if(typeof id!=='string'||!id)throw Error('outbound_result_unknown');
  return id;
 };
}
