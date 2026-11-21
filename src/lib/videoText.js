// Textos sobre video (títulos, subtítulos, etiquetas…). El mismo dibujo sirve para la vista previa y para la exportación,
// así lo que se ve en el editor es lo que queda en el MP4.
import { uid } from './formats.js'

/** Plantillas rápidas. `size` es el alto de letra en % del alto del video; `x`/`y` el centro de la caja (0..1). */
export const TEXT_PRESETS = [
  ['Título', { text: 'Tu título aquí', size: 9, weight: 900, y: 0.2, shadow: true, upper: false, fade: true }],
  ['Subtítulo', { text: 'Tu subtítulo', size: 5.5, weight: 700, y: 0.3, shadow: true, fade: true }],
  ['Subtítulo de video', { text: 'Texto del subtítulo', size: 4.6, weight: 700, y: 0.82, bg: '#000000', bgOpacity: 0.6, shadow: false, fade: false }],
  ['Texto', { text: 'Escribe tu texto', size: 5, weight: 600, y: 0.5, shadow: true }],
  ['Llamada a la acción', { text: '¡Contáctanos!', size: 6, weight: 800, y: 0.88, bg: '#ef4444', bgOpacity: 1, color: '#ffffff', shadow: false, fade: true }],
  ['Marca / @usuario', { text: '@globalzion', size: 3.6, weight: 700, x: 0.8, y: 0.94, shadow: true }],
]

export const newTextLayer = (o = {}) => ({
  id: uid(), text: 'Texto', font: 'Poppins', weight: 800, color: '#ffffff', size: 6,
  x: 0.5, y: 0.5, align: 'center', bg: '', bgOpacity: 0.6, shadow: true, stroke: false, upper: false, fade: false,
  from: 0, to: 0, // segundos del video original; to = 0 → hasta el final
  ...o,
})

export const hasText = (layers) => !!layers?.some((l) => l.text.trim())

export async function ensureTextFonts(layers) {
  const set = [...new Set((layers || []).map((l) => `${l.weight} 40px "${l.font}"`))]
  try { await Promise.all(set.map((f) => document.fonts.load(f))) } catch { /* ignore */ }
}

const wrapLines = (ctx, text, maxW) => {
  const out = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const w of para.split(' ')) {
      const s = line ? line + ' ' + w : w
      if (line && ctx.measureText(s).width > maxW) { out.push(line); line = w } else line = s
    }
    out.push(line)
  }
  return out
}

const rrect = (ctx, x, y, w, h, r) => {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath()
}

const alphaAt = (l, t) => {
  if (t < l.from - 1e-3 || (l.to > 0 && t > l.to + 1e-3)) return 0
  if (!l.fade) return 1
  const end = l.to > 0 ? l.to : Infinity
  return Math.max(0, Math.min(1, (t - l.from) / 0.3 + 0.001, (end - t) / 0.3 + 0.001))
}

/**
 * Dibuja los textos activos en el instante `t` (segundos del video original).
 * Devuelve las cajas dibujadas ({id,x,y,w,h} en píxeles) para poder arrastrarlas.
 */
export function drawTextLayers(ctx, w, h, layers, t, selId = null) {
  const boxes = []
  ctx.save()
  ctx.filter = 'none'
  for (const l of layers || []) {
    const raw = l.text.replace(/\s+$/, '')
    if (!raw.trim()) continue
    const a = alphaAt(l, t)
    if (a <= 0) continue
    const px = Math.max(6, (l.size / 100) * h)
    ctx.font = `${l.weight} ${px}px "${l.font}", sans-serif`
    const text = l.upper ? raw.toUpperCase() : raw
    const pad = l.bg ? px * 0.4 : 0
    const lines = wrapLines(ctx, text, w * 0.9 - pad * 2)
    const lh = px * 1.22
    const tw = Math.max(...lines.map((s) => ctx.measureText(s).width))
    const bw = tw + pad * 2, bh = lines.length * lh + pad * 2
    const bx = Math.max(0, Math.min(w - bw, l.x * w - bw / 2))
    const by = Math.max(0, Math.min(h - bh, l.y * h - bh / 2))
    ctx.globalAlpha = a
    if (l.bg) {
      ctx.fillStyle = l.bg
      ctx.globalAlpha = a * (l.bgOpacity ?? 1)
      rrect(ctx, bx, by, bw, bh, px * 0.3); ctx.fill()
      ctx.globalAlpha = a
    }
    ctx.textBaseline = 'middle'
    ctx.textAlign = l.align
    const tx = l.align === 'left' ? bx + pad : l.align === 'right' ? bx + bw - pad : bx + bw / 2
    lines.forEach((s, i) => {
      const ty = by + pad + lh * i + lh / 2
      if (l.stroke) { ctx.lineWidth = px * 0.14; ctx.lineJoin = 'round'; ctx.strokeStyle = '#000'; ctx.strokeText(s, tx, ty) }
      if (l.shadow) { ctx.shadowColor = 'rgba(0,0,0,.65)'; ctx.shadowBlur = px * 0.18; ctx.shadowOffsetY = px * 0.05 }
      ctx.fillStyle = l.color
      ctx.fillText(s, tx, ty)
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
    })
    if (selId === l.id) {
      ctx.globalAlpha = 1
      ctx.setLineDash([px * 0.25, px * 0.2]); ctx.lineWidth = Math.max(1.5, px * 0.05); ctx.strokeStyle = '#38bdf8'
      ctx.strokeRect(bx - 3, by - 3, bw + 6, bh + 6)
    }
    boxes.push({ id: l.id, x: bx, y: by, w: bw, h: bh })
  }
  ctx.restore()
  return boxes
}
