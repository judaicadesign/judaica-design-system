import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
// Embedded, disposable Postgres. Never connects to Supabase or user data.
const db=new PGlite();
await db.exec('create role anon; create role authenticated; create role service_role bypassrls;');
await db.exec(await fs.readFile(new URL('../security/whatsapp-inbox.sql',import.meta.url),'utf8'));
await db.exec(await fs.readFile(new URL('../security/whatsapp-worker.sql',import.meta.url),'utf8'));
const claim=async id=>(await db.query('select public.jd_claim_whatsapp_job($1) as result',[id])).rows[0].result;
const budget=async()=>(await db.query("select * from public.jd_whatsapp_ai_budget where id='pilot'")).rows[0];
const count=async()=>(await db.query('select count(*)::integer as count from public.jd_whatsapp_jobs')).rows[0].count;
for(let i=0;i<26;i++)await db.query("insert into public.jd_whatsapp_inbox(message_id,waba_id,phone_number_id,sender_wa_id,message_timestamp,message_type,body_text) values($1,'fixture','fixture','541155512345',1,'text','fixture')",['msg'+i]);
assert.equal((await claim('msg0')).status,'disabled');assert.equal(await count(),0);assert.equal(Number((await budget()).reserved_usd),0);
for(const role of ['anon','authenticated']){
 await db.exec('set role '+role);
 await assert.rejects(()=>db.query('select * from public.jd_whatsapp_jobs'),e=>e.code==='42501');
 await assert.rejects(()=>claim('msg0'),e=>e.code==='42501');
 await db.exec('reset role');
}
await db.exec("update public.jd_whatsapp_ai_budget set enabled=true where id='pilot';");
await db.exec('set role service_role');
await assert.rejects(()=>db.exec("update public.jd_whatsapp_ai_budget set reserved_usd=0 where id='pilot'"),e=>e.code==='42501');
const duplicate=await Promise.all(Array.from({length:10},()=>claim('msg0')));
assert.equal(duplicate.filter(r=>r.status==='claimed').length,1);assert.equal(duplicate.filter(r=>r.status==='duplicate').length,9);
assert.equal(await count(),1);assert.equal(Number((await budget()).reserved_usd),0.05);
await db.exec('begin');assert.equal((await claim('msg1')).status,'claimed');await db.exec('rollback');
assert.equal(await count(),1);assert.equal(Number((await budget()).reserved_usd),0.05,'Claim and budget rollback together');
const rest=await Promise.all(Array.from({length:25},(_,i)=>claim('msg'+(i+1))));
assert.equal(rest.filter(r=>r.status==='claimed').length,19);assert.equal(rest.filter(r=>r.status==='budget_exhausted').length,6);
assert.equal(Number((await budget()).reserved_usd),1);assert.equal((await claim('msg0')).status,'duplicate');
await db.exec('reset role');
const jobs=(await db.query('select state,count(*)::integer as count from public.jd_whatsapp_jobs group by state')).rows;
assert.equal(jobs.find(r=>r.state==='processing').count,20);assert.equal(jobs.find(r=>r.state==='budget_exhausted').count,6);
await assert.rejects(()=>db.exec("update public.jd_whatsapp_ai_budget set limit_usd=2 where id='pilot'"),e=>e.code==='23514');
await db.close();
console.log('PASS embedded Postgres: exact SQL migrations, private roles, disabled default, unique claims, rollback-safe reservations and USD 1 / 20-request cap. Real multi-connection Supabase concurrency remains to verify after deployment.');
