// Supabase Edge Function: activa el plan tras aprobar una suscripción de PayPal en el navegador.
// No se fía de lo que diga el cliente: consulta la suscripción a PayPal, comprueba que está activa,
// que pertenece a este usuario (custom_id) y qué plan es, y solo entonces escribe app_metadata.plan.
//
// Despliegue:
//   supabase functions deploy paypal-activate --project-ref bknwnurzxaxtkgnrriva
// (verify_jwt activado: solo usuarios con sesión)

import { cancelSubscription, getSubscription, getUser, planOfPaypalPlan, setAppMetadata } from '../_shared/paypal.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

function userIdFromJwt(req: Request): string | null {
  try {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const b = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0)))).sub || null
  } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const uid = userIdFromJwt(req)
  if (!uid) return json({ error: 'Sesión no válida' }, 401)

  let subscriptionId = ''
  try { subscriptionId = String((await req.json()).subscriptionId || '') } catch { /* ignore */ }
  if (!/^I-[A-Z0-9]+$/.test(subscriptionId)) return json({ error: 'Suscripción no válida' }, 400)

  try {
    let sub = await getSubscription(subscriptionId)
    // Justo tras aprobar, PayPal puede tardar un instante en pasar de APPROVED a ACTIVE
    for (let i = 0; i < 4 && sub && sub.status !== 'ACTIVE'; i++) {
      await new Promise((r) => setTimeout(r, 1500))
      sub = await getSubscription(subscriptionId)
    }
    if (!sub) return json({ error: 'No se encontró la suscripción en PayPal' }, 404)
    if (sub.custom_id !== uid) return json({ error: 'Esta suscripción no es de tu cuenta' }, 403)
    if (sub.status !== 'ACTIVE') return json({ error: 'El pago aún no está confirmado (estado: ' + sub.status + '). Si te cobraron, tu plan se activará solo en unos minutos.' }, 409)
    const plan = planOfPaypalPlan(sub.plan_id)
    if (!plan) return json({ error: 'Plan de PayPal desconocido' }, 400)

    // Si cambia de plan, se cancela la suscripción anterior para no cobrarle dos veces
    const user = await getUser(uid)
    const prev = user?.app_metadata?.paypal_subscription_id
    if (prev && prev !== subscriptionId) await cancelSubscription(prev)

    const ok = await setAppMetadata(uid, { plan, paypal_subscription_id: subscriptionId })
    if (!ok) return json({ error: 'No se pudo activar el plan. Escríbenos con tu ID de suscripción: ' + subscriptionId }, 500)
    return json({ plan })
  } catch (e) {
    console.error('paypal-activate', e)
    return json({ error: e instanceof Error ? e.message : 'Error al activar el plan' }, 500)
  }
})
