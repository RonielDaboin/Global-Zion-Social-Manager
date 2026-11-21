-- Registro de uso de IA por proveedor (Cloudflare, Gemini, Pollinations) para la pantalla "Créditos IA".
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider text not null check (provider in ('cloudflare', 'gemini', 'pollinations')),
  kind text not null default '',
  status text not null default 'ok' check (status in ('ok', 'limit', 'error')),
  created_at timestamptz not null default now()
);
create index if not exists ai_usage_user_time on public.ai_usage (user_id, created_at desc);
alter table public.ai_usage enable row level security;

drop policy if exists "ai_usage select own" on public.ai_usage;
create policy "ai_usage select own" on public.ai_usage for select to authenticated using (auth.uid() = user_id);
drop policy if exists "ai_usage insert own" on public.ai_usage;
create policy "ai_usage insert own" on public.ai_usage for insert to authenticated with check (auth.uid() = user_id);
