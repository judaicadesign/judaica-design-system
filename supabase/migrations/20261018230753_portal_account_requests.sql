-- All future portal quotes use the one shared commercial rule. Old quote/order
-- snapshots are immutable and retain the price that was actually quoted.
alter table public.jd_portal_customers add constraint jd_portal_shared_pricing_only check(pricing_mode='abi' and price_rule is null);
create table public.jd_portal_account_requests (
 id uuid primary key default gen_random_uuid(),
 name text not null check(length(name) between 1 and 160),
 email text not null unique check(email=lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 phone text not null default '' check(length(phone)<=80),
 status text not null default 'pending' check(status in ('pending','approved','processing','activated','rejected')),
 token_hash text unique check(token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz,
 attempt_id uuid,
 rate_key text not null,
 consent_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index jd_portal_request_rate on public.jd_portal_account_requests(rate_key,created_at);
alter table public.jd_portal_account_requests enable row level security;
revoke all on public.jd_portal_account_requests from public,anon,authenticated;
grant all on public.jd_portal_account_requests to service_role;
create policy portal_backend_only on public.jd_portal_account_requests for all to service_role using(true) with check(true);

create function public.jd_portal_request_account(p_name text,p_email text,p_phone text,p_rate text)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_rate,0));
 if (select count(*) from public.jd_portal_account_requests where rate_key=p_rate and created_at>now()-interval '1 hour')>=5 then raise exception 'Por favor esperá antes de enviar otra solicitud'; end if;
 -- Same generic public response for new requests, duplicates and existing accounts.
 if exists(select 1 from public.jd_portal_customers where email=p_email) or exists(select 1 from public.jd_team_access where email=p_email) then return; end if;
 insert into public.jd_portal_account_requests(name,email,phone,rate_key) values(p_name,p_email,p_phone,p_rate) on conflict(email) do nothing;
end $$;

create function public.jd_portal_claim_activation(p_hash text,p_attempt uuid)
returns public.jd_portal_account_requests language plpgsql security invoker set search_path='' as $$
declare r public.jd_portal_account_requests;
begin
 select * into r from public.jd_portal_account_requests where token_hash=p_hash for update;
 if not found or r.expires_at<=now() or r.expires_at is null or not(r.status='approved' or r.status='processing' and r.updated_at<now()-interval '5 minutes') then raise exception 'El enlace de activación no es válido, venció o está en uso. Reintentá o solicitá uno nuevo'; end if;
 update public.jd_portal_account_requests set status='processing',attempt_id=p_attempt,updated_at=now() where id=r.id returning * into r;
 return r;
end $$;

create function public.jd_portal_finish_activation(p_request uuid,p_attempt uuid,p_user uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare r public.jd_portal_account_requests;
begin
 select * into r from public.jd_portal_account_requests where id=p_request and attempt_id=p_attempt and status='processing' for update;
 if not found or r.expires_at<=now() then raise exception 'La activación cambió o venció. Pedí un nuevo enlace'; end if;
 if exists(select 1 from public.jd_team_access where email=r.email) then raise exception 'Este correo corresponde al equipo'; end if;
 -- The service-only Edge Function verifies the identity through Auth. Do not
 -- grant service_role raw SELECT access to auth.users for this workflow.
 insert into public.jd_portal_customers(name,email,active,auth_user_id,must_change_password)
 values(r.name,r.email,true,p_user,false)
 on conflict(email) do update set active=true,auth_user_id=p_user,must_change_password=false,updated_at=now();
 update public.jd_portal_account_requests set status='activated',token_hash=null,attempt_id=null,updated_at=now() where id=r.id;
end $$;

create function public.jd_portal_release_activation(p_request uuid,p_attempt uuid)
returns void language sql security invoker set search_path='' as $$
 update public.jd_portal_account_requests set status='approved',attempt_id=null,updated_at=now()
 where id=p_request and attempt_id=p_attempt and status='processing';
$$;
revoke all on function public.jd_portal_request_account(text,text,text,text) from public,anon,authenticated;
revoke all on function public.jd_portal_claim_activation(text,uuid) from public,anon,authenticated;
revoke all on function public.jd_portal_finish_activation(uuid,uuid,uuid) from public,anon,authenticated;
revoke all on function public.jd_portal_release_activation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.jd_portal_request_account(text,text,text,text) to service_role;
grant execute on function public.jd_portal_claim_activation(text,uuid) to service_role;
grant execute on function public.jd_portal_finish_activation(uuid,uuid,uuid) to service_role;
grant execute on function public.jd_portal_release_activation(uuid,uuid) to service_role;
