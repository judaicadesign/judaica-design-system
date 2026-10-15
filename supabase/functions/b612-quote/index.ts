
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {getCardOptions} from "../_shared/b612-cards.mjs";
import {quotePrintRequest} from "../_shared/b612-general.mjs";

const BASE = "https://www.graficab612.com";
const ALLOWED_ORIGINS = new Set([
  "https://judaicadesign.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:5500"
]);
const MAX_QTY = 40000;

function cors(origin: string | null) {
  const allow = origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://judaicadesign.github.io";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
}
function json(body: unknown, status=200, origin: string|null=null) {
  return new Response(JSON.stringify(body), {status, headers:cors(origin)});
}
async function getJson(path: string) {
  const r = await fetch(BASE + path, {
    signal: AbortSignal.timeout(20000),
    headers: {
      "accept":"application/json,text/plain,*/*",
      "user-agent":"Mozilla/5.0 (compatible; JudaicaDesignQuoteBot/1.0; +https://judaicadesign.github.io/)"
    }
  });
  if (!r.ok) throw new Error("B612 HTTP " + r.status + " en " + path);
  return await r.json();
}
function n(v: unknown, fallback=0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}
function amountFor(multId:number, qty:number, postures:number, multiplier:unknown, variants=1) {
  const m = multiplier == null || String(multiplier)==="null" ? null : n(multiplier);
  switch(multId){
    case 1: return Math.ceil(qty * (m ?? 1));
    case 2: return Math.ceil(qty / Math.max(1,postures));
    case 4: return Math.max(0, Math.floor(m ?? 0));
    case 5: return Math.max(0, variants - 1);
    case 6: return qty < (m ?? 1) ? 1 : Math.ceil(qty/(m ?? 1));
    case 7: return qty * postures;
    default: return 0;
  }
}
async function pricedLine(item:any, actualQty:number, label?:string) {
  if (!(actualQty > 0)) return null;
  const id = Number(item?.articulo?.id ?? item?.id);
  const code = item?.articulo?.codigoInterno ?? item?.codigoInterno ?? "";
  const name = label ?? item?.articulo?.nombreLegible ?? item?.articulo?.nombre ?? String(id);
  const data = await getJson("/api/articulo/"+id+"/precio/"+Math.ceil(actualQty));
  const ac = data?.articuloCantidad;
  if (!ac || !Number.isFinite(Number(ac.precio))) throw new Error("B612 no devolvió precio para "+code+" ("+id+")");
  const unit = Number(ac.precio);
  return { id, code, name, quantity:actualQty, pricingTier:Number(ac.cantidad ?? actualQty), unitPrice:unit, total:unit*actualQty };
}
function parentMatches(x:any, parentId:number) {
  return Number(x?.articuloPadre?.id)===parentId ||
         Number(x?.articuloPadreSimpleFaz?.id)===parentId ||
         Number(x?.articuloPadreDobleFaz?.id)===parentId;
}

// Discover vendor options for a confirmed open request. Missing prices stay missing.
async function assessRequest(r:any){
  if(!r||typeof r!=="object"||!Array.isArray(r.quantities)||!r.quantities.length||r.quantities.length>4||r.quantities.some((q:any)=>!Number.isSafeInteger(q)||q<1||q>40000))throw Error("Confirmá las cantidades del pedido.");
  if(![r.widthMm,r.heightMm].every((v:any)=>Number.isFinite(v)&&v>0&&v<=2000))throw Error("Confirmá las medidas en milímetros.");
  if(!Array.isArray(r.bindingOptions)||r.bindingOptions.some((x:any)=>typeof x!=="string"||x.length>100))throw Error("Confirmá las alternativas de encuadernación.");
  const pending:string[]=[],evidence:any[]=[],materials:any[]=[];
  const bindings=r.bindingOptions.map((x:string)=>x.toLowerCase());
  const editorial=bindings.some((b:string)=>/binder|cosid|acaball|abroch/.test(b));
  if(editorial){
    const book=bindings.some((b:string)=>/binder|cosid/.test(b));
    const category=book?77:68;
    const setup=await getJson("/api/cotizador/get?idCategoria="+category);
    const cot=Array.isArray(setup)?setup[0]:setup?.cotizador;
    if(!cot?.id||cot.activo===false)throw Error("B612 no devolvió una configuración editorial activa.");
    evidence.push({name:String(cot.nombre),url:BASE+"/cotizador-"+encodeURIComponent(cot.url)+".htm",contactOnly:cot.soloFormularioDeContactoEnWeb===true});
    const stages=await getJson("/api/cotizador/"+Number(cot.id)+"/etapas");
    const ids=[...new Set((Array.isArray(stages)?stages:[]).filter((x:any)=>x.activo!==false&&x.articuloEtapa?.activo!==false).map((x:any)=>Number(x.articuloEtapa?.id)).filter((x:number)=>Number.isSafeInteger(x)))];
    const arrays=await Promise.all(ids.map(id=>getJson("/api/cotizador/etapa/"+category+"/"+id)));
    const all=arrays.flat();
    const papers=all.filter((x:any)=>!x.fijo&&x.articuloEtapa?.id===4&&x.articulo?.nombreLegible).map((x:any)=>({name:x.articulo.nombreLegible,code:x.articulo.codigoInterno}));
    materials.push(...papers);
    if(cot.soloFormularioDeContactoEnWeb)pending.push("B612 deriva este servicio a cotización por contacto. Su ficha pública no confirma un precio automático para el pedido completo.");
    for(const [part,paper,weight] of [["Interior",r.paper,r.weightGsm],["Tapa",r.coverPaper,r.coverWeightGsm]]){
      if(!paper||!weight)continue;
      const normalize=(v:any)=>String(v).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
      const type=normalize(paper).includes("obra")?"obra":normalize(paper).includes("ilustracion")?"ilustracion":"";
      if(!type||!papers.some((p:any)=>normalize(p.name).includes(type)&&new RegExp("\\b"+Number(weight)+"\\b").test(normalize(p.name))))pending.push(String(part)+": "+paper+" "+weight+" g no aparece entre las opciones consultadas. Hay que confirmar disponibilidad con B612; esto no significa que la imprenta no pueda producirlo.");
    }
  }else pending.push("Falta vincular este trabajo con un servicio y sus artículos B612. La recepción del pedido no está limitada por formato ni por catálogo.");
  if(r.bindingOptions.length>1)pending.push("Cotizar por separado cada alternativa: "+r.bindingOptions.join(" / ")+".");
  pending.push("Falta verificar el costo completo de impresión, papel, refilado, laminados y encuadernación solicitados. No se calculará un total con operaciones faltantes.");
  return {ok:true,action:"assess-request",status:"requires-supplier",summary:"Pedido recibido sin restricción de producto. La fabricación y el precio completo todavía requieren comprobación.",pending,evidence,availableMaterials:materials,fetchedAt:new Date().toISOString()};
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method==="OPTIONS") return new Response("ok",{headers:cors(origin)});

  const token=req.headers.get("authorization");
  const authURL=Deno.env.get("SUPABASE_URL")!;
  const apiKey=Deno.env.get("SUPABASE_ANON_KEY")!;
  if(!token?.startsWith("Bearer ")) return new Response(JSON.stringify({ok:false,error:"Iniciá sesión."}),{status:401,headers:cors(origin)});
  const userResponse=await fetch(authURL+"/auth/v1/user",{headers:{apikey:apiKey,Authorization:token}});
  if(!userResponse.ok) return new Response(JSON.stringify({ok:false,error:"Sesión inválida."}),{status:401,headers:cors(origin)});
  const user=await userResponse.json();
  if(!user.email_confirmed_at || user.is_anonymous) return new Response(JSON.stringify({ok:false,error:"Acceso no autorizado."}),{status:403,headers:cors(origin)});
  const access=await fetch(authURL+"/rest/v1/jd_team_access?select=email&email=eq."+encodeURIComponent(String(user.email).toLowerCase()),{headers:{apikey:apiKey,Authorization:token}});
  if(!access.ok || !(await access.json()).length) return new Response(JSON.stringify({ok:false,error:"Acceso no autorizado."}),{status:403,headers:cors(origin)});
  try {
    let payload:any={};
    if(req.method==="POST") payload=await req.json().catch(()=>({}));
    else payload=Object.fromEntries(new URL(req.url).searchParams.entries());

    if(payload.action==="request-options")return json(await getCardOptions(payload.request,getJson),200,origin);
    if(payload.action==="quote-request"){const cache=new Map<string,Promise<any>>();const read=(path:string)=>{if(!cache.has(path))cache.set(path,getJson(path));return cache.get(path)!;};return json(await quotePrintRequest(payload.request,read),200,origin);}
    if(payload.action==="assess-request")return json(await assessRequest(payload.request),200,origin);

    const format=String(payload.format ?? "Tríptico");
    const qty=Number(payload.qty);
    const isTrip=/^tr[ií]ptico$/i.test(format);
    const isQuad=/^cuadr[ií]ptico$/i.test(format);
    const isDip=/^d[ií]ptico$/i.test(format);
    if(!isTrip && !isDip && !isQuad) return json({ok:false,error:"B612 en vivo está habilitado para Díptico, Tríptico y Cuadríptico."},422,origin);

    const cfg=isQuad
      ? {label:"Cuadríptico",categoryId:105,cotId:80,sourcePath:"/cotizador-postales-con-doblez.htm",defaultWidth:391,defaultHeight:190,defaultClosedWidth:100,defaultClosedHeight:190}
      : isTrip
      ? {label:"Tríptico",categoryId:23,cotId:14,sourcePath:"/cotizador-tripticos.htm",defaultWidth:290,defaultHeight:140,defaultClosedWidth:100,defaultClosedHeight:140}
      : {label:"Díptico",categoryId:8,cotId:4,sourcePath:"/cotizador-dipticos.htm",defaultWidth:200,defaultHeight:140,defaultClosedWidth:100,defaultClosedHeight:140};

    const models=Number(payload.models ?? 1);
    if(!Number.isSafeInteger(models) || models<1 || models>20)
      return json({ok:false,error:"La cantidad de diseños debe ser un entero de 1 a 20."},422,origin);

    const width=Number(payload.openWidthMm ?? cfg.defaultWidth);
    const height=Number(payload.openHeightMm ?? cfg.defaultHeight);
    const closedWidth=Number(payload.closedWidthMm ?? cfg.defaultClosedWidth);
    const closedHeight=Number(payload.closedHeightMm ?? cfg.defaultClosedHeight);

    if(!Number.isSafeInteger(qty) || qty<1 || qty>MAX_QTY) return json({ok:false,error:"La cantidad debe ser un entero de 1 a 40.000."},422,origin);
    // Reject unsupported explicit facts before contacting the supplier.
    const expected:any={paper:"Papel ilustración",weightGsm:300,lamination:"Laminado mate",print:"Full color",sides:"Doble faz"};
    for(const [key,value] of Object.entries(expected)){
      if(payload[key]!=null && String(payload[key])!==String(value))return json({ok:false,error:"Esta ficha de papel, impresión o laminado aún no está conectada a B612. No se sustituye por otra ficha."},422,origin);
    }
    if(![width,height,closedWidth,closedHeight].every(x=>Number.isFinite(x)&&x>0&&x<=2000))
      return json({ok:false,error:"La ficha técnica necesita medidas abiertas y cerradas válidas."},422,origin);

    const setup = await getJson("/api/cotizador/get?idCategoria="+cfg.categoryId);
    const cot = Array.isArray(setup) ? setup[0] : (setup?.cotizador ?? setup);
    if(Number(cot?.id)!==cfg.cotId) throw new Error("B612 cambió la configuración del cotizador de "+cfg.label+".");

    if(qty<Number(cot?.cantidadMinima??1)||qty>Number(cot?.cantidadMaxima??MAX_QTY))return json({ok:false,error:"La cantidad está fuera del rango vigente de B612."},422,origin);
    const categoryId=Number(cot?.categoria?.id ?? cfg.categoryId);
    const stages=await getJson("/api/cotizador/"+cfg.cotId+"/etapas");
    const stageIds=(Array.isArray(stages)?stages:[])
      .filter((x:any)=>x?.activo!==false && x?.articuloEtapa?.activo!==false)
      .map((x:any)=>Number(x?.articuloEtapa?.id))
      .filter((x:number)=>Number.isFinite(x));
    if(!stageIds.length) throw new Error("B612 no devolvió las etapas activas del cotizador de "+cfg.label+".");
    const stageArrays=await Promise.all(stageIds.map((id:number)=>getJson("/api/cotizador/etapa/"+categoryId+"/"+id)));
    const all=stageArrays.flat();

    const paper = all.find((x:any)=>x?.articulo?.codigoInterno==="COMBO-FC300-SA3DF" && !x?.fijo)
      ?? (isQuad ? all.find((x:any)=>x?.articulo?.codigoInterno==="COMBO-FC300-SA3SF" && !x?.fijo && x?.dobleFaz) : null);
    if(!paper) throw new Error("No se encontró Ilustración 300 g, full color doble faz en B612.");

    const paperSheetId=Number(paper?.articulo?.articuloPapel?.id ?? cot?.articuloPapel?.id ?? 3);
    // El cotizador web NO usa el artículo COMBO cuando el tamaño es personalizado.
    // Replica buscarPorArticuloPapel(..., esCombo=false) del JS oficial de B612.
    const paperName=String(paper?.articulo?.nombreLegible||"Ilustracion 300grs.");
    const paperRubro=Number(cot?.rubro?.id ?? paper?.articulo?.rubro?.id ?? 68);
    const resolvedPaperData=await getJson(
      "/api/articulo/"+encodeURIComponent(paperName)+"/"+paperSheetId+
      "?simpleFaz=false&esCombo=false&rubroPapel="+paperRubro
    );
    const resolvedPaper=resolvedPaperData?.articulo;
    if(!resolvedPaper?.id) throw new Error("B612 no devolvió el artículo real para papel personalizado.");
    const spacing=n(cot?.espaciado,3) || 3;
    const mt=n(cot?.margenSuperior,5) || 5, mb=n(cot?.margenInferior,5) || 5, ml=n(cot?.margenIzquierdo,5) || 5, mr=n(cot?.margenDerecho,5) || 5;
    const grid=await getJson("/api/grilla/"+height+"/"+width+"?articuloPapel="+paperSheetId+"&espaciado="+spacing+"&margenSuperior="+mt+"&margenInferior="+mb+"&margenIzquierdo="+ml+"&margenDerecho="+mr);
    const postures=Number(grid?.totalElementos);
    if(!(postures>0)) throw new Error("B612 no devolvió posturas válidas para "+width+"×"+height+" mm.");
    // Igual que el cotizador web de B612: optimizar la tirada al múltiplo de posturas.
    // Ej.: 100 pedidos con 3 posturas por pliego => 102 unidades producidas.
    const productionQty=Math.ceil(qty/postures)*postures;

    // Consultar precios en paralelo: no bloquear la pantalla con una cadena de consultas.
    const pending:any[]=[];
    const add=(item:any, actualQty:number, label?:string)=>{
      if(actualQty>0) pending.push({item,actualQty,label});
    };

    const paperQty=amountFor(Number(paper?.articuloMultiplicaPor?.id),productionQty,postures,paper?.multiplicador,models);
    add({articulo:resolvedPaper},paperQty,"Ilustración 300 g · full color · doble faz");

    for(const child of all.filter((x:any)=>!x?.fijo && parentMatches(x,Number(paper.dobleFaz ?? paper.articulo.id)))){
      let item=child;
      if(child?.dobleFaz != null && String(child.dobleFaz)!=="null" && Number(child.dobleFaz)!==Number(child?.articulo?.id)){
        const a=await getJson("/api/articulo/"+child.dobleFaz);
        item={...child,articulo:a.articulo};
      }
      const q=amountFor(Number(child?.articuloMultiplicaPor?.id),productionQty,postures,child?.multiplicador,models);
      add(item,q);
    }

    for(const fixed of all.filter((x:any)=>x?.fijo===true)){
      const q=amountFor(Number(fixed?.articuloMultiplicaPor?.id),productionQty,postures,fixed?.multiplicador,models);
      if(q>0) add(fixed,q);
    }

    const term = all.find((x:any)=>x?.articulo?.codigoInterno==="COMBO-LAM3-MATEDF" && !x?.fijo);
    if(!term) throw new Error("No se encontró Laminado Mate Doble Faz en B612.");
    const termQty=amountFor(Number(term?.articuloMultiplicaPor?.id),productionQty,postures,term?.multiplicador,models);
    add(term,termQty,"Laminado mate · doble faz");
    for(const child of all.filter((x:any)=>!x?.fijo && Number(x?.articuloPadre?.id)===Number(term.articulo.id))){
      const q=amountFor(Number(child?.articuloMultiplicaPor?.id),productionQty,postures,child?.multiplicador,models);
      add(child,q);
    }

    if(isQuad){
      const fold=all.find((x:any)=>!x?.fijo && x?.articulo?.codigoInterno==="DOBX3" && !x?.articuloPadre);
      if(!fold) throw new Error("B612 no devolvió Doblado x 3; no se puede cotizar el cuadríptico.");
      add(fold,amountFor(Number(fold.articuloMultiplicaPor?.id),productionQty,postures,fold.multiplicador,models),"Doblado x 3");
      for(const child of all.filter((x:any)=>!x?.fijo && parentMatches(x,Number(fold.articulo.id)))){
        add(child,amountFor(Number(child.articuloMultiplicaPor?.id),productionQty,postures,child.multiplicador,models));
      }
    }
    const lines=(await Promise.all(pending.map(({item,actualQty,label})=>pricedLine(item,actualQty,label)))).filter(Boolean);
    const componentNet=lines.reduce((s,l)=>s+Number(l.total||0),0);
    // El precio web es la suma de los mismos artículos que calcula el cotizador.
    // No aplicar factores/calibraciones: los precios unitarios se consultan en vivo a B612.
    const net=componentNet;
    const vat=net*0.21;
    return json({
      ok:true,supplier:"Gráfica B612",live:true,source:"B612 live",
      sourceUrl:BASE+cfg.sourcePath,fetchedAt:new Date().toISOString(),
      format:cfg.label,requestedQty:qty,productionQty,models,supplierCategory:cot.nombre,folds:isQuad?3:isTrip?2:1,
      specs:{openWidthMm:width,openHeightMm:height,closedWidthMm:closedWidth,closedHeightMm:closedHeight,paper:"Papel ilustración",weightGsm:300,lamination:"Laminado mate",print:"Full color",sides:"Doble faz",finish:isQuad?"Doblado x 3":"Doblez"},
      sheet:{id:paperSheetId,postures,printedSheets:paperQty,coveragePercent:grid?.porcentajeCobertura ?? null},
      componentNet:Number(componentNet.toFixed(2)),net:Number(net.toFixed(2)),vat:Number(vat.toFixed(2)),gross:Number((net+vat).toFixed(2)),lines
    },200,origin);
  } catch(e) {
    return json({ok:false,error:String(e instanceof Error?e.message:e)},502,origin);
  }
});

