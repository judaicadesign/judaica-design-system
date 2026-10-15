const assert=require('node:assert/strict');
const api=require('../assets/jd-message-request.js');
const technical={paper:'Papel ilustración',weightGsm:300,lamination:'Laminado mate',sides:'Doble faz',print:'Full color',openWidthMm:391,openHeightMm:190,closedWidthMm:100,closedHeightMm:190};
const catalog=[{id:'birkon-folleto',name:'Birkón · Folleto',status:'Activo',supplier:'Gráfica B612',models:['Cuadríptico','Tríptico'],technical,variants:[{model:'Cuadríptico',technical:{}},{model:'Tríptico',technical:{openWidthMm:300,openHeightMm:140,closedWidthMm:100,closedHeightMm:140}}]}];
let request=api.extract('Abi: 50 cuadrípticos de birkón, 2 diseños. Abierto 39,1 × 19 cm; cerrado 10 x 19 cm.',catalog);
assert.equal(request.productId,'birkon-folleto');assert.equal(request.format,'Cuadríptico');assert.deepEqual(request.quantities,[50]);assert.equal(request.models,2);assert.equal(request.spec.openWidthMm,391);assert.equal(api.validate(request,catalog).spec.weightGsm,300);
request=api.extract('Necesito un diseño de birkon tríptico. Cantidades: 50, 75 y 100. Fecha 15/11/2026. Tel 5491155512345',catalog);assert.deepEqual(request.quantities,[50,75,100]);assert.equal(request.models,1);
assert.equal(api.extract('Birkón cuadríptico con 2 nusajim para el 14/10',catalog).models,null,'Nusaj and dates are not design counts');
assert.deepEqual(api.extract('Birkón cuadríptico. Abierto 391 x 190 mm',catalog).quantities,[],'Dimensions are not quantities');
assert.equal(api.extract('50 trípticos y 100 cuadrípticos, 1 diseño',catalog).format,'','Mixed formats require review');
assert.equal(api.validate({...request,quantities:[200,300]},catalog).spec.weightGsm,300);
for(const quantities of [[0],[40001],[150.5],[150,150]])assert.throws(()=>api.validate({...request,quantities},catalog),/unidades/);
for(const message of ['50 cuadrípticos Birkón un diseño, papel obra 120 g','50 cuadrípticos Birkón un diseño, sin laminado','50 cuadrípticos Birkón un diseño, blanco y negro','50 cuadrípticos Birkón un diseño, simple faz'])assert.throws(()=>api.validate(api.extract(message,catalog),catalog),/conexión actual/);
assert.throws(()=>api.extract(''),/Pegá/);
console.log('PASS message extraction: explicit counts/designs/dimensions, catalog defaults, ambiguous formats and unsupported materials require review. No AI or paid requests.');

for(const [message,quantities] of [['Misjag 150',[150]],['Misjag 200',[200]],['Misjag 300 unidades',[300]],['Misjag 150 y 200',[150,200]]]){
 const r=api.extract(message,catalog);assert.equal(r.productId,'b612-reference-misjag');assert.equal(r.format,'Tríptico');assert.deepEqual(r.quantities,quantities);
 const resolved=api.resolve(r,catalog);assert.equal(resolved.spec.paper,'Papel obra');assert.equal(resolved.spec.print,'Blanco y negro');assert.equal(resolved.spec.weightGsm,120);assert.equal(resolved.spec.openWidthMm,447);assert.equal(resolved.spec.openHeightMm,301);assert.equal(resolved.spec.lamination,'');assert.equal(resolved.origins.paper,'referencia');
 assert.throws(()=>api.validate({...r,models:1},catalog),/tarifa B612/);
}
assert.equal(catalog.length,1,'Recurring profiles cannot mutate the actual catalog');
assert.equal(api.resolve(api.extract('Misjag 200 obra 150 g',catalog),catalog).spec.weightGsm,150,'Explicit changes override recurring reference');
console.log('PASS recurring Misjag: independent quantities, reference facts, explicit overrides and no substitution with color prices.');
