// Publicaciones guardadas en Supabase (tabla `posts`, una fila por publicación, protegida por RLS).
// Son compartidas: pueden cambiar desde la sesión de otra persona mientras la app está abierta.
import { supabase } from './supabase.js'

const STALE_MS = 15 * 60000 // igual que en la función claim_post

/** Una reserva de publicación abandonada (se cerró el navegador) se muestra como fallida para poder revisarla. */
const toRow = (r) => {
  const version = Date.parse(r.updated_at)
  const post = r.data.status === 'publishing' && Date.now() - version > STALE_MS ? { ...r.data, status: 'failed' } : r.data
  return { post, version }
}

export async function fetchPosts() {
  const { data, error } = await supabase.from('posts').select('data,updated_at').order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  // Las guardadas de una sola vez (p. ej. al numerarlas) comparten fecha: entre ellas, primero la más nueva
  return (data || []).map(toRow).sort((a, b) => b.version - a.version || (b.post.createdAt || 0) - (a.post.createdAt || 0))
}

/** Solo id y versión de cada publicación: sirve para detectar cambios sin volver a descargar las imágenes. */
export async function fetchPostIndex() {
  const { data, error } = await supabase.from('posts').select('id,updated_at')
  if (error) throw new Error(error.message)
  return (data || []).map((r) => ({ id: r.id, version: Date.parse(r.updated_at) }))
}

export async function fetchPostsByIds(ids) {
  const out = []
  for (let i = 0; i < ids.length; i += 20) {
    const { data, error } = await supabase.from('posts').select('data,updated_at').in('id', ids.slice(i, i + 20))
    if (error) throw new Error(error.message)
    out.push(...(data || []).map(toRow))
  }
  return out
}

/** Devuelve la versión con la que quedó guardada cada publicación. */
export async function upsertPosts(uid, posts) {
  const versions = {}
  if (!posts.length) return versions
  if (!uid) throw new Error('Sin acceso al espacio compartido')
  const at = new Date().toISOString()
  const rows = posts.map((p) => ({ user_id: uid, id: p.id, data: p, updated_at: at }))
  for (let i = 0; i < rows.length; i += 20) { // por lotes: las imágenes pesan
    const { error } = await supabase.from('posts').upsert(rows.slice(i, i + 20))
    if (error) throw new Error(error.message)
  }
  posts.forEach((p) => { versions[p.id] = Date.parse(at) })
  return versions
}

export async function deletePosts(uid, ids) {
  if (!ids.length) return
  const { error } = await supabase.from('posts').delete().eq('user_id', uid).in('id', ids)
  if (error) throw new Error(error.message)
}

/**
 * Reserva la publicación antes de publicarla (evita que se publique dos veces con dos navegadores abiertos).
 * `post` = null cuando la pide el programador. Devuelve lo que hay que publicar, o null si ya no corresponde.
 */
export async function claimPost(id, post = null) {
  const { data, error } = await supabase.rpc('claim_post', { p_id: id, p_data: post })
  if (error) throw new Error(error.message)
  return data
}
