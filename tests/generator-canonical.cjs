const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../fonetica/index.html'),'utf8');
assert.ok(!html.includes('function phonetize('),'An old second engine must not return');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
let target;vm.runInNewContext(script,{location:{search:'?text=example',hash:'#editor',replace:url=>target=url}});
assert.equal(target,'https://judaicadesign.github.io/fonetica-hebreo/?text=example#editor');
assert.match(html,/rel="canonical"/);console.log('PASS: legacy generator URL preserves parameters and redirects to the sole current engine');
