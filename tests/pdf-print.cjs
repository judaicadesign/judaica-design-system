const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const P=require('pdf-lib'),core=require('../tools/pdf/print-pdf.js'),{MM}=core;
async function sample(count,{bleed=0,crop=false}={}){
 const d=await P.PDFDocument.create();
 for(let i=1;i<=count;i++){const p=d.addPage([100*MM+2*bleed,140*MM+2*bleed]);p.setTrimBox(bleed,bleed,100*MM,140*MM);if(bleed)p.setBleedBox(0,0,p.getWidth(),p.getHeight());if(crop)p.setCropBox(bleed,bleed,100*MM,140*MM);p.drawRectangle({x:0,y:0,width:p.getWidth(),height:p.getHeight(),color:i%2?P.rgb(.96,.85,.70):P.rgb(.72,.87,.9)});p.drawText('SOURCE '+i,{x:bleed+30,y:bleed+300,size:24});p.drawText('BOTTOM '+i,{x:bleed+30,y:bleed+35,size:14});}return d.save();
}
(async()=>{
 for(const direction of ['rtl','ltr'])for(const n of [1,2,4,6,8,12,72]){const plan=core.bookletPlan(n,direction),used=plan.flatMap(s=>s.pages).filter(Boolean);assert.equal(plan.length,Math.ceil(n/4)*2);assert.deepEqual([...used].sort((a,b)=>a-b),Array.from({length:n},(_,i)=>i+1));}
 assert.deepEqual(core.bookletPlan(8,'rtl').map(s=>s.pages),[[1,8],[7,2],[3,6],[5,4]]);
 assert.deepEqual(core.bookletPlan(6,'rtl').map(s=>s.pages),[[1,null],[null,2],[3,6],[5,4]]);
 const bytes=await sample(8),doc=await core.load(bytes);assert.equal(core.inspect(doc).hasThreeMM,false);
 await assert.rejects(()=>core.prepare(bytes,{bleedMM:3}),/Falta contenido/);
 const prepared=await core.prepare(bytes,{bleedMM:3,fill:'white',marks:true,numbering:{from:2,to:7,start:1,position:'outside'}});
 const pp=await P.PDFDocument.load(prepared.bytes),t=pp.getPage(0).getTrimBox(),b=pp.getPage(0).getBleedBox();assert(Math.abs(t.width-100*MM)<.01);assert(Math.abs(t.x-10*MM)<.01);assert(Math.abs(b.width-106*MM)<.01);assert(Math.abs(pp.getPage(0).getWidth()-120*MM)<.01);
 const booklet=await core.prepare(bytes,{bleedMM:3,fill:'white',marks:true,booklet:true,direction:'rtl',numbering:{from:2,to:7,start:1,position:'outside'}});assert.equal(booklet.pageCount,4);const bp=await P.PDFDocument.load(booklet.bytes);assert(Math.abs(bp.getPage(0).getWidth()-220*MM)<.01);assert(Math.abs(bp.getPage(0).getTrimBox().width-200*MM)<.01);
 const six=await core.prepare(await sample(6),{booklet:true,direction:'rtl'});assert.equal(six.pageCount,4);
 const bleedBytes=await sample(4,{bleed:3*MM,crop:true});assert.equal(core.inspect(await core.load(bleedBytes)).hasThreeMM,true);await core.prepare(bleedBytes,{bleedMM:3,marks:true});
 const smallBleed=await sample(1,{bleed:MM});await assert.rejects(()=>core.prepare(smallBleed,{bleedMM:3}),/Falta contenido/);
 const mixed=await P.PDFDocument.create();mixed.addPage([100,200]);mixed.addPage([110,200]);await assert.rejects(async()=>core.prepare(await mixed.save(),{booklet:true}),/misma medida/);
 const rotated=await P.PDFDocument.load(bytes);rotated.getPage(0).setRotation(P.degrees(90));assert(core.inspect(rotated).rotated);await assert.rejects(async()=>core.prepare(await rotated.save(),{}),/rotación/);
 const form=await P.PDFDocument.create();form.addPage();form.getForm().createTextField('value');await assert.rejects(async()=>core.load(await form.save()),/formularios/);
 await assert.rejects(()=>core.prepare(bytes,{bleedMM:-1}),/rango/);await assert.rejects(()=>core.prepare(bytes,{numbering:{from:1,to:9,start:1}}),/rango/);
 await assert.rejects(()=>core.prepare(bytes,{finalSize:{width:500,height:500}}),/caber/);
 const withoutTrim=await P.PDFDocument.create();const plain=withoutTrim.addPage([106*MM,146*MM]);plain.drawText('CENTER',{x:50,y:200});const inferred=await core.prepare(await withoutTrim.save(),{finalSize:{width:100,height:140},bleedMM:3});assert.equal(inferred.info.hasThreeMM,true);
 const blanks=await P.PDFDocument.create();for(let i=0;i<4;i++)blanks.addPage([100,200]);assert.equal((await core.prepare(await blanks.save(),{booklet:true})).pageCount,2);
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jd-print-pdf-'));fs.writeFileSync(path.join(dir,'original.pdf'),bytes);fs.writeFileSync(path.join(dir,'prepared.pdf'),prepared.bytes);fs.writeFileSync(path.join(dir,'booklet.pdf'),booklet.bytes);fs.writeFileSync(path.join(dir,'blank-booklet.pdf'),six.bytes);fs.writeFileSync(path.join(dir,'bleed.pdf'),(await core.prepare(bleedBytes,{bleedMM:3,marks:true,booklet:true})).bytes);
 console.log('PASS PDF geometry, safe bleed handling, numbering ranges, RTL/LTR order, blank padding and unsupported-file safeguards.');console.log('FIXTURES '+dir);
})().catch(e=>{console.error(e);process.exit(1);});
