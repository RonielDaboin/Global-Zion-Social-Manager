import { getFormat } from './formats.js'

const imgCache = new Map()
export function loadImage(src) {
  if (!src) return Promise.resolve(null)
  if (imgCache.has(src)) return imgCache.get(src)
  const p = new Promise((res) => {
    const im = new Image()
    im.onload = () => res(im)
    im.onerror = () => res(null)
    im.src = src
  })
  imgCache.set(src, p)
  return p
}

export async function ensureFonts(design) {
  const fonts = [...new Set(design.layers.map((l) => `${l.weight} 40px "${l.font}"`))]
  try {
    await Promise.all(fonts.map((f) => document.fonts.load(f)))
  } catch { /* ignore */ }
}

function wrap(ctx, text, maxW) {
  const out = []
  for (const para of text.split('\n')) {
    const words = para.split(' ')
    let line = ''
    for (const w of words) {
      const t = line ? line + ' ' + w : w
      if (ctx.measureText(t).width > maxW && line) {
        out.push(line)
        line = w
      } else line = t
    }
    out.push(line)
  }
  return out
}

/** Ajustes de imagen de fondo (valores neutros). */
export const FX_DEFAULT = { detail: 0, brightness: 100, contrast: 100, saturate: 100, hue: 0, sepia: 0, gray: 0, blur: 0, warmth: 0, vignette: 0 }

// Detalle = máscara de enfoque (unsharp mask): original + cantidad × (original − desenfocada).
// Se calcula a la resolución propia de la imagen y se guarda en caché para no repetirlo en cada redibujado.
let sharpCache = { img: null, detail: -1, out: null }
function sharpen(img, detail) {
  if (!detail) return img
  if (sharpCache.img === img && sharpCache.detail === detail) return sharpCache.out
  const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height
  const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  const a = mk(), b = mk()
  const ca = a.getContext('2d', { willReadFrequently: true }), cb = b.getContext('2d', { willReadFrequently: true })
  if (!('filter' in cb)) return img // navegador sin ctx.filter: sin efecto
  ca.drawImage(img, 0, 0)
  cb.filter = `blur(${Math.max(1, Math.max(w, h) / 900) * 1.5}px)`
  cb.drawImage(img, 0, 0)
  const A = ca.getImageData(0, 0, w, h), B = cb.getImageData(0, 0, w, h)
  const amt = (detail / 100) * 1.6, d = A.data, bl = B.data
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue
    for (let j = 0; j < 3; j++) {
      const v = d[i + j] + amt * (d[i + j] - bl[i + j])
      d[i + j] = v < 0 ? 0 : v > 255 ? 255 : v
    }
  }
  ca.putImageData(A, 0, 0)
  sharpCache = { img, detail, out: a }
  return a
}

/** Dibuja el diseño en un ctx de tamaño w×h (escala relativa a 1080 de ancho). Devuelve cajas de cada capa. */
export function drawDesign(ctx, d, img) {
  const { w, h } = getFormat(d.format)
  const k = w / 1080
  ctx.clearRect(0, 0, w, h)

  // Fondo
  if (d.bg.type === 'gradient' || d.bg.type === 'image') {
    const a = (d.bg.angle * Math.PI) / 180
    const cx = w / 2, cy = h / 2
    const r = Math.hypot(w, h) / 2
    const dx = Math.sin(a) * r, dy = -Math.cos(a) * r
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)
    g.addColorStop(0, d.bg.c1)
    if (d.bg.c3) g.addColorStop(0.5, d.bg.c2)
    g.addColorStop(1, d.bg.c3 || d.bg.c2)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  } else {
    ctx.fillStyle = d.bg.c1
    ctx.fillRect(0, 0, w, h)
  }
  if (d.bg.type === 'image' && img) {
    const s = Math.max(w / img.width, h / img.height)
    const fx = { ...FX_DEFAULT, ...(d.bg.fx || {}) }
    const blur = fx.blur * k
    const grow = 1 + (blur * 4) / Math.min(w, h) // evita bordes transparentes al desenfocar
    const iw = img.width * s * grow, ih = img.height * s * grow
    const f = []
    if (fx.brightness !== 100) f.push(`brightness(${fx.brightness}%)`)
    if (fx.contrast !== 100) f.push(`contrast(${fx.contrast}%)`)
    if (fx.saturate !== 100) f.push(`saturate(${fx.saturate}%)`)
    if (fx.hue) f.push(`hue-rotate(${fx.hue}deg)`)
    if (fx.sepia) f.push(`sepia(${fx.sepia}%)`)
    if (fx.gray) f.push(`grayscale(${fx.gray}%)`)
    if (blur > 0) f.push(`blur(${blur}px)`)
    ctx.save()
    if (f.length && 'filter' in ctx) ctx.filter = f.join(' ')
    ctx.drawImage(sharpen(img, fx.detail), (w - iw) / 2, (h - ih) / 2, iw, ih)
    ctx.restore()
    if (fx.warmth) { // temperatura: tinte cálido (+) o frío (−)
      ctx.fillStyle = fx.warmth > 0 ? `rgba(255,140,30,${fx.warmth / 100 * 0.35})` : `rgba(40,120,255,${-fx.warmth / 100 * 0.35})`
      ctx.globalCompositeOperation = 'soft-light'
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
    }
    if (fx.vignette > 0) {
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) / 2)
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, `rgba(0,0,0,${fx.vignette / 100 * 0.85})`)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }
  }
  if (d.bg.dim > 0) {
    ctx.fillStyle = `rgba(0,0,0,${d.bg.dim})`
    ctx.fillRect(0, 0, w, h)
  }

  // Acento (marco)
  if (d.accent?.show) {
    ctx.strokeStyle = d.accent.color
    ctx.lineWidth = 6 * k
    const m = 40 * k
    ctx.strokeRect(m, m, w - 2 * m, h - 2 * m)
  }

  // Capas de texto (y stickers: texto con fondo en forma de píldora, círculo, sello, estrella…)
  const boxes = []
  for (const l of d.layers) {
    const size = l.size * k
    ctx.font = `${l.weight} ${size}px "${l.font}", sans-serif`
    ctx.textBaseline = 'middle'
    ctx.textAlign = l.align
    ctx.fillStyle = l.color
    const text = l.upper ? l.text.toUpperCase() : l.text
    const maxW = w * 0.84
    const blank = !text.trim()
    const lines = blank ? [''] : wrap(ctx, text, maxW)
    const lh = size * 1.15
    const total = lines.length * lh
    const cx = l.x * w, cy = l.y * h
    const startY = cy - total / 2 + lh / 2
    let widest = 0
    lines.forEach((ln) => { widest = Math.max(widest, ctx.measureText(ln).width) })
    if (blank) widest = size * 1.6
    if (l.progress != null) widest = Math.max(widest, l.shape === 'ring' || l.shape === 'circle' ? size * 1.2 : size * 5) // barras y anillos de carga
    const bx = l.align === 'center' ? cx - widest / 2 : l.align === 'left' ? cx : cx - widest
    ctx.save()
    if (l.opacity != null && l.opacity < 1) ctx.globalAlpha = l.opacity
    if (l.rot) { ctx.translate(cx, cy); ctx.rotate((l.rot * Math.PI) / 180); ctx.translate(-cx, -cy) }
    if (l.bg) {
      const pad = size * (l.shape === 'circle' || l.shape === 'burst' || l.shape === 'star' ? 0.55 : 0.32)
      const bw = widest + pad * 2, bh = Math.max(total, blank ? size * 1.6 : 0) + pad * 2
      const mx = bx + widest / 2, my = cy
      ctx.save()
      ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14 * k; ctx.shadowOffsetY = 4 * k
      ctx.fillStyle = l.bg
      stickerShape(ctx, l.shape || 'pill', mx, my, bw, bh)
      ctx.fill()
      ctx.restore()
      if (l.progress != null) { // barra / anillo / vaso que se llena según el porcentaje
        const p = Math.max(0, Math.min(100, l.progress)) / 100, sh = l.shape || 'pill'
        ctx.save()
        if (sh === 'ring') {
          const R = Math.max(bw, bh) / 2, lw = R * 0.22, rr = R - lw * 0.9
          ctx.lineWidth = lw; ctx.lineCap = 'round'
          ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(mx, my, rr, 0, Math.PI * 2); ctx.stroke()
          ctx.strokeStyle = l.fill || '#38bdf8'; ctx.beginPath(); ctx.arc(mx, my, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p); ctx.stroke()
        } else {
          stickerShape(ctx, sh, mx, my, bw, bh); ctx.clip()
          ctx.fillStyle = l.fill || '#38bdf8'
          if (sh === 'circle') { const D = Math.max(bw, bh); ctx.fillRect(mx - D / 2, my + D / 2 - D * p, D, D * p) } else ctx.fillRect(mx - bw / 2, my - bh / 2, bw * p, bh)
        }
        ctx.restore()
      }
    }
    if ((l.shadow || l.progress != null) && !blank) {
      ctx.shadowColor = 'rgba(0,0,0,.55)'
      ctx.shadowBlur = 18 * k
      ctx.shadowOffsetY = 4 * k
    }
    ctx.fillStyle = l.color
    if (!blank) lines.forEach((ln, i) => ctx.fillText(ln, cx, startY + i * lh))
    ctx.restore()
    boxes.push({ lines, lh, startY, cx, cy, align: l.align, text, rot: l.rot || 0, font: `${l.weight} ${size}px "${l.font}", sans-serif`, id: l.id, x: bx - (l.bg ? size * 0.4 : 0), y: cy - total / 2 - (l.bg ? size * 0.4 : 0), w: widest + (l.bg ? size * 0.8 : 0), h: Math.max(total, blank ? size * 1.6 : 0) + (l.bg ? size * 0.8 : 0) })
  }
  return boxes
}

/** Traza la forma de un sticker centrada en (x, y) con tamaño w×h (no rellena: lo hace quien llama). */
function stickerShape(ctx, shape, x, y, w, h) {
  ctx.beginPath()
  if (shape === 'circle' || shape === 'ring') { ctx.ellipse(x, y, Math.max(w, h) / 2, Math.max(w, h) / 2, 0, 0, Math.PI * 2); return }
  if (shape === 'rect') { ctx.roundRect(x - w / 2, y - h / 2, w, h, Math.min(w, h) * 0.12); return }
  if (shape === 'burst' || shape === 'star') {
    const R = Math.max(w, h) / 2, n = shape === 'burst' ? 18 : 5
    const r = shape === 'burst' ? R * 0.86 : R * 0.45
    for (let i = 0; i < n * 2; i++) {
      const a = (Math.PI * i) / n - Math.PI / 2, rr = i % 2 ? r : R
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py)
    }
    ctx.closePath()
    return
  }
  ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2) // pill
}

/** Renderiza a dataURL (para guardar/publicar/descargar). */
export async function renderToDataURL(design, type = 'image/jpeg', quality = 0.88, maxW = 1080) {
  await ensureFonts(design)
  const { w, h } = getFormat(design.format)
  const scale = Math.min(1, maxW / w)
  const c = document.createElement('canvas')
  c.width = Math.round(w * scale)
  c.height = Math.round(h * scale)
  const ctx = c.getContext('2d')
  ctx.scale(scale, scale)
  const img = design.bg.type === 'image' ? await loadImage(design.bg.image) : null
  drawDesign(ctx, design, img)
  return c.toDataURL(type, quality)
}
