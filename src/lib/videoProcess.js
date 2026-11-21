// Recorte y filtros de video 100 % en el navegador.
// Vía principal: WebCodecs (mediabunny) → decodifica, aplica ctx.filter y codifica H.264/AAC en MP4, más rápido que en tiempo real.
// Respaldo: reproduce el tramo sobre un canvas y lo regraba con MediaRecorder (tarda lo que dura el tramo).
import { t } from './i18n.jsx'
import { drawTextLayers, ensureTextFonts, hasText } from './videoText.js'

/** Saca `n` fotogramas repartidos por el video (JPEG reducido) para que la IA «vea» el video. Todo en el navegador, sin costo. */
export async function extractFrames(file, n = 6, max = 512) {
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url
  try {
    await once(v, 'loadedmetadata')
    const d = isFinite(v.duration) ? v.duration : 0
    if (!d || !v.videoWidth) return []
    const k = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * k); c.height = Math.round(v.videoHeight * k)
    const ctx = c.getContext('2d')
    const out = []
    for (let i = 0; i < n; i++) {
      v.currentTime = Math.min(d - 0.05, (d * (i + 0.5)) / n) // centro de cada tramo
      await once(v, 'seeked')
      ctx.drawImage(v, 0, 0, c.width, c.height)
      out.push(c.toDataURL('image/jpeg', 0.7))
    }
    return out
  } catch { return [] } finally { URL.revokeObjectURL(url) }
}

export const FX0 = { brightness: 100, contrast: 100, saturate: 100, hue: 0, sepia: 0, gray: 0, blur: 0, sharp: 0, vignette: 0 }

export const PRESETS = [
  ['Original', {}],
  ['Vívido', { contrast: 112, saturate: 130 }],
  ['Cálido', { sepia: 25, saturate: 115, brightness: 104, hue: -8 }],
  ['Frío', { hue: 12, saturate: 105, contrast: 106, brightness: 98 }],
  ['Vintage', { sepia: 45, contrast: 92, saturate: 85, brightness: 105 }],
  ['Cine', { contrast: 122, saturate: 88, brightness: 94 }],
  ['Desvanecido', { contrast: 85, brightness: 112, saturate: 80 }],
  ['Blanco y negro', { gray: 100, contrast: 112 }],
  ['Estudio', { contrast: 108, saturate: 108, brightness: 103, vignette: 12, sharp: 15 }],
  ['Profesional', { contrast: 114, saturate: 96, brightness: 98, vignette: 18, sharp: 25 }],
  ['Retrato', { brightness: 106, contrast: 96, saturate: 104, sepia: 8, vignette: 15 }],
  ['Producto', { brightness: 108, contrast: 110, saturate: 112, sharp: 25 }],
  ['Comida', { saturate: 135, contrast: 108, brightness: 103, sepia: 10 }],
  ['Paisaje', { saturate: 125, contrast: 112, brightness: 100, hue: -4, sharp: 20 }],
  ['Noche', { brightness: 88, contrast: 120, saturate: 95, hue: 10, vignette: 35 }],
  ['Dramático', { contrast: 135, saturate: 90, brightness: 92, vignette: 40 }],
  ['Suave', { contrast: 90, brightness: 108, saturate: 95, blur: 1 }],
  ['Brillante', { brightness: 115, contrast: 105, saturate: 110 }],
  ['HDR', { contrast: 128, saturate: 140, brightness: 100, sharp: 30 }],
  ['Mate', { contrast: 88, brightness: 104, saturate: 82, sepia: 6 }],
  ['Película', { sepia: 20, contrast: 110, saturate: 92, brightness: 98, vignette: 25 }],
  ['Retro 70s', { sepia: 50, saturate: 130, hue: -12, contrast: 100, brightness: 104, vignette: 20 }],
  ['Polaroid', { sepia: 18, contrast: 92, brightness: 110, saturate: 110, hue: -6, vignette: 22 }],
  ['Noir', { gray: 100, contrast: 150, brightness: 92, vignette: 45 }],
  ['Plata', { gray: 100, contrast: 105, brightness: 108 }],
  ['Crudo', { contrast: 104, saturate: 92, brightness: 100 }],
  ['Pastel', { saturate: 75, brightness: 112, contrast: 88 }],
  ['Atardecer', { sepia: 30, saturate: 140, hue: -14, brightness: 104, contrast: 106 }],
  ['Amanecer', { sepia: 15, saturate: 115, hue: -6, brightness: 110, contrast: 96 }],
  ['Invierno', { hue: 18, saturate: 90, brightness: 106, contrast: 102 }],
  ['Verano', { saturate: 130, brightness: 108, contrast: 104, hue: -5, sepia: 8 }],
  ['Otoño', { sepia: 35, saturate: 125, hue: -18, contrast: 104, brightness: 98 }],
  ['Neón', { saturate: 180, contrast: 120, hue: 20, brightness: 96, vignette: 20 }],
  ['Cyberpunk', { hue: -40, saturate: 160, contrast: 125, brightness: 92, vignette: 30 }],
  ['Documental', { saturate: 80, contrast: 112, brightness: 98, sepia: 8, vignette: 15, sharp: 15 }],
  ['Sueño', { blur: 2, brightness: 112, saturate: 110, contrast: 92 }],
  ['Sepia clásico', { sepia: 85, contrast: 100, brightness: 100 }],
  ['Contraste alto', { contrast: 155, saturate: 105, brightness: 98 }],
]

/** Viñeta: oscurece los bordes. Misma fórmula en vista previa (CSS) y exportación (canvas). */
export const vignetteCss = (amount) => `radial-gradient(circle farthest-corner at center, transparent 40%, rgba(0,0,0,${(amount / 100) * 0.85}) 100%)`
export const drawVignette = (ctx, w, h, amount) => {
  if (!amount) return
  const r = Math.hypot(w, h) / 2
  const g = ctx.createRadialGradient(w / 2, h / 2, r * 0.4, w / 2, h / 2, r)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${(amount / 100) * 0.85})`)
  ctx.save()
  ctx.filter = 'none'
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

export const fxSame = (a, b) => Object.keys(FX0).every((k) => a[k] === b[k])
export const fxIsDefault = (fx) => Object.keys(FX0).every((k) => fx[k] === FX0[k])

/** Cadena de filtro CSS: sirve igual para la vista previa (style.filter) y para el canvas (ctx.filter). */
/** Nitidez: CSS no la trae, así que se usa un filtro SVG (convolución 3×3) referenciable desde CSS y desde ctx.filter. */
const SHARP_ID = 'gz-vsharp'
const ensureSharp = (amount) => {
  if (typeof document === 'undefined') return
  let svg = document.getElementById(SHARP_ID + '-svg')
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.id = SHARP_ID + '-svg'
    svg.setAttribute('width', '0'); svg.setAttribute('height', '0')
    svg.style.cssText = 'position:absolute;width:0;height:0;pointer-events:none'
    svg.innerHTML = `<filter id="${SHARP_ID}" color-interpolation-filters="sRGB"><feConvolveMatrix order="3" preserveAlpha="true" edgeMode="duplicate"/></filter>`
    document.body.appendChild(svg)
  }
  const k = (amount / 100) * 1.2
  svg.querySelector('feConvolveMatrix').setAttribute('kernelMatrix', `0 ${-k} 0 ${-k} ${1 + 4 * k} ${-k} 0 ${-k} 0`)
}

export const fxCss = (fx) => {
  const f = []
  if (fx.brightness !== 100) f.push(`brightness(${fx.brightness}%)`)
  if (fx.contrast !== 100) f.push(`contrast(${fx.contrast}%)`)
  if (fx.saturate !== 100) f.push(`saturate(${fx.saturate}%)`)
  if (fx.hue) f.push(`hue-rotate(${fx.hue}deg)`)
  if (fx.sepia) f.push(`sepia(${fx.sepia}%)`)
  if (fx.gray) f.push(`grayscale(${fx.gray}%)`)
  if (fx.blur) f.push(`blur(${fx.blur}px)`)
  if (fx.sharp) { ensureSharp(fx.sharp); f.push(`url(#${SHARP_ID})`) }
  return f.length ? f.join(' ') : 'none'
}

const MIMES = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
const pickMime = () => (typeof MediaRecorder === 'undefined' ? null : MIMES.find((m) => MediaRecorder.isTypeSupported(m)) || null)

const hasWebCodecs = () => typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined'

export const canProcessVideo = () =>
  hasWebCodecs() || (!!pickMime() && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype)

export const canFilterVideo = () => typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype

const once = (el, ev) => new Promise((res, rej) => {
  el.addEventListener(ev, res, { once: true })
  el.addEventListener('error', () => rej(new Error(t('No se pudo leer el video.'))), { once: true })
})

/**
 * @param {File|Blob} file
 * @param {{start:number,end:number,fx:object,mute:boolean,onProgress?:(p:number)=>void,ctl:{cancel:boolean}}} o
 * @returns {Promise<{blob:Blob,duration:number}>}
 */
async function processRealtime(file, { start, end, fx, mute, texts, onProgress, ctl }) {
  const mime = pickMime()
  if (!mime) throw new Error(t('Este navegador no puede editar videos. Prueba con Chrome o Edge.'))
  const url = URL.createObjectURL(file)
  const v = document.createElement('video')
  v.playsInline = true
  v.preload = 'auto'
  v.src = url
  let ac, stream, raf
  try {
    await once(v, 'loadedmetadata')
    const k = Math.min(1, 1080 / Math.max(v.videoWidth, v.videoHeight))
    const w = Math.max(2, Math.round((v.videoWidth * k) / 2) * 2)
    const h = Math.max(2, Math.round((v.videoHeight * k) / 2) * 2)
    const canvas = document.createElement('canvas')
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.filter = fxCss(fx)

    stream = canvas.captureStream(30)
    if (!mute) {
      try {
        ac = new AudioContext()
        const dest = ac.createMediaStreamDestination()
        ac.createMediaElementSource(v).connect(dest) // no se conecta a los altavoces: grabación silenciosa
        dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr))
        await ac.resume()
      } catch { /* sin audio */ }
    }

    v.currentTime = start
    await once(v, 'seeked')
    ctx.drawImage(v, 0, 0, w, h)
    drawVignette(ctx, w, h, fx.vignette)
    drawTextLayers(ctx, w, h, texts, start) // primer fotograma antes de grabar: evita parpadeo negro

    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6, audioBitsPerSecond: 128e3 })
    const chunks = []
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
    const stopped = new Promise((res) => { rec.onstop = res })

    let done = false
    const finish = () => {
      if (done) return
      done = true
      v.pause()
      if (rec.state !== 'inactive') rec.stop()
    }
    const frame = () => {
      ctx.drawImage(v, 0, 0, w, h)
      drawVignette(ctx, w, h, fx.vignette)
      drawTextLayers(ctx, w, h, texts, v.currentTime)
      const cur = v.currentTime
      onProgress?.(Math.max(0, Math.min(1, (cur - start) / (end - start))))
      if (ctl.cancel || cur >= end - 0.03 || v.ended) return finish()
      next()
    }
    const next = () => { if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(frame); else raf = requestAnimationFrame(frame) }
    v.addEventListener('ended', finish)

    rec.start(500)
    await v.play()
    next()
    await stopped
    if (ctl.cancel) throw new Error('cancel')
    const type = mime.split(';')[0]
    return { blob: new Blob(chunks, { type }), duration: end - start }
  } finally {
    cancelAnimationFrame(raf)
    v.pause()
    stream?.getTracks().forEach((tr) => tr.stop())
    ac?.close().catch(() => {})
    URL.revokeObjectURL(url)
  }
}

async function processWebCodecs(file, { start, end, fx, mute, texts, onProgress, ctl }) {
  await ensureTextFonts(texts)
  const mb = await import('mediabunny')
  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS })
  const output = new mb.Output({ format: new mb.Mp4OutputFormat(), target: new mb.BufferTarget() })
  const filter = fxCss(fx)
  const useFx = filter !== 'none' || fx.vignette > 0 || hasText(texts)
  const conv = await mb.Conversion.init({
    input, output,
    trim: { start, end },
    video: async (track) => {
      const k = Math.min(1, 1080 / Math.max(track.displayWidth, track.displayHeight))
      const w = Math.max(2, Math.round((track.displayWidth * k) / 2) * 2)
      const h = Math.max(2, Math.round((track.displayHeight * k) / 2) * 2)
      const o = { width: w, height: h, fit: 'fill', codec: 'avc', bitrate: 8e6 }
      if (useFx) {
        const cv = document.createElement('canvas')
        cv.width = w; cv.height = h
        const ctx = cv.getContext('2d')
        ctx.filter = filter
        // El instante de cada fotograma puede venir en la línea de tiempo del original o ya recortado: se detecta con el primero.
        let shift = null
        o.process = (sample) => {
          if (shift === null) shift = start > 0.05 && sample.timestamp >= start - 0.05 ? 0 : start
          sample.draw(ctx, 0, 0, w, h); drawVignette(ctx, w, h, fx.vignette)
          drawTextLayers(ctx, w, h, texts, sample.timestamp + shift)
          return cv
        }
        o.processedWidth = w; o.processedHeight = h
      }
      return o
    },
    audio: mute ? { discard: true } : { codec: 'aac' },
    showWarnings: false,
  })
  if (!conv.isValid) throw new Error('invalid')
  conv.onProgress = (p) => onProgress?.(p)
  const watch = setInterval(() => { if (ctl.cancel) conv.cancel().catch(() => {}) }, 150)
  try {
    await conv.execute()
  } catch (e) {
    if (ctl.cancel) throw new Error('cancel')
    throw e
  } finally { clearInterval(watch) }
  if (ctl.cancel) throw new Error('cancel')
  return { blob: new Blob([output.target.buffer], { type: 'video/mp4' }), duration: end - start }
}

export async function processVideo(file, opts) {
  opts = { ...opts, texts: (opts.texts || []).filter((l) => l.text.trim()) }
  await ensureTextFonts(opts.texts)
  if (hasWebCodecs()) {
    try { return await processWebCodecs(file, opts) } catch (e) {
      if (e.message === 'cancel' || opts.ctl.cancel) throw e
      console.warn('WebCodecs falló, usando el modo en tiempo real:', e)
      if (!pickMime()) throw new Error(t('No se pudo procesar el video.'))
    }
  }
  return processRealtime(file, opts)
}
