export const CONNECTOR_VERSION='20261020.3';
const nextStamp=row=>new Date(Math.max(Date.now(),(Date.parse(row.updated_at)||0)+1)).toISOString();
const driveError=e=>/DriveApp|googleapis\.com\/auth\/drive/.test(String(e||''));
export const SHEETS={zloto:'1USAMWIxrSnUrm80ZzLu045ZxbCOXmtbczAqCTcMcHAI',budget:'1znG5ngKBelKAfeEMxfppcdzouGMsPXn1MiAvFMVfH64',zlotoTab:'Cuenta Zloto desde MAR26',budgetTab:'Ingresos'};
export function createSheetBridge({db,storage,hash,fail,text,id}){
 return async function(body,user){
  if(body.action==='admin-sheet-health'){
   const connection=await db.one('jd_sheet_connection',{id:true}),rows=await db.list('jd_sheet_outbox',{},'*',1000),stamp=Date.now();
   const destinations=Object.entries({zloto:'Cuenta Zloto',budget:'Presupuesto gastos'}).map(([key,label])=>{const items=rows.filter(r=>r.destination===key);return {key,label,total:items.length,pending:items.filter(r=>r.status==='pending').length,conflicts:items.filter(r=>r.status==='conflict').length,lastSyncedAt:items.filter(r=>r.status==='synced').map(r=>r.updated_at).filter(Boolean).sort().at(-1)||null};});
   return {configured:!!connection?.token_hash,connectorVersion:connection?.connector_version||null,requiredVersion:CONNECTOR_VERSION,lastSeenAt:connection?.last_seen_at||null,lastAuthorizedAt:connection?.last_authorized_at||null,lastSuccessAt:connection?.last_success_at||null,needsAuthorization:rows.some(r=>r.status==='conflict'&&driveError(r.error))||!connection?.last_authorized_at||connection?.connector_version!==CONNECTOR_VERSION,stale:!connection?.last_seen_at||stamp-Date.parse(connection.last_seen_at)>300000,destinations,issues:rows.filter(r=>r.status==='conflict').slice(0,10).map(r=>({id:r.id,destination:r.destination,label:r.payload?.code||r.payload?.label||r.payload?.client||'Exportación',error:driveError(r.error)?'Falta autorizar Drive en Google':r.error||'Revisar exportación',driveAuthorization:driveError(r.error)}))};
  }
  if(body.action==='admin-sheet-connect'){
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');await db.upsert('jd_sheet_connection',{id:true,token_hash:await hash(token),created_by:user.id,created_at:new Date().toISOString(),last_seen_at:null,last_authorized_at:null,connector_version:null},'id');return {token,config:SHEETS};
  }
  if(body.action==='admin-sheet-retry'){
   const row=await db.one('jd_sheet_outbox',{id:id(body.id)});if(!row)fail('Exportación no disponible.',404);if(row.destination==='budget'&&row.payload.legacyRow)fail('Este trabajo tiene un registro histórico. Se conserva hasta conciliarlo para no duplicar ingresos.');return {entry:await db.patch('jd_sheet_outbox',row.id,{status:'pending',error:null,updated_at:nextStamp(row)},row.updated_at)};
  }
  if(typeof body.token!=='string'||!/^[a-f0-9]{64}$/.test(body.token))fail('Conector no autorizado.',401);const connection=await db.one('jd_sheet_connection',{id:true});if(!connection?.token_hash||connection.token_hash!==await hash(body.token))fail('Conector no autorizado.',401);
  if(body.action==='sheet-ready'){
   if(body.version!==CONNECTOR_VERSION)fail('Actualizá el conector antes de reactivar los comprobantes.');
   const at=new Date().toISOString();await db.patch('jd_sheet_connection',true,{last_seen_at:at,last_authorized_at:at,connector_version:CONNECTOR_VERSION});let retried=0;
   for(const row of await db.list('jd_sheet_outbox',{status:'conflict'},'*',1000))if(row.destination==='zloto'&&driveError(row.error)){await db.patch('jd_sheet_outbox',row.id,{status:'pending',error:null,updated_at:nextStamp(row)},row.updated_at);retried++;}
   return {retried};
  }
  if(body.action==='sheet-pull'){await db.patch('jd_sheet_connection',true,{last_seen_at:new Date().toISOString()});return {config:SHEETS,entries:await db.list('jd_sheet_outbox',{status:'pending'},'*',50)};}

  const row=await db.one('jd_sheet_outbox',{id:id(body.id)});if(!row)fail('Exportación no disponible.',404);
  if(body.action==='sheet-receipt'){
   if(row.destination!=='zloto'||!row.payload.hasReceipt)fail('Comprobante no disponible.',404);const entry=await db.one('jd_supplier_entries',{id:row.payload.entryId});if(!entry?.receipt_path||entry.state!=='posted')fail('Comprobante no disponible.',404);return {url:await storage.receiptUrl(entry.receipt_path),name:entry.id+'-'+entry.receipt_name};
  }
  if(body.action==='sheet-ack'){
   if(!['synced','conflict'].includes(body.status)||!body.updatedAt)fail('Estado de exportación inválido.');const receipt=body.receiptUrl?text(body.receiptUrl,2000):null;if(receipt&&!/^https:\/\/drive\.google\.com\/file\/d\/[A-Za-z0-9_-]+\//.test(receipt))fail('Enlace de comprobante inválido.');
   const at=nextStamp(row);const entry=await db.patch('jd_sheet_outbox',row.id,{updated_at:at,status:body.status,error:body.status==='conflict'?text(body.error||'Revisar exportación',1000):null,sheet_range:text(body.range||'',200),receipt_url:receipt},body.updatedAt);if(body.status==='synced')await db.patch('jd_sheet_connection',true,{last_success_at:at});return {entry};
  }
  fail('Acción no disponible.',404);
 };
}
