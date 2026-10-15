/* Open print-job intake. Extracts explicit facts; never invents supplier prices. */
(function(root){
'use strict';
const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[*_]/g,'').toLowerCase();
const number=s=>Number(String(s).replace(',','.'));
function material(line){const t=normalize(line);const weight=t.match(/\b(\d{2,3})\s*(?:g(?:r(?:s)?)?\.?\b|gramos?\b|gsm\b)/);return {paper:/\bilustracion\b/.test(t)?'Papel ilustración':/\bobra\b/.test(t)?'Papel obra':'',weightGsm:weight?Number(weight[1]):null,print:/\bb\s*[\/.&]\s*n\b|\bblanco y negro\b/.test(t)?'Blanco y negro':/\bfull color\b|\ba color\b/.test(t)?'Full color':'',sides:/\bdoble faz\b|\bdos caras\b/.test(t)?'Doble faz':/\bsimple faz\b|\buna cara\b/.test(t)?'Simple faz':'',lamination:/\bsin lamin/.test(t)?'Sin laminado':/\blamin/.test(t)?(/\bmate\b/.test(t)?'Laminado mate':/\bbrill/.test(t)?'Laminado brillante':'Laminado por confirmar'):''};}
function analyze(message){
 if(typeof message!=='string'||!message.trim()||message.length>20000)throw Error('Pegá un pedido de hasta 20.000 caracteres.');
 const t=normalize(message),lines=t.replace(/\b(tapa|interior|impresion|encuadernacion|cantidad(?: total)? de paginas)\s*:/g,'\n$1:').split(/\n|;/).map(x=>x.trim()).filter(Boolean),cover=lines.find(x=>/^[-\s]*tapa\s*:/.test(x))||'',inside=lines.find(x=>/^[-\s]*interior\s*:/.test(x))||'';
 const common=material(lines.filter(x=>x!==cover&&x!==inside).join('\n')),c=material(cover),i=material(inside);
 const r={version:1,message,description:'',quantities:[],widthMm:null,heightMm:null,sizeScope:'',spineMm:null,totalPages:null,interiorPages:null,coverPages:null,pagesIncludeCover:'',paper:i.paper||common.paper,weightGsm:i.weightGsm||common.weightGsm,print:i.print||common.print,sides:i.sides||common.sides,lamination:i.lamination||'',coverPaper:c.paper,coverWeightGsm:c.weightGsm,coverPrint:c.print||common.print,coverSides:c.sides,coverLamination:c.lamination,coverLaminationSides:/al frente|solo frente|simple faz/.test(cover)?'Solo frente':/doble faz|ambas caras/.test(cover)?'Doble faz':'',bindingOptions:[],models:null,notes:[],hasCover:!!cover};
 r.description=/\blibrit|\blibro/.test(t)?'Libro / librito':/\bmisjag\b/.test(t)?'Misjag':/\btriptico/.test(t)?'Tríptico':/\bcuadriptico/.test(t)?'Cuadríptico':/\bdiptico/.test(t)?'Díptico':/\brevistas?\b/.test(t)?'Revista':/\bimpres|\bcopias?\b/.test(t)?'Impresiones':'Trabajo de imprenta';
 const qs=new Set();
 for(const m of t.matchAll(/\b(\d{1,5}(?:\s*(?:y|,|\/)\s*\d{1,5})*)\s*(?:copias?|(?:ejemplar(?:es)?|unidad(?:es)?))\b/g))for(const v of m[1].match(/\d+/g))qs.add(Number(v));
 for(const m of t.matchAll(/\bcantidad(?: de ejemplares)?\s*:\s*(\d{1,5})\b/g))qs.add(Number(m[1]));
 const headingCounts=[...t.matchAll(/\b(\d{1,5})\s*(?:tripticos?|cuadripticos?|dipticos?|libritos?|libros?|revistas?)\b/g)].map(m=>Number(m[1]));
 if(!qs.size)for(const n of headingCounts)qs.add(n);
 else if(headingCounts.some(n=>!qs.has(n)))r.notes.push('Se usan las cantidades expresadas en unidades, ejemplares o copias ('+[...qs].join(', ')+'); el encabezado menciona '+headingCounts.join(', ')+'. Revisá esta diferencia.');
 for(const m of t.matchAll(/\b(?:un|una)\s+(?:ejemplar|unidad|copia)\b/g))qs.add(1);
 r.quantities=[...qs];
 const dim=t.match(/(\d+(?:[.,]\d+)?)\s*(cm|mm)?\s*(?:\(\s*(alto|ancho)\s*\))?\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm)?\s*(?:\(\s*(alto|ancho)\s*\))?/);
 if(dim){const factor=(dim[2]||dim[5]||'')==='cm'?10:1;if(dim[2]||dim[5]){const a=number(dim[1])*factor,b=number(dim[4])*factor;r.widthMm=dim[3]==='alto'||dim[6]==='ancho'?b:a;r.heightMm=dim[3]==='alto'||dim[6]==='ancho'?a:b;}else r.notes.push('Las medidas no indican cm o mm.');r.sizeScope=/cerrad/.test(t)?'cerrado':/abiert/.test(t)?'abierto':'';}
 const iso=t.match(/\ba\s*([0-6])\b/);if(!dim&&iso){const sizes=[[841,1189],[594,841],[420,594],[297,420],[210,297],[148,210],[105,148]];[r.widthMm,r.heightMm]=sizes[Number(iso[1])];if(/horizontal|apaisad/.test(t))[r.widthMm,r.heightMm]=[r.heightMm,r.widthMm];r.sizeScope=/cerrad/.test(t)?'cerrado':/abiert/.test(t)?'abierto':/libro|librito|revista/.test(t)?'cerrado':'hoja';r.notes.push('A'+iso[1]+' interpretado como '+r.widthMm+' × '+r.heightMm+' mm ('+r.sizeScope+').');}

 const spine=t.match(/(\d+(?:[.,]\d+)?)\s*(cm|mm)\s*(?:de\s*)?lomo/);if(spine)r.spineMm=number(spine[1])*(spine[2]==='cm'?10:1);
 const pages=t.match(/\btotal\s+(\d+)\s*paginas\b/)||t.match(/(?:cantidad(?: total)? de paginas|total(?: de)? paginas)\s*:\s*(\d+)/)||t.match(/\b(?:total\s+)?(\d+)\s*paginas\b/)||t.match(/\bpaginas\s*:\s*(\d+)/);if(pages)r.totalPages=Number(pages[1]);
 const split=t.match(/(\d+)\s*\(\s*(\d+)\s*\+\s*(?:un\s+)?pliego de tapa\s*\)/);if(split){r.totalPages=Number(split[1]);r.interiorPages=Number(split[2]);r.coverPages=r.totalPages-r.interiorPages;r.pagesIncludeCover='Sí';}
 if(/(?:contando|inclu(?:ida|yendo))\s*(?:la\s*)?tapa/.test(t))r.pagesIncludeCover='Sí';
 if(r.pagesIncludeCover==='Sí'&&!r.hasCover){r.hasCover=true;r.coverPaper=common.paper;r.coverWeightGsm=common.weightGsm;r.coverPrint=common.print;r.coverSides=common.sides;r.coverLamination=common.lamination;}
 if(/(?:todas las hojas|todo laminado|full laminado|tapa e interior)/.test(t))r.lamination=common.lamination||i.lamination||c.lamination;
 if(/cosid[ao](?: a hilo)?/.test(t))r.bindingOptions.push('Cosida a hilo');if(/\bbinder\b|lomo (?:cuadrado|pegado)|encolad/.test(t))r.bindingOptions.push('Binder');if(/acaballad|abrochad/.test(t))r.bindingOptions.push('Acaballada');if(/anillad/.test(t))r.bindingOptions.push('Anillada');if(/hojas sueltas|sin encuadernar/.test(t))r.bindingOptions.push('Hojas sueltas');
 const designs=t.match(/\b(\d+)\s*disenos?\b/);if(designs)r.models=Number(designs[1]);
 if(r.totalPages&&r.pagesIncludeCover==='Sí'&&r.hasCover&&!r.interiorPages){r.coverPages=4;r.interiorPages=r.totalPages-4;r.notes.push('Se proponen 4 páginas de tapa; confirmá la ficha.');}
 if(r.description==='Misjag')r.notes.push('Referencia previa: tríptico 447 × 301 mm, Obra 120 g, blanco y negro doble faz. Confirmar si este pedido conserva esa ficha.');
 return r;
}
function canonicalize(input){const r={...input};const map=(key,values)=>{const t=normalize(r[key]).trim();for(const [value,aliases] of values)if(aliases.includes(t)){r[key]=value;break;}};
 for(const k of ['pagesIncludeCover','blankPage'])map(k,[['Sí',['si']],['No',['no']]]);
 for(const k of ['sides','coverSides'])map(k,[['Doble faz',['doble faz','df','dos caras']],['Simple faz',['simple faz','sf','una cara']]]);
 for(const k of ['laminationSides','coverLaminationSides'])map(k,[['Doble faz',['doble faz','df','ambas caras']],['Solo frente',['solo frente','frente','sf','simple faz']]]);
 for(const k of ['print','coverPrint'])map(k,[['Blanco y negro',['blanco y negro','b/n','b&n','bn']],['Full color',['color','a color','full color']]]);
 for(const k of ['paper','coverPaper'])map(k,[['Papel ilustración',['ilustracion','papel ilustracion']],['Papel obra',['obra','papel obra']]]);
 for(const k of ['lamination','coverLamination'])map(k,[['Laminado mate',['mate','laminado mate']],['Laminado brillante',['brillo','brillante','laminado brillo','laminado brillante']],['Sin laminado',['sin laminado','no','ninguno']]]);
 map('sizeScope',[['cerrado',['cerrado','cerrada']],['abierto',['abierto','abierta']],['hoja',['hoja']]]);return r;}
function questions(r){
 const q=[],add=(key,text)=>q.push({key,text});
 if(!r.quantities?.length||r.quantities.some(n=>!Number.isSafeInteger(n)||n<=0))add('quantities','¿Cuántos ejemplares o copias necesitás?');
 if(!r.widthMm||!r.heightMm)add('size','¿Qué tamaño tiene? Podés indicar A4, A5 o ancho × alto en cm o mm.');else if(!r.sizeScope)add('sizeScope','La medida '+r.widthMm+' × '+r.heightMm+' mm, ¿es abierta, cerrada o de la hoja?');
 if(!r.paper)add('paper','¿Qué papel lleva el interior o las hojas?');if(!r.weightGsm)add('weightGsm','¿Qué gramaje lleva ese papel?');if(!r.print)add('print','¿La impresión interior es color o blanco y negro?');if(!r.sides)add('sides','¿Se imprime a una cara o doble faz?');
 if(!r.bindingOptions?.length&&!/^(Díptico|Tríptico|Cuadríptico)$/.test(r.description))add('bindingOptions','¿Se entrega en hojas sueltas o con qué encuadernación?');
 if(r.hasCover){if(!r.coverPaper)add('coverPaper','¿Qué tipo de papel lleva la tapa?');if(!r.coverWeightGsm)add('coverWeightGsm','¿Qué gramaje lleva la tapa?');if(!r.coverPrint)add('coverPrint','¿La tapa se imprime color o blanco y negro?');if(!r.coverSides)add('coverSides','¿La tapa se imprime de un lado o de ambos?');if(r.totalPages&&!r.pagesIncludeCover)add('pagesIncludeCover','¿Las páginas indicadas incluyen las 4 páginas de tapa?');if(r.coverLamination==='Laminado por confirmar')add('coverLamination','¿El laminado de la tapa es mate o brillante?');if(r.coverLamination&&!r.coverLaminationSides)add('coverLaminationSides','¿La tapa se lamina solo al frente o en ambas caras?');}
 if(r.bindingOptions?.some(b=>b!=='Hojas sueltas')&&r.totalPages&&r.totalPages<=8&&r.pageMeaning!=='Caras impresas')add('pageMeaning','¿Las páginas indicadas son caras impresas o cantidad de hojas?');
 if(r.bindingOptions?.some(b=>b!=='Hojas sueltas')&&!r.totalPages)add('totalPages','¿Cuántas páginas tiene cada ejemplar, incluyendo o separando la tapa?');
 if(r.bindingOptions?.includes('Acaballada')&&r.totalPages&&r.pagesIncludeCover==='Sí'&&r.totalPages%4)add('pagination','Para acaballado, el total debe ser múltiplo de 4. ¿Se agregan páginas en blanco?');
 if(r.totalPages%2===1&&r.sides==='Doble faz'&&r.blankPage!=='Sí')add('blankPage','El documento tiene páginas impares. ¿Se agrega una última cara en blanco?');
 return q;
}
function plan(r){return {questions:questions(r),alternatives:(r.bindingOptions?.length?r.bindingOptions:['A confirmar']).flatMap(binding=>(r.quantities||[]).map(qty=>({binding,qty}))),operations:[{kind:'interior',paper:r.paper,weightGsm:r.weightGsm,print:r.print,sides:r.sides,pages:r.interiorPages||(!r.hasCover?r.totalPages:null)},...(r.hasCover?[{kind:'tapa',paper:r.coverPaper,weightGsm:r.coverWeightGsm,print:r.coverPrint,sides:r.coverSides,pages:r.coverPages,lamination:r.coverLamination,laminationSides:r.coverLaminationSides}]:[]),{kind:'refilado'},{kind:'encuadernacion',alternatives:r.bindingOptions}],complete:false};}
const api={analyze,questions,plan,material,canonicalize};root.jdPrintRequest=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
