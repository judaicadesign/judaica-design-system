/** Judaica Design — conector privado. Instalá en un proyecto Apps Script propio.
 * Solo modifica la cuenta Zloto y las filas JD creadas por este conector.
 * No compartas este script: contiene una clave limitada de conexión.
 */
const JD_TOKEN = '__JD_TOKEN__';
const JD_CONNECTOR_VERSION='20261123.1';
const JD_ENDPOINT = 'https://athiruoimehofqzrplnl.supabase.co/functions/v1/client-portal';
function jdApi_(action, data) {
 const response=UrlFetchApp.fetch(JD_ENDPOINT,{method:'post',contentType:'application/json',payload:JSON.stringify(Object.assign({action:action,token:JD_TOKEN},data||{})),muteHttpExceptions:true});
 const out=JSON.parse(response.getContentText());if(response.getResponseCode()>=400||out.ok===false)throw Error(out.error||'No se pudo conectar con JD');return out;
}
function conectarJD() {
 ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
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
function jdRow_(sheet,key,start,first,last,prepareCargo=false) {
 const exportKey=prepareCargo?key.replace(/^zloto:/,'zloto:cargo:'):key;
 const find=value=>sheet.createDeveloperMetadataFinder().withKey('JD_EXPORT_ID').withValue(value).find();
 const found=prepareCargo?find(exportKey).concat(find(key)):find(key);
 if(found.length){if(found.length!==1)throw Error('Referencia duplicada: revisar la planilla');return found[0].getLocation().getRow().getRow();}
 const count=sheet.getMaxRows()-start+1;if(count<1)throw Error('Agregá filas al final de la planilla antes de sincronizar.');const candidates=sheet.getRange(start,first,count,last-first+1);
 const values=candidates.getValues(),formulas=prepareCargo?candidates.getFormulas():null;
 const blank=v=>v===''||v===null;
 let row=-1;
 for(let i=0;i<values.length;i++){
  if(!values[i].every((value,column)=>blank(value)||(prepareCargo&&column>=4&&value==='NO')))continue;
  if(prepareCargo&&(formulas[i].some(Boolean)||sheet.getRange((start+i)+':'+(start+i)).getDeveloperMetadata().some(m=>(m.getKey()==='JD_EXPORT_ID'&&m.getValue().startsWith('zloto:cargo:'))||m.getKey()===JD_ZLOTO_ROW_KEY)))continue;
  row=start+i;break;
 }
 if(row<0)throw Error('No hay una fila vacía disponible. Agregá filas al final y reintentá.');
 if(prepareCargo&&row!==start){
  const template=sheet.getRange(start,first,1,last-first+1),target=sheet.getRange(row,first,1,last-first+1);
  template.copyTo(target,SpreadsheetApp.CopyPasteType.PASTE_FORMAT,false);
  template.copyTo(target,SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION,false);
 }
 sheet.getRange(row+':'+row).addDeveloperMetadata('JD_EXPORT_ID',exportKey);return row;
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
  if(p.kind!=='Pago')throw Error('Usá la conciliación de trabajos para actualizar el cargo.');
  row=p.source.row;
  const original=p.source.original,current=sheet.getRange(row,9,1,5).getValues()[0],clientColumn=String(sheet.getRange('L12').getValue())==='Comprobante'?4:3;
  if(current[0]!==original[0]||Number(current[2])!==Number(original[2])||String(current[clientColumn]||'')!==String(original[3]||''))throw Error('El pago de origen cambió: revisar antes de vincular');
  const receipt=jdReceipt_(item,config);if(!receipt)throw Error('No hay comprobante para vincular');
  const receiptColumn=String(sheet.getRange('L12').getValue())==='Comprobante'?12:13;
  sheet.getRange(12,receiptColumn).setValue('Comprobante');
  sheet.getRange(row,receiptColumn).setRichTextValue(SpreadsheetApp.newRichTextValue().setText('Ver comprobante').setLinkUrl(receipt.getUrl()).build());
  return {range:config.zlotoTab+'!'+(receiptColumn===12?'L':'M')+row,receiptUrl:receipt.getUrl()};
 }
 if(String(sheet.getRange('L12').getValue())!=='Comprobante')throw Error('Actualizá el conector y ejecutá conectarJD para ubicar el comprobante junto al monto.');
 row=jdRow_(sheet,'zloto:'+item.entity_id,13,9,13);
 sheet.getRange('L12').setValue('Comprobante');sheet.getRange('M12').setValue('Cliente');
 sheet.getRange(row,9,1,3).setValues([[jdText_(p.method),jdDate_(p.date),p.amount]]);sheet.getRange(row,13).setValue(jdText_([p.code,p.client,p.detail].filter(Boolean).join(' · ')));
 const receipt=jdReceipt_(item,config);
 if(receipt)sheet.getRange(row,12).setRichTextValue(SpreadsheetApp.newRichTextValue().setText('Ver comprobante').setLinkUrl(receipt.getUrl()).build());
 return {range:config.zlotoTab+'!I'+row+':M'+row,receiptUrl:receipt?receipt.getUrl():null};
}
const JD_ZLOTO_ROW_KEY='JD_ZLOTO_ROW_ID';
const JD_UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function jdZlotoSheet_(config){
 const doc=SpreadsheetApp.openById(config.zloto),sheet=doc.getSheetByName(config.zlotoTab);
 if(!sheet||String(sheet.getRange('B12').getValue()).toLowerCase()!=='cliente')throw Error('Cambió la estructura de la cuenta Zloto');
 return {sheet,zone:doc.getSpreadsheetTimeZone()};
}
function jdCargoValue_(cells,zone){
 const [client,detail,rawDate,amount,fileSent,delivered]=cells;
 const date=rawDate instanceof Date?Utilities.formatDate(rawDate,zone,'yyyy-MM-dd'):null;
 const yes=v=>v===true||/^s[ií]$/i.test(String(v).trim());
 return {client:String(client??''),detail:String(detail??''),date,dateNote:date?null:String(rawDate||'')||null,
  amount:typeof amount==='number'?amount:null,fileSent:yes(fileSent),delivered:yes(delivered)};
}
function jdIndexMetadata_(sheet,key){
 const map=new Map();
 for(const item of sheet.createDeveloperMetadataFinder().withKey(key).find()){
  const range=item.getLocation().getRow();
  if(!range)continue;
  const row=range.getRow(),values=map.get(row)||[];
  values.push(item.getValue());
  map.set(row,values);
 }
 return map;
}
function jdReadCargos_(sheet,zone){
 const length=sheet.getLastRow()-12;
 if(length<1)return [];
 if(length>2000)throw Error('La cuenta supera 2.000 filas; revisá el rango activo de trabajos.');
 const values=sheet.getRange(13,2,length,6).getValues(),ids=jdIndexMetadata_(sheet,JD_ZLOTO_ROW_KEY);
 const exported=jdIndexMetadata_(sheet,'JD_EXPORT_ID');
 return values.flatMap((cells,index)=>{
  if(!cells.slice(0,4).some(v=>v!==''&&v!=null))return [];
  const row=index+13,storedIds=ids.get(row)||[];
  const raw=storedIds[0],id=JD_UUID_PATTERN.test(raw||'')?raw:Utilities.getUuid();
  if(!raw)sheet.getRange(row+':'+row).addDeveloperMetadata(JD_ZLOTO_ROW_KEY,id);
  // Payments share each physical row but only cargo exports are unambiguous here.
  const cargoId=(exported.get(row)||[]).find(v=>v.startsWith('zloto:cargo:'))?.slice('zloto:cargo:'.length);
  const flags=cells.slice(4).every(v=>v===''||v===null||typeof v==='boolean'||/^(s[ií]|no)$/i.test(String(v).trim()));
  const problem=storedIds.length>1||raw&&!JD_UUID_PATTERN.test(raw)?'La fila tiene referencias de conciliación inválidas.':!flags?'Usá SÍ o NO para indicar el estado del trabajo.':null;
  return [{id,row,entryId:JD_UUID_PATTERN.test(cargoId||'')?cargoId:null,value:jdCargoValue_(cells,zone),...(problem?{problem}:{})}];
 });
}
function jdSameCargo_(a,b){
 return !!a&&!!b&&['client','detail','date','dateNote','amount','fileSent','delivered'].every(k=>(a[k]??null)===(b[k]??null));
}
function jdWriteCargo_(item,config){
 const {sheet,zone}=jdZlotoSheet_(config),p=item.payload,binding=item.sheetBinding||{};
 let row,id=binding.id;
 if(id){
  const matches=sheet.createDeveloperMetadataFinder().withKey(JD_ZLOTO_ROW_KEY).withValue(id).find();
  if(matches.length!==1)throw Error('No se encontró una fila única para el cargo. Revisá Conciliación.');
  row=matches[0].getLocation().getRow().getRow();
 }else{
  row=jdRow_(sheet,'zloto:'+item.entity_id,13,2,7,true);
  const existing=sheet.getRange(row+':'+row).getDeveloperMetadata().filter(x=>x.getKey()===JD_ZLOTO_ROW_KEY);
  if(existing.length>1)throw Error('La fila tiene más de una referencia de conciliación.');
  id=existing[0]?.getValue()||Utilities.getUuid();
  if(!existing.length)sheet.getRange(row+':'+row).addDeveloperMetadata(JD_ZLOTO_ROW_KEY,id);
 }
 const target=sheet.getRange(row,2,1,6),cells=target.getValues()[0],current=jdCargoValue_(cells,zone);
 const delivered=p.source?.delivered===true,fileSent=p.source?.fileSent===true;
 const imported=!!p.source?.imported;
 const desired=imported?{...binding.snapshot,fileSent,delivered}:{client:String(p.client||''),detail:(p.code?p.code+' · ':'')+p.detail,date:p.date||null,dateNote:null,amount:p.amount,fileSent,delivered};
 if(!jdSameCargo_(current,desired)){
  if(binding.snapshot?!jdSameCargo_(current,binding.snapshot):cells.slice(0,4).some(v=>v!==''&&v!=null)){
   throw Error('La fila cambió desde la última lectura. Revisá la planilla antes de exportar.');
  }
  if(imported){
   if(!binding.snapshot)throw Error('Primero vinculá el cargo a su fila de Sheets.');
   sheet.getRange(row,6,1,2).setValues([[fileSent?'SI':'NO',delivered?'SI':'NO']]);
  }else{
   target.setValues([[jdText_(desired.client),jdText_(desired.detail),jdDate_(desired.date),desired.amount,fileSent?'SI':'NO',delivered?'SI':'NO']]);
  }
 }
 return {range:config.zlotoTab+'!B'+row+':G'+row,sheetId:id,snapshot:jdCargoValue_(target.getValues()[0],zone)};
}
function jdPaymentTotal_(sheet){
 if(String(sheet.getRange('K12').getValue()).trim().toLowerCase()!=='pagos')throw Error('Cambió la columna de pagos de Zloto.');
 const length=sheet.getLastRow()-12;
 if(length<1)return 0;
 return sheet.getRange(13,9,length,3).getValues().reduce((cents,[method,date,amount])=>{
  if(!method||amount===''||amount===null)return cents;
  if(typeof amount!=='number')throw Error('Revisá los importes de pagos de Zloto.');
  return cents+Math.round(amount*100);
 },0)/100;
}
function sincronizarJD(){
 const lock=LockService.getScriptLock();if(!lock.tryLock(1000))return;
 const version=JD_CONNECTOR_VERSION;
 try{
  const first=jdApi_('sheet-pull',{version}),{sheet,zone}=jdZlotoSheet_(first.config);
  jdApi_('sheet-observe',{version,rows:jdReadCargos_(sheet,zone)});
  const data=jdApi_('sheet-pull',{version});
  let failed=0;
  for(const item of data.entries){
   let result;
   try{
    const cargo=item.destination==='zloto'&&item.payload.kind==='Cargo';
    result=Object.assign({status:'synced'},cargo?jdWriteCargo_(item,data.config):jdWrite_(item,data.config));
   }catch(e){result={status:'conflict',error:String(e.message||e)};}
   try{jdApi_('sheet-ack',Object.assign({id:item.id,updatedAt:item.updated_at},result));}catch(e){failed++;}
  }
  if(failed)throw Error('No se pudieron confirmar '+failed+' movimientos. Se reintentarán sin duplicar filas.');
  jdApi_('sheet-complete',{version,paymentTotal:jdPaymentTotal_(sheet)});
 }finally{lock.releaseLock();}
}
