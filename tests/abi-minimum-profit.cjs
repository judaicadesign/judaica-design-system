const assert=require('node:assert/strict'),fs=require('node:fs'),pricing=require('../supabase/functions/_shared/jd-whatsapp-pricing.js');
const rule={markupPct:26,netRoundStep:500,finalRoundStep:100,minimumProfit:12000};
assert.equal(pricing.calculate(28588.48,rule).price,40600);assert.equal(pricing.calculate(28588.48,rule).minimumApplied,true);
assert.equal(pricing.calculate(98325,rule).price,124200);assert.equal(pricing.calculate(98325,rule).minimumApplied,false);
assert.equal(pricing.calculate(10000,rule).price,22000);assert.equal(pricing.calculate(28588.48,{...rule,minimumProfit:0}).price,36600);
assert.equal(pricing.calculate(28588.48,{markupPct:26,netRoundStep:500,finalRoundStep:100}).price,36600,'Frozen legacy rules retain old prices');
for(const n of [-1,1.5,Infinity,100000001])assert.throws(()=>pricing.rule({...rule,minimumProfit:n}));
for(const net of [1,99.99,28588.48,43999.99,45000,99999.99]){const a=pricing.calculate(net,rule);assert.ok(a.profit>=12000);assert.equal(a.price%100,0);}
const {boot,fixture}=require('./commercial-scenarios.cjs');
(async()=>{const rows=fixture();rows.push({key:pricing.KEY,value:rule});const app=await boot(rows,async()=>Response.json({ok:true,action:'quote-request',complete:true,alternatives:[{qty:16,binding:'Hojas sueltas',status:'priced',net:28588.48,vat:6003.58,gross:34592.06,lines:[{name:'Impresión y plastificado',quantity:1,unitPrice:28588.48,total:28588.48}]}]}));
 const w=app.w;w.AbortSignal=AbortSignal;for(const f of ['jd-print-request.js','jd-print-request-ui.js'])w.eval(fs.readFileSync('assets/'+f,'utf8'));const f=id=>w.document.getElementById(id);
 f('jdPrintText').value='16 plastificados\n14x20cm\nobra 80gr\nfull color\ndoble faz';await f('jdPrintAnalyze').onclick();assert.match(f('jdPrintOutputText').value,/x16 = \$40\.600\.-/);assert.match(f('jdPrintRuleNote').textContent,/12.000/);
 f('jdPrintEditAbiRule').click();assert.equal(f('jdWaMinProfit').value,'12000');f('jdWaMinProfit').value='15000';f('jdWaMinProfit').dispatchEvent(new w.Event('input'));assert.match(f('jdWaRuleExample').textContent,/43.600/);await w.document.querySelector('.modal.open .ss').onclick();assert.equal(app.get(pricing.KEY).minimumProfit,15000);assert.match(f('jdPrintOutputText').value,/40.600/,'Existing quote stays frozen');app.close();console.log('PASS minimum profit per job: exact floor, rounding, large order percentage, editable shared setting, legacy frozen prices and live output.');
})().catch(e=>{console.error(e);process.exit(1)});
