// Plan del usuario leído del JWT (app_metadata.plan). Es la copia en el servidor de las reglas de src/lib/plans.js.
// Las funciones con verify_jwt activado reciben un JWT ya verificado por Supabase, así que su contenido es de fiar;
// user_metadata NO se usa porque el propio usuario puede editarlo.
export type PlanId = 'basic' | 'pro' | 'pro_plus'
const RANK: Record<PlanId, number> = { basic: 0, pro: 1, pro_plus: 2 }
const NAME: Record<PlanId, string> = { basic: 'Básico', pro: 'PRO', pro_plus: 'Premium' }
const OWNERS = ['ronieldaboinchile@gmail.com'] // dueño: Premium (igual que ASSIGNED en plans.js)

export const PLATFORMS_BY_PLAN: Record<PlanId, string[]> = {
  basic: ['instagram', 'facebook', 'twitter'],
  pro: ['instagram', 'facebook', 'twitter', 'tiktok', 'linkedin', 'youtube', 'email'],
  pro_plus: ['instagram', 'facebook', 'twitter', 'tiktok', 'linkedin', 'youtube', 'email', 'whatsapp', 'whatsapp-business'],
}
export const MAX_ACCOUNTS: Record<PlanId, number> = { basic: 2, pro: 6, pro_plus: 9999 }

export function planOfUser(email?: string | null, appPlan?: string | null): PlanId {
  if (OWNERS.includes((email || '').toLowerCase())) return 'pro_plus'
  const p = appPlan === 'free' ? 'basic' : appPlan
  return p === 'pro' || p === 'pro_plus' ? p : 'basic'
}

// Prueba gratuita de 15 días del plan Básico. Mismas reglas que trialOf() en src/lib/plans.js.
const TRIAL_DAYS = 15
const PAYWALL_START = Date.parse('2026-11-21T00:00:00Z') // usuarios anteriores a esta fecha cuentan la prueba desde aquí

/** true si el usuario ya no tiene suscripción activa y su prueba gratuita terminó (el dueño y los administradores nunca caducan). */
export function trialExpired(user: { email?: string | null; created_at?: string; app_metadata?: Record<string, unknown> }): boolean {
  if (OWNERS.includes((user.email || '').toLowerCase()) || user.app_metadata?.role === 'admin' || user.app_metadata?.role === 'owner') return false
  if (user.app_metadata?.paypal_subscription_id) return false
  const start = Math.max(Date.parse(user.created_at || '') || 0, PAYWALL_START)
  return Date.now() > start + TRIAL_DAYS * 86400000
}

function planFromJwt(req: Request): PlanId {
  try {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const b = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const j = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0))))
    return planOfUser(j.email, j.app_metadata?.plan)
  } catch { return 'basic' }
}

/** Devuelve un mensaje de error si el plan del usuario no llega al mínimo (1 = PRO, 2 = Premium); null si puede seguir. */
export function requirePlan(req: Request, min: 1 | 2): string | null {
  const plan = planFromJwt(req)
  return RANK[plan] >= min ? null : `Esta función está disponible desde el plan ${min === 1 ? 'PRO' : 'Premium'} (tu plan: ${NAME[plan]}).`
}
