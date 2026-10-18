alter table public.jd_portal_customers add column phone text not null default '' check(length(phone)<=80);
create unique index jd_portal_customer_identity on public.jd_portal_customers(auth_user_id) where auth_user_id is not null;
create table public.jd_portal_signup_limits (
 rate_key text not null,
 bucket timestamptz not null,
 attempts integer not null default 1,
 primary key(rate_key,bucket)
);
alter table public.jd_portal_signup_limits enable row level security;
revoke all on public.jd_portal_signup_limits from public,anon,authenticated;
grant all on public.jd_portal_signup_limits to service_role;
create policy portal_backend_only on public.jd_portal_signup_limits for all to service_role using(true) with check(true);
create function public.jd_portal_signup_rate(p_rate text)
returns void language plpgsql security invoker set search_path='' as $$
declare hits integer;
begin
 insert into public.jd_portal_signup_limits(rate_key,bucket) values(p_rate,date_trunc('hour',now()))
 on conflict(rate_key,bucket) do update set attempts=public.jd_portal_signup_limits.attempts+1 returning attempts into hits;
 if hits>10 then raise exception 'Se alcanzó el límite de registros. Esperá un rato y reintentá'; end if;
end $$;
create function public.jd_portal_register_customer(p_name text,p_email text,p_phone text,p_user uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare c public.jd_portal_customers;
begin
 if p_user is null then raise exception 'Identidad requerida'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_email,0));
 if exists(select 1 from public.jd_team_access where email=p_email) then raise exception 'Este correo pertenece al equipo'; end if;
 select * into c from public.jd_portal_customers where email=p_email for update;
 if found then
  if not c.active or c.auth_user_id is distinct from p_user then raise exception 'Este correo ya tiene una ficha. Contactá a Judaica Design'; end if;
  return;
 end if;
 insert into public.jd_portal_customers(name,email,phone,active,auth_user_id,must_change_password)
 values(p_name,p_email,p_phone,true,p_user,false);
end $$;
revoke all on function public.jd_portal_signup_rate(text) from public,anon,authenticated;
revoke all on function public.jd_portal_register_customer(text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.jd_portal_signup_rate(text) to service_role;
grant execute on function public.jd_portal_register_customer(text,text,text,uuid) to service_role;
-- Retain prior application records as private history, but retire link issuance
-- and consumption. Registration no longer uses an approval/activation workflow.
revoke execute on function public.jd_portal_request_account(text,text,text,text) from service_role;
revoke execute on function public.jd_portal_claim_activation(text,uuid) from service_role;
revoke execute on function public.jd_portal_finish_activation(uuid,uuid,uuid) from service_role;
revoke execute on function public.jd_portal_release_activation(uuid,uuid) from service_role;
