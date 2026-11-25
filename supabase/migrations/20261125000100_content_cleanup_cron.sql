-- Tarea diaria (gratis, con pg_cron + pg_net) que borra el contenido vencido llamando a la función `content-cleanup`.
-- Los archivos de Storage no se pueden borrar con SQL, por eso se hace a través de la función.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 07:15 UTC (madrugada en Chile). Si la tarea ya existe, cron.schedule la actualiza.
select cron.schedule(
  'content-cleanup-daily',
  '15 7 * * *',
  $$ select net.http_post(
       url := 'https://bknwnurzxaxtkgnrriva.supabase.co/functions/v1/content-cleanup',
       headers := '{"Content-Type": "application/json"}'::jsonb,
       body := '{}'::jsonb
     ) $$
);
