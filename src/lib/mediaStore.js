// Los videos pesan demasiado para localStorage: se guardan en IndexedDB (caché local) y en Supabase Storage (bucket privado post-videos).
// En iPhone, un video guardado como Blob en IndexedDB puede subirse vacío (error 400 «No content provided»).
// Por eso se guardan y se suben los bytes (ArrayBuffer), y mientras la app está abierta se usa la copia en memoria.
import { supabase } from './supabase.js'
import { workspaceId } from './workspace.js'
import { t } from './i18n.jsx'

const DB = 'gz-media'
const STORE = 'videos'
const mem = new Map() // id -> Blob de esta sesión

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
    tx.onabort = () => { db.close(); rej(tx.error) } // sin espacio en el dispositivo
  })
}

/** Lee todo el video; falla con un mensaje claro si el navegador no puede entregarlo. */
export const videoBytes = async (blob) => {
  const buf = await blob.arrayBuffer().catch(() => null)
  if (!buf?.byteLength) throw new Error(t('No se pudo leer el video. Vuelve a subirlo.'))
  return buf
}

// Las copias antiguas se guardaron como Blob; las nuevas, como { buf, type, name }
const unpack = (v) => (v?.buf ? new File([v.buf], v.name || 'video', { type: v.type }) : v)
const idbGet = (id) => run('readonly', (s) => s.get(id)).then(unpack).catch(() => null)
const idbPut = async (id, blob) => {
  const buf = await videoBytes(blob)
  await run('readwrite', (s) => s.put({ buf, type: blob.type, name: blob.name || '' }, id))
}
const localGet = async (id) => mem.get(id) || idbGet(id)
const path = async (id) => {
  const ws = await workspaceId()
  return ws ? `${ws}/${id}` : null
}

export const saveVideo = async (id, blob) => {
  mem.set(id, blob)
  await idbPut(id, blob).catch(() => {}) // si no cabe en el dispositivo, queda la copia en memoria
}

/** Olvida solo la copia local (se vuelve a bajar de la nube cuando se necesite). */
export const dropLocalVideo = (id) => { mem.delete(id); return run('readwrite', (s) => s.delete(id)).catch(() => {}) }

/** Local primero; si no está (otro navegador/dirección), lo baja de Supabase y lo cachea. */
export const loadVideo = async (id) => {
  const local = await localGet(id)
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
  const blob = await localGet(id)
  const p = await path(id)
  if (!blob || !p) return false
  const { error } = await supabase.storage.from('post-videos').upload(p, await videoBytes(blob), { contentType: blob.type || 'video/mp4', upsert: true })
  return !error
}

/** Borra solo la copia de la nube (la local del navegador se conserva para la vista previa). */
export const removeCloudVideo = async (id) => {
  try { const p = await path(id); if (p) await supabase.storage.from('post-videos').remove([p]) } catch { /* ignore */ }
}

export const deleteVideo = async (id) => {
  await dropLocalVideo(id)
  try { const p = await path(id); if (p) await supabase.storage.from('post-videos').remove([p]) } catch { /* ignore */ }
}
