/* Server-only adapter. Never import this module in a public browser bundle.
   Requires separately provisioned Adobe Firefly Services credentials. */
const BASE='https://firefly-api.adobe.io';
function validateURL(value,kind){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password)throw Error('Adobe devolvió una URL no válida.');if(kind==='status'&&(u.hostname!=='firefly-api.adobe.io'||!u.pathname.startsWith('/v3/status/')))throw Error('Adobe devolvió un estado no válido.');if(kind==='image'&&!(u.hostname.endsWith('.amazonaws.com')||u.hostname.endsWith('.adobe.io')||u.hostname.endsWith('.adobe.com')))throw Error('Adobe devolvió un dominio de imagen no permitido.');return u.href;}
export async function expandBleedImage({png,width,height,insetPixels},{clientId,clientSecret,fetcher=fetch,delay=ms=>new Promise(r=>setTimeout(r,ms)),pollLimit=90}={}){
 if(!clientId||!clientSecret)throw Error('Faltan las credenciales de Adobe Firefly Services. La suscripción de escritorio y el conector de ChatGPT no las sustituyen.');
 if(!(png instanceof Uint8Array)||png.byteLength>10*1024*1024||png.length<24||![137,80,78,71,13,10,26,10].every((v,i)=>png[i]===v))throw Error('La página debe enviarse como PNG de hasta 10 MB.');
 const header=new DataView(png.buffer,png.byteOffset,png.byteLength),sourceWidth=header.getUint32(16),sourceHeight=header.getUint32(20);
 if(![width,height,insetPixels].every(Number.isSafeInteger)||insetPixels<1||insetPixels>200||sourceWidth+2*insetPixels!==width||sourceHeight+2*insetPixels!==height||width>4096||height>4096)throw Error('Revisá las dimensiones de la página y su demasía.');
 async function json(url,options){const r=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(30000)});if(!r.ok){if(r.status===401||r.status===403)throw Error('Adobe no habilitó Firefly Services para estas credenciales.');if(r.status===429)throw Error('Adobe alcanzó su límite de uso. Reintentá más tarde.');throw Error('Adobe no pudo procesar la extensión (HTTP '+r.status+').');}return r.json();}
 const auth=await json('https://ims-na1.adobelogin.com/ims/token/v3',{method:'POST',body:new URLSearchParams({grant_type:'client_credentials',client_id:clientId,client_secret:clientSecret,scope:'openid,AdobeID,session,additional_info,read_organizations,firefly_api,ff_apis'})});
 if(!auth.access_token)throw Error('Adobe no devolvió autorización para Firefly Services.');
 const headers={Authorization:'Bearer '+auth.access_token,'x-api-key':clientId};
 const upload=await json(BASE+'/v2/storage/image',{method:'POST',headers:{...headers,'Content-Type':'image/png'},body:png});
 if(!upload.images?.[0]?.id)throw Error('Adobe no recibió la imagen de la página.');
 const job=await json(BASE+'/v3/images/expand-async',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({image:{source:{uploadId:upload.images[0].id}},size:{width,height},placement:{alignment:{horizontal:'center',vertical:'center'}},numVariations:1})});
 const statusURL=validateURL(job.statusUrl,'status');
 for(let i=0;i<pollLimit;i++){
  const result=await json(statusURL,{headers});
  if(result.status==='failed'||result.status==='canceled')throw Error('Adobe no pudo completar esta extensión.');
  if(result.status==='succeeded'){
   const output=result.result?.outputs?.[0]?.image?.url;if(!output)throw Error('Adobe terminó sin devolver una imagen.');
   const url=validateURL(output,'image'),r=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('No se pudo recuperar el resultado de Adobe.');
   const declared=Number(r.headers.get('content-length')||0);if(declared>20*1024*1024)throw Error('El resultado de Adobe es demasiado grande.');
   const reader=r.body.getReader(),chunks=[];let length=0;
   while(true){const{done,value}=await reader.read();if(done)break;length+=value.length;if(length>20*1024*1024){await reader.cancel();throw Error('El resultado de Adobe es demasiado grande.');}chunks.push(value);}
   const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
   const pngResult=[137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v),jpegResult=bytes[0]===255&&bytes[1]===216;
   if(!pngResult&&!jpegResult)throw Error('Adobe devolvió un formato de imagen no compatible.');
   return{bytes,format:pngResult?'png':'jpeg',width,height};
  }
  if(!['running','pending','queued','not_started'].includes(result.status))throw Error('Adobe devolvió un estado desconocido.');
  await delay(1000);
 }
 throw Error('Adobe tardó demasiado en completar la extensión.');
}
