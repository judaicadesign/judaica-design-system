
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ALLOWED = new Set([
  "https://judaicadesign.github.io",
  "https://www.graficab612.com"
]);

function cors(origin: string|null) {
  const o = origin && ALLOWED.has(origin) ? origin : "https://judaicadesign.github.io";
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });

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

  const u = new URL(req.url);
  const target = u.searchParams.get("url") || "https://www.graficab612.com/cotizador-tripticos.htm";
  if (!/^https:\/\/(www\.)?graficab612\.com\//i.test(target)) {
    return new Response(JSON.stringify({error:"target not allowed"}), {status:400, headers:cors(origin)});
  }
  try {
    const r = await fetch(target, {headers:{
      "user-agent":"Mozilla/5.0 (compatible; JudaicaDesignQuoteBot/1.0)",
      "accept":"text/html,application/xhtml+xml"
    }});
    const html = await r.text();
    const scripts = [...html.matchAll(/<script[^>]+src=["']([^"']+)["'][^>]*>/gi)].map(m=>m[1]);
    const forms = [...html.matchAll(/<form\b[^>]*>/gi)].map(m=>m[0]);
    const inputs = [...html.matchAll(/<(?:input|select|option|button)\b[^>]*>/gi)].map(m=>m[0]).slice(0,500);
    const ajaxHints = [...new Set((html.match(/[^"'\s<>]{0,80}(?:ajax|php|json|fetch|precio|cotiz)[^"'\s<>]{0,120}/gi)||[]))].slice(0,200);
    return new Response(JSON.stringify({status:r.status, finalUrl:r.url, scripts, forms, inputs, ajaxHints, htmlStart:html.slice(0,12000)}), {headers:cors(origin)});
  } catch (e) {
    return new Response(JSON.stringify({error:String(e)}), {status:500, headers:cors(origin)});
  }
});

