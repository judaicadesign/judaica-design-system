(function(){
 'use strict';
 const $=id=>document.getElementById(id),core=()=>window.JDPrintPDF;
 let source=null,name='',info=null,originalDoc=null,resultDoc=null,view='original',page=1,outputURL=null,busy=false,renderTask=null,renderVersion=0;
 let enginePromise,markResults=[],marksAnalyzed=false;
 function engine(){return enginePromise||(enginePromise=import('https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/legacy/build/pdf.min.mjs').then(p=>{p.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/legacy/build/pdf.worker.min.mjs';return p;}).catch(e=>{enginePromise=null;throw e;}));}
 async function previewDoc(bytes){const p=await engine();return p.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,cMapUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/cmaps/',cMapPacked:true,standardFontDataUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/standard_fonts/',wasmUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/wasm/'}).promise;}
 function status(text,error=false){$('status').textContent=text;$('status').classList.toggle('error',error);}
 const mm=v=>(v/core().MM).toLocaleString('es-AR',{maximumFractionDigits:2});
 function lock(value){busy=value;$('options').disabled=value;$('pdf-file').disabled=value;$('generate').textContent=value?'Preparando…':'Preparar y ver resultado';}
 function invalidate(){
  $('result-summary').hidden=true;$('plan-details').hidden=true;$('view-result').disabled=true;$('checked-preview').checked=false;$('download').removeAttribute('href');$('download').classList.add('disabled');$('download').setAttribute('aria-disabled','true');
  if(outputURL){URL.revokeObjectURL(outputURL);outputURL=null;}
  if(view==='result'){view='original';page=1;render();}if(resultDoc){resultDoc.destroy();resultDoc=null;}
 }
 function trimSize(){return $('custom-trim').checked?{width:Number($('trim-width').value),height:Number($('trim-height').value)}:undefined;}
 function finding(title,text,action,fn,warn=false){const div=document.createElement('div');div.className='finding'+(warn?' warn':'');const strong=document.createElement('strong'),p=document.createElement('p');strong.textContent=title;p.textContent=text;div.append(strong,p);if(action){const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=action;button.onclick=()=>{if(busy)return;invalidate();fn();};div.append(button);}$('findings').append(div);}
 function review(){
  if(!source)return;info=core().inspect(source.doc,trimSize());$('findings').replaceChildren();
  const first=info.pages[0];finding(info.count+(info.count===1?' página':' páginas'),mm(first.trim.width)+' × '+mm(first.trim.height)+' mm'+(info.mixed?' · Hay medidas diferentes.':' · Medida final uniforme.'),null,null,info.mixed);
  finding(info.hasThreeMM?'Demasía identificada: al menos 3 mm':'No se identifica una demasía de 3 mm',info.hasThreeMM?'Las cajas del PDF dejan espacio suficiente. Revisá visualmente que el fondo se prolongue hasta el borde.':'Las cajas del PDF no identifican 3 mm por lado en todas las páginas. Eso no prueba que no haya demasía dibujada: si la medida de corte no está definida, indicála antes de corregir.',info.hasThreeMM?null:'Elegir cómo completar',()=>{$('bleed').value=3;$('fill').focus();},!info.hasThreeMM);
  const checked=markResults.length===info.count&&!markResults.some(m=>m.status==='not-checked'),detected=markResults.filter(m=>m.status==='detected').length,possible=markResults.filter(m=>m.status==='possible').length;
  if(checked&&detected===info.count)finding('Marcas de corte vectoriales identificadas','Se encontró el patrón de ocho marcas alineadas con el corte en '+detected+(detected===1?' página.':' páginas.')+' Se conservan si no pedís reconstruirlas. La detección es orientativa.');
  else if(checked&&(detected||possible))finding('Marcas identificadas en parte del archivo',detected+' páginas con el patrón completo y '+possible+' con posibles marcas. Revisá las otras páginas antes de reconstruir.',null,null,true);
  else finding(checked?'No se identificaron marcas vectoriales compatibles':marksAnalyzed?'Análisis de marcas no concluyente':'Marcas vectoriales por revisar',checked?'Esto no prueba su ausencia: podrían estar rasterizadas o no alineadas con la medida de corte identificada. Revisá el original.':'Comprobá las marcas respecto de la medida final elegida. Si el análisis no se puede completar, revisá el original visualmente.',checked?'Agregar marcas':'Analizar marcas',checked?()=>{$('marks').checked=true;}:reanalyzeMarks,checked||marksAnalyzed);
  $('booklet-control').hidden=info.count<2;$('single-page-note').hidden=info.count>=2;$('booklet').disabled=info.count<2;if(info.count<2)$('booklet').checked=false;
  $('direction-label').hidden=info.count<2||(!$('booklet').checked&&!$('numbering').checked);
  if(info.rotated)finding('Páginas con rotación interna','Podés revisarlas, pero esta versión requiere reexportarlas con la orientación aplicada para preparar el PDF.',null,null,true);
  $('page-dimensions').replaceChildren();for(const p of info.pages){const row=document.createElement('tr');for(const text of [p.number,mm(p.trim.width)+' × '+mm(p.trim.height)+' mm',mm(Math.min(...Object.values(p.available)))+' mm']){const td=document.createElement('td');td.textContent=text;row.append(td);}$('page-dimensions').append(row);}
  $('booklet-note').textContent=info.blankPages?'Se agregarán '+info.blankPages+' páginas en blanco al final para completar el múltiplo de 4.':'La cantidad de páginas ya es múltiplo de 4.';
 }
 async function scanMarks(){
  markResults=[];const p=await engine();
  for(let i=0;i<info.count;i++){
   try{const page=await originalDoc.getPage(i+1),list=await page.getOperatorList();markResults.push(window.JDPDFMarks.detect(list,p.OPS,info.pages[i].trim));}
   catch{markResults.push({status:'not-checked',count:0});}
   if(i%10===0){status('Revisando marcas: '+(i+1)+' / '+info.count+' páginas…');await new Promise(r=>setTimeout(r,0));}
  }marksAnalyzed=true;
 }
 async function reanalyzeMarks(){lock(true);try{await scanMarks();review();status('Análisis de marcas actualizado.');}catch(e){status(e.message,true);}finally{lock(false);}}
 function foldSettings(){return $('fold-type').value==='none'?null:{panels:Number($('fold-type').value),style:$('fold-style').value,insetMM:Number($('fold-inset').value),positions:$('fold-custom').value,flap:$('fold-flap').value,mirrorBack:$('fold-mirror').checked};}
 function updateFolds(){
  const settings=foldSettings();$('fold-options').hidden=!settings;$('booklet-note').hidden=!$('booklet').checked;$('duplex-note').hidden=!$('booklet').checked;$('direction-label').hidden=!info||info.count<2||(!$('booklet').checked&&!$('numbering').checked);
  $('fold-inset-label').hidden=$('fold-style').value!=='roll';$('fold-flap-label').hidden=$('fold-style').value!=='roll';$('fold-custom-label').hidden=$('fold-style').value!=='custom';
  const roll=$('fold-style').querySelector('[value="roll"]');roll.disabled=$('fold-type').value!=='3';
  if(settings&&info){try{const pos=core().foldPositions(info.pages[0].trim.width/core().MM,settings);$('fold-plan').textContent='Frente: '+pos.map(n=>n.toLocaleString('es-AR',{maximumFractionDigits:2})+' mm').join(' / ')+'.'+(settings.mirrorBack?' Dorso: posiciones reflejadas.':'');}catch(e){$('fold-plan').textContent=e.message;}}
 }
 async function render(){
  const version=++renderVersion,doc=view==='result'?resultDoc:originalDoc;
  if(renderTask){renderTask.cancel();try{await renderTask.promise;}catch{}renderTask=null;}
  if(!doc)return;page=Math.max(1,Math.min(page,doc.numPages));$('page-label').textContent=page+' / '+doc.numPages;$('previous').disabled=page===1;$('next').disabled=page===doc.numPages;
  $('preview-title').textContent=view==='result'?'PDF preparado':'Archivo original';$('view-original').setAttribute('aria-pressed',view==='original');$('view-result').setAttribute('aria-pressed',view==='result');$('preview-status').textContent='Cargando página…';
  try{const p=await doc.getPage(page);if(version!==renderVersion)return;const base=p.getViewport({scale:1}),scale=Math.min(2,1200/Math.max(base.width,base.height)),viewport=p.getViewport({scale}),canvas=$('pdf-preview');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);renderTask=p.render({canvasContext:canvas.getContext('2d'),viewport});await renderTask.promise;if(version===renderVersion){renderTask=null;$('preview-status').textContent=view==='result'?'Revisá corte, fondos y numeración. Podés recorrer todas las páginas antes de descargar.':'Vista del archivo original, antes de aplicar cambios.';}}
  catch(e){if(version===renderVersion&&e.name!=='RenderingCancelledException')$('preview-status').textContent='No se pudo mostrar esta página. Probá cargar nuevamente el archivo.';}
 }
 $('pdf-file').addEventListener('change',async e=>{
  if(busy)return;const file=e.target.files[0];if(!file)return;lock(true);status('Leyendo el PDF…');invalidate();$('editor').hidden=true;source=null;
  try{
   if(file.size>core().MAX_BYTES)throw Error('El archivo supera 200 MB. Exportá una copia más liviana.');if(file.size>75*1024*1024)status('Leyendo un archivo grande. Puede tardar; para este tamaño conviene usar una computadora.');
   const bytes=new Uint8Array(await file.arrayBuffer());if(!new TextDecoder().decode(bytes.slice(0,1024)).includes('%PDF-'))throw Error('El archivo elegido no parece ser un PDF.');
   const doc=await core().load(bytes);source={bytes,doc};name=file.name;markResults=[];marksAnalyzed=false;$('fold-type').value='none';$('fold-style').value='equal';updateFolds();
   $('custom-trim').checked=false;$('trim-width').disabled=true;$('trim-height').disabled=true;$('marks').checked=false;$('numbering').checked=false;$('number-options').hidden=true;$('booklet').checked=false;$('booklet-note').hidden=true;$('duplex-note').hidden=true;$('fill').value='none';$('color-label').hidden=true;
   review();$('bleed').value=info.hasThreeMM?3:0;$('trim-width').value=(info.pages[0].trim.width/core().MM).toFixed(2);$('trim-height').value=(info.pages[0].trim.height/core().MM).toFixed(2);$('number-to').value=info.count;$('number-from').value=1;$('number-from').max=info.count;$('number-to').max=info.count;
   if(originalDoc)await originalDoc.destroy();originalDoc=await previewDoc(bytes);view='original';page=1;$('editor').hidden=false;$('file-name').textContent=name+' · Se procesa en tu dispositivo.';await render();await scanMarks();review();status('Archivo revisado. Elegí las correcciones y la forma de impresión.');
  }catch(e){source=null;status(e.message||'No pudimos abrir el archivo.',true);}finally{lock(false);}
 });
 $('options').addEventListener('input',e=>{invalidate();$('color-label').hidden=$('fill').value!=='color';$('number-options').hidden=!$('numbering').checked;$('booklet-note').hidden=!$('booklet').checked;$('duplex-note').hidden=!$('booklet').checked;$('trim-width').disabled=!$('custom-trim').checked;$('trim-height').disabled=!$('custom-trim').checked;$('direction-label').hidden=!info||info.count<2||(!$('booklet').checked&&!$('numbering').checked);if(e.target.id==='fold-type'&&$('fold-type').value!=='none'){$('booklet').checked=false;$('marks').checked=true;if($('fold-type').value!=='3'&&$('fold-style').value==='roll')$('fold-style').value='equal';}if(e.target.id==='booklet'&&$('booklet').checked)$('fold-type').value='none';updateFolds();if(['custom-trim','trim-width','trim-height'].includes(e.target.id)){try{markResults=[];marksAnalyzed=false;review();status('Medida final actualizada. Revisá el resultado antes de descargar.');}catch(err){status(err.message,true);}}});
 $('prepare-form').addEventListener('submit',async e=>{
  e.preventDefault();if(!source||busy)return;invalidate();lock(true);status('Preparando una copia del PDF…');
  try{
   const options={finalSize:trimSize(),marks:$('marks').checked,bleedMM:Number($('bleed').value),fill:$('fill').value,color:$('fill-color').value,booklet:$('booklet').checked,direction:$('direction').value};
   if(foldSettings())options.folds=foldSettings();
   if($('numbering').checked)options.numbering={from:Number($('number-from').value),to:Number($('number-to').value),start:Number($('number-start').value),position:$('number-position').value,size:Number($('number-size').value),inset:Number($('number-inset').value)};
   const result=await core().prepare(source.bytes,options);resultDoc=await previewDoc(result.bytes);outputURL=URL.createObjectURL(new Blob([result.bytes],{type:'application/pdf'}));$('download').href=outputURL;$('download').download=name.replace(/\.pdf$/i,'')+(options.booklet?'-folleto':'-preparado')+'.pdf';$('result-summary').hidden=false;$('view-result').disabled=false;view='result';page=1;
   $('result-info').textContent=options.booklet?result.pageCount+' caras de impresión · '+(result.pageCount/2)+' hojas · Apertura '+(options.direction==='rtl'?'hebrea':'occidental')+'. Medida de papel mínima con márgenes: '+mm(2*result.info.pages[0].trim.width+2*(options.bleedMM+(options.marks?7:0))*core().MM)+' × '+mm(result.info.pages[0].trim.height+2*(options.bleedMM+(options.marks?7:0))*core().MM)+' mm.':result.pageCount+' páginas preparadas · Demasía: '+options.bleedMM+' mm por lado.';
   $('plan').replaceChildren();if(result.plan){for(const side of result.plan){const line=document.createElement('p');line.textContent='Hoja '+side.sheet+' · '+side.side+' · Izquierda: '+(side.pages[0]??'blanca')+' / Derecha: '+(side.pages[1]??'blanca');$('plan').append(line);}$('plan-details').hidden=false;}
   await render();status('Resultado preparado. Revisalo y confirmá la revisión para descargar.');
  }catch(err){status(err.message||'No se pudo preparar este PDF.',true);}finally{lock(false);}
 });
 $('checked-preview').addEventListener('change',()=>{const enabled=$('checked-preview').checked&&!!outputURL;$('download').classList.toggle('disabled',!enabled);$('download').setAttribute('aria-disabled',!enabled);});
 $('download').addEventListener('click',e=>{if(!$('checked-preview').checked||!outputURL)e.preventDefault();});
 $('view-original').onclick=()=>{view='original';page=1;render();};$('view-result').onclick=()=>{if(resultDoc){view='result';page=1;render();}};
 $('previous').onclick=()=>{page--;render();};$('next').onclick=()=>{page++;render();};
 window.addEventListener('pagehide',()=>{if(outputURL)URL.revokeObjectURL(outputURL);});
})();
