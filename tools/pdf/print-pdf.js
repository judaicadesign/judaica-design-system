/* PDF preparation runs locally. Original pages remain vector PDF content. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('pdf-lib'));else root.JDPrintPDF=factory(root.PDFLib);})(typeof globalThis!=='undefined'?globalThis:this,function(P){
 'use strict';
 const MM=72/25.4, EPS=.15,MAX_BYTES=200*1024*1024;
 const intersects=(a,b)=>{const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y);return{x,y,width:Math.max(0,Math.min(a.x+a.width,b.x+b.width)-x),height:Math.max(0,Math.min(a.y+a.height,b.y+b.height)-y)};};
 function geometry(page,finalSize){
  const media=page.getMediaBox(),crop=intersects(page.getCropBox(),media);
  let trim=page.node.has(P.PDFName.of('TrimBox'))?page.getTrimBox():crop;
  if(finalSize){const w=Number(finalSize.width)*MM,h=Number(finalSize.height)*MM;if(!(w>0&&h>0&&w<=crop.width+EPS&&h<=crop.height+EPS))throw Error('La medida final debe caber dentro de todas las páginas.');trim={x:crop.x+(crop.width-w)/2,y:crop.y+(crop.height-h)/2,width:w,height:h};}
  if(trim.width<=0||trim.height<=0||Math.abs(intersects(trim,media).width-trim.width)>EPS||Math.abs(intersects(trim,media).height-trim.height)>EPS)throw Error('El tamaño de corte del PDF no es válido.');
  // Without an explicit BleedBox, media outside the crop may contain old marks.
  const bleed=intersects(page.node.has(P.PDFName.of('BleedBox'))?page.getBleedBox():crop,media);
  const available={left:Math.max(0,trim.x-bleed.x),right:Math.max(0,bleed.x+bleed.width-trim.x-trim.width),bottom:Math.max(0,trim.y-bleed.y),top:Math.max(0,bleed.y+bleed.height-trim.y-trim.height)};
  return{trim,media,available,rotation:((page.getRotation().angle%360)+360)%360};
 }
 async function load(bytes){
  if(!P)throw Error('No se pudo cargar el motor PDF. Recargá la página.');
  if(bytes.byteLength>MAX_BYTES)throw Error('El archivo supera 200 MB.');
  let doc;try{doc=await P.PDFDocument.load(bytes,{updateMetadata:false});}catch(e){throw Error(/encrypt/i.test(String(e))?'El PDF tiene contraseña. Exportá una copia sin protección.':'No se pudo abrir este PDF. Probá exportarlo nuevamente.');}
  if(doc.getPageCount()>400)throw Error('Esta versión admite hasta 400 páginas por archivo.');
  if(doc.catalog.has(P.PDFName.of('AcroForm')))throw Error('Este PDF contiene formularios o firmas. Exportá una copia para impresión sin campos interactivos.');
  return doc;
 }
 function inspect(doc,finalSize){
  const pages=doc.getPages().map((page,i)=>({number:i+1,...geometry(page,finalSize)}));
  const first=pages[0];if(!first)throw Error('El PDF no tiene páginas.');
  const mixed=pages.some(p=>Math.abs(p.trim.width-first.trim.width)>EPS||Math.abs(p.trim.height-first.trim.height)>EPS);
  return{pages,count:pages.length,mixed,rotated:pages.some(p=>p.rotation!==0),blankPages:(4-pages.length%4)%4,hasThreeMM:pages.every(p=>Object.values(p.available).every(v=>v>=3*MM-EPS))};
 }
 function bookletPlan(count,direction='rtl'){
  if(!Number.isInteger(count)||count<1||count>400)throw Error('Cantidad de páginas inválida.');
  const n=Math.ceil(count/4)*4,out=[];
  for(let s=0;s<n/4;s++){
   let front=[n-2*s,1+2*s],back=[2+2*s,n-1-2*s];
   if(direction==='rtl'){front.reverse();back.reverse();}
   out.push({sheet:s+1,side:'Frente',pages:front.map(p=>p>count?null:p)},{sheet:s+1,side:'Dorso',pages:back.map(p=>p>count?null:p)});
  }return out;
 }
 function cropMarks(page,x,y,w,h,b){
  const gap=b+2*MM,len=4*MM;
  for(const px of [x,x+w])for(const py of [y,y+h]){
   const sy=py===y?-1:1,sx=px===x?-1:1;
   page.drawLine({start:{x:px+sx*gap,y:py},end:{x:px+sx*(gap+len),y:py},thickness:.35,color:P.cmyk(0,0,0,1)});
   page.drawLine({start:{x:px,y:py+sy*gap},end:{x:px,y:py+sy*(gap+len)},thickness:.35,color:P.cmyk(0,0,0,1)});
  }
 }
 const bound=(n,min,max,name)=>{n=Number(n);if(!Number.isFinite(n)||n<min||n>max)throw Error(name+' fuera de rango.');return n;};
 function foldPositions(widthMM,settings={}){
  const n=Number(settings.panels);if(![2,3,4].includes(n))throw Error('Elegí díptico, tríptico o cuadríptico.');
  const width=bound(widthMM,10,1500,'Ancho abierto');let positions;
  if(settings.style==='custom')positions=String(settings.positions||'').split(';').map(s=>Number(s.trim().replace(',','.')));
  else if(settings.style==='roll'&&n===3){const inset=bound(settings.insetMM??2,.5,10,'Reducción del panel'),base=(width+inset)/3,short=base-inset;positions=settings.flap==='right'?[base,2*base]:[short,short+base];}
  else if(settings.style==='roll')throw Error('Para este plegado definí las posiciones personalizadas.');
  else positions=Array.from({length:n-1},(_,i)=>width*(i+1)/n);
  if(positions.length!==n-1||positions.some((v,i)=>!Number.isFinite(v)||v<2||v>width-2||(i&&v-positions[i-1]<2)))throw Error('Ingresá '+(n-1)+' posiciones crecientes dentro de la medida abierta, separadas por punto y coma.');
  return positions;
 }
 function foldMarks(page,x,y,h,b,positions){
  const gap=b+2*MM,len=4*MM;
  for(const position of positions)for(const side of [-1,1]){const edge=side<0?y:y+h;page.drawLine({start:{x:x+position,y:edge+side*gap},end:{x:x+position,y:edge+side*(gap+len)},thickness:.4,dashArray:[2,2],color:P.cmyk(0,0,0,1)});}
 }
 async function prepare(bytes,options={}){
  const doc=await load(bytes),info=inspect(doc,options.finalSize);
  if(info.rotated)throw Error('Hay páginas con rotación interna. Exportalas con la orientación aplicada antes de prepararlas.');
  const b=bound(options.bleedMM??0,0,10,'Demasía')*MM,marks=!!options.marks;
  const fill=options.fill||'none';if(!['none','white','color'].includes(fill))throw Error('Tipo de fondo inválido.');
  let color=P.rgb(1,1,1);if(fill==='color'){if(!/^#[0-9a-f]{6}$/i.test(options.color||''))throw Error('Elegí un color válido.');const h=options.color.slice(1);color=P.rgb(parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255);}
  if(fill==='none'&&info.pages.some(p=>!options.aiBleed?.[p.number]&&Object.values(p.available).some(v=>v+EPS<b)))throw Error('Falta contenido para esa demasía. Elegí completar con fondo blanco o color uniforme, o indicá 0 mm para agregar solamente marcas.');
  if(options.booklet&&info.mixed)throw Error('Para imponer, todas las páginas deben tener la misma medida final.');
  if(options.booklet&&info.count<2)throw Error('Un PDF de una página no necesita imposición de libro o revista.');
  if(options.booklet&&options.folds)throw Error('Elegí imposición de libro o marcas de plegado para una pieza abierta.');
  let numbering=null;
  if(options.numbering){const a=options.numbering;numbering={from:bound(a.from,1,info.count,'Primera página'),to:bound(a.to,1,info.count,'Última página'),start:bound(a.start,0,9999,'Número inicial'),size:bound(a.size??10,6,36,'Tamaño de número'),inset:bound(a.inset??7,3,30,'Distancia al corte')*MM,position:a.position||'outside'};if(!Number.isInteger(numbering.from)||!Number.isInteger(numbering.to)||!Number.isInteger(numbering.start)||numbering.to<numbering.from)throw Error('Revisá el rango de numeración.');if(!['outside','center'].includes(numbering.position))throw Error('Posición de número inválida.');}
  const output=await P.PDFDocument.create(),font=numbering?await output.embedFont(P.StandardFonts.Helvetica):null;
  const prepared=[];
  for(const [i,source] of doc.getPages().entries()){
   const pageHex=options.pageColors?.[i+1];
   let pageColor=color;if(pageHex!==undefined){if(!/^#[0-9a-f]{6}$/i.test(pageHex))throw Error('Revisá el color de la página '+(i+1)+'.');pageColor=P.rgb(parseInt(pageHex.slice(1,3),16)/255,parseInt(pageHex.slice(3,5),16)/255,parseInt(pageHex.slice(5,7),16)/255);}
   const g=info.pages[i],t=g.trim,folds=options.folds?foldPositions(t.width/MM,options.folds).map(v=>v*MM):[],pad=b+(marks||folds.length?7*MM:0);
   const preserve=options.preserveMarks!==false&&!marks&&!options.booklet&&!options.folds&&!options.finalSize&&!options.aiBleed;
   const px=preserve?Math.max(b,t.x-g.media.x):pad,py=preserve?Math.max(b,t.y-g.media.y):pad,rightPad=preserve?Math.max(b,g.media.x+g.media.width-t.x-t.width):pad,topPad=preserve?Math.max(b,g.media.y+g.media.height-t.y-t.height):pad;
   const page=output.addPage([t.width+px+rightPad,t.height+py+topPad]);
   page.setTrimBox(px,py,t.width,t.height);page.setBleedBox(px-b,py-b,t.width+2*b,t.height+2*b);
   if(fill!=='none'&&b>0){
    // Only paint outside the cut: original transparent areas stay untouched.
    for(const rect of [{x:px-b,y:py-b,width:t.width+2*b,height:b},{x:px-b,y:py+t.height,width:t.width+2*b,height:b},{x:px-b,y:py,width:b,height:t.height},{x:px+t.width,y:py,width:b,height:t.height}])page.drawRectangle({...rect,color:pageColor});
   }
   if(options.aiBleed?.[i+1]){
    if(!b)throw Error('Indicá la demasía para aplicar la extensión de Adobe.');
    const generated=options.aiBleed[i+1];if(!(generated.bytes instanceof Uint8Array)||generated.bytes.byteLength>20*1024*1024)throw Error('La imagen de demasía no es válida.');
    const image=generated.format==='jpeg'?await output.embedJpg(generated.bytes):await output.embedPng(generated.bytes);
    if(Math.abs(image.width/image.height-(t.width+2*b)/(t.height+2*b))>.005)throw Error('La extensión de Adobe no coincide con la medida de esta página.');
    // Clip generated pixels to four outer strips; never rasterize/change the original page.
    for(const rect of [{x:px-b,y:py-b,w:t.width+2*b,h:b},{x:px-b,y:py+t.height,w:t.width+2*b,h:b},{x:px-b,y:py,w:b,h:t.height},{x:px+t.width,y:py,w:b,h:t.height}]){
     page.pushOperators(P.pushGraphicsState(),P.rectangle(rect.x,rect.y,rect.w,rect.h),P.clip(),P.endPath());
     page.drawImage(image,{x:px-b,y:py-b,width:t.width+2*b,height:t.height+2*b});page.pushOperators(P.popGraphicsState());
    }
   }
   const l=Math.min(b,g.available.left),r=Math.min(b,g.available.right),bottom=Math.min(b,g.available.bottom),top=Math.min(b,g.available.top);
   if(source.node.Contents()){
    const box=preserve?{left:g.media.x,bottom:g.media.y,right:g.media.x+g.media.width,top:g.media.y+g.media.height}:{left:t.x-l,bottom:t.y-bottom,right:t.x+t.width+r,top:t.y+t.height+top};
    const embedded=await output.embedPage(source,box);
    page.drawPage(embedded,{x:px+box.left-t.x,y:py+box.bottom-t.y,width:box.right-box.left,height:box.top-box.bottom});
   }
   if(numbering&&i+1>=numbering.from&&i+1<=numbering.to){
    const text=String(numbering.start+i+1-numbering.from),tw=font.widthOfTextAtSize(text,numbering.size),inset=numbering.inset;
    if(t.width<2*inset+tw||t.height<2*inset+numbering.size)throw Error('El número no cabe con esa distancia al corte.');
    const right=options.direction==='ltr'?(i+1)%2===1:(i+1)%2===0;
    const x=numbering.position==='center'?px+(t.width-tw)/2:right?px+t.width-inset-tw:px+inset;
    page.drawText(text,{x,y:py+inset,font,size:numbering.size,color:P.cmyk(0,0,0,1)});
   }
   if(marks)cropMarks(page,px,py,t.width,t.height,b);
   if(folds.length){const reflected=options.folds.mirrorBack!==false&&i%2===1;foldMarks(page,px,py,t.height,b,reflected?folds.map(v=>t.width-v):folds);}
   prepared.push(page);
  }
  let result=output,plan=null;
  if(options.booklet){
   // Materialize embedded page/font resources before copying them to the sheet PDF.
   await output.flush();
   result=await P.PDFDocument.create();plan=bookletPlan(info.count,options.direction||'rtl');
   const w=info.pages[0].trim.width,h=info.pages[0].trim.height,pad=b+(marks?7*MM:0);
   const embeddedCache=new Map();
   for(const side of plan){
    const sheet=result.addPage([2*w+2*pad,h+2*pad]);sheet.setTrimBox(pad,pad,2*w,h);sheet.setBleedBox(pad-b,pad-b,2*w+2*b,h+2*b);
    for(const [slot,n]of side.pages.entries()){
     if(n===null)continue;const src=prepared[n-1];if(!src.node.Contents())continue;const t=src.getTrimBox(),left=slot===0?b:0,right=slot===1?b:0,key=n+':'+slot;
     let emb=embeddedCache.get(key);if(!emb){emb=await result.embedPage(src,{left:t.x-left,bottom:t.y-b,right:t.x+w+right,top:t.y+h+b});embeddedCache.set(key,emb);}
     sheet.drawPage(emb,{x:pad+slot*w-left,y:pad-b,width:w+left+right,height:h+2*b});
    }
    if(marks)cropMarks(sheet,pad,pad,2*w,h,b);
   }
  }
  result.setTitle(options.booklet?'Folleto listo para imprimir':'PDF preparado para imprimir');result.setCreator('Judaica Design');
  return{bytes:await result.save(),info,plan,pageCount:result.getPageCount()};
 }
 return{MM,MAX_BYTES,load,inspect,prepare,bookletPlan,foldPositions};
});
