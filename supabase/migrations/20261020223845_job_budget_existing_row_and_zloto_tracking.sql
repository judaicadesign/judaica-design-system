create or replace function public.jd_reconcile_job_print(p_job text,p_actor uuid) returns void language plpgsql security invoker set search_path='' as $$
declare j jsonb;r jsonb;a jsonb;m jsonb;old jsonb;mid text;sid uuid;e public.jd_supplier_entries;amt numeric;client_name text;code text;stamp text:=to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');begin
 perform pg_advisory_xact_lock(hashtextextended('jd-state:jd_finance_moves_v1',0));
 select x into j from public.app_state s cross join lateral jsonb_array_elements(s.value) x where s.key='jd_jobs_v1' and x->>'id'=p_job;
 if j is null then raise exception 'Trabajo no disponible';end if;
 select value into a from public.app_state where key='jd_finance_moves_v1' for update;a:=coalesce(a,'[]');
 select x->>'name' into client_name from public.app_state s cross join lateral jsonb_array_elements(s.value) x where s.key='jd_clients' and x->>'id'=j->>'clientId';
 select c.code into code from public.jd_work_codes c where c.source_key='job:'||p_job;
 for r in select x from jsonb_array_elements(coalesce(j->'supplierOrders','[]')) x loop
  amt:=coalesce(nullif(r->>'net','')::numeric,nullif(r->>'actualCost','')::numeric);mid:='job-print-cost:'||p_job||':'||(r->>'id');
  if lower(r->>'supplier') like '%zloto%' then
   sid:=md5('job-order:'||p_job||':'||(r->>'id'))::uuid;
   select * into e from public.jd_supplier_entries where id=sid;
   if e.id is null and (r->>'voidedAt' is not null or amt is null or amt<=0) then continue;end if;
   if e.id is null then insert into public.jd_supplier_entries(id,kind,supplier,amount,currency,rate,job_id,client_label,detail,date,state,source,source_key,created_by) values(sid,'Cargo','Zloto',amt,'ARS',1,p_job,coalesce(client_name,''),coalesce(r->>'description',j->>'title'),current_date,'posted',jsonb_build_object('jobSupplierOrderId',r->>'id','fileSent',coalesce(j->>'printSentAt',r->>'fileSentAt','')<>''),'job-order:'||p_job||':'||(r->>'id'),p_actor) returning * into e;
   else update public.jd_supplier_entries set amount=case when amt>0 then amt else amount end,state=case when r->>'voidedAt' is not null or amt is null or amt<=0 then 'void' else 'posted' end,source=coalesce(source,'{}')||jsonb_build_object('jobSupplierOrderId',r->>'id','fileSent',coalesce(j->>'printSentAt',r->>'fileSentAt','')<>'','delivered',coalesce(r->>'pickedUpAt','')<>''),detail=coalesce(r->>'description',j->>'title'),updated_at=clock_timestamp(),history=case when amount is distinct from amt then history||jsonb_build_array(jsonb_build_object('at',stamp,'type','Costo actualizado desde trabajo','before',amount,'after',amt)) else history end where id=sid returning * into e;end if;
   -- Retire the temporary job charge; the supplier account owns the only final charge.
   select coalesce(jsonb_agg(case when x->>'id'=mid then x||jsonb_build_object('voidAt',stamp,'voidReason','Vinculado a cargo único de cuenta Zloto') else x end),'[]') into a from jsonb_array_elements(a) x;
   mid:='supplier-'||sid;
   insert into public.jd_sheet_outbox(destination,entity_id,payload,status) values('zloto',sid::text,jsonb_build_object('entryId',sid,'kind','Cargo','amount',case when e.state='void' then 0 else amt end,'date',e.date,'client',client_name,'detail',e.detail,'method','','hasReceipt',false,'code',code,'source',e.source),'pending') on conflict(destination,entity_id) do update set payload=excluded.payload,status='pending',error=null,updated_at=clock_timestamp() where public.jd_sheet_outbox.payload is distinct from excluded.payload;
  end if;
  select x into old from jsonb_array_elements(a) x where x->>'id'=mid;
  if r->>'voidedAt' is not null or amt is null then
   select coalesce(jsonb_agg(case when x->>'id'=mid then x||jsonb_build_object('voidAt',coalesce(x->>'voidAt',stamp)) else x end),'[]') into a from jsonb_array_elements(a) x;continue;
  end if;
  m:=(coalesce(old,'{}')-'voidAt')||jsonb_build_object('id',mid,'jobId',p_job,'supplierOrderId',r->>'id','kind','Egreso','status','Realizado','category','Imprenta','currency','ARS','amount',amt,'provider',r->>'supplier','notCash',true,'date',coalesce(old->>'date',current_date::text),'detail',coalesce(r->>'supplier','')||' #'||coalesce(r->>'code',''),'createdAt',coalesce(old->>'createdAt',stamp));
  if lower(r->>'supplier') like '%zloto%' then m:=m||jsonb_build_object('supplierEntryId',sid);end if;
  if old is null then a:=a||jsonb_build_array(m);else select jsonb_agg(case when x->>'id'=mid then m else x end) into a from jsonb_array_elements(a) x;end if;
 end loop;
 insert into public.app_state(key,value,updated_at) values('jd_finance_moves_v1',a,clock_timestamp()) on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at where public.app_state.value is distinct from excluded.value;
end $$;
revoke all on function public.jd_reconcile_job_print(text,uuid) from public,anon,authenticated;grant execute on function public.jd_reconcile_job_print(text,uuid) to service_role;

create or replace function jd_private.queue_budget_jobs() returns trigger language plpgsql security invoker set search_path='' as $$
declare jobs jsonb;orders jsonb;moves jsonb;clients jsonb;legacy jsonb;j jsonb;o jsonb;client_name text;income numeric;cost numeric;d text;legacy_row integer;code text;m jsonb;eligible boolean;begin
 select value into jobs from public.app_state where key='jd_jobs_v1';select value into orders from public.app_state where key='jd_orders_v1';select value into moves from public.app_state where key='jd_finance_moves_v1';select value into clients from public.app_state where key='jd_clients';select value into legacy from public.app_state where key='jd_finance_legacy_v1';
 for j in select value from jsonb_array_elements(coalesce(jobs,'[]')) where not value ? 'deletedAt' or value->>'deletedAt' is null loop
  select value into o from jsonb_array_elements(coalesce(orders,'[]')) where value->>'id'=j->>'orderId';
  if o is not null then income:=coalesce((o->'quantity'->>'price')::numeric,0);d:=coalesce(nullif(o->>'approvedAt',''),left(o->>'created',10));
  else income:=0;d:=null;end if;
  select coalesce(sum((m->>'amount')::numeric),0) into cost from jsonb_array_elements(coalesce(moves,'[]')) m where m->>'jobId'=j->>'id' and m->>'kind'='Egreso' and m->>'status'='Realizado' and m->>'currency'='ARS' and m->>'voidAt' is null and coalesce((m->>'settlement')::boolean,false)=false and coalesce((m->>'legacyOverlap')::boolean,false)=false;
  if income=0 and cost=0 and not exists(select 1 from public.jd_sheet_outbox where destination='budget' and entity_id=j->>'id') then continue;end if;
  select value->>'name' into client_name from jsonb_array_elements(coalesce(clients,'[]')) where value->>'id'=j->>'clientId';
  select c.code into code from public.jd_work_codes c where source_key='job:'||(j->>'id');if code is null then continue;end if;
  select min((l->'source'->>'row')::int) into legacy_row from jsonb_array_elements(coalesce(legacy,'[]')) l where l->>'currency'='ARS' and length(coalesce(client_name,''))>4 and position(lower(client_name) in lower(l->>'label'))>0;
  if j->>'financeLegacyRow' is not null then legacy_row:=null;end if;
  insert into public.jd_sheet_outbox(destination,entity_id,payload,status,error)
   values('budget',j->>'id',jsonb_build_object('jobId',j->>'id','code',code,'label',coalesce(client_name,'')||' · '||(j->>'title'),'displayLabel','JD - '||case when coalesce(o->>'product',j->>'title') ilike '%birk%' then 'Birkonim' else coalesce(o->>'product',j->>'title') end||' - '||coalesce(client_name,'')||case when o->'quantity'->>'qty' is not null then ' - '||(o->'quantity'->>'qty')||' '||case when o->'selectedAlternative'->>'model'='Tríptico' then 'trípticos' when o->'selectedAlternative'->>'model'='Cuadríptico' then 'cuadrípticos' else 'unidades' end else '' end,'date',coalesce(d,left(j->>'created',10),current_date::text),'income',income,'cost',cost,'legacyRow',legacy_row,'targetRow',nullif(j->>'financeLegacyRow','')::integer),case when legacy_row is null then 'pending' else 'conflict' end,case when legacy_row is not null then 'Existe un antecedente en la fila '||legacy_row||'. Se conserva sin sobrescribir; conciliar primero.' end)
   on conflict(destination,entity_id) do update set payload=excluded.payload,status=excluded.status,error=excluded.error,updated_at=clock_timestamp() where public.jd_sheet_outbox.payload is distinct from excluded.payload;
 end loop;
 for m in select value from jsonb_array_elements(coalesce(moves,'[]')) loop
  eligible:=coalesce(m->>'jobId','')='' and m->>'status'='Realizado' and m->>'currency'='ARS' and m->>'voidAt' is null and coalesce((m->>'legacyOverlap')::boolean,false)=false and coalesce((m->>'settlement')::boolean,false)=false;
  if not eligible and not exists(select 1 from public.jd_sheet_outbox where destination='budget' and entity_id='move:'||(m->>'id')) then continue;end if;
  insert into public.jd_sheet_outbox(destination,entity_id,payload,status) values('budget','move:'||(m->>'id'),jsonb_build_object('code','MOV-'||left(m->>'id',8),'label',coalesce(m->>'category','Movimiento JD')||' · '||coalesce(m->>'detail',''),'date',m->>'date','income',case when eligible and m->>'kind'='Ingreso' then (m->>'amount')::numeric else 0 end,'cost',case when eligible and m->>'kind'='Egreso' then (m->>'amount')::numeric else 0 end),'pending') on conflict(destination,entity_id) do update set payload=excluded.payload,status='pending',error=null,updated_at=clock_timestamp() where public.jd_sheet_outbox.payload is distinct from excluded.payload;
 end loop;return new;
end $$;