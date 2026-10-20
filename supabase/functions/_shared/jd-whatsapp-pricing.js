/* One price rule shared by the existing settings screen and the WhatsApp worker. */
(function(root){
  'use strict';
  const KEY='jd_whatsapp_pricing_v1';
  const defaults=Object.freeze({markupPct:26,netRoundStep:500,finalRoundStep:100,minimumProfit:12000});
  function rule(value=defaults){
    const result={markupPct:Number(value.markupPct),netRoundStep:Number(value.netRoundStep),finalRoundStep:Number(value.finalRoundStep)};
    if(!Number.isFinite(result.markupPct)||result.markupPct<0||result.markupPct>1000||Math.abs(result.markupPct*100-Math.round(result.markupPct*100))>0.000001)throw Error('El porcentaje debe estar entre 0 y 1000, con hasta dos decimales.');
    for(const field of ['netRoundStep','finalRoundStep'])if(!Number.isSafeInteger(result[field])||result[field]<1||result[field]>1000000)throw Error('Los redondeos deben ser importes enteros entre 1 y 1.000.000.');
    // A missing field in a frozen historical rule retains its original calculation.
    if(Object.hasOwn(value,'minimumProfit')){result.minimumProfit=Number(value.minimumProfit);if(!Number.isSafeInteger(result.minimumProfit)||result.minimumProfit<0||result.minimumProfit>100000000)throw Error('La ganancia mínima debe ser un importe entero entre 0 y 100.000.000.');}
    return result;
  }
  function calculate(net,settings=defaults){
    const amount=Number(net),config=rule(settings);
    if(!Number.isFinite(amount)||amount<=0||amount>Number.MAX_SAFE_INTEGER/1100000)throw Error('El precio B612 sin IVA no es válido.');
    const cents=Math.round((amount+Number.EPSILON)*100);
    const roundedNet=Math.ceil(cents/(config.netRoundStep*100))*config.netRoundStep;
    const basisPoints=10000+Math.round(config.markupPct*100);
    const numerator=roundedNet*basisPoints;
    if(!Number.isSafeInteger(numerator))throw Error('El precio excede el rango admitido.');
    const multiplied=numerator/10000;
    const regularPrice=Math.ceil(numerator/(10000*config.finalRoundStep))*config.finalRoundStep;
    const minimumPrice=Math.ceil((cents+(config.minimumProfit||0)*100)/(config.finalRoundStep*100))*config.finalRoundStep;
    const price=Math.max(regularPrice,minimumPrice);
    return {net:amount,regularPrice,minimumApplied:price>regularPrice,profit:Math.round((price-amount)*100)/100,roundedNet,multiplier:basisPoints/10000,multiplied,x:price,price,shipping:0,rule:config};
  }
  const api={KEY,defaults,rule,calculate};root.jdWhatsAppPrice=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(globalThis);
