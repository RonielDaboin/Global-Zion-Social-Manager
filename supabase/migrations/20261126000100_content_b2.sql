-- Dónde está guardado cada archivo de Contenido: en Supabase o en Backblaze B2.
alter table public.content_items add column if not exists storage text not null default 'supabase' check (storage in ('supabase', 'b2'));
