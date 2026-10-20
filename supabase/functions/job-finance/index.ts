import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {budgetPage,budgetTotals} from './b612-budget.mjs';
import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const bucket=service.storage.from('jd-supplier-receipts');
const check=(r:any)=>{if(r.error)throw Error(r.error.message);return r.data;};
const uuid=(x:any)=>typeof x==='string'&&/^[a-f0-9-]{36}$/i.test(x);
const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'https://judaicadesign.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
Deno.serve(async(req:Request)=>{
 const reply=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.headers.get('origin')&&!['https://judaicadesign.github.io'].includes(req.headers.get('origin')!))return reply({ok:false,error:'Origen no autorizado'},403);
 if(req.method==='OPTIONS')return new Response('ok',{headers});if(req.method!=='POST')return reply({ok:false,error:'Método no permitido'},405);
 try{
 const token=req.headers.get('authorization')?.replace(/^Bearer /,'');if(!token)return reply({ok:false,error:'Iniciá sesión'},401);
 const u=check(await service.auth.getUser(token))?.user;if(!u?.email_confirmed_at||u.is_anonymous||!check(await service.from('jd_team_access').select('email').eq('email',u.email?.toLowerCase()).maybeSingle()))return reply({ok:false,error:'Acceso del equipo requerido'},403);
 const raw=await req.text();if(raw.length>10000)throw Error('Pedido demasiado extenso');const b=JSON.parse(raw);
 const state=check(await service.from('app_state').select('value').eq('key','jd_jobs_v1').single());const j=state.value.find((x:any)=>x.id===b.jobId&&!x.deletedAt);if(!j)throw Error('Trabajo no disponible');
 if(b.action==='sync'){check(await service.rpc('jd_reconcile_job_print',{p_job:j.id,p_actor:u.id}));return reply({ok:true});}
 if(b.action==='status'){const codes=check(await service.from('jd_work_codes').select('code').eq('source_key','job:'+j.id).maybeSingle());const outs=check(await service.from('jd_sheet_outbox').select('destination,status,error,sheet_range,receipt_url,updated_at,entity_id').limit(1000));const entries=check(await service.from('jd_supplier_entries').select('id,kind,amount,ars,state,job_id,source').eq('job_id',j.id));return reply({ok:true,code:codes?.code,exports:outs.filter((x:any)=>x.entity_id===j.id||entries.some((e:any)=>e.id===x.entity_id)),entries});}
 if(b.action==='view'){if(!uuid(b.fileId))throw Error('Archivo inválido');const f=check(await service.from('jd_job_files').select('*').eq('id',b.fileId).eq('job_id',j.id).eq('state','posted').single());return reply({ok:true,url:check(await bucket.createSignedUrl(f.path,120)).signedUrl,name:f.name});}
 if(b.action==='complete'){const f=check(await service.from('jd_job_files').select('*').eq('id',b.fileId).eq('job_id',j.id).single());if(f.state==='posted')return reply({ok:true,file:{id:f.id,name:f.name,mime:f.mime,size:f.size_bytes,sha256:f.sha256,createdAt:f.created_at}});const blob=check(await bucket.download(f.path));const bytes=new Uint8Array(await blob.arrayBuffer());if(bytes.length!==f.size_bytes)throw Error('El tamaño del archivo no coincide');const valid=f.mime==='application/pdf'?new TextDecoder().decode(bytes.slice(0,5))==='%PDF-':f.mime==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if(!valid)throw Error('El archivo no es un PDF o imagen válido');const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');check(await service.from('jd_job_files').update({state:'posted',sha256}).eq('id',f.id));return reply({ok:true,file:{id:f.id,name:f.name,mime:f.mime,size:f.size_bytes,sha256,createdAt:f.created_at}});}
 if(b.action==='upload'||b.action==='b612-pdf'){
  const automatic=b.action==='b612-pdf',r=automatic?j.supplierOrders?.find((x:any)=>x.id===b.orderId&&!x.voidedAt):null;
  let mime=b.mime,name=String(b.name||'Comprobante').slice(0,180),size=Number(b.size),bytes:Uint8Array|undefined,source:string|undefined;
  if(automatic){if(!r||!/b612/i.test(r.supplier)||!/^\d+$/.test(r.code))throw Error('Indicá una orden B612 válida');source='https://www.graficab612.com/reportes/presupuesto.pdf?pedido='+r.code;const response=await fetch(source,{redirect:'error',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('B612 no entregó el PDF. Podés subir tu copia.');const reader=response.body!.getReader(),chunks:Uint8Array[]=[];size=0;while(true){const v=await reader.read();if(v.done)break;size+=v.value.length;if(size>26214400){await reader.cancel();throw Error('PDF demasiado grande');}chunks.push(v.value);}bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error('B612 no devolvió un PDF. Subí tu copia del presupuesto.');mime='application/pdf';name='B612-'+r.code+'-'+new Date().toISOString().slice(0,10)+'.pdf';}
  if(!['application/pdf','image/jpeg','image/png'].includes(mime)||!Number.isSafeInteger(size)||size<1||size>26214400)throw Error('Adjuntá PDF, JPG o PNG de hasta 25 MB');
  const id=crypto.randomUUID(),path='Trabajos/'+j.id.replace(/[^a-zA-Z0-9-]/g,'_')+'/'+id+({'application/pdf':'.pdf','image/jpeg':'.jpg','image/png':'.png'}[mime]||'');
  const sha256=bytes?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join(''):null;
  const f=check(await service.from('jd_job_files').insert({id,job_id:j.id,owner_id:String(b.ownerId||b.orderId||'').slice(0,200),path,name,mime,size_bytes:size,state:automatic?'posted':'draft',sha256,source_url:source||null,created_by:u.id}).select().single());
  if(bytes){check(await bucket.upload(path,bytes,{contentType:mime,upsert:false}));let totals={},priceError;try{const {default:parse}=await import('npm:pdf-parse@1.1.1/lib/pdf-parse.js');const {Buffer}=await import('node:buffer');const pdf=await parse(Buffer.from(bytes),{pagerender:budgetPage,max:5});totals=budgetTotals(pdf.text,r.code);}catch(e){priceError='PDF conservado; importes pendientes de confirmar: '+(e instanceof Error?e.message:'No se pudo leer');}return reply({ok:true,file:{id,name,mime,size,sha256,createdAt:f.created_at,sourceUrl:source,...totals,...(priceError?{priceError}:{})}});}
  const upload=check(await bucket.createSignedUploadUrl(path,{upsert:false}));return reply({ok:true,file:{id,name,mime,size},upload:{path:upload.path,token:upload.token}});
 }
 throw Error('Acción no disponible');
 }catch(e){return reply({ok:false,error:e instanceof Error?e.message:'No se pudo completar la operación'},400);}
});
