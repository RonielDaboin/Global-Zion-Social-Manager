// La app es privada y compartida: todas las cuentas autorizadas (tabla app_members) usan los datos del dueño.
// El servidor lo hace cumplir (RLS y funciones); aquí solo se pregunta cuál es el espacio de la sesión.
import { supabase } from './supabase.js'

let cache = null // { user, ws }

/** { ws } con el id del espacio compartido (null = cuenta sin acceso). Lanza error si no se pudo comprobar. */
export async function checkAccess() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { ws: null }
  if (cache?.user === session.user.id) return { ws: cache.ws }
  const { data, error } = await supabase.rpc('workspace_id')
  if (error) throw new Error(error.message)
  if (data) cache = { user: session.user.id, ws: data }
  return { ws: data || null }
}

/** Id del espacio compartido, o null si no hay sesión, no hay acceso o no se pudo comprobar. */
export const workspaceId = () => checkAccess().then((r) => r.ws).catch(() => null)
