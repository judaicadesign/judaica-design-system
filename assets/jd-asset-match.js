/* Explicit assignments take precedence; legacy text criteria remain compatible. */
(function(root){
 function select(list,config){
  const norm=v=>String(v||'').trim().toLowerCase(),model=norm(config.model),texts=norm(config.texts||config.text||config.lang),binding=norm(config.binding),size=norm(config.size),event=norm(config.eventType)||'generic';
  const candidates=list.filter(a=>(a.product===config.product||(config.role==='Fondo de evento'&&(!a.product||a.product==='Todos los productos')))&&a.role===(config.role||'Mockup principal')).filter(a=>{
   if(a.model&&norm(a.model)!==model||a.texts&&norm(a.texts)!==texts||a.binding&&norm(a.binding)!==binding||a.size&&norm(a.size)!==size)return false;
   if(a.eventType&&norm(a.eventType)!=='generic'&&norm(a.eventType)!==event)return false;
   const v=norm(a.variant);
   if(/abrochado/.test(binding)&&/binder|cosido|anillado/.test(v)||/binder|cosido/.test(binding)&&/abrochado|stapled|anillado/.test(v)||/anillado/.test(binding)&&/abrochado|stapled|binder|cosido/.test(v))return false;
   if(size.includes('normal')&&/grande/.test(v)||size.includes('grande')&&/normal/.test(v))return false;
   const formats=['tríptico','cuadríptico','díptico','bifold'];
   if(formats.some(f=>v.includes(f))&&!formats.some(f=>v.includes(f)&&model.includes(f)))return false;
   return true;
  });
  const score=a=>{const v=norm(a.variant);return (norm(a.eventType)===event?1000:0)+(a.model?50:0)+(a.texts?80:0)+(a.binding?50:0)+(a.size?50:0)+(model&&v.includes(model)?5:0)+(texts&&v.includes(texts)?10:0)+(binding&&v.includes(binding)?12:0)+(size&&v.includes(size.split(' · ')[0])?8:0)};
  return candidates.sort((a,b)=>score(b)-score(a))[0]||null;
 }
 const events=[['generic','General / otro'],['wedding','Boda'],['bar_mitzvah','Bar Mitzvá'],['bat_mitzvah','Bat Mitzvá'],['brit_milah','Brit Milá'],['simchat_bat','Simjat Bat'],['shabbaton','Shabatón'],['challah_bake','Hafrashat Jalá']];
 const api={select,events};if(root)root.jdAssetMatch=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window==='object'?window:null);
