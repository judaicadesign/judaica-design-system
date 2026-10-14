-- Review before applying to the existing project. No changes to app_state or its policies.
begin;
create table public.jd_whatsapp_inbox (
  message_id text primary key,
  waba_id text not null,
  phone_number_id text not null,
  sender_wa_id text not null,
  message_timestamp bigint not null check (message_timestamp > 0),
  message_type text not null,
  body_text text,
  state text not null default 'received' check (state in ('received','needs_review')),
  received_at timestamptz not null default now()
);
alter table public.jd_whatsapp_inbox enable row level security;
revoke all on public.jd_whatsapp_inbox from public, anon, authenticated;
grant select, insert on public.jd_whatsapp_inbox to service_role;
comment on table public.jd_whatsapp_inbox is 'Signed WhatsApp inbound events. No outbound sending; no automatic client approval.';
commit;
