-- Backend-only publication; lock the same quote row used by order submission.
create or replace function public.jd_portal_publish_quote(p_quote uuid,p_expected jsonb,p_result jsonb,p_evidence jsonb,p_rule jsonb,p_expires timestamptz)
returns public.jd_portal_quotes language plpgsql security invoker set search_path='' as $$
declare q public.jd_portal_quotes;
begin
 select * into q from public.jd_portal_quotes where id=p_quote for update;
 if not found then raise exception 'Consulta no disponible'; end if;
 if q.requested_order_id is not null or q.customer_result->>'requiresReview' is distinct from 'true' or p_expected is distinct from q.customer_result then raise exception 'Esta consulta cambió o ya fue respondida. Actualizá la bandeja'; end if;
 if not exists(select 1 from public.jd_portal_customers where id=q.customer_id and active) then raise exception 'Cliente no habilitado'; end if;
 if p_result->>'requiresReview' is distinct from 'false' or jsonb_typeof(p_result->'alternatives') is distinct from 'array' or jsonb_array_length(p_result->'alternatives') not between 1 and 32 or p_expires<=now() then raise exception 'Cotización inválida'; end if;
 if exists(select 1 from jsonb_array_elements(p_result->'alternatives') a where a->>'status' is distinct from 'priced' or (a->>'price')::numeric<=0 or (a->>'qty')::integer<=0) then raise exception 'Precios o cantidades inválidos'; end if;
 update public.jd_portal_quote_costs set evidence=jsonb_build_object('previous',evidence,'previousCustomerResult',q.customer_result,'manual',p_evidence),price_rule=p_rule where quote_id=q.id;
 if not found then raise exception 'Falta el antecedente privado de la cotización'; end if;
 update public.jd_portal_quotes set customer_result=p_result,expires_at=p_expires where id=q.id returning * into q;
 return q;
end $$;
revoke all on function public.jd_portal_publish_quote(uuid,jsonb,jsonb,jsonb,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.jd_portal_publish_quote(uuid,jsonb,jsonb,jsonb,jsonb,timestamptz) to service_role;
