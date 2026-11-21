// Plan del usuario leído del JWT (app_metadata.plan). Es la copia en el servidor de las reglas de src/lib/plans.js.
// Las funciones con verify_jwt activado reciben un JWT ya verificado por Supabase, así que su contenido es de fiar;
// user_metadata NO se usa porque el propio usuario puede editarlo.
export type PlanId = 'basic' | 'pro' | 'pro_plus'
const RANK: Record<PlanId, number> = { basic: 0, pro: 1, pro_plus: 2 }
const NAME: Record<PlanId, string> = { basic: 'Básico', pro: 'PRO', pro_plus: 'PRO PLUS' }
const OWNERS = ['ronieldaboinchile@gmail.com'] // dueño: PRO PLUS (igual que ASSIGNED en plans.js)

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

function planFromJwt(req: Request): PlanId {
  try {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const b = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const j = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0))))
    return planOfUser(j.email, j.app_metadata?.plan)
  } catch { return 'basic' }
}

/** Devuelve un mensaje de error si el plan del usuario no llega al mínimo (1 = PRO, 2 = PRO PLUS); null si puede seguir. */
export function requirePlan(req: Request, min: 1 | 2): string | null {
  const plan = planFromJwt(req)
  return RANK[plan] >= min ? null : `Esta función está disponible desde el plan ${min === 1 ? 'PRO' : 'PRO PLUS'} (tu plan: ${NAME[plan]}).`
}
