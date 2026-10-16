const assert=require('node:assert/strict'),fs=require('node:fs');
const api=require('../assets/jd-catalog-pricing.js');
const {boot,fixture}=require('./commercial-scenarios.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const p={id:'test',name:'Birkón · Folleto',models:['Díptico','Tríptico','Cuadríptico'],supplier:'Gráfica B612'};
const rules=[{id:'di',product:p.name,variant:'Díptico',marginPct:50},{id:'tri',product:p.name,variant:'Tríptico',marginPct:50},{id:'cuad',product:p.name,variant:'Cuadríptico',marginPct:40}];
const n=api.normalize(p,rules);assert.equal(n.pricing.marginPct,50);assert.deepEqual(n.modelPricing,{Cuadríptico:{marginPct:40}});
assert.equal(api.resolve(n,{model:'Tríptico'},rules).marginPct,50);assert.equal(api.resolve(n,{model:'Cuadríptico'},rules).marginPct,40);
const deluxe={...n,modelPricing:{Deluxe:{extra:50000}}};assert.equal(api.resolve(deluxe,{model:'Deluxe'},rules).extra,50000);
assert.equal(api.resolve(deluxe,{model:'Deluxe',pricing:{marginPct:36}},rules).extra,50000);
assert.equal(api.resolve(deluxe,{model:'Deluxe',pricing:{extra:0}},rules).extra,0);
assert.equal(api.resolve(deluxe,{model:'Deluxe',pricing:{extra:80000}},rules,10000).extra,90000);
assert.equal(api.resolve(deluxe,{model:'Deluxe'},rules,-1).error.includes('adicional'),true);
assert.equal(api.normalize({...n,pricing:{marginPct:45,extra:0}},rules).pricing.marginPct,45,'No stale legacy rule overrides a migrated product');
(async()=>{
 const rows=fixture(),prod=rows[0].value[0];prod.models=['Deluxe'];prod.variants[0].model='Deluxe';rows.find(r=>r.key==='jd_cost_quotes_v2').value.forEach(x=>x.variant='Deluxe');rows.find(r=>r.key==='jd_pricing_rules_v4').value=[{id:'general',product:prod.name,variant:'*',marginPct:50,extra:0},{id:'deluxe',product:prod.name,variant:'Deluxe',marginPct:50,extra:50000}];
 rows.find(r=>r.key==='jd_assets').value=[{id:'catalog-image',name:'Miniatura elegida',product:prod.name,role:'Miniatura de catálogo',data:'data:image/png;base64,iVBORw0KGgo=',mockCanvas:false}];
 const a=await boot(rows),w=a.w,f=id=>w.document.getElementById(id);f('qClient').value='Prueba herencia';w.qs6=[50,100,200];w.jdDrawQuoteQuantities();w.renderQuote();
 assert.deepEqual(Array.from(w.jdCollectQuote().quantities,x=>x.price),[260000,420000,720000]);
 // Actual click uses the current handler, not the removed legacy capture handler.
 w.document.querySelector('[data-pedit="0"]').click();assert.equal(f('pdeluxeExtra6'),null);f('pmargin6').value='40';f('pextra6').value='10000';f('pthumb6').value='catalog-image';
 w.document.querySelector('.modal .s6').click();await sleep(400);
 assert.equal(a.get('jd_catalog_v6')[0].pricing.marginPct,40);assert.equal(a.get('jd_catalog_v6')[0].pricing.extra,10000);assert.equal(a.get('jd_catalog_v6')[0].thumbnailAssetId,'catalog-image');
 assert.ok(w.document.querySelector('#products .jd-catalog-thumb'));
 // Edit the Deluxe surcharge for all text/nusaj combinations; no multiplication by quantity.
 w.document.querySelector('[data-pvars="0"]').click();w.document.querySelector('[data-ve="0"]').click();assert.equal(f('vextra6').value,'50000');assert.equal(f('vmargin6').value,'');f('vextra6').value='80000';
 a.fail(true);w.document.querySelector('.modal .s6').click();await sleep(60);assert.ok(f('vextra6'));assert.equal(a.get('jd_catalog_v6')[0].modelPricing.Deluxe.extra,50000);
 a.fail(false);w.document.querySelector('.modal .s6').click();await sleep(400);assert.equal(a.get('jd_catalog_v6')[0].modelPricing.Deluxe.extra,80000);
 f('qClient').value='Prueba herencia';w.qs6=[100];w.jdDrawQuoteQuantities();w.renderQuote();assert.equal(w.jdCollectQuote().pricingApplied.extra,80000);
 f('qExtra').value='25000';f('qExtra').dispatchEvent(new w.Event('input'));const q=w.jdCollectQuote();assert.equal(q.extraFixed,25000);assert.equal(q.pricingApplied.extra,105000);
 f('qManualPrice-0').value='500000';f('qManualPrice-0').dispatchEvent(new w.Event('input'));assert.equal(w.jdCollectQuote().quantities[0].price,500000,'Manual total is not charged again');
 const saved=await f('sq6').onclick();w.jdRenderSavedQuotes();w.document.querySelector('[data-edit-qid]').click();assert.equal(f('qExtra').value,'25000');assert.equal(w.jdCollectQuote().quantities[0].price,500000);assert.equal(a.get('jd_saved_quotes_v6')[0].id,saved.id);
 assert.match(f('quotePreview').querySelector('.jd-unit-price').textContent,/^\(\$5\.000\.- por unidad\)$/);assert.equal(f('quotePreview').querySelector('.jd-run-note'),null);
 // Exact combination can override or explicitly suppress a model surcharge.
 w.document.querySelector('[data-pvars="0"]').click();w.document.querySelector('[data-ve="0"]').click();f('vpriceScope6').value='variant';f('vpriceScope6').onchange();f('vextra6').value='0';w.document.querySelector('.modal .s6').click();await sleep(400);assert.equal(a.get('jd_catalog_v6')[0].variants[0].pricing.extra,0);
 w.jdRenderClients();w.jdDrawProducts();w.document.querySelector('[data-pthumb="0"]').click();assert.equal(f('jaRole').value,'Miniatura de catálogo');assert.equal(f('jaProd').value,prod.name);assert.equal(f('jaCanvas').checked,false);w.document.querySelector('.modal .jd-x').click();
 await sleep(100);a.close();
 console.log('PASS product defaults, model/exact-variant exceptions, inherited zero, one-time extras, actual click save/retry, manual/frozen prices, unit format and separate catalogue thumbnails.');
})().catch(e=>{console.error(e);process.exit(1)});
