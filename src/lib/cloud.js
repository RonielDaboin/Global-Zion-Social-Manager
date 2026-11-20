// Publicaciones guardadas en Supabase (tabla `posts`, una fila por publicación, protegida por RLS).
import { supabase } from './supabase.js'

export async function fetchPosts() {
  const { data, error } = await supabase.from('posts').select('data').order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data || []).map((r) => r.data)
}

export async function upsertPosts(uid, posts) {
  if (!posts.length) return
  const rows = posts.map((p) => ({ user_id: uid, id: p.id, data: p, updated_at: new Date().toISOString() }))
  for (let i = 0; i < rows.length; i += 20) { // por lotes: las imágenes pesan
    const { error } = await supabase.from('posts').upsert(rows.slice(i, i + 20))
    if (error) throw new Error(error.message)
  }
}

export async function deletePosts(uid, ids) {
  if (!ids.length) return
  const { error } = await supabase.from('posts').delete().eq('user_id', uid).in('id', ids)
  if (error) throw new Error(error.message)
}
