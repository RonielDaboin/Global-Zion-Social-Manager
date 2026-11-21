// Utilidades de PayPal (suscripciones) compartidas por paypal-activate y paypal-webhook.
// Secretos necesarios (supabase secrets set ...):
//   PAYPAL_CLIENT_ID, PAYPAL_SECRET   credenciales de la app en developer.paypal.com
//   PAYPAL_PLAN_BASIC, PAYPAL_PLAN_PRO, PAYPAL_PLAN_PRO_PLUS   IDs de los planes de suscripción (P-XXXX) creados en PayPal
//   PAYPAL_WEBHOOK_ID                 ID del webhook (solo paypal-webhook)
//   PAYPAL_ENV                        'live' (por defecto) o 'sandbox' para pruebas
import type { PlanId } from './plan.ts'

const BASE = () => (Deno.env.get('PAYPAL_ENV') === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com')

export const planOfPaypalPlan = (paypalPlanId?: string | null): PlanId | null => {
  if (!paypalPlanId) return null
  if (paypalPlanId === Deno.env.get('PAYPAL_PLAN_BASIC')) return 'basic'
  if (paypalPlanId === Deno.env.get('PAYPAL_PLAN_PRO')) return 'pro'
  if (paypalPlanId === Deno.env.get('PAYPAL_PLAN_PRO_PLUS')) return 'pro_plus'
  return null
}

async function token(): Promise<string> {
  const id = Deno.env.get('PAYPAL_CLIENT_ID'), secret = Deno.env.get('PAYPAL_SECRET')
  if (!id || !secret) throw new Error('Faltan PAYPAL_CLIENT_ID / PAYPAL_SECRET en el servidor')
  const r = await fetch(`${BASE()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${id}:${secret}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  })
  if (!r.ok) throw new Error('PayPal rechazó las credenciales (' + r.status + ')')
  return (await r.json()).access_token
}

export async function paypal(path: string, init: RequestInit = {}): Promise<Response> {
  const t = await token()
  return fetch(BASE() + path, { ...init, headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json', ...(init.headers || {}) } })
}

export async function getSubscription(id: string) {
  const r = await paypal(`/v1/billing/subscriptions/${encodeURIComponent(id)}`)
  return r.ok ? await r.json() : null
}

export async function cancelSubscription(id: string, reason = 'Cambio de plan') {
  await paypal(`/v1/billing/subscriptions/${encodeURIComponent(id)}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }).catch(() => {})
}

// ---- Usuarios de Supabase (API admin con la service role; app_metadata solo lo puede escribir el servidor) ----
const sb = () => ({ url: Deno.env.get('SUPABASE_URL')!, key: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! })
const sbHeaders = () => ({ apikey: sb().key, Authorization: 'Bearer ' + sb().key, 'Content-Type': 'application/json' })

export async function getUser(userId: string) {
  const r = await fetch(`${sb().url}/auth/v1/admin/users/${userId}`, { headers: sbHeaders() })
  return r.ok ? await r.json() : null
}

/** Fusiona campos en app_metadata del usuario. */
export async function setAppMetadata(userId: string, meta: Record<string, unknown>): Promise<boolean> {
  const r = await fetch(`${sb().url}/auth/v1/admin/users/${userId}`, { method: 'PUT', headers: sbHeaders(), body: JSON.stringify({ app_metadata: meta }) })
  return r.ok
}
