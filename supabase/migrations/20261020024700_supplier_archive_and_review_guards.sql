create or replace function public.jd_review_comment(p_version uuid,p_actor uuid,p_role text,p_page integer,p_x numeric,p_y numeric,p_body text,p_parent uuid) returns public.jd_review_comments language plpgsql security invoker set search_path='' as $$
declare v public.jd_review_versions;o public.jd_portal_orders;c public.jd_review_comments;parent public.jd_review_comments;begin
 select * into v from public.jd_review_versions where id=p_version;
 select * into o from public.jd_portal_orders where id=v.order_id for update;
 if o.status in ('En producción','Listo para entregar','Entregado','Cancelado') or o.current_review_id is distinct from v.id or v.state<>'published' or exists(select 1 from public.jd_review_approvals where version_id=v.id) then raise exception 'La versión cambió o ya está aprobada. Actualizá la muestra';end if;
 if p_role='customer' and not exists(select 1 from public.jd_portal_customers where id=o.customer_id and auth_user_id=p_actor and active) then raise exception 'Acceso no autorizado';end if;
 if p_parent is not null then select * into parent from public.jd_review_comments where id=p_parent and version_id=v.id and parent_id is null;if not found then raise exception 'Comentario no disponible';end if;p_page:=parent.page;p_x:=parent.x;p_y:=parent.y;end if;
 if p_page<1 or p_page>v.page_count then raise exception 'Página inválida';end if;
 insert into public.jd_review_comments(version_id,page,x,y,body,actor_id,actor_role,parent_id) values(v.id,p_page,p_x,p_y,btrim(p_body),p_actor,p_role,p_parent) returning * into c;return c;
end $$;

create or replace function public.jd_review_resolve(p_comment uuid,p_actor uuid,p_role text,p_resolved boolean) returns public.jd_review_comments language plpgsql security invoker set search_path='' as $$
declare c public.jd_review_comments;v public.jd_review_versions;o public.jd_portal_orders;begin
 select * into c from public.jd_review_comments where id=p_comment;
 select * into v from public.jd_review_versions where id=c.version_id;
 select * into o from public.jd_portal_orders where id=v.order_id for update;
 if o.status in ('En producción','Listo para entregar','Entregado','Cancelado') or o.current_review_id is distinct from v.id or c.parent_id is not null or exists(select 1 from public.jd_review_approvals where version_id=v.id) then raise exception 'La muestra ya no admite cambios';end if;
 if p_role<>'team' and c.actor_id<>p_actor then raise exception 'Solo podés resolver tu observación';end if;
 update public.jd_review_comments set resolved_at=case when p_resolved then now() else null end,resolved_by=case when p_resolved then p_actor else null end where id=c.id returning * into c;return c;
end $$;

create or replace function public.jd_supplier_update(p_entry uuid,p_actor uuid,p_expected timestamptz,p_job text,p_flags jsonb,p_void_reason text) returns public.jd_supplier_entries language plpgsql security invoker set search_path='' as $$
declare e public.jd_supplier_entries;a jsonb;i integer;m jsonb;begin
 select * into e from public.jd_supplier_entries where id=p_entry for update;if not found or e.updated_at<>p_expected or e.state<>'posted' then raise exception 'El movimiento cambió. Actualizá la cuenta';end if;
 if p_void_reason is not null and e.source_key is not null then raise exception 'El antecedente importado se conserva; conciliá primero con la planilla';end if;
 if p_job is not null and not exists(select 1 from public.app_state s cross join lateral jsonb_array_elements(s.value) j where s.key='jd_jobs_v1' and j->>'id'=p_job) then raise exception 'Trabajo no disponible';end if;
 update public.jd_supplier_entries set job_id=p_job,source=coalesce(source,'{}')||p_flags,state=case when p_void_reason is null then 'posted' else 'void' end,updated_at=now(),history=history||jsonb_build_array(jsonb_build_object('at',now(),'actor',p_actor,'type',case when p_void_reason is null then 'Vinculación / estado' else 'Anulación' end,'reason',p_void_reason,'previousJob',job_id)) where id=e.id returning * into e;
 if e.source_key is null then
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('jd-state:jd_finance_moves_v1',0));select value into a from public.app_state where key='jd_finance_moves_v1' for update;
  select value,ordinality::int-1 into m,i from jsonb_array_elements(coalesce(a,'[]')) with ordinality where value->>'id'='supplier-'||e.id;
  if m is not null then update public.app_state set value=jsonb_set(value,array[i::text],m||jsonb_build_object('jobId',p_job)||case when p_void_reason is not null then jsonb_build_object('voidAt',now(),'voidReason',p_void_reason) else '{}'::jsonb end),updated_at=now() where key='jd_finance_moves_v1';end if;
 end if;
 insert into public.jd_sheet_outbox(destination,entity_id,payload,status) values('zloto',e.id::text,jsonb_build_object('entryId',e.id,'kind',e.kind,'amount',case when e.state='void' then 0 else e.ars end,'date',e.date,'client',e.client_label,'detail',case when e.state='void' then 'ANULADO · '||e.detail else e.detail end,'method',e.method,'hasReceipt',e.receipt_path is not null,'source',e.source,'code',(select code from public.jd_work_codes where source_key='job:'||e.job_id)),'pending')
 on conflict(destination,entity_id) do update set payload=excluded.payload,status='pending',error=null,updated_at=clock_timestamp();return e;
end $$;

create table public.jd_supplier_archives(id uuid primary key default gen_random_uuid(), supplier text not null default 'Zloto' check(supplier='Zloto'),label text not null,messages jsonb not null default '[]',files jsonb not null default '[]',created_at timestamptz not null default now());
alter table public.jd_supplier_archives enable row level security;
revoke all on public.jd_supplier_archives from public,anon,authenticated;
grant all on public.jd_supplier_archives to service_role;
insert into storage.buckets(id,name,public,file_size_limit) values('jd-supplier-archive','jd-supplier-archive',false,52428800) on conflict(id) do nothing;
