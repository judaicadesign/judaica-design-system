-- Internal supplier accounts; no customer access to costs or receipts.
create table public.jd_supplier_entries (
 id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('Cargo','Pago')),supplier text not null default 'Zloto' check(supplier='Zloto'),
 amount numeric(16,2) not null check(amount>0),currency text not null check(currency in ('ARS','USD','USDT')),rate numeric(16,6) not null check(rate>0),ars numeric(16,2) generated always as (round(amount*rate,2)) stored,
 job_id text,client_label text not null default '',detail text not null default '',date date,method text not null default '',
 receipt_path text,receipt_name text,receipt_mime text,receipt_size integer,
 state text not null default 'posted' check(state in ('draft','posted','void')),source jsonb,source_key text unique,
 created_by uuid,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),history jsonb not null default '[]'
);
create table public.jd_sheet_outbox (
 id uuid primary key default gen_random_uuid(),destination text not null check(destination in ('zloto','budget')),entity_id text not null,
 payload jsonb not null,status text not null default 'pending' check(status in ('pending','synced','conflict')),error text,receipt_url text,sheet_range text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(destination,entity_id)
);
create table public.jd_sheet_connection (id boolean primary key default true check(id),token_hash text,created_by uuid,created_at timestamptz not null default now());
create table public.jd_review_versions (
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.jd_portal_orders(id),version_no integer not null,
 title text not null,page_count integer not null check(page_count between 1 and 400),rtl boolean not null default true,approvable boolean not null default false,
 source_name text not null,source_sha256 text not null check(source_sha256 ~ '^[a-f0-9]{64}$'),state text not null default 'draft' check(state in ('draft','published','superseded')),
 created_by uuid not null,created_at timestamptz not null default now(),published_at timestamptz,unique(order_id,version_no)
);
alter table public.jd_portal_orders add column current_review_id uuid references public.jd_review_versions(id);
create table public.jd_review_pages (
 id uuid primary key default gen_random_uuid(),version_id uuid not null references public.jd_review_versions(id),page integer not null check(page>0),
 path text not null unique,mime text not null check(mime in ('image/jpeg','image/png')),size_bytes integer not null check(size_bytes between 1 and 8388608),width integer not null check(width between 1 and 6000),height integer not null check(height between 1 and 6000),
 state text not null default 'pending' check(state in ('pending','uploaded')),sha256 text,created_at timestamptz not null default now(),unique(version_id,page)
);
create table public.jd_review_comments (
 id uuid primary key default gen_random_uuid(),version_id uuid not null references public.jd_review_versions(id),page integer not null check(page>0),
 x numeric not null check(x between 0 and 1),y numeric not null check(y between 0 and 1),body text not null check(length(body) between 1 and 5000),
 actor_id uuid not null,actor_role text not null check(actor_role in ('team','customer')),parent_id uuid references public.jd_review_comments(id),resolved_at timestamptz,resolved_by uuid,created_at timestamptz not null default now()
);
create table public.jd_review_approvals (
 id uuid primary key default gen_random_uuid(),version_id uuid not null unique references public.jd_review_versions(id),actor_id uuid not null,
 consent text not null,manifest jsonb not null,created_at timestamptz not null default now()
);
do $$ declare t text;begin foreach t in array array['jd_supplier_entries','jd_sheet_outbox','jd_sheet_connection','jd_review_versions','jd_review_pages','jd_review_comments','jd_review_approvals'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon,authenticated',t);execute format('grant all on public.%I to service_role',t);
 end loop;end $$;
create index jd_supplier_job on public.jd_supplier_entries(job_id);
create index jd_review_order on public.jd_review_versions(order_id);
create index jd_review_page_version on public.jd_review_pages(version_id);
create index jd_review_comment_version on public.jd_review_comments(version_id);
create index jd_review_comment_parent on public.jd_review_comments(parent_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('jd-supplier-receipts','jd-supplier-receipts',false,26214400,array['application/pdf','image/png','image/jpeg']) on conflict(id) do nothing;

-- Keep facts in the private job without advancing its production/QC stage.
create function jd_private.review_job_event(p_job text,p_event jsonb,p_check jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare a jsonb;j jsonb;i integer;begin
 if p_job is null then return;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('jd-state:jd_jobs_v1',0));
 select value into a from public.app_state where key='jd_jobs_v1' for update;
 select e.value,e.ordinality::int-1 into j,i from jsonb_array_elements(a) with ordinality e where e.value->>'id'=p_job;
 if j is null then return;end if;
 j:=j||jsonb_build_object('history',coalesce(j->'history','[]')||jsonb_build_array(p_event),'updatedAt',now());
 if p_check is not null then j:=j||jsonb_build_object('opsChecks',coalesce(j->'opsChecks','{}')||jsonb_build_object('client',p_check));end if;
 update public.app_state set value=jsonb_set(value,array[i::text],j),updated_at=now() where key='jd_jobs_v1';
end $$;
grant usage on schema jd_private to service_role;
revoke all on function jd_private.review_job_event(text,jsonb,jsonb) from public;
grant execute on function jd_private.review_job_event(text,jsonb,jsonb) to service_role;

create function public.jd_review_create(p_order uuid,p_actor uuid,p_data jsonb) returns public.jd_review_versions language plpgsql security invoker set search_path='' as $$
declare v public.jd_review_versions;n integer;begin
 perform 1 from public.jd_portal_orders where id=p_order and status not in ('En producción','Listo para entregar','Entregado','Cancelado') for update;
 if not found then raise exception 'El trabajo está cerrado para nuevas muestras';end if;
 select coalesce(max(version_no),0)+1 into n from public.jd_review_versions where order_id=p_order;
 insert into public.jd_review_versions(order_id,version_no,title,page_count,rtl,approvable,source_name,source_sha256,created_by)
 values(p_order,n,p_data->>'title',(p_data->>'page_count')::int,(p_data->>'rtl')::boolean,(p_data->>'approvable')::boolean,p_data->>'source_name',p_data->>'source_sha256',p_actor) returning * into v;return v;
end $$;
create function public.jd_review_publish(p_version uuid) returns public.jd_review_versions language plpgsql security invoker set search_path='' as $$
declare v public.jd_review_versions;o public.jd_portal_orders;begin
 select * into v from public.jd_review_versions where id=p_version;
 select * into o from public.jd_portal_orders where id=v.order_id for update;
 select * into v from public.jd_review_versions where id=p_version for update;
 if v.state='published' and o.current_review_id=v.id then return v;end if;
 if v.state<>'draft' or o.status in ('En producción','Listo para entregar','Entregado','Cancelado') then raise exception 'Esta muestra no se puede publicar';end if;
 if (select count(*) from public.jd_review_pages where version_id=v.id and state='uploaded')<>v.page_count or exists(select 1 from generate_series(1,v.page_count) n where not exists(select 1 from public.jd_review_pages p where p.version_id=v.id and p.page=n and p.sha256 is not null)) then raise exception 'Faltan páginas de la muestra';end if;
 update public.jd_review_versions set state='superseded' where order_id=o.id and state='published';
 update public.jd_review_versions set state='published',published_at=now() where id=v.id returning * into v;
 update public.jd_portal_orders set current_review_id=v.id,updated_at=now(),history=history||jsonb_build_array(jsonb_build_object('at',now(),'type','Muestra','text','Nueva muestra: versión '||v.version_no||' · '||v.title)) where id=o.id;
 perform jd_private.review_job_event(o.project->>'source_job_id',jsonb_build_object('at',now(),'type','Muestra','text','Nueva muestra en portal · versión '||v.version_no||'. Requiere revisión del cliente.'),jsonb_build_object('ok',false,'evidence','Nueva muestra pendiente de aprobación','reviewId',v.id));
 return v;
end $$;
create function public.jd_review_comment(p_version uuid,p_actor uuid,p_role text,p_page integer,p_x numeric,p_y numeric,p_body text,p_parent uuid) returns public.jd_review_comments language plpgsql security invoker set search_path='' as $$
declare v public.jd_review_versions;o public.jd_portal_orders;c public.jd_review_comments;parent public.jd_review_comments;begin
 select * into v from public.jd_review_versions where id=p_version;
 select * into o from public.jd_portal_orders where id=v.order_id for update;
 if o.current_review_id is distinct from v.id or v.state<>'published' or exists(select 1 from public.jd_review_approvals where version_id=v.id) then raise exception 'La versión cambió o ya está aprobada. Actualizá la muestra';end if;
 if p_role='customer' and not exists(select 1 from public.jd_portal_customers where id=o.customer_id and auth_user_id=p_actor and active) then raise exception 'Acceso no autorizado';end if;
 if p_parent is not null then select * into parent from public.jd_review_comments where id=p_parent and version_id=v.id and parent_id is null;if not found then raise exception 'Comentario no disponible';end if;p_page:=parent.page;p_x:=parent.x;p_y:=parent.y;end if;
 if p_page<1 or p_page>v.page_count then raise exception 'Página inválida';end if;
 insert into public.jd_review_comments(version_id,page,x,y,body,actor_id,actor_role,parent_id) values(v.id,p_page,p_x,p_y,btrim(p_body),p_actor,p_role,p_parent) returning * into c;return c;
end $$;
create function public.jd_review_resolve(p_comment uuid,p_actor uuid,p_role text,p_resolved boolean) returns public.jd_review_comments language plpgsql security invoker set search_path='' as $$
declare c public.jd_review_comments;v public.jd_review_versions;o public.jd_portal_orders;begin
 select * into c from public.jd_review_comments where id=p_comment;
 select * into v from public.jd_review_versions where id=c.version_id;
 select * into o from public.jd_portal_orders where id=v.order_id for update;
 if o.current_review_id is distinct from v.id or c.parent_id is not null or exists(select 1 from public.jd_review_approvals where version_id=v.id) then raise exception 'La muestra ya no admite cambios';end if;
 if p_role<>'team' and c.actor_id<>p_actor then raise exception 'Solo podés resolver tu observación';end if;
 update public.jd_review_comments set resolved_at=case when p_resolved then now() else null end,resolved_by=case when p_resolved then p_actor else null end where id=c.id returning * into c;return c;
end $$;
create function public.jd_review_approve(p_version uuid,p_actor uuid,p_customer uuid) returns public.jd_review_approvals language plpgsql security invoker set search_path='' as $$
declare v public.jd_review_versions;o public.jd_portal_orders;a public.jd_review_approvals;m jsonb;s text:='Revisé nombres, fechas, nusaj y textos de esta versión. Confirmo su contenido y autorizo su impresión.';begin
 select * into v from public.jd_review_versions where id=p_version;
 select * into o from public.jd_portal_orders where id=v.order_id for update;
 if o.customer_id<>p_customer or not exists(select 1 from public.jd_portal_customers where id=p_customer and auth_user_id=p_actor and active) then raise exception 'Acceso no autorizado';end if;
 if o.current_review_id is distinct from v.id or v.state<>'published' or not v.approvable or o.status in ('En producción','Listo para entregar','Entregado','Cancelado') then raise exception 'Esta versión no está disponible para aprobación';end if;
 select * into a from public.jd_review_approvals where version_id=v.id;if found then return a;end if;
 if exists(select 1 from public.jd_review_comments where version_id=v.id and parent_id is null and resolved_at is null) then raise exception 'Quedan observaciones por resolver';end if;
 select jsonb_agg(jsonb_build_object('page',page,'sha256',sha256,'width',width,'height',height) order by page) into m from public.jd_review_pages where version_id=v.id and state='uploaded';
 if jsonb_array_length(m)<>v.page_count then raise exception 'Muestra incompleta';end if;
 insert into public.jd_review_approvals(version_id,actor_id,consent,manifest) values(v.id,p_actor,s,m) returning * into a;
 update public.jd_portal_orders set updated_at=now(),history=history||jsonb_build_array(jsonb_build_object('at',now(),'type','Aprobación del cliente','text','Cliente autorizó impresión · versión '||v.version_no||' · '||v.title)) where id=o.id;
 perform jd_private.review_job_event(o.project->>'source_job_id',jsonb_build_object('at',now(),'type','Aprobación del diseño','text','Cliente aprobó para impresión en portal · versión '||v.version_no||' · '||o.work_code),jsonb_build_object('ok',true,'evidence','Portal '||o.work_code||' · versión '||v.version_no||' · aprobación '||a.id,'reviewId',v.id,'checkedAt',now()));
 return a;
end $$;
-- All write RPCs run only behind the authenticated edge service.
do $$ declare r record;begin for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('jd_review_create','jd_review_publish','jd_review_comment','jd_review_resolve','jd_review_approve') loop
 execute format('revoke all on function %s from public,anon,authenticated',r.signature);execute format('grant execute on function %s to service_role',r.signature);end loop;end $$;

create function jd_private.queue_budget_jobs() returns trigger language plpgsql security invoker set search_path='' as $$
declare jobs jsonb;orders jsonb;moves jsonb;clients jsonb;legacy jsonb;j jsonb;o jsonb;client_name text;income numeric;cost numeric;d text;legacy_row integer;code text;begin
 select value into jobs from public.app_state where key='jd_jobs_v1';select value into orders from public.app_state where key='jd_orders_v1';select value into moves from public.app_state where key='jd_finance_moves_v1';select value into clients from public.app_state where key='jd_clients';select value into legacy from public.app_state where key='jd_finance_legacy_v1';
 for j in select value from jsonb_array_elements(coalesce(jobs,'[]')) where not value ? 'deletedAt' or value->>'deletedAt' is null loop
  select value into o from jsonb_array_elements(coalesce(orders,'[]')) where value->>'id'=j->>'orderId';
  if o is not null then select coalesce(sum((p->>'ars')::numeric),0),min(left(p->>'date',10)) into income,d from jsonb_array_elements(coalesce(o->'payments','[]')) p where p->>'voidedAt' is null and coalesce((p->>'legacy')::boolean,false)=false;
  else select coalesce(sum((m->>'amount')::numeric),0),min(m->>'date') into income,d from jsonb_array_elements(coalesce(moves,'[]')) m where m->>'jobId'=j->>'id' and m->>'kind'='Ingreso' and m->>'status'='Realizado' and m->>'currency'='ARS' and m->>'voidAt' is null;end if;
  select coalesce(sum((m->>'amount')::numeric),0) into cost from jsonb_array_elements(coalesce(moves,'[]')) m where m->>'jobId'=j->>'id' and m->>'kind'='Egreso' and m->>'status'='Realizado' and m->>'currency'='ARS' and m->>'voidAt' is null and coalesce((m->>'settlement')::boolean,false)=false and coalesce((m->>'legacyOverlap')::boolean,false)=false;
  if income=0 and cost=0 then continue;end if;
  select value->>'name' into client_name from jsonb_array_elements(coalesce(clients,'[]')) where value->>'id'=j->>'clientId';
  select c.code into code from public.jd_work_codes c where source_key='job:'||(j->>'id');if code is null then continue;end if;
  select min((l->'source'->>'row')::int) into legacy_row from jsonb_array_elements(coalesce(legacy,'[]')) l where l->>'currency'='ARS' and length(coalesce(client_name,''))>4 and position(lower(client_name) in lower(l->>'label'))>0;
  insert into public.jd_sheet_outbox(destination,entity_id,payload,status,error)
   values('budget',j->>'id',jsonb_build_object('jobId',j->>'id','code',code,'label',coalesce(client_name,'')||' · '||(j->>'title'),'date',coalesce(d,left(j->>'created',10),current_date::text),'income',income,'cost',cost,'rate',coalesce((j->>'maaserPct')::numeric/100,0.1),'legacyRow',legacy_row),case when legacy_row is null then 'pending' else 'conflict' end,case when legacy_row is not null then 'Existe un antecedente en la fila '||legacy_row||'. Se conserva sin sobrescribir; conciliar primero.' end)
   on conflict(destination,entity_id) do update set payload=excluded.payload,status=excluded.status,error=excluded.error,updated_at=clock_timestamp() where public.jd_sheet_outbox.payload is distinct from excluded.payload;
 end loop;return new;
end $$;
revoke all on function jd_private.queue_budget_jobs() from public;
-- An invoker trigger needs team access only to the dedicated export queue, never to supplier receipts.
grant select,insert,update on public.jd_sheet_outbox to authenticated;
create policy sheet_outbox_team_read on public.jd_sheet_outbox for select to authenticated using (auth.uid() is not null and exists(select 1 from public.jd_team_access where email=lower(auth.jwt()->>'email')) and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false));
create policy sheet_outbox_team_insert on public.jd_sheet_outbox for insert to authenticated with check (auth.uid() is not null and exists(select 1 from public.jd_team_access where email=lower(auth.jwt()->>'email')) and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false));
create policy sheet_outbox_team_update on public.jd_sheet_outbox for update to authenticated using (auth.uid() is not null and exists(select 1 from public.jd_team_access where email=lower(auth.jwt()->>'email')) and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)) with check (auth.uid() is not null and exists(select 1 from public.jd_team_access where email=lower(auth.jwt()->>'email')) and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false));
create trigger jd_queue_budget after insert or update of value on public.app_state for each row when (new.key in ('jd_jobs_v1','jd_orders_v1','jd_finance_moves_v1')) execute function jd_private.queue_budget_jobs();

create function public.jd_supplier_post(p_entry uuid,p_actor uuid) returns public.jd_supplier_entries language plpgsql security invoker set search_path='' as $$
declare e public.jd_supplier_entries;a jsonb;m jsonb;begin
 select * into e from public.jd_supplier_entries where id=p_entry for update;if not found or e.state='void' then raise exception 'Movimiento no disponible';end if;if e.state='posted' then return e;end if;
 if e.receipt_path is not null and not exists(select 1 from storage.objects where bucket_id='jd-supplier-receipts' and name=e.receipt_path) then raise exception 'Falta cargar el comprobante';end if;
 update public.jd_supplier_entries set state='posted',updated_at=now(),history=history||jsonb_build_array(jsonb_build_object('at',now(),'actor',p_actor,'type','Registro confirmado')) where id=e.id returning * into e;
 m:=jsonb_build_object('id','supplier-'||e.id,'date',e.date,'kind','Egreso','currency','ARS','amount',e.ars,'category',case when e.kind='Cargo' then 'Imprenta' else 'Pago a proveedor' end,'status','Realizado','provider','Zloto','jobId',e.job_id,'detail',e.detail,'notCash',e.kind='Cargo','settlement',e.kind='Pago','supplierEntryId',e.id,'createdAt',now());
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('jd-state:jd_finance_moves_v1',0));select value into a from public.app_state where key='jd_finance_moves_v1' for update;
 insert into public.app_state(key,value,updated_at) values('jd_finance_moves_v1',coalesce(a,'[]')||jsonb_build_array(m),now()) on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
 insert into public.jd_sheet_outbox(destination,entity_id,payload) values('zloto',e.id::text,jsonb_build_object('entryId',e.id,'kind',e.kind,'amount',e.ars,'date',e.date,'client',e.client_label,'detail',e.detail,'method',e.method,'hasReceipt',e.receipt_path is not null,'code',(select code from public.jd_work_codes where source_key='job:'||e.job_id))) on conflict(destination,entity_id) do nothing;
 return e;
end $$;
revoke all on function public.jd_supplier_post(uuid,uuid) from public,anon,authenticated;
grant execute on function public.jd_supplier_post(uuid,uuid) to service_role;
