const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs');const assert=require('node:assert/strict');
const root=require('path').resolve(__dirname,'..');
const original={app_state:[{key:'jd_catalog_v6',value:[{id:'birkon-librito',name:'Birkón · Librito',nusaj:true,sizes:[],texts:[],models:[],bindings:[],variants:[]}]},{key:'jd_clients',value:[]},{key:'jd_saved_quotes_v6',value:[]},{key:'jd_assets',value:[]}]};
async function run(mode){
 const errors=[],writes=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!e.message.includes('Not implemented: window.scrollTo'))errors.push(e.message)});
 const d=new JSDOM(fs.readFileSync(root+'/index.html','utf8'),{url:'https://judaicadesign.github.io/judaica-design-system/',runScripts:'dangerously',virtualConsole:vc});const w=d.window;
 w.fetch=async()=>({ok:true,json:async()=>({}),text:async()=>''});w.Headers=Headers;w.Request=Request;w.scrollTo=()=>{};
 const client={auth:{getSession:async()=>({data:{session:mode==='none'?null:{access_token:'test-only'}}}),getUser:async()=>({data:{user:{email:'judaica.dzn@gmail.com'}}}),onAuthStateChange:()=>({}),signOut:async()=>({})},storage:{from:()=>({createSignedUrl:async p=>({data:{signedUrl:'https://athiruoimehofqzrplnl.supabase.co/storage/v1/object/sign/jd-assets/'+p+'?token=test'}})})},from:t=>({select:()=>t==='jd_team_access'?{eq:async()=>({data:mode==='denied'?[]:[{email:'judaica.dzn@gmail.com'}]})}:Promise.resolve({data:original.app_state}),upsert:async x=>{writes.push(x);return{}},delete:()=>({eq:async()=>({})})})};
 w.supabase={createClient:()=>client};w.eval(fs.readFileSync(root+'/assets/jd-auth.js','utf8'));
 await new Promise(r=>setTimeout(r,800));
 assert.equal(w.document.body.classList.contains('jd-authenticated'),mode==='allowed');
 assert.equal(writes.length,0,'bootstrap must not write remote commercial data');
 if(mode==='allowed'){assert.equal(typeof w.go,'function');w.go('products');assert.ok(w.document.querySelector('#products').classList.contains('active'));assert.ok(w.document.querySelector('#products').textContent.includes('Birkón'));assert.equal(w.document.querySelectorAll('script[data-jd-app]').length,0);}
 else{assert.ok(w.document.querySelectorAll('script[data-jd-app]').length>0);assert.equal(w.go,undefined);}
 assert.deepEqual(errors,[],'runtime exceptions');d.window.close();console.log(mode,'passed');
}
(async()=>{for(const mode of ['none','denied','allowed'])await run(mode)})().catch(e=>{console.error(e);process.exit(1)});
