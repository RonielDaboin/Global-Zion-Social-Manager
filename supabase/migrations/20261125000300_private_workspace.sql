-- App privada con espacio compartido: solo los correos de `app_members` pueden registrarse y ver datos,
-- y todos ellos trabajan sobre los datos del dueño (publicaciones, contenido, redes conectadas y uso de IA).
-- Para dar acceso a otra persona: insert into public.app_members (email) values ('correo@en.minusculas');

create table if not exists public.app_members (
  email text primary key check (email = lower(email)),
  is_owner boolean not null default false
);
create unique index if not exists app_members_one_owner on public.app_members (is_owner) where is_owner;
alter table public.app_members enable row level security; -- sin políticas: la lista no se lee desde el navegador
revoke all on public.app_members from anon, authenticated;
grant select on public.app_members to service_role;

-- Los invitados se agregan directamente en la base de datos: sus correos no se guardan en el repositorio.
insert into public.app_members (email, is_owner) values ('ronieldaboinchile@gmail.com', true)
on conflict (email) do nothing;

-- Espacio de trabajo de un usuario: el id del dueño si es miembro con correo confirmado; si no, null.
create or replace function public.member_workspace(p_user uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select o.id
  from auth.users u
  join public.app_members m on m.email = lower(u.email)
  join public.app_members om on om.is_owner
  join auth.users o on lower(o.email) = om.email and o.email_confirmed_at is not null
  where u.id = p_user and u.email_confirmed_at is not null
  limit 1
$$;
revoke all on function public.member_workspace(uuid) from public, anon, authenticated;
grant execute on function public.member_workspace(uuid) to service_role;

create or replace function public.workspace_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select public.member_workspace(auth.uid())
$$;
revoke all on function public.workspace_id() from public, anon;
grant execute on function public.workspace_id() to authenticated;

-- Registro cerrado: solo se pueden crear cuentas de la lista. A los invitados se les da el plan Premium como
-- administradores (en cada escritura, porque el servicio de autenticación reescribe app_metadata).
create or replace function public.guard_app_users()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  member public.app_members%rowtype;
begin
  select * into member from public.app_members where email = lower(new.email);
  if tg_op = 'INSERT' and member.email is null then
    raise exception 'signup_disabled';
  end if;
  if member.email is not null and not member.is_owner then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) || '{"plan": "pro_plus", "role": "admin"}'::jsonb;
  elsif member.email is null and tg_op = 'UPDATE' and new.email is distinct from old.email then
    new.raw_app_meta_data := coalesce(new.raw_app_meta_data, '{}'::jsonb) - 'plan' - 'role';
  end if;
  return new;
end
$$;
drop trigger if exists guard_app_users on auth.users;
create trigger guard_app_users before insert or update on auth.users for each row execute function public.guard_app_users();
-- Si la persona invitada ya tenía cuenta, esta escritura le aplica el plan
update auth.users set raw_app_meta_data = raw_app_meta_data
where lower(email) in (select email from public.app_members where not is_owner);

-- Publicaciones: todas viven a nombre del dueño
drop policy if exists "posts select own" on public.posts;
create policy "posts select own" on public.posts for select to authenticated using (user_id = public.workspace_id());
drop policy if exists "posts insert own" on public.posts;
create policy "posts insert own" on public.posts for insert to authenticated with check (user_id = public.workspace_id());
drop policy if exists "posts update own" on public.posts;
create policy "posts update own" on public.posts for update to authenticated using (user_id = public.workspace_id()) with check (user_id = public.workspace_id());
drop policy if exists "posts delete own" on public.posts;
create policy "posts delete own" on public.posts for delete to authenticated using (user_id = public.workspace_id());

-- Biblioteca de contenido
drop policy if exists "content_items select own" on public.content_items;
create policy "content_items select own" on public.content_items for select to authenticated using (user_id = public.workspace_id());
drop policy if exists "content_items insert own" on public.content_items;
create policy "content_items insert own" on public.content_items for insert to authenticated
  with check (user_id = public.workspace_id() and path like public.workspace_id()::text || '/%');
drop policy if exists "content_items update own" on public.content_items;
create policy "content_items update own" on public.content_items for update to authenticated
  using (user_id = public.workspace_id()) with check (user_id = public.workspace_id() and path like public.workspace_id()::text || '/%');
drop policy if exists "content_items delete own" on public.content_items;
create policy "content_items delete own" on public.content_items for delete to authenticated using (user_id = public.workspace_id());

-- Uso y cuotas de IA (las claves son las mismas, así que el cupo es compartido)
alter table public.ai_usage alter column user_id set default public.workspace_id();
alter table public.ai_snapshots alter column user_id set default public.workspace_id();
drop policy if exists "ai_usage select own" on public.ai_usage;
create policy "ai_usage select own" on public.ai_usage for select to authenticated using (user_id = public.workspace_id());
drop policy if exists "ai_usage insert own" on public.ai_usage;
create policy "ai_usage insert own" on public.ai_usage for insert to authenticated with check (user_id = public.workspace_id());
drop policy if exists "ai_snapshots select own" on public.ai_snapshots;
create policy "ai_snapshots select own" on public.ai_snapshots for select to authenticated using (user_id = public.workspace_id());
drop policy if exists "ai_snapshots upsert own" on public.ai_snapshots;
create policy "ai_snapshots upsert own" on public.ai_snapshots for insert to authenticated with check (user_id = public.workspace_id());
drop policy if exists "ai_snapshots update own" on public.ai_snapshots;
create policy "ai_snapshots update own" on public.ai_snapshots for update to authenticated using (user_id = public.workspace_id()) with check (user_id = public.workspace_id());

-- Archivos: una sola carpeta, la del espacio compartido
drop policy if exists "post-videos select own" on storage.objects;
create policy "post-videos select own" on storage.objects for select to authenticated using (bucket_id = 'post-videos' and (storage.foldername(name))[1] = public.workspace_id()::text);
drop policy if exists "post-videos insert own" on storage.objects;
create policy "post-videos insert own" on storage.objects for insert to authenticated with check (bucket_id = 'post-videos' and (storage.foldername(name))[1] = public.workspace_id()::text);
drop policy if exists "post-videos update own" on storage.objects;
create policy "post-videos update own" on storage.objects for update to authenticated using (bucket_id = 'post-videos' and (storage.foldername(name))[1] = public.workspace_id()::text);
drop policy if exists "post-videos delete own" on storage.objects;
create policy "post-videos delete own" on storage.objects for delete to authenticated using (bucket_id = 'post-videos' and (storage.foldername(name))[1] = public.workspace_id()::text);

drop policy if exists "post-media upload own folder" on storage.objects;
create policy "post-media upload own folder" on storage.objects for insert to authenticated with check (bucket_id = 'post-media' and (storage.foldername(name))[1] = public.workspace_id()::text);
drop policy if exists "post-media update own folder" on storage.objects;
create policy "post-media update own folder" on storage.objects for update to authenticated using (bucket_id = 'post-media' and (storage.foldername(name))[1] = public.workspace_id()::text);
drop policy if exists "post-media select own folder" on storage.objects;
create policy "post-media select own folder" on storage.objects for select to authenticated using (bucket_id = 'post-media' and (storage.foldername(name))[1] = public.workspace_id()::text);
drop policy if exists "post-media delete own folder" on storage.objects;
create policy "post-media delete own folder" on storage.objects for delete to authenticated using (bucket_id = 'post-media' and (storage.foldername(name))[1] = public.workspace_id()::text);

drop policy if exists "content select own" on storage.objects;
create policy "content select own" on storage.objects for select to authenticated using (bucket_id = 'content' and (storage.foldername(name))[1] = public.workspace_id()::text);
drop policy if exists "content insert own" on storage.objects;
create policy "content insert own" on storage.objects for insert to authenticated with check (bucket_id = 'content' and (storage.foldername(name))[1] = public.workspace_id()::text);
drop policy if exists "content delete own" on storage.objects;
create policy "content delete own" on storage.objects for delete to authenticated using (bucket_id = 'content' and (storage.foldername(name))[1] = public.workspace_id()::text);

-- El total ocupado solo lo ven los miembros
create or replace function public.storage_used_bytes()
returns bigint language sql stable security definer set search_path = '' as $$
  select case when public.workspace_id() is null then null
    else (select coalesce(sum((metadata->>'size')::bigint), 0)::bigint from storage.objects) end
$$;

-- Reserva una publicación antes de publicarla, para que dos navegadores abiertos no la publiquen dos veces.
-- p_data = null: la pide el programador (debe seguir programada y vencida; se publica la versión del servidor).
-- p_data con datos: «Publicar» pulsado por una persona. Devuelve lo que hay que publicar, o null si no corresponde.
create or replace function public.claim_post(p_id text, p_data jsonb default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  ws uuid := public.workspace_id();
  cur public.posts%rowtype;
  chosen jsonb;
begin
  if ws is null then raise exception 'Acceso no autorizado'; end if;
  select * into cur from public.posts where user_id = ws and id = p_id for update;
  if not found then
    if p_data is null then return null; end if; -- se eliminó: el programador no la revive
    insert into public.posts (user_id, id, data, updated_at)
    values (ws, p_id, p_data || '{"status": "publishing"}'::jsonb, now())
    on conflict do nothing;
    if not found then return null; end if;
    return p_data;
  end if;
  if cur.data->>'status' = 'published' then return null; end if;
  -- Una reserva de más de 15 minutos es de un navegador que se cerró: una persona puede reintentar
  if cur.data->>'status' = 'publishing' and (p_data is null or cur.updated_at > now() - interval '15 minutes') then return null; end if;
  if p_data is null and (cur.data->>'status' <> 'scheduled'
    or coalesce((cur.data->>'scheduledAt')::numeric, 0) > extract(epoch from clock_timestamp()) * 1000 + 60000) then
    return null;
  end if;
  chosen := coalesce(p_data, cur.data);
  update public.posts set data = chosen || '{"status": "publishing"}'::jsonb, updated_at = now() where user_id = ws and id = p_id;
  return chosen;
end
$$;
revoke all on function public.claim_post(text, jsonb) from public, anon;
grant execute on function public.claim_post(text, jsonb) to authenticated;
