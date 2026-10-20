const fs=require('fs'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const wait=async f=>{for(let i=0;i<100&&!f();i++)await new Promise(r=>setTimeout(r,5));assert.ok(f());};
(async()=>{
 const dom=new JSDOM('<main class="main"><section id="dashboard"><p class="jd-dashboard-intro"></p></section><section id="portalInbox"><iframe id="jdPortalAdmin" hidden></iframe></section></main><button data-screen="portalInbox"><span id="jdPortalBadge" hidden></span></button>',{runScripts:'outside-only',url:'https://judaicadesign.github.io/judaica-design-system/'}),w=dom.window;
 let calls=0,broken=false,state={customers:[{id:'c',name:'Abi <script>'}],inquiries:[{id:'q',customer_id:'c',customer_result:{description:'250 libritos'}}],orders:[{id:'o',customer_id:'c',status:'Solicitado',work_code:'JD-000001',project:{title:'Trípticos'}},{id:'done',status:'Entregado'}]};
 w.jdSupabase={auth:{getSession:async()=>({data:{session:{access_token:'team'}}})}};w.go=id=>{w.selected=id;};
 w.fetch=async(url,options)=>{calls++;assert.equal(JSON.parse(options.body).action,'admin-list');assert.equal(options.headers.Authorization,'Bearer team');return {ok:!broken,json:async()=>broken?{error:'offline'}:state};};
 w.eval(fs.readFileSync('assets/jd-portal-inbox.js','utf8'));await w.JDPortalInbox.refresh();assert.equal(calls,0,'private requests wait for authenticated hydration');
 w.__JD_SHARED_READY=true;w.document.dispatchEvent(new w.Event('jd-app-ready'));await wait(()=>w.document.querySelector('#jdPortalBadge').textContent==='2');
 assert.ok(w.document.querySelector('#jdPortalInbox').textContent.includes('250 libritos'));assert.equal(w.document.querySelector('#jdPortalInbox script'),null);assert.ok(!w.document.querySelector('#jdPortalInbox').textContent.includes('Debe'));
 assert.equal(w.document.querySelector('#jdPortalAdmin').getAttribute('src'),null);w.document.querySelector('[data-portal-open]').click();assert.equal(w.selected,'portalInbox');assert.equal(w.document.querySelector('#jdPortalAdmin').getAttribute('src'),'portal/equipo.html');assert.equal(w.document.querySelector('#jdPortalAdmin').hidden,false);
 state={customers:[],orders:[],inquiries:[]};await w.JDPortalInbox.refresh();assert.equal(w.document.querySelector('#jdPortalBadge').hidden,true);
 broken=true;await w.JDPortalInbox.refresh();assert.equal(w.document.querySelector('#jdPortalBadge').textContent,'!');assert.ok(w.document.querySelector('#jdPortalInbox').textContent.includes('No significa que no haya solicitudes'));
 dom.window.close();console.log('PASS internal portal inbox: authenticated-only polling, exact pending counters, escaped customer data, in-system admin, resolved requests and honest offline state.');
})().catch(e=>{console.error(e);process.exit(1)});
