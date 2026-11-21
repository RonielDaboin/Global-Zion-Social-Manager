/**
 * Capa de integración con redes sociales.
 *
 * Conexión y publicación REALES a través de la Edge Function `social` de Supabase
 * (Instagram, Facebook y Gmail). Los tokens nunca llegan al navegador.
 * Las redes que el servidor aún no tiene configuradas funcionan en MODO DEMO (simulado).
 */
import { t, getLang } from './i18n.jsx'
import { loadVideo } from './mediaStore.js'
import { designFormats, formatsFor, getFormat } from './formats.js'
import { renderToDataURL } from './render.js'
import { supabase } from './supabase.js'
import { logAI, isLimitMsg } from './aiUsage.js'

const env = import.meta.env

/** Llama a la Edge Function `social` y devuelve el JSON (lanza Error con el mensaje del servidor). */
export async function socialCall(action, body = {}) {
  const { data, error } = await supabase.functions.invoke('social', { body: { action, ...body } })
  if (error) {
    let msg = error.message
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error } catch { /* ignore */ }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data
}

/** { configured: {instagram, facebook, email}, accounts: [...] } o null si el servidor no responde. */
export const fetchSocial = () => socialCall('list').catch(() => null)

export async function startRealOAuth(platform) {
  const { url, state } = await socialCall('auth-url', { platform, redirectUri: window.location.origin + '/' })
  sessionStorage.setItem('gz_oauth_state', state)
  window.location.href = url
}

/** Si volvemos de OAuth con ?code=, lo canjeamos en el servidor. */
export async function handleOAuthCallback() {
  const q = new URLSearchParams(window.location.search)
  const code = q.get('code'), state = q.get('state')
  if (!code || !state) return null
  if (state !== sessionStorage.getItem('gz_oauth_state')) return null
  sessionStorage.removeItem('gz_oauth_state')
  window.history.replaceState({}, '', '/' + window.location.hash)
  const data = await socialCall('callback', { code, state, redirectUri: window.location.origin + '/' })
  return { real: true, ...data }
}

/** Sube la imagen/video a Storage (bucket público) para que Instagram/Facebook puedan descargarlos. */
async function uploadMedia(post, kind, src = post.image, tag = '', sink = null) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error(t('Inicia sesión para continuar'))
  let blob, ext
  if (kind === 'video') {
    blob = await loadVideo(post.id)
    if (!blob) throw new Error(t('No se encontró el video guardado'))
    ext = (blob.type.split('/')[1] || 'mp4').replace('quicktime', 'mov')
  } else {
    blob = await (await fetch(src)).blob()
    ext = blob.type === 'image/png' ? 'png' : 'jpg'
  }
  const path = `${session.user.id}/${post.id}${tag}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('post-media').upload(path, blob, { contentType: blob.type, upsert: true })
  if (error) throw new Error(error.message)
  sink?.push(path)
  return supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl
}

export async function publishPost(post, accounts) {
  const results = {}
  const media = {} // se sube una sola vez por publicación (video) o por formato (imagen)
  const isVideo = post.mediaType === 'video'
  const videoPaths = [] // copias temporales del video en Storage: se borran al terminar para no llenar el almacenamiento
  const fmts = isVideo || !post.design ? [post.format] : designFormats(post.design)
  const imageUrl = async (fid) => {
    if (media[fid]) return media[fid]
    // la imagen guardada corresponde al formato visible; los demás se renderizan desde el mismo diseño
    const src = fid === post.format || !post.design ? post.image : await renderToDataURL({ ...post.design, format: fid })
    return (media[fid] = await uploadMedia(post, 'image', src, '-' + fid))
  }
  for (const p of post.platforms) {
    const acc = accounts[p]
    if (!acc) { results[p] = { ok: false, error: t('Cuenta no conectada') }; continue }
    if (!acc.real) {
      await new Promise((r) => setTimeout(r, 700))
      results[p] = { ok: true, demo: true }
      continue
    }
    const targets = isVideo ? [post.format] : formatsFor(p, fmts)
    const done = [...(post.results?.[p]?.done || [])] // formatos ya publicados en un intento anterior: no se repiten
    const errors = []
    let main = null
    for (const fid of targets) {
      if (done.includes(fid)) continue
      try {
        const m = {}
        if (isVideo) m.videoUrl = media.video ||= await uploadMedia(post, 'video', undefined, '', videoPaths)
        else if (post.image) m.imageUrl = await imageUrl(fid)
        const r = await socialCall('publish', {
          platform: p, caption: post.caption, subject: post.subject, recipients: post.recipients,
          mediaType: post.mediaType || 'photo', format: fid, ...m,
        })
        done.push(fid)
        if (!main || fid !== 'ig-story') main = { permalink: r?.result?.permalink, mediaId: r?.result?.id } // el enlace/ID que se guarda es el del post, no el de la story
      } catch (e) {
        errors.push(targets.length > 1 ? `${getFormat(fid).short}: ${e.message}` : e.message)
      }
    }
    results[p] = errors.length ? { ok: false, error: errors.join(' · '), done, ...main } : { ok: true, done, ...main }
  }
  // Facebook descarga el video de forma asíncrona: si va en la publicación, se deja para la limpieza posterior
  if (videoPaths.length && !post.platforms.includes('facebook')) await supabase.storage.from('post-media').remove(videoPaths).catch(() => {})
  return results
}

const VIDEO_EXT = /\.(mp4|mov|webm|m4v)$/i
/** Borra de Storage los videos temporales de publicación con más de 1 h (ya los descargaron las redes). */
export async function cleanupPostMedia() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const uid = session.user.id
    const { data } = await supabase.storage.from('post-media').list(uid, { limit: 1000 })
    const old = (data || []).filter((f) => VIDEO_EXT.test(f.name) && Date.now() - new Date(f.created_at || 0).getTime() > 3600000)
    if (old.length) await supabase.storage.from('post-media').remove(old.map((f) => `${uid}/${f.name}`))
  } catch { /* ignore */ }
}

// ---- Asistente de texto (plantillas locales, sin IA externa) ----
const TONES = {
  es: {
    inspirador: {
      open: ['✨ Hoy es un buen día para empezar.', '🔥 Lo que haces hoy construye tu mañana.', '🌟 Cree en el proceso.'],
      close: ['¿Qué paso darás hoy? Cuéntanos 👇', 'Guárdalo para recordarlo 📌', 'Comparte esto con alguien que lo necesite 💛'],
    },
    profesional: {
      open: ['📊 Información clave sobre {t}.', '💼 Lo que necesitas saber de {t}.', '✅ {t}: puntos esenciales.'],
      close: ['Más información en nuestro perfil.', 'Escríbenos por mensaje directo.', 'Síguenos para más contenido de valor.'],
    },
    divertido: {
      open: ['😎 Plot twist: {t} acaba de llegar.', '🎉 Atención, atención… ¡hablemos de {t}!', '🤩 Si te gusta {t}, esto es para ti.'],
      close: ['Etiqueta a tu mejor amigo 👯', 'Comenta con un emoji si estás de acuerdo 🙌', '¿Team sí o team no? 👇'],
    },
    promocional: {
      open: ['🚨 ¡Novedad! {t} ya disponible.', '🎁 Oferta especial: {t}.', '⏰ Por tiempo limitado: {t}.'],
      close: ['Haz clic en el link de la bio 🔗', 'Escríbenos para reservar tu lugar 📩', 'No te lo pierdas, ¡corre! 🏃'],
    },
  },
  en: {
    inspirador: {
      open: ['✨ Today is a great day to start.', '🔥 What you do today builds your tomorrow.', '🌟 Trust the process.'],
      close: ['What step will you take today? Tell us 👇', 'Save it as a reminder 📌', 'Share this with someone who needs it 💛'],
    },
    profesional: {
      open: ['📊 Key insights about {t}.', '💼 What you need to know about {t}.', '✅ {t}: the essentials.'],
      close: ['More information on our profile.', 'Send us a direct message.', 'Follow us for more valuable content.'],
    },
    divertido: {
      open: ['😎 Plot twist: {t} just arrived.', '🎉 Attention, attention… let’s talk about {t}!', '🤩 If you like {t}, this one is for you.'],
      close: ['Tag your best friend 👯', 'Comment with an emoji if you agree 🙌', 'Team yes or team no? 👇'],
    },
    promocional: {
      open: ['🚨 New! {t} is now available.', '🎁 Special offer: {t}.', '⏰ Limited time: {t}.'],
      close: ['Tap the link in our bio 🔗', 'Message us to book your spot 📩', 'Don’t miss out, hurry! 🏃'],
    },
  },
}
export const TONE_LIST = ['inspirador', 'profesional', 'divertido', 'promocional']
const pick = (a) => a[Math.floor(Math.random() * a.length)]

export function generateCaption(topic, tone) {
  const T = (TONES[getLang()] || TONES.es)[tone]
  const tp = topic.trim() || t('nuestro contenido')
  return `${pick(T.open).replaceAll('{t}', tp)}\n\n${t('{topic} es parte de lo que nos mueve en GLOBAL ZION.', { topic: tp.charAt(0).toUpperCase() + tp.slice(1) })}\n\n${pick(T.close)}`
}

/** Reduce una imagen (dataURL) para enviarla a Gemini sin gastar ancho de banda. */
export function shrinkImage(dataUrl, max = 768) {
  return new Promise((res) => {
    const im = new Image()
    im.onload = () => {
      const s = Math.min(1, max / Math.max(im.width, im.height))
      const c = document.createElement('canvas')
      c.width = Math.round(im.width * s); c.height = Math.round(im.height * s)
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height)
      res(c.toDataURL('image/jpeg', 0.8))
    }
    im.onerror = () => res(null)
    im.src = dataUrl
  })
}

/** Genera el texto con Gemini a través de la Edge Function `generate-caption` (la API key nunca está en el navegador). */
export async function generateCaptionAI({ topic, tone, networks, maxLen, maxTags, mediaType, image, frames }) {
  const { data, error } = await supabase.functions.invoke('generate-caption', {
    body: { topic, tone, networks, maxLen, maxTags, mediaType, image, frames, lang: getLang() },
  })
  if (error) {
    let msg = error.message
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error } catch { /* ignore */ }
    logAI('gemini', 'Textos', isLimitMsg(msg) ? 'limit' : 'error')
    throw new Error(msg)
  }
  if (!data?.caption) throw new Error(data?.error || t('La IA no devolvió texto'))
  logAI('gemini', 'Textos')
  return data.caption
}

/** Escribe los textos del diseño (uno por capa activa, en orden) con Gemini vía `generate-texts`. */
export async function generateLayerTextsAI({ layers, topic }) {
  const { data, error } = await supabase.functions.invoke('generate-texts', {
    body: { layers: layers.map((l) => ({ text: l.text, size: l.size, y: l.y })), topic, lang: getLang() },
  })
  if (error) {
    let msg = error.message
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error } catch { /* ignore */ }
    logAI('gemini', 'Textos', isLimitMsg(msg) ? 'limit' : 'error')
    throw new Error(msg)
  }
  if (!Array.isArray(data?.texts) || !data.texts.length) throw new Error(data?.error || t('La IA no devolvió texto'))
  logAI('gemini', 'Textos')
  return data.texts
}

/** Genera o edita una imagen con Gemini vía la Edge Function `generate-image`. Devuelve un dataURL. */
export async function generateImageAI({ prompt, aspectRatio, image }) {
  const { data, error } = await supabase.functions.invoke('generate-image', { body: { prompt, aspectRatio, image } })
  if (error) {
    let msg = error.message
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error } catch { /* ignore */ }
    throw new Error(msg)
  }
  if (!data?.image) throw new Error(data?.error || t('La IA no devolvió una imagen'))
  logAI(/^(cloudflare|pollinations)$/.test(data.model) ? data.model : 'gemini', 'Imágenes')
  // El generador gratuito (Pollinations) estampa su marca en la esquina inferior derecha: se recorta la franja de abajo
  return data.model === 'pollinations' ? cropWatermark(data.image) : data.image
}

/** Quita la franja inferior (donde va la marca de agua) y reescala al tamaño original, centrando el encuadre. */
function cropWatermark(dataUrl, cut = 0.09) {
  return new Promise((res) => {
    const im = new Image()
    im.onload = () => {
      const W = im.naturalWidth, H = im.naturalHeight
      const sw = W * (1 - cut), sh = H * (1 - cut)
      const c = document.createElement('canvas')
      c.width = W; c.height = H
      c.getContext('2d').drawImage(im, (W - sw) / 2, 0, sw, sh, 0, 0, W, H)
      res(c.toDataURL('image/jpeg', 0.92))
    }
    im.onerror = () => res(dataUrl)
    im.src = dataUrl
  })
}

export function suggestHashtags(topic) {
  const words = topic.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter((w) => w.length > 3)
  const base = ['globalzion', 'contenido', 'marketingdigital', 'redessociales', 'emprendimiento', 'viral', 'fyp', 'reels']
  return [...new Set([...words, ...base])].slice(0, 12).map((w) => '#' + w)
}

// ---- Google Identity Services (inicio de sesión con Google) ----
export const GOOGLE_CLIENT_ID = env.VITE_GOOGLE_CLIENT_ID || ''

export function decodeJwt(token) {
  const b = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(decodeURIComponent(escape(atob(b))))
}

let gsiPromise
export function loadGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  gsiPromise ||= new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => res(window.google)
    s.onerror = () => rej(new Error('No se pudo cargar Google'))
    document.head.appendChild(s)
  })
  return gsiPromise
}
