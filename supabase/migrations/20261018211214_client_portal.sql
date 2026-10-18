-- Dedicated portal records. No client receives direct Data API access, costs,
-- pricing configuration, or access to the internal app_state tables.
create table public.jd_portal_customers (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(name) between 1 and 160),
 email text unique check (email = lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 active boolean not null default false,
 pricing_mode text not null default 'abi' check (pricing_mode in ('abi','custom')),
 price_rule jsonb,
 must_change_password boolean not null default false,
 auth_user_id uuid references auth.users(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check (not active or email is not null)
);
create table public.jd_portal_quotes (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.jd_portal_customers(id),
 request jsonb not null,
 customer_result jsonb not null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 requested_order_id uuid
);
create index jd_portal_quotes_customer_date on public.jd_portal_quotes(customer_id,created_at desc);
create table public.jd_portal_quote_costs (
 quote_id uuid primary key references public.jd_portal_quotes(id) on delete cascade,
 evidence jsonb not null,
 price_rule jsonb not null,
 created_at timestamptz not null default now()
);
create table public.jd_portal_orders (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.jd_portal_customers(id),
 idempotency_key uuid not null,
 items jsonb not null,
 total numeric(16,2),
 currency text not null default 'ARS' check (currency='ARS'),
 status text not null default 'Solicitado' check (status in ('Solicitado','En revisión','Requiere corrección','Esperando pago','Confirmado','En producción','Listo para entregar','Entregado','Cancelado')),
 due_date date,
 notes text not null default '' check(length(notes)<=5000),
 customer_message text not null default '' check(length(customer_message)<=5000),
 history jsonb not null default '[]',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(customer_id,idempotency_key)
);
create index jd_portal_orders_customer_date on public.jd_portal_orders(customer_id,created_at desc);
alter table public.jd_portal_quotes add constraint jd_portal_requested_order foreign key(requested_order_id) references public.jd_portal_orders(id);
create table public.jd_portal_files (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.jd_portal_customers(id),
 order_id uuid not null references public.jd_portal_orders(id),
 path text not null unique,
 name text not null check(length(name) between 1 and 200),
 content_type text not null check(content_type in ('application/pdf','image/png','image/jpeg')),
 size_bytes bigint not null check(size_bytes between 1 and 26214400),
 purpose text not null check(purpose in ('Archivo para imprimir','Referencia','Comprobante de pago')),
 status text not null default 'pending' check(status in ('pending','uploaded')),
 created_at timestamptz not null default now()
);
create index jd_portal_files_order_date on public.jd_portal_files(order_id,created_at);
do $$ declare t text; begin
 foreach t in array array['jd_portal_customers','jd_portal_quotes','jd_portal_quote_costs','jd_portal_orders','jd_portal_files'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public, anon, authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  execute format('create policy portal_backend_only on public.%I for all to service_role using (true) with check (true)',t);
 end loop;
end $$;
-- This RPC is deliberately service-only and SECURITY INVOKER. The Edge Function
-- verifies the identity/customer before calling it. Prices come from saved quotes.
create function public.jd_portal_submit_order(p_customer_id uuid,p_items jsonb,p_notes text,p_due date,p_key uuid)
returns public.jd_portal_orders language plpgsql security invoker set search_path='' as $$
declare q public.jd_portal_quotes; o public.jd_portal_orders; entry jsonb; a jsonb; chosen jsonb='[]'; all_priced boolean=true; amount numeric=0; idx int; oid uuid=gen_random_uuid();
begin
 if not exists(select 1 from public.jd_portal_customers where id=p_customer_id and active) then raise exception 'Cliente no habilitado'; end if;
 -- Serialize submissions for this customer, including duplicate clicks/retries.
 perform 1 from public.jd_portal_customers where id=p_customer_id for update;
 select * into o from public.jd_portal_orders where customer_id=p_customer_id and idempotency_key=p_key;
 if found then return o; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 20 then raise exception 'Selección inválida'; end if;
 if length(coalesce(p_notes,''))>5000 then raise exception 'Notas demasiado extensas'; end if;
 if p_due is not null and p_due < (now() at time zone 'America/Argentina/Buenos_Aires')::date then raise exception 'Revisá la fecha solicitada'; end if;
 if (select count(distinct value->>'quoteId') from jsonb_array_elements(p_items))<>jsonb_array_length(p_items) then raise exception 'Elegí una cantidad por producto'; end if;
 for entry in select value from jsonb_array_elements(p_items) order by value->>'quoteId' loop
  select * into q from public.jd_portal_quotes where id=(entry->>'quoteId')::uuid and customer_id=p_customer_id for update;
  if not found then raise exception 'Cotización no disponible'; end if;
  if q.requested_order_id is not null then raise exception 'Esta cotización ya tiene un pedido'; end if;
  if q.expires_at<=now() then raise exception 'La cotización venció; volvé a consultar'; end if;
  if coalesce(entry->>'index','') !~ '^[0-9]{1,2}$' then raise exception 'Alternativa inválida'; end if;
  idx=(entry->>'index')::int;a=q.customer_result->'alternatives'->idx;
  if a is null or idx<0 then raise exception 'Alternativa inválida'; end if;
  if a->>'status'='priced' and (a->>'price')::numeric>0 then amount=amount+(a->>'price')::numeric; else all_priced=false; end if;
  chosen=chosen||jsonb_build_array(jsonb_build_object('quoteId',q.id,'index',idx,'description',q.customer_result->>'description','specification',q.customer_result->>'specification','qty',a->'qty','binding',a->>'binding','price',a->'price','currency','ARS'));
 end loop;
 insert into public.jd_portal_orders(id,customer_id,idempotency_key,items,total,due_date,notes,history)
 values(oid,p_customer_id,p_key,chosen,case when all_priced then amount else null end,p_due,coalesce(p_notes,''),jsonb_build_array(jsonb_build_object('at',now(),'type','Solicitud','text','Pedido solicitado desde el portal; pendiente de revisión de archivos y pago.'))) returning * into o;
 update public.jd_portal_quotes set requested_order_id=oid where customer_id=p_customer_id and id in(select (value->>'quoteId')::uuid from jsonb_array_elements(p_items));
 return o;
end $$;
revoke all on function public.jd_portal_submit_order(uuid,jsonb,text,date,uuid) from public,anon,authenticated;
grant execute on function public.jd_portal_submit_order(uuid,jsonb,text,date,uuid) to service_role;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('jd-portal-files','jd-portal-files',false,26214400,array['application/pdf','image/png','image/jpeg']);
-- No storage policy grants clients direct access. Only scoped, short-lived links
-- issued by the authenticated backend can upload/download the customer's files.
insert into public.jd_portal_customers(name,pricing_mode,active)
select 'Abi','abi',false where not exists(select 1 from public.jd_portal_customers where lower(name)='abi');

create function public.jd_portal_save_quote(p_quote jsonb,p_evidence jsonb,p_rule jsonb)
returns public.jd_portal_quotes language plpgsql security invoker set search_path='' as $$
declare q public.jd_portal_quotes;
begin
 insert into public.jd_portal_quotes(id,customer_id,request,customer_result,created_at,expires_at)
 values((p_quote->>'id')::uuid,(p_quote->>'customer_id')::uuid,p_quote->'request',p_quote->'customer_result',(p_quote->>'created_at')::timestamptz,(p_quote->>'expires_at')::timestamptz) returning * into q;
 insert into public.jd_portal_quote_costs(quote_id,evidence,price_rule) values(q.id,p_evidence,p_rule);
 return q;
end $$;
revoke all on function public.jd_portal_save_quote(jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.jd_portal_save_quote(jsonb,jsonb,jsonb) to service_role;
