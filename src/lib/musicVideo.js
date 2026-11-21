// Imagen + música => video, todo en el navegador (canvas + Web Audio + MediaRecorder). Sin servidores ni costo.
import { t } from './i18n.jsx'
import { pickMime } from './videoProcess.js'

export const MOTION_GROUPS = [
  { label: 'Zoom', items: [
    { id: 'zoomin', label: 'Acercar', ico: '🔍' }, { id: 'zoomout', label: 'Alejar', ico: '🔭' },
    { id: 'breathe', label: 'Respirar', ico: '🫁' }, { id: 'zoompan', label: 'Acercar y deslizar', ico: '🎞️' },
  ] },
  { label: 'Desplazamiento', items: [
    { id: 'panl', label: 'Deslizar ←', ico: '⬅️' }, { id: 'panr', label: 'Deslizar →', ico: '➡️' },
    { id: 'panu', label: 'Deslizar ↑', ico: '⬆️' }, { id: 'pand', label: 'Deslizar ↓', ico: '⬇️' },
    { id: 'diag', label: 'Diagonal', ico: '↗️' }, { id: 'float', label: 'Flotar', ico: '🎈' }, { id: 'drift', label: 'Deriva', ico: '🌊' },
  ] },
  { label: 'Giro', items: [
    { id: 'rotcw', label: 'Girar ↻', ico: '🔃' }, { id: 'rotccw', label: 'Girar ↺', ico: '🔄' },
    { id: 'sway', label: 'Balanceo', ico: '🪅' }, { id: 'spiral', label: 'Espiral', ico: '🌀' },
  ] },
  { label: 'Al ritmo', items: [
    { id: 'pulse', label: 'Latido', ico: '💓' }, { id: 'bounce', label: 'Rebote', ico: '🏀' },
    { id: 'beatzoom', label: 'Zoom en cada golpe', ico: '🥁' }, { id: 'shake', label: 'Temblor', ico: '📳' },
    { id: 'flash', label: 'Destello', ico: '⚡' }, { id: 'glitch', label: 'Glitch', ico: '👾' },
  ] },
  { label: 'Otros', items: [{ id: 'none', label: 'Sin movimiento', ico: '🖼️' }] },
]
export const MOTIONS = MOTION_GROUPS.flatMap((g) => g.items)

/** Barras del visualizador. vals: 0..1 por barra. */
export function drawBars(ctx, w, h, vals, { heightPct = 0.1, pos = 'bottom', color = '#ffffff' } = {}) {
  const n = vals.length, bw = w / n, mx = h * heightPct
  ctx.save()
  ctx.fillStyle = color
  ctx.globalAlpha = 0.9
  for (let i = 0; i < n; i++) {
    const bh = Math.max(3, vals[i] * mx)
    const x = i * bw + bw * 0.18, ww = bw * 0.64
    if (pos === 'top') ctx.fillRect(x, 0, ww, bh)
    else if (pos === 'middle') ctx.fillRect(x, (h - bh) / 2, ww, bh)
    else ctx.fillRect(x, h - bh, ww, bh)
  }
  ctx.restore()
}

export const canMakeMusicVideo = () =>
  typeof MediaRecorder !== 'undefined' && !!pickMime() && typeof AudioContext !== 'undefined' &&
  typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype

const loadImage = (src) => new Promise((res, rej) => {
  const im = new Image()
  im.onload = () => res(im)
  im.onerror = () => rej(new Error(t('No se pudo leer la imagen.')))
  im.src = src
})

/** Duración y lectura de un archivo de audio. */
export const audioDuration = (file) => new Promise((res, rej) => {
  const a = new Audio()
  const url = URL.createObjectURL(file)
  a.preload = 'metadata'
  a.onloadedmetadata = () => { URL.revokeObjectURL(url); res(isFinite(a.duration) ? a.duration : 0) }
  a.onerror = () => { URL.revokeObjectURL(url); rej(new Error(t('No se pudo leer el audio.'))) }
  a.src = url
})

const ease = (x) => x * x * (3 - 2 * x)

/**
 * Reproduce (o graba) la imagen con movimiento y la música.
 * record=false: vista previa con sonido. record=true: graba y devuelve { blob, duration }.
 */
export async function runMusicVideo({ imageSrc, audioFile, canvas, motion = 'zoomin', bars = true, barsH = 0.1, barsPos = 'bottom', barsColor = '#ffffff', start = 0, duration = 15, volume = 1, fade = 1.5, record = false, live = null, onProgress, ctl = { cancel: false } }) {
  const mime = pickMime()
  if (record && !mime) throw new Error(t('Este navegador no puede crear videos. Prueba con Chrome o Edge.'))
  const img = await loadImage(imageSrc)
  const w = canvas.width, h = canvas.height
  const ctx = canvas.getContext('2d')
  const audioUrl = URL.createObjectURL(audioFile)
  const el = new Audio(audioUrl)
  el.preload = 'auto'
  let ac, stream, raf, rec
  try {
    await new Promise((res, rej) => { el.onloadedmetadata = res; el.onerror = () => rej(new Error(t('No se pudo leer el audio.'))) })
    el.currentTime = Math.max(0, start)
    ac = new AudioContext()
    const src = ac.createMediaElementSource(el)
    const gain = ac.createGain()
    const an = ac.createAnalyser()
    an.fftSize = 256
    an.smoothingTimeConstant = 0.8
    src.connect(gain); gain.connect(an)
    let dest
    if (record) {
      dest = ac.createMediaStreamDestination()
      an.connect(dest) // grabación silenciosa: no suena por los altavoces
    } else an.connect(ac.destination)
    await ac.resume()
    const freq = new Uint8Array(an.frequencyBinCount)

    const asp = Math.max(w / h, h / w)
    let pulse = 0, avg = 0.3, kick = 0
    const vals = new Array(32).fill(0)
    const draw = (sec) => {
      const L = { motion, bars, barsH, barsPos, barsColor, ...(live?.current || {}) } // ajustes en vivo durante la vista previa
      const p = Math.min(1, sec / duration)
      an.getByteFrequencyData(freq)
      let sum = 0; for (let i = 0; i < 6; i++) sum += freq[i]
      const bass = sum / 6 / 255
      pulse += (bass - pulse) * 0.35
      avg += (bass - avg) * 0.04
      kick = Math.max(kick * 0.86, Math.max(0, Math.min(1, (bass - avg) * 5)))
      const rnd = () => Math.random() * 2 - 1
      const im = L.img || img // la imagen se actualiza en vivo si el diseño cambia
      const base = Math.max(w / im.width, h / im.height)
      const iw = im.width * base, ih = im.height * base
      let s = 1, tx = 0, ty = 0, rot = 0, flash = 0, glitch = 0
      switch (L.motion) {
        case 'zoomin': s = 1 + 0.18 * ease(p); break
        case 'zoomout': s = 1.18 - 0.18 * ease(p); break
        case 'breathe': s = 1.06 + 0.05 * Math.sin(sec * 1.7); break
        case 'zoompan': s = 1 + 0.16 * ease(p); tx = (0.5 - ease(p)) * 0.07 * w; break
        case 'panl': tx = (0.5 - ease(p)) * 0.1 * w; break
        case 'panr': tx = (ease(p) - 0.5) * 0.1 * w; break
        case 'panu': ty = (0.5 - ease(p)) * 0.1 * h; break
        case 'pand': ty = (ease(p) - 0.5) * 0.1 * h; break
        case 'diag': tx = (ease(p) - 0.5) * 0.08 * w; ty = (0.5 - ease(p)) * 0.08 * h; s = 1.04; break
        case 'float': ty = Math.sin(sec * 1.4) * 0.018 * h; tx = Math.sin(sec * 0.7) * 0.01 * w; s = 1.04; break
        case 'drift': tx = Math.sin(sec * 0.9) * 0.04 * w; ty = Math.sin(sec * 0.6 + 1) * 0.04 * h; s = 1.06; break
        case 'rotcw': rot = (ease(p) - 0.5) * 0.14; s = 1.04; break
        case 'rotccw': rot = (0.5 - ease(p)) * 0.14; s = 1.04; break
        case 'sway': rot = Math.sin(sec * 1.3) * 0.045; s = 1.03; break
        case 'spiral': rot = ease(p) * 0.22; s = 1 + 0.25 * ease(p); break
        case 'pulse': s = 1.03 + 0.09 * pulse; break
        case 'bounce': s = 1.02 + 0.07 * kick; ty = -kick * 0.025 * h; break
        case 'beatzoom': s = 1.02 + 0.14 * kick; break
        case 'shake': s = 1.03; tx = rnd() * 0.006 * w * (0.4 + pulse * 2); ty = rnd() * 0.006 * h * (0.4 + pulse * 2); break
        case 'flash': s = 1.03 + 0.04 * pulse; flash = kick * 0.5; break
        case 'glitch': s = 1.03; glitch = kick > 0.45 ? kick : 0; break
        default: break
      }
      // margen para que nunca se vean bordes negros al mover o girar
      const ar = Math.abs(rot)
      s = Math.max(1, s) * (Math.cos(ar) + Math.sin(ar) * asp) * (1 + 2 * Math.max(Math.abs(tx) / w, Math.abs(ty) / h))
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)
      const put = (dx, clip) => {
        ctx.save()
        if (clip) { ctx.beginPath(); ctx.rect(0, clip[0], w, clip[1]); ctx.clip() }
        ctx.translate(w / 2 + tx + dx, h / 2 + ty)
        ctx.rotate(rot); ctx.scale(s, s)
        ctx.drawImage(im, -iw / 2, -ih / 2, iw, ih)
        ctx.restore()
      }
      if (glitch) {
        put(0)
        for (let i = 0; i < 5; i++) put(rnd() * w * 0.05 * glitch, [Math.random() * h * 0.9, h * (0.03 + Math.random() * 0.08)])
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.18 * glitch; ctx.fillStyle = '#ff2d6f'; ctx.fillRect(0, 0, w, h); ctx.restore()
      } else put(0)
      if (flash) { ctx.save(); ctx.globalAlpha = flash; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.restore() }
      if (L.bars) {
        for (let i = 0; i < vals.length; i++) vals[i] = freq[Math.floor((i / vals.length) * 64)] / 255
        drawBars(ctx, w, h, vals, { heightPct: L.barsH, pos: L.barsPos, color: L.barsColor })
      }
    }
    draw(0)

    if (record) {
      stream = canvas.captureStream(30)
      dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr))
      rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6, audioBitsPerSecond: 128e3 })
    }
    const chunks = []
    let stopped = Promise.resolve()
    if (rec) {
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      stopped = new Promise((r) => { rec.onstop = r })
      rec.start(500)
    }
    await el.play()
    const t0 = performance.now()
    await new Promise((resolve) => {
      const tick = () => {
        const sec = (performance.now() - t0) / 1000
        gain.gain.value = (live?.current?.volume ?? volume) * Math.max(0, Math.min(1, sec / 0.3, (duration - sec) / Math.max(0.1, fade)))
        draw(sec)
        onProgress?.(Math.min(1, sec / duration))
        if (ctl.cancel || sec >= duration || el.ended) return resolve()
        raf = requestAnimationFrame(tick)
      }
      tick()
    })
    el.pause()
    if (rec && rec.state !== 'inactive') rec.stop()
    await stopped
    if (!record) return null
    if (ctl.cancel) throw new Error('cancel')
    return { blob: new Blob(chunks, { type: mime.split(';')[0] }), duration }
  } finally {
    cancelAnimationFrame(raf)
    el.pause()
    stream?.getTracks().forEach((tr) => tr.stop())
    ac?.close().catch(() => {})
    URL.revokeObjectURL(audioUrl)
  }
}
