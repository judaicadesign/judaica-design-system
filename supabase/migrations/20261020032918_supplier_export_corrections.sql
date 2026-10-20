create or replace function public.jd_supplier_update(p_entry uuid,p_actor uuid,p_expected timestamptz,p_job text,p_flags jsonb,p_void_reason text) returns public.jd_supplier_entries language plpgsql security invoker set search_path='' as $$
declare e public.jd_supplier_entries;a jsonb;i integer;m jsonb;begin
 select * into e from public.jd_supplier_entries where id=p_entry for update;if not found or e.updated_at<>p_expected or e.state<>'posted' then raise exception 'El movimiento cambió. Actualizá la cuenta';end if;
 if p_void_reason is not null and e.source_key is not null then raise exception 'El antecedente importado se conserva; conciliá primero con la planilla';end if;
 if p_job is not null and not exists(select 1 from public.app_state s cross join lateral jsonb_array_elements(s.value) j where s.key='jd_jobs_v1' and j->>'id'=p_job) then raise exception 'Trabajo no disponible';end if;
 update public.jd_supplier_entries set job_id=p_job,source=coalesce(source,'{}')||p_flags,state=case when p_void_reason is null then 'posted' else 'void' end,updated_at=now(),history=history||jsonb_build_array(jsonb_build_object('at',now(),'actor',p_actor,'type',case when p_void_reason is null then 'Vinculación / estado' else 'Anulación' end,'reason',p_void_reason,'previousJob',job_id)) where id=e.id returning * into e;
 if e.source_key is null then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('jd-state:jd_finance_moves_v1',0));select value into a from public.app_state where key='jd_finance_moves_v1' for update;
  select value,ordinality::int-1 into m,i from jsonb_array_elements(coalesce(a,'[]')) with ordinality where value->>'id'='supplier-'||e.id;
  if m is not null then update public.app_state set value=jsonb_set(value,array[i::text],m||jsonb_build_object('jobId',p_job)||case when p_void_reason is not null then jsonb_build_object('voidAt',now(),'voidReason',p_void_reason) else '{}'::jsonb end),updated_at=now() where key='jd_finance_moves_v1';end if;
 end if;
 insert into public.jd_sheet_outbox(destination,entity_id,payload,status) values('zloto',e.id::text,jsonb_build_object('entryId',e.id,'kind',e.kind,'amount',case when e.state='void' then 0 else e.ars end,'date',e.date,'client',e.client_label,'detail',case when e.state='void' then 'ANULADO · '||e.detail else e.detail end,'method',e.method,'hasReceipt',e.receipt_path is not null and e.state='posted','source',e.source,'code',(select code from public.jd_work_codes where source_key='job:'||e.job_id)),'pending')
 on conflict(destination,entity_id) do update set payload=excluded.payload,status='pending',error=null,updated_at=clock_timestamp();return e;
end $$;

create or replace function jd_private.queue_budget_jobs() returns trigger language plpgsql security invoker set search_path='' as $$
declare jobs jsonb;orders jsonb;moves jsonb;clients jsonb;legacy jsonb;j jsonb;o jsonb;client_name text;income numeric;cost numeric;d text;legacy_row integer;code text;m jsonb;eligible boolean;begin
 select value into jobs from public.app_state where key='jd_jobs_v1';select value into orders from public.app_state where key='jd_orders_v1';select value into moves from public.app_state where key='jd_finance_moves_v1';select value into clients from public.app_state where key='jd_clients';select value into legacy from public.app_state where key='jd_finance_legacy_v1';
 for j in select value from jsonb_array_elements(coalesce(jobs,'[]')) where not value ? 'deletedAt' or value->>'deletedAt' is null loop
  select value into o from jsonb_array_elements(coalesce(orders,'[]')) where value->>'id'=j->>'orderId';
  if o is not null then select coalesce(sum((p->>'ars')::numeric),0),min(left(p->>'date',10)) into income,d from jsonb_array_elements(coalesce(o->'payments','[]')) p where p->>'voidedAt' is null and coalesce((p->>'legacy')::boolean,false)=false;
  else select coalesce(sum((m->>'amount')::numeric),0),min(m->>'date') into income,d from jsonb_array_elements(coalesce(moves,'[]')) m where m->>'jobId'=j->>'id' and m->>'kind'='Ingreso' and m->>'status'='Realizado' and m->>'currency'='ARS' and m->>'voidAt' is null;end if;
  select coalesce(sum((m->>'amount')::numeric),0) into cost from jsonb_array_elements(coalesce(moves,'[]')) m where m->>'jobId'=j->>'id' and m->>'kind'='Egreso' and m->>'status'='Realizado' and m->>'currency'='ARS' and m->>'voidAt' is null and coalesce((m->>'settlement')::boolean,false)=false and coalesce((m->>'legacyOverlap')::boolean,false)=false;
  if income=0 and cost=0 and not exists(select 1 from public.jd_sheet_outbox where destination='budget' and entity_id=j->>'id') then continue;end if;
  select value->>'name' into client_name from jsonb_array_elements(coalesce(clients,'[]')) where value->>'id'=j->>'clientId';
  select c.code into code from public.jd_work_codes c where source_key='job:'||(j->>'id');if code is null then continue;end if;
  select min((l->'source'->>'row')::int) into legacy_row from jsonb_array_elements(coalesce(legacy,'[]')) l where l->>'currency'='ARS' and length(coalesce(client_name,''))>4 and position(lower(client_name) in lower(l->>'label'))>0;
  insert into public.jd_sheet_outbox(destination,entity_id,payload,status,error)
   values('budget',j->>'id',jsonb_build_object('jobId',j->>'id','code',code,'label',coalesce(client_name,'')||' · '||(j->>'title'),'date',coalesce(d,left(j->>'created',10),current_date::text),'income',income,'cost',cost,'legacyRow',legacy_row),case when legacy_row is null then 'pending' else 'conflict' end,case when legacy_row is not null then 'Existe un antecedente en la fila '||legacy_row||'. Se conserva sin sobrescribir; conciliar primero.' end)
   on conflict(destination,entity_id) do update set payload=excluded.payload,status=excluded.status,error=excluded.error,updated_at=clock_timestamp() where public.jd_sheet_outbox.payload is distinct from excluded.payload;
 end loop;
 for m in select value from jsonb_array_elements(coalesce(moves,'[]')) loop
  eligible:=coalesce(m->>'jobId','')='' and m->>'status'='Realizado' and m->>'currency'='ARS' and m->>'voidAt' is null and coalesce((m->>'legacyOverlap')::boolean,false)=false and coalesce((m->>'settlement')::boolean,false)=false;
  if not eligible and not exists(select 1 from public.jd_sheet_outbox where destination='budget' and entity_id='move:'||(m->>'id')) then continue;end if;
  insert into public.jd_sheet_outbox(destination,entity_id,payload,status) values('budget','move:'||(m->>'id'),jsonb_build_object('code','MOV-'||left(m->>'id',8),'label',coalesce(m->>'category','Movimiento JD')||' · '||coalesce(m->>'detail',''),'date',m->>'date','income',case when eligible and m->>'kind'='Ingreso' then (m->>'amount')::numeric else 0 end,'cost',case when eligible and m->>'kind'='Egreso' then (m->>'amount')::numeric else 0 end),'pending') on conflict(destination,entity_id) do update set payload=excluded.payload,status='pending',error=null,updated_at=clock_timestamp() where public.jd_sheet_outbox.payload is distinct from excluded.payload;
 end loop;return new;
end $$;