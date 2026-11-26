// Alertas en el teléfono y el PC con notificaciones push (Web Push, gratis).
// La función `push` de Supabase guarda cada dispositivo suscrito y les envía el aviso, aunque la app esté cerrada.
import { supabase } from './supabase.js'
import { t, getLang } from './i18n.jsx'

const OFF_KEY = 'gz-push-off' // la persona las desactivó en este dispositivo

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const installed = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true
const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

async function call(action, body = {}) {
  const { data, error } = await supabase.functions.invoke('push', { body: { action, ...body } })
  if (error) {
    let msg = error.message
    try { const j = await error.context?.json?.(); if (j?.error) msg = j.error } catch { /* ignore */ }
    throw new Error(msg)
  }
  return data
}

const registration = async () => {
  await navigator.serviceWorker.register('/sw.js')
  return navigator.serviceWorker.ready
}

const keyBytes = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0))

/** 'on' | 'off' | 'blocked' | 'ios-install' | 'unsupported' */
export async function pushState() {
  if (isIOS() && !installed()) return 'ios-install' // iPhone solo avisa desde la app añadida a la pantalla de inicio
  if (!supported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission !== 'granted') return 'off'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    return (await reg?.pushManager.getSubscription()) ? 'on' : 'off'
  } catch { return 'off' }
}

async function subscribe() {
  const reg = await registration()
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    const { publicKey } = await call('key')
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) })
  }
  await call('subscribe', { subscription: sub.toJSON(), lang: getLang() })
}

export async function enablePush() {
  // El permiso se pide lo primero, dentro del mismo toque (iPhone lo exige)
  if ((await Notification.requestPermission()) !== 'granted') throw new Error(t('Las notificaciones están bloqueadas. Permítelas en los ajustes del navegador o del teléfono para este sitio.'))
  await subscribe()
  try { localStorage.removeItem(OFF_KEY) } catch { /* ignore */ }
}

export async function disablePush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) { await call('unsubscribe', { endpoint: sub.endpoint }); await sub.unsubscribe() }
  try { localStorage.setItem(OFF_KEY, '1') } catch { /* ignore */ }
}

/** Al abrir la app: renueva la suscripción de este dispositivo (el navegador puede cambiarla, y el idioma también). */
export async function syncPush() {
  try {
    if (localStorage.getItem(OFF_KEY) || !supported() || Notification.permission !== 'granted') return
    await subscribe()
  } catch { /* se reintenta la próxima vez */ }
}

export const testPush = () => call('send', { event: 'test' })

/** Avisa a todos los dispositivos suscritos. Nunca interrumpe la publicación si falla. */
export function sendAlert(event, post, results) {
  const failed = Object.entries(results || {}).filter(([, r]) => !r.ok)
  call('send', {
    event,
    postId: post.id,
    caption: String(post.sheet?.title || post.caption || '').slice(0, 120),
    platforms: post.platforms || [],
    errors: failed.map(([k, r]) => `${k}: ${r.error}`).join(' · ').slice(0, 300),
  }).catch(() => {})
}
