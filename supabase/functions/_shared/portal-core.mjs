import {createSheetBridge} from './sheet-bridge.mjs';
import {createProofing} from './proofing.mjs';
import {createSupplierAccount} from './supplier-account.mjs';
import '../../../assets/jd-print-request.js';
import './jd-whatsapp-pricing.js';
import {quotePrintRequest} from './b612-general.mjs';
import {getCardOptions} from './b612-cards.mjs';

const intake=globalThis.jdPrintRequest,pricing=globalThis.jdWhatsAppPrice;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const T={customers:'jd_portal_customers',quotes:'jd_portal_quotes',costs:'jd_portal_quote_costs',orders:'jd_portal_orders',files:'jd_portal_files',requests:'jd_portal_account_requests'};
const answerKeys=new Set('description quantities widthMm heightMm sizeScope spineMm totalPages interiorPages coverPages pagesIncludeCover paper weightGsm print sides lamination laminationSides coverPaper coverWeightGsm coverPrint coverSides coverLamination coverLaminationSides bindingOptions hasCover models folds cardType paperChoice cardSize corners pageMeaning blankPage'.split(' '));
const statuses=['Solicitado','En revisión','Requiere corrección','Esperando pago','Confirmado','En producción','Listo para entregar','Entregado','Cancelado'];
const purposes=['Archivo para imprimir','Referencia','Comprobante de pago','Material del cliente','Mockup','Entrega digital'];
export class PortalError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const fail=(s,n=400)=>{throw new PortalError(s,n);};
const id=v=>{if(typeof v!=='string'||!UUID.test(v))fail('Identificador inválido.');return v;};
const text=(v,max=5000)=>{if(typeof v!=='string'||v.length>max)fail('Revisá el texto ingresado.');return v.trim();};
const pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o[k]]));
const customerPublic=c=>pick(c,['id','name','first_name','last_name','business_name','phone','instagram','locality','must_change_password','updated_at']);
const quotePublic=q=>pick(q,['id','request','customer_result','created_at','expires_at','requested_order_id']);
const orderPublic=o=>pick(o,['id','work_code','items','total','currency','status','due_date','notes','customer_message','project','history','created_at','updated_at']);
const filePublic=f=>pick(f,['id','order_id','name','content_type','size_bytes','purpose','status','created_at']);
const genericPending='Requiere confirmación de Judaica Design. No hay un importe automático confirmado.';
export async function portalTokenHash(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');}
function passwordValue(value){if(typeof value!=='string'||value.length>200)fail('Revisá la contraseña ingresada.');const p=value;if(p.length<12||!/[a-z]/.test(p)||!/[A-Z]/.test(p)||!/[0-9]/.test(p))fail('Usá al menos 12 caracteres, con mayúsculas, minúsculas y números.');return p;}
function profileValue(body){const profile={first_name:text(body.first_name||'',70),last_name:text(body.last_name||'',80),business_name:text(body.business_name||'',160),phone:text(body.phone||'',80),instagram:text(body.instagram||'',160),locality:text(body.locality||'',160)};if(!profile.first_name||!profile.last_name||!profile.locality)fail('Completá nombre, apellido y localidad.');if(!/^\+[1-9]\d{7,14}$/.test(profile.phone)||profile.phone.startsWith('+54')&&!/^\+549\d{10}$/.test(profile.phone))fail('Revisá WhatsApp: incluí país, código de área y número completo.');return profile;}
const projectFields={title:160,kind:40,scope:5000,participants:500,institution:300,event_date:10,contact:300,style:1500,drive_url:2000,review_url:2000,materials:5000};
function projectValue(body){const p={};for(const [k,max] of Object.entries(projectFields))p[k]=text(body?.[k]||'',max);if(!p.title)fail('Indicá el nombre del trabajo.');if(p.event_date&&!/^\d{4}-\d{2}-\d{2}$/.test(p.event_date))fail('Revisá la fecha de evento.');for(const k of ['drive_url','review_url'])if(p[k]){let u;try{u=new URL(p[k]);}catch{fail('Revisá los enlaces del trabajo.');}if(u.protocol!=='https:'||u.username||u.password)fail('Los enlaces deben comenzar con https://.');}return p;}
export function createPublicPortalApp(deps){
 return async function(body,rateKey){
  if(body.action!=='register-account')fail('El registro se simplificó. Abrí el portal y elegí Crear cuenta.',410);
  if(body.website)fail('No se pudo completar el registro.');
  const profile=profileValue(body),name=profile.first_name+' '+profile.last_name,email=text(body.email,254).toLowerCase(),password=passwordValue(body.password);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Completá un correo válido.');
  await deps.db.signupRate(rateKey);
  if(await deps.db.isTeam(email))fail('Este correo pertenece al equipo. Ingresá con tu cuenta habitual.',403);
  const existing=await deps.db.one(T.customers,{email});
  if(existing&&!existing.active)fail('Esta cuenta está deshabilitada. Contactá a Judaica Design.',403);
  if(existing&&!existing.auth_user_id)fail('Este correo ya tiene una ficha. Contactá a Judaica Design.',403);
  const user=await deps.auth.enroll(email,password);
  await deps.db.registerCustomer(name,email,profile.phone,user.id,profile);
  return {registered:true,email};
 };
}
export function customerResult(raw,r,rule,incomplete=false){
 const alternatives=(raw?.alternatives||[]).map((a,index)=>{
  const valid=a.status==='priced'&&Number.isFinite(a.net)&&a.net>0&&Array.isArray(a.lines)&&a.lines.length&&a.lines.every(l=>Number.isFinite(l.total)&&l.total>=0)&&Math.abs(a.lines.reduce((s,l)=>s+l.total,0)-a.net)<=.011;
  return {id:String(index),qty:a.qty??null,binding:String(a.binding||r.description),status:valid?'priced':'requires-review',price:valid?pricing.calculate(a.net,rule).price:null,currency:'ARS'};
 });
 const requiresReview=alternatives.some(a=>a.status!=='priced'),clean=intake.cleanText(r,null,r.bindingOptions?.[0]||r.description,false);
 return {description:r.description,specification:incomplete||requiresReview?r.message+(Object.keys(r.confirmedAnswers||{}).length?'\n\nDatos confirmados:\n'+clean:''):clean,alternatives,requiresReview,notice:'Importes en pesos argentinos. Envío a confirmar por separado. El pedido queda sujeto a revisión de archivos, disponibilidad y condiciones de pago.'};
}
function safeAnswers(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return {};
 const result={};for(const [k,v] of Object.entries(value)){if(!answerKeys.has(k))continue;if(JSON.stringify(v).length>2000)fail('La respuesta es demasiado extensa.');if(typeof v==='string'||typeof v==='number'||typeof v==='boolean'||v===null||Array.isArray(v)&&v.every(x=>typeof x==='number'||typeof x==='string'))result[k]=v;else fail('Respuesta inválida.');}return result;
}
function safeOptions(o){return {cardType:o.cardType,papers:o.papers.map(p=>pick(p,['id','label','paper','weightGsm','incompatibleRubros'])),sizes:o.sizes.map(s=>pick(s,['id','label','widthMm','heightMm'])),customSize:o.customSize,finishes:o.finishes.map(f=>pick(f,['code','rubro']))};}
export function createPortalApp(deps){
 const {db,storage,auth,supplier}=deps,now=deps.now||(()=>new Date()),uuid=deps.uuid||(()=>crypto.randomUUID());
 async function parse(body){
  const message=text(body.text,20000);if(!message)fail('Pegá el pedido o completá la calculadora.');const answers=safeAnswers(body.answers),parsed=intake.analyze(message);
  let r=intake.mergeAnswers(parsed,null,answers);
  if(r.description==='Tarjetas personales'&&r.cardType&&body.review!==true){try{r.supplierOptions=safeOptions(await getCardOptions(r,supplier));}catch{return {request:r,answers,questions:[{key:'supplierOptions',text:'No pudimos consultar las opciones de tarjetas. Reintentá o pedí cotización personalizada.'}]};}const p=r.supplierOptions.papers.find(p=>String(p.id)===r.paperChoice),size=r.supplierOptions.sizes.find(s=>String(s.id)===r.cardSize);if(p){r.paper=p.paper;r.weightGsm=p.weightGsm;}if(size){r.widthMm=size.widthMm;r.heightMm=size.heightMm;r.sizeScope='hoja';}r=intake.canonicalize(r);}
  return {request:r,answers,questions:intake.questions(r).map(q=>({...q,text:q.text.replaceAll('B612','Judaica Design')}))};
 }
 async function owner(table,key,customer,admin){const row=await db.one(table,{id:id(key)});if(!row||!admin&&row.customer_id!==customer?.id)fail('No disponible.',404);return row;}
 const proofs=createProofing({db,storage,owner,id,text,fail,now,uuid});const supplierAccount=createSupplierAccount({db,storage,text,id,fail,uuid,now});const sheets=createSheetBridge({db,storage,hash:portalTokenHash,fail,text,id});
 return async function dispatch(token,body){
  const user=await auth.user(token);if(!user?.id||!user.email_confirmed_at||user.is_anonymous)fail('Iniciá sesión con una cuenta habilitada.',401);
  const email=String(user.email||'').toLowerCase(),admin=await db.isTeam(email);const action=body.action;
  let customer=null;if(!admin){customer=await db.one(T.customers,{auth_user_id:user.id,active:true});if(!customer)fail('Tu cuenta todavía no está habilitada. Consultá con Judaica Design.',403);}
  if(action==='profile')return {role:admin?'admin':'customer',customer:customer?customerPublic(customer):null};
  if(!admin&&customer.must_change_password&&action!=='change-password')fail('Primero cambiá la contraseña provisoria.',403);
  if(action==='change-password'){
   const password=passwordValue(body.password);
   await auth.changePassword(token,password);if(customer)await db.patch(T.customers,customer.id,{must_change_password:false,auth_user_id:user.id,updated_at:now().toISOString()});return {changed:true};
  }
  if(action==='save-profile'){
   if(admin||!body.updated_at)fail('Actualizá tu cuenta antes de guardar.',409);
   const p=profileValue(body),updated_at=now().toISOString();
   return {customer:customerPublic(await db.patch(T.customers,customer.id,{...p,name:p.first_name+' '+p.last_name,updated_at},body.updated_at))};
  }
  if(typeof action!=='string')fail('Acción inválida.');
  if(action.startsWith('review-'))return proofs(body,{admin,customer,user});
  if(action.startsWith('admin-sheet-')){if(!admin)fail('Acceso no autorizado.',403);return sheets(body,user);}
  if(action.startsWith('admin-supplier-')){if(!admin)fail('Acceso no autorizado.',403);return supplierAccount(body,user);}
  if(action.startsWith('admin-')){
   if(!admin)fail('Acceso no autorizado.',403);
   if(action==='admin-list')return {inquiries:(await db.list(T.quotes,{},'*',200)).filter(q=>q.customer_result?.requiresReview&&!q.requested_order_id).map(q=>({...quotePublic(q),customer_id:q.customer_id})),customers:await db.list(T.customers,{},'*',200),orders:(await db.list(T.orders,{},'*',200)).map(o=>({...orderPublic(o),customer_id:o.customer_id})),defaultRule:await db.sharedPricing()};
   if(action==='admin-publish-quote'){
    const q=await owner(T.quotes,body.quoteId,null,true);
    if(q.requested_order_id||!q.customer_result.requiresReview)fail('Esta consulta ya fue respondida o tiene un pedido. Actualizá la bandeja.',409);
    const c=await db.one(T.customers,{id:q.customer_id,active:true});if(!c)fail('La cuenta del cliente no está habilitada.');
    const old=q.customer_result.alternatives,rows=body.alternatives;
    if(!Array.isArray(rows)||rows.length!==old.length||!rows.length||rows.length>32)fail('Completá el costo de cada alternativa.');
    const rule=pricing.rule(await db.sharedPricing()),supplierName=text(body.supplier||'',160),specification=text(body.specification||'',20000);
    if(!supplierName||!specification)fail('Completá el proveedor interno y la ficha que verá el cliente.');
    const costs=rows.map((a,i)=>{if(!Number.isSafeInteger(a.qty)||a.qty<1||a.qty>40000||typeof a.net!=='number'||!Number.isFinite(a.net)||a.net<=0||a.net>1e10||Math.abs(a.net*100-Math.round(a.net*100))>0.0001)fail('Indicá cantidades enteras y costos válidos con hasta dos decimales.');if(old[i].qty!=null&&a.qty!==old[i].qty)fail('La cantidad debe coincidir con la consulta del cliente.');return {qty:a.qty,net:a.net};});
    const result={description:q.customer_result.description,specification,alternatives:costs.map((a,i)=>({id:String(i),qty:a.qty,binding:old[i].binding,status:'priced',price:pricing.calculate(a.net,rule).price,currency:'ARS'})),requiresReview:false,notice:'Cotización disponible. Importes en pesos argentinos, sin envío. Elegí una cantidad para solicitar el pedido; la producción queda sujeta a revisión de archivos y pago.'};
    const at=now();const updated=await db.publishQuote(q.id,body.expectedResult,result,{supplier:supplierName,alternatives:costs,at:at.toISOString()},rule,new Date(at.getTime()+7*86400000).toISOString());
    return {quote:quotePublic(updated)};
   }
   if(action==='admin-source-jobs'){const state=await db.one('app_state',{key:'jd_jobs_v1'}),jobs=(Array.isArray(state?.value)?state.value:[]).filter(j=>!j.deletedAt),codes=new Map((await db.workCodes(jobs.map(j=>'job:'+j.id))).map(r=>[r.source_key,r.code]));return {jobs:jobs.map(j=>({...pick(j,['id','title','stage','event','deadline']),work_code:codes.get('job:'+j.id)||null}))};}
   if(action==='admin-project'){
    const project=projectValue(body.project),at=now().toISOString();
    if(body.orderId){if(!body.updated_at)fail('Actualizá el trabajo antes de guardar.',409);const o=await owner(T.orders,body.orderId,null,true);if(o.project?.source_job_id)project.source_job_id=o.project.source_job_id;return {order:orderPublic(await db.patch(T.orders,o.id,{project,history:[...(o.history||[]),{at,type:'Detalles',text:'Judaica Design actualizó los detalles y el material solicitado.'}],updated_at:at},body.updated_at))};}
    const c=await db.one(T.customers,{id:id(body.customerId),active:true});if(!c?.auth_user_id)fail('Elegí una cuenta registrada y habilitada.');
    if(body.sourceJobId){const source=await db.one('app_state',{key:'jd_jobs_v1'}),j=source?.value?.find(j=>j.id===body.sourceJobId&&!j.deletedAt);if(!j)fail('Trabajo interno no disponible.');project.source_job_id=text(j.id,160);const exists=(await db.list(T.orders,{},'*',1000)).find(o=>o.project?.source_job_id===j.id);if(exists)fail('Ese trabajo ya está compartido. Abrí su ficha para editarlo.');}
    return {order:orderPublic(await db.insert(T.orders,{id:uuid(),customer_id:c.id,idempotency_key:uuid(),items:[],total:null,currency:'ARS',status:'Solicitado',project,notes:'',history:[{at,type:'Trabajo',text:'Trabajo compartido por Judaica Design.'}],created_at:at,updated_at:at}))};
   }
   if(action==='admin-request'){
    fail('Cada cliente crea su cuenta directamente desde el portal.');
   }
   if(action==='admin-customer'){
    const name=text(body.name,160),email=body.email?text(body.email,254).toLowerCase():null;if(!name)fail('Indicá el nombre.');if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Revisá el correo.');
    if(email&&await db.isTeam(email))fail('El correo del equipo no se habilita como cliente.');
    if(!body.id||!body.updated_at)fail('Elegí una cuenta existente y actualizá la pantalla.',409);const existing=await db.one(T.customers,{id:id(body.id)});if(!existing)fail('Cliente no disponible.',404);
    if(email!==existing.email)fail('El correo de una cuenta activada no se cambia desde este formulario.');
    if(body.pricing_mode==='custom'||body.price_rule!=null)fail('Por ahora todos los clientes usan la única regla compartida.');
    const value={name,active:!!email&&body.active===true,pricing_mode:'abi',price_rule:null,updated_at:now().toISOString()};
    return {customer:await db.patch(T.customers,existing.id,value,body.updated_at)};
   }
   if(action==='admin-access'){
    fail('Ahora cada cliente solicita su cuenta y elige su contraseña mediante su enlace de activación.');
   }
   if(action==='admin-order'){
    if(!body.updated_at)fail('Actualizá el pedido antes de guardar.',409);const o=await owner(T.orders,body.orderId,null,true);if(!statuses.includes(body.status))fail('Estado inválido.');const message=text(body.message||'',5000);
    const at=now().toISOString(),history=[...(o.history||[]),{at,type:'Estado',text:body.status+(message?' · '+message:'')}];return {order:orderPublic(await db.patch(T.orders,o.id,{status:body.status,customer_message:message,history,updated_at:at},body.updated_at))};
   }
   fail('Acción no disponible.',404);
  }
  if(admin&&!['order-detail','file-download','file-init','file-complete'].includes(action))fail('Usá la administración para gestionar el portal.',403);
  if(action==='analyze')return parse(body);
  if(action==='quote'){
   if(await db.recentQuotes(customer.id,now())>=20)fail('Llegaste al límite de consultas de este período. Reintentá en unos minutos.',429);
   const parsed=await parse(body),r=parsed.request,manual=body.review===true;
   if(parsed.questions.length&&!manual)return {questions:parsed.questions,request:r,needsAnswers:true};
   const rule=pricing.rule(await db.sharedPricing());
   let raw;
   try{if(manual)throw Error('manual-review');raw=await quotePrintRequest(r,supplier);}catch{raw={alternatives:(r.quantities?.length?r.quantities:[null]).map(qty=>({qty,binding:r.bindingOptions?.[0]||r.description,status:'requires-supplier'}))};}
   const result=customerResult(raw,r,rule,!!parsed.questions.length);if(!result.alternatives.length)fail(genericPending);
   const at=now(),qid=uuid(),q=await db.saveQuote({id:qid,customer_id:customer.id,request:{text:r.message,answers:parsed.answers},customer_result:result,created_at:at.toISOString(),expires_at:new Date(at.getTime()+7*86400000).toISOString()},raw,rule);
   // Evidence stays in a distinct backend-only table, never in the customer DTO.
   return {quote:quotePublic(q)};
  }
  if(action==='list')return {quotes:(await db.list(T.quotes,{customer_id:customer.id},'id,request,customer_result,created_at,expires_at,requested_order_id',100)).map(quotePublic),orders:(await db.list(T.orders,{customer_id:customer.id},'*',100)).map(orderPublic)};
  if(action==='request-order'){
   if(!Array.isArray(body.items)||!body.items.length||body.items.length>20)fail('Elegí entre 1 y 20 productos.');for(const item of body.items){id(item.quoteId);if(!Number.isSafeInteger(item.index)||item.index<0||item.index>31)fail('Elegí una cantidad válida.');}
   for(const item of body.items){const q=await owner(T.quotes,item.quoteId,customer,false),a=q.customer_result.alternatives[item.index];if(!a||a.status!=='priced'||!Number.isFinite(a.price)||a.price<=0)fail('Esta consulta todavía está por cotizar. Esperá el precio antes de solicitar el pedido.');}
   const due=body.dueDate||null;if(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||isNaN(Date.parse(due))))fail('Revisá la fecha solicitada.');
   const o=await db.submit(customer.id,body.items,text(body.notes||'',5000),due,id(body.key));return {order:orderPublic(o)};
  }
  if(action==='order-detail'){const o=await owner(T.orders,body.orderId,customer,admin);return {order:orderPublic(o),files:(await db.list(T.files,{order_id:o.id},'*',200)).map(filePublic)};}
  if(action==='project-message'){
   if(admin)fail('Usá la ficha de administración.');if(!body.updated_at)fail('Actualizá la ficha antes de guardar.',409);const o=await owner(T.orders,body.orderId,customer,false),message=text(body.message||'',5000);if(!message)fail('Escribí la información que querés enviar.');if(['Entregado','Cancelado'].includes(o.status))fail('Este trabajo ya está cerrado.');const at=now().toISOString();return {order:orderPublic(await db.patch(T.orders,o.id,{history:[...(o.history||[]),{at,type:'Cliente',text:message}],updated_at:at},body.updated_at))};
  }
  if(action==='file-init'){
   const o=await owner(T.orders,body.orderId,customer,admin);if(['En producción','Listo para entregar','Entregado','Cancelado'].includes(o.status))fail('Los archivos de este pedido están cerrados. Consultá con Judaica Design.');
   const name=text(body.name,200),mime=body.contentType,size=body.size,purpose=body.purpose;if(!purposes.includes(purpose)||!Number.isSafeInteger(size)||size<1||size>26214400)fail('Usá PDF, JPG o PNG de hasta 25 MB.');
   if(!admin&&['Mockup','Entrega digital'].includes(purpose))fail('Este tipo de archivo lo comparte Judaica Design.',403);
   if(purpose==='Mockup'&&!['image/png','image/jpeg'].includes(mime))fail('Para mockups usá JPG o PNG. Las muestras de PDF se comparten mediante su enlace de revisión.');
   const ext={'application/pdf':'pdf','image/png':'png','image/jpeg':'jpg'}[mime];if(!ext||!name)fail('Usá PDF, JPG o PNG.');
   const fid=uuid(),path=o.customer_id+'/'+o.id+'/'+fid+'.'+ext;const file=await db.insert(T.files,{id:fid,customer_id:o.customer_id,order_id:o.id,path,name,content_type:mime,size_bytes:size,purpose,status:'pending'});
   return {file:filePublic(file),upload:await storage.uploadUrl(path)};
  }
  if(action==='file-complete'){
   const f=await owner(T.files,body.fileId,customer,admin),o=await owner(T.orders,f.order_id,customer,admin);if(['En producción','Listo para entregar','Entregado','Cancelado'].includes(o.status))fail('Este pedido ya no acepta archivos.');
   if(f.status==='uploaded')return {file:filePublic(f)};
   const blob=await storage.download(f.path),head=new Uint8Array(await blob.slice(0,8).arrayBuffer());const valid=f.content_type==='application/pdf'?new TextDecoder().decode(head).startsWith('%PDF-'):f.content_type==='image/png'?head[0]===137&&head[1]===80&&head[2]===78&&head[3]===71:head[0]===255&&head[1]===216&&head[2]===255;
   if(!valid||blob.size!==f.size_bytes||blob.size>26214400)fail('El archivo no coincide con el formato o tamaño informado. Volvé a cargarlo.');
   return {file:filePublic(await db.patch(T.files,f.id,{status:'uploaded'}))};
  }
  if(action==='file-download'){
   const f=await owner(T.files,body.fileId,customer,admin);if(f.status!=='uploaded')fail('El archivo todavía no está disponible.');return {url:await storage.downloadUrl(f.path,f.name)};
  }
  fail('Acción no disponible.',404);
 };
}

export function createSheetBridgeApp(deps){const fail=(message,status=400)=>{throw new PortalError(message,status);};return createSheetBridge({...deps,hash:portalTokenHash,fail,text,id});}
