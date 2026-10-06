
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const BASE = "https://www.graficab612.com";
const ALLOWED_ORIGINS = new Set([
  "https://judaicadesign.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:5500"
]);
const VALID_QTY = new Set([50,75,100,150]);

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

    const format=String(payload.format ?? "Tríptico");
    const qty=Number(payload.qty);
    const isTrip=/tr[ií]ptico/i.test(format);
    const isDip=/d[ií]ptico/i.test(format);
    if(!isTrip && !isDip) return json({ok:false,error:"B612 en vivo está habilitado para Díptico y Tríptico."},422,origin);

    const cfg=isTrip
      ? {label:"Tríptico",categoryId:23,cotId:14,sourcePath:"/cotizador-tripticos.htm",defaultWidth:290,defaultHeight:140,defaultClosedWidth:100,defaultClosedHeight:140}
      : {label:"Díptico",categoryId:8,cotId:4,sourcePath:"/cotizador-dipticos.htm",defaultWidth:200,defaultHeight:140,defaultClosedWidth:100,defaultClosedHeight:140};

    const width=Number(payload.openWidthMm ?? cfg.defaultWidth);
    const height=Number(payload.openHeightMm ?? cfg.defaultHeight);
    const closedWidth=Number(payload.closedWidthMm ?? cfg.defaultClosedWidth);
    const closedHeight=Number(payload.closedHeightMm ?? cfg.defaultClosedHeight);

    if(!VALID_QTY.has(qty)) return json({ok:false,error:"Cantidad no habilitada. Usá 50, 75, 100 o 150."},422,origin);
    if(!(width>0 && height>0 && closedWidth>0 && closedHeight>0))
      return json({ok:false,error:"La ficha técnica necesita medidas abiertas y cerradas válidas."},422,origin);

    const setup = await getJson("/api/cotizador/get?idCategoria="+cfg.categoryId);
    const cot = Array.isArray(setup) ? setup[0] : (setup?.cotizador ?? setup);
    if(Number(cot?.id)!==cfg.cotId) throw new Error("B612 cambió la configuración del cotizador de "+cfg.label+".");

    const categoryId=Number(cot?.categoria?.id ?? cfg.categoryId);
    const stages=await getJson("/api/cotizador/"+cfg.cotId+"/etapas");
    const stageIds=(Array.isArray(stages)?stages:[])
      .filter((x:any)=>x?.activo!==false && x?.articuloEtapa?.activo!==false)
      .map((x:any)=>Number(x?.articuloEtapa?.id))
      .filter((x:number)=>Number.isFinite(x));
    if(!stageIds.length) throw new Error("B612 no devolvió las etapas activas del cotizador de "+cfg.label+".");
    const stageArrays=await Promise.all(stageIds.map((id:number)=>getJson("/api/cotizador/etapa/"+categoryId+"/"+id)));
    const all=stageArrays.flat();

    const paper = all.find((x:any)=>x?.articulo?.codigoInterno==="COMBO-FC300-SA3DF" && !x?.fijo);
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

    const lines:any[]=[];
    const add=async(item:any, actualQty:number, label?:string)=>{
      const ln=await pricedLine(item,actualQty,label);
      if(ln){ lines.push(ln); return ln.total; }
      return 0;
    };

    const paperQty=amountFor(Number(paper?.articuloMultiplicaPor?.id),productionQty,postures,paper?.multiplicador,1);
    await add({articulo:resolvedPaper},paperQty,"Ilustración 300 g · full color · doble faz");

    for(const child of all.filter((x:any)=>!x?.fijo && parentMatches(x,Number(paper.articulo.id)))){
      let item=child;
      if(child?.dobleFaz != null && String(child.dobleFaz)!=="null" && Number(child.dobleFaz)!==Number(child?.articulo?.id)){
        const a=await getJson("/api/articulo/"+child.dobleFaz);
        item={...child,articulo:a.articulo};
      }
      const q=amountFor(Number(child?.articuloMultiplicaPor?.id),productionQty,postures,child?.multiplicador,1);
      await add(item,q);
    }

    for(const fixed of all.filter((x:any)=>x?.fijo===true)){
      const q=amountFor(Number(fixed?.articuloMultiplicaPor?.id),productionQty,postures,fixed?.multiplicador,1);
      if(q>0) await add(fixed,q);
    }

    const term = all.find((x:any)=>x?.articulo?.codigoInterno==="COMBO-LAM3-MATEDF" && !x?.fijo);
    if(!term) throw new Error("No se encontró Laminado Mate Doble Faz en B612.");
    const termQty=amountFor(Number(term?.articuloMultiplicaPor?.id),productionQty,postures,term?.multiplicador,1);
    await add(term,termQty,"Laminado mate · doble faz");
    for(const child of all.filter((x:any)=>!x?.fijo && Number(x?.articuloPadre?.id)===Number(term.articulo.id))){
      const q=amountFor(Number(child?.articuloMultiplicaPor?.id),productionQty,postures,child?.multiplicador,1);
      await add(child,q);
    }

    const componentNet=lines.reduce((s,l)=>s+Number(l.total||0),0);
    // El precio web es la suma de los mismos artículos que calcula el cotizador.
    // No aplicar factores/calibraciones: los precios unitarios se consultan en vivo a B612.
    const net=componentNet;
    const vat=net*0.21;
    return json({
      ok:true,supplier:"Gráfica B612",live:true,source:"B612 live",
      sourceUrl:BASE+cfg.sourcePath,fetchedAt:new Date().toISOString(),
      format:cfg.label,requestedQty:qty,productionQty,
      specs:{openWidthMm:width,openHeightMm:height,closedWidthMm:closedWidth,closedHeightMm:closedHeight,paper:"Papel ilustración",weightGsm:300,lamination:"Laminado mate",print:"Full color",sides:"Doble faz",finish:"Doblez"},
      sheet:{id:paperSheetId,postures,printedSheets:paperQty,coveragePercent:grid?.porcentajeCobertura ?? null},
      componentNet:Number(componentNet.toFixed(2)),net:Number(net.toFixed(2)),vat:Number(vat.toFixed(2)),gross:Number((net+vat).toFixed(2)),lines
    },200,origin);
  } catch(e) {
    return json({ok:false,error:String(e instanceof Error?e.message:e)},502,origin);
  }
});

