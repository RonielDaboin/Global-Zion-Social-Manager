-- Subir con upsert (INSERT ... ON CONFLICT DO UPDATE) necesita también permiso de lectura sobre la fila.
-- Sin esta política, publicar fallaba con "new row violates row-level security policy".
drop policy if exists "post-media select own folder" on storage.objects;
create policy "post-media select own folder" on storage.objects for select to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
