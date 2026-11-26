// Generador automático para Global Zion (www.globalzion.cl): crea una publicación completa sobre creación de páginas web
// con la paleta y la información de la web. Puede partir de una frase del usuario o, si se deja vacío, de una idea al azar.
import { PLATFORMS, newLayer, uid } from './formats.js'
import { FX_DEFAULT, renderToDataURL } from './render.js'
import { generateCaptionAI, generateImageAI, generateLayerTextsAI, shrinkImage, suggestHashtags } from './social.js'
import { BG_PRESETS, BRAND, buildContent } from './brand.js'
import { buildDesign, paintPalette, lightBottom, pickDeco, CONTACT_STYLES, DECOS } from './designs.js'
import { vetImage } from './imageQuality.js'
import { t } from './i18n.jsx'

const pick = (a) => a[Math.floor(Math.random() * a.length)]
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+|\b[a-z0-9-]+\.(?:cl|com|net|org|io|co|app|dev)\b[^\s]*)/i
const toLocalInput = (ts) => new Date(ts - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)

// Paletas empresariales (no solo azul): fondo en degradado + color de acento + descripción para la imagen de IA
export const PALETTES = [
  { id: 'blue', dark: true, c1: '#020618', c2: '#0f2a5c', c3: '#1d6fb8', angle: 160, accent: '#38bdf8', ai: 'vivid electric blue and bright cyan with luminous white highlights and a few navy shadows' },
  { id: 'ocean', dark: true, c1: '#0b1b3f', c2: '#1d6fb8', c3: '', angle: 140, accent: '#7cc0ff', ai: 'corporate royal blue and sky blue with soft white light' },
  { id: 'orange', dark: true, c1: '#111827', c2: '#1f2937', c3: '#7c2d12', angle: 150, accent: '#fb923c', ai: 'charcoal gray and warm burnt orange accents with soft amber light' },
  { id: 'graphite-yellow', dark: true, c1: '#0f172a', c2: '#1f2937', c3: '#374151', angle: 160, accent: '#fbbf24', ai: 'graphite gray and slate with golden yellow highlights' },
  { id: 'teal', dark: true, c1: '#06283d', c2: '#0e7490', c3: '', angle: 150, accent: '#2dd4bf', ai: 'deep petrol teal and emerald green with soft mint light' },
  { id: 'gold', dark: true, c1: '#020618', c2: '#0f2a5c', c3: '#92400e', angle: 165, accent: '#f5b942', ai: 'dark navy blue with elegant gold and champagne highlights' },
  { id: 'light-orange', dark: false, c1: '#ffffff', c2: '#e5e7eb', c3: '', angle: 160, accent: '#ea580c', ai: 'bright clean white and light gray with a touch of orange, airy minimalist daylight' },
  { id: 'light-blue', dark: false, c1: '#f4f9ff', c2: '#cfe3f7', c3: '', angle: 135, accent: '#1d6fb8', ai: 'bright white and pale sky blue, airy minimalist daylight' },
]

// Escenas fotográficas empresariales (oficinas, computadores, páginas web), sin personas
export const PHOTO_SCENES = [
  'a modern bright empty office with desks, large windows and laptops, shallow depth of field',
  'a sleek laptop on a clean desk showing an abstract website layout made of colored blocks and wireframes, soft studio lighting',
  'close-up of a widescreen monitor displaying an abstract modern web page design with blurred shapes, no readable text',
  'a tidy minimalist workspace with a laptop, notebook and a small plant, seen from above',
  'abstract 3D web design wireframe blocks and browser windows floating in soft light',
  'a contemporary open-plan office with glass walls and monitors, blurred background, cinematic',
  'a desktop computer and tablet showing a responsive website mockup with abstract shapes, clean desk',
]


// ---- Colores infinitos: cualquier tono de la rueda de color, siempre sobrio y empresarial ----
function hsl(h, sat, l) {
  h = ((h % 360) + 360) % 360; sat /= 100; l /= 100
  const k = (n) => (n + h / 30) % 12, a = sat * Math.min(l, 1 - l)
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0')
  return '#' + f(0) + f(8) + f(4)
}
const HUE_NAMES = [[12, 'red'], [40, 'orange'], [62, 'golden yellow'], [80, 'lime green'], [150, 'green'], [170, 'emerald'], [195, 'teal'], [215, 'sky blue'], [250, 'blue'], [270, 'indigo'], [300, 'violet'], [330, 'magenta'], [350, 'rose'], [361, 'red']]
const hueName = (h) => HUE_NAMES.find(([m]) => ((h % 360) + 360) % 360 < m)[1]

/** Paleta nueva a partir de un tono (al azar si no se da). Mismo formato que PALETTES. */
export function makePalette({ hue, dark = true, avoid, exact = false } = {}) {
  let h = hue ?? Math.random() * 360
  if (hue == null && avoid != null) { let n = 0; while (Math.abs(((h - avoid + 540) % 360) - 180) < 40 && n++ < 20) h = Math.random() * 360 }
  h = Math.round(h)
  // `exact`: el usuario pidió un color, así que el acento es justo ese
  const ah = exact ? h : Math.round(h + pick([0, 0, 30, -30, 180, 150, -150]))
  // tonos amarillo-verdosos y naranjas: el fondo se mantiene grafito (tintar el fondo con ellos se ve sucio) y el color va en el acento
  const neutral = h >= 20 && h <= 110
  const bh = neutral ? 218 : h
  const bgName = neutral ? 'charcoal gray' : hueName(h)
  const accName = hueName(ah)
  if (dark) {
    return {
      id: 'h' + h, hue: h, dark: true, angle: pick([135, 150, 160, 170]),
      c1: hsl(bh, neutral ? 30 : 70, 6), c2: hsl(bh, neutral ? 24 : 62, 16), c3: Math.random() < 0.6 ? hsl(neutral ? h : bh + pick([-18, 0, 18]), 62, neutral ? 24 : 30) : '',
      accent: hsl(ah, 88, 62),
      ai: `${bgName} dark tones with ${accName} glowing highlights and soft white light`,
    }
  }
  return {
    id: 'h' + h, hue: h, dark: false, angle: pick([135, 160]),
    c1: hsl(bh, 40, 98), c2: hsl(bh, 38, 88), c3: '',
    accent: hsl(ah, 80, 38),
    ai: `bright clean white and pale ${neutral ? 'gray' : bgName} with ${accName} accents, airy minimalist daylight`,
  }
}

/** Tono dominante (0-360) de una imagen, ponderado por saturación; null si es casi gris. */
export function dominantHue(dataUrl) {
  return new Promise((res) => {
    const im = new Image()
    im.onerror = () => res(null)
    im.onload = () => {
      const N = 48, c = document.createElement('canvas'); c.width = N; c.height = N
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(im, 0, 0, N, N)
      const d = ctx.getImageData(0, 0, N, N).data
      let x = 0, y = 0, w = 0
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn
        if (dl < 0.12 || l < 0.12 || l > 0.9) continue
        const sat = dl / (1 - Math.abs(2 * l - 1))
        let h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4
        h = (h * 60 + 360) % 360
        const wt = sat * dl
        x += Math.cos((h * Math.PI) / 180) * wt; y += Math.sin((h * Math.PI) / 180) * wt; w += wt
      }
      res(w < 2 ? null : Math.round(((Math.atan2(y, x) * 180) / Math.PI + 360) % 360))
    }
    im.src = dataUrl
  })
}

/**
 * Intenta armar la variante con foto de IA: hasta 2 imágenes, cada una debe aprobar el filtro de píxeles y la revisión de visión.
 * Devuelve { design, why }: design es null si ninguna imagen aprobó (why = motivos del rechazo).
 */
export async function photoVariant(base, { prompt, context, info, onStep = () => {} }) {
  let good = null, why = []
  try {
    for (let i = 0; i < 2 && !good; i++) {
      onStep(t('Creando la imagen con IA…'))
      const raw = await generateImageAI({ prompt, aspectRatio: '1:1' })
      onStep(t('Revisando la calidad de la imagen…'))
      const q = await vetImage(raw, { context, strict: true })
      if (q.ok) good = raw; else why = q.reasons
    }
  } catch (e) {
    const m = String(e?.message || '')
    return { design: null, why: [/\b402\b/.test(m) ? t('el generador gratuito de imágenes ahora pide créditos (error 402)') : (m || t('no se pudo generar'))] }
  }
  if (!good) return { design: null, why }
  const img = await shrinkImage(good, 1080)
  // El color de acento se toma de la imagen para que combine con ella; cada foto estrena una composición distinta
  let palette = base.auto.palette
  try {
    const hue = await dominantHue(img || good)
    if (hue != null) palette = { ...makePalette({ hue, dark: true }), accent: hsl(hue, 85, 64) }
  } catch { /* se conservan los colores base */ }
  return { why: [], design: photoDesign(base, info, img || good, palette) }
}

/** Diseño con una foto de fondo (de la IA o de la web), oscurecida para que los textos se lean. */
export function photoDesign(base, info, image, palette = base.auto.palette, options = {}) {
  const look = buildDesign({ info, palette, photo: true, ...options })
  return {
    ...look,
    bg: { ...look.bg, prompt: base.bg.prompt, scene: base.bg.scene, type: 'image', image, dim: 0.58, fx: { ...FX_DEFAULT, detail: 30, contrast: 108, saturate: 105, vignette: 28 } },
  }
}

/** Foto elegida de la web como fondo: el color de acento se toma de la propia foto. */
export async function webPhotoVariant(base, { image, info }) {
  let palette = base.auto.palette
  try {
    const hue = await dominantHue(image)
    if (hue != null) palette = { ...makePalette({ hue, dark: true }), accent: hsl(hue, 85, 64) }
  } catch { /* se conservan los colores base */ }
  return photoDesign(base, info, image, palette)
}

// Tono (0-360) de un color #rrggbb
function hexHue(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const mx = Math.max(r, g, b), d = mx - Math.min(r, g, b)
  if (!d) return 215
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return Math.round((h * 60 + 360) % 360)
}

// ---- Colores al azar que combinan ----
// Tonos que van con cada tema (id de ANGLES en brand.js)
const THEME_HUES = {
  database: [205, 188, 232], quoter: [215, 42, 160], crm: [262, 215, 170], hr: [172, 28, 265], tools: [200, 185, 250],
  pc: [190, 150, 215], custom: [195, 265, 158], wordpress: [205, 190, 45], plans: [43, 160, 215], time: [28, 190, 46],
  speed: [22, 48, 188], maintenance: [176, 205, 40], security: [150, 175, 205], store: [25, 335, 150], how: [215, 170, 40],
  trust: [210, 170, 42], services: [200, 42, 25], growth: [145, 40, 200],
}
const hueGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180)
// Contraste entre dos colores según WCAG (1 = iguales, 21 = blanco y negro)
const relLum = (hex) => [1, 3, 5]
  .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
const contrast = (a, b) => { const [x, y] = [relLum(a), relLum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
const isGray = (hex) => { const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return Math.max(...v) - Math.min(...v) < 28 }

/**
 * Colores al azar para los elementos y las letras, que combinan con el fondo (el tono de la foto o del degradado)
 * y con el tema de la publicación. El fondo no cambia y se asegura el contraste para que todo se lea.
 */
export async function smartColors(design, info) {
  const { palette, photo } = design.auto
  const dark = photo || palette.dark
  const back = photo ? '#101828' : palette.c2.slice(0, 7) // las fotos van oscurecidas
  let base = null
  if (photo) { try { base = await dominantHue(design.bg.image) } catch { /* se usa solo el tema */ } }
  else if (!isGray(back)) base = hexHue(back)
  const theme = THEME_HUES[buildContent(`${info.prompt || ''} ${info.kicker} ${info.title}`).angle.id] || THEME_HUES.services
  // análogos y complementarios del fondo, más los tonos del tema
  // con fondo gris, la rueda parte del color principal del tema
  const wheel = [0, 28, -28, 180, 152, -152].map((d) => ((base ?? theme[0]) + d + 360) % 360)
  const all = [...wheel, ...theme, ...theme]
  const current = hexHue(palette.accent.slice(0, 7))
  const fresh = all.filter((h) => hueGap(h, current) >= 24)
  const hue = pick(fresh.length ? fresh : all)
  const sat = 72 + Math.round(Math.random() * 20)
  let light = (dark ? 54 : 30) + Math.round(Math.random() * 14)
  let accent = hsl(hue, sat, light)
  while (contrast(accent, back) < (dark ? 4 : 3.2) && light > 14 && light < 86) {
    light += dark ? 3 : -3
    accent = hsl(hue, sat, light)
  }
  const tint = base ?? hue
  const wanted = dark ? pick(['#ffffff', '#ffffff', hsl(hue, 70, 92), hsl(tint, 45, 93)]) : pick(['#0f172a', hsl(tint, 55, 13), hsl(hue, 55, 14)])
  const text = contrast(wanted, back) >= 4.5 ? wanted : dark ? '#ffffff' : '#0f172a'
  return { accent, text }
}

// ---- Barra al azar con los colores de la imagen ----
/** Hasta tres tonos distintos y predominantes de una imagen; vacío si es casi gris. */
function imageHues(dataUrl) {
  return new Promise((res) => {
    const im = new Image()
    im.onerror = () => res([])
    im.onload = () => {
      const N = 64, c = document.createElement('canvas'); c.width = N; c.height = N
      const ctx = c.getContext('2d', { willReadFrequently: true })
      ctx.drawImage(im, 0, 0, N, N)
      const d = ctx.getImageData(0, 0, N, N).data
      const bins = new Array(24).fill(0)
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, dl = mx - mn
        if (dl < 0.12 || l < 0.1 || l > 0.92) continue
        const h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4
        bins[Math.floor((((h * 60 + 360) % 360) / 15)) % 24] += (dl / (1 - Math.abs(2 * l - 1))) * dl
      }
      const total = bins.reduce((a, b) => a + b, 0)
      const found = []
      for (const [weight, i] of bins.map((w, i) => [w, i]).sort((a, b) => b[0] - a[0])) {
        const hue = i * 15 + 7
        if (total < 2 || weight < total * 0.05 || found.length === 3) break
        if (found.every((h) => hueGap(h, hue) >= 30)) found.push(hue)
      }
      res(found)
    }
    im.src = dataUrl
  })
}

/** Color del tono pedido sobre el que las letras (blancas u oscuras) se leen bien. */
function readableFill(hue, sat, light) {
  const white = contrast('#ffffff', hsl(hue, sat, light)) >= contrast('#0b1220', hsl(hue, sat, light))
  const text = white ? '#ffffff' : '#0b1220'
  let l = light
  while (contrast(text, hsl(hue, sat, l)) < 4.5 && l > 8 && l < 92) l += white ? -2 : 2
  return { fill: hsl(hue, sat, l), text }
}

/** Colores del pie con los tonos de la imagen: `main` para el fondo y `extra` para líneas y el segundo bloque. */
function footColors(main, extra, tone, onPaper, gray) {
  const s = (v) => (gray ? Math.min(v, 14) : v)
  const jitter = () => Math.round(Math.random() * 8) - 4
  const base = tone === 'deep' ? { fill: hsl(main, s(60), 12 + jitter()), text: '#ffffff' }
    : tone === 'soft' ? { fill: hsl(main, s(55), 94 + jitter() / 2), text: hsl(main, s(65), 13) }
      : readableFill(main, s(76), 46 + jitter() * 2)
  const fill2 = tone === 'deep' ? hsl(extra, s(62), 22) : tone === 'soft' ? hsl(extra, s(60), 88) : hsl(extra, s(76), base.text === '#ffffff' ? 30 : 64)
  const second = readableFill(extra, s(80), tone === 'vivid' ? 22 : 52)
  return {
    ...base,
    fill2: contrast(base.text, fill2) >= 4.5 ? fill2 : base.fill,
    line: hsl(extra, s(86), onPaper ? 38 : 62),
    alt: second.fill,
    altText: second.text,
  }
}

/**
 * Estilo de web y WhatsApp al azar, pintado con los colores de la imagen de fondo (la foto, o el degradado y su acento).
 * Devuelve el cambio para `restyle`.
 */
export async function smartFooter(design) {
  const { palette, photo, layout, contact } = design.auto
  let hues = []
  if (photo) { try { hues = await imageHues(design.bg.image) } catch { /* se usa el acento */ } }
  else hues = [palette.c2, palette.c3, palette.accent].filter((c) => c && !isGray(c.slice(0, 7))).map((c) => hexHue(c.slice(0, 7)))
  const gray = !hues.length && isGray(palette.accent.slice(0, 7))
  if (!hues.length) hues = [hexHue(palette.accent.slice(0, 7))]
  // los estilos verdes no entran: su color es fijo y no seguiría al de la imagen
  const style = pick(CONTACT_STYLES.filter((x) => !x.green && x.id !== contact))
  const bare = ['line', 'frame-line', 'plain'].includes(style.id)
  const onPaper = lightBottom(layout, palette, photo)
  const tone = style.tone || (style.id === 'pill-outline' ? (onPaper ? 'soft' : 'deep') : pick(['deep', 'deep', 'vivid', 'soft']))
  const main = pick(hues)
  const others = hues.filter((h) => hueGap(h, main) >= 25)
  const extra = others.length ? pick(others) : (main + pick([28, -28, 40, -40]) + 360) % 360
  const colors = footColors(main, extra, tone, onPaper, gray)
  // sin fondo propio solo se pintan las líneas: las letras siguen sobre el diseño
  return { contact: style.id, foot: bare ? { line: colors.line } : colors }
}

/**
 * Cambia el aspecto de un diseño ya armado. `change` admite: layout (id de composición), mode ('dark'|'light'),
 * hue (0-360), logo ('light'|'dark'), deco (patrón o 'none'), contact (id de CONTACT_STYLES), colors ({ accent, bg, text })
 * foot (colores del pie sacados de la imagen) y removePhoto. Lo que no venga se mantiene.
 */
export function restyle(design, info, change = {}) {
  const was = design.auto
  const photo = was.photo && !change.removePhoto
  let { palette } = was
  if (change.hue != null || change.mode || change.removePhoto) {
    const hue = change.hue ?? palette.hue ?? hexHue(palette.accent)
    palette = makePalette({ hue, dark: change.mode ? change.mode === 'dark' : palette.dark, exact: change.hue != null })
  }
  if (change.colors) palette = paintPalette(palette, change.colors)
  // los colores del pie salidos de la imagen se descartan si se elige otro estilo o cambia el fondo
  const newBack = change.hue != null || change.mode || change.removePhoto || change.colors?.bg
  const foot = change.foot !== undefined ? change.foot : change.contact || newBack ? null : was.foot
  const deco = change.deco === 'none' ? null : DECOS.includes(change.deco) ? change.deco : design.bg.deco?.type || pickDeco()
  const d = buildDesign({ info, palette, layout: change.layout || was.layout, logo: change.logo || was.logo, contact: change.contact || was.contact, foot, photo, deco })
  if (photo) return { ...d, bg: design.bg }
  return { ...d, bg: { ...d.bg, prompt: design.bg.prompt, scene: design.bg.scene } }
}

/** Vuelve a armar la plantilla B (fondo con las herramientas de la app) con otra composición y paleta, sin usar IA. */
export function toolsVariant(info) {
  const dark = Math.random() < 0.75
  const palette = makePalette({ dark, avoid: info.hue })
  const d = buildDesign({ info, palette })
  return { design: { ...d, bg: { ...d.bg, prompt: info.prompt, scene: info.scene } }, palette: palette.id, hue: palette.hue }
}

/** Cambia los textos de un diseño ya armado (chat de correcciones) sin tocar su composición, colores ni fondo. */
export function retext(design, info) {
  const { layout, palette, photo, logo, contact, foot } = design.auto
  return { ...design, layers: buildDesign({ info, palette, layout, photo, logo, contact, foot, deco: null }).layers }
}

/** Devuelve el estado completo del Composer (misma forma que su trabajo en curso). `text` puede ir vacío. */
export async function generateAutoPost({ text = '', platforms, withImage, onStep = () => {} }) {
  const userText = text.trim()
  const c = buildContent(userText)
  const link = (userText.match(URL_RE) || [])[0]?.replace(/[.,;)]+$/, '') || BRAND.site
  // Tema para la IA (máx. 300 caracteres que admite el servidor)
  const topic = `${userText ? userText + '. ' : ''}${c.title}: ${c.points.slice(0, 3).join('; ')}`.slice(0, 300)
  const nets = platforms.length ? platforms : ['instagram']
  const tone = /invit|ofert|descuent|promo|compra|reserva|gratis|desde \$|plan/i.test(topic) ? 'promocional' : 'profesional'

  // 1 · Diseño con la paleta de Global Zion; la IA mejora la etiqueta y el título, los puntos salen de la web
  onStep(t('Eligiendo el diseño…'))
  let kicker = c.kicker, title = c.title
  onStep(t('Escribiendo los textos…'))
  if (userText) {
    try {
      const [k, ti] = await generateLayerTextsAI({ layers: [{ text: kicker, size: 34, y: 0.09 }, { text: title, size: 84, y: 0.21 }], topic })
      if (k && k.length <= 28) kicker = k
      if (ti && ti.length <= 44) title = ti
    } catch { /* se conservan los textos de la web */ }
  }
  // Paleta: ~75 % oscuras; se varía el color para no repetir siempre el azul
  const wantDark = Math.random() < 0.75
  const palette = Math.random() < 0.8 ? makePalette({ dark: wantDark }) : pick(PALETTES.filter((p) => p.dark === wantDark))
  const content = { kicker, title, points: c.points, link }
  let design = buildDesign({ info: content, palette })

  // 2 · Dos opciones de fondo: A) foto de IA (solo si aprueba el control de calidad) y B) hecho con las herramientas de la app
  const prompt = `${userText ? 'Idea: ' + userText.replace(URL_RE, '').trim() + '. ' : ''}Premium corporate social media background about ${c.about}:${Math.random() < 0.75 ? pick(PHOTO_SCENES) : c.scene}. Color palette: ${palette.ai}, well lit, bright mid-tones, strong contrast, sharp details, professional business look, modern, clean, empty space for text. Absolutely no text, letters, numbers, logos or watermarks, nothing readable on any screen. No people, faces or hands.`
  // Se memoriza lo que escribió el usuario (o el tema elegido) para poder regenerar la imagen desde el editor
  const baseDesign = { ...design, bg: { ...design.bg, prompt: userText || c.title, scene: c.scene } }
  const context = userText || c.title
  const info = { ...content, prompt: userText || c.title, scene: c.scene, palette: palette.id, hue: palette.hue }
  const options = { photo: null, why: null, base: baseDesign, prompt, context, info }
  if (withImage) {
    // Plazo total: si la imagen de IA se demora, se sigue con la opción B en vez de dejar todo cargando
    let timer
    const late = new Promise((res) => { timer = setTimeout(() => res({ design: null, why: [t('la imagen de IA tardó demasiado')] }), 150000) })
    const r = await Promise.race([photoVariant(baseDesign, { prompt, context, info, onStep }), late]).finally(() => clearTimeout(timer))
    options.photo = r.design
    options.why = r.design ? null : r.why
  }
  design = baseDesign

  // 3 · Texto de la publicación + hashtags de marca
  onStep(t('Redactando el texto de la publicación…'))
  const maxLen = Math.min(...nets.map((p) => PLATFORMS[p].limit))
  const maxTags = Math.min(...nets.map((p) => PLATFORMS[p].maxTags))
  let caption
  try {
    const image = await shrinkImage(await renderToDataURL(design, 'image/jpeg', 0.8, 768))
    caption = await generateCaptionAI({ topic, tone, networks: nets.map((p) => PLATFORMS[p].name), maxLen, maxTags, mediaType: 'photo', image })
  } catch { caption = [title, c.points.map((p) => '✅ ' + p).join(String.fromCharCode(10)), '👉 ' + BRAND.site].join(String.fromCharCode(10, 10)) }
  if (!caption.includes(link)) caption = `${caption.trim()}\n\n🔗 ${link}`
  const have = (caption.match(/#[\p{L}\p{N}_]+/gu) || []).length
  const want = Math.min(6, maxTags)
  if (have < want) {
    const present = caption.toLowerCase()
    const extra = [...BRAND.hashtags, ...suggestHashtags(topic)].filter((h, i, a) => a.indexOf(h) === i && !present.includes(h.toLowerCase())).slice(0, want - have)
    if (extra.length) caption = `${caption.trim()}\n\n${extra.join(' ')}`
  }
  if (caption.length > maxLen) caption = caption.slice(0, maxLen - 1).trimEnd() + '…'

  return {
    id: uid(), editing: false, createdAt: null, design, caption, platforms: nets,
    subject: '', recipients: '', when: toLocalInput(Date.now() + 3600e3), topic: userText, tone, useImage: true, mediaType: 'photo', video: null, options,
  }
}

/** Deja el resultado como trabajo en curso de «publicación nueva»; el Composer lo carga al abrirse. */
export function saveAsWip(sessionId, snap) {
  localStorage.setItem(`gz_wip_${sessionId || 'anon'}_new`, JSON.stringify(snap))
}
