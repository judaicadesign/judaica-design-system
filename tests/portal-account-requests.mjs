import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createPortalApp,createPublicPortalApp,portalTokenHash,PortalError} from '../supabase/functions/_shared/portal-core.mjs';
const now=new Date('2026-10-18T23:00:00Z'),requests=[],customers=[];let enrolled=0,released=0,failEnroll=false,identity;
const db={
 async requestAccount(name,email,phone,rate){if(!requests.some(r=>r.email===email))requests.push({id:randomUUID(),name,email,phone,status:'pending',created_at:now.toISOString(),updated_at:now.toISOString(),rate_key:rate});},
 async one(table,filters){return (table==='jd_portal_account_requests'?requests:customers).find(r=>Object.entries(filters).every(([k,v])=>r[k]===v));},
 async list(table){return table==='jd_portal_account_requests'?requests:table==='jd_portal_customers'?customers:[];},
 async patch(table,id,values,expected){const r=requests.find(r=>r.id===id);assert.equal(r.updated_at,expected);Object.assign(r,values);return r;},
 isTeam:async email=>email==='team@example.test',sharedPricing:async()=>({markupPct:26,netRoundStep:500,finalRoundStep:100}),
 async claimActivation(hash,attempt){const r=requests.find(r=>r.token_hash===hash&&r.status==='approved');if(!r||new Date(r.expires_at)<=now)throw new PortalError('Invalid or expired',400);r.status='processing';r.attempt_id=attempt;return structuredClone(r);},
 async finishActivation(id,attempt,user){const r=requests.find(r=>r.id===id);assert.equal(r.attempt_id,attempt);assert.equal(r.status,'processing');assert.equal(user,identity);r.status='activated';r.token_hash=null;customers.push({email:r.email,active:true,auth_user_id:user});},
 async releaseActivation(id,attempt){const r=requests.find(r=>r.id===id);assert.equal(r.attempt_id,attempt);r.status='approved';released++;}
};
const auth={user:async token=>({id:randomUUID(),email:token==='admin'?'team@example.test':'client@example.test',email_confirmed_at:now.toISOString()}),enroll:async(email,password)=>{enrolled++;assert.equal(email,'abi@example.test');assert.equal(password,'MyOwnPassword123');if(failEnroll)throw new PortalError('Retry');identity=randomUUID();return {id:identity};}};
const publicApp=createPublicPortalApp({db,auth}),admin=createPortalApp({db,auth,now:()=>now,uuid:randomUUID});
await publicApp({action:'request-account',name:'Abi',email:'ABI@example.test',phone:'111',consent:true},'hashed-ip');assert.equal(requests.length,1);assert.equal(customers.length,0);assert.equal(enrolled,0,'A request must not create an Auth account');
await publicApp({action:'request-account',name:'Abi',email:'ABI@example.test',consent:true},'hashed-ip');assert.equal(requests.length,1);
await publicApp({action:'request-account',website:'bot'},'hashed-ip');assert.equal(requests.length,1);
await assert.rejects(()=>publicApp({action:'request-account',name:'x',email:'bad',consent:true},'x'));
await assert.rejects(()=>publicApp({action:'activate-account',token:'bad',password:'MyOwnPassword123'},'x'));
const r=requests[0];await assert.rejects(()=>publicApp({action:'activate-account',token:'a'.repeat(64),password:'MyOwnPassword123'},'x'));assert.equal(enrolled,0);
await assert.rejects(()=>admin('client',{action:'admin-request',requestId:r.id,approve:true,updated_at:r.updated_at}));
const issued=await admin('admin',{action:'admin-request',requestId:r.id,approve:true,updated_at:r.updated_at});const token=issued.activationUrl.split('activar=')[1];assert.equal(r.token_hash,await portalTokenHash(token));assert.notEqual(r.token_hash,token);assert.ok(!JSON.stringify(issued.request).includes('token_hash'));
const listing=await admin('admin',{action:'admin-list'});assert.ok(!JSON.stringify(listing.requests).includes(r.token_hash));assert.ok(!JSON.stringify(listing.requests).includes('rate_key'));
failEnroll=true;await assert.rejects(()=>publicApp({action:'activate-account',token,password:'MyOwnPassword123'},'x'));assert.equal(released,1);assert.equal(r.status,'approved');assert.equal(customers.length,0);
failEnroll=false;const activated=await publicApp({action:'activate-account',token,password:'MyOwnPassword123',email:'attacker@example.test',pricing_mode:'custom',price_rule:{markupPct:0}},'x');assert.equal(activated.email,'abi@example.test');assert.equal(customers[0].email,'abi@example.test');assert.equal(r.token_hash,null);await assert.rejects(()=>publicApp({action:'activate-account',token,password:'MyOwnPassword123'},'x'));
let receivedPassword;const exactPassword=createPublicPortalApp({db:{claimActivation:async()=>({id:randomUUID(),email:'abi@example.test'}),isTeam:async()=>false,finishActivation:async()=>{}},auth:{enroll:async(email,password)=>{receivedPassword=password;return {id:randomUUID()};}}});await exactPassword({action:'activate-account',token:'a'.repeat(64),password:'  MyOwnPassword123  '},'x');assert.equal(receivedPassword,'  MyOwnPassword123  ','Passwords are never silently trimmed or normalized');
await assert.rejects(()=>admin('admin',{action:'admin-access',customerId:randomUUID()}));
console.log('PASS voluntary account request → admin approval → hashed one-use token → owner-chosen password, no early Auth creation, no role/rule escalation, no request-token leakage, retry and replay protections.');
