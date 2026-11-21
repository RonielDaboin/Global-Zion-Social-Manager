// Planes y roles del servicio: Básico, PRO y PRO PLUS.
// OJO: esto es lo que ve y puede usar el usuario en la interfaz. El plan real debe guardarse en el servidor
// (app_metadata de Supabase) porque user_metadata lo puede editar el propio usuario. Las funciones de Supabase
// (supabase/functions/_shared/plan.ts) repiten estas reglas para que no se puedan saltar desde el navegador.

const P_BASIC = ['instagram', 'facebook', 'twitter']
const P_PRO = [...P_BASIC, 'tiktok', 'linkedin', 'youtube', 'email']
const P_PLUS = [...P_PRO, 'whatsapp', 'whatsapp-business']

// Límites y funciones de cada plan. Infinity = sin límite.
export const LIMITS = {
  basic: {
    platforms: P_BASIC, accounts: 2, scheduledPerMonth: 0, templates: 5, multiFormat: false, stickers: false,
    workshop: false, removeBg: false, upscale: false, video: false, videoMB: 0,
    animation: false, animMaxSec: 0, animAllMotions: false,
    aiText: false, aiTextPerDay: 0, aiImage: false, autoPost: false, credits: false, priority: false,
  },
  pro: {
    platforms: P_PRO, accounts: 6, scheduledPerMonth: 30, templates: 15, multiFormat: true, stickers: true,
    workshop: true, removeBg: false, upscale: false, video: true, videoMB: 100,
    animation: true, animMaxSec: 30, animAllMotions: false,
    aiText: true, aiTextPerDay: 20, aiImage: false, autoPost: false, credits: true, priority: false,
  },
  pro_plus: {
    platforms: P_PLUS, accounts: Infinity, scheduledPerMonth: Infinity, templates: Infinity, multiFormat: true, stickers: true,
    workshop: true, removeBg: true, upscale: true, video: true, videoMB: 500,
    animation: true, animMaxSec: 60, animAllMotions: true,
    aiText: true, aiTextPerDay: 100, aiImage: true, autoPost: true, credits: true, priority: true,
  },
}

// Movimientos de la sección Animación incluidos en PRO (PRO PLUS tiene todos)
export const PRO_ANIM_MOTIONS = ['zoomin', 'zoomout', 'panl', 'panr', 'pulse', 'none']

export const PLANS = {
  basic: {
    id: 'basic', name: 'Básico', tone: 'gray', rank: 0, tagline: 'Para empezar a publicar',
    perks: ['Instagram, Facebook y X', 'Hasta 2 cuentas conectadas', 'Publicar al momento y guardar borradores', 'Editor de imágenes con 5 plantillas', 'Textos con plantillas locales'],
  },
  pro: {
    id: 'pro', name: 'PRO', tone: 'blue', rank: 1, tagline: 'Para quien publica a diario',
    perks: ['+ TikTok, LinkedIn, YouTube y Correo', 'Hasta 6 cuentas conectadas', 'Programar hasta 30 publicaciones al mes y calendario', '15 plantillas, stickers y varios formatos a la vez', 'Editor de video (hasta 100 MB) y recorte de imagen', 'Animación con música (hasta 30 s y 6 movimientos)', 'Textos con IA (20 al día) y Créditos IA'],
  },
  pro_plus: {
    id: 'pro_plus', name: 'PRO PLUS', tone: 'gold', rank: 2, tagline: 'Todo incluido, sin límites',
    perks: ['Todas las redes, incluido WhatsApp', 'Cuentas y programación sin límite', 'Imágenes con IA y publicación automática con IA', 'Quitar fondo y ampliar imágenes', 'Editor de video completo (hasta 500 MB)', 'Animación con música: 21 movimientos y hasta 60 s', 'Textos con IA (100 al día) y soporte prioritario'],
  },
}
export const PLAN_LIST = [PLANS.basic, PLANS.pro, PLANS.pro_plus]

// Precio mensual en USD que paga el cliente. Debe coincidir con el precio del plan de suscripción creado en PayPal.
// Incluye la comisión de PayPal en Chile (5,40 % + 0,30 USD) para que a Global Zion le lleguen netos 5,99 / 13,99 / 24,99:
//   precio = (neto + 0,30) / (1 - 0,054). Si PayPal cambia la comisión hay que recalcular y crear planes nuevos.
export const PRICES = { basic: 6.65, pro: 15.11, pro_plus: 26.74 }
export const fmtPrice = (n) => '$' + n.toFixed(2)
// IDs de los planes de suscripción de PayPal (P-XXXX), públicos por diseño. Ver PAGOS_PAYPAL.md.
export const PAYPAL = {
  clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || '',
  plans: {
    basic: import.meta.env.VITE_PAYPAL_PLAN_BASIC || '',
    pro: import.meta.env.VITE_PAYPAL_PLAN_PRO || '',
    pro_plus: import.meta.env.VITE_PAYPAL_PLAN_PRO_PLUS || '',
  },
}
export const paypalReady = !!(PAYPAL.clientId && PAYPAL.plans.basic && PAYPAL.plans.pro && PAYPAL.plans.pro_plus)

// Prueba gratuita de 15 días (se cuenta desde que se creó la cuenta; los usuarios anteriores a PAYWALL_START la cuentan desde esa fecha).
// Mismas reglas en supabase/functions/_shared/plan.ts (trialExpired).
export const TRIAL_DAYS = 15
const PAYWALL_START = Date.parse('2026-11-21T00:00:00Z')

// Filas de la tabla comparativa: [etiqueta, valor Básico, valor PRO, valor PRO PLUS]  (true/false = ✓/—)
export const COMPARE = [
  ['Redes sociales', 'Instagram, Facebook, X', '+ TikTok, LinkedIn, YouTube, Correo', '+ WhatsApp y WhatsApp Business'],
  ['Cuentas conectadas', '2', '6', 'Sin límite'],
  ['Publicar al momento y borradores', true, true, true],
  ['Programar y calendario', false, '30 al mes', 'Sin límite'],
  ['Plantillas de diseño', '5', '15', 'Todas (26)'],
  ['Varios formatos a la vez y stickers', false, true, true],
  ['Recortar y borrar en el taller de imagen', false, true, true],
  ['Quitar fondo y ampliar imágenes', false, false, true],
  ['Editor de video', false, 'Hasta 100 MB', 'Hasta 500 MB'],
  ['Animación con música (imagen a video)', false, 'Hasta 30 s · 6 movimientos', 'Hasta 60 s · 21 movimientos'],
  ['Visualizador de música (barras con altura, posición y color)', false, true, true],
  ['Vista previa en vivo y modo cine en la animación', false, true, true],
  ['Descargar copia del video al publicar o programar', false, true, true],
  ['Textos con IA', 'Plantillas locales', '20 al día', '100 al día'],
  ['Imágenes con IA y publicación automática', false, false, true],
  ['Créditos IA', false, true, true],
  ['Soporte prioritario', false, false, true],
]

export const ROLES = {
  owner: { id: 'owner', name: 'Dueño y creador' },
  admin: { id: 'admin', name: 'Administrador' },
  user: { id: 'user', name: 'Usuario' },
}

// Cuentas con rol/plan asignado (provisional, hasta tenerlo en el servidor)
const ASSIGNED = {
  'ronieldaboinchile@gmail.com': { role: 'owner', plan: 'pro_plus' },
}

/** Rol y plan de una sesión: primero lo que venga del servidor (app_metadata), luego la lista provisional. */
export function accessOf(session) {
  const email = (session?.email || '').toLowerCase()
  const a = ASSIGNED[email] || {}
  const role = ROLES[session?.appRole] ? session.appRole : a.role || 'user'
  const srv = session?.appPlan === 'free' ? 'basic' : session?.appPlan // 'free' era el nombre antiguo de Básico
  const plan = PLANS[srv] ? srv : a.plan || 'basic'
  // Prueba gratuita: sin suscripción de PayPal, el dueño y los administradores nunca caducan
  const exempt = role === 'owner' || role === 'admin'
  const paid = !!session?.appSub
  const end = Math.max(Date.parse(session?.createdAt || '') || 0, PAYWALL_START) + TRIAL_DAYS * 86400000
  const onTrial = !!session && !exempt && !paid
  const trialDaysLeft = onTrial ? Math.max(0, Math.ceil((end - Date.now()) / 86400000)) : null
  return { role: ROLES[role], plan: PLANS[plan], limits: LIMITS[plan], onTrial, trialDaysLeft, expired: onTrial && Date.now() > end }
}

/** Plan más barato que incluye algo (para el aviso «Disponible en …»). `test` recibe los límites de un plan. */
export const planFor = (test) => PLAN_LIST.find((p) => test(LIMITS[p.id])) || PLANS.pro_plus

// ---- Contadores de IA por día (en el navegador; el servidor bloquea además por plan) ----
const dayKey = (uid) => `gz_aitext_${uid || 'anon'}_${new Date().toISOString().slice(0, 10)}`
export const aiTextUsed = (uid) => { try { return Number(localStorage.getItem(dayKey(uid))) || 0 } catch { return 0 } }
export const aiTextBump = (uid) => { try { localStorage.setItem(dayKey(uid), String(aiTextUsed(uid) + 1)) } catch { /* ignore */ } }

/** Cuántas publicaciones programadas (o ya publicadas desde una programación) caen en el mes de `ts`. */
export const scheduledInMonth = (posts, ts = Date.now(), skipId = null) => {
  const d = new Date(ts), y = d.getFullYear(), m = d.getMonth()
  return posts.filter((p) => p.id !== skipId && p.scheduledAt && ['scheduled', 'publishing', 'published', 'failed'].includes(p.status)
    && new Date(p.scheduledAt).getFullYear() === y && new Date(p.scheduledAt).getMonth() === m).length
}
