import {createHandler} from './handler.mjs';
Deno.serve(createHandler({
  env:name=>Deno.env.get(name),
  persist:async rows=>{
    const url=Deno.env.get('SUPABASE_URL');
    const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!key)throw new Error('Missing server configuration');
    const result=await fetch(url+'/rest/v1/jd_whatsapp_inbox?on_conflict=message_id',{
      method:'POST',signal:AbortSignal.timeout(10000),
      headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',Prefer:'resolution=ignore-duplicates,return=minimal'},
      body:JSON.stringify(rows)
    });
    if(!result.ok)throw new Error('Inbox persistence failed');
  }
}));
