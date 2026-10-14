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
    if(Deno.env.get('JD_WA_AI_ENABLED')==='true'){
      const workerToken=Deno.env.get('JD_WA_WORKER_TOKEN');
      if(workerToken)EdgeRuntime.waitUntil((async()=>{
        // Sequential dispatch avoids flooding the test worker. Durable claim in
        // Postgres handles duplicate webhook deliveries; no paid retries here.
        for(const row of rows){
          try{await fetch(url+'/functions/v1/whatsapp-worker',{
            method:'POST',signal:AbortSignal.timeout(120000),
            headers:{Authorization:'Bearer '+workerToken,'Content-Type':'application/json'},
            body:JSON.stringify({messageId:row.message_id})
          });}catch{/* Inbox is durable. Recover explicitly after checking job state. */}
        }
      })());
    }
  }
}));
