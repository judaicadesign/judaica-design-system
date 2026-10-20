create or replace function jd_private.queue_budget_jobs() returns trigger language plpgsql security invoker set search_path='' as $$
declare jobs jsonb;orders jsonb;moves jsonb;clients jsonb;legacy jsonb;j jsonb;o jsonb;client_name text;income numeric;cost numeric;d text;legacy_row integer;code text;begin
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
 end loop;return new;
end $$;


create or replace function public.jd_supplier_attach_receipt(p_entry uuid,p_expected timestamptz,p_actor uuid,p_receipt jsonb,p_evidence jsonb) returns public.jd_supplier_entries language plpgsql security invoker set search_path='' as $$
declare e public.jd_supplier_entries;begin
 select * into e from public.jd_supplier_entries where id=p_entry for update;
 if not found or e.state<>'posted' or e.kind<>'Pago' or e.receipt_path is not null or e.updated_at<>p_expected then raise exception 'El pago cambió o ya tiene comprobante. Actualizá la cuenta';end if;
 if not exists(select 1 from storage.objects where bucket_id='jd-supplier-receipts' and name=p_receipt->>'path') then raise exception 'Falta cargar el comprobante';end if;
 update public.jd_supplier_entries set receipt_path=p_receipt->>'path',receipt_name=p_receipt->>'name',receipt_mime=p_receipt->>'mime',receipt_size=(p_receipt->>'size')::int,source=coalesce(source,'{}')||jsonb_build_object('chatEvidence',p_evidence),updated_at=now(),history=history||jsonb_build_array(jsonb_build_object('at',now(),'actor',p_actor,'type','Comprobante vinculado','evidence',p_evidence)) where id=e.id returning * into e;
 insert into public.jd_sheet_outbox(destination,entity_id,payload,status) values('zloto',e.id::text,jsonb_build_object('entryId',e.id,'kind',e.kind,'amount',e.ars,'date',e.date,'client',e.client_label,'detail',e.detail,'method',e.method,'hasReceipt',true,'source',e.source,'code',(select code from public.jd_work_codes where source_key='job:'||e.job_id)),'pending') on conflict(destination,entity_id) do update set payload=excluded.payload,status='pending',error=null,updated_at=clock_timestamp();return e;
end $$;
revoke all on function public.jd_supplier_attach_receipt(uuid,timestamptz,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.jd_supplier_attach_receipt(uuid,timestamptz,uuid,jsonb,jsonb) to service_role;
