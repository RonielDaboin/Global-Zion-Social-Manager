-- Alertas push de publicación: dispositivos suscritos y claves del servidor.
-- Solo la función `push` (service_role) lee y escribe: RLS activado y sin políticas para el navegador.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  workspace uuid not null references auth.users (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  subscription jsonb not null,
  lang text not null default 'es',
  updated_at timestamptz not null default now()
);

-- Claves VAPID: las genera la función la primera vez; no se copian a mano ni se guardan en el repositorio.
create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  public_key text not null,
  private_key text not null
);

alter table public.push_subscriptions enable row level security;
alter table public.push_config enable row level security;
revoke all on public.push_subscriptions, public.push_config from anon, authenticated;
grant select, insert, update, delete on public.push_subscriptions, public.push_config to service_role;
