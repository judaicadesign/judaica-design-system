/* Local extraction of explicit printing facts. No AI, network or inferred prices. */
(function(root){
 'use strict';
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const formats=['Díptico','Tríptico','Cuadríptico'];
 // Recurring technical reference, not a supplier tariff or a catalog mutation.
 const recurringProfiles=[{id:'b612-reference-misjag',name:'Misjag',status:'Activo',supplier:'Gráfica B612',models:['Tríptico'],technical:{openWidthMm:447,openHeightMm:301,closedWidthMm:149,closedHeightMm:301,paper:'Papel obra',weightGsm:120,sides:'Doble faz',print:'Blanco y negro'},variants:[{model:'Tríptico',technical:{}}],reference:{order:'1195212',date:'2026-04-20',net:96033.26,qty:300},requiresSupplierMapping:true}];
 const catalogWithProfiles=catalog=>[...(catalog||[]),...recurringProfiles.filter(p=>!(catalog||[]).some(c=>c.id===p.id))];
 const validQuantity=q=>Number.isSafeInteger(q)&&q>=1&&q<=40000;
 const labels={openWidthMm:'ancho abierto',openHeightMm:'alto abierto',closedWidthMm:'ancho cerrado',closedHeightMm:'alto cerrado',paper:'papel',weightGsm:'gramaje',lamination:'laminado',sides:'caras',print:'impresión'};
 function extract(message,catalog){
  if(typeof message!=='string'||!message.trim()||message.length>12000)throw Error('Pegá un pedido de texto de hasta 12.000 caracteres.');
  catalog=catalogWithProfiles(catalog);
  const text=norm(message),warnings=[],result={productId:'',format:'',quantities:[],models:null,spec:{},warnings};
  const found=formats.filter(f=>new RegExp('\\b'+norm(f)+'s?\\b').test(text));
  if(found.length===1)result.format=found[0];
  if(found.length>1)warnings.push('El mensaje mezcla formatos. Prepará una cotización por formato.');
  const profile=recurringProfiles.find(p=>new RegExp('\\b'+norm(p.name)+'\\b').test(text));
  if(profile&&!found.length)result.format=profile.models[0];
  const matches=(catalog||[]).filter(p=>{const name=norm(p.name).replace(/[·]/g,' ').replace(/\s+/g,' ').trim();return text.includes(name)||(p.id==='birkon-folleto'&&/\bbirk(?:on|ones|onim)\b/.test(text)&&found.length===1);});
  if(matches.length===1)result.productId=matches[0].id;
  const nums=new Set();
  for(const m of text.matchAll(/\b(\d{1,5}(?:\s*(?:[,/;]|\by\b|\bo\b)\s*\d{1,5}){1,3})\s*(?:unidades?\b|ejemplares?\b|(?:di|tri|cuadri)pticos?\b)/g))for(const n of m[1].match(/\d+/g)||[])nums.add(Number(n));
  for(const m of text.matchAll(/\b(\d{1,5})\s*(?:u\.?\b|unidades?\b|ejemplares?\b|(?:di|tri|cuadri)pticos?\b)/g))nums.add(Number(m[1]));
  for(const m of text.matchAll(/\bcantidades?\s*[:=]?\s*((?:\d{1,5}\s*(?:[,/;]|\by\b|\bo\b)?\s*)+)/g))for(const n of m[1].match(/\d+/g)||[])nums.add(Number(n));
  if(profile)for(const m of text.matchAll(/\bmisjag\s*(?:x|:|=)?\s*(\d{1,5})(?!\d)(?:\s*(?:y|,|\/)\s*(\d{1,5})(?!\d))?/g)){nums.add(Number(m[1]));if(m[2])nums.add(Number(m[2]));}
  result.quantities=[...nums];
  const designs=[...text.matchAll(/\b(\d{1,2})\s*disenos?\b/g)].map(m=>Number(m[1]));
  if(/\bun (?:unico )?diseno\b|\bdiseno unico\b/.test(text))designs.push(1);
  if(new Set(designs).size===1)result.models=designs[0];
  if(new Set(designs).size>1)warnings.push('Se encontraron distintas cantidades de diseños. Confirmá el total.');
  for(const [word,prefix] of [['abierto','open'],['cerrado','closed']]){
   const all=[...text.matchAll(new RegExp('\\b'+word+'\\s*[:=]?\\s*(\\d+(?:[.,]\\d+)?)\\s*[x×]\\s*(\\d+(?:[.,]\\d+)?)\\s*(mm|cm)\\b','g'))];
   if(all.length===1){const factor=all[0][3]==='cm'?10:1;result.spec[prefix+'WidthMm']=Number(all[0][1].replace(',','.'))*factor;result.spec[prefix+'HeightMm']=Number(all[0][2].replace(',','.'))*factor;}
   if(all.length>1)warnings.push('Confirmá las medidas en '+word+': aparece más de una medida.');
  }
  if(/\bobra\b/.test(text))result.spec.paper='Papel obra';else if(/\bilustracion\b/.test(text))result.spec.paper='Papel ilustración';
  const weights=[...text.matchAll(/\b(\d{2,3})\s*(?:g\b|grs?\.?\b|gramos?\b|gsm\b)/g)].map(m=>Number(m[1]));
  if(new Set(weights).size===1)result.spec.weightGsm=weights[0];
  if(new Set(weights).size>1)warnings.push('El pedido tiene varios gramajes. Revisá la ficha antes de consultar.');
  if(/\bsin (?:laminado|laminar)\b/.test(text))result.spec.lamination='Sin laminado';else if(/\bbrillante\b/.test(text))result.spec.lamination='Laminado brillante';else if(/\bmate\b/.test(text))result.spec.lamination='Laminado mate';
  if(/\bsimple faz\b|\buna cara\b/.test(text))result.spec.sides='Simple faz';else if(/\bdoble faz\b|\bdos caras\b/.test(text))result.spec.sides='Doble faz';
  if(/\bblanco y negro\b|\bb\s*&\s*n\b/.test(text))result.spec.print='Blanco y negro';else if(/\bfull color\b|\ba color\b/.test(text))result.spec.print='Full color';
  if(/\b(?:librito|tapa|interior|paginas|iman|troquel|barniz|foil|sectorizado|puntas redondeadas|sin doblez)\b/.test(text))warnings.push('El mensaje incluye materiales o terminaciones fuera de esta consulta de folletos. Confirmá el alcance antes de continuar.');
  if(/\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?/.test(text)&&!Object.keys(result.spec).some(k=>k.endsWith('Mm')))warnings.push('¿Las medidas del mensaje corresponden al formato abierto o cerrado? Confirmá también la unidad.');
  return result;
 }
 function resolve(request,catalog){
  const product=catalogWithProfiles(catalog).find(p=>p.id===request.productId);
  if(!product||product.status!=='Activo'||!norm(product.supplier).includes('b612'))throw Error('Elegí un producto activo del catálogo con proveedor B612.');
  if(!formats.includes(request.format)||!product.models?.includes(request.format))throw Error('Elegí un formato compatible del producto.');
  const variants=(product.variants||[]).filter(v=>v.model===request.format);
  const spec={},origins={};
  for(const field of Object.keys(labels)){
   const values=variants.map(v=>v.technical?.[field]??product.technical?.[field]).filter(x=>x!==undefined&&x!==null&&x!=='');
   const provided=request.spec?.[field];
   if(provided!==undefined&&provided!==null&&provided!==''){spec[field]=provided;origins[field]='mensaje';}
   else if(new Set(values.map(String)).size===1){spec[field]=values[0];origins[field]=product.reference?'referencia':'catálogo';}
   else{spec[field]='';origins[field]='confirmar';}
  }
  return {product,spec,origins};
 }
 function validate(request,catalog){
  const {product,spec,origins}=resolve(request,catalog);
  if(!request.quantities?.length||request.quantities.length>4||new Set(request.quantities).size!==request.quantities.length||request.quantities.some(q=>!validQuantity(q)))throw Error('Ingresá de 1 a 40.000 unidades por alternativa, sin repetir (máximo 4 alternativas).');
  if(!Number.isInteger(request.models)||request.models<1||request.models>20)throw Error('Confirmá cuántos diseños distintos lleva la tirada (1 a 20).');
  for(const field of ['openWidthMm','openHeightMm','closedWidthMm','closedHeightMm'])if(!Number.isFinite(Number(spec[field]))||Number(spec[field])<=0||Number(spec[field])>2000)throw Error('Confirmá '+labels[field]+' en milímetros.');else spec[field]=Number(spec[field]);
  spec.weightGsm=Number(spec.weightGsm);
  if(product.requiresSupplierMapping)throw Error('Misjag: ficha recurrente reconocida. La tarifa B612 de Obra 120 g en blanco y negro todavía no está disponible en la conexión; no se sustituye por impresión color.');
  if(norm(spec.paper).replace(/^papel /,'')!=='ilustracion'||spec.weightGsm!==300||norm(spec.lamination)!=='laminado mate'||norm(spec.sides)!=='doble faz'||norm(spec.print)!=='full color')throw Error('La conexión actual cotiza ilustración 300 g, full color, doble faz y laminado mate. Otra ficha necesita consulta a B612.');
  return {product,spec,origins};
 }
 const api={extract,resolve,validate,formats,labels,recurringProfiles,catalogWithProfiles,validQuantity};root.jdMessageRequest=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
