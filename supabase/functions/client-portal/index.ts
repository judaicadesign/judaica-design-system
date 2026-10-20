import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import {createClient} from 'npm:@supabase/supabase-js@2.117.2';
import {createPortalApp,createPublicPortalApp,portalTokenHash,PortalError,createSheetBridgeApp} from '../_shared/portal-core.mjs';

const url=Deno.env.get('SUPABASE_URL')!,serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,anonKey=Deno.env.get('SUPABASE_ANON_KEY')!;
const service=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
const check=(r:any)=>{if(r.error){if(r.error.code==='P0001')throw new PortalError(r.error.message);throw Error('Backend operation failed');}return r.data;};
const db={
 async upsert(table:string,value:any,onConflict:string){return check(await service.from(table).upsert(value,{onConflict}).select().single());},
 async operation(name:string,args:any){return check(await service.rpc(name,args));},
 async workCodes(keys:string[]){const out:any[]=[];for(let i=0;i<keys.length;i+=100)out.push(...check(await service.from("jd_work_codes").select("source_key,code").in("source_key",keys.slice(i,i+100))));return out;},
 async signupRate(rate:string){check(await service.rpc('jd_portal_signup_rate',{p_rate:rate}));},
 async registerCustomer(name:string,email:string,phone:string,user:string,profile:any){check(await service.rpc('jd_portal_register_customer',{p_name:name,p_email:email,p_phone:phone,p_user:user,p_profile:profile}));},
 async publishQuote(id:string,expected:any,result:any,evidence:any,rule:any,expires:string){return check(await service.rpc('jd_portal_publish_quote',{p_quote:id,p_expected:expected,p_result:result,p_evidence:evidence,p_rule:rule,p_expires:expires}));},
 async saveQuote(quote:any,evidence:any,rule:any){return check(await service.rpc('jd_portal_save_quote',{p_quote:quote,p_evidence:evidence,p_rule:rule}));},
 async one(table:string,filters:Record<string,unknown>){let q=service.from(table).select('*');for(const [k,v] of Object.entries(filters))q=q.eq(k,v);return check(await q.maybeSingle());},
 async list(table:string,filters:Record<string,unknown>,columns='*',limit=100){let q=service.from(table).select(columns);for(const [k,v] of Object.entries(filters))q=q.eq(k,v);return check(await q.order('created_at',{ascending:false}).limit(limit));},
 async insert(table:string,value:any){return check(await service.from(table).insert(value).select().single());},
 async patch(table:string,key:string,value:any,expected?:string){let q=service.from(table).update(value).eq('id',key);if(expected)q=q.eq('updated_at',expected);const data=check(await q.select().maybeSingle());if(!data)throw new PortalError('Cambió en otra sesión. Actualizá la pantalla y reintentá.',409);return data;},
 async isTeam(email:string){return !!check(await service.from('jd_team_access').select('email').eq('email',email).maybeSingle());},
 async sharedPricing(){const row=check(await service.from('app_state').select('value').eq('key','jd_whatsapp_pricing_v1').maybeSingle());if(!row)throw new PortalError('La regla de precios todavía no está disponible. Consultá con Judaica Design.',503);return row.value;},
 async recentQuotes(id:string,at:Date){const r=await service.from('jd_portal_quotes').select('id',{head:true,count:'exact'}).eq('customer_id',id).gte('created_at',new Date(at.getTime()-15*60000).toISOString());check(r);return r.count||0;},
 async submit(customer:string,items:any,notes:string,due:string|null,key:string){return check(await service.rpc('jd_portal_submit_order',{p_customer_id:customer,p_items:items,p_notes:notes,p_due:due,p_key:key}));}
};
const bucket=service.storage.from('jd-portal-files');
const storage={
 async archiveUrl(path:string){return check(await service.storage.from('jd-supplier-archive').createSignedUrl(path,300)).signedUrl;},
 async copyArchiveReceipt(from:string,to:string,mime:string){const blob=check(await service.storage.from('jd-supplier-archive').download(from));check(await service.storage.from('jd-supplier-receipts').upload(to,blob,{contentType:mime,upsert:false}));},
 async previewUrl(path:string){return check(await bucket.createSignedUrl(path,300)).signedUrl;},
 async receiptUploadUrl(path:string){const d=check(await service.storage.from("jd-supplier-receipts").createSignedUploadUrl(path,{upsert:false}));return {path:d.path,token:d.token};},
 async receiptDownload(path:string){return check(await service.storage.from("jd-supplier-receipts").download(path));},
 async receiptUrl(path:string){return check(await service.storage.from("jd-supplier-receipts").createSignedUrl(path,300)).signedUrl;},
 async uploadUrl(path:string){const data=check(await bucket.createSignedUploadUrl(path,{upsert:false}));return {path:data.path,token:data.token};},
 async download(path:string){return check(await bucket.download(path));},
 async downloadUrl(path:string,name:string){return check(await bucket.createSignedUrl(path,60,{download:name})).signedUrl;}
};
const auth={
 async user(token:string){const r=await service.auth.getUser(token);return r.error?null:r.data.user;},
 async changePassword(token:string,password:string){const r=await fetch(url+'/auth/v1/user',{method:'PUT',headers:{apikey:anonKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({password})});if(!r.ok)throw new PortalError('No se pudo cambiar la contraseña. Reintentá o volvé a ingresar.');},
 async enroll(email:string,password:string){
  const r=await service.auth.admin.createUser({email,password,email_confirm:true});
  if(!r.error)return {id:r.data.user.id};
  if(!['email_exists','user_already_exists'].includes(r.error.code||'')&&!/already.*registered|already.*exists/i.test(r.error.message))throw new PortalError('No se pudo activar tu cuenta. Reintentá o consultá con Judaica Design.');
  // Existing accounts are never reset. Prove knowledge of their existing password.
  const res=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anonKey,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
  const data=await res.json();if(!res.ok||!data.user?.email_confirmed_at||data.user.email?.toLowerCase()!==email)throw new PortalError('Ese correo ya tiene cuenta. Usá su contraseña habitual o consultá con Judaica Design.');
  return {id:data.user.id};
 }
};
async function supplier(path:string){
 if(!path.startsWith('/api/'))throw Error('Unsupported supplier path');
 const r=await fetch('https://www.graficab612.com'+path,{signal:AbortSignal.timeout(20000),headers:{accept:'application/json','user-agent':'JudaicaDesignPortal/1.0'}});if(!r.ok)throw Error('Supplier unavailable');return r.json();
}
const dispatch=createPortalApp({db,storage,auth,supplier});
const dispatchPublic=createPublicPortalApp({db,auth});
const dispatchSheets=createSheetBridgeApp({db,storage});
Deno.serve(async(req:Request)=>{
 const origin=req.headers.get('origin');const allowed=!origin||origin==='https://judaicadesign.github.io';
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Access-Control-Allow-Origin':'https://judaicadesign.github.io','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin'};
 const response=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(!allowed)return response({ok:false,error:'Origen no autorizado.'},403);
 if(req.method==='OPTIONS')return new Response('ok',{headers});
 if(req.method!=='POST')return response({ok:false,error:'Método no disponible.'},405);
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];
 try{
  if(Number(req.headers.get('content-length')||0)>65536)throw new PortalError('El pedido es demasiado extenso.',413);const raw=await req.text();if(raw.length>65536)throw new PortalError('El pedido es demasiado extenso.',413);
  let body;try{body=JSON.parse(raw);}catch{throw new PortalError('Pedido inválido.');}
  const publicAction=['register-account','request-account','activate-account'].includes(body?.action);
  if(['sheet-pull','sheet-ack','sheet-receipt','sheet-ready'].includes(body?.action))return response({ok:true,...await dispatchSheets(body,null)});
  if(!token&&!publicAction)return response({ok:false,error:'Iniciá sesión.'},401);
  if(!body||typeof body.action!=='string'||body.action.length>40)throw new PortalError('Acción inválida.');
  if(publicAction){const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';const rate=await portalTokenHash(serviceKey+'|portal-rate|'+ip);return response({ok:true,...await dispatchPublic(body,rate)});}
  return response({ok:true,...await dispatch(token!,body)});
 }
 catch(e){return response({ok:false,error:e instanceof PortalError?e.message:'No se pudo completar la operación. Tus archivos y precios anteriores se conservan; reintentá o consultá con Judaica Design.'},e instanceof PortalError?e.status:503);}
});
