const assert=require('node:assert/strict');
require('../assets/jd-quote-vectors.js');const native=require('../assets/jd-quote-native.js');
class PDF{
 constructor(){this.links=[];this.size=8;}
 addFileToVFS(){}addFont(){}setFont(){}getFont(){return{metadata:{characterToGlyph(){}}}}setFontSize(n){this.size=n}getTextWidth(s){return String(s).length*this.size*.45}setProperties(){}setFillColor(){}setDrawColor(){}setLineWidth(){}setTextColor(){}setCharSpace(){}rect(){}roundedRect(){}circle(){}text(){}line(){}path(){}fill(){}addPage(){}link(x,y,width,height,options){this.links.push({x,y,width,height,...options})}
}
(async()=>{
 const fonts=Object.fromEntries(Object.keys(native.fonts).map(k=>[k,new Uint8Array([0,1,0,0])]));
 const model={title:'BIRKONIM',overline:'PRESUPUESTO',client:'Prueba',date:'15/10/2026',content:[],specs:[],technical:[],prices:[],legal:[],mock:''};
 const doc=await native.generate([model,model],{PDF,fonts,document:true});
 const expected=['https://www.behance.net/JudaicaDesign','https://www.instagram.com/JudaicaDesign/','https://wa.me/5491158224686'];assert.deepEqual(doc.links.map(l=>l.url),[...expected,...expected]);for(const link of doc.links){assert.ok(link.x>=0&&link.x+link.width<=native.W);assert.ok(link.y>=805.813&&link.y+link.height<=native.H)}
 const svg=await global.jdQuotePreviewSVG(model,1,1,{PDF,fonts});for(const url of expected)assert.ok(svg.includes('href="'+url+'"'));assert.equal((svg.match(/<a /g)||[]).length,3);
 console.log('PASS three bounded HTTPS contact annotations on every PDF page, WhatsApp direct chat number and matching clickable SVG preview.');
})().catch(e=>{console.error(e);process.exit(1)});
