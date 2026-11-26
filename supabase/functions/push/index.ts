// Supabase Edge Function: alertas push (publicada, fallida o cancelada) a los teléfonos y PC del espacio compartido.
// Las claves VAPID se generan solas y viven en la tabla push_config (sin acceso desde el navegador).
//   supabase functions deploy push --project-ref bknwnurzxaxtkgnrriva
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
class HttpError extends Error {
  status: number
  constructor(status: number, m: string) { super(m); this.status = status }
}

const env = (k: string) => Deno.env.get(k) || ''
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))

async function vapid() {
  const read = () => admin.from('push_config').select('public_key,private_key').eq('id', 1).maybeSingle()
  let { data, error } = await read()
  if (error) throw new HttpError(500, error.message)
  if (!data) {
    const k = webpush.generateVAPIDKeys()
    // Si dos peticiones llegan a la vez, gana la primera y se vuelve a leer
    await admin.from('push_config').upsert({ id: 1, public_key: k.publicKey, private_key: k.privateKey }, { onConflict: 'id', ignoreDuplicates: true })
    ;({ data, error } = await read())
    if (error || !data) throw new HttpError(500, error?.message || 'No se pudieron crear las claves')
  }
  return data as { public_key: string; private_key: string }
}

const NETS: Record<string, string> = { instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', email: 'Email', twitter: 'X', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', 'whatsapp-business': 'WhatsApp Business' }
const TITLES: Record<string, Record<string, string>> = {
  es: { published: '✅ Publicación publicada', failed: '❌ No se pudo publicar', cancelled: '🚫 Publicación cancelada', test: '🔔 Alertas activadas' },
  en: { published: '✅ Post published', failed: '❌ Post could not be published', cancelled: '🚫 Post cancelled', test: '🔔 Alerts are on' },
}

type Msg = { event: string; postId?: string; caption?: string; platforms?: string[]; errors?: string }

function compose(m: Msg, lang: string, who: string) {
  const l = lang === 'en' ? 'en' : 'es'
  const nets = (m.platforms || []).map((p) => NETS[p] || p).join(', ')
  const lines = m.event === 'test'
    ? [l === 'en' ? 'This is a test alert. 🎉' : 'Esta es una alerta de prueba. 🎉']
    : [String(m.caption || '').slice(0, 120), [nets, who].filter(Boolean).join(' · '), m.event === 'failed' ? String(m.errors || '').slice(0, 300) : '']
  return JSON.stringify({ title: TITLES[l][m.event], body: lines.filter(Boolean).join('\n'), tag: `${m.event}-${m.postId || ''}`, url: m.event === 'test' ? '/#/profile' : '/#/posts' })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: u, error: ue } = await admin.auth.getUser(jwt)
    if (ue || !u.user) throw new HttpError(401, 'Inicia sesión para continuar')
    const { data: ws, error: we } = await admin.rpc('member_workspace', { p_user: u.user.id })
    if (we) throw new HttpError(500, we.message)
    if (!ws) throw new HttpError(403, 'Esta app es privada: tu cuenta no tiene acceso.')
    const b = await req.json().catch(() => ({}))

    if (b.action === 'key') return json({ publicKey: (await vapid()).public_key })
    if (b.action === 'subscribe') {
      const s = b.subscription
      if (!String(s?.endpoint || '').startsWith('https://') || !s?.keys?.p256dh || !s?.keys?.auth) throw new HttpError(400, 'Suscripción no válida')
      const { error } = await admin.from('push_subscriptions').upsert({ endpoint: s.endpoint, workspace: ws, user_id: u.user.id, subscription: s, lang: b.lang === 'en' ? 'en' : 'es', updated_at: new Date().toISOString() })
      if (error) throw new HttpError(500, error.message)
      return json({ ok: true })
    }
    if (b.action === 'unsubscribe') {
      await admin.from('push_subscriptions').delete().eq('workspace', ws).eq('endpoint', String(b.endpoint))
      return json({ ok: true })
    }
    if (b.action === 'send') {
      if (!TITLES.es[b.event]) throw new HttpError(400, 'Aviso desconocido')
      const keys = await vapid()
      webpush.setVapidDetails('https://social-manager.globalzion.cl', keys.public_key, keys.private_key)
      let q = admin.from('push_subscriptions').select('endpoint,subscription,lang').eq('workspace', ws)
      if (b.event === 'test') q = q.eq('user_id', u.user.id) // la prueba no molesta a la otra persona
      const { data: subs, error } = await q
      if (error) throw new HttpError(500, error.message)
      const who = String(u.user.user_metadata?.full_name || u.user.user_metadata?.name || '')
      let sent = 0
      let lastError = ''
      await Promise.all((subs || []).map(async (s) => {
        try {
          await webpush.sendNotification(s.subscription, compose(b, s.lang, who), { TTL: 86400, urgency: 'high' })
          sent++
        } catch (e) {
          const code = (e as { statusCode?: number }).statusCode
          if (code === 404 || code === 410) await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint) // el dispositivo ya no existe
          lastError = `${code || ''} ${(e as { body?: string }).body || (e as Error).message}`.trim()
        }
      }))
      if (b.event === 'test' && !sent) throw new HttpError(502, lastError || 'No hay dispositivos suscritos')
      return json({ ok: true, sent })
    }
    throw new HttpError(400, 'Acción desconocida')
  } catch (e) {
    const s = e instanceof HttpError ? e.status : 500
    return json({ error: (e as Error).message || 'Error' }, s)
  }
})
