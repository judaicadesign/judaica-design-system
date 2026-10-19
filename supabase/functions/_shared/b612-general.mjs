import {quoteCards} from "./b612-cards.mjs";
/* Supplier-backed operation composer. No historical-price extrapolation. */
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const money=n=>Math.round((n+Number.EPSILON)*100)/100;
export class MissingSupplierCost extends Error{}
export async function quotePrintRequest(r,get){
 if(!r||!Array.isArray(r.quantities)||!r.quantities.length||r.quantities.length>4||r.quantities.some(q=>!Number.isSafeInteger(q)||q<1||q>40000))throw Error('Confirmá cantidades enteras entre 1 y 40.000.');
 if(![r.widthMm,r.heightMm].every(x=>Number.isFinite(x)&&x>0&&x<=2000))throw Error('Confirmá las medidas en milímetros.');
 if(!['abierto','cerrado','hoja'].includes(r.sizeScope))throw Error('Confirmá si la medida es abierta, cerrada o de la hoja.');
 for(const key of ['totalPages','interiorPages','coverPages'])if(r[key]!=null&&(!Number.isSafeInteger(r[key])||r[key]<1||r[key]>10000))throw Error('Cantidad de páginas inválida.');
 if(r.hasCover&&r.coverPages!=null&&r.coverPages!==4)throw new MissingSupplierCost('La tapa tiene una paginación especial. Requiere comprobar el proceso con B612.');
 if(!Array.isArray(r.bindingOptions)||r.bindingOptions.length>4||r.bindingOptions.some(x=>typeof x!=='string'||x.length>100))throw Error('Confirmá hasta cuatro alternativas de encuadernación.');
 for(const k of ['paper','coverPaper','description'])if(r[k]!=null&&(typeof r[k]!=='string'||r[k].length>200))throw Error('Descripción de material inválida.');
 if(r.models!=null&&(!Number.isSafeInteger(r.models)||r.models<1||r.models>20))throw Error('Confirmá entre 1 y 20 diseños distintos.');
 if(r.folds!=null&&(!Number.isSafeInteger(r.folds)||r.folds<0||r.folds>6))throw Error('Confirmá entre 0 y 6 dobleces por pieza.');
 if(/tarjetas?/.test(norm(r.description)))return quoteCards(r,get);
 const unsupported=norm(r.message).match(/\b(?:troquel(?:ado)?|foil|barniz(?: uv| sectorizado)?|relieve|plastificado|perforado|tapa dura|puntas redondeadas|esquinas redondeadas)\b/);
 if(unsupported)return {ok:true,action:'quote-request',complete:false,fetchedAt:new Date().toISOString(),alternatives:r.quantities.map(qty=>({qty,binding:r.bindingOptions.join(' / '),status:'requires-supplier',pending:['Falta vincular la terminación «'+unsupported[0]+'» con su operación y tarifa B612. No se omite del precio.']}))};
 const alternatives=[],bindings=r.bindingOptions?.length?r.bindingOptions:[r.description];
 for(const binding of bindings)for(const qty of r.quantities){try{alternatives.push(await compose(r,binding,qty,get));}catch(e){if(!(e instanceof MissingSupplierCost))throw e;alternatives.push({qty,binding,status:'requires-supplier',pending:[e.message]});}}
 return {ok:true,action:'quote-request',fetchedAt:new Date().toISOString(),alternatives,complete:alternatives.every(x=>x.status==='priced')};
}
async function compose(r,binding,qty,get){
 const b=norm(binding),d=norm(r.description);let family,cfg;
 if(/acaball|abroch/.test(b)){family='magazine';cfg={category:68,id:50};}
 else if(/binder/.test(b)){family='book';cfg={category:77,id:62};}
 else if(/cosid/.test(b))throw new MissingSupplierCost('B612 no publica una operación de cosido a hilo verificable. Esta alternativa requiere confirmación; binder se calcula por separado.');
 else if(/triptico|misjag/.test(d)){family='fold';cfg={category:23,id:14};}
 else if(/cuadriptico|postales?/.test(d)){family='quad';cfg={category:105,id:80};}
 else if(/diptico/.test(d)){family='fold';cfg={category:8,id:4};}
 else if(/hojas sueltas/.test(b)){family='sheets';cfg=r.print==='Blanco y negro'?{category:10,id:5}:{category:null,id:20};}
 else throw new MissingSupplierCost('Falta identificar una operación de fabricación B612 para este trabajo. Confirmá encuadernación o terminaciones.');
 if(cfg.category==null){const discovery=await get('/api/cotizador/'+cfg.id+'/etapas');cfg.category=Number(discovery[0]?.cotizador?.categoria?.id);if(!cfg.category)throw new MissingSupplierCost('B612 no devolvió el servicio de impresión solicitado.');}
 const setup=await get('/api/cotizador/get?idCategoria='+cfg.category),cot=Array.isArray(setup)?setup[0]:setup?.cotizador;
 if(Number(cot?.id)!==cfg.id)throw Error('B612 cambió la configuración de '+family+'.');
 const stages=await get('/api/cotizador/'+cfg.id+'/etapas');
 const ids=[...new Set(stages.filter(s=>s.activo!==false&&s.articuloEtapa?.activo!==false).map(s=>Number(s.articuloEtapa.id)))];
 const all=(await Promise.all(ids.map(id=>get('/api/cotizador/etapa/'+cfg.category+'/'+id)))).flat();
 if(family==='magazine'&&!['AB','REF-REVISTA','DOB'].every(code=>all.some(x=>x.fijo&&x.articulo.codigoInterno===code)))throw new MissingSupplierCost('Falta una operación editorial requerida: abrochado, refilado o doblado.');
 if(family==='book'&&!all.some(x=>x.fijo&&/binder|embloc|encolad/.test(norm(x.articulo.nombre+' '+x.articulo.codigoInterno))))throw new MissingSupplierCost('No se encontró la operación de encuadernación binder en los artículos publicados.');
 const extraInventory=family==='fold'||family==='quad'?await get('/api/cotizador/etapa/68/4'):[];
 const inventory=[...all,...extraInventory];
 const bound=family==='magazine'||family==='book',sheet=family==='sheets';
 if(bound&&r.sizeScope!=='cerrado')throw new MissingSupplierCost('Para encuadernar confirmá el tamaño cerrado.');
 if((family==='fold'||family==='quad')&&/sin (?:doblez|doblar)/.test(norm(r.message)))throw new MissingSupplierCost('El pedido indica entrega sin doblar. Confirmá el proceso de impresión y corte sin doblado.');
 const foldCount=family==='quad'?(r.folds??(/cuadriptico/.test(d)?3:null)):null;
 if(family==='quad'&&foldCount==null)throw new MissingSupplierCost('Confirmá cuántos dobleces lleva cada postal.');
 const width=family==='magazine'?r.widthMm*2:family==='fold'||family==='quad'?(r.sizeScope==='abierto'||r.sizeScope==='hoja'?r.widthMm:r.widthMm*(family==='quad'?foldCount+1:cfg.id===14?3:2)):r.widthMm;
 const height=r.heightMm;let sheetId=sheet?1:3,sheetPostures=null,sheetFormat=null,sheetNeedsTrim=![210,297].every((n,i)=>Math.abs(n-[width,height].sort((a,b)=>a-b)[i])<.01);
 if(sheet&&cfg.id===20){
  const sizes=await get('/api/cotizador/'+cfg.id+'/tamanios'),wanted=[width,height].sort((a,b)=>a-b),stock=inventory.filter(x=>!x.fijo&&x.articuloEtapa?.id===4&&norm(x.articulo.nombreLegible).includes(norm(r.paper).replace(/^papel /,''))&&new RegExp('\\b'+r.weightGsm+'\\s*g').test(norm(x.articulo.nombreLegible)));
  const allowed=new Set(stock.map(x=>Number(x.articulo.articuloPapel?.id)).filter(Boolean));
  const fits=(w,h)=>{const bounds=[Number(w),Number(h)].sort((a,b)=>a-b);return wanted.every((n,i)=>n<=bounds[i]);};
  const available=sizes.filter(x=>x.activo!==false&&allowed.has(Number(x.articuloPapel?.id))&&(fits(x.ancho,x.alto)||[x.articuloPapel.ancho,x.articuloPapel.alto].sort((a,b)=>a-b).every((n,i)=>Math.abs(n-wanted[i])<.01))).sort((a,b)=>a.articuloPapel.ancho*a.articuloPapel.alto-b.articuloPapel.ancho*b.articuloPapel.alto);
  sheetNeedsTrim=!sizes.some(x=>[x.articuloPapel?.ancho,x.articuloPapel?.alto].sort((a,b)=>a-b).every((n,i)=>Math.abs(n-wanted[i])<.01));
  const selected=available[0];if(!selected)throw new MissingSupplierCost('No hay un pliego publicado compatible con el papel y tamaño solicitados.');
  sheetId=Number(selected.articuloPapel.id);sheetFormat=selected.nombre;
  // Whole sheet printing uses the published stock, not an A4 imposition grid.
  const physical=[selected.articuloPapel.ancho,selected.articuloPapel.alto].sort((a,b)=>a-b),printable=[Number(selected.ancho),Number(selected.alto)].sort((a,b)=>a-b);
  if(printable.every((n,i)=>Math.abs(n-wanted[i])<.01))sheetNeedsTrim=false;
  if(physical.every((n,i)=>Math.abs(n-wanted[i])<.01)||printable.every((n,i)=>Math.abs(n-wanted[i])<.01)||[297,420].every((n,i)=>Math.abs(n-wanted[i])<.01))sheetPostures=1;
 }

 const grid=async(w,h,id=sheetId)=>{const margins=['Superior','Inferior','Izquierdo','Derecho'].map(k=>'&margen'+k+'='+Number(cot['margen'+k]??5)).join('');const data=await get('/api/grilla/'+h+'/'+w+'?articuloPapel='+id+'&espaciado='+Number(cot.espaciado??3)+margins);if(!Number.isSafeInteger(data.totalElementos)||data.totalElementos<=0)throw new MissingSupplierCost('El tamaño '+w+' × '+h+' mm no entra en el pliego publicado por B612. Requiere otra máquina o producción externa.');return data.totalElementos;};
 const postures=sheetPostures??await grid(width,height);
 const sides=r.sides==='Doble faz'?2:r.sides==='Simple faz'?1:0;if(!sides)throw new MissingSupplierCost('Confirmá las caras de impresión del interior.');
 let interiorPages=r.interiorPages;
 if(bound){if(!r.hasCover)throw new MissingSupplierCost('Confirmá la tapa y sus materiales.');if(r.pagesIncludeCover==='Sí')interiorPages??=Number(r.totalPages)-Number(r.coverPages||4);else if(r.pagesIncludeCover==='No')interiorPages??=r.totalPages;else throw new MissingSupplierCost('Confirmá si las páginas incluyen la tapa.');if(!Number.isSafeInteger(interiorPages)||interiorPages<=0)throw new MissingSupplierCost('Confirmá las páginas interiores.');if(family==='magazine'&&(interiorPages%4!==0||sides!==2))throw new MissingSupplierCost('El interior acaballado debe tener páginas múltiplo de 4, impresas doble faz.');}
 if(sheet&&(!Number.isSafeInteger(r.totalPages)||r.totalPages<=0))throw new MissingSupplierCost('Confirmá cuántas páginas tiene el documento.');
 if(sheet&&r.totalPages%2&&sides===2&&r.blankPage!=='Sí')throw new MissingSupplierCost('El documento tiene páginas impares. Confirmá agregar una última cara en blanco.');
 const material=async(paper,weight,print,sf,id)=>{
  const type=norm(paper).replace(/^papel /,'');if(!type||!Number.isSafeInteger(weight)||weight<=0)throw new MissingSupplierCost('Confirmá papel y gramaje.');
  const isBW=print==='Blanco y negro';if(!isBW&&print!=='Full color')throw new MissingSupplierCost('Confirmá color o blanco y negro.');
  const candidates=inventory.filter(x=>!x.fijo&&!x.articuloPadre&&x.articuloEtapa?.id===4&&norm(x.articulo.nombreLegible).includes(type)&&new RegExp('\\b'+weight+'\\s*g').test(norm(x.articulo.nombreLegible))).filter(x=>isBW?[89,69].includes(Number(x.articulo.rubro.id)):Number(x.articulo.rubro.id)===68).sort((a,b)=>Number(b.articulo.rubro.id)-Number(a.articulo.rubro.id));
  // The vendor uses suffixes - BN and - BK to distinguish print processes.
  const names=candidates.length?candidates.map(x=>({name:x.articulo.nombreLegible,rubro:x.articulo.rubro.id,config:x})):isBW?[{name:(type==='ilustracion'?'Ilustracion':type==='obra'?'Obra':paper)+' '+weight+'grs. - BN',rubro:89},{name:(type==='ilustracion'?'Ilustracion':type==='obra'?'Obra':paper)+' '+weight+'grs. - BK',rubro:69}]:[{name:(type==='ilustracion'?'Ilustracion':type==='obra'?'Obra':paper)+' '+weight+'grs.',rubro:68}];
  for(const c of names){const value=await get('/api/articulo/'+encodeURIComponent(c.name)+'/'+id+'?simpleFaz='+sf+'&esCombo=false&rubroPapel='+c.rubro);const a=value.articulo;if(a?.id&&Number(a.rubro?.id)===Number(c.rubro)&&norm(a.nombreLegible||a.nombre).includes(type)&&new RegExp('\\b'+weight+'\\s*g').test(norm(a.nombreLegible||a.nombre)))return {article:a,config:c.config};}
  throw new MissingSupplierCost('B612 no devolvió tarifa para '+paper+' '+weight+' g, '+print+', '+(sf?'simple':'doble')+' faz en el pliego requerido. No se sustituye por otro papel.');
 };
 const p=await material(r.paper,r.weightGsm,r.print,sides===1,sheetId);
 const pending=[],usedChildren=new Set();let printedSheets=0;
 const add=(article,q,operation)=>{if(!Number.isFinite(q)||q<0)throw Error('Cantidad de operación inválida.');if(q>0)pending.push({article,q:Math.ceil(q),operation});};
 const productionQty=bound||sheet?qty:Math.ceil(qty/postures)*postures;
 const amount=bound?family==='magazine'?qty*interiorPages:qty*Math.ceil(interiorPages/sides):sheet?qty*Math.ceil(r.totalPages/sides):productionQty;
 const amountFor=(x,quantity=amount,posts=postures)=>{const m=x.multiplicador==null?null:Number(x.multiplicador),mode=Number(x.articuloMultiplicaPor?.id);switch(mode){case 1:return quantity*(m??1);case 2:return family==='magazine'?(Number(x.articulo.id)===392?quantity/4:Math.ceil(quantity/(posts*4)*(m??1))):Math.ceil(quantity/posts);case 4:return m??0;case 5:return Math.max(0,Number(r.models||1)-1);case 6:return Math.ceil(quantity/(m||1));case 7:return printedSheets*posts;case 8:return Math.ceil(qty/posts)*(m??1);case 9:return qty*(m??1);default:throw new MissingSupplierCost('Falta validar el multiplicador B612 '+mode+' de '+x.articulo.codigoInterno+'.');}};
 const paperQty=family==='magazine'?Math.ceil(amount/(postures*4)):Math.ceil(amount/postures);printedSheets+=paperQty;add(p.article,paperQty,'Interior / impresión y papel');
 const children=async(config,sf)=>{if(!config)return;const parent=Number(config[sf?'simpleFaz':'dobleFaz']||config.articulo.id);for(const x of all.filter(x=>!x.fijo&&[x.articuloPadre?.id,x.articuloPadreSimpleFaz?.id,x.articuloPadreDobleFaz?.id].some(id=>Number(id)===parent))){const id=Number(x[sf?'simpleFaz':'dobleFaz']||x.articulo.id);if(usedChildren.has(id))continue;usedChildren.add(id);const a=id===Number(x.articulo.id)?x.articulo:(await get('/api/articulo/'+id)).articulo;add(a,amountFor(x),'Preparación de papel');}};
 await children(p.config,sides===1);
 let coverQty=0,coverPostures=postures;
 if(bound){if(!['Simple faz','Doble faz'].includes(r.coverSides))throw new MissingSupplierCost('Confirmá las caras de impresión de la tapa.');const coverSF=r.coverSides==='Simple faz';
  if(family==='book'){if(!Number.isFinite(r.spineMm)||r.spineMm<0)throw new MissingSupplierCost('Confirmá el lomo impreso.');coverPostures=await grid(r.widthMm*2+r.spineMm,r.heightMm,3);}
  const cp=await material(r.coverPaper,r.coverWeightGsm,r.coverPrint,coverSF,3);
  const coverConfig=all.find(x=>!x.fijo&&x.articuloEtapa?.id===7&&norm(x.articulo.nombreLegible)===norm(cp.config?.articulo.nombreLegible));
  // The official magazine calculator prices the cover with its selected COMBO article.
  let article=cp.article;if(family==='magazine'&&coverConfig?.[coverSF?'simpleFaz':'dobleFaz'])article=(await get('/api/articulo/'+Number(coverConfig[coverSF?'simpleFaz':'dobleFaz']))).articulo;
  coverQty=Math.ceil(qty/coverPostures);printedSheets+=coverQty;add(article,coverQty,'Tapa / impresión y papel');await children(cp.config,coverSF);
 }
 if(sheet&&(sheetNeedsTrim||/\b(?:cortad|refilad|corte al)/.test(norm(r.message)))){for(const code of ['C1','CR']){const cut=all.find(x=>x.articulo.codigoInterno===code);if(!cut)throw new MissingSupplierCost('Falta la tarifa de corte '+code+' para entregar las hojas al tamaño pedido.');add(cut.articulo,amountFor(cut),'Corte de hojas al tamaño final');}}
 for(const fixed of all.filter(x=>x.fijo===true))add(fixed.articulo,amountFor(fixed),'Operación incluida por B612');
 const laminations=[];
 const laminate=(value,faces,q,posts)=>{if(!value||value==='Sin laminado')return;if(!/mate|brillante/i.test(value)||!['Solo frente','Simple faz','Doble faz'].includes(faces))throw new MissingSupplierCost('Confirmá tipo y caras del laminado.');laminations.push({value,faces,q,posts});};
 if(bound){laminate(r.coverLamination,r.coverLaminationSides,coverQty,coverPostures);laminate(r.lamination,r.laminationSides||r.sides,paperQty,postures);}else laminate(r.lamination,r.laminationSides||r.sides,paperQty,postures);
 for(const key of [...new Set(laminations.map(x=>x.value+'|'+x.faces))]){const group=laminations.filter(x=>x.value+'|'+x.faces===key);const g=group[0],df=g.faces==='Doble faz';const code=/brillante/i.test(g.value)?df?'COMBO-LAM3-BRILLO-DF':'COMBO-LAM3-BRILLOSF':df?'COMBO-LAM3-MATEDF':'COMBO-LAM3-MATESF';const term=all.find(x=>!x.fijo&&x.articulo.codigoInterno===code);if(!term)throw new MissingSupplierCost('No se encontró el laminado solicitado en este servicio B612.');add(term.articulo,group.reduce((s,x)=>s+x.q,0),g.value+' · '+g.faces);for(const child of all.filter(x=>!x.fijo&&Number(x.articuloPadre?.id)===Number(term.articulo.id)))add(child.articulo,amountFor(child),'Preparación de laminado');}
 if(family==='quad'&&foldCount){const code=foldCount===1?'DOB':'DOBX'+foldCount,fold=all.find(x=>!x.fijo&&x.articulo.codigoInterno===code&&!x.articuloPadre);if(!fold)throw new MissingSupplierCost('Falta el doblado x'+foldCount+'.');add(fold.articulo,amountFor(fold),'Doblado x'+foldCount);await children(fold,false);}
 const lines=await Promise.all(pending.map(async x=>{const price=await get('/api/articulo/'+x.article.id+'/precio/'+x.q);const tier=price.articuloCantidad;if(!tier||!Number.isFinite(Number(tier.precio))||Number(tier.precio)<0)throw new MissingSupplierCost('Falta el precio vigente de '+x.article.codigoInterno);return {id:Number(x.article.id),code:x.article.codigoInterno,name:x.article.nombreLegible||x.article.nombre,operation:x.operation,paperFormat:x.article.articuloPapel?.nombre||'',quantity:x.q,unitPrice:Number(tier.precio),total:money(x.q*Number(tier.precio))};}));
 const net=money(lines.reduce((s,l)=>s+l.total,0));return {status:'priced',qty,binding,live:true,supplier:'Gráfica B612',sourceUrl:'https://www.graficab612.com/cotizador-'+cot.url+'.htm',family,sheetFormat,postures,productionQty,printedSheets,lines,net,vat:money(net*.21),gross:money(net*1.21),validation:'Pendiente de corroboración con B612'};
}
