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
  x: 0.5, y: 0.5, rot: 0, align: 'center', bg: '', bgOpacity: 0.6, shadow: true, stroke: false, upper: false, fade: false,
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

const alphaAt = (l, t, noFade) => {
  if (t < l.from - 1e-3 || (l.to > 0 && t > l.to + 1e-3)) return 0
  if (!l.fade || noFade) return 1
  const end = l.to > 0 ? l.to : Infinity
  const fd = Math.max(0.05, l.fadeDur || 0.3) // duración del desvanecido (s)
  return Math.max(0, Math.min(1, (t - l.from) / fd + 0.001, (end - t) / fd + 0.001))
}

/**
 * Dibuja los textos activos en el instante `t` (segundos del video original).
 * Devuelve las cajas dibujadas ({id,x,y,w,h} en píxeles) para poder arrastrarlas.
 */
// noFade: en la vista previa en pausa se muestra el texto completo (si no, justo al aparecer el desvanecido lo deja casi invisible)
// handles: dibuja los tiradores de giro y tamaño del texto seleccionado (modo avanzado).
// caret: {id, pos, color} dibuja el cursor de escritura parpadeante dentro del texto indicado.
export function drawTextLayers(ctx, w, h, layers, t, selId = null, noFade = false, handles = false, caret = null) {
  const boxes = []
  const hs = Math.max(8, w * 0.024) // radio de los tiradores
  ctx.save()
  ctx.filter = 'none'
  for (const l of layers || []) {
    const raw = l.text.replace(/\s+$/, '')
    if (!raw.trim()) continue
    const a = alphaAt(l, t, noFade)
    if (a <= 0) continue
    const px = Math.max(6, (l.size / 100) * h)
    ctx.font = `${l.weight} ${px}px "${l.font}", sans-serif`
    const text = l.upper ? raw.toUpperCase() : raw
    const pad = l.bg ? px * 0.4 : 0
    const lines = wrapLines(ctx, text, w * 0.9 - pad * 2)
    const lh = px * 1.22
    const tw = Math.max(...lines.map((s) => ctx.measureText(s).width))
    const bw = tw + pad * 2, bh = lines.length * lh + pad * 2
    const rot = ((l.rot || 0) * Math.PI) / 180
    // Sin giro la caja se mantiene dentro del video; con giro se respeta el centro elegido
    const bx = rot ? l.x * w - bw / 2 : Math.max(0, Math.min(w - bw, l.x * w - bw / 2))
    const by = rot ? l.y * h - bh / 2 : Math.max(0, Math.min(h - bh, l.y * h - bh / 2))
    const cx = bx + bw / 2, cy = by + bh / 2
    ctx.save()
    if (rot) { ctx.translate(cx, cy); ctx.rotate(rot); ctx.translate(-cx, -cy) }
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
    if (caret && caret.id === l.id) {
      let pos = Math.min(caret.pos ?? text.length, text.length), li = 0
      for (; li < lines.length - 1 && pos > lines[li].length; li++) pos -= lines[li].length + 1
      const line = lines[li], lw = ctx.measureText(line).width
      const x0 = l.align === 'left' ? tx : l.align === 'right' ? tx - lw : tx - lw / 2
      const cxp = x0 + ctx.measureText(line.slice(0, pos)).width
      const cyy = by + pad + lh * li + lh / 2
      ctx.globalAlpha = 1
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = px * 0.1
      ctx.fillStyle = caret.color
      ctx.fillRect(cxp - px * 0.035, cyy - px * 0.55, Math.max(2, px * 0.07), px * 1.1)
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0
    }
    const box = { id: l.id, x: bx, y: by, w: bw, h: bh, cx, cy, rot }
    if (selId === l.id) {
      ctx.globalAlpha = 1
      ctx.setLineDash([px * 0.25, px * 0.2]); ctx.lineWidth = Math.max(1.5, px * 0.05); ctx.strokeStyle = '#38bdf8'
      ctx.strokeRect(bx - 3, by - 3, bw + 6, bh + 6)
      ctx.setLineDash([])
      if (handles) {
        // giro: círculo sobre el borde superior · tamaño: cuadrado en la esquina inferior derecha
        const rh = { x: cx, y: by - 3 - hs * 2.2 }, sh = { x: bx + bw + 3, y: by + bh + 3 }
        ctx.lineWidth = Math.max(1.5, hs * 0.14)
        ctx.beginPath(); ctx.moveTo(cx, by - 3); ctx.lineTo(rh.x, rh.y); ctx.stroke()
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#38bdf8'
        ctx.beginPath(); ctx.arc(rh.x, rh.y, hs, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#38bdf8'; ctx.font = `700 ${hs * 1.4}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('\u21BB', rh.x, rh.y + hs * 0.05)
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.rect(sh.x - hs, sh.y - hs, hs * 2, hs * 2); ctx.fill(); ctx.stroke()
        ctx.fillStyle = '#38bdf8'; ctx.fillText('\u2921', sh.x, sh.y + hs * 0.05)
        box.rotH = rh; box.sizeH = sh; box.hs = hs
      }
    }
    ctx.restore()
    boxes.push(box)
  }
  ctx.restore()
  return boxes
}
