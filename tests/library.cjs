/* Smoke tests: private Biblioteca JD reader (no network / no credentials). */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261020_jd_library_private_read.sql'),'utf8');
const js=fs.readFileSync(path.join(root,'assets/jd-library.js'),'utf8');
assert.match(index, /data-screen="library"/);
assert.match(index, /id="jdLibraryReader"/);
assert.match(sql, /enable row level security/gi);
assert.match(sql, /jd_library_documents\.access_level = 'equipo'/);
assert.match(sql, /security invoker/);
assert.doesNotMatch(sql, /grant (?:insert|update|delete) on public\.jd_library_documents to authenticated/i);
assert.doesNotMatch(js, /innerHTML\s*=/i);
const dom=new JSDOM('<nav id="nav"><button data-screen="library">Biblioteca</button></nav><section id="library"><div id="jdLibraryListView"><input id="jdLibrarySearch"><p id="jdLibraryStatus"></p><div id="jdLibraryCards"></div></div><div id="jdLibraryReader" hidden><button id="jdLibraryBack"></button><a id="jdLibrarySource"></a><h2 id="jdLibraryDocumentTitle"></h2><p id="jdLibraryDocumentMeta"></p><nav id="jdLibraryToc"></nav><div id="jdLibraryBody"></div></div></section>',{url:'https://judaicadesign.github.io',runScripts:'outside-only'});
const {window}=dom;
const documents=[{
 drive_file_id:'123456789012345',title:'00 Índice Maestro',module_code:'00',
 category:'Gobierno',editorial_status:'vigente',version:'1.0',
 drive_url:'https://docs.google.com/document/d/123456789012345/edit',
 synced_at:'2026-10-20T05:00:00Z',
 content_text:'Capítulo primero\nMaterial <img src=x onerror=alert(1)> privado',
 sections:[{title:'Capítulo primero',offset:0,level:2}]
}];
window.jdSupabase={
 from(table){assert.equal(table,'jd_library_documents');return{
  select(){return{
   order(){return {limit:async()=>({data:documents,error:null})}},
   eq(){return {single:async()=>({data:documents[0],error:null})}}
  }}
 }},
 rpc:async(name,args)=>{assert.equal(name,'jd_library_search');return {data:documents.filter(d=>d.title.toLowerCase().includes(args.search_text.toLowerCase())),error:null}}
};
window.eval(js);
async function main(){
 window.document.querySelector('button[data-screen="library"]').click();
 await new Promise(resolve=>setTimeout(resolve,15));
 assert.equal(window.document.querySelectorAll('.jd-library-card').length,1);
 window.document.querySelector('.jd-library-card').click();
 await new Promise(resolve=>setTimeout(resolve,15));
 assert.match(window.document.querySelector('#jdLibraryBody').textContent,/Material <img/);
 assert.equal(window.document.querySelector('#jdLibraryBody img'),null,'Never interpret synced document as HTML');
 assert.match(window.document.querySelector('#jdLibraryDocumentTitle').textContent,/Índice/);
 window.document.querySelector('#jdLibraryBack').click();
 assert.equal(window.document.querySelector('#jdLibraryReader').hidden,true);
 console.log('OK Biblioteca JD: navigation, private query, text-only reader, XSS regression');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
