-- JD® Biblioteca Institucional — lectura privada
-- 20/10/2026. Migración aditiva: no modifica app_state, pedidos ni másters.
-- Fuente editorial: Google Drive privado. Esta tabla es sólo un espejo de lectura.
-- Las escrituras se harán mediante el futuro servicio de sincronización autenticado.

create table if not exists public.jd_library_permissions (
  email text primary key,
  access_level text not null default 'equipo'
    check (access_level in ('equipo','direccion','titular')),
  granted_at timestamptz not null default now(),
  constraint jd_library_permissions_email_normalized
    check (email = lower(btrim(email)))
);

-- El único integrante actual del equipo es el titular. La futura ampliación
-- del equipo NO da acceso implícito a documentación sensible.
insert into public.jd_library_permissions(email, access_level)
select lower(btrim(email)), 'titular'
from public.jd_team_access
on conflict (email) do nothing;

alter table public.jd_library_permissions enable row level security;
revoke all on public.jd_library_permissions from anon, authenticated;
grant select on public.jd_library_permissions to authenticated;

drop policy if exists jd_library_permissions_self_read on public.jd_library_permissions;
create policy jd_library_permissions_self_read
on public.jd_library_permissions for select to authenticated
using (
  email = lower((select auth.jwt())->>'email')
  and coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) = false
);

create table if not exists public.jd_library_documents (
  drive_file_id text primary key,
  title text not null check (char_length(title) between 1 and 260),
  module_code text not null default '' check (char_length(module_code) <= 20),
  category text not null default 'General' check (char_length(category) <= 100),
  document_kind text not null default 'gdoc'
    check (document_kind in ('gdoc','slides','sheet','pdf','other')),
  editorial_status text not null default 'borrador'
    check (editorial_status in ('vigente','borrador','historico','informe')),
  access_level text not null default 'titular'
    check (access_level in ('equipo','direccion','titular')),
  version text not null default '' check (char_length(version) <= 80),
  drive_url text not null,
  drive_revision text not null default '',
  drive_modified_at timestamptz,
  synced_at timestamptz not null default now(),
  content_text text not null default '',
  sections jsonb not null default '[]'::jsonb check (jsonb_typeof(sections) = 'array'),
  search_vector tsvector generated always as (
    to_tsvector('spanish'::regconfig,
      coalesce(title,'') || ' ' || coalesce(category,'') || ' ' || coalesce(content_text,''))
  ) stored,
  constraint jd_library_drive_id_safe check (drive_file_id ~ '^[A-Za-z0-9_-]{10,160}$'),
  constraint jd_library_content_size check (octet_length(content_text) <= 6000000)
);

create index if not exists jd_library_documents_search_idx
  on public.jd_library_documents using gin(search_vector);
create index if not exists jd_library_documents_category_idx
  on public.jd_library_documents(category, module_code);

alter table public.jd_library_documents enable row level security;
revoke all on public.jd_library_documents from anon, authenticated;
grant select on public.jd_library_documents to authenticated;

drop policy if exists jd_library_documents_authorized_read on public.jd_library_documents;
create policy jd_library_documents_authorized_read
on public.jd_library_documents for select to authenticated
using (
  coalesce(((select auth.jwt())->>'is_anonymous')::boolean, false) = false
  and exists (
    select 1 from public.jd_library_permissions p
    where p.email = lower((select auth.jwt())->>'email')
      and (
        p.access_level = 'titular'
        or (p.access_level = 'direccion' and jd_library_documents.access_level in ('equipo','direccion'))
        or (p.access_level = 'equipo' and jd_library_documents.access_level = 'equipo')
      )
  )
);

-- SECURITY INVOKER: RLS se aplica sobre jd_library_documents.
create or replace function public.jd_library_search(
  search_text text, result_limit integer default 25
)
returns table (
  drive_file_id text, title text, module_code text,
  category text, editorial_status text, access_level text,
  version text, drive_url text, synced_at timestamptz,
  excerpt text
)
language sql stable security invoker set search_path = public
as $$
  select d.drive_file_id, d.title, d.module_code, d.category,
         d.editorial_status, d.access_level, d.version,
         d.drive_url, d.synced_at,
         left(d.content_text, 240) as excerpt
  from public.jd_library_documents d
  where char_length(btrim(coalesce(search_text,''))) between 2 and 120
    and (
      d.search_vector @@ plainto_tsquery('spanish'::regconfig, search_text)
      or d.title ilike '%' || search_text || '%'
      or d.content_text ilike '%' || search_text || '%'
    )
  order by
    case when d.title ilike '%' || search_text || '%' then 0 else 1 end,
    d.module_code, d.title
  limit least(greatest(coalesce(result_limit,25),1),50)
$$;
revoke all on function public.jd_library_search(text,integer) from public, anon;
grant execute on function public.jd_library_search(text,integer) to authenticated;

comment on table public.jd_library_documents is
'Espejo privado de solo lectura del conocimiento institucional JD; Drive es el master.';
comment on table public.jd_library_permissions is
'Permisos exclusivos de la Biblioteca JD; agregar integrantes al equipo no otorga acceso automático.';
