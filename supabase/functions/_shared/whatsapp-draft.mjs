import {b612Base} from './jd-b612-base.mjs';

const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
const digits=value=>String(value||'').replace(/\D/g,'');
// Argentina mobile IDs may contain international 9 or the Buenos Aires
// national mobile prefix 15. Preserve the provider's original ID for sending.
const phone=value=>digits(value).replace(/^549(?=\d{10}$)/,'54').replace(/^541115(?=\d{8}$)/,'5411');
const dims=['openWidthMm','openHeightMm','closedWidthMm','closedHeightMm'];
const supported=new Set(['Díptico','Tríptico','Cuadríptico']);
const quantities=new Set([50,75,100,150]);
export function checkApproverMessage(message,approver,now=Date.now()){
 if(!/^\d{6,20}$/.test(phone(approver))||phone(message.sender_wa_id)!==phone(approver))throw Error('Solo se cotizan pedidos reenviados por la persona aprobadora.');
 const age=now-Number(message.message_timestamp)*1000;
 if(!Number.isFinite(age)||age< -60000||age>=24*60*60*1000)throw Error('El pedido necesita un nuevo mensaje para abrir la ventana de respuesta.');
 if(message.message_type!=='text'||!message.body_text?.trim())throw Error('El pedido requiere revisión de su archivo o imagen.');
}

// Preparation only: the authenticated worker must persist/claim the message and
// reserve its AI budget before invoking this function. It has no outbound client.
export async function buildDraft({message,approver,catalog,settings,extract,quoteB612,now=Date.now()}){
 checkApproverMessage(message,approver,now);
 const active=catalog.filter(p=>p.status==='Activo');
 const {request,usage}=await extract(message.body_text,active);
 const product=active.find(p=>p.id===request.productId);
 if(!product||normalize(product.supplier)!=='grafica b612'||!supported.has(request.format)||!product.models?.includes(request.format))throw Error('Producto o formato sin cotizador B612 compatible.');
 if(!Array.isArray(request.quantities)||!request.quantities.length||request.quantities.length>4||request.quantities.some(q=>!quantities.has(q))||new Set(request.quantities).size!==request.quantities.length)throw Error('Las cantidades requieren revisión: B612 admite 50, 75, 100 o 150.');
 if(!Number.isSafeInteger(request.models)||request.models<1||request.models>20)throw Error('Confirmar cantidad de diseños.');
 const variants=(product.variants||[]).filter(v=>v.model===request.format);
 if(!variants.length)throw Error('Falta la ficha técnica del formato en el catálogo.');
 const spec={};
 for(const field of [...dims,'paper','weightGsm','lamination','sides','print']){
  const candidates=variants.map(v=>v.technical?.[field]??product.technical?.[field]).filter(v=>v!==null&&v!==undefined&&v!=='');
  const unique=[...new Set(candidates.map(v=>String(v)))];
  // Do not select a variant arbitrarily when their specifications disagree.
  spec[field]=request[field]??(unique.length===1?candidates[0]:null);
 }
 if(dims.some(k=>typeof spec[k]!=='number'||!Number.isFinite(spec[k])||spec[k]<=0||spec[k]>2000))throw Error('Confirmar medidas abiertas y cerradas.');
 if(normalize(spec.paper).replace(/^papel /,'')!=='ilustracion'||spec.weightGsm!==300||!['mate','laminado mate'].includes(normalize(spec.lamination))||normalize(spec.sides)!=='doble faz'||normalize(spec.print)!=='full color')throw Error('B612 admite ilustración 300 g, full color, doble faz y laminado mate en este circuito.');
 const prices=[];
 // Read the current rule once and retain the same snapshot across alternatives.
 for(const qty of request.quantities){
  const response=await quoteB612({...spec,format:request.format,qty,models:request.models});
  const value=response.body;
  if(response.status!==200||value?.ok!==true||value.live!==true||value.supplier!=='Gráfica B612'||value.requestedQty!==qty||value.models!==request.models)throw Error('No se obtuvo un costo B612 en vivo válido.');
  prices.push({qty,source:value.sourceUrl,fetchedAt:value.fetchedAt,pricing:b612Base(value.net,settings)});
 }
 const ars=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(n);
 const body='BORRADOR PARA TU APROBACIÓN\n'+product.name+' · '+request.format+'\n'+prices.map(p=>p.qty+' unidades: '+ars(p.pricing.price)+' final\nB612 sin IVA: '+ars(p.pricing.net)).join('\n\n')+'\nSin envío. Reenviá el precio final al cliente cuando lo apruebes.';
 return {messageId:message.message_id,to:digits(approver),productId:product.id,format:request.format,spec,models:request.models,prices,usage,body,state:'draft'};
}
