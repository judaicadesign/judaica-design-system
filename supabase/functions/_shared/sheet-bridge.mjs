export const SHEETS={zloto:'1USAMWIxrSnUrm80ZzLu045ZxbCOXmtbczAqCTcMcHAI',budget:'1znG5ngKBelKAfeEMxfppcdzouGMsPXn1MiAvFMVfH64',zlotoTab:'Cuenta Zloto desde MAR26',budgetTab:'Ingresos'};
export function createSheetBridge({db,storage,hash,fail,text,id}){
 return async function(body,user){
  if(body.action==='admin-sheet-connect'){
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');await db.upsert('jd_sheet_connection',{id:true,token_hash:await hash(token),created_by:user.id,created_at:new Date().toISOString()},'id');return {token,config:SHEETS};
  }
  if(body.action==='admin-sheet-retry'){
   const row=await db.one('jd_sheet_outbox',{id:id(body.id)});if(!row)fail('Exportación no disponible.',404);if(row.destination==='budget'&&row.payload.legacyRow)fail('Este trabajo tiene un registro histórico. Se conserva hasta conciliarlo para no duplicar ingresos.');return {entry:await db.patch('jd_sheet_outbox',row.id,{status:'pending',error:null,updated_at:new Date().toISOString()},row.updated_at)};
  }
  if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))fail('Conector no autorizado.',401);const connection=await db.one('jd_sheet_connection',{id:true});if(!connection?.token_hash||connection.token_hash!==await hash(body.token))fail('Conector no autorizado.',401);
  if(body.action==='sheet-pull')return {config:SHEETS,entries:await db.list('jd_sheet_outbox',{status:'pending'},'*',50)};
  const row=await db.one('jd_sheet_outbox',{id:id(body.id)});if(!row)fail('Exportación no disponible.',404);
  if(body.action==='sheet-receipt'){
   if(row.destination!=='zloto'||!row.payload.hasReceipt)fail('Comprobante no disponible.',404);const entry=await db.one('jd_supplier_entries',{id:row.payload.entryId});if(!entry?.receipt_path||entry.state!=='posted')fail('Comprobante no disponible.',404);return {url:await storage.receiptUrl(entry.receipt_path),name:entry.id+'-'+entry.receipt_name};
  }
  if(body.action==='sheet-ack'){
   if(!['synced','conflict'].includes(body.status)||!body.updatedAt)fail('Estado de exportación inválido.');const receipt=body.receiptUrl?text(body.receiptUrl,2000):null;if(receipt&&!/^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\//.test(receipt))fail('Enlace de comprobante inválido.');
   return {entry:await db.patch('jd_sheet_outbox',row.id,{status:body.status,error:body.status==='conflict'?text(body.error||'Revisar exportación',1000):null,sheet_range:text(body.range||'',200),receipt_url:receipt},body.updatedAt)};
  }
  fail('Acción no disponible.',404);
 };
}
