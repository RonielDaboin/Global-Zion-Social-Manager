-- Cuentas sociales conectadas (tokens OAuth). Solo accesibles desde Edge Functions (service role):
-- RLS activado y SIN políticas, así el navegador nunca puede leer los tokens.
create table if not exists public.social_accounts (
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  account_id text not null,
  username text,
  name text,
  avatar text,
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  extra jsonb not null default '{}'::jsonb,
  connected_at timestamptz not null default now(),
  primary key (user_id, platform)
);
alter table public.social_accounts enable row level security;

-- Bucket público para que Instagram/Facebook puedan descargar la imagen o el video a publicar.
insert into storage.buckets (id, name, public) values ('post-media', 'post-media', true)
on conflict (id) do nothing;

drop policy if exists "post-media upload own folder" on storage.objects;
create policy "post-media upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "post-media update own folder" on storage.objects;
create policy "post-media update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
