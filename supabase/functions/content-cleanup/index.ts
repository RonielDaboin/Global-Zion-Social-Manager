// Supabase Edge Function: borra el contenido cuya vigencia terminó (30 días desde su publicación), archivo y fila.
// La llama una vez al día la tarea programada de la migración 20261125000100_content_cleanup_cron.sql.
// No recibe parámetros y solo borra lo que ya venció, así que llamarla de más no tiene efecto.
// Respeta el botón de borrado automático (tabla workspace_settings).
//
// Despliegue (sin verificación JWT, porque la tarea programada no manda token de usuario):
//   supabase functions deploy content-cleanup --no-verify-jwt --project-ref bknwnurzxaxtkgnrriva

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CONTENT_DAYS = 30 // igual que en src/lib/content.js

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ error: 'Método no permitido' }, 405)
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const limit = new Date(Date.now() - CONTENT_DAYS * 86400000).toISOString()
  // Espacios con el borrado automático apagado, o reactivado hace menos de 30 días. Si no se puede leer, no se borra nada.
  const { data: settings, error: se } = await db.from('workspace_settings').select('user_id, content_autodelete, autodelete_since')
  if (se) return reply({ error: se.message }, 500)
  const paused = settings
    .filter((s) => !s.content_autodelete || (s.autodelete_since && Date.parse(s.autodelete_since) > Date.parse(limit)))
    .map((s) => s.user_id)
  let deleted = 0
  for (let round = 0; round < 20; round++) { // por lotes de 100
    let query = db.from('content_items').select('id, path').lte('published_at', limit)
    if (paused.length) query = query.not('user_id', 'in', `(${paused.join(',')})`)
    const { data, error } = await query.limit(100)
    if (error) return reply({ error: error.message }, 500)
    if (!data.length) break
    const { error: e1 } = await db.storage.from('content').remove(data.map((x) => x.path))
    if (e1) return reply({ error: e1.message }, 500)
    const { error: e2 } = await db.from('content_items').delete().in('id', data.map((x) => x.id))
    if (e2) return reply({ error: e2.message }, 500)
    deleted += data.length
  }
  return reply({ ok: true, deleted })
})
