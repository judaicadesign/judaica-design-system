(function(root){
  'use strict';
  function calculate(suggested,manual,discount){
    const cents=n=>Math.round((n+Number.EPSILON)*100)/100;
    const calculatedPrice=Math.ceil(Number(suggested)/5000)*5000;
    const hasManual=manual!==undefined&&manual!==null&&String(manual).trim()!=='';
    const rawPrice=hasManual?Number(manual):calculatedPrice,rawDiscount=Number(discount??0);
    if(!Number.isFinite(rawPrice)||rawPrice<=0||rawPrice>Number.MAX_SAFE_INTEGER/100)throw Error('El precio manual debe ser un importe válido mayor a cero.');
    if(!Number.isFinite(rawDiscount)||rawDiscount<0)throw Error('El descuento debe ser un importe válido mayor o igual a cero.');
    const priceBeforeDiscount=cents(rawPrice);
    const discountAmount=cents(rawDiscount);
    if(!Number.isFinite(priceBeforeDiscount)||priceBeforeDiscount<=0||priceBeforeDiscount>Number.MAX_SAFE_INTEGER/100)throw Error('El precio manual debe ser un importe válido mayor a cero.');
    if(!Number.isFinite(discountAmount)||discountAmount<0)throw Error('El descuento debe ser un importe válido mayor o igual a cero.');
    const price=cents(priceBeforeDiscount-discountAmount);
    if(price<=0)throw Error('El descuento deja el precio en cero o negativo.');
    return {calculatedPrice,priceBeforeDiscount,discountAmount,price,manualPrice:hasManual?priceBeforeDiscount:null};
  }
  const api={calculate};if(root)root.jdPrice=api;if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:null);
