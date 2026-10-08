/* PDF geometry and typography in points, read from the supplied InDesign master.
   Text and supplied SVG paths remain vectors; only the original mockup is an image. */
(function(root){
 const W=595.275590551,H=841.88976378;
 const colors={paper:'#f4f2ec',ink:'#111111',teal:'#18666b',gold:'#8f7859',rule:'#ab9373',card:'#fbfaf5',legal:'#e6e7e8',circle:'#dcd6c2',footer:'#125b64'};
 const fonts={text:'JDText',medium:'JDMedium',bold:'JDBold',wide:'JDWide',label:'JDLabel',cond:'JDCond',condMedium:'JDCondMedium',title:'JDTitle'};
 let fontPromise;
 async function request(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);try{const r=await fetch(url,{signal:controller.signal});if(!r.ok)throw Error('No se pudo cargar '+url);const consume=method=>async()=>{try{return await r[method]()}finally{clearTimeout(timer)}};return {text:consume('text'),arrayBuffer:consume('arrayBuffer')}}catch(error){clearTimeout(timer);throw error}}
 function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s)}
 async function loadFonts(){
  if(fontPromise)return fontPromise;
  fontPromise=(async()=>{
   const css=await (await request('https://use.typekit.net/ydp7axr.css')).text(),faces=[...css.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(m=>m[1]);
   const requests=[['text','aktiv-grotesk-hebrew',400],['medium','aktiv-grotesk-hebrew',500],['bold','aktiv-grotesk-hebrew',700],['wide','aktiv-grotesk-ex-hebrew',500],['label','aktiv-grotesk-ex-hebrew',800],['cond','aktiv-grotesk-cd-hebrew',300],['condMedium','aktiv-grotesk-cd-hebrew',500]];
   const result=await Promise.all(requests.map(async([key,family,weight])=>{
    const face=faces.find(s=>s.includes('font-family:"'+family+'"')&&s.includes('font-weight:'+weight)&&s.includes('font-style:normal'));
    const url=face?.match(/url\("([^"]+)"\)\s*format\("opentype"\)/)?.[1];if(!url)throw Error('Falta '+family+' '+weight+' en el kit de Adobe.');
    return [key,new Uint8Array(await (await request(url)).arrayBuffer())];
   }));
   const url='https://fonts.gstatic.com/s/librecasloncondensed/v3/flUURrasxYEyVwtcWIsbLunUPow3bHNaxvyEdaQClLYatgOE7C0g4yuo.ttf';
   result.push(['title',new Uint8Array(await (await request(url)).arrayBuffer())]);return Object.fromEntries(result);
  })().catch(e=>{fontPromise=null;throw e});return fontPromise;
 }
 function install(pdf,files){for(const [key,data] of Object.entries(files)){if(data[0]!==0||data[1]!==1||data[2]!==0||data[3]!==0)throw Error('La fuente '+key+' no llegó como TrueType válida. Volvé a intentar.');const file=fonts[key]+'.ttf';pdf.addFileToVFS(file,base64(data));pdf.addFont(file,fonts[key],'normal');pdf.setFont(fonts[key],'normal');if(typeof pdf.getFont().metadata.characterToGlyph!=='function')throw Error('No se pudo incorporar la fuente '+key+' al PDF.')}}
 function text(pdf,value,x,y,size,font='text',color=colors.ink,tracking=0){pdf.setFont(fonts[font],'normal');pdf.setFontSize(size);pdf.setTextColor(color);pdf.setCharSpace(size*tracking/1000);pdf.text(String(value),x,y);pdf.setCharSpace(0)}
 function width(pdf,value,size,font='text'){pdf.setFont(fonts[font],'normal');pdf.setFontSize(size);return pdf.getTextWidth(value)}
 function wrap(pdf,value,max,size,font='text'){
  const lines=[];for(const paragraph of String(value).split('\n')){let line='';for(const word of paragraph.split(/\s+/).filter(Boolean)){const next=line?line+' '+word:word;if(width(pdf,next,size,font)>max&&line){lines.push(line);line=word}else line=next}lines.push(line)}return lines;
 }
 function rule(pdf,x1,y1,x2,y2,thickness=.367,color=colors.rule){pdf.setDrawColor(color);pdf.setLineWidth(thickness);pdf.line(x1,y1,x2,y2)}
 function vector(pdf,path,x,y,w,h){const shape=root.jdQuoteVectors?.[path];if(!shape)throw Error('Falta el SVG vectorial '+path);const [vx,vy,vw,vh]=shape.viewBox,scale=Math.min(w/vw,h/vh),ox=x+(w-vw*scale)/2,oy=y+(h-vh*scale)/2;pdf.setFillColor(shape.fill||(path.includes('logo')?'#231f20':'#111111'));
  for(const p of shape.paths){pdf.path(p.map(s=>({op:s.op,c:s.c.map((n,i)=>(n-(i%2?vy:vx))*scale+(i%2?oy:ox))})));pdf.fill()}
 }
 function legalLines(pdf,clauses,colWidth){
  const lines=[];for(const clause of clauses){const tokens=[...String(clause.title+'.').split(/\s+/).map(t=>({word:t,font:'condMedium'})),...String(clause.body).split(/\s+/).filter(Boolean).map(t=>({word:t,font:'cond'}))];let line=[],used=0;
   for(const token of tokens){const space=line.length?width(pdf,' ',6,'cond'):0,tw=width(pdf,token.word,6,token.font);if(line.length&&used+space+tw>colWidth){
     const parts=root.jdSpanishHyphenate?.(token.word).split('\u00ad')||[token.word];let split=0;
     for(let i=1;i<parts.length;i++){const prefix=parts.slice(0,i).join(''),suffix=parts.slice(i).join('');if(prefix.length>=2&&suffix.length>=2&&used+space+width(pdf,prefix+'-',6,token.font)<=colWidth)split=i}
     if(split){line.push({...token,word:parts.slice(0,split).join('')+'-'});token.word=parts.slice(split).join('')}
     lines.push({runs:line,last:false});line=[];used=0
    }line.push(token);used+=(line.length>1?width(pdf,' ',6,'cond'):0)+width(pdf,token.word,6,token.font)}
   if(line.length)lines.push({runs:line,last:true});lines.push({gap:1.4173228346456694});
  }return lines;
 }
 function legalLayout(pdf,clauses){
  const x=34.0158,columnWidth=164.764,gutter=14.456,bottom=785.197,lines=legalLines(pdf,clauses,columnWidth);
  for(let lift=0;lift<=110;lift++){
   const top=603.779-lift;let col=0,baseline=top+11.0024331;const result=[];
   for(const line of lines){if(line.gap){baseline+=line.gap;continue}if(baseline>bottom){col++;baseline=top+11.0024331}result.push({...line,col,x:x+col*(columnWidth+gutter),y:baseline,width:columnWidth});baseline+=8}
   if(col<=2){result.top=top;result.lift=lift;return result}
  }
  throw Error('Los legales superan el espacio de tres columnas a 6 pt. Dividí el documento o abreviá las cláusulas; no se recorta ni reduce la letra.');
 }
 function drawLegal(pdf,clauses){if(!clauses.length)return;const lines=legalLayout(pdf,clauses);pdf.setFillColor(colors.legal);pdf.rect(24.252,lines.top,546.772,790.866-lines.top,'F');rule(pdf,208.028,616.167-lines.lift,208.028,780.264,.25);rule(pdf,387.248,616.167-lines.lift,387.248,780.264,.25);
  for(const line of lines){const natural=line.runs.reduce((n,r)=>n+width(pdf,r.word,6,r.font),0),spaces=line.runs.length-1,space=spaces?(line.last?width(pdf,' ',6,'cond'):(line.width-natural)/spaces):0;let x=line.x;for(const r of line.runs){text(pdf,r.word,x,line.y,6,r.font);x+=width(pdf,r.word,6,r.font)+space}}
 }
 function readSheet(sheet){return{
  title:sheet.querySelector('.jd-doc-title')?.textContent||'',overline:sheet.querySelector('.jd-overline')?.textContent||'PRESUPUESTO',client:sheet.querySelector('.jd-client-meta b')?.textContent||'—',date:sheet.querySelectorAll('.jd-client-meta b')[1]?.textContent||'',
  mock:sheet.querySelector('.jd-pdf-product-img')?.getAttribute('src')||'',contentTitle:sheet.querySelector('.jd-content-box h4')?.textContent||'',content:[...sheet.querySelectorAll('.index-list li')].map(el=>el.textContent),
  specs:[...sheet.querySelectorAll('.jd-spec-icon-row')].filter(el=>!el.querySelector('.jd-tech')).map(el=>({title:el.querySelector('small')?.textContent||'',value:el.querySelector('strong')?.textContent||'',icon:el.querySelector('img')?.getAttribute('src')})),
  technical:[...sheet.querySelectorAll('.jd-tech span')].map(el=>el.textContent),
  prices:[...sheet.querySelectorAll('.jd-client-price')].map(el=>({qty:el.querySelector(':scope>span')?.textContent||'',total:el.querySelector('.jd-pdf-price-breakdown b')?.textContent||'',adjustments:[...el.querySelectorAll('.jd-pdf-price-breakdown small')].map(el=>el.textContent)})),
  discount:sheet.querySelector('.jd-discount-note')?.textContent||'',legal:[...sheet.querySelectorAll('.jd-full-legal p')].map(el=>({title:(el.querySelector('b')?.textContent||'').replace(/\.$/,''),body:el.textContent.slice(el.querySelector('b')?.textContent.length||0).trim()}))
 }}
 async function imageData(source){if(source.startsWith('data:'))return source;const response=await request(source);return new Uint8Array(await response.arrayBuffer())}
 function mockPlacement(info,bounds){const factor=Math.min(476.354/info.width,355.530/info.height),w=info.width*factor,h=info.height*factor,center=bounds?(bounds.left+bounds.right)/2:info.width/2;return{x:(24.252+380.787)/2-center*factor,y:116.5+(355.530-h)/2,w,h}}
 async function opaqueBounds(data,info){
  if(typeof createImageBitmap!=='function'||typeof document==='undefined')return null;
  let bitmap;try{const blob=typeof data==='string'?await (await fetch(data)).blob():new Blob([data]);bitmap=await createImageBitmap(blob);const canvas=document.createElement('canvas'),scale=Math.min(1,512/info.width);canvas.width=Math.ceil(info.width*scale);canvas.height=Math.ceil(info.height*scale);const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let left=canvas.width,right=0,count=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>=230){left=Math.min(left,x);right=Math.max(right,x+1);count++}return count?{left:left/canvas.width*info.width,right:right/canvas.width*info.width}:null}catch(e){return null}finally{bitmap?.close()}
 }
 function contactIcon(pdf,name,x,y,w,h){vector(pdf,'footer-'+name,x,y,w,h)}
 async function drawSheet(pdf,m,page,total){
  pdf.setFillColor(colors.paper);pdf.rect(0,0,W,H,'F');
  if(m.mock){const data=await imageData(m.mock),info=pdf.getImageProperties(data),box=await opaqueBounds(data,info),placement=mockPlacement(info,box);pdf.addImage(data,info.fileType,placement.x,placement.y,placement.w,placement.h)}
  vector(pdf,'assets/jd-logo-quote.svg',33.759,32.0,54.0,40.67);
  text(pdf,m.overline,106.790,34.814,7.291296893,'wide',colors.gold,120);
  const parts=m.title.split('·');text(pdf,parts[0].trim(),106.790,74.916,36.456484466,'title',colors.teal,10);
  if(parts[1]){const x=106.790+width(pdf,parts[0].trim()+' ',36.456484466,'title')+parts[0].trim().length*.364564845; text(pdf,'·',x,74.916,36.456484466,'title',colors.rule,10);text(pdf,' '+parts[1].trim(),x+width(pdf,'·',36.456484466,'title')+.364564845,74.916,36.456484466,'title',colors.teal,10)}
  rule(pdf,432.31,50.18,432.31,74.98,.25,colors.gold);rule(pdf,513.78,50.18,513.78,74.98,.25,colors.gold);
  text(pdf,'CLIENTE',436.858,58.504,5.103907825,'label',colors.ink,70);text(pdf,'FECHA',518.326,58.504,5.103907825,'label',colors.ink,70);
  const client=wrap(pdf,m.client,74,7.291296893);client.slice(0,3).forEach((line,i)=>text(pdf,line,436.858,68.712+i*10.2078156505,7.291296893));if(client.length>3)throw Error('El nombre del cliente no cabe en el encabezado.');text(pdf,m.date,518.326,68.712,7.291296893);
  vector(pdf,'master-bsd',565.8791,22.6919,12.1860,4.6460);rule(pdf,24.252,97.552,571.024,97.552,.5,colors.gold);
  const legal=legalLayout(pdf,m.legal);m={...m,_lift:legal.lift};drawContent(pdf,m);drawCard(pdf,m);drawLegal(pdf,m.legal);
  pdf.setFillColor(colors.footer);pdf.rect(0,805.813,W,H-805.813,'F');
  contactIcon(pdf,'behance',39.5,819.75,10.6875,6.6875);text(pdf,'behance.net/JudaicaDesign',53.281,826.782,8.838383838,'wide','#ffffff',26);
  text(pdf,'|',208,826.782,8.838383838,'wide','#ffffff');contactIcon(pdf,'instagram',223.9375,820.1875,10,10);text(pdf,'@JudaicaDesign',237.031,826.782,8.838383838,'wide','#ffffff',26);text(pdf,'|',333,826.782,8.838383838,'wide','#ffffff');contactIcon(pdf,'whatsapp',351.8125,819.4375,9.9375,10.0625);text(pdf,'+54 9 11 5822 4686',364.852,826.782,8.838383838,'wide','#ffffff',26);text(pdf,'» '+page+' / '+total,520.482,827.189,10.3154,'wide','#b8a781',26);
 }
 function drawContent(pdf,m){if(!m.content.length)return;const lines=m.content.map(t=>wrap(pdf,t,169.1,8.5));let best=1,score=Infinity;for(let i=1;i<lines.length;i++){const a=lines.slice(0,i).reduce((n,v)=>n+v.length,0),b=lines.slice(i).reduce((n,v)=>n+v.length,0),s=Math.abs(a-b);if(s<score){best=i;score=s}}
  const cols=[lines.slice(0,best),lines.slice(best)],height=Math.max(...cols.map(col=>col.reduce((n,v)=>n+v.length*13,0)))+38.555;
  const bottom=592.481-(m._lift||0),top=bottom-height;if(top<350)throw Error('El contenido excede el espacio del master a 8,5 pt.');rule(pdf,24.252,top,380.787,top,.5,colors.gold);rule(pdf,24.252,bottom,380.787,bottom,.5,colors.gold);
  text(pdf,m.contentTitle,33.759,top+24.214,18,'title',colors.teal);cols.forEach((col,index)=>{const x=index?213.523:33.759;let y=top+41.466;for(const list of col){text(pdf,'·',x,y,8.5,'medium',colors.rule);list.forEach((line,i)=>{text(pdf,line,x+5.669,y,8.5);y+=13})}});
 }
 function technicalLines(pdf,items){
  const result=[];
  for(const item of items)for(const paragraph of String(item).split('\n')){
   const words=paragraph.trim().match(/- Full color|Full color|\S+/gi)||[];let runs=[],used=0;
   for(let i=0;i<words.length;i++){const font=i===0&&/^(Tapa|Interior):$/i.test(words[i])?'bold':'text';let value=(runs.length?' ':'')+words[i],size=width(pdf,value,6,font);
    if(runs.length&&used+size>117.8){result.push(runs);runs=[];used=0;value=words[i];size=width(pdf,value,6,font)}
    runs.push({text:value,font});used+=size;
   }if(runs.length)result.push(runs);
  }return result;
 }
 function cardLayout(pdf,m){const inner=155.905,valueWidth=121.65;const specs=m.specs.map(s=>({...s,lines:wrap(pdf,s.value,valueWidth,8.75,'medium'),height:Math.max(39.004,23+13*(wrap(pdf,s.value,valueWidth,8.75,'medium').length-1))}));const tech=technicalLines(pdf,m.technical);const prices=m.prices.map(p=>{const multiple=m.prices.length>1,adjustments=p.adjustments.map(s=>s.replace('Precio antes del descuento:','Antes:').replace('−','-')),notes=multiple?wrap(pdf,adjustments.join(' · '),inner,6).filter(Boolean):adjustments.flatMap(s=>wrap(pdf,s,100,6));const lines=wrap(pdf,p.total.replace(/^Total:\s*/,''),inner,11,'bold');const totalOffset=multiple?7+Math.max(1,notes.length)*8+8:10+Math.max(1,notes.length)*8+10;return {...p,lines,notes,multiple,totalOffset,height:totalOffset+14*lines.length+(multiple?-5:12)}});

  const note=m.discount?wrap(pdf,m.discount,inner,5.5):[];const height=Math.max(404.102,52.524+specs.reduce((n,s)=>n+s.height,0)+(tech.length?23.93+tech.length*8+3.5:0)+prices.reduce((n,p)=>n+p.height,0)+(note.length?note.length*7+12:0)+21);
  const bottom=592.481-(m._lift||0),top=bottom-height;if(top<116.5)throw Error('Hay demasiadas cantidades o notas para el master. Agregá otra alternativa para conservar los tamaños originales.');return{specs,tech,prices,note,top,height};
 }
 function drawCard(pdf,m){const l=cardLayout(pdf,m);pdf.setFillColor(colors.card);pdf.setDrawColor(colors.gold);pdf.setLineWidth(.25);pdf.roundedRect(387.874,l.top,173.386,l.height,11.0,11.0,'FD');text(pdf,'DETALLES DEL PRODUCTO',398.815,l.top+26.044,7.291296893,'wide',colors.gold,120);let y=l.top+54.688;
  for(const s of l.specs){pdf.setFillColor(colors.circle);pdf.circle(415.85,y+11.95,12.5,'F');vector(pdf,s.icon,407.15,y+3.25,17.4,17.4);text(pdf,s.title.toUpperCase(),436.134,y+7.836,6,'medium',colors.gold,80);s.lines.forEach((line,i)=>text(pdf,line,436.134,y+20.836+i*13,8.75,'medium'));y+=s.height;rule(pdf,396.85,y-7.62,552.755,y-7.62)}
  if(l.tech.length){pdf.setFillColor(colors.circle);pdf.circle(415.85,y+11.95,12.5,'F');vector(pdf,'assets/quote-icons/13_engranaje.svg',406.8,y+2.9,18.1,18.1);text(pdf,'DETALLES TÉCNICOS',436.134,y+7.836,6,'medium',colors.gold,80);l.tech.forEach((runs,i)=>{let x=436.134;for(const run of runs){text(pdf,run.text,x,y+18.671+i*8,6,run.font);x+=width(pdf,run.text,6,run.font)}});y+=23.93+l.tech.length*8+3.5;rule(pdf,396.85,y-7.62,552.755,y-7.62)}
  for(let index=0;index<l.prices.length;index++){const p=l.prices[index];if(index)rule(pdf,396.85,y-7,552.755,y-7,.25);text(pdf,p.qty,399.543,y+(p.multiple?p.totalOffset:10),7.5,'text',colors.gold);
   p.notes.forEach((line,i)=>text(pdf,line,552.755-width(pdf,line,6),y+(p.multiple?7:10)+i*8,6,'text',colors.gold));
   p.lines.forEach((line,i)=>text(pdf,line,552.755-width(pdf,line,11,'bold'),y+p.totalOffset+i*14,11,'bold',colors.teal));y+=p.height}
  const noteTop=l.top+l.height-16-(l.note.length-1)*7;
  l.note.forEach((line,i)=>text(pdf,line,399.543,noteTop+i*7,5.5,'text',colors.gold));
 }
 const family={JDText:['aktiv-grotesk-hebrew',400],JDMedium:['aktiv-grotesk-hebrew',500],JDBold:['aktiv-grotesk-hebrew',700],JDWide:['aktiv-grotesk-ex-hebrew',500],JDLabel:['aktiv-grotesk-ex-hebrew',800],JDCond:['aktiv-grotesk-cd-hebrew',300],JDCondMedium:['aktiv-grotesk-cd-hebrew',500],JDTitle:['Libre Caslon Condensed',500]};
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
 class SVGDoc{
  constructor(metric){this.metric=metric;this.nodes=[];this.lineWidth=.25;this.fillColor='#111';this.strokeColor='#111';this.textColor='#111';this.charSpace=0;this.font='JDText';this.fontSize=8.5}
  setFont(name){this.font=name;this.metric.setFont(name,'normal')}
  setFontSize(n){this.fontSize=n;this.metric.setFontSize(n)}
  getTextWidth(s){return this.metric.getTextWidth(s)}
  setTextColor(c){this.textColor=c}setFillColor(c){this.fillColor=c}setDrawColor(c){this.strokeColor=c}setLineWidth(n){this.lineWidth=n}setCharSpace(n){this.charSpace=n}
  text(s,x,y){const [font,weight]=family[this.font];this.nodes.push(`<text x="${x}" y="${y}" fill="${this.textColor}" font-family="${font}" font-weight="${weight}" font-size="${this.fontSize}" letter-spacing="${this.charSpace}" style="font-kerning:none;font-variant-ligatures:none">${esc(s)}</text>`)}
  line(x1,y1,x2,y2){this.nodes.push(`<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${this.strokeColor}" stroke-width="${this.lineWidth}"/>`)}
  rect(x,y,w,h,type){this.roundedRect(x,y,w,h,0,0,type)}
  roundedRect(x,y,w,h,rx,ry,type){this.nodes.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${ry}" fill="${type?.includes('F')?this.fillColor:'none'}" stroke="${type?.includes('D')?this.strokeColor:'none'}" stroke-width="${this.lineWidth}"/>`)}
  circle(x,y,r,type){this.nodes.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${type==='F'?this.fillColor:'none'}"/>`)}
  path(ops){this.currentPath=ops.map(s=>s.op.toUpperCase()+s.c.join(' ')).join(' ')}
  fill(){this.nodes.push(`<path d="${this.currentPath}" fill="${this.fillColor}"/>`)}
  getImageProperties(data){return this.metric.getImageProperties(data)}
  addImage(data,type,x,y,w,h){const href=typeof data==='string'?data:'data:image/'+type.toLowerCase()+';base64,'+base64(data);this.nodes.push(`<image href="${esc(href)}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`)}
  output(){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Presupuesto Judaica Design" class="jd-master-art">${this.nodes.join('')}</svg>`}
 }
 let metricPromise;
 async function svgPreview(model,page=1,total=1,options={}){
  if(!metricPromise||options.fonts){metricPromise=(async()=>{const PDF=options.PDF||root.jspdf.jsPDF,pdf=new PDF({unit:'pt'});install(pdf,options.fonts||await loadFonts());return pdf})().catch(e=>{metricPromise=null;throw e})}
  const doc=new SVGDoc(await metricPromise);await drawSheet(doc,model,page,total);return doc.output();
 }
 root.jdQuotePreviewSVG=svgPreview;

 async function generate(sheets,options={}){const PDF=options.PDF||root.jspdf?.jsPDF;if(!PDF)throw Error('No se pudo cargar el generador PDF.');const files=options.fonts||await loadFonts();const pdf=new PDF({orientation:'portrait',unit:'pt',format:'a4',compress:true,putOnlyUsedFonts:true});install(pdf,files);for(let i=0;i<sheets.length;i++){if(i)pdf.addPage('a4','portrait');await drawSheet(pdf,sheets[i].querySelector?readSheet(sheets[i]):sheets[i],i+1,sheets.length)}return options.document?pdf:pdf.output('blob')}
 root.jdNativeQuote={generate,readSheet,legalLayout,legalLines,cardLayout,mockPlacement,fonts,W,H};root.jdVectorQuotePdf=sheets=>generate(sheets);
 if(typeof module!=='undefined')module.exports=root.jdNativeQuote;
})(typeof window!=='undefined'?window:globalThis);
