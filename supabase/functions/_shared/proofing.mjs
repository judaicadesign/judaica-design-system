// Review images only: the administrator's source PDF never crosses this API.
const tables={versions:'jd_review_versions',pages:'jd_review_pages',comments:'jd_review_comments',approvals:'jd_review_approvals'};
const project='jd_portal_orders';
const select=(v,keys)=>Object.fromEntries(keys.map(k=>[k,v[k]]));
const versionPublic=v=>select(v,['id','order_id','version_no','title','page_count','rtl','approvable','source_name','source_sha256','state','created_at','published_at']);
const pagePublic=p=>select(p,['id','version_id','page','width','height','state']);
const commentPublic=c=>select(c,['id','version_id','page','x','y','body','actor_role','parent_id','resolved_at','created_at']);
export function createProofing({db,storage,owner,id,text,fail,now,uuid}){
 return async function(body,{admin,customer,user}){
  const action=body.action,role=admin?'team':'customer';
  if(action==='review-list'){
   const order=await owner(project,body.orderId,customer,admin),all=await db.list(tables.versions,{order_id:order.id},'*',500);
   return {current:order.current_review_id||null,versions:all.filter(v=>admin||v.state!=='draft').map(versionPublic)};
  }
  if(action==='review-create'){
   if(!admin)fail('Solo JD puede publicar muestras.',403);await owner(project,body.orderId,customer,true);
   const count=Number(body.pageCount),hash=text(body.sourceHash||'',64);if(!Number.isInteger(count)||count<1||count>400||!/^[a-f0-9]{64}$/.test(hash))fail('Revisá las páginas y el archivo de muestra.');
   const data={title:text(body.title||'Muestra para revisión',160),page_count:count,rtl:body.rtl===true,approvable:body.approvable===true,source_name:text(body.sourceName||'Muestra',200),source_sha256:hash};
   return {version:versionPublic(await db.operation('jd_review_create',{p_order:id(body.orderId),p_actor:user.id,p_data:data}))};
  }
  let version;if(['review-resolve'].includes(action)){
   const c=await db.one(tables.comments,{id:id(body.commentId)});if(!c)fail('Comentario no disponible.',404);version=await db.one(tables.versions,{id:c.version_id});
  }else version=await db.one(tables.versions,{id:id(body.versionId)});
  if(!version)fail('Muestra no disponible.',404);const order=await owner(project,version.order_id,customer,admin);
  if(!admin&&version.state==='draft')fail('Muestra no disponible.',404);
  if(action==='review-open'){
   const pages=await db.list(tables.pages,{version_id:version.id},'*',500),comments=await db.list(tables.comments,{version_id:version.id},'*',1000),approval=await db.one(tables.approvals,{version_id:version.id});
   return {locked:['En producción','Listo para entregar','Entregado','Cancelado'].includes(order.status),version:versionPublic(version),current:order.current_review_id===version.id,pages:pages.sort((a,b)=>a.page-b.page).map(pagePublic),comments:comments.map(commentPublic),approval:approval?select(approval,['id','version_id','consent','created_at']):null};
  }
  if(action==='review-page'){
   const p=await db.one(tables.pages,{version_id:version.id,page:Number(body.page)});if(!p||p.state!=='uploaded')fail('Página no disponible.',404);return {page:pagePublic(p),url:await storage.previewUrl(p.path)};
  }
  if(action==='review-page-init'||action==='review-page-complete'||action==='review-publish'){
   if(!admin||version.state!=='draft')fail('Solo JD puede preparar una muestra nueva.',403);
   if(action==='review-publish')return {version:versionPublic(await db.operation('jd_review_publish',{p_version:version.id}))};
   const page=Number(body.page);if(!Number.isInteger(page)||page<1||page>version.page_count)fail('Página inválida.');let p=await db.one(tables.pages,{version_id:version.id,page});
   if(action==='review-page-init'){
    if(p)return {page:pagePublic(p),upload:p.state==='uploaded'?null:await storage.uploadUrl(p.path)};
    const mime=body.mime,size=Number(body.size),width=Number(body.width),height=Number(body.height);if(!['image/jpeg','image/png'].includes(mime)||![size,width,height].every(Number.isSafeInteger)||size<1||size>8388608||width<1||height<1||width>6000||height>6000)fail('La página debe ser JPG/PNG de hasta 8 MB.');
    p=await db.insert(tables.pages,{id:uuid(),version_id:version.id,page,path:order.customer_id+'/'+order.id+'/reviews/'+version.id+'/'+page+(mime==='image/png'?'.png':'.jpg'),mime,size_bytes:size,width,height});return {page:pagePublic(p),upload:await storage.uploadUrl(p.path)};
   }
   if(!p)fail('Iniciá la carga de la página.');if(p.state==='uploaded')return {page:pagePublic(p)};
   const blob=await storage.download(p.path),bytes=new Uint8Array(await blob.arrayBuffer()),valid=p.mime==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
   if(!valid||blob.size!==p.size_bytes)fail('La página cargada no coincide con el formato o tamaño esperado.');
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');return {page:pagePublic(await db.patch(tables.pages,p.id,{state:'uploaded',sha256:hash}))};
  }
  if(action==='review-comment'){
   if(!Number.isInteger(Number(body.page))||![Number(body.x),Number(body.y)].every(n=>Number.isFinite(n)&&n>=0&&n<=1))fail('Marcá una zona de la página.');
   return {comment:commentPublic(await db.operation('jd_review_comment',{p_version:version.id,p_actor:user.id,p_role:role,p_page:Number(body.page),p_x:Number(body.x),p_y:Number(body.y),p_body:text(body.text||'',5000),p_parent:body.parentId?id(body.parentId):null}))};
  }
  if(action==='review-resolve')return {comment:commentPublic(await db.operation('jd_review_resolve',{p_comment:id(body.commentId),p_actor:user.id,p_role:role,p_resolved:body.resolved===true}))};
  if(action==='review-approve'){
   if(admin)fail('La aprobación la realiza el cliente desde su propia cuenta.',403);if(body.reviewed!==true)fail('Confirmá que revisaste esta versión.');
   const a=await db.operation('jd_review_approve',{p_version:version.id,p_actor:user.id,p_customer:customer.id});return {approval:select(a,['id','version_id','consent','created_at'])};
  }
  fail('Acción no disponible.',404);
 };
}
