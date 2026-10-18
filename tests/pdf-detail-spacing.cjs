const assert=require('node:assert/strict');
require('../assets/jd-quote-vectors.js');const native=require('../assets/jd-quote-native.js');
class PDF{
 constructor(){this.size=8;this.circles=[];this.rules=[];this.words=[];}
 addFileToVFS(){}addFont(){}setFont(){}getFont(){return{metadata:{characterToGlyph(){}}}}setFontSize(n){this.size=n}getTextWidth(s){return String(s).length*this.size*.45}setProperties(){}setFillColor(){}setDrawColor(){}setLineWidth(){}setTextColor(){}setCharSpace(){}rect(){}roundedRect(){}circle(x,y,r){this.circles.push({x,y,r})}text(s,x,y){this.words.push({s,x,y,size:this.size})}line(x1,y1,x2,y2){this.rules.push({x1,y1,x2,y2})}path(){}fill(){}addPage(){}link(){}
}
const model={title:'Birkón · Librito',overline:'PRESUPUESTO',client:'Prueba',date:'18/10/2026',content:[],legal:[],mock:'',technical:['Tapa: papel ilustración 300 grs. laminado mate/brillante','Interior: papel ilustración 115 grs. - Full color'],specs:[['Modelo / contenido','Deluxe','11_libro_abierto'],['Nusaj','Ashkenazí + Sefaradí','02_siddur'],['Textos','Hebreo + español + fonética','03_traduccion'],['Tamaño','Normal · 11,6 × 15,5 cm','04_tamano'],['Encuadernación','Abrochado','05_abrochado'],['Páginas','88','12_documento_numeral']].map(([title,value,icon])=>({title,value,icon:'assets/quote-icons/'+icon+'.svg'}))};
const price=qty=>({qty:qty+' unidades',total:'$ 1.150.000.-',unit:'($11.500.- por unidad)',adjustments:[]});
const m=n=>({...model,prices:Array.from({length:n},(_,i)=>price(100+i*50))});
(async()=>{
 const layouts=[1,2,3].map(n=>native.cardLayout(new PDF(),{...m(n),_lift:18}));
 for(const l of layouts){assert.deepEqual(l.specs,layouts[0].specs);assert.equal(l.header,38);assert.equal(l.techHeight,layouts[0].techHeight);assert.ok(l.top+l.height<=603.779-18-12+1e-6);assert.ok(l.specs.every(s=>s.height>=39.004));const baseline=18.671+(l.tech.length-1)*8;assert.ok(Math.abs(l.techHeight-7.62-baseline-l.detailRuleGap)<1e-7);}
 assert.ok(layouts[2].prices[0].height<layouts[1].prices[0].height,'Only price spacing should compact');
 assert.ok(layouts[2].prices.every(p=>p.height>=p.minHeight));assert.throws(()=>native.cardLayout(new PDF(),{...m(12),_lift:18}),/sin alterar los detalles/);
 const fonts=Object.fromEntries(Object.keys(native.fonts).map(k=>[k,new Uint8Array([0,1,0,0])]));
 const docs=await Promise.all([1,2,3].map(n=>native.generate([m(n)],{PDF,fonts,document:true})));
 for(const d of docs){assert.deepEqual(d.circles,docs[0].circles);assert.deepEqual(d.rules.filter(r=>r.x1===396.85).slice(0,7),docs[0].rules.filter(r=>r.x1===396.85).slice(0,7));assert.equal(d.circles.length,7);}
 const svg=await global.jdQuotePreviewSVG(m(3),1,1,{PDF,fonts});assert.equal((svg.match(/<circle /g)||[]).length,7);
 console.log('PASS fixed detail/icon geometry for 1/2/3 quantities, equal technical bottom clearance, adaptive price-only spacing, bounded A4 and explicit overflow.');
})().catch(e=>{console.error(e);process.exit(1)});
