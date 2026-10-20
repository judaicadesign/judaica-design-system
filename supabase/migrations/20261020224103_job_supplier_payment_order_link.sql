create or replace function public.jd_supplier_post(p_entry uuid,p_actor uuid) returns public.jd_supplier_entries language plpgsql security invoker set search_path='' as $$
declare e public.jd_supplier_entries;a jsonb;m jsonb;begin
 select * into e from public.jd_supplier_entries where id=p_entry for update;if not found or e.state='void' then raise exception 'Movimiento no disponible';end if;if e.state='posted' then return e;end if;
 if e.receipt_path is not null and not exists(select 1 from storage.objects where bucket_id='jd-supplier-receipts' and name=e.receipt_path) then raise exception 'Falta cargar el comprobante';end if;
 update public.jd_supplier_entries set state='posted',updated_at=now(),history=history||jsonb_build_array(jsonb_build_object('at',now(),'actor',p_actor,'type','Registro confirmado')) where id=e.id returning * into e;
 m:=jsonb_build_object('id','supplier-'||e.id,'date',e.date,'kind','Egreso','currency','ARS','amount',e.ars,'category',case when e.kind='Cargo' then 'Imprenta' else 'Pago a proveedor' end,'status','Realizado','provider','Zloto','jobId',e.job_id,'detail',e.detail,'notCash',e.kind='Cargo','settlement',e.kind='Pago','supplierEntryId',e.id,'supplierOrderId',e.source->>'jobSupplierOrderId','method',e.method,'createdAt',now());
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('jd-state:jd_finance_moves_v1',0));select value into a from public.app_state where key='jd_finance_moves_v1' for update;
 insert into public.app_state(key,value,updated_at) values('jd_finance_moves_v1',coalesce(a,'[]')||jsonb_build_array(m),now()) on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at;
 insert into public.jd_sheet_outbox(destination,entity_id,payload) values('zloto',e.id::text,jsonb_build_object('entryId',e.id,'kind',e.kind,'amount',e.ars,'date',e.date,'client',e.client_label,'detail',e.detail,'method',e.method,'hasReceipt',e.receipt_path is not null,'code',(select code from public.jd_work_codes where source_key='job:'||e.job_id))) on conflict(destination,entity_id) do nothing;
 return e;
end $$;
revoke all on function public.jd_supplier_post(uuid,uuid) from public,anon,authenticated;
grant execute on function public.jd_supplier_post(uuid,uuid) to service_role;
