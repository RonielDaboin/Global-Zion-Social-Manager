import { createClient } from '@supabase/supabase-js'

// Proyecto "Base de Clientes" (Global Zion ORG). La publishable key es pública por diseño.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://axshbrskybmydywwpdla.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_wwJfre1OctDbHr4va97YNQ_psIaFZ9I'

export const supabase = createClient(URL, KEY)

// Google a veces solo entrega el nombre completo: se separa a mitad (2 palabras: nombre/apellido; 3: 1+2; 4: 2+2)
function splitName(given, family, full) {
  if (given || family) return { givenName: given || null, familyName: family || null }
  const w = (full || '').trim().split(/\s+/).filter(Boolean)
  if (w.length < 2) return { givenName: w[0] || null, familyName: null }
  const k = w.length === 2 ? 1 : w.length === 3 ? 1 : Math.floor(w.length / 2)
  return { givenName: w.slice(0, k).join(' '), familyName: w.slice(k).join(' ') }
}

export const toSession =(u) => {
  if (!u) return null
  // El perfil de Google puede venir en user_metadata o solo en la identidad vinculada (cuentas creadas primero con correo)
  const g = u.identities?.find((i) => i.provider === 'google')?.identity_data || {}
  const meta = u.user_metadata || {}
  return {
    id: u.id,
    email: u.email,
    name: meta.full_name || meta.name || g.full_name || g.name || u.email.split('@')[0],
    picture: meta.avatar_url || meta.picture || g.avatar_url || g.picture || null,
    ...splitName(meta.given_name || g.given_name, meta.family_name || g.family_name, meta.full_name || meta.name || g.full_name || g.name),
    emailVerified: meta.email_verified ?? g.email_verified ?? null,
    providers: [...new Set((u.identities || []).map((i) => i.provider))],
    googleId: g.provider_id || g.sub || null,
    appRole: u.app_metadata?.role || null,
    appPlan: u.app_metadata?.plan || null,
    googleKeys: Object.keys(g),
    avatarMode: meta.avatar_mode === 'initial' ? 'initial' : 'photo',
    contactPref: meta.contact_pref || 'whatsapp',
    phone: meta.phone_number || null,
    location: meta.location || null,
    createdAt: u.created_at || null,
    lastSignIn: u.last_sign_in_at || null,
  }
}
