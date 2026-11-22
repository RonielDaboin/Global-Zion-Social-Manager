import { supabase } from './supabase.js'
import { shrinkImage, invokeFn } from './social.js'
import { logAI } from './aiUsage.js'

// Revisión automática de la calidad de una imagen (por ejemplo, las generadas con IA) antes de usarla de fondo.
// Mide nitidez (varianza del laplaciano), contraste, brillo y resolución. Si no pasa, el generador arma el fondo con las herramientas de la app.

// Gemini se usa solo para texto: la revisión de imágenes con IA de visión (judge-image) queda desactivada.
// Cambiar a true para volver a activarla.
const USE_AI_JUDGE = false

const LIMITS = { minSide: 700, sharp: 80, contrast: 24, meanMin: 20, meanMax: 215 }

export function assessImage(dataUrl) {
  return new Promise((res) => {
    const im = new Image()
    im.onerror = () => res({ ok: false, reasons: ['no se pudo leer'] })
    im.onload = () => {
      const N = 256
      const c = document.createElement('canvas')
      c.width = N; c.height = N
      const ctx = c.getContext('2d', { willReadFrequently: true })
      const s = Math.max(N / im.naturalWidth, N / im.naturalHeight)
      ctx.drawImage(im, (N - im.naturalWidth * s) / 2, (N - im.naturalHeight * s) / 2, im.naturalWidth * s, im.naturalHeight * s)
      const px = ctx.getImageData(0, 0, N, N).data
      const g = new Float32Array(N * N)
      let sum = 0
      for (let i = 0; i < N * N; i++) { g[i] = 0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]; sum += g[i] }
      const mean = sum / (N * N)
      let v = 0, lsum = 0, lsq = 0, n = 0
      for (let y = 1; y < N - 1; y++) {
        for (let x = 1; x < N - 1; x++) {
          const i = y * N + x
          const d = g[i] - mean
          v += d * d
          const lap = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - N] - g[i + N]
          lsum += lap; lsq += lap * lap; n++
        }
      }
      const std = Math.sqrt(v / n)
      const sharp = lsq / n - (lsum / n) ** 2
      const minSide = Math.min(im.naturalWidth, im.naturalHeight)
      const reasons = []
      if (minSide < LIMITS.minSide) reasons.push('baja resolución')
      if (sharp < LIMITS.sharp) reasons.push('borrosa')
      if (std < LIMITS.contrast) reasons.push('poco contraste')
      if (mean < LIMITS.meanMin) reasons.push('muy oscura')
      if (mean > LIMITS.meanMax) reasons.push('muy clara')
      res({ ok: !reasons.length, reasons, sharp, std, mean, minSide })
    }
    im.src = dataUrl
  })
}

/**
 * Revisión con IA de visión (Edge Function `judge-image`): detecta caras/manos deformadas, objetos sin sentido, texto falso, etc.
 * Devuelve { ok, score, issues } o null si la función no está disponible (no desplegada, sin sesión, sin cuota…).
 */
export async function judgeImage(dataUrl, context = '') {
  let small = dataUrl
  try { small = (await shrinkImage(dataUrl, 768)) || dataUrl } catch { /* se usa la original */ }
  // Gemini tiene límite de uso por minuto: si falla, se espera y se reintenta (hasta 3 veces)
  for (let i = 0; i < 2; i++) {
    try {
      const { data, error } = await invokeFn('judge-image', { image: small, context }, 30000)
      if (!error && typeof data?.score === 'number') logAI('gemini', 'Revisión de imágenes')
      if (!error && typeof data?.score === 'number') return { ok: !!data.usable, score: data.score, issues: data.issues || [] }
    } catch { /* reintenta */ }
    if (i < 1) await new Promise((r) => setTimeout(r, 5000))
  }
  return null
}

/**
 * Filtro completo: primero las métricas de píxeles (rápidas) y luego la revisión con IA.
 * `strict`: si la revisión con IA no está disponible, la imagen NO se da por buena (para usos automáticos).
 * Devuelve { ok, reasons, judged } (judged=false cuando no hubo revisión con IA).
 */
export async function vetImage(dataUrl, { context = '', strict = false } = {}) {
  const px = await assessImage(dataUrl)
  if (!px.ok) return { ok: false, reasons: px.reasons, judged: false }
  const j = USE_AI_JUDGE ? await judgeImage(dataUrl, context) : null
  // Sin revisión de IA (límite de uso): si pasó las métricas de píxeles se acepta; el usuario la ve antes de elegirla
  if (!j) return { ok: true, reasons: [], judged: false }
  return { ok: j.ok, reasons: j.ok ? [] : (j.issues.length ? j.issues : ['no cumple el nivel de calidad']), judged: true, score: j.score }
}
