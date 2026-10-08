/* Estimates always start from the original supplier cost. */
(function(root){
  'use strict';
  function adjustedAmount(base,percent){
    base=Number(base);percent=Number(percent);
    if(!Number.isFinite(base)||base<=0||!Number.isFinite(percent)||percent<0)throw new Error('Ingresá un costo positivo y un porcentaje válido, mayor o igual a cero.');
    const result=Math.round(base*(1+percent/100)*100)/100;
    if(!Number.isFinite(result)||result>Number.MAX_SAFE_INTEGER/100)throw new Error('El importe resultante es demasiado grande.');
    return result;
  }
  function indexPercent(start,end){
    start=Number(start);end=Number(end);
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<=0||end<start)throw new Error('Revisá los índices: deben ser positivos y el final no puede ser menor al inicial.');
    return (end/start-1)*100;
  }
  function validDate(value){
    return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(new Date(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
  }
  function effectiveCost(cost){
    const a=cost.adjustment;
    if(a&&Number(a.baseCost)===Number(cost.cost)&&Number.isFinite(Number(a.percent))&&Number(a.percent)>=0){
      try{return adjustedAmount(cost.cost,a.percent)}catch{}
    }
    return Number(cost.cost);
  }
  function ipcEstimate(rows,baseDate,targetDate){
    if(!validDate(baseDate)||!validDate(targetDate)||targetDate<baseDate)throw Error('Revisá las fechas del período.');
    const data=rows.filter(r=>Array.isArray(r)&&validDate(r[0])&&Number.isFinite(r[1])&&r[1]>0).sort((a,b)=>a[0].localeCompare(b[0]));
    const baseMonth=baseDate.slice(0,7),targetMonth=targetDate.slice(0,7);
    const start=data.find(r=>r[0].slice(0,7)===baseMonth),end=data.filter(r=>r[0].slice(0,7)<=targetMonth).at(-1);
    if(!start||!end||end[0]<start[0])throw Error('Todavía no hay un índice publicado para el mes del costo original. Podés usar un porcentaje manual.');
    return {percent:indexPercent(start[1],end[1]),startIndex:start[1],endIndex:end[1],baseMonth,endMonth:end[0].slice(0,7)};
  }
  const math={adjustedAmount,indexPercent,validDate,effectiveCost,ipcEstimate};
  if(typeof module==='object'&&module.exports)module.exports=math;
  if(!root.document)return;
  root.jdAdjustedCost=effectiveCost;
  const api='https://apis.datos.gob.ar/series/api/series/?ids=148.3_INIVELNAL_DICI_M_26&limit=1000&format=json';
  let ipcRows=null,ipcRequest=null;
  async function loadIPC(){
    if(ipcRows)return ipcRows;
    if(!ipcRequest)ipcRequest=(async()=>{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{const response=await root.fetch(api,{signal:controller.signal});if(!response.ok)throw Error('La fuente oficial no respondió. Reintentá o usá un porcentaje manual.');const body=await response.json();if(!Array.isArray(body.data)||!body.data.length)throw Error('La fuente oficial no devolvió índices válidos.');ipcRows=body.data;return ipcRows;}finally{clearTimeout(timeout);ipcRequest=null;}})();
    return ipcRequest;
  }
  const source='https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31';
  const money=n=>'$ '+Number(n).toLocaleString('es-AR',{maximumFractionDigits:2});
  const today=()=>{const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};
  const signature=c=>JSON.stringify(['supplier','product','variant','size','binding','pages','qty','cost','date'].map(k=>c[k]??''));
  root.jdOpenInflation=function(cost){
    const overlay=document.createElement('div');overlay.className='modal open';
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','jdInflationTitle');
    overlay.innerHTML='<div class="modal-box"><div class="modal-head"><h2 id="jdInflationTitle">Estimar actualización</h2><button type="button" class="btn" data-close aria-label="Cerrar">×</button></div><p data-summary></p><div class="jd-note">El costo original se conserva. Esta estimación se usa al armar nuevos presupuestos; los ya guardados mantienen sus importes.</div><div class="jd-formgrid" style="margin-top:18px"><div><label for="jdAdjustmentMethod">Método</label><select id="jdAdjustmentMethod"><option value="auto">IPC automático · INDEC</option><option value="manual">Porcentaje manual</option><option value="ipc">Índices IPC ingresados</option></select></div><div><label for="jdAdjustmentDate">Fecha de la estimación</label><input id="jdAdjustmentDate" type="date"></div><div data-manual class="span2"><label for="jdAdjustmentPercent">Aumento acumulado (%)</label><input id="jdAdjustmentPercent" type="text" inputmode="decimal" placeholder="Ej.: 8,5"></div><div data-ipc hidden><label for="jdIndexStart">IPC del mes base</label><input id="jdIndexStart" type="number" step="any" min="0"></div><div data-ipc hidden><label for="jdIndexEnd">IPC del mes final</label><input id="jdIndexEnd" type="number" step="any" min="0"></div><div data-ipc hidden><label for="jdIndexMonthStart">Mes base publicado</label><input id="jdIndexMonthStart" type="month"></div><div data-ipc hidden><label for="jdIndexMonthEnd">Mes final publicado</label><input id="jdIndexMonthEnd" type="month"></div></div><p class="small muted">Consultá la <a target="_blank" rel="noopener" href="'+source+'">serie oficial del INDEC</a>. El IPC es mensual: no cubre días ni meses todavía sin publicar. El cálculo automático compara el mes del costo original con el último mes publicado hasta la fecha elegida. No proyecta inflación de meses pendientes.</p><div class="jd-note" data-result role="status" aria-live="polite">Ingresá un porcentaje o los índices para ver el resultado.</div><p class="small" data-error role="alert" style="color:#994941"></p><div class="jd-toolbar" style="margin-top:18px"><button type="button" class="btn primary" data-apply disabled>Aplicar estimación</button><button type="button" class="btn" data-reset>Volver al costo original</button></div></div>';
    const $=selector=>overlay.querySelector(selector);
    $('[data-summary]').textContent=[cost.supplier,cost.product,cost.qty+' unidades',money(cost.cost),'Base: '+(cost.date||'sin fecha')].join(' · ');
    const previous=document.activeElement;
    let saving=false,autoError='';
    const close=()=>{if(saving)return;document.removeEventListener('keydown',onKey);overlay.remove();previous?.focus()};
    const onKey=event=>{
      if(event.key==='Escape')close();
      if(event.key==='Tab'){
        const items=[...overlay.querySelectorAll('button:not(:disabled),input,select,a[href]')].filter(el=>!el.closest('[hidden]'));
        const first=items[0],last=items[items.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
      }
    };
    $('[data-close]').onclick=close;overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
    $('#jdAdjustmentDate').value=today();$('#jdAdjustmentDate').max=today();
    $('#jdIndexMonthStart').value=String(cost.date||'').slice(0,7);
    $('#jdIndexMonthEnd').max=today().slice(0,7);
    $('[data-reset]').hidden=!cost.adjustment;
    function estimate(){
      if(!validDate(cost.date))throw new Error('Primero cargá una fecha válida para el costo original.');
      const date=$('#jdAdjustmentDate').value;
      if(!validDate(date)||date<cost.date||date>today())throw new Error('La fecha debe estar entre el costo original y hoy.');
      const method=$('#jdAdjustmentMethod').value;
      let percent,extra={};
      if(method==='auto'){
        if(!ipcRows)throw Error(autoError||'Consultando el IPC oficial…');
        extra={...ipcEstimate(ipcRows,cost.date,date),source,seriesId:'148.3_INIVELNAL_DICI_M_26'};percent=extra.percent;
      }else if(method==='manual'){
        const raw=$('#jdAdjustmentPercent').value.trim();
        if(!/^\d+(?:[.,]\d+)?$/.test(raw))throw new Error('Ingresá el porcentaje acumulado del período.');
        percent=Number(raw.replace(',','.'));
      }else{
        const baseMonth=$('#jdIndexMonthStart').value,endMonth=$('#jdIndexMonthEnd').value;
        if(!baseMonth||!endMonth||baseMonth!==cost.date.slice(0,7)||endMonth<baseMonth||endMonth>date.slice(0,7))throw new Error('Revisá los meses publicados del IPC y la fecha de la estimación.');
        const start=Number($('#jdIndexStart').value),end=Number($('#jdIndexEnd').value);
        percent=indexPercent(start,end);extra={startIndex:start,endIndex:end,baseMonth,endMonth,source};
      }
      return {baseCost:Number(cost.cost),percent,estimatedCost:adjustedAmount(cost.cost,percent),method,baseDate:cost.date,targetDate:date,appliedAt:new Date().toISOString(),...extra};
    }
    function preview(){
      $('[data-error]').textContent='';
      overlay.querySelectorAll('[data-ipc]').forEach(el=>el.hidden=$('#jdAdjustmentMethod').value!=='ipc');
      $('[data-manual]').hidden=$('#jdAdjustmentMethod').value!=='manual';
      try{const a=estimate();$('[data-result]').textContent=money(cost.cost)+' → '+money(a.estimatedCost)+' · +'+a.percent.toLocaleString('es-AR',{maximumFractionDigits:3})+'%'+(a.endMonth?' · IPC publicado hasta '+a.endMonth+' (los meses pendientes no están incluidos)':'');$('[data-apply]').disabled=false}
      catch(e){$('[data-result]').textContent=e.message;$('[data-apply]').disabled=true}
    }
    overlay.addEventListener('input',preview);overlay.addEventListener('change',preview);
    async function persist(adjustment){
      saving=true;$('[data-apply]').disabled=true;$('[data-reset]').disabled=true;
      try{
        await root.jdUpdateSharedState(['jd_cost_quotes_v2'],state=>{
          if(!Array.isArray(state.jd_cost_quotes_v2))throw new Error('No se pudieron verificar los costos.');
          const list=state.jd_cost_quotes_v2.map(c=>({...c}));
          const at=list.findIndex(c=>signature(c)===signature(cost));
          if(at<0)throw new Error('La cotización cambió. Recargá la lista antes de ajustar.');
          if(adjustment)list[at].adjustment=adjustment;else delete list[at].adjustment;
          return {jd_cost_quotes_v2:list};
        });
        saving=false;close();root.jdRefreshCosts?.();root.renderQuote?.();
      }catch(e){saving=false;$('[data-error]').textContent='No se cambió el costo. '+e.message;$('[data-reset]').disabled=false;preview();$('[data-error]').textContent='No se cambió el costo. '+e.message}
    }
    $('[data-apply]').onclick=()=>{try{persist(estimate())}catch(e){$('[data-error]').textContent=e.message}};
    $('[data-reset]').onclick=()=>persist(null);
    document.body.append(overlay);document.addEventListener('keydown',onKey);$('#jdAdjustmentMethod').focus();preview();
    async function refreshIPC(){if($('#jdAdjustmentMethod').value!=='auto')return;autoError='';preview();try{await loadIPC()}catch(e){autoError=e.name==='AbortError'?'La consulta del IPC tardó demasiado. Reintentá o usá un porcentaje manual.':e.message}if(overlay.isConnected)preview();}
    $('#jdAdjustmentMethod').addEventListener('change',refreshIPC);refreshIPC();
  };
})(typeof window==='object'?window:globalThis);
