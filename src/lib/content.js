// Biblioteca de contenido: los datos están en la tabla `content_items` y cada archivo en uno de dos almacenamientos
// privados: Backblaze B2 (función `b2-storage`, preferido para lo nuevo) o el bucket `content` de Supabase.
// Un archivo se conserva hasta que se publica; desde ese momento tiene CONTENT_DAYS días de vigencia y luego se borra
// (salvo que el borrado automático esté apagado).
import { supabase } from './supabase.js'
import { t } from './i18n.jsx'
import { workspaceId } from './workspace.js'

export const CONTENT_DAYS = 30
const COVER_SECOND = 3 // segundo del video que se usa como portada
export const CONTENT_MAX_MB = 50 // máximo por archivo del plan gratuito de Supabase
export const STORAGE_LIMIT = 1024 * 1048576 // 1 GB del plan gratuito, compartido por todo el proyecto (cambiar si se sube de plan)
export const CONTENT_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm'
const BUCKET = 'content'
const TABLE = 'content_items'

/** Fecha en que se borrará solo, o null si no corresponde (sin publicar o con el borrado automático apagado). */
export const expiresAt = (item, policy) => (policy?.autoDelete && item.publishedAt ? Math.max(item.publishedAt, policy.since || 0) + CONTENT_DAYS * 86400000 : null)
export const isExpired = (item, policy, now = Date.now()) => { const at = expiresAt(item, policy); return at !== null && at <= now }
export const daysLeft = (item, policy, now = Date.now()) => { const at = expiresAt(item, policy); return at === null ? null : Math.max(0, Math.ceil((at - now) / 86400000)) }

/** Preferencia de borrado automático. Si no se puede leer se considera apagado: ante la duda no se borra nada. */
export async function fetchPolicy() {
  const { data, error } = await supabase.from('workspace_settings').select('content_autodelete,autodelete_since').maybeSingle()
  if (error) return { autoDelete: false, since: null, unknown: true }
  return { autoDelete: data ? data.content_autodelete : true, since: data?.autodelete_since ? Date.parse(data.autodelete_since) : null }
}

export async function setAutoDelete(on) {
  const ws = await workspaceId()
  if (!ws) throw new Error(t('Inicia sesión para continuar'))
  const since = on ? Date.now() : null // al reactivarlo, lo ya publicado vuelve a tener la vigencia completa
  const { error } = await supabase.from('workspace_settings').upsert({ user_id: ws, content_autodelete: on, autodelete_since: since ? new Date(since).toISOString() : null })
  if (error) throw new Error(error.message)
  return { autoDelete: on, since }
}

const toItem = (r) => ({
  id: r.id, name: r.name, mime: r.mime, size: Number(r.size), path: r.path, thumb: r.thumb,
  isVideo: r.mime.startsWith('video/'), storage: r.storage || 'supabase',
  createdAt: Date.parse(r.created_at), publishedAt: r.published_at ? Date.parse(r.published_at) : null,
})

const fail = (error) => {
  if (['42P01', 'PGRST205'].includes(error.code) || /bucket not found/i.test(error.message)) {
    throw new Error(t('La biblioteca de contenido todavía no está activada en el servidor.'))
  }
  throw new Error(error.message)
}

/** Bytes ocupados en todo el proyecto, o null si no se pudo medir. */
export async function fetchStorageUsed() {
  const { data, error } = await supabase.rpc('storage_used_bytes')
  return error || data == null ? null : Number(data)
}

// ---- Backblaze B2 ----
async function b2(action, body = {}) {
  const { data, error } = await supabase.functions.invoke('b2-storage', { body: { action, ...body } })
  if (error) {
    let msg = error.message
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error } catch { /* ignore */ }
    throw new Error(msg)
  }
  return data
}

/** { configured, used, limit, stop } de Backblaze, o null si no se pudo consultar. */
export const fetchB2Status = () => b2('status').catch(() => null)

/** Sube el archivo a Backblaze. Devuelve false si no está configurado o ya no cabe (entonces va a Supabase). */
async function uploadToB2(path, file) {
  const status = await fetchB2Status()
  if (!status?.configured || status.used + file.size > status.stop) return false
  const { url, full } = await b2('upload-url', { path, mime: file.type, size: file.size })
  if (full) return false
  // Se envían los bytes: Safari en iPhone puede subir vacío un archivo enviado como Blob
  const body = await file.arrayBuffer()
  const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': file.type }, body }).catch(() => null)
  if (!r?.ok) throw new Error(t('No se pudo subir a Backblaze. Revisa la configuración del almacenamiento e inténtalo de nuevo.'))
  return true
}

const removeFile = async (where, paths) => {
  if (!paths.length) return
  if (where === 'b2') { await b2('delete', { paths }); return }
  const { error } = await supabase.storage.from(BUCKET).remove(paths)
  if (error) fail(error)
}

async function removeItems(items) {
  if (!items.length) return
  // Primero el archivo (es lo que ocupa memoria); si falla, la fila queda y se reintenta en la próxima limpieza
  for (const where of ['supabase', 'b2']) await removeFile(where, items.filter((x) => x.storage === where).map((x) => x.path))
  const { error: e2 } = await supabase.from(TABLE).delete().in('id', items.map((x) => x.id))
  if (e2) fail(e2)
}

export const deleteContent = (item) => removeItems([item])

/** Borrado masivo, por lotes de 100. */
export async function deleteContents(items) {
  for (let i = 0; i < items.length; i += 100) await removeItems(items.slice(i, i + 100))
}

/** { items, policy }. Con el borrado automático encendido, lo vencido se borra aquí mismo y no se devuelve. */
export async function fetchContent() {
  const [{ data, error }, policy] = await Promise.all([supabase.from(TABLE).select('*').order('created_at', { ascending: false }), fetchPolicy()])
  if (error) fail(error)
  const all = (data || []).map(toItem)
  await deleteContents(all.filter((x) => isExpired(x, policy))).catch(() => {})
  return { items: all.filter((x) => !isExpired(x, policy)), policy }
}

/** Limpieza al abrir la app (además de la tarea diaria del servidor). */
export const cleanupContent = () => fetchContent().catch(() => {})

/** Marca la fecha de publicación (solo la primera vez: volver a publicar no alarga la vigencia). */
export async function markContentPublished(id, at = Date.now()) {
  const { error } = await supabase.from(TABLE).update({ published_at: new Date(at).toISOString() }).eq('id', id).is('published_at', null)
  if (error) fail(error)
}

const drawScaled = (source, w, h, max, quality) => {
  const s = Math.min(1, max / Math.max(w, h))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s))
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height) // los PNG transparentes no quedan en negro
  ctx.drawImage(source, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', quality)
}

const loadImageBlob = (blob) => new Promise((res, rej) => {
  const url = URL.createObjectURL(blob)
  const im = new Image()
  im.onload = () => { URL.revokeObjectURL(url); res(im) }
  im.onerror = () => { URL.revokeObjectURL(url); rej(new Error(t('No se pudo leer la imagen'))) }
  im.src = url
})

/** Portada de un video (fotograma del segundo COVER_SECOND) desde un enlace; null si el navegador no puede leerlo. */
const videoThumb = (src) => new Promise((res) => {
  const v = document.createElement('video')
  let timer
  const end = (out) => { clearTimeout(timer); v.onloadedmetadata = v.onseeked = v.onerror = null; v.removeAttribute('src'); v.load(); res(out) }
  timer = setTimeout(() => end(null), 20000)
  v.crossOrigin = 'anonymous' // sin esto no se puede copiar el fotograma de un video guardado en la nube
  v.muted = true; v.playsInline = true; v.preload = 'auto'
  // Con los metadatos basta para saltar al fotograma (si el video es más corto, se usa casi el final)
  v.onloadedmetadata = () => { v.currentTime = Number.isFinite(v.duration) ? Math.min(COVER_SECOND, Math.max(0, v.duration - 0.1)) : COVER_SECOND }
  v.onseeked = () => { try { end(v.videoWidth ? drawScaled(v, v.videoWidth, v.videoHeight, 480, 0.72) : null) } catch { end(null) } }
  v.onerror = () => end(null)
  v.src = src
})

const fileThumb = async (file) => {
  const url = URL.createObjectURL(file)
  try { return await videoThumb(url) } finally { URL.revokeObjectURL(url) }
}

/** Crea y guarda la portada de un video que no la tiene (lo lee desde la nube); null si no se pudo. */
export async function createCover(item) {
  const thumb = await videoThumb(await contentUrl(item))
  if (!thumb) return null
  const { error } = await supabase.from(TABLE).update({ thumb }).eq('id', item.id)
  if (error) fail(error)
  return thumb
}

export async function uploadContent(file) {
  if (!CONTENT_ACCEPT.split(',').includes(file.type)) throw new Error(t('Formato no admitido. Usa JPG, PNG, WEBP, GIF, MP4, MOV o WEBM.'))
  if (file.size > CONTENT_MAX_MB * 1048576) throw new Error(t('El archivo supera el máximo de {n} MB.', { n: CONTENT_MAX_MB }))
  const ws = await workspaceId()
  if (!ws) throw new Error(t('Inicia sesión para continuar'))
  let thumb
  if (file.type.startsWith('video/')) thumb = await fileThumb(file)
  else { const im = await loadImageBlob(file); thumb = drawScaled(im, im.naturalWidth, im.naturalHeight, 480, 0.72) }
  const id = crypto.randomUUID()
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || file.type.split('/')[1]).toLowerCase()
  const path = `${ws}/${id}.${ext}`
  const where = (await uploadToB2(path, file)) ? 'b2' : 'supabase'
  if (where === 'supabase') {
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type })
    if (error) fail(error)
  }
  const { data, error: e2 } = await supabase.from(TABLE).insert({ id, user_id: ws, name: file.name, mime: file.type, size: file.size, path, thumb, storage: where }).select().single()
  if (e2) { await removeFile(where, [path]).catch(() => {}); fail(e2) } // sin fila no habría forma de borrarlo después
  return toItem(data)
}

/** Enlace temporal (1 h) para ver el archivo; con `download` el navegador lo descarga. */
export async function contentUrl(item, download = false) {
  if (item.storage === 'b2') return (await b2('download-url', { path: item.path, name: download ? item.name : undefined })).url
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(item.path, 3600, download ? { download: item.name } : undefined)
  if (error) fail(error)
  return data.signedUrl
}

export async function downloadContentBlob(item) {
  if (item.storage === 'b2') {
    const r = await fetch(await contentUrl(item)).catch(() => null)
    if (!r?.ok) throw new Error(t('No se pudo descargar el archivo de Backblaze.'))
    return new Blob([await r.arrayBuffer()], { type: item.mime })
  }
  const { data, error } = await supabase.storage.from(BUCKET).download(item.path)
  if (error) fail(error)
  return data
}

/** Imagen del contenido lista para usar como fondo de un diseño (máx. 1920 px) y sus medidas originales. */
export async function contentImage(item) {
  const im = await loadImageBlob(await downloadContentBlob(item))
  return { dataUrl: drawScaled(im, im.naturalWidth, im.naturalHeight, 1920, 0.9), width: im.naturalWidth, height: im.naturalHeight }
}
