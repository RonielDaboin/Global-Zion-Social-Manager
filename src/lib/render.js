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

// Logo de Global Zion que se dibuja en las publicaciones (capas con `logo` y fondo «logo»)
export const LOGO_SRC = '/logo.webp'
let logoImg = null
const loadLogo = () => loadImage(LOGO_SRC).then((im) => { logoImg = im })

export async function ensureFonts(design) {
  if (design.bg.deco?.type === 'logo' || design.layers.some((l) => l.logo || l.brand)) await loadLogo()
  const fonts = [...new Set(design.layers.map((l) => `${l.weight} 40px "${l.font}"`))]
  if (design.layers.some((l) => l.brand)) fonts.push('600 40px "Plus Jakarta Sans"')
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

/** Patrón decorativo del fondo, en el color de acento. Se dibuja bajo los textos. */
function drawDeco(ctx, deco, w, h, k) {
  const c = /^#[0-9a-f]{6}/i.test(deco.color) ? deco.color.slice(0, 7) : '#38bdf8'
  const dot = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2) }
  const halo = (x, y, r, alpha) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, c + alpha); g.addColorStop(1, c + '00')
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  ctx.save()
  if (deco.type === 'rings') {
    halo(w, 0, w * 0.7, '40')
    ctx.strokeStyle = c + '2b'; ctx.lineWidth = 3 * k
    for (let i = 1; i <= 5; i++) { dot(w * 0.96, h * 0.05, i * 105 * k); ctx.stroke() }
    ctx.lineWidth = 46 * k; ctx.strokeStyle = c + '24'; dot(w * 0.03, h * 0.97, 190 * k); ctx.stroke()
  } else if (deco.type === 'dots') {
    halo(0, h, w * 0.75, '36')
    const step = 46 * k
    for (let y = step; y < h; y += step) {
      for (let x = step; x < w; x += step) {
        const f = Math.max(0, x / w - y / h + 0.25) // más densos hacia la esquina superior derecha
        if (f > 0.05) { ctx.globalAlpha = Math.min(0.5, f * 0.55); ctx.fillStyle = c; dot(x, y, 4 * k); ctx.fill() }
      }
    }
  } else if (deco.type === 'grid') {
    halo(w * 0.5, 0, w * 0.8, '3d')
    ctx.strokeStyle = c + '1c'; ctx.lineWidth = 2 * k
    const step = 90 * k
    ctx.beginPath()
    for (let x = step / 2; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h) }
    for (let y = step / 2; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y) }
    ctx.stroke()
  } else if (deco.type === 'diagonal') {
    const band = (a, b, alpha) => { ctx.fillStyle = c + alpha; ctx.beginPath(); ctx.moveTo(w * a, 0); ctx.lineTo(w * b, 0); ctx.lineTo(w * b - h * 0.45, h); ctx.lineTo(w * a - h * 0.45, h); ctx.fill() }
    band(0.74, 0.9, '20'); band(0.94, 0.985, '40'); band(1.08, 1.36, '17'); band(0.6, 0.625, '2b')
  } else if (deco.type === 'waves') {
    const wave = (top, amp, alpha) => {
      ctx.fillStyle = c + alpha; ctx.beginPath(); ctx.moveTo(0, h * top)
      ctx.bezierCurveTo(w * 0.3, h * (top - amp), w * 0.65, h * (top + amp), w, h * (top - amp * 0.5))
      ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill()
    }
    halo(w, 0, w * 0.65, '30')
    wave(0.76, 0.09, '14'); wave(0.84, 0.07, '1f'); wave(0.92, 0.05, '2e')
  } else if (deco.type === 'glow') {
    halo(w * 0.05, h * 0.12, w * 0.75, '59'); halo(w, h * 0.55, w * 0.65, '3d'); halo(w * 0.25, h, w * 0.7, '33')
  } else if (deco.type === 'blobs') {
    ctx.fillStyle = c + '26'; dot(w * 0.98, h * 0.04, 270 * k); ctx.fill()
    ctx.fillStyle = c + '1a'; dot(w * 0.02, h * 0.62, 150 * k); ctx.fill()
    ctx.fillStyle = c + '21'; dot(w * 0.82, h * 1.02, 230 * k); ctx.fill()
  } else if (deco.type === 'logo' && logoImg) {
    halo(w * 0.8, h * 0.7, w * 0.7, '33')
    ctx.globalAlpha = 0.09
    const s = w * 0.95
    ctx.translate(w * 0.72, h * 0.68); ctx.rotate(-0.21)
    ctx.drawImage(logoImg, -s / 2, -s / 2, s, s)
  }
  ctx.restore()
}

/** Dibuja el logo (lado `s`) centrado en (x, y). badge: 'tile' = sobre fondo blanco, 'ring' = además con aro multicolor, '' = solo. */
function drawLogo(ctx, x, y, s, badge, k) {
  if (badge) {
    const tile = (side, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x - side / 2, y - side / 2, side, side, side * 0.28); ctx.fill() }
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 22 * k; ctx.shadowOffsetY = 6 * k
    let ring = '#ffffff'
    if (badge === 'ring' && ctx.createConicGradient) {
      ring = ctx.createConicGradient(0, x, y)
      ;['#f58529', '#dd2a7b', '#8134af', '#25f4ee', '#f58529'].forEach((col, i) => ring.addColorStop(i / 4, col))
    }
    tile(s, ring)
    ctx.restore()
    if (badge === 'ring') tile(s * 0.88, '#f4f8ff')
  }
  const inner = badge === 'ring' ? s * 0.76 : badge ? s * 0.84 : s
  if (logoImg) ctx.drawImage(logoImg, x - inner / 2, y - inner / 2, inner, inner)
}

// Colores del logo de la web (modo claro y modo oscuro)
const BRAND_LOOK = {
  light: { plate: '#f7faff', edge: '#0b2a4a1f', first: '#0b2a4a', second: '#0066cc', sub: '#4b5b73', line: '0,102,204' },
  dark: { plate: '#050b1a', edge: '#55adf540', first: '#f2f7fd', second: '#55adf5', sub: '#b6c6db', line: '85,173,245' },
}
export const BRAND_RATIO = 0.28 // alto / ancho del logo completo

/** Logo completo (icono + GLOBAL ZION + DIGITAL SOLUTIONS) de ancho `W` centrado en (x, y). Se dibuja como texto para que se vea nítido. */
function drawBrand(ctx, x, y, W, version, plate, k) {
  const c = BRAND_LOOK[version] || BRAND_LOOK.light
  const H = W * BRAND_RATIO
  ctx.save()
  if (plate) {
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 20 * k; ctx.shadowOffsetY = 5 * k
    ctx.fillStyle = c.plate; ctx.beginPath(); ctx.roundRect(x - W / 2, y - H / 2, W, H, H * 0.22); ctx.fill()
    ctx.restore()
    ctx.strokeStyle = c.edge; ctx.lineWidth = 2 * k; ctx.stroke()
  } else if (version === 'dark') { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 12 * k; ctx.shadowOffsetY = 2 * k }
  const cw = W * (plate ? 0.88 : 1), u = cw / 260, left = x - cw / 2
  if (logoImg) ctx.drawImage(logoImg, left, y - 29 * u, 58 * u, 58 * u)
  const tx = left + 70 * u, tw = 190 * u
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  // Cada renglón se ajusta para ocupar exactamente el ancho del bloque de texto
  const fitRow = (parts, cy, weight, base, spacing) => {
    const set = (size) => { ctx.font = `${weight} ${size}px "Plus Jakarta Sans", sans-serif`; if ('letterSpacing' in ctx) ctx.letterSpacing = `${size * spacing}px` }
    set(base)
    const total = ctx.measureText(parts.map((p) => p[0]).join('')).width - ('letterSpacing' in ctx ? base * spacing : 0)
    const size = Math.min(base * 1.3, (base * tw) / total)
    set(size)
    let px = tx
    for (const [str, color] of parts) { ctx.fillStyle = color; ctx.fillText(str, px, cy); px += ctx.measureText(str).width }
  }
  fitRow([['GLOBAL ', c.first], ['ZION', c.second]], y - 11 * u, 800, 22 * u, 0.1)
  const g = ctx.createLinearGradient(tx, 0, tx + tw, 0)
  g.addColorStop(0, `rgba(${c.line},1)`); g.addColorStop(1, `rgba(${c.line},.15)`)
  ctx.fillStyle = g; ctx.fillRect(tx, y + 4 * u, tw, Math.max(1, 1.2 * u))
  fitRow([['DIGITAL SOLUTIONS', c.sub]], y + 17 * u, 600, 10.5 * u, 0.34)
  ctx.restore()
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

  if (d.bg.deco) drawDeco(ctx, d.bg.deco, w, h, k)

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
    if (l.logo || l.brand || l.box) { // logos y rectángulos: no son texto
      const cx = l.x * w, cy = l.y * h
      const bw = l.logo || l.brand ? l.size * k : l.box.w * w * (l.size / 100)
      const bh = l.logo ? l.size * k : l.brand ? l.size * k * BRAND_RATIO : l.box.h * h * (l.size / 100)
      ctx.save()
      if (l.opacity != null && l.opacity < 1) ctx.globalAlpha = l.opacity
      if (l.rot) { ctx.translate(cx, cy); ctx.rotate((l.rot * Math.PI) / 180); ctx.translate(-cx, -cy) }
      if (l.logo) drawLogo(ctx, cx, cy, bw, l.badge, k)
      else if (l.brand) drawBrand(ctx, cx, cy, bw, l.brand, l.plate, k)
      else {
        ctx.fillStyle = l.bg
        ctx.beginPath(); ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, Math.min((l.box.r || 0) * k, bw / 2, bh / 2)); ctx.fill()
      }
      ctx.restore()
      boxes.push({ id: l.id, lock: l.lock, cx, cy, rot: l.rot || 0, x: cx - bw / 2, y: cy - bh / 2, w: bw, h: bh })
      continue
    }
    let size = l.size * k
    ctx.font = `${l.weight} ${size}px "${l.font}", sans-serif`
    ctx.textBaseline = 'middle'
    ctx.textAlign = l.align
    ctx.fillStyle = l.color
    const text = l.upper ? l.text.toUpperCase() : l.text
    const maxW = w * (l.fit?.w || 0.84)
    const blank = !text.trim()
    let lines = blank ? [''] : wrap(ctx, text, maxW)
    // `fit`: la letra se achica hasta que el texto quepa en su espacio
    if (l.fit && !blank) {
      const over = () => (l.fit.h && lines.length * size * 1.15 > l.fit.h * h) || lines.some((ln) => ctx.measureText(ln).width > maxW + 1)
      while (size > 12 * k && over()) {
        size *= 0.95
        ctx.font = `${l.weight} ${size}px "${l.font}", sans-serif`
        lines = wrap(ctx, text, maxW)
      }
    }
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
      if (!l.flat) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14 * k; ctx.shadowOffsetY = 4 * k }
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
    boxes.push({ lock: l.lock, fs: size / k, lines, lh, startY, cx, cy, align: l.align, text, rot: l.rot || 0, font: `${l.weight} ${size}px "${l.font}", sans-serif`, id: l.id, x: bx - (l.bg ? size * 0.4 : 0), y: cy - total / 2 - (l.bg ? size * 0.4 : 0), w: widest + (l.bg ? size * 0.8 : 0), h: Math.max(total, blank ? size * 1.6 : 0) + (l.bg ? size * 0.8 : 0) })
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
