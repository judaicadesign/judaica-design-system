const table='jd_supplier_entries';
const pick=(o,ks)=>Object.fromEntries(ks.map(k=>[k,o[k]]));
export function createSupplierAccount({db,storage,text,id,fail,uuid,now}){
 const publicEntry=e=>({...pick(e,['id','kind','supplier','amount','currency','rate','ars','job_id','client_label','detail','date','method','state','source','created_at','updated_at','history']),hasReceipt:!!e.receipt_path,receipt_name:e.receipt_name});
 return async function(body,user){
  const action=body.action;
  if(action==='admin-supplier-chat'){
   const archives=await db.list('jd_supplier_archives',{},'*',20);return {archives:archives.map(a=>pick(a,['id','label','messages','files','created_at']))};
  }
  if(action==='admin-supplier-chat-file'){
   const archive=await db.one('jd_supplier_archives',{id:id(body.archiveId)}),file=archive?.files?.find(f=>f.id===body.fileId);if(!file)fail('Adjunto no disponible.',404);return {url:await storage.archiveUrl(file.path),name:file.name};
  }
  if(action==='admin-supplier-match-receipt'){
   const e=await db.one(table,{id:id(body.entryId)}),archive=await db.one('jd_supplier_archives',{id:id(body.archiveId)}),file=archive?.files?.find(f=>f.id===body.fileId),reason=text(body.reason||'',1000);
   if(!e||e.kind!=='Pago'||e.state!=='posted'||e.receipt_path||!file||!['application/pdf','image/jpeg','image/png'].includes(file.mime)||!reason||body.confirmed!==true)fail('Elegí un pago sin comprobante, revisá el adjunto y explicá la coincidencia.');
   const path='Zloto/'+e.id+'/'+uuid()+({'application/pdf':'.pdf','image/jpeg':'.jpg','image/png':'.png'}[file.mime]);await storage.copyArchiveReceipt(file.path,path,file.mime);
   return {entry:publicEntry(await db.operation('jd_supplier_attach_receipt',{p_entry:e.id,p_expected:body.updatedAt,p_actor:user.id,p_receipt:{path,name:file.name,mime:file.mime,size:file.size},p_evidence:{archiveId:archive.id,fileId:file.id,reason,match:'Revisado manualmente'}}))};
  }
  if(action==='admin-supplier-list'){
   const entries=await db.list(table,{},'*',1000),exports=await db.list('jd_sheet_outbox',{},'*',1000),connection=await db.one('jd_sheet_connection',{id:true});
   const state=await db.one('app_state',{key:'jd_jobs_v1'}),codes=await db.workCodes((state?.value||[]).map(j=>'job:'+j.id)),clients=await db.one('app_state',{key:'jd_clients'});
   return {entries:entries.map(publicEntry),exports,connectionReady:!!connection?.token_hash,connectionHealth:{lastAuthorizedAt:connection?.last_authorized_at||null,connectorVersion:connection?.connector_version||null,lastSeenAt:connection?.last_seen_at||null},jobs:(state?.value||[]).filter(j=>!j.deletedAt).map(j=>({id:j.id,title:j.title,code:codes.find(c=>c.source_key==='job:'+j.id)?.code,client:(clients?.value||[]).find(c=>c.id===j.clientId)?.name||''}))};
  }
  if(action==='admin-supplier-create'){
   const amount=Number(body.amount),rate=body.currency==='ARS'?1:Number(body.rate),kind=body.kind;
   if(!['Cargo','Pago'].includes(kind)||!['ARS','USD','USDT'].includes(body.currency)||!Number.isFinite(amount)||amount<=0||amount>1e10||!Number.isFinite(rate)||rate<=0||rate>1e8||!/^\d{4}-\d{2}-\d{2}$/.test(body.date||''))fail('Revisá tipo, fecha, importe y cotización.');
   const entryId=id(body.id),existing=await db.one(table,{id:entryId});if(existing){if(existing.kind!==kind||Number(existing.amount)!==Math.round(amount*100)/100||existing.currency!==body.currency||Number(existing.rate)!==rate||(existing.job_id||null)!==(body.jobId||null)||existing.detail!==text(body.detail||'',3000)||existing.date!==body.date||(existing.receipt_name||null)!==(body.receipt?text(body.receipt.name||'Comprobante',200):null))fail('Este borrador ya fue iniciado con otros datos. Cerrá el formulario y creá un registro nuevo.',409);return {entry:publicEntry(existing),upload:existing.state==='draft'&&existing.receipt_path?await storage.receiptUploadUrl(existing.receipt_path):null};}
   const jobs=await db.one('app_state',{key:'jd_jobs_v1'});let job=null;if(body.jobId){job=jobs?.value?.find(j=>j.id===body.jobId&&!j.deletedAt);if(!job)fail('Trabajo interno no disponible.');}
   const receipt=body.receipt;if(kind==='Pago'&&/transfer/i.test(String(body.method||''))&&!receipt)fail('Adjuntá el comprobante de la transferencia.');let path=null;if(receipt){if(!['application/pdf','image/jpeg','image/png'].includes(receipt.mime)||!Number.isSafeInteger(receipt.size)||receipt.size<1||receipt.size>26214400)fail('Comprobante: PDF, JPG o PNG de hasta 25 MB.');path='Zloto/'+entryId+'/'+uuid()+({'application/pdf':'.pdf','image/jpeg':'.jpg','image/png':'.png'}[receipt.mime]);}
   const e=await db.insert(table,{id:entryId,kind,supplier:'Zloto',amount:Math.round(amount*100)/100,currency:body.currency,rate,job_id:job?.id||null,client_label:text(body.client||'',200),detail:text(body.detail||'',3000),date:body.date,method:text(body.method||'',200),state:'draft',receipt_path:path,receipt_name:receipt?text(receipt.name||'Comprobante',200):null,receipt_mime:receipt?.mime||null,receipt_size:receipt?.size||null,source:body.supplierOrderId?{jobSupplierOrderId:job?.supplierOrders?.find(r=>r.id===body.supplierOrderId&&/zloto/i.test(r.supplier))?.id||null}:null,created_by:user.id});
   return {entry:publicEntry(e),upload:path?await storage.receiptUploadUrl(path):null};
  }
  const e=await db.one(table,{id:id(body.entryId)});if(!e)fail('Movimiento no disponible.',404);
  if(action==='admin-supplier-post'){
   if(e.receipt_path&&e.state==='draft'){const blob=await storage.receiptDownload(e.receipt_path),bytes=new Uint8Array(await blob.slice(0,8).arrayBuffer()),valid=e.receipt_mime==='application/pdf'?new TextDecoder().decode(bytes).startsWith('%PDF-'):e.receipt_mime==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:bytes[0]===255&&bytes[1]===216&&bytes[2]===255;if(!valid||blob.size!==e.receipt_size)fail('El comprobante cargado no coincide con el archivo informado.');}
   return {entry:publicEntry(await db.operation('jd_supplier_post',{p_entry:e.id,p_actor:user.id}))};
  }
  if(action==='admin-supplier-receipt'){if(!e.receipt_path||e.state!=='posted')fail('No hay comprobante confirmado.');return {url:await storage.receiptUrl(e.receipt_path)};}
  if(action==='admin-supplier-link'||action==='admin-supplier-void'){
   const jobs=await db.one('app_state',{key:'jd_jobs_v1'});if(body.jobId&&!jobs?.value?.some(j=>j.id===body.jobId&&!j.deletedAt))fail('Trabajo no disponible.');
   const reason=action==='admin-supplier-void'?text(body.reason||'',1000):null;if(action==='admin-supplier-void'&&!reason)fail('Indicá el motivo de anulación.');
   return {entry:publicEntry(await db.operation('jd_supplier_update',{p_entry:e.id,p_actor:user.id,p_expected:body.updatedAt,p_job:body.jobId||null,p_flags:{fileSent:body.fileSent===true,delivered:body.delivered===true},p_void_reason:reason}))};
  }
  fail('Acción no disponible.',404);
 };
}
