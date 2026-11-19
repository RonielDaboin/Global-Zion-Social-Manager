/**
 * Capa de integración con redes sociales.
 *
 * MODO DEMO (por defecto): la autorización y la publicación se simulan localmente.
 * MODO REAL: define VITE_INSTAGRAM_CLIENT_ID / VITE_TIKTOK_CLIENT_KEY / VITE_API_BASE en .env.
 *  - connect() redirige al diálogo OAuth oficial.
 *  - Tu backend (VITE_API_BASE) debe intercambiar el `code` por un token (el client secret
 *    NUNCA debe estar en el navegador) y exponer POST /publish. Ver README.md.
 */
import { t, getLang } from './i18n.jsx'

const env = import.meta.env

export const OAUTH = {
  instagram: {
    clientId: env.VITE_INSTAGRAM_CLIENT_ID,
    authUrl: 'https://www.instagram.com/oauth/authorize',
    scope: 'instagram_business_basic,instagram_business_content_publish',
  },
  tiktok: {
    clientId: env.VITE_TIKTOK_CLIENT_KEY,
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    scope: 'user.info.basic,video.publish,video.upload',
  },
  facebook: {
    clientId: env.VITE_FACEBOOK_APP_ID,
    authUrl: 'https://www.facebook.com/v19.0/dialog/oauth',
    scope: 'pages_show_list,pages_manage_posts,pages_read_engagement',
  },
  twitter: {
    clientId: env.VITE_TWITTER_CLIENT_ID,
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    scope: 'tweet.read tweet.write users.read offline.access',
  },
  // WhatsApp (Cloud API / Business) y correo (Gmail API, Microsoft Graph, SMTP) no usan OAuth en el navegador:
  // se configuran en el backend (VITE_API_BASE). Hasta entonces funcionan en modo demo.
}

export const API_BASE = env.VITE_API_BASE || ''
export const isRealMode = (platform) => Boolean(OAUTH[platform]?.clientId && API_BASE)

export function startRealOAuth(platform) {
  const cfg = OAUTH[platform]
  const redirect = window.location.origin + '/'
  const state = platform + ':' + Math.random().toString(36).slice(2)
  sessionStorage.setItem('gz_oauth_state', state)
  const base = { scope: cfg.scope, response_type: 'code', redirect_uri: redirect, state }
  let params
  if (platform === 'tiktok') params = { client_key: cfg.clientId, ...base }
  else if (platform === 'twitter') {
    const verifier = Array.from({ length: 3 }, () => Math.random().toString(36).slice(2)).join('')
    sessionStorage.setItem('gz_oauth_verifier', verifier)
    params = { client_id: cfg.clientId, ...base, code_challenge: verifier, code_challenge_method: 'plain' }
  } else params = { client_id: cfg.clientId, ...base }
  const p = new URLSearchParams(params)
  window.location.href = `${cfg.authUrl}?${p}`
}

/** Si volvemos de OAuth con ?code=, lo canjeamos en el backend. */
export async function handleOAuthCallback() {
  const q = new URLSearchParams(window.location.search)
  const code = q.get('code'), state = q.get('state')
  if (!code || !state) return null
  if (state !== sessionStorage.getItem('gz_oauth_state')) return null
  const platform = state.split(':')[0]
  window.history.replaceState({}, '', '/')
  const r = await fetch(`${API_BASE}/auth/${platform}/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri: window.location.origin + '/', codeVerifier: sessionStorage.getItem('gz_oauth_verifier') || undefined }),
  })
  if (!r.ok) throw new Error(t('No se pudo completar la autorización'))
  const data = await r.json() // { username, name, avatar, accountId }
  return { platform, ...data }
}

export async function publishPost(post, accounts) {
  const targets = post.platforms
  const results = {}
  for (const p of targets) {
    const acc = accounts[p]
    if (!acc) { results[p] = { ok: false, error: t('Cuenta no conectada') }; continue }
    if (acc.demo || !API_BASE) {
      await new Promise((r) => setTimeout(r, 700))
      results[p] = { ok: true, demo: true }
    } else {
      try {
        const r = await fetch(`${API_BASE}/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform: p, accountId: acc.accountId, caption: post.caption, image: post.image, subject: post.subject, recipients: post.recipients }),
        })
        results[p] = r.ok ? { ok: true } : { ok: false, error: 'Error ' + r.status }
      } catch (e) {
        results[p] = { ok: false, error: e.message }
      }
    }
  }
  return results
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
