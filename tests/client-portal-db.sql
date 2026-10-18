-- Transactional integration test: no fixtures survive, no Auth accounts or files created.
begin;
-- Reference one existing identity only for FK validation; no Auth account/session is created or modified.
select set_config('jd.qa_auth_user',(select id::text from auth.users where id not in(select auth_user_id from public.jd_portal_customers where auth_user_id is not null) limit 1),true);
set local role service_role;
do $$
declare a uuid=gen_random_uuid(); b uuid=gen_random_uuid(); q uuid=gen_random_uuid(); q2 uuid=gen_random_uuid(); expired uuid=gen_random_uuid(); k uuid=gen_random_uuid(); o public.jd_portal_orders; retry public.jd_portal_orders;
begin
 insert into public.jd_portal_customers(id,name,email,active) values(a,'Portal QA A',a||'@example.test',true),(b,'Portal QA B',b||'@example.test',true);
 perform public.jd_portal_save_quote(jsonb_build_object('id',q,'customer_id',a,'request','{}'::jsonb,'customer_result',jsonb_build_object('description','Tríptico','specification','Prueba','alternatives',jsonb_build_array(jsonb_build_object('qty',200,'status','priced','price',104600))),'created_at',now(),'expires_at',now()+interval '1 day'),'{}','{}');
 insert into public.jd_portal_quotes(id,customer_id,request,customer_result,expires_at) values(q2,a,'{}',jsonb_build_object('description','Otro','specification','Prueba','alternatives',jsonb_build_array(jsonb_build_object('qty',100,'status','priced','price',20000))),now()+interval '1 day'),(expired,a,'{}','{}',now()-interval '1 day');
 begin
  perform public.jd_portal_submit_order(b,jsonb_build_array(jsonb_build_object('quoteId',q,'index',0)),'',null,gen_random_uuid());
  raise exception 'QA: Cross customer order was accepted';
 exception when raise_exception then if sqlerrm<>'Cotización no disponible' then raise; end if; end;
 begin
  perform public.jd_portal_submit_order(a,jsonb_build_array(jsonb_build_object('quoteId',expired,'index',0)),'',null,gen_random_uuid());
  raise exception 'QA: Expired quote was accepted';
 exception when raise_exception then if sqlerrm<>'La cotización venció; volvé a consultar' then raise; end if; end;
 o=public.jd_portal_submit_order(a,jsonb_build_array(jsonb_build_object('quoteId',q,'index',0,'price',1),jsonb_build_object('quoteId',q2,'index',0,'price',2)),'QA',null,k);
 if o.total<>124600 or jsonb_array_length(o.items)<>2 then raise exception 'QA: Server totals must override body amounts'; end if;
 retry=public.jd_portal_submit_order(a,'[]','',null,k);
 if retry.id<>o.id then raise exception 'QA: Idempotent retry created a second order'; end if;
 update public.jd_portal_quotes set customer_result='{}' where id=q;
 select * into retry from public.jd_portal_orders where id=o.id;
 if retry.total<>124600 then raise exception 'QA: Order total changed with quote'; end if;
 if not exists(select 1 from public.jd_portal_quote_costs where quote_id=q) then raise exception 'QA: Evidence missing'; end if;
end $$;
do $$
declare rate text=gen_random_uuid()::text; request_email text=gen_random_uuid()||'@example.test'; uid uuid=current_setting('jd.qa_auth_user')::uuid; i integer;
begin
 for i in 1..10 loop perform public.jd_portal_signup_rate(rate); end loop;
 begin perform public.jd_portal_signup_rate(rate);raise exception 'QA: signup rate bypass';exception when raise_exception then if sqlerrm like 'QA:%' then raise;end if;end;
 perform public.jd_portal_register_customer('Direct signup QA',request_email,'1158224686',uid,'{"first_name":"QA","last_name":"Test","locality":"Buenos Aires"}');
 if not exists(select 1 from public.jd_portal_customers where email=request_email and auth_user_id=uid and active and pricing_mode='abi' and price_rule is null) then raise exception 'QA: direct customer registration failed'; end if;
 perform public.jd_portal_register_customer('Retry',request_email,'1158224686',uid,'{"first_name":"QA","last_name":"Test","locality":"Buenos Aires"}');
 update public.jd_portal_customers set active=false where email=request_email;
 begin perform public.jd_portal_register_customer('No reenable',request_email,'1158224686',uid,'{"first_name":"QA","last_name":"Test","locality":"Buenos Aires"}');raise exception 'QA: disabled account reenabled';exception when raise_exception then if sqlerrm like 'QA:%' then raise;end if;end;
 begin perform public.jd_portal_claim_activation(repeat('a',64),gen_random_uuid());raise exception 'QA: legacy activation executable';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
do $$ begin
 begin perform 1 from public.jd_portal_customers; raise exception 'QA: direct client table access'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.jd_portal_quote_costs; raise exception 'QA: direct cost access'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.jd_portal_signup_limits; raise exception 'QA: direct signup rate access'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.jd_portal_account_requests; raise exception 'QA: direct request access'; exception when insufficient_privilege then null; end;
 begin perform public.jd_portal_submit_order(gen_random_uuid(),'[]','',null,gen_random_uuid()); raise exception 'QA: direct client RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: transactional price snapshot, ownership, expiration, multi-item totals, idempotency, client table/RPC denial; all QA fixtures rolled back' as result;
