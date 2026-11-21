import { useEffect, useRef, useState } from 'react'
import { t, useLang } from '../lib/i18n.jsx'

// Visor independiente para trabajar solo la imagen: recortar, quitar el fondo y retocar con pincel.
const MIN = 0.03
const MAX_HIST = 15
const ZMIN = 0.5, ZMAX = 4
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

const load = (src) => new Promise((res, rej) => {
  const im = new Image()
  im.onload = () => res(im)
  im.onerror = rej
  im.src = src
})
const blobToDataURL = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b) })
const isPng = (s) => s.startsWith('data:image/png')

/** Recorta un dataURL con una región en fracciones (0..1). Conserva PNG si el original lo era. */
async function cropData(src, c) {
  const im = await load(src)
  const sx = Math.round(c.x * im.naturalWidth), sy = Math.round(c.y * im.naturalHeight)
  const sw = Math.max(1, Math.round(c.w * im.naturalWidth)), sh = Math.max(1, Math.round(c.h * im.naturalHeight))
  const cv = document.createElement('canvas')
  cv.width = sw; cv.height = sh
  cv.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh)
  return isPng(src) ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.92)
}

const MAX_SIDE = 4096 // límite del lado mayor al reescalar (memoria del navegador y peso del archivo)

/** Reescala ×factor en pasos de ×2 con suavizado de alta calidad y un enfoque ligero final. */
async function upscaleData(src, factor) {
  const im = await load(src)
  let cv = document.createElement('canvas')
  cv.width = im.naturalWidth; cv.height = im.naturalHeight
  cv.getContext('2d').drawImage(im, 0, 0)
  const target = [Math.round(cv.width * factor), Math.round(cv.height * factor)]
  while (cv.width < target[0]) {
    const next = document.createElement('canvas')
    next.width = Math.min(target[0], cv.width * 2); next.height = Math.min(target[1], cv.height * 2)
    const c = next.getContext('2d')
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'
    c.drawImage(cv, 0, 0, next.width, next.height)
    cv = next
  }
  // Enfoque ligero (núcleo 3×3) para recuperar la nitidez que pierde la interpolación
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  const W = cv.width, H = cv.height
  const src32 = ctx.getImageData(0, 0, W, H), out = ctx.createImageData(W, H)
  const a = src32.data, o = out.data, k = 0.3
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - 1), y1 = Math.min(H - 1, y + 1)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const l = (y * W + Math.max(0, x - 1)) * 4, r = (y * W + Math.min(W - 1, x + 1)) * 4
      const u = (y0 * W + x) * 4, d = (y1 * W + x) * 4
      for (let j = 0; j < 3; j++) {
        const v = a[i + j] * (1 + 4 * k) - k * (a[l + j] + a[r + j] + a[u + j] + a[d + j])
        o[i + j] = v < 0 ? 0 : v > 255 ? 255 : v
      }
      o[i + 3] = a[i + 3]
    }
  }
  ctx.putImageData(out, 0, 0)
  return isPng(src) ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.93)
}

/** Dilata una máscara (1 = zona a quitar) r píxeles, para no dejar bordes ni halos del objeto. */
function dilateMask(m, W, H, r) {
  const a = new Uint8Array(m.length), b = new Uint8Array(m.length)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!m[y * W + x]) continue
      for (let k = Math.max(0, x - r); k <= Math.min(W - 1, x + r); k++) a[y * W + k] = 1
    }
  }
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!a[y * W + x]) continue
      for (let k = Math.max(0, y - r); k <= Math.min(H - 1, y + r); k++) b[k * W + x] = 1
    }
  }
  return b
}

/**
 * Relleno por ejemplares (Criminisi): rellena el hueco desde el borde hacia dentro copiando parches REALES del
 * entorno, priorizando los que continúan bordes y líneas. Así un fondo blanco sigue blanco y un borde de color
 * sigue siendo nítido, en vez de promediarse todo en un borrón. Modifica `d` (RGBA) en los píxeles del hueco.
 */
function exemplarFill(d, hole, W, H, ps) {
  const R = ps >> 1, N = W * H, W1 = W + 1
  const filled = new Uint8Array(N), conf = new Float32Array(N), gray = new Float32Array(N)
  const lum = (n) => d[n * 4] * 0.3 + d[n * 4 + 1] * 0.59 + d[n * 4 + 2] * 0.11
  let remaining = 0
  for (let n = 0; n < N; n++) { if (hole[n]) remaining++; else { filled[n] = 1; conf[n] = 1; gray[n] = lum(n) } }
  if (!remaining) return true
  // Candidatos: centros de parches que no tocan ningún píxel del hueco (suma acumulada para comprobarlo rápido)
  const pre = new Int32Array(W1 * (H + 1))
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) pre[(y + 1) * W1 + x + 1] = hole[y * W + x] + pre[y * W1 + x + 1] + pre[(y + 1) * W1 + x] - pre[y * W1 + x]
  const all = []
  for (let cy = R; cy < H - R; cy++) for (let cx = R; cx < W - R; cx++) {
    const x0 = cx - R, y0 = cy - R, x1 = cx + R + 1, y1 = cy + R + 1
    if (pre[y1 * W1 + x1] - pre[y0 * W1 + x1] - pre[y1 * W1 + x0] + pre[y0 * W1 + x0] === 0) all.push(cy * W + cx)
  }
  if (all.length < 10) return false
  const stride = Math.max(1, Math.ceil(all.length / (ps > 13 ? 2500 : 4000)))
  const cands = stride > 1 ? all.filter((_, i) => i % stride === 0) : all

  while (remaining > 0) {
    // 1) Píxel del frente con mayor prioridad = confianza × continuidad de bordes (isofota · normal)
    let bp = -1, bpr = -1, bC = 0
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const n = y * W + x
      if (filled[n]) continue
      if (!((x > 0 && filled[n - 1]) || (x < W - 1 && filled[n + 1]) || (y > 0 && filled[n - W]) || (y < H - 1 && filled[n + W]))) continue
      let cs = 0, area = 0, gx = 0, gy = 0, gm = -1
      for (let dy = -R; dy <= R; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= H) continue
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= W) continue
          area++
          const m = yy * W + xx
          if (!filled[m]) continue
          cs += conf[m]
          if (xx > 0 && xx < W - 1 && yy > 0 && yy < H - 1 && filled[m - 1] && filled[m + 1] && filled[m - W] && filled[m + W]) {
            const ax = gray[m + 1] - gray[m - 1], ay = gray[m + W] - gray[m - W], mag = ax * ax + ay * ay
            if (mag > gm) { gm = mag; gx = ax; gy = ay }
          }
        }
      }
      let nx = 0, ny = 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy
        if (xx >= 0 && xx < W && yy >= 0 && yy < H && filled[yy * W + xx]) { nx += dx; ny += dy }
      }
      const nl = Math.hypot(nx, ny)
      const D = gm > 0 && nl > 0 ? Math.abs(-gy * nx + gx * ny) / nl / 255 : 0
      const C = cs / area
      const pr = C * (0.02 + D)
      if (pr > bpr) { bpr = pr; bp = n; bC = C }
    }
    if (bp < 0) return false
    // 2) Parche objetivo (centrado en el píxel, sin salirse de la imagen) y su lista de píxeles ya conocidos
    const cx = clamp(bp % W, R, W - 1 - R), cy = clamp(Math.floor(bp / W), R, H - 1 - R), cn = cy * W + cx
    const tk = [], tu = []
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) { const k = dy * W + dx; (filled[cn + k] ? tk : tu).push(k) }
    // 3) Mejor parche de origen (SSD sobre los píxeles conocidos, con corte anticipado)
    let best = Infinity, bs = -1
    for (let i = 0; i < cands.length; i++) {
      const s = cands[i]
      let ssd = 0, k = 0
      for (; k < tk.length; k++) {
        const a = (cn + tk[k]) * 4, b = (s + tk[k]) * 4
        const e0 = d[a] - d[b], e1 = d[a + 1] - d[b + 1], e2 = d[a + 2] - d[b + 2], e3 = d[a + 3] - d[b + 3]
        ssd += e0 * e0 + e1 * e1 + e2 * e2 + e3 * e3
        if (ssd >= best) break
      }
      if (k === tk.length) { best = ssd; bs = s }
    }
    if (bs < 0) return false
    // 4) Copia solo lo que faltaba
    for (let i = 0; i < tu.length; i++) {
      const t = cn + tu[i], s = bs + tu[i]
      d[t * 4] = d[s * 4]; d[t * 4 + 1] = d[s * 4 + 1]; d[t * 4 + 2] = d[s * 4 + 2]; d[t * 4 + 3] = d[s * 4 + 3]
      filled[t] = 1; conf[t] = bC; gray[t] = lum(t); remaining--
    }
  }
  return true
}

/**
 * Borrador mágico: rellena la zona marcada con el fondo que la rodea. Primero intenta el relleno por parches
 * (conserva bordes y colores planos); si no hay suficiente entorno, usa una pirámide "pull-push" en RGBA
 * premultiplicado (suave, respeta la transparencia) con el grano del entorno. Solo trabaja sobre el rectángulo
 * que rodea a la máscara.
 */
function inpaintCanvas(cv, mask, r) {
  const FW = cv.width, FH = cv.height
  const m = dilateMask(mask, FW, FH, r)
  let x0 = FW, y0 = FH, x1 = -1, y1 = -1
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (m[y * FW + x]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  if (x1 < 0) return false
  const maxDim = Math.max(x1 - x0, y1 - y0) + 1
  const pad = Math.max(40, maxDim)
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(FW - 1, x1 + pad); y1 = Math.min(FH - 1, y1 + pad)
  const W = x1 - x0 + 1, H = y1 - y0 + 1
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  const img = ctx.getImageData(x0, y0, W, H), d = img.data
  const hole = new Uint8Array(W * H)
  let known = 0
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const h = m[(y + y0) * FW + x + x0]; hole[y * W + x] = h; if (!h) known++ }
  if (!known) return false

  const ps = clamp(Math.round(maxDim / 40) * 2 + 1, 9, 21) // parches más grandes para huecos grandes
  const work = new Uint8ClampedArray(d)
  if (exemplarFill(work, hole, W, H, ps)) { // el relleno por parches solo escribe dentro del hueco
    for (let n = 0; n < W * H; n++) if (hole[n]) { d[n * 4] = work[n * 4]; d[n * 4 + 1] = work[n * 4 + 1]; d[n * 4 + 2] = work[n * 4 + 2]; d[n * 4 + 3] = work[n * 4 + 3] }
    ctx.putImageData(img, x0, y0)
    return true
  }

  // Nivel 0: color premultiplicado (r·a, g·a, b·a, a) y peso (1 = píxel conocido)
  let w = W, h = H
  let col = new Float32Array(W * H * 4), wt = new Float32Array(W * H)
  for (let n = 0; n < W * H; n++) {
    if (hole[n]) continue
    const a = d[n * 4 + 3] / 255
    col[n * 4] = d[n * 4] * a; col[n * 4 + 1] = d[n * 4 + 1] * a; col[n * 4 + 2] = d[n * 4 + 2] * a; col[n * 4 + 3] = a
    wt[n] = 1
  }
  const lv = [{ w, h, col, wt }]
  while (w > 1 || h > 1) { // pull: cada nivel promedia solo los píxeles conocidos
    const nw = (w + 1) >> 1, nh = (h + 1) >> 1
    const nc = new Float32Array(nw * nh * 4), nwt = new Float32Array(nw * nh)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = y * w + x, v = wt[n]
      if (!v) continue
      const j = (y >> 1) * nw + (x >> 1)
      nwt[j] += v
      for (let c = 0; c < 4; c++) nc[j * 4 + c] += col[n * 4 + c] * v
    }
    for (let j = 0; j < nw * nh; j++) if (nwt[j] > 0) { for (let c = 0; c < 4; c++) nc[j * 4 + c] /= nwt[j]; nwt[j] = Math.min(1, nwt[j] / 4) }
    w = nw; h = nh; col = nc; wt = nwt
    lv.push({ w, h, col, wt })
  }
  for (let l = lv.length - 2; l >= 0; l--) { // push: los huecos toman el valor (interpolado) del nivel más grueso
    const F = lv[l], C = lv[l + 1]
    for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) {
      const n = y * F.w + x, v = F.wt[n]
      if (v >= 1) continue
      const fx = clamp((x + 0.5) / 2 - 0.5, 0, C.w - 1), fy = clamp((y + 0.5) / 2 - 0.5, 0, C.h - 1)
      const ix = Math.min(C.w - 2, Math.floor(fx)) < 0 ? 0 : Math.min(C.w - 2, Math.floor(fx)), iy = Math.min(C.h - 2, Math.floor(fy)) < 0 ? 0 : Math.min(C.h - 2, Math.floor(fy))
      const tx = C.w > 1 ? fx - ix : 0, ty = C.h > 1 ? fy - iy : 0
      const ix2 = Math.min(C.w - 1, ix + 1), iy2 = Math.min(C.h - 1, iy + 1)
      for (let c = 0; c < 4; c++) {
        const up = (C.col[(iy * C.w + ix) * 4 + c] * (1 - tx) + C.col[(iy * C.w + ix2) * 4 + c] * tx) * (1 - ty)
          + (C.col[(iy2 * C.w + ix) * 4 + c] * (1 - tx) + C.col[(iy2 * C.w + ix2) * 4 + c] * tx) * ty
        F.col[n * 4 + c] = F.col[n * 4 + c] * v + up * (1 - v)
      }
      F.wt[n] = 1
    }
  }

  // Grano del entorno: desviación de cada píxel conocido respecto a la media de sus 4 vecinos
  let s2 = 0, cnt = 0
  for (let y = 1; y < H - 1; y += 2) for (let x = 1; x < W - 1; x += 2) {
    const n = y * W + x
    if (hole[n] || hole[n - 1] || hole[n + 1] || hole[n - W] || hole[n + W] || d[n * 4 + 3] < 250) continue
    const lum = (k) => d[k * 4] * 0.3 + d[k * 4 + 1] * 0.59 + d[k * 4 + 2] * 0.11
    const e = clamp(lum(n) - (lum(n - 1) + lum(n + 1) + lum(n - W) + lum(n + W)) / 4, -25, 25)
    s2 += e * e; cnt++
  }
  const sigma = cnt > 20 ? Math.min(14, Math.sqrt(s2 / cnt) / 1.118) : 0
  const gauss = () => Math.random() + Math.random() + Math.random() - 1.5 // ≈ N(0, 0.5)
  const L0 = lv[0]
  for (let n = 0; n < W * H; n++) {
    if (!hole[n]) continue
    const a = L0.col[n * 4 + 3]
    if (a < 0.004) { d[n * 4 + 3] = 0; continue }
    const g = gauss() * 2 * sigma
    for (let c = 0; c < 3; c++) d[n * 4 + c] = clamp(Math.round(L0.col[n * 4 + c] / a + (a > 0.5 ? g : 0)), 0, 255)
    d[n * 4 + 3] = Math.round(clamp(a, 0, 1) * 255)
  }
  ctx.putImageData(img, x0, y0)
  return true
}

export default function ImageWorkshop({ image, ratioHint, onApply, onClose, canRemoveBg = true, canUpscale = true, onLocked = () => {} }) {
  useLang()
  const [src, setSrc] = useState(image)
  const [origin, setOrigin] = useState(image) // píxeles originales (con el fondo): de aquí restaura el pincel
  const [hist, setHist] = useState([])
  const [nat, setNat] = useState({ w: 1, h: 1 })
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 1, h: 1 })
  const [ratio, setRatio] = useState(null) // null = libre; número = ancho/alto
  const [tool, setTool] = useState('crop') // 'crop' | 'erase' | 'restore'
  const [size, setSize] = useState(40) // diámetro del pincel en px de pantalla
  const [tol, setTol] = useState(28) // tolerancia de color de la varita (0–100)
  const [autoMode, setAutoMode] = useState('erase') // varita: 'erase' borra por color · 'restore' recupera por color
  const [contig, setContig] = useState(true) // true: solo la zona conectada; false: todos los píxeles de ese color
  const [cur, setCur] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [fitW, setFitW] = useState(0)
  const scroller = useRef(null)
  const [busy, setBusy] = useState('')
  const [pct, setPct] = useState(0)
  const [err, setErr] = useState('')
  const box = useRef(null)
  const view = useRef(null)
  const ovl = useRef(null) // capa donde se pinta lo que se quiere quitar (herramienta Objeto)
  const originCv = useRef(null)
  const drag = useRef(null)
  const stroke = useRef(null)
  const lastSize = useRef('')

  // Dibuja la imagen actual en el lienzo visible
  useEffect(() => {
    let on = true
    load(src).then((im) => {
      if (!on) return
      const cv = view.current
      cv.width = im.naturalWidth; cv.height = im.naturalHeight
      const ctx = cv.getContext('2d')
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.drawImage(im, 0, 0)
      if (ovl.current) { ovl.current.width = im.naturalWidth; ovl.current.height = im.naturalHeight }
      setNat({ w: im.naturalWidth, h: im.naturalHeight })
      const sig = `${im.naturalWidth}x${im.naturalHeight}`
      if (sig !== lastSize.current) { lastSize.current = sig; setCrop({ x: 0, y: 0, w: 1, h: 1 }); setRatio(null) }
    })
    return () => { on = false }
  }, [src])
  useEffect(() => {
    let on = true
    load(origin).then((im) => {
      if (!on) return
      const cv = document.createElement('canvas')
      cv.width = im.naturalWidth; cv.height = im.naturalHeight
      cv.getContext('2d').drawImage(im, 0, 0)
      originCv.current = cv
    })
    return () => { on = false }
  }, [origin])
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [busy]) // eslint-disable-line

  // ancho/alto en fracciones ↔ proporción en píxeles
  const hOf = (w, r) => (w * nat.w) / (r * nat.h)
  const wOf = (h, r) => (h * r * nat.h) / nat.w

  const pickRatio = (r) => {
    setRatio(r)
    if (!r) return
    let w = 1, h = hOf(1, r)
    if (h > 1) { h = 1; w = wOf(1, r) }
    setCrop({ x: (1 - w) / 2, y: (1 - h) / 2, w, h })
  }

  // ── Recorte ──
  const start = (e, kind) => {
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const r = box.current.getBoundingClientRect()
    drag.current = { kind, r, px: e.clientX, py: e.clientY, c: { ...crop } }
  }
  const move = (e) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.px) / d.r.width, dy = (e.clientY - d.py) / d.r.height
    const c = d.c
    if (d.kind === 'move') {
      setCrop({ ...c, x: clamp(c.x + dx, 0, 1 - c.w), y: clamp(c.y + dy, 0, 1 - c.h) })
      return
    }
    // esquina: la opuesta queda fija
    const right = d.kind.includes('e'), bottom = d.kind.includes('s')
    const ax = right ? c.x : c.x + c.w, ay = bottom ? c.y : c.y + c.h
    const px = clamp((e.clientX - d.r.left) / d.r.width, 0, 1), py = clamp((e.clientY - d.r.top) / d.r.height, 0, 1)
    const sx = px >= ax ? 1 : -1, sy = py >= ay ? 1 : -1
    let w = Math.abs(px - ax), h = Math.abs(py - ay)
    if (ratio) { const hw = hOf(w, ratio); if (hw <= h) h = hw; else w = wOf(h, ratio) }
    const maxW = sx > 0 ? 1 - ax : ax, maxH = sy > 0 ? 1 - ay : ay
    if (w > maxW) { w = maxW; if (ratio) h = hOf(w, ratio) }
    if (h > maxH) { h = maxH; if (ratio) w = wOf(h, ratio) }
    if (w < MIN || h < MIN) return
    setCrop({ x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h })
  }
  const end = () => { drag.current = null }

  const push = (next, nextOrigin = origin) => {
    setHist((h) => [...h, { src, origin }].slice(-MAX_HIST))
    setSrc(next)
    if (nextOrigin !== origin) setOrigin(nextOrigin)
  }
  const undo = () => {
    const last = hist[hist.length - 1]
    if (!last) return
    setHist(hist.slice(0, -1)); setSrc(last.src); setOrigin(last.origin)
  }

  const full = crop.w > 0.995 && crop.h > 0.995
  const doCrop = async () => {
    if (full) return
    const [a, b] = await Promise.all([cropData(src, crop), origin === src ? null : cropData(origin, crop)])
    push(a, b || a)
  }

  const removeBg = async () => {
    if (!canRemoveBg) return onLocked(t('Quitar el fondo está disponible en el plan PRO PLUS.'))
    setErr(''); setPct(0); setBusy('bg')
    try {
      const { removeBackground } = await import('@imgly/background-removal')
      const blob = await removeBackground(src, {
        output: { format: 'image/png' },
        progress: (_k, cur2, total) => total && setPct(Math.round((cur2 / total) * 100)),
      })
      push(await blobToDataURL(blob)) // el origen se conserva: el pincel puede restaurar desde él
    } catch (e) { setErr(e?.message || String(e)) }
    setBusy('')
  }

  const upscale = async (factor) => {
    if (!canUpscale) return onLocked(t('Ampliar imágenes está disponible en el plan PRO PLUS.'))
    setErr(''); setBusy('up')
    await new Promise((r) => setTimeout(r, 30)) // deja pintar el aviso antes del cálculo pesado
    try {
      const f = Math.min(factor, MAX_SIDE / Math.max(nat.w, nat.h))
      if (f < 1.1) throw new Error(t('La imagen ya tiene el tamaño máximo.'))
      const a = await upscaleData(src, f)
      const b = origin === src ? a : await upscaleData(origin, f)
      push(a, b)
      if (f < factor) setErr(t('Se limitó al tamaño máximo permitido.'))
    } catch (e) { setErr(e?.message || String(e)) }
    setBusy('')
  }

  // ── Pincel (borrar / restaurar) ──
  const pt = (e) => {
    const r = view.current.getBoundingClientRect()
    const k = nat.w / r.width
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, k }
  }
  const seg = (a, b, k) => {
    const ctx = (tool === 'object' ? ovl.current : view.current).getContext('2d')
    ctx.save()
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = size * k
    if (tool === 'object') ctx.strokeStyle = '#ff3c5a' // opaco; la transparencia la pone el CSS para que los trazos no se acumulen
    else if (tool === 'erase') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = '#000' }
    else if (originCv.current) ctx.strokeStyle = ctx.createPattern(originCv.current, 'no-repeat')
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + 0.01, b.y); ctx.stroke()
    ctx.restore()
  }
  // Borrado automático: elimina la zona del color pulsado (varita mágica)
  const magic = (e) => {
    const cv = view.current, ctx = cv.getContext('2d', { willReadFrequently: true })
    const p = pt(e)
    const W = cv.width, H = cv.height
    const sx = clamp(Math.floor(p.x), 0, W - 1), sy = clamp(Math.floor(p.y), 0, H - 1)
    const img = ctx.getImageData(0, 0, W, H), d = img.data
    const restore = autoMode === 'restore'
    let o = null // píxeles originales (solo al restaurar)
    if (restore) {
      const oc = originCv.current
      if (!oc || oc.width !== W || oc.height !== H) return
      o = oc.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data
    }
    const sm = restore ? o : d // imagen de la que se toma el color y la región
    const si = (sy * W + sx) * 4
    if (sm[si + 3] < 10) return // zona transparente: nada que seleccionar
    const r0 = sm[si], g0 = sm[si + 1], b0 = sm[si + 2]
    const lim = (tol / 100) * 441 // distancia máxima RGB (√(3·255²) ≈ 441)
    const lim2 = lim * lim
    const hit = (i) => {
      if (sm[i + 3] < 10) return false
      const dr = sm[i] - r0, dg = sm[i + 1] - g0, db = sm[i + 2] - b0
      return dr * dr + dg * dg + db * db <= lim2
    }
    const mask = new Uint8Array(W * H)
    if (contig) {
      const stack = [sy * W + sx]
      mask[stack[0]] = 1
      while (stack.length) {
        const n = stack.pop()
        const x = n % W, y = (n - x) / W
        if (x > 0 && !mask[n - 1] && hit((n - 1) * 4)) { mask[n - 1] = 1; stack.push(n - 1) }
        if (x < W - 1 && !mask[n + 1] && hit((n + 1) * 4)) { mask[n + 1] = 1; stack.push(n + 1) }
        if (y > 0 && !mask[n - W] && hit((n - W) * 4)) { mask[n - W] = 1; stack.push(n - W) }
        if (y < H - 1 && !mask[n + W] && hit((n + W) * 4)) { mask[n + W] = 1; stack.push(n + W) }
      }
    } else {
      for (let n = 0; n < W * H; n++) if (hit(n * 4)) mask[n] = 1
    }
    for (let n = 0; n < W * H; n++) {
      if (!mask[n]) continue
      const i = n * 4
      if (restore) { d[i] = o[i]; d[i + 1] = o[i + 1]; d[i + 2] = o[i + 2]; d[i + 3] = o[i + 3] }
      else d[i + 3] = 0
    }
    ctx.putImageData(img, 0, 0)
    setHist((h) => [...h, { src, origin }].slice(-MAX_HIST))
    setSrc(cv.toDataURL('image/png'))
  }
  // Borrador mágico: lo pintado en la capa roja desaparece y se rellena con el fondo de alrededor
  const removeObject = (before) => {
    setErr(''); setBusy('obj')
    setTimeout(() => {
      const o = ovl.current, cv = view.current
      try {
        const W = cv.width, H = cv.height
        const px = o.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data
        const mask = new Uint8Array(W * H)
        let any = false
        for (let n = 0; n < W * H; n++) if (px[n * 4 + 3] > 60) { mask[n] = 1; any = true }
        if (any) {
          const r = Math.max(2, Math.round(Math.max(W, H) / 400)) // margen extra para no dejar restos del borde
          const oc = originCv.current
          let nextOrigin = null
          if (oc && oc.width === W && oc.height === H) { // el original también se limpia: "Restaurar" no debe devolver el objeto
            const c2 = document.createElement('canvas')
            c2.width = W; c2.height = H
            c2.getContext('2d').drawImage(oc, 0, 0)
            if (inpaintCanvas(c2, mask, r)) nextOrigin = c2.toDataURL('image/png')
          }
          if (inpaintCanvas(cv, mask, r)) {
            setHist((h) => [...h, { src: before, origin }].slice(-MAX_HIST))
            setSrc(cv.toDataURL('image/png'))
            if (nextOrigin) setOrigin(nextOrigin)
          }
        }
      } catch (e) { setErr(e?.message || String(e)) }
      o.getContext('2d').clearRect(0, 0, o.width, o.height)
      setBusy('')
    }, 30)
  }
  const brushDown = (e) => {
    if (tool === 'crop' || busy) return
    e.preventDefault()
    if (tool === 'magic') { magic(e); return }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const p = pt(e)
    stroke.current = { last: p, before: src }
    seg(p, p, p.k)
  }
  const brushMove = (e) => {
    if (tool === 'crop' || tool === 'magic') return
    const fr = box.current.getBoundingClientRect()
    setCur({ x: e.clientX - fr.left, y: e.clientY - fr.top })
    const s = stroke.current
    if (!s) return
    const p = pt(e)
    seg(s.last, p, p.k)
    s.last = p
  }
  const brushUp = () => {
    const s = stroke.current
    if (!s) return
    stroke.current = null
    if (tool === 'object') { removeObject(s.before); return }
    const out = view.current.toDataURL('image/png')
    setHist((h) => [...h, { src: s.before, origin }].slice(-MAX_HIST))
    setSrc(out)
  }

  const apply = () => onApply(src)
  const ratios = [[null, 'Libre'], [1, '1:1'], [4 / 5, '4:5'], [16 / 9, '16:9'], [9 / 16, '9:16']]
  if (ratioHint) ratios.push([ratioHint, 'Formato'])
  const pctS = (v) => `${v * 100}%`
  const brush = tool !== 'crop'

  // ── Zoom ──
  const zoomBy = (d) => setZoom((z) => clamp(+(z + d).toFixed(2), ZMIN, ZMAX))
  const wheel = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return // rueda normal = desplazar; Ctrl + rueda = zoom
    e.preventDefault()
    zoomBy(e.deltaY < 0 ? 0.25 : -0.25)
  }
  // Arrastrar para desplazar: botón central, o con el recorte completo (arrastrar la imagen)
  const panDown = (e) => {
    const sc = scroller.current
    const onCrop = !brush && full && e.target.closest?.('.ws-crop') && !e.target.closest('.ws-h')
    if (!sc || !(e.button === 1 || onCrop)) return
    if (sc.scrollWidth <= sc.clientWidth && sc.scrollHeight <= sc.clientHeight) return
    e.preventDefault(); e.stopPropagation()
    const s = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop }
    sc.style.cursor = 'grabbing'
    const mv = (ev) => { sc.scrollLeft = s.l - (ev.clientX - s.x); sc.scrollTop = s.t - (ev.clientY - s.y) }
    const up = () => { sc.style.cursor = ''; window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }
  // Tamaño "ajustado" de la imagen (cabe en el visor); el zoom lo multiplica
  useEffect(() => {
    const calc = () => {
      const el = scroller.current
      if (!el) return
      const cw = el.clientWidth - 20
      const maxH = window.innerHeight * (window.matchMedia('(max-width: 760px)').matches ? 0.46 : 0.62)
      setFitW(Math.max(40, Math.min(cw, maxH * (nat.w / nat.h))))
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [nat])

  return (
    <div className="modal-bg ws-bg" onClick={() => !busy && onClose()}>
      <div className="ws" onClick={(e) => e.stopPropagation()}>
        <div className="ws-top">
          <h4>{t('Editor de imagen')}</h4>
          <button className="btn ghost sm" disabled={!!busy} onClick={onClose}>✕</button>
        </div>

        <div className="ws-viewbox">
        <div className="ws-view" ref={scroller} onWheel={wheel} onPointerDownCapture={panDown}>
          <div className={'ws-frame' + (brush ? (tool === 'magic' ? ' wand' : ' brush') : '')} ref={box}
            style={{ aspectRatio: `${nat.w}/${nat.h}`, ...(fitW ? { width: fitW * zoom, maxWidth: 'none', maxHeight: 'none' } : {}) }}
            onPointerDown={brushDown} onPointerMove={brushMove} onPointerUp={brushUp} onPointerCancel={brushUp} onPointerLeave={() => setCur(null)}>
            <canvas ref={view} />
            <canvas ref={ovl} className="ws-ovl" aria-hidden="true" />
            {!brush && <>
              <div className="ws-shade" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${pctS(crop.x)} ${pctS(crop.y)},${pctS(crop.x)} ${pctS(crop.y + crop.h)},${pctS(crop.x + crop.w)} ${pctS(crop.y + crop.h)},${pctS(crop.x + crop.w)} ${pctS(crop.y)},${pctS(crop.x)} ${pctS(crop.y)})` }} />
              <div className="ws-crop" onPointerDown={(e) => start(e, 'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
                style={{ left: pctS(crop.x), top: pctS(crop.y), width: pctS(crop.w), height: pctS(crop.h) }}>
                {['nw', 'ne', 'sw', 'se'].map((k) => (
                  <i key={k} className={'ws-h ' + k} onPointerDown={(e) => start(e, k)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
                ))}
              </div>
            </>}
            {brush && tool !== 'magic' && cur && <i className={'ws-cursor ' + tool} style={{ left: cur.x, top: cur.y, width: size, height: size }} />}
          </div>
        </div>
        <div className="ws-zoom" role="group" aria-label="Zoom">
          <button onClick={() => zoomBy(-0.25)} disabled={zoom <= ZMIN} title="Zoom −" aria-label="Zoom −">−</button>
          <button className="val" onClick={() => setZoom(1)} title={t('Ajustar')}>{Math.round(zoom * 100)}%</button>
          <button onClick={() => zoomBy(0.25)} disabled={zoom >= ZMAX} title="Zoom +" aria-label="Zoom +">+</button>
        </div>
          {busy && (
            <div className="ws-busy">
              <span className="ws-spin" />
              {busy === 'up' ? <b>{t('Mejorando la calidad…')}</b> : busy === 'obj' ? <b>{t('Quitando el objeto…')}</b> : <>
                <b>{t('Quitando el fondo…')} {pct > 0 ? `${pct}%` : ''}</b>
                <small>{t('La primera vez descarga el modelo (puede tardar un poco)')}</small>
              </>}
            </div>
          )}
        </div>

        <div className="ws-tools">
          <div className="ws-tabs" role="tablist">
            {TOOLS.map(([v, l, ic]) => (
              <button key={v} role="tab" aria-selected={tool === v} className={tool === v ? 'on' : ''} disabled={!!busy} onClick={() => setTool(v)}>
                <WsIcon d={ic} /><span>{t(l)}</span>
              </button>
            ))}
          </div>

          <div className="ws-card" key={tool}>
            {tool === 'crop' && (
              <>
                <div className="ws-label">{t('Proporción')}</div>
                <div className="chips">
                  {ratios.map(([r, l]) => (
                    <button key={l} className={'chip' + (ratio === r ? ' on' : '')} disabled={!!busy} onClick={() => pickRatio(r)}>{t(l)}</button>
                  ))}
                </div>
                <button className="btn ws-wide" disabled={!!busy || full} onClick={doCrop}>{t('Recortar')}</button>
                <p className="ws-hint">{t('Arrastra el recuadro o sus esquinas para elegir el recorte. Al quitar el fondo se verá el Color de fondo detrás.')}</p>
              </>
            )}

            {tool === 'magic' && (
              <>
                <div className="ws-pills">
                  {[['erase', 'Borrar'], ['restore', 'Restaurar']].map(([v, l]) => (
                    <button key={v} className={autoMode === v ? 'on' : ''} onClick={() => setAutoMode(v)}>{t(l)}</button>
                  ))}
                </div>
                <Slider label={t('Tolerancia')} min={0} max={100} value={tol} onChange={setTol} />
                <label className="ws-switch">
                  <input type="checkbox" checked={contig} onChange={(e) => setContig(e.target.checked)} />
                  <i /><span>{t('Solo la zona conectada')}</span>
                </label>
                <p className="ws-hint">{autoMode === 'erase' ? t('Toca un color de la imagen y se borra esa zona. Sube la tolerancia para incluir tonos parecidos.') : t('Toca una zona borrada y se recupera desde la imagen original, según el color de esa zona. Sube la tolerancia para incluir tonos parecidos.')}</p>
              </>
            )}

            {(tool === 'erase' || tool === 'restore' || tool === 'object') && (
              <>
                <Slider label={t('Tamaño')} min={8} max={160} value={size} onChange={setSize} unit="px" />
                <p className="ws-hint">{tool === 'erase' ? t('Pinta sobre la imagen para borrar esa zona (se vuelve transparente).') : tool === 'restore' ? t('Pinta para recuperar lo borrado, tomándolo de la imagen original.') : t('Pinta sobre el elemento que quieres quitar y suelta: desaparece y el fondo se rellena solo. Funciona mejor con fondos lisos, degradados o con textura suave; si quedan restos, pinta de nuevo o usa Deshacer.')}</p>
              </>
            )}
          </div>

          <div className="ws-card">
            <div className="ws-label">{t('Fondo')}</div>
            <div className="ws-actions">
              <button className="btn ghost sm" disabled={!!busy} onClick={removeBg}><WsIcon d={IC.wand} /> {t('Quitar fondo')}{!canRemoveBg && ' 🔒'}</button>
              <button className="btn ghost sm" disabled={!!busy || !hist.length} onClick={undo}><WsIcon d={IC.undo} /> {t('Deshacer')}</button>
            </div>
          </div>

          <div className="ws-card">
            <div className="ws-label">{t('Mejorar calidad')}<em>{nat.w}×{nat.h}px</em></div>
            <div className="ws-pills ws-scale">
              <button disabled={!!busy} onClick={() => upscale(2)}>×2{!canUpscale && ' 🔒'}</button>
              <button disabled={!!busy} onClick={() => upscale(4)}>×4{!canUpscale && ' 🔒'}</button>
            </div>
          </div>

          {err && <p className="ws-err">{err}</p>}
          <div className="ws-foot">
            <button className="btn ghost" disabled={!!busy} onClick={onClose}>{t('Cancelar')}</button>
            <button className="btn" disabled={!!busy || !hist.length} onClick={apply}>{t('Aplicar')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Piezas de interfaz ──
const IC = {
  crop: 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14',
  erase: 'M20 20H9l-5.3-5.3a1 1 0 0 1 0-1.4l9.6-9.6a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L12 20M7 11l6 6',
  restore: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  wand: 'M15 4V2m0 14v-2m-7-5H6m18 0h-2m-2.8-4.2-1.4 1.4m0 7.6 1.4 1.4M3 21l9-9m1-1 1 1',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  object: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z',
}
const SHOW_OBJECT_TOOL = false // borrador mágico (Objeto): oculto por ahora; ponlo en true para volver a mostrarlo
const TOOLS = [['crop', 'Recortar', IC.crop], ['erase', 'Borrar', IC.erase], ['restore', 'Restaurar', IC.restore], ...(SHOW_OBJECT_TOOL ? [['object', 'Objeto', IC.object]] : []), ['magic', 'Auto', IC.wand]]

function WsIcon({ d }) {
  return <svg className="ws-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
}

function Slider({ label, min, max, value, onChange, unit = '' }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="ws-slider">
      <div className="ws-label">{label}<em>{value}{unit}</em></div>
      <input type="range" min={min} max={max} value={value} style={{ '--p': pct + '%' }} onChange={(e) => onChange(+e.target.value)} />
    </div>
  )
}
