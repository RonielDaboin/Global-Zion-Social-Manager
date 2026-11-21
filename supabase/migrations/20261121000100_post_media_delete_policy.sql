-- Permite borrar los videos temporales de post-media (se eliminan tras publicar para no llenar el almacenamiento).
drop policy if exists "post-media delete own folder" on storage.objects;
create policy "post-media delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'post-media' and (storage.foldername(name))[1] = auth.uid()::text);
