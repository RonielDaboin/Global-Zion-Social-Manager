import { createClient } from '@supabase/supabase-js'

// Proyecto "Base de Clientes" (Global Zion ORG). La publishable key es pública por diseño.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://axshbrskybmydywwpdla.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_wwJfre1OctDbHr4va97YNQ_psIaFZ9I'

export const supabase = createClient(URL, KEY)

export const toSession = (u) => {
  if (!u) return null
  // El perfil de Google puede venir en user_metadata o solo en la identidad vinculada (cuentas creadas primero con correo)
  const g = u.identities?.find((i) => i.provider === 'google')?.identity_data || {}
  const meta = u.user_metadata || {}
  return {
    id: u.id,
    email: u.email,
    name: meta.full_name || meta.name || g.full_name || g.name || u.email.split('@')[0],
    picture: meta.avatar_url || meta.picture || g.avatar_url || g.picture || null,
  }
}
