const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const assert=require('node:assert/strict');
const root=require('path').resolve(__dirname,'..');
const original={app_state:[{key:'jd_catalog_v6',value:[{id:'birkon-librito',name:'Birkón · Librito',nusaj:true,sizes:[],texts:[],models:[],bindings:[],variants:[]}]},{key:'jd_clients',value:[]},{key:'jd_saved_quotes_v6',value:[{id:'quote-test',client:'Cliente de prueba',product:'Birkón',quantities:[{qty:100,price:200}],pdfUrl:'https://example.com/test.pdf'}]},{key:'jd_assets',value:[]}]};
async function run(mode){
 const errors=[],writes=[];let failWrite=false;const remote=structuredClone(original.app_state);const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!e.message.includes('Not implemented: window.scrollTo'))errors.push(e.message)});
 const d=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'https://judaicadesign.github.io/judaica-design-system/',runScripts:'dangerously',virtualConsole:vc});const w=d.window;
 w.fetch=async()=>({ok:true,json:async()=>({}),text:async()=>''});w.Headers=Headers;w.Request=Request;w.scrollTo=()=>{};
 const client={auth:{getSession:async()=>({data:{session:mode==='none'?null:{access_token:'test-only'}}}),getUser:async()=>({data:{user:{email:'judaica.dzn@gmail.com'}}}),onAuthStateChange:()=>({}),signOut:async()=>({})},storage:{from:()=>({createSignedUrl:async p=>({data:{signedUrl:'https://athiruoimehofqzrplnl.supabase.co/storage/v1/object/sign/jd-assets/'+p+'?token=test'}})})},from:t=>({select:()=>t==='jd_team_access'?{eq:async()=>({data:mode==='denied'?[]:[{email:'judaica.dzn@gmail.com'}]})}:Object.assign(Promise.resolve({data:structuredClone(remote)}),{in:async(field,keys)=>({data:structuredClone(remote.filter(row=>keys.includes(row.key)))})}),upsert:async x=>{if(failWrite)return{error:{message:'Sin conexión'}};writes.push(x);for(const row of (Array.isArray(x)?x:[x])){const i=remote.findIndex(r=>r.key===row.key);if(i<0)remote.push(structuredClone(row));else remote[i]=structuredClone(row)}return{}},delete:()=>({eq:async()=>({})})})};
 client.rpc=async(name,{changes})=>{
  assert.equal(name,'jd_commit_state');if(failWrite)return{error:{message:'Sin conexión'}};
  for(const c of changes){const old=remote.find(r=>r.key===c.key);if(!!old!==c.exists||old&&JSON.stringify(old.value)!==JSON.stringify(c.expected))return{error:{code:'40001',message:'Conflicto'}};}
  const rows=changes.map(c=>({key:c.key,value:c.value}));writes.push(rows);for(const row of rows){const i=remote.findIndex(r=>r.key===row.key);if(i<0)remote.push(structuredClone(row));else remote[i]=structuredClone(row)}return{data:rows};
 };
 w.supabase={createClient:()=>client};w.eval(fs.readFileSync(root+'/assets/jd-ui.js','utf8'));w.eval(fs.readFileSync(root+'/assets/jd-quote-edit.js','utf8'));w.eval(fs.readFileSync(root+'/assets/jd-price.js','utf8'));w.eval(fs.readFileSync(root+'/assets/jd-legal.js','utf8'));w.eval(fs.readFileSync(root+'/assets/jd-auth.js','utf8'));
 await new Promise(r=>setTimeout(r,800));
 assert.equal(w.document.body.classList.contains('jd-authenticated'),mode==='allowed');
 assert.equal(writes.length,0,'bootstrap must not write remote commercial data');
 const menu=w.document.querySelector('.jd-nav-toggle');
 menu.click();assert.equal(menu.getAttribute('aria-expanded'),'true');
 w.document.getElementById('nav').querySelector('button').click();
 assert.equal(menu.getAttribute('aria-expanded'),'false');
 const reveal=w.document.querySelector('.jd-password-toggle');reveal.click();
 assert.equal(w.document.getElementById('jdPassword').type,'text');reveal.click();
 assert.equal(w.document.getElementById('jdPassword').type,'password');
 assert.equal(w.document.getElementById('jdPhoneticsFrame').getAttribute('src'),null,'generator is not loaded before opening its section');
 assert.equal(w.document.getElementById('jdLeafletsFrame').getAttribute('src'),null,'calculator is not loaded before opening its section');
 if(mode==='allowed'){w.go('phonetics');assert.match(w.document.getElementById('jdPhoneticsFrame').getAttribute('src'),/^https:\/\/judaicadesign\.github\.io\/fonetica-hebreo\//);assert.equal(w.document.getElementById('jdPhoneticsFrame').getAttribute('sandbox'),'allow-scripts allow-downloads');
const generator=w.document.getElementById('jdPhoneticsFrame');
const resize=(source,height)=>w.dispatchEvent(new w.MessageEvent('message',{source,data:{type:'jd-tool-height',tool:'phonetics',height}}));
resize(w,1200);assert.equal(generator.style.height,'','other windows cannot resize generator');
resize(generator.contentWindow,'1200');assert.equal(generator.style.height,'','strings are rejected');
resize(generator.contentWindow,Infinity);assert.equal(generator.style.height,'','invalid heights are rejected');
resize(generator.contentWindow,1200.2);assert.equal(generator.style.height,'1201px');
resize(generator.contentWindow,900);assert.equal(generator.style.height,'900px','can shrink after closing content');
w.go('leaflets');assert.equal(w.document.getElementById('jdLeafletsFrame').getAttribute('src'),'https://judaicadesign.github.io/calculadora-cuadriptico/');assert.equal(w.document.getElementById('jdLeafletsFrame').getAttribute('sandbox'),'allow-scripts');
assert.equal(typeof w.go,'function');w.go('products');assert.ok(w.document.querySelector('#products').classList.contains('active'));assert.ok(w.document.querySelector('#products').textContent.includes('Birkón'));assert.equal(w.document.querySelectorAll('script[data-jd-app]').length,0);
  assert.equal(w.document.querySelector('.jd-dashboard-card').getAttribute('role'),'button');
  assert.equal(w.document.querySelector('.jd-savedquotes-table tbody td').dataset.label,'Cliente');
  for(const button of w.document.querySelectorAll('#nav [data-screen]')){
   button.click();assert.ok(w.document.getElementById(button.dataset.screen).classList.contains('active'));
  }
  const saved=()=>JSON.parse(w.localStorage.getItem('jd_saved_quotes_v6'));
  const deleted=()=>JSON.parse(w.localStorage.getItem('jd_deleted_quotes_v6')||'[]');
  const preserved=JSON.stringify(remote.filter(row=>!row.key.includes('quotes')));
  w.confirm=()=>false;w.alert=()=>{};
  await w.document.querySelector('[data-delete-qid]').onclick();
  assert.equal(saved().length,1);assert.equal(writes.length,0,'cancel must not write');
  w.confirm=()=>true;failWrite=true;
  await w.document.querySelector('[data-delete-qid]').onclick();
  assert.equal(saved().length,1);assert.equal(deleted().length,0,'failure must keep quote');
  failWrite=false;
  await w.document.querySelector('[data-delete-qid]').onclick();
  assert.equal(saved().length,0);assert.equal(deleted().length,1);
  assert.equal(writes.length,1);assert.equal(writes[0].length,2,'move must commit both lists together');
  assert.equal(deleted()[0].pdfUrl,original.app_state[2].value[0].pdfUrl);
  w.document.getElementById('jdQuoteTrash').click();
  await w.document.querySelector('[data-restore-qid]').onclick();
  assert.equal(deleted().length,0);assert.deepEqual(saved(),original.app_state[2].value);
  assert.equal(JSON.stringify(remote.filter(row=>!row.key.includes('quotes'))),preserved,'clients and catalog must be unchanged');
 }
 else{assert.ok(w.document.querySelectorAll('script[data-jd-app]').length>0);assert.equal(w.go,undefined);}
 assert.deepEqual(errors,[],'runtime exceptions');d.window.close();console.log(mode,'passed');
}
(async()=>{for(const mode of ['none','denied','allowed'])await run(mode)})().catch(e=>{console.error(e);process.exit(1)});
