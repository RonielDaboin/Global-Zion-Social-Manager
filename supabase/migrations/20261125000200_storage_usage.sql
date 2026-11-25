-- Espacio total ocupado en Storage (todos los buckets y usuarios): el límite gratuito es del proyecto entero.
-- Solo devuelve la suma en bytes; no expone nombres, dueños ni contenido de ningún archivo.
create or replace function public.storage_used_bytes()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)::bigint from storage.objects
$$;

revoke all on function public.storage_used_bytes() from public, anon;
grant execute on function public.storage_used_bytes() to authenticated;
