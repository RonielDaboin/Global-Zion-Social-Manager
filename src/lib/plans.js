// Planes y roles del servicio.
// OJO: esto es solo para mostrar en la interfaz. Cuando haya cobro real, el plan y el rol deben guardarse en el servidor
// (app_metadata de Supabase o una tabla) porque user_metadata lo puede editar el propio usuario.

export const PLANS = {
  free: { id: 'free', name: 'Gratis', tone: 'gray', perks: ['Publicaciones básicas', 'Hasta 2 redes conectadas'] },
  pro: { id: 'pro', name: 'Pro', tone: 'blue', perks: ['Todas las redes sociales', 'Publicaciones programadas', 'Generador de textos con IA'] },
  pro_plus: {
    id: 'pro_plus', name: 'Pro Plus', tone: 'gold',
    perks: ['Todas las redes sociales', 'Publicaciones programadas sin límite', 'Generador de textos e imágenes con IA', 'Editor de imágenes y video', 'Soporte prioritario'],
  },
}

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
  const plan = PLANS[session?.appPlan] ? session.appPlan : a.plan || 'free'
  return { role: ROLES[role], plan: PLANS[plan] }
}
