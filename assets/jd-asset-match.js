/* Explicit assignments take precedence; legacy text criteria remain compatible. */
(function(root){
 function select(list,config){
  const norm=v=>String(v||'').trim().toLowerCase(),model=norm(config.model),binding=norm(config.binding),size=norm(config.size);
  const candidates=list.filter(a=>a.product===config.product&&a.role===(config.role||'Mockup principal')).filter(a=>{
   if(a.model&&norm(a.model)!==model||a.binding&&norm(a.binding)!==binding||a.size&&norm(a.size)!==size)return false;
   const v=norm(a.variant);
   if(/abrochado/.test(binding)&&/binder|cosido|anillado/.test(v)||/binder|cosido/.test(binding)&&/abrochado|stapled|anillado/.test(v)||/anillado/.test(binding)&&/abrochado|stapled|binder|cosido/.test(v))return false;
   if(size.includes('normal')&&/grande/.test(v)||size.includes('grande')&&/normal/.test(v))return false;
   const formats=['tríptico','cuadríptico','díptico','bifold'];
   if(formats.some(f=>v.includes(f))&&!formats.some(f=>v.includes(f)&&model.includes(f)))return false;
   return true;
  });
  const score=a=>{const v=norm(a.variant);return (a.model?50:0)+(a.binding?50:0)+(a.size?50:0)+(model&&v.includes(model)?5:0)+(binding&&v.includes(binding)?12:0)+(size&&v.includes(size.split(' · ')[0])?8:0)};
  return candidates.sort((a,b)=>score(b)-score(a))[0]||null;
 }
 const api={select};if(root)root.jdAssetMatch=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:null);
