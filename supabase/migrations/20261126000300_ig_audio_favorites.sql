-- Música de Instagram guardada como favorita. Es del espacio compartido: la ven y la editan los miembros.
create table if not exists public.ig_audio_favorites (
  user_id uuid not null default public.workspace_id() references auth.users (id) on delete cascade,
  audio_id text not null,
  track jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, audio_id)
);
alter table public.ig_audio_favorites enable row level security;

drop policy if exists "ig_audio_favorites select" on public.ig_audio_favorites;
create policy "ig_audio_favorites select" on public.ig_audio_favorites for select to authenticated using (user_id = public.workspace_id());
drop policy if exists "ig_audio_favorites insert" on public.ig_audio_favorites;
create policy "ig_audio_favorites insert" on public.ig_audio_favorites for insert to authenticated with check (user_id = public.workspace_id());
drop policy if exists "ig_audio_favorites update" on public.ig_audio_favorites;
create policy "ig_audio_favorites update" on public.ig_audio_favorites for update to authenticated using (user_id = public.workspace_id()) with check (user_id = public.workspace_id());
drop policy if exists "ig_audio_favorites delete" on public.ig_audio_favorites;
create policy "ig_audio_favorites delete" on public.ig_audio_favorites for delete to authenticated using (user_id = public.workspace_id());

revoke all on public.ig_audio_favorites from anon;
grant select, insert, update, delete on public.ig_audio_favorites to authenticated;
