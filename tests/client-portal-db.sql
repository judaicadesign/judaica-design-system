-- Transactional integration test: no fixtures survive, no Auth accounts or files created.
begin;
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
declare rid uuid; attempt uuid=gen_random_uuid(); hash text=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); request_email text=gen_random_uuid()||'@example.test'; rate text=gen_random_uuid()::text; r public.jd_portal_account_requests;
begin
 perform public.jd_portal_request_account('QA Request',request_email,'',rate);
 perform public.jd_portal_request_account('Duplicate',request_email,'',rate);
 if(select count(*) from public.jd_portal_account_requests where rate_key=rate)<>1 then raise exception 'QA: request deduplication failed'; end if;
 if exists(select 1 from public.jd_portal_customers c where c.email=request_email) then raise exception 'QA: request created a customer'; end if;
 select id into rid from public.jd_portal_account_requests where rate_key=rate;
 update public.jd_portal_account_requests set token_hash=hash,status='approved',expires_at=now()+interval '7 days' where id=rid;
 r=public.jd_portal_claim_activation(hash,attempt);
 if r.status<>'processing' or r.attempt_id<>attempt then raise exception 'QA: activation lease failed'; end if;
 begin
  perform public.jd_portal_claim_activation(hash,gen_random_uuid());
  raise exception 'QA: simultaneous activation allowed';
 exception when raise_exception then if sqlerrm like 'QA:%' then raise; end if; end;
 perform public.jd_portal_release_activation(rid,attempt);
 r=public.jd_portal_claim_activation(hash,attempt);
 perform public.jd_portal_release_activation(rid,attempt);
 update public.jd_portal_account_requests set expires_at=now()-interval '1 second' where id=rid;
 begin
  perform public.jd_portal_claim_activation(hash,gen_random_uuid());raise exception 'QA: expired activation allowed';
 exception when raise_exception then if sqlerrm like 'QA:%' then raise; end if; end;
end $$;
set local role authenticated;
do $$ begin
 begin perform 1 from public.jd_portal_customers; raise exception 'QA: direct client table access'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.jd_portal_quote_costs; raise exception 'QA: direct cost access'; exception when insufficient_privilege then null; end;
 begin perform 1 from public.jd_portal_account_requests; raise exception 'QA: direct request access'; exception when insufficient_privilege then null; end;
 begin perform public.jd_portal_submit_order(gen_random_uuid(),'[]','',null,gen_random_uuid()); raise exception 'QA: direct client RPC'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: transactional price snapshot, ownership, expiration, multi-item totals, idempotency, client table/RPC denial; all QA fixtures rolled back' as result;
