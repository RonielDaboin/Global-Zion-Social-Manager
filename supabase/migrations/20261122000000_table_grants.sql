-- Permisos de acceso a las tablas para la API de Supabase.
-- Los proyectos nuevos no los conceden por defecto (error 42501 "permission denied for table ..."), así que se dan aquí.
-- La seguridad real por usuario sigue en las políticas RLS de cada tabla (cada usuario solo ve lo suyo).
grant usage on schema public to anon, authenticated, service_role;

-- Tablas que usa el navegador con la sesión del usuario (protegidas por RLS)
grant select, insert, update, delete on public.posts to authenticated;
grant select, insert, update, delete on public.ai_usage to authenticated;
grant select, insert, update, delete on public.ai_snapshots to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Cuentas sociales: contienen tokens, solo las lee/escribe la función del servidor (service_role)
grant select, insert, update, delete on public.social_accounts to service_role;
grant select, insert, update, delete on public.posts, public.ai_usage, public.ai_snapshots to service_role;
grant usage, select on all sequences in schema public to service_role;
