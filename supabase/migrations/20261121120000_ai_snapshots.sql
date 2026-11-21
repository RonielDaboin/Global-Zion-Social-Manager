-- Última lectura de las cuotas de cada proveedor de IA (p. ej. copiada de la página "Límite de frecuencia" de AI Studio).
-- Google no ofrece una API gratuita para esto, así que se sincroniza a pedido y la app solo la muestra.
create table if not exists public.ai_snapshots (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null check (provider in ('cloudflare', 'gemini', 'pollinations')),
  data jsonb not null default '{}'::jsonb,
  taken_at timestamptz not null default now(),
  primary key (user_id, provider)
);
alter table public.ai_snapshots enable row level security;

drop policy if exists "ai_snapshots select own" on public.ai_snapshots;
create policy "ai_snapshots select own" on public.ai_snapshots for select to authenticated using (auth.uid() = user_id);
drop policy if exists "ai_snapshots upsert own" on public.ai_snapshots;
create policy "ai_snapshots upsert own" on public.ai_snapshots for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "ai_snapshots update own" on public.ai_snapshots;
create policy "ai_snapshots update own" on public.ai_snapshots for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
