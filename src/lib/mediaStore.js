// Los videos pesan demasiado para localStorage: se guardan en IndexedDB (caché local) y en Supabase Storage (bucket privado post-videos).
import { supabase } from './supabase.js'

const DB = 'gz-media'
const STORE = 'videos'

const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(STORE)
  r.onsuccess = () => res(r.result)
  r.onerror = () => rej(r.error)
})

const run = async (mode, fn) => {
  const db = await open()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); res(req?.result) }
    tx.onerror = () => { db.close(); rej(tx.error) }
  })
}

const idbGet = (id) => run('readonly', (s) => s.get(id)).catch(() => null)
const idbPut = (id, blob) => run('readwrite', (s) => s.put(blob, id))
const path = async (id) => {
  const { data } = await supabase.auth.getSession()
  return data.session ? `${data.session.user.id}/${id}` : null
}

export const saveVideo = (id, blob) => idbPut(id, blob)

/** Local primero; si no está (otro navegador/dirección), lo baja de Supabase y lo cachea. */
export const loadVideo = async (id) => {
  const local = await idbGet(id)
  if (local) return local
  try {
    const p = await path(id)
    if (!p) return null
    const { data, error } = await supabase.storage.from('post-videos').download(p)
    if (error || !data) return null
    await idbPut(id, data).catch(() => {})
    return data
  } catch { return null }
}

/** Sube a Supabase el video guardado localmente (si lo hay). */
export const pushVideo = async (id) => {
  const blob = await idbGet(id)
  const p = await path(id)
  if (!blob || !p) return false
  const { error } = await supabase.storage.from('post-videos').upload(p, blob, { contentType: blob.type || 'video/mp4', upsert: true })
  return !error
}

/** Borra solo la copia de la nube (la local del navegador se conserva para la vista previa). */
export const removeCloudVideo = async (id) => {
  try { const p = await path(id); if (p) await supabase.storage.from('post-videos').remove([p]) } catch { /* ignore */ }
}

export const deleteVideo = async (id) => {
  await run('readwrite', (s) => s.delete(id)).catch(() => {})
  try { const p = await path(id); if (p) await supabase.storage.from('post-videos').remove([p]) } catch { /* ignore */ }
}
