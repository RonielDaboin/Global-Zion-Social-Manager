-- Biblioteca de contenido: cada archivo se conserva hasta publicarse y desde ahí tiene 30 días de vigencia.
create table if not exists public.content_items (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  mime text not null,
  size bigint not null,
  path text not null,
  thumb text,
  created_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists content_items_user_time on public.content_items (user_id, created_at desc);
create index if not exists content_items_published on public.content_items (published_at) where published_at is not null;
alter table public.content_items enable row level security;

drop policy if exists "content_items select own" on public.content_items;
create policy "content_items select own" on public.content_items for select to authenticated using (auth.uid() = user_id);
drop policy if exists "content_items insert own" on public.content_items;
create policy "content_items insert own" on public.content_items for insert to authenticated
  with check (auth.uid() = user_id and path like auth.uid()::text || '/%');
drop policy if exists "content_items update own" on public.content_items;
create policy "content_items update own" on public.content_items for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id and path like auth.uid()::text || '/%');
drop policy if exists "content_items delete own" on public.content_items;
create policy "content_items delete own" on public.content_items for delete to authenticated using (auth.uid() = user_id);

grant select, insert, update, delete on public.content_items to authenticated, service_role;

-- Archivos (bucket privado, una carpeta por usuario, máximo 50 MB por archivo).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content', 'content', false, 52428800, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm'])
on conflict (id) do nothing;
drop policy if exists "content select own" on storage.objects;
create policy "content select own" on storage.objects for select to authenticated using (bucket_id = 'content' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "content insert own" on storage.objects;
create policy "content insert own" on storage.objects for insert to authenticated with check (bucket_id = 'content' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "content delete own" on storage.objects;
create policy "content delete own" on storage.objects for delete to authenticated using (bucket_id = 'content' and (storage.foldername(name))[1] = auth.uid()::text);
