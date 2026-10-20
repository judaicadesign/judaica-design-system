-- Stable references independent of supplier order numbers. Never regenerate on edits/trash.
create table public.jd_work_codes (
 source_key text primary key check (source_key ~ '^(job:|order:).+'),
 number bigint generated always as identity unique,
 code text generated always as ('JD-' || case when number<1000000 then lpad(number::text,6,'0') else number::text end) stored unique,
 created_at timestamptz not null default now()
);
alter table public.jd_work_codes enable row level security;
revoke all on public.jd_work_codes from anon,authenticated;
grant select,insert on public.jd_work_codes to authenticated;
grant all on public.jd_work_codes to service_role;
grant usage on sequence public.jd_work_codes_number_seq to authenticated,service_role;
create policy work_codes_team_read on public.jd_work_codes for select to authenticated using (
 auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 and exists(select 1 from public.jd_team_access where email=lower(auth.jwt()->>'email'))
);
create policy work_codes_team_allocate on public.jd_work_codes for insert to authenticated with check (
 auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
 and exists(select 1 from public.jd_team_access where email=lower(auth.jwt()->>'email'))
);
create schema if not exists jd_private;
revoke all on schema jd_private from public;
create function jd_private.assign_internal_work_codes() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.key='jd_jobs_v1' and jsonb_typeof(new.value)='array' then
  insert into public.jd_work_codes(source_key)
  select distinct 'job:'||(j->>'id') from jsonb_array_elements(new.value) j
  where coalesce(j->>'id','')<>'' and not exists(select 1 from public.jd_work_codes c where c.source_key='job:'||(j->>'id'))
  on conflict(source_key) do nothing;
 end if;
 return new;
end $$;
revoke all on function jd_private.assign_internal_work_codes() from public;
create trigger jd_internal_work_codes after insert or update of value on public.app_state
for each row when (new.key='jd_jobs_v1') execute function jd_private.assign_internal_work_codes();
-- Backfill saved jobs in their existing order. Do not mutate their JSON or CAS versions.
insert into public.jd_work_codes(source_key)
select 'job:'||(j->>'id') from public.app_state a
cross join lateral jsonb_array_elements(a.value) with ordinality e(j,ordinal)
where a.key='jd_jobs_v1' and coalesce(j->>'id','')<>'' order by ordinal
on conflict(source_key) do nothing;

alter table public.jd_portal_orders add column work_code text unique;
create function jd_private.assign_portal_work_code() returns trigger
language plpgsql security invoker set search_path='' as $$
declare source text;
begin
 if tg_op='UPDATE' and old.work_code is not null then
  if new.work_code is distinct from old.work_code or new.project->>'source_job_id' is distinct from old.project->>'source_job_id' then
   raise exception 'El código y la vinculación del trabajo son permanentes' using errcode='22023';
  end if;
  return new;
 end if;
 source:=case when coalesce(new.project->>'source_job_id','')<>'' then 'job:'||(new.project->>'source_job_id') else 'order:'||new.id::text end;
 if not exists(select 1 from public.jd_work_codes where source_key=source) then
  insert into public.jd_work_codes(source_key) values(source) on conflict(source_key) do nothing;
 end if;
 select code into strict new.work_code from public.jd_work_codes where source_key=source;
 return new;
end $$;
revoke all on function jd_private.assign_portal_work_code() from public;
create trigger jd_portal_work_code before insert or update on public.jd_portal_orders
for each row execute function jd_private.assign_portal_work_code();
update public.jd_portal_orders set work_code=work_code where work_code is null;
alter table public.jd_portal_orders alter column work_code set not null;
