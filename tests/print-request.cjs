const assert=require('node:assert/strict'),api=require('../assets/jd-print-request.js');
const examples=[`Especificaciones técnicas
- Tamaño: 30 cm (alto) × 22,8 cm (ancho) + 1,1 cm de lomo impreso.
- Cantidad de páginas: 240.
- Tapa: 300 g con laminado mate al frente.
- Interior: Ilustración de 90 g.
- Impresión: Full color, .
- Encuadernación: Cosida a hilo o binder
- Cantidad: 100 ejemplares.`, `Necesito imprimir esto nuevamente (pdf de 21 paginas)
5 copias en a5
Papel obra 120gr b/n.`, `Buen dia! Como va?
Me cotizas porfa 20
*Impresiones varias* BS”D
_Cliente: Abi Iskandarani_
_Fecha de presupuesto: 25/6/2024_
*Libritos*
Cantidad total de páginas 24 (20 + pliego de tapa)
Tapa: 300 g - full color - laminado
Interior: 150 g - blanco y negro
Encuadernación acaballada
Cantidad: 20 unidades
*Tamaño: 10x14 cm. Cerrado*`];
const a=api.analyze(examples[0]);assert.deepEqual(a.quantities,[100]);assert.equal(a.widthMm,228);assert.equal(a.heightMm,300);assert.equal(a.spineMm,11);assert.equal(a.totalPages,240);assert.equal(a.weightGsm,90);assert.equal(a.coverWeightGsm,300);assert.equal(a.coverLamination,'Laminado mate');assert.equal(a.coverLaminationSides,'Solo frente');assert.equal(a.print,'Full color');assert.deepEqual(a.bindingOptions,['Cosida a hilo','Binder']);assert.equal(api.plan(a).alternatives.length,2);assert.ok(api.questions(a).some(q=>q.key==='pagesIncludeCover'));assert.ok(api.questions(a).some(q=>q.key==='coverPaper'));
const b=api.analyze(examples[1]);assert.deepEqual(b.quantities,[5]);assert.equal(b.totalPages,21);assert.equal(b.widthMm,148);assert.equal(b.heightMm,210);assert.equal(b.weightGsm,120);assert.equal(b.print,'Blanco y negro');assert.equal(b.hasCover,false);assert.equal(b.bindingOptions.length,0);assert.ok(api.questions(b).some(q=>q.key==='bindingOptions'));assert.equal(b.sides,'');
const c=api.analyze(examples[2]);assert.deepEqual(c.quantities,[20]);assert.equal(c.totalPages,24);assert.equal(c.interiorPages,20);assert.equal(c.coverPages,4);assert.equal(c.pagesIncludeCover,'Sí');assert.equal(c.widthMm,100);assert.equal(c.heightMm,140);assert.equal(c.coverWeightGsm,300);assert.equal(c.weightGsm,150);assert.equal(c.print,'Blanco y negro');assert.equal(c.coverPrint,'Full color');assert.deepEqual(c.bindingOptions,['Acaballada']);assert.equal(c.paper,'');assert.equal(c.coverLamination,'Laminado por confirmar');assert.ok(api.questions(c).some(q=>q.key==='coverLamination'));
assert.throws(()=>api.analyze(''),/Pegá/);assert.throws(()=>api.analyze('a'.repeat(20001)),/20.000/);
for(const x of [a,b,c]){assert.equal(x.message,examples[[a,b,c].indexOf(x)]);assert.equal(x.price,undefined);assert.equal(api.plan(x).complete,false);}
module.exports={examples};console.log('PASS open intake: all three real requests, separate cover/interior, alternate bindings, page accounting, dimensions, short runs and targeted clarifications; no assumed prices.');
