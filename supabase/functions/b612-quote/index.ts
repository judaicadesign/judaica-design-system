
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { quoteB612 } from "../_shared/b612-core.ts";

const ALLOWED_ORIGINS = new Set([
  "https://judaicadesign.github.io",
  "http://localhost:3000",
  "http://127.0.0.1:5500"
]);

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

    const calculated=await quoteB612(payload);
    return json(calculated.body,calculated.status,origin);
  } catch(e) {
    return json({ok:false,error:String(e instanceof Error?e.message:e)},502,origin);
  }
});
