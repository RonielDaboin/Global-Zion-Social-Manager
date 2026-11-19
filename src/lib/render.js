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

/** Dibuja el diseño en un ctx de tamaño w×h (escala relativa a 1080 de ancho). Devuelve cajas de cada capa. */
export function drawDesign(ctx, d, img) {
  const { w, h } = getFormat(d.format)
  const k = w / 1080
  ctx.clearRect(0, 0, w, h)

  // Fondo
  if (d.bg.type === 'gradient') {
    const a = (d.bg.angle * Math.PI) / 180
    const cx = w / 2, cy = h / 2
    const r = Math.hypot(w, h) / 2
    const dx = Math.sin(a) * r, dy = -Math.cos(a) * r
    const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy)
    g.addColorStop(0, d.bg.c1)
    g.addColorStop(1, d.bg.c2)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  } else {
    ctx.fillStyle = d.bg.c1
    ctx.fillRect(0, 0, w, h)
  }
  if (d.bg.type === 'image' && img) {
    const s = Math.max(w / img.width, h / img.height)
    const iw = img.width * s, ih = img.height * s
    ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih)
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

  // Capas de texto
  const boxes = []
  for (const l of d.layers) {
    const size = l.size * k
    ctx.font = `${l.weight} ${size}px "${l.font}", sans-serif`
    ctx.textBaseline = 'middle'
    ctx.textAlign = l.align
    ctx.fillStyle = l.color
    const text = l.upper ? l.text.toUpperCase() : l.text
    const maxW = w * 0.84
    const lines = wrap(ctx, text, maxW)
    const lh = size * 1.15
    const total = lines.length * lh
    const cx = l.x * w, cy = l.y * h
    const startY = cy - total / 2 + lh / 2
    if (l.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,.55)'
      ctx.shadowBlur = 18 * k
      ctx.shadowOffsetY = 4 * k
    }
    let widest = 0
    lines.forEach((ln, i) => {
      ctx.fillText(ln, cx, startY + i * lh)
      widest = Math.max(widest, ctx.measureText(ln).width)
    })
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
    const bx = l.align === 'center' ? cx - widest / 2 : l.align === 'left' ? cx : cx - widest
    boxes.push({ id: l.id, x: bx, y: cy - total / 2, w: widest, h: total })
  }
  return boxes
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
