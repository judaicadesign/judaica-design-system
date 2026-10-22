/** Judaica Design — conector privado. Instalá en un proyecto Apps Script propio.
 * Solo modifica la cuenta Zloto y las filas JD creadas por este conector.
 * No compartas este script: contiene una clave limitada de conexión.
 */
const JD_TOKEN = '__JD_TOKEN__';
const JD_CONNECTOR_VERSION='20261020.3';
const JD_ENDPOINT = 'https://athiruoimehofqzrplnl.supabase.co/functions/v1/client-portal';
function jdApi_(action, data) {
 const response=UrlFetchApp.fetch(JD_ENDPOINT,{method:'post',contentType:'application/json',payload:JSON.stringify(Object.assign({action:action,token:JD_TOKEN},data||{})),muteHttpExceptions:true});
 const out=JSON.parse(response.getContentText());if(response.getResponseCode()>=400||out.ok===false)throw Error(out.error||'No se pudo conectar con JD');return out;
}
function conectarJD() {
 const data=jdApi_('sheet-pull');
 DriveApp.getFileById(data.config.zloto).getName();
 const zloto=SpreadsheetApp.openById(data.config.zloto).getSheetByName(data.config.zlotoTab);SpreadsheetApp.openById(data.config.budget);
 if(String(zloto.getRange('L12').getValue())!=='Comprobante'){if(String(zloto.getRange('L12').getValue())!=='Cliente')throw Error('Revisá las columnas de pagos antes de actualizar.');zloto.insertColumnAfter(11);zloto.getRange(12,14,zloto.getMaxRows()-11,1).copyTo(zloto.getRange(12,12,zloto.getMaxRows()-11,1));zloto.deleteColumn(14);zloto.getRange('L12').setValue('Comprobante');zloto.getRange('M12').setValue('Cliente');}
 // Force the Google authorization prompt before installing the timed trigger.
 jdApi_('sheet-ready',{version:JD_CONNECTOR_VERSION});
 ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='sincronizarJD').forEach(t=>ScriptApp.deleteTrigger(t));
 ScriptApp.newTrigger('sincronizarJD').timeBased().everyMinutes(1).create();sincronizarJD();
 console.log('Conexión JD instalada. Las filas personales de presupuesto no se modifican.');
}
function jdText_(v){const s=String(v==null?'':v);return /^[\s]*[=+\-@]/.test(s)?"'"+s:s;}
function jdDate_(v){return v?new Date(v+'T12:00:00Z'):'';}
function jdRow_(sheet,key,start,first,last) {
 const found=sheet.createDeveloperMetadataFinder().withKey('JD_EXPORT_ID').withValue(key).find();
 if(found.length){if(found.length!==1)throw Error('Referencia duplicada: revisar la planilla');return found[0].getLocation().getRow().getRow();}
 const count=sheet.getMaxRows()-start+1;if(count<1)throw Error('Agregá filas al final de la planilla antes de sincronizar.');const values=sheet.getRange(start,first,count,last-first+1).getValues();
 let row=-1;for(let i=0;i<values.length;i++)if(values[i].every(v=>v===''||v===null)){row=start+i;break;}
 if(row<0)throw Error('No hay una fila vacía disponible. Agregá filas al final y reintentá.');
 sheet.getRange(row,1,1,sheet.getMaxColumns()).addDeveloperMetadata('JD_EXPORT_ID',key);return row;
}
function jdReceipt_(item,config){
 if(!item.payload.hasReceipt)return null;
 const original=DriveApp.getFileById(config.zloto),people=original.getEditors().concat(original.getViewers(),original.getOwner()?[original.getOwner()]:[]).map(u=>u.getEmail()).filter(Boolean),mine=Session.getEffectiveUser().getEmail();
 if(!people.some(e=>e!==mine))throw Error('Para compartir el comprobante, agregá explícitamente a Zloto como lector de la planilla. No se publican comprobantes con acceso anónimo.');
 const props=PropertiesService.getScriptProperties();let folder;
 if(props.getProperty('JD_RECEIPT_FOLDER'))folder=DriveApp.getFolderById(props.getProperty('JD_RECEIPT_FOLDER'));
 else{folder=DriveApp.createFolder('JD - Comprobantes Zloto');props.setProperty('JD_RECEIPT_FOLDER',folder.getId());}
 folder.addViewers(people.filter(e=>e!==mine));
 const receipt=jdApi_('sheet-receipt',{id:item.id}),existing=folder.getFilesByName(receipt.name);
 return existing.hasNext()?existing.next():folder.createFile(UrlFetchApp.fetch(receipt.url).getBlob().setName(receipt.name));
}
function jdWrite_(item,config){
 const p=item.payload;
 if(item.destination==='budget'){
  if(p.legacyRow)throw Error('Existe una fila histórica. Conciliar antes para no duplicar ingresos.');
  const sheet=SpreadsheetApp.openById(config.budget).getSheetByName(config.budgetTab);if(!sheet||String(sheet.getRange('C1').getValue()).toLowerCase()!=='ingresos')throw Error('Cambió la estructura de la planilla de presupuesto');
  const names=sheet.getRange(2,2,sheet.getMaxRows()-1,1).getValues();let start=2;names.forEach((r,i)=>{if(r[0]!==''&&r[0]!==null)start=i+3;});const row=jdRow_(sheet,'budget:'+item.entity_id,start,1,7);if(row>503)throw Error('El resumen actual suma hasta fila 503. Ampliá sus fórmulas antes de agregar más filas JD.');const range=sheet.getRange(row,1,1,8),old=range.getValues()[0],pct=old[5]===''?0.1:old[5];
  if(typeof pct!=='number'||pct<0||pct>1)throw Error('Revisá el porcentaje «a dar» de esta fila');
  range.setValues([[jdDate_(p.date),jdText_(p.displayLabel||'JD - '+p.code+' · '+p.label),p.income,p.cost,'=C'+row+'-D'+row,pct,'=E'+row+'*F'+row,(range.getFormulas?.()[0]?.[7]||old[7])||'=IFERROR(E'+row+'/C'+row+',0)']]);
  sheet.getRange(row,4).setNote('Vinculado al trabajo '+p.code+'. Costo actualizado desde la ficha: '+p.cost+'. Incluye imprenta y gastos reales registrados; los pagos se controlan por separado.');
  return {range:config.budgetTab+'!A'+row+':G'+row};
 }
 const sheet=SpreadsheetApp.openById(config.zloto).getSheetByName(config.zlotoTab);if(!sheet||String(sheet.getRange('B12').getValue()).toLowerCase()!=='cliente')throw Error('Cambió la estructura de la cuenta Zloto');
 let row;const imported=p.source&&p.source.imported;
 if(imported){
  row=p.source.row;const current=sheet.getRange(row,2,1,6).getValues()[0],original=p.source.original;
  if(p.kind==='Pago'){const currentPayment=sheet.getRange(row,9,1,5).getValues()[0],clientColumn=String(sheet.getRange('L12').getValue())==='Comprobante'?4:3;if(currentPayment[0]!==original[0]||Number(currentPayment[2])!==Number(original[2])||String(currentPayment[clientColumn]||'')!==String(original[3]||''))throw Error('El pago de origen cambió: revisar antes de vincular');const receipt=jdReceipt_(item,config);if(!receipt)throw Error('No hay comprobante para vincular');const receiptColumn=String(sheet.getRange('L12').getValue())==='Comprobante'?12:13;sheet.getRange(12,receiptColumn).setValue('Comprobante');sheet.getRange(row,receiptColumn).setRichTextValue(SpreadsheetApp.newRichTextValue().setText('Ver comprobante').setLinkUrl(receipt.getUrl()).build());return {range:config.zlotoTab+'!'+(receiptColumn===12?'L':'M')+row,receiptUrl:receipt.getUrl()};}
  if(p.kind!=='Cargo'||current[0]!==original[0]||current[1]!==original[1]||Number(current[3])!==Number(original[3]))throw Error('La fila de origen cambió: revisar antes de actualizar');
  sheet.getRange(row,6,1,2).setValues([[p.source.fileSent?'SI':'NO',p.source.delivered?'SI':'NO']]);
  return {range:config.zlotoTab+'!F'+row+':G'+row};
 }
 if(p.kind==='Cargo'){
  row=jdRow_(sheet,'zloto:'+item.entity_id,13,2,7);
  sheet.getRange(row,2,1,6).setValues([[jdText_(p.client),jdText_((p.code?p.code+' · ':'')+p.detail),jdDate_(p.date),p.amount,p.source&&p.source.fileSent?'SI':'NO',p.source&&p.source.delivered?'SI':'NO']]);
  return {range:config.zlotoTab+'!B'+row+':G'+row};
 }
 if(String(sheet.getRange('L12').getValue())!=='Comprobante')throw Error('Actualizá el conector y ejecutá conectarJD para ubicar el comprobante junto al monto.');
 const receipt=jdReceipt_(item,config);row=jdRow_(sheet,'zloto:'+item.entity_id,13,9,13);
 sheet.getRange('L12').setValue('Comprobante');sheet.getRange('M12').setValue('Cliente');
 sheet.getRange(row,9,1,3).setValues([[jdText_(p.method),jdDate_(p.date),p.amount]]);sheet.getRange(row,13).setValue(jdText_([p.code,p.client,p.detail].filter(Boolean).join(' · ')));
 if(receipt)sheet.getRange(row,12).setRichTextValue(SpreadsheetApp.newRichTextValue().setText('Ver comprobante').setLinkUrl(receipt.getUrl()).build());
 return {range:config.zlotoTab+'!I'+row+':M'+row,receiptUrl:receipt?receipt.getUrl():null};
}
function sincronizarJD(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 try{const data=jdApi_('sheet-pull');for(const item of data.entries){
  let result;try{result=Object.assign({status:'synced'},jdWrite_(item,data.config));}catch(e){result={status:'conflict',error:String(e.message||e)};}
  jdApi_('sheet-ack',Object.assign({id:item.id,updatedAt:item.updated_at},result));
 }}finally{lock.releaseLock();}
}
