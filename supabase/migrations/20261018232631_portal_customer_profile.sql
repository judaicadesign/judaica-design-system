alter table public.jd_portal_customers
 add column first_name text not null default '' check(length(first_name)<=70),
 add column last_name text not null default '' check(length(last_name)<=80),
 add column business_name text not null default '' check(length(business_name)<=160),
 add column instagram text not null default '' check(length(instagram)<=160),
 add column locality text not null default '' check(length(locality)<=160);
create function public.jd_portal_register_customer(p_name text,p_email text,p_phone text,p_user uuid,p_profile jsonb)
returns void language plpgsql security invoker set search_path='' as $$
declare c public.jd_portal_customers;
begin
 if p_user is null then raise exception 'Identidad requerida'; end if;
 if p_profile is null or jsonb_typeof(p_profile)<>'object' or coalesce(p_profile->>'first_name','')='' or coalesce(p_profile->>'last_name','')='' or coalesce(p_profile->>'locality','')='' or p_phone='' then raise exception 'Completá nombre, apellido, WhatsApp y localidad'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_email,0));
 if exists(select 1 from public.jd_team_access where email=p_email) then raise exception 'Este correo pertenece al equipo'; end if;
 select * into c from public.jd_portal_customers where email=p_email for update;
 if found then
  if not c.active or c.auth_user_id is distinct from p_user then raise exception 'Este correo ya tiene una ficha. Contactá a Judaica Design'; end if;
  return;
 end if;
 insert into public.jd_portal_customers(name,email,phone,active,auth_user_id,must_change_password,first_name,last_name,business_name,instagram,locality)
 values(p_name,p_email,p_phone,true,p_user,false,p_profile->>'first_name',p_profile->>'last_name',coalesce(p_profile->>'business_name',''),coalesce(p_profile->>'instagram',''),p_profile->>'locality');
end $$;
revoke all on function public.jd_portal_register_customer(text,text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.jd_portal_register_customer(text,text,text,uuid,jsonb) to service_role;
revoke execute on function public.jd_portal_register_customer(text,text,text,uuid) from service_role;
