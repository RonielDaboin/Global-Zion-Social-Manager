-- Publicaciones por usuario (reemplaza el guardado en localStorage).
create table if not exists public.posts (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.posts enable row level security;

drop policy if exists "posts select own" on public.posts;
create policy "posts select own" on public.posts for select to authenticated using (auth.uid() = user_id);
drop policy if exists "posts insert own" on public.posts;
create policy "posts insert own" on public.posts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "posts update own" on public.posts;
create policy "posts update own" on public.posts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "posts delete own" on public.posts;
create policy "posts delete own" on public.posts for delete to authenticated using (auth.uid() = user_id);

-- Videos del usuario (bucket privado, una carpeta por usuario).
insert into storage.buckets (id, name, public) values ('post-videos', 'post-videos', false) on conflict (id) do nothing;
drop policy if exists "post-videos select own" on storage.objects;
create policy "post-videos select own" on storage.objects for select to authenticated using (bucket_id = 'post-videos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "post-videos insert own" on storage.objects;
create policy "post-videos insert own" on storage.objects for insert to authenticated with check (bucket_id = 'post-videos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "post-videos update own" on storage.objects;
create policy "post-videos update own" on storage.objects for update to authenticated using (bucket_id = 'post-videos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "post-videos delete own" on storage.objects;
create policy "post-videos delete own" on storage.objects for delete to authenticated using (bucket_id = 'post-videos' and (storage.foldername(name))[1] = auth.uid()::text);
