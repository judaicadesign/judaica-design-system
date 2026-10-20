const assert=require('node:assert/strict'),marks=require('../tools/pdf/pdf-marks.js'),core=require('../tools/pdf/print-pdf.js');
const ops={save:10,restore:11,transform:12,stroke:20,constructPath:91,paintFormXObjectBegin:74,paintFormXObjectEnd:75};
const trim={x:30,y:30,width:100,height:150},fnArray=[],argsArray=[];
function add(rect){fnArray.push(91);argsArray.push([20,[],rect]);}
for(const x of [30,130])for(const y of [30,180]){add(x===30?[10,y,20,y]:[140,y,150,y]);add(y===30?[x,10,x,20]:[x,190,x,200]);}
assert.equal(marks.detect({fnArray,argsArray},ops,trim).status,'detected');
assert.equal(marks.detect({fnArray:fnArray.slice(0,4),argsArray:argsArray.slice(0,4)},ops,trim).status,'possible');
assert.equal(marks.detect({fnArray:[91],argsArray:[[20,[],[40,40,50,40]]]},ops,trim).status,'not-found');
const transformed={fnArray:[10,12,...fnArray,11],argsArray:[null,[1,0,0,1,10,20],...argsArray,null]};assert.equal(marks.detect(transformed,ops,{...trim,x:40,y:50}).status,'detected');
assert.deepEqual(core.foldPositions(300,{panels:2}),[150]);assert.deepEqual(core.foldPositions(300,{panels:3}),[100,200]);assert.deepEqual(core.foldPositions(400,{panels:4}),[100,200,300]);assert.deepEqual(core.foldPositions(301,{panels:3,style:'roll',insetMM:2,flap:'left'}),[99,200]);assert.deepEqual(core.foldPositions(301,{panels:3,style:'roll',insetMM:2,flap:'right'}),[101,202]);assert.deepEqual(core.foldPositions(301,{panels:3,style:'custom',positions:'99,5;200,5'}),[99.5,200.5]);assert.throws(()=>core.foldPositions(301,{panels:3,style:'custom',positions:'200;99'}));assert.equal(core.MAX_BYTES,200*1024*1024);
console.log('PASS vector crop-mark patterns, ambiguous/negative cases, transformations, fold calculators and 200 MiB boundary.');
