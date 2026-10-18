import '../../../assets/jd-print-request.js';
import './jd-whatsapp-pricing.js';
import {quotePrintRequest} from './b612-general.mjs';
import {getCardOptions} from './b612-cards.mjs';

const intake=globalThis.jdPrintRequest,pricing=globalThis.jdWhatsAppPrice;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const T={customers:'jd_portal_customers',quotes:'jd_portal_quotes',costs:'jd_portal_quote_costs',orders:'jd_portal_orders',files:'jd_portal_files'};
const answerKeys=new Set('description quantities widthMm heightMm sizeScope spineMm totalPages interiorPages coverPages pagesIncludeCover paper weightGsm print sides lamination laminationSides coverPaper coverWeightGsm coverPrint coverSides coverLamination coverLaminationSides bindingOptions hasCover models folds cardType paperChoice cardSize corners pageMeaning blankPage'.split(' '));
const statuses=['Solicitado','En revisión','Requiere corrección','Esperando pago','Confirmado','En producción','Listo para entregar','Entregado','Cancelado'];
const purposes=['Archivo para imprimir','Referencia','Comprobante de pago'];
export class PortalError extends Error{constructor(message,status=400){super(message);this.status=status;}}
const fail=(s,n=400)=>{throw new PortalError(s,n);};
const id=v=>{if(typeof v!=='string'||!UUID.test(v))fail('Identificador inválido.');return v;};
const text=(v,max=5000)=>{if(typeof v!=='string'||v.length>max)fail('Revisá el texto ingresado.');return v.trim();};
const pick=(o,keys)=>Object.fromEntries(keys.map(k=>[k,o[k]]));
const customerPublic=c=>pick(c,['id','name','must_change_password']);
const quotePublic=q=>pick(q,['id','request','customer_result','created_at','expires_at','requested_order_id']);
const orderPublic=o=>pick(o,['id','items','total','currency','status','due_date','notes','customer_message','history','created_at','updated_at']);
const filePublic=f=>pick(f,['id','order_id','name','content_type','size_bytes','purpose','status','created_at']);
const genericPending='Requiere confirmación de Judaica Design. No hay un importe automático confirmado.';
export function customerResult(raw,r,rule,incomplete=false){
 const alternatives=(raw?.alternatives||[]).map((a,index)=>{
  const valid=a.status==='priced'&&Number.isFinite(a.net)&&a.net>0&&Array.isArray(a.lines)&&a.lines.length&&a.lines.every(l=>Number.isFinite(l.total)&&l.total>=0)&&Math.abs(a.lines.reduce((s,l)=>s+l.total,0)-a.net)<=.011;
  return {id:String(index),qty:a.qty??null,binding:String(a.binding||r.description),status:valid?'priced':'requires-review',price:valid?pricing.calculate(a.net,rule).price:null,currency:'ARS'};
 });
 return {description:r.description,specification:incomplete?r.message:intake.cleanText(r,null,r.bindingOptions?.[0]||r.description,false),alternatives,requiresReview:alternatives.some(a=>a.status!=='priced'),notice:'Importes en pesos argentinos. Envío a confirmar por separado. El pedido queda sujeto a revisión de archivos, disponibilidad y condiciones de pago.'};
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
 return async function dispatch(token,body){
  const user=await auth.user(token);if(!user?.id||!user.email_confirmed_at||user.is_anonymous)fail('Iniciá sesión con una cuenta habilitada.',401);
  const email=String(user.email||'').toLowerCase(),admin=await db.isTeam(email);const action=body.action;
  let customer=null;if(!admin){customer=await db.one(T.customers,{email,active:true});if(!customer)fail('Tu cuenta todavía no está habilitada. Consultá con Judaica Design.',403);}
  if(action==='profile')return {role:admin?'admin':'customer',customer:customer?customerPublic(customer):null};
  if(!admin&&customer.must_change_password&&action!=='change-password')fail('Primero cambiá la contraseña provisoria.',403);
  if(action==='change-password'){
   const password=text(body.password,200);if(password.length<12||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password))fail('Usá al menos 12 caracteres, con mayúsculas, minúsculas y números.');
   await auth.changePassword(token,password);if(customer)await db.patch(T.customers,customer.id,{must_change_password:false,auth_user_id:user.id,updated_at:now().toISOString()});return {changed:true};
  }
  if(action.startsWith('admin-')){
   if(!admin)fail('Acceso no autorizado.',403);
   if(action==='admin-list')return {customers:await db.list(T.customers,{},'*',200),orders:(await db.list(T.orders,{},'*',200)).map(o=>({...orderPublic(o),customer_id:o.customer_id})),defaultRule:await db.sharedPricing()};
   if(action==='admin-customer'){
    const name=text(body.name,160),email=body.email?text(body.email,254).toLowerCase():null;if(!name)fail('Indicá el nombre.');if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail('Revisá el correo.');
    if(email&&await db.isTeam(email))fail('El correo del equipo no se habilita como cliente.');
    if(body.id&&!body.updated_at)fail('Actualizá la cuenta antes de guardar.',409);const existing=body.id?await db.one(T.customers,{id:id(body.id)}):null;if(body.id&&!existing)fail('Cliente no disponible.',404);
    const pricing_mode=body.pricing_mode==='custom'?'custom':'abi',price_rule=pricing_mode==='custom'?pricing.rule(body.price_rule):null;
    const value={name,email,active:!!email&&body.active===true,pricing_mode,price_rule,updated_at:now().toISOString()};
    const c=existing?await db.patch(T.customers,existing.id,value,body.updated_at):await db.insert(T.customers,{id:uuid(),...value});return {customer:c};
   }
   if(action==='admin-access'){
    const c=await db.one(T.customers,{id:id(body.customerId)});if(!c?.email||!c.active)fail('Primero cargá el correo y habilitá al cliente.');if(await db.isTeam(c.email))fail('No corresponde crear acceso de cliente para el equipo.');
    const password='JD-'+uuid().replaceAll('-','')+'a7';const result=await auth.createAccess(c.email,password);
    if(!result.created)return {created:false,message:'Ese correo ya tiene una cuenta. Puede entrar con su contraseña habitual; no se modificó su acceso.'};
    await db.patch(T.customers,c.id,{must_change_password:true,auth_user_id:result.userId,updated_at:now().toISOString()});return {created:true,email:c.email,password,message:'Acceso creado. Compartí estos datos por tu canal habitual. Al ingresar deberá cambiar la contraseña.'};
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
   const rule=customer.pricing_mode==='custom'?pricing.rule(customer.price_rule):pricing.rule(await db.sharedPricing());
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
   const due=body.dueDate||null;if(due&&(!/^\d{4}-\d{2}-\d{2}$/.test(due)||isNaN(Date.parse(due))))fail('Revisá la fecha solicitada.');
   const o=await db.submit(customer.id,body.items,text(body.notes||'',5000),due,id(body.key));return {order:orderPublic(o)};
  }
  if(action==='order-detail'){const o=await owner(T.orders,body.orderId,customer,admin);return {order:orderPublic(o),files:(await db.list(T.files,{order_id:o.id},'*',200)).map(filePublic)};}
  if(action==='file-init'){
   const o=await owner(T.orders,body.orderId,customer,admin);if(['En producción','Listo para entregar','Entregado','Cancelado'].includes(o.status))fail('Los archivos de este pedido están cerrados. Consultá con Judaica Design.');
   const name=text(body.name,200),mime=body.contentType,size=body.size,purpose=body.purpose;if(!purposes.includes(purpose)||!Number.isSafeInteger(size)||size<1||size>26214400)fail('Usá PDF, JPG o PNG de hasta 25 MB.');
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
