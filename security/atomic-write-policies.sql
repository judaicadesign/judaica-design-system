-- Apply AFTER the RPC-enabled frontend is deployed. Existing tabs must refresh.
-- The transaction-local flag is set only by the reviewed public commit RPC.
-- Keep the same team/anonymous predicates; read access is unchanged.
do $$
declare p record;
begin
  for p in select * from pg_policies where schemaname='public' and tablename='app_state' and policyname in ('jd_team_insert','jd_team_update','jd_team_delete') loop
    if p.cmd='INSERT' then
      execute format('alter policy %I on public.app_state with check ((%s) and current_setting(''jd.atomic_write'',true)=''on'')',p.policyname,p.with_check);
    elsif p.cmd='UPDATE' then
      execute format('alter policy %I on public.app_state using ((%s) and current_setting(''jd.atomic_write'',true)=''on'') with check ((%s) and current_setting(''jd.atomic_write'',true)=''on'')',p.policyname,p.qual,p.with_check);
    elsif p.cmd='DELETE' then
      execute format('alter policy %I on public.app_state using ((%s) and current_setting(''jd.atomic_write'',true)=''on'')',p.policyname,p.qual);
    end if;
  end loop;
end;
$$;
