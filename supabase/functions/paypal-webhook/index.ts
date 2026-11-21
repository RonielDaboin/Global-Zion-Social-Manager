// Supabase Edge Function: recibe los avisos (webhooks) de PayPal y mantiene el plan al día:
//   ACTIVATED  → sube al plan de la suscripción
//   CANCELLED / SUSPENDED / EXPIRED / PAYMENT.FAILED → vuelve a Básico (solo si es la suscripción vigente del usuario)
// Cada aviso se verifica con PayPal (firma) antes de hacer nada.
//
// Despliegue (SIN verificación JWT, porque PayPal no manda token de Supabase):
//   supabase functions deploy paypal-webhook --no-verify-jwt --project-ref axshbrskybmydywwpdla
// URL a registrar en PayPal: https://axshbrskybmydywwpdla.supabase.co/functions/v1/paypal-webhook

import { getUser, paypal, planOfPaypalPlan, setAppMetadata } from '../_shared/paypal.ts'

const ok = (body: unknown = { ok: true }, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return ok({ error: 'Método no permitido' }, 405)
  const raw = await req.text()
  let event: { event_type?: string; resource?: Record<string, unknown> }
  try { event = JSON.parse(raw) } catch { return ok({ error: 'JSON inválido' }, 400) }

  const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID')
  if (!webhookId) return ok({ error: 'Falta PAYPAL_WEBHOOK_ID' }, 500)
  try {
    const v = await paypal('/v1/notifications/verify-webhook-signature', {
      method: 'POST',
      body: JSON.stringify({
        auth_algo: req.headers.get('paypal-auth-algo'),
        cert_url: req.headers.get('paypal-cert-url'),
        transmission_id: req.headers.get('paypal-transmission-id'),
        transmission_sig: req.headers.get('paypal-transmission-sig'),
        transmission_time: req.headers.get('paypal-transmission-time'),
        webhook_id: webhookId,
        webhook_event: event,
      }),
    })
    if ((await v.json().catch(() => ({})))?.verification_status !== 'SUCCESS') return ok({ error: 'Firma no válida' }, 401)
  } catch (e) {
    console.error('paypal-webhook verify', e)
    return ok({ error: 'No se pudo verificar' }, 500)
  }

  const type = event.event_type || ''
  const r = (event.resource || {}) as Record<string, string>
  // En los avisos de pago fallido el id de la suscripción viene en billing_agreement_id; en los de estado, en id
  const subId = type.startsWith('PAYMENT.') ? r.billing_agreement_id : r.id
  const userId = r.custom_id
  if (!subId || !userId) return ok({ ignored: type })

  try {
    if (type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
      const plan = planOfPaypalPlan(r.plan_id)
      if (plan) await setAppMetadata(userId, { plan, paypal_subscription_id: subId })
    } else if (['BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.EXPIRED', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED'].includes(type)) {
      const user = await getUser(userId)
      // Si el usuario ya tiene otra suscripción vigente (cambió de plan), esta baja no le afecta
      if (user?.app_metadata?.paypal_subscription_id === subId) await setAppMetadata(userId, { plan: 'basic', paypal_subscription_id: null })
    }
  } catch (e) {
    console.error('paypal-webhook', type, e)
    return ok({ error: 'Error interno' }, 500) // PayPal reintentará
  }
  return ok()
})
