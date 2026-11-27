-- Resultado de cada envío a una red. Si el navegador pierde la conexión mientras el servidor publica
-- (pantalla bloqueada, cambio de app o de red), la app consulta aquí qué pasó y no lo da por fallido.
-- Solo la función `social` (service_role) lee y escribe.
create table if not exists public.publish_jobs (
  workspace uuid not null references auth.users (id) on delete cascade,
  post_id text not null,
  platform text not null,
  format text not null,
  state text not null check (state in ('running', 'done', 'error')),
  result jsonb,
  error text,
  updated_at timestamptz not null default now(),
  primary key (workspace, post_id, platform, format)
);
alter table public.publish_jobs enable row level security;
revoke all on public.publish_jobs from anon, authenticated;
grant select, insert, update, delete on public.publish_jobs to service_role;
