// Lo que hace Alicia en el navegador: pedir el plan y crear cada publicación (quedan como borradores).
import { PLATFORMS, blankDesign } from './formats.js'
import { generateAutoPost } from './autoPost.js'
import { renderToDataURL } from './render.js'
import { generatePostSheetAI, invokeFn } from './social.js'
import { composeCaption, normalizeTags, sheetFromCaption, withContact, CONTACT_LENGTH } from './postSheet.js'
import { videoDraft } from './contentDraft.js'
import { loadVideo, deleteVideo } from './mediaStore.js'
import { extractFrames } from './videoProcess.js'
import { logAI, isLimitMsg } from './aiUsage.js'
import { t, getLang } from './i18n.jsx'

/** Consulta a la función `alicia`. Devuelve { action: 'plan' | 'edit' | 'chat', reply, items, edits }. */
export async function askAlicia(body) {
  const { data, error } = await invokeFn('alicia', { ...body, lang: getLang() }, 120000)
  if (error) {
    let msg = error.message
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error } catch { /* ignore */ }
    logAI('gemini', 'Textos', isLimitMsg(msg) ? 'limit' : 'error')
    throw new Error(msg)
  }
  if (!data?.reply && !data?.items?.length && !data?.edits?.length) throw new Error(data?.error || t('La IA no devolvió texto'))
  logAI('gemini', 'Textos')
  return data
}

const clip = (text, max) => (text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text)
const maxLenOf = (platforms) => Math.min(...platforms.map((p) => PLATFORMS[p].limit))

const base = { contentId: null, subject: '', recipients: '', igMusic: null, status: 'draft' }

/** Publicación de imagen: diseño y texto como en «Crear con IA»; usa la foto de IA solo si aprobó el control de calidad. */
async function createImage({ id, topic, platforms, scheduledAt, withPhoto, onStep }) {
  const r = await generateAutoPost({ text: topic, platforms, withImage: withPhoto, onStep })
  const design = r.options.photo || r.design
  const sheet = sheetFromCaption(r.caption)
  return {
    ...base, id, sheet, caption: clip(composeCaption(sheet), maxLenOf(platforms)), platforms, mediaType: 'photo', video: null,
    format: design.format, design, image: await renderToDataURL(design), scheduledAt, createdAt: Date.now(),
  }
}

/** Medidas, duración y portada de un video, sin abrir el editor. */
function readVideo(file, second) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    let timer
    const end = (out) => {
      clearTimeout(timer); v.onloadedmetadata = v.onseeked = v.onerror = null; v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url)
      if (out) res(out); else rej(new Error(t('Este navegador no pudo leer el video.')))
    }
    timer = setTimeout(() => end(null), 30000)
    v.muted = true; v.playsInline = true; v.preload = 'auto'
    v.onerror = () => end(null)
    v.onloadedmetadata = () => { v.currentTime = Number.isFinite(v.duration) ? Math.min(second, Math.max(0, v.duration - 0.1)) : second }
    v.onseeked = () => {
      if (!v.videoWidth) return end(null)
      const s = Math.min(1, 1080 / Math.max(v.videoWidth, v.videoHeight))
      const c = document.createElement('canvas')
      c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s)
      c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
      return end({ duration: Number.isFinite(v.duration) ? v.duration : 0, width: v.videoWidth, height: v.videoHeight, cover: c.toDataURL('image/jpeg', 0.8), coverTime: v.currentTime })
    }
    v.src = url
  })
}

/** Publicación con un video de Contenido: baja el archivo, saca la portada y la IA escribe la ficha mirándolo. */
async function createVideo({ topic, platforms, scheduledAt, content, onStep }) {
  onStep(t('Descargando el video…'))
  // videoDraft guarda el archivo con el id que él genera: la publicación tiene que usar ese mismo
  const draft = await videoDraft(content)
  const { id } = draft
  try {
    const file = await loadVideo(id)
    if (!file) throw new Error(t('No se encontró el video guardado'))
    onStep(t('Preparando la portada…'))
    const meta = await readVideo(file, draft.video.autoCover)
    onStep(t('La IA está mirando el video…'))
    const frames = await extractFrames(file)
    const maxLen = maxLenOf(platforms)
    const out = await generatePostSheetAI({
      topic, tone: 'equilibrado y pensado para vender: profesional pero cercano, claro y directo', mediaType: 'video',
      networks: platforms.map((p) => PLATFORMS[p].name), maxLen: maxLen - CONTACT_LENGTH,
      maxTags: Math.min(...platforms.map((p) => PLATFORMS[p].maxTags)), frames, image: frames.length ? null : meta.cover,
    })
    const sheet = { title: out.title, description: withContact(out.description), tags: normalizeTags(out.tags), ai: true }
    const video = { ...draft.video, ...meta }
    const design = blankDesign()
    return {
      ...base, id, contentId: content.id, sheet, caption: clip(composeCaption(sheet), maxLen), platforms, mediaType: 'video', video,
      format: design.format, design, image: video.cover, scheduledAt, createdAt: Date.now(),
    }
  } catch (e) {
    await deleteVideo(id) // sin publicación no se guarda el video
    throw e
  }
}

export const createPost = (task) => (task.type === 'video' ? createVideo(task) : createImage(task))
