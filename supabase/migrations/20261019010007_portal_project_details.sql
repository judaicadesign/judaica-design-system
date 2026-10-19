-- Only explicitly shared client-facing fields; internal CRM notes/prices stay private.
alter table public.jd_portal_orders add column project jsonb not null default '{}'::jsonb
 check (jsonb_typeof(project)='object' and octet_length(project::text)<=30000);
create unique index jd_portal_work_source_unique on public.jd_portal_orders ((project->>'source_job_id'))
 where project->>'source_job_id' is not null;
alter table public.jd_portal_files drop constraint jd_portal_files_purpose_check;
alter table public.jd_portal_files add constraint jd_portal_files_purpose_check
 check(purpose in ('Archivo para imprimir','Referencia','Comprobante de pago','Material del cliente','Mockup','Entrega digital'));
