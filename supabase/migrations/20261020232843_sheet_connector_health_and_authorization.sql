alter table public.jd_sheet_connection add column if not exists last_seen_at timestamptz;
alter table public.jd_sheet_connection add column if not exists last_authorized_at timestamptz;
alter table public.jd_sheet_connection add column if not exists last_success_at timestamptz;
alter table public.jd_sheet_connection add column if not exists connector_version text;
