create function public.jd_supplier_attach_receipt(p_entry uuid,p_expected timestamptz,p_actor uuid,p_receipt jsonb,p_evidence jsonb) returns public.jd_supplier_entries language plpgsql security invoker set search_path='' as $$
declare e public.jd_supplier_entries;begin
 select * into e from public.jd_supplier_entries where id=p_entry for update;
 if not found or e.state<>'posted' or e.kind<>'Pago' or e.receipt_path is not null or e.updated_at<>p_expected then raise exception 'El pago cambió o ya tiene comprobante. Actualizá la cuenta';end if;
 if not exists(select 1 from storage.objects where bucket_id='jd-supplier-receipts' and name=p_receipt->>'path') then raise exception 'Falta cargar el comprobante';end if;
 update public.jd_supplier_entries set receipt_path=p_receipt->>'path',receipt_name=p_receipt->>'name',receipt_mime=p_receipt->>'mime',receipt_size=(p_receipt->>'size')::int,source=source||jsonb_build_object('chatEvidence',p_evidence),updated_at=now(),history=history||jsonb_build_array(jsonb_build_object('at',now(),'actor',p_actor,'type','Comprobante vinculado','evidence',p_evidence)) where id=e.id returning * into e;
 insert into public.jd_sheet_outbox(destination,entity_id,payload,status) values('zloto',e.id::text,jsonb_build_object('entryId',e.id,'kind',e.kind,'amount',e.ars,'date',e.date,'client',e.client_label,'detail',e.detail,'method',e.method,'hasReceipt',true,'source',e.source,'code',(select code from public.jd_work_codes where source_key='job:'||e.job_id)),'pending') on conflict(destination,entity_id) do update set payload=excluded.payload,status='pending',error=null,updated_at=clock_timestamp();return e;
end $$;
revoke all on function public.jd_supplier_attach_receipt(uuid,timestamptz,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.jd_supplier_attach_receipt(uuid,timestamptz,uuid,jsonb,jsonb) to service_role;
