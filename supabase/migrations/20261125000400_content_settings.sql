-- Ajustes del espacio compartido. Por ahora: encender o apagar el borrado automático del contenido publicado.
-- Sin fila = encendido. `autodelete_since` es cuándo se volvió a encender: los 30 días cuentan como mínimo desde ahí,
-- para que al reactivarlo no se borre de golpe lo que se publicó mientras estaba apagado.
create table if not exists public.workspace_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  content_autodelete boolean not null default true,
  autodelete_since timestamptz
);
alter table public.workspace_settings enable row level security;

drop policy if exists "workspace_settings select" on public.workspace_settings;
create policy "workspace_settings select" on public.workspace_settings for select to authenticated using (user_id = public.workspace_id());
drop policy if exists "workspace_settings insert" on public.workspace_settings;
create policy "workspace_settings insert" on public.workspace_settings for insert to authenticated with check (user_id = public.workspace_id());
drop policy if exists "workspace_settings update" on public.workspace_settings;
create policy "workspace_settings update" on public.workspace_settings for update to authenticated using (user_id = public.workspace_id()) with check (user_id = public.workspace_id());

grant select, insert, update on public.workspace_settings to authenticated;
grant select on public.workspace_settings to service_role;
