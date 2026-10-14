-- Prepared only. Approval is required before deployment and paid activation.
create table public.jd_whatsapp_ai_budget (
 id text primary key check (id = 'pilot'),
 enabled boolean not null default false,
 limit_usd numeric(8,4) not null default 1 check (limit_usd > 0 and limit_usd <= 1),
 reserved_usd numeric(8,4) not null default 0 check (reserved_usd >= 0),
 reserve_per_request numeric(8,4) not null default 0.05 check (reserve_per_request = 0.05),
 check (reserved_usd <= limit_usd)
);
insert into public.jd_whatsapp_ai_budget(id) values ('pilot');

create table public.jd_whatsapp_jobs (
 message_id text primary key references public.jd_whatsapp_inbox(message_id),
 state text not null check (state in ('processing','draft','sending','sent','needs_review','delivery_uncertain','budget_exhausted')),
 reserve_usd numeric(8,4) not null default 0,
 draft jsonb,
 provider_message_id text,
 error_code text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.jd_whatsapp_ai_budget enable row level security;
alter table public.jd_whatsapp_jobs enable row level security;
revoke all on public.jd_whatsapp_ai_budget, public.jd_whatsapp_jobs from public, anon, authenticated, service_role;
-- Budget reservations happen exclusively inside the atomic RPC, not REST.
grant select on public.jd_whatsapp_ai_budget to service_role;
grant select, update on public.jd_whatsapp_jobs to service_role;

create function public.jd_claim_whatsapp_job(p_message_id text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 budget public.jd_whatsapp_ai_budget%rowtype;
 inserted_id text;
begin
 -- The same lock serializes budget decisions, including concurrent deliveries.
 select * into budget from public.jd_whatsapp_ai_budget where id = 'pilot' for update;
 if not found or not budget.enabled then return jsonb_build_object('status','disabled'); end if;
 if exists(select 1 from public.jd_whatsapp_jobs where message_id = p_message_id) then
  return jsonb_build_object('status','duplicate');
 end if;
 if not exists(select 1 from public.jd_whatsapp_inbox where message_id = p_message_id and state = 'received' and message_type = 'text') then
  return jsonb_build_object('status','invalid');
 end if;
 if budget.reserved_usd + budget.reserve_per_request > budget.limit_usd then
  insert into public.jd_whatsapp_jobs(message_id,state,error_code)
   values(p_message_id,'budget_exhausted','pilot_limit') on conflict do nothing;
  return jsonb_build_object('status','budget_exhausted');
 end if;
 insert into public.jd_whatsapp_jobs(message_id,state,reserve_usd)
  values(p_message_id,'processing',budget.reserve_per_request)
  on conflict do nothing returning message_id into inserted_id;
 if inserted_id is null then return jsonb_build_object('status','duplicate'); end if;
 update public.jd_whatsapp_ai_budget set reserved_usd = reserved_usd + reserve_per_request where id = 'pilot';
 -- Reservations are never refunded. Unknown API timeouts cannot cause an
 -- unaccounted second paid request; retries need manual review and a new ID.
 return jsonb_build_object('status','claimed');
end;
$$;
revoke all on function public.jd_claim_whatsapp_job(text) from public, anon, authenticated;
grant execute on function public.jd_claim_whatsapp_job(text) to service_role;
