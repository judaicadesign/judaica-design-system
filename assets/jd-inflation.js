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
  // Monthly IPC is apportioned geometrically over calendar days. Unpublished
  // months are explicitly projected using the last published monthly variation.
  function ipcEstimate(rows,baseDate,targetDate){
    if(!validDate(baseDate)||!validDate(targetDate)||targetDate<baseDate)throw Error('Revisá las fechas del período.');
    const data=rows.filter(r=>Array.isArray(r)&&validDate(r[0])&&Number.isFinite(r[1])&&r[1]>0&&r[0].slice(0,7)<=targetDate.slice(0,7)).sort((a,b)=>a[0].localeCompare(b[0]));
    if(data.length<2)throw Error('La fuente oficial no tiene suficientes índices para estimar el período.');
    const factors=new Map();for(let i=1;i<data.length;i++){const previous=new Date(data[i][0]+'T12:00:00Z');previous.setUTCMonth(previous.getUTCMonth()-1);if(previous.toISOString().slice(0,7)===data[i-1][0].slice(0,7))factors.set(data[i][0].slice(0,7),data[i][1]/data[i-1][1]);}
    const last=data.at(-1),endMonth=last[0].slice(0,7),lastFactor=factors.get(endMonth);
    if(!lastFactor||lastFactor<1)throw Error('No hay una variación mensual válida para proyectar el período.');
    const date=new Date(baseDate+'T12:00:00Z'),end=new Date(targetDate+'T12:00:00Z');let log=0,projectedDays=0,days=0;
    while(date<end){date.setUTCDate(date.getUTCDate()+1);const month=date.toISOString().slice(0,7),factor=factors.get(month);if(!factor&&month<=endMonth)throw Error('Falta un índice mensual del período. Podés usar un porcentaje manual.');const monthDays=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();log+=Math.log(factor||lastFactor)/monthDays;if(!factor)projectedDays++;days++;}
    const percent=Math.expm1(log)*100;if(!Number.isFinite(percent)||percent<0)throw Error('No se pudo estimar un aumento válido.');
    return {percent,baseMonth:baseDate.slice(0,7),endMonth,days,projectedDays,lastMonthlyPercent:(lastFactor-1)*100,projection:'Última variación mensual distribuida geométricamente por días calendario'};
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
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Argentina/Buenos_Aires',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const signature=c=>JSON.stringify(['supplier','product','variant','size','binding','pages','qty','cost','date'].map(k=>c[k]??''));
  root.jdOpenInflation=function(cost){
    const overlay=document.createElement('div');overlay.className='modal open';
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','jdInflationTitle');
    overlay.innerHTML='<div class="modal-box"><div class="modal-head"><h2 id="jdInflationTitle">Estimar actualización</h2><button type="button" class="btn" data-close aria-label="Cerrar">×</button></div><p data-summary></p><div class="jd-note">El costo original se conserva. Esta estimación se usa al armar nuevos presupuestos; los ya guardados mantienen sus importes.</div><div class="jd-formgrid" style="margin-top:18px"><div class="span2"><label for="jdAdjustmentMethod">Método</label><select id="jdAdjustmentMethod"><option value="auto">IPC automático · estimado</option><option value="manual">Porcentaje manual</option></select></div><div><label for="jdAdjustmentBase">Fecha del presupuesto del proveedor</label><input id="jdAdjustmentBase" type="date" readonly></div><div><label for="jdAdjustmentDate">Actualizar a hoy</label><input id="jdAdjustmentDate" type="date" readonly></div><div data-manual class="span2"><label for="jdAdjustmentPercent">Aumento acumulado (%)</label><input id="jdAdjustmentPercent" type="text" inputmode="decimal" placeholder="Ej.: 8,5"></div></div><p class="small muted">Consultá la <a target="_blank" rel="noopener" href="'+source+'">serie oficial del INDEC</a>. Estimación entre las dos fechas: distribuye el IPC mensual por días calendario. Para meses aún sin publicar proyecta la última variación mensual disponible; ese tramo es estimado, no inflación oficial confirmada.</p><div class="jd-note" data-result role="status" aria-live="polite">Ingresá un porcentaje o los índices para ver el resultado.</div><p class="small" data-error role="alert" style="color:#994941"></p><div class="jd-toolbar" style="margin-top:18px"><button type="button" class="btn primary" data-apply disabled>Aplicar estimación</button><button type="button" class="btn" data-reset>Volver al costo original</button></div></div>';
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
    $('#jdAdjustmentBase').value=cost.date||'';
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
      }else throw Error('Elegí IPC automático o porcentaje manual.');
      return {baseCost:Number(cost.cost),percent,estimatedCost:adjustedAmount(cost.cost,percent),method,baseDate:cost.date,targetDate:date,appliedAt:new Date().toISOString(),...extra};
    }
    function preview(){
      $('[data-error]').textContent='';
      $('[data-manual]').hidden=$('#jdAdjustmentMethod').value!=='manual';
      try{const a=estimate();$('[data-result]').textContent=money(cost.cost)+' → '+money(a.estimatedCost)+' · +'+a.percent.toLocaleString('es-AR',{maximumFractionDigits:3})+'%'+(a.endMonth?' · '+a.days+' días · IPC publicado hasta '+a.endMonth+(a.projectedDays?' · '+a.projectedDays+' días proyectados con la última variación mensual ('+a.lastMonthlyPercent.toLocaleString('es-AR',{maximumFractionDigits:2})+'%)':' · estimación diaria con datos publicados'):'');$('[data-apply]').disabled=saving}
      catch(e){$('[data-result]').textContent=e.message;$('[data-apply]').disabled=true}
    }
    overlay.addEventListener('input',preview);overlay.addEventListener('change',preview);
    async function persist(adjustment){
      if(saving)return;
      saving=true;$('[data-apply]').disabled=true;$('[data-reset]').disabled=true;
      try{
        await root.jdUpdateSharedState(['jd_cost_quotes_v2'],state=>{
          if(!Array.isArray(state.jd_cost_quotes_v2))throw new Error('No se pudieron verificar los costos.');
          const list=state.jd_cost_quotes_v2.map(c=>({...c}));
          const at=list.findIndex(c=>signature(c)===signature(cost));
          if(at<0||JSON.stringify(list[at].adjustment||null)!==JSON.stringify(cost.adjustment||null))throw new Error('La cotización cambió. Recargá la lista antes de ajustar.');
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
