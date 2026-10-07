-- Optimistic compare-and-swap, atomically across keys. No commercial row migration.
create or replace function public.jd_commit_state(changes jsonb)
returns jsonb
language plpgsql security invoker
set search_path = ''
set lock_timeout = '5s'
as $$
declare
  change jsonb;
  current_value jsonb;
  row_exists boolean;
  result jsonb := '[]'::jsonb;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false)
     or not exists(select 1 from public.jd_team_access where email=lower(auth.jwt()->>'email')) then
    raise exception 'Acceso no autorizado' using errcode='42501';
  end if;
  if jsonb_typeof(changes) is distinct from 'array' or jsonb_array_length(changes)<1 or jsonb_array_length(changes)>20 then
    raise exception 'Lote de cambios inválido' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_array_elements(changes) c where coalesce(c->>'key','') !~ '^jd_[a-z0-9_]+$' or not c ? 'expected' or jsonb_typeof(c->'exists') is distinct from 'boolean')
     or (select count(distinct c->>'key') from jsonb_array_elements(changes) c)<>jsonb_array_length(changes) then
    raise exception 'Claves o versiones inválidas' using errcode='22023';
  end if;
  -- Advisory locks also protect keys that do not exist yet; consistent order avoids deadlocks.
  perform pg_catalog.set_config('jd.atomic_write','on',true);
  for change in select c from jsonb_array_elements(changes) c order by c->>'key' loop
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('jd-state:'||(change->>'key'),0));
    select s.value into current_value from public.app_state s where s.key=change->>'key' for update;
    row_exists:=found;
    if row_exists<>(change->>'exists')::boolean or (row_exists and current_value is distinct from change->'expected') then
      raise exception 'Datos modificados por otro dispositivo. Recargá antes de guardar.' using errcode='40001';
    end if;
    if coalesce((change->>'remove')::boolean,false) then
      delete from public.app_state where key=change->>'key';
      result:=result||jsonb_build_array(jsonb_build_object('key',change->>'key','removed',true));
    else
      if not change ? 'value' then raise exception 'Falta el valor del cambio' using errcode='22023'; end if;
      insert into public.app_state(key,value,updated_at) values(change->>'key',change->'value',clock_timestamp())
        on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
      result:=result||jsonb_build_array(jsonb_build_object('key',change->>'key','value',change->'value'));
    end if;
  end loop;
  return result;
end;
$$;
revoke all on function public.jd_commit_state(jsonb) from public,anon;
grant execute on function public.jd_commit_state(jsonb) to authenticated;
