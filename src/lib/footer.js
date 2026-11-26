// Pie de contacto de las publicaciones: la web y el WhatsApp van siempre juntos, en una barra o en una píldora.
import { newLayer } from './formats.js'
import { BRAND } from './brand.js'

const NAVY = '#0b1b3f'
const DARK = '#080f1e'
const WA_GREEN = '#128c4a'

// `tone`: qué tipo de color toma el estilo cuando sale al azar con los colores de la imagen
// ('deep' oscuro, 'soft' muy claro, 'vivid' intenso). Sin `tone` sirve cualquiera; `green` es siempre verde WhatsApp.
export const CONTACT_STYLES = [
  { id: 'bar', name: 'Barra translúcida', tone: 'deep' },
  { id: 'bar-dark', name: 'Barra oscura', tone: 'deep' },
  { id: 'bar-white', name: 'Barra blanca', tone: 'soft' },
  { id: 'bar-accent', name: 'Barra de color', tone: 'vivid' },
  { id: 'bar-gradient', name: 'Barra degradada' },
  { id: 'bar-fade', name: 'Degradado suave', tone: 'deep' },
  { id: 'bar-line', name: 'Barra con línea de color', tone: 'deep' },
  { id: 'bar-double', name: 'Barra con doble línea', tone: 'deep' },
  { id: 'bar-two', name: 'Barra de dos colores' },
  { id: 'bar-green', name: 'Barra verde WhatsApp', green: true },
  { id: 'float', name: 'Barra flotante', tone: 'deep' },
  { id: 'float-white', name: 'Flotante blanca', tone: 'soft' },
  { id: 'float-accent', name: 'Flotante de color', tone: 'vivid' },
  { id: 'float-gradient', name: 'Flotante degradada' },
  { id: 'line', name: 'Línea fina sin fondo' },
  { id: 'frame-line', name: 'Entre dos líneas' },
  { id: 'plain', name: 'Solo texto' },
  { id: 'pill', name: 'Píldora de color', tone: 'vivid' },
  { id: 'pill-white', name: 'Píldora blanca', tone: 'soft' },
  { id: 'pill-dark', name: 'Píldora oscura', tone: 'deep' },
  { id: 'pill-gradient', name: 'Píldora degradada' },
  { id: 'pill-glass', name: 'Píldora translúcida', tone: 'deep' },
  { id: 'pill-outline', name: 'Píldora con borde' },
  { id: 'pill-square', name: 'Etiqueta recta' },
  { id: 'pill-split', name: 'Dos píldoras' },
  { id: 'pill-duo', name: 'Dos píldoras de colores' },
  { id: 'pill-green', name: 'Píldora verde WhatsApp', green: true },
]

const CONTACT_KEY = 'gz_auto_contact'
export const isPill = (style) => style.startsWith('pill')
export const contactStyle = () => {
  try { const saved = localStorage.getItem(CONTACT_KEY); return CONTACT_STYLES.some((s) => s.id === saved) ? saved : 'bar' } catch { return 'bar' }
}
export const saveContactStyle = (style) => { try { localStorage.setItem(CONTACT_KEY, style) } catch { /* sin almacenamiento */ } }

const darken = (hex, f) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f)).toString(16).padStart(2, '0')).join('')
const lum = (hex) => { const n = parseInt(hex.slice(1, 7), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 }

/** ¿Queda un fondo claro al pie? (tema claro, o la hoja blanca) */
export const paperFoot = (layout, T) => layout === 'sheet' || !T.dark

/**
 * Cambia el pie propio de cada composición (donde iba solo la web) por el de contacto, sin mover el contenido.
 * `foot` son los colores sacados de la imagen: { fill, fill2, text, line, alt, altText }. Sin ellos van los del diseño.
 */
export function withFooter(layers, { id, link, T, k, style, foot }) {
  const pill = isPill(style)
  const low = (l) => l.y > 0.875
  const mark = layers.find((l) => l.brand && low(l)) // composiciones que además llevan el logo abajo
  const rest = layers.filter((l) => !(low(l) && ((l.text && l.text.includes(link)) || (l.box && (!pill || l.box.w === 1)))))
  const contact = ({ link: web = link, phone = BRAND.whatsapp, stack = false, border = '', split = false, mono = false, waWhite = false, square = false, bg2 = '', alt = null, ...o }) =>
    newLayer({ text: '', font: 'Inter', weight: 700, shadow: false, color: '#ffffff', ...o, contact: { style: pill ? 'pill' : 'bar', link: web, phone, stack, border, split, mono, waWhite, square, bg2, alt } })

  const paper = paperFoot(id, T)
  const glass = T.photo ? '#050c1cd1' : paper ? '#0f172aed' : '#ffffff1c'
  const accent = T.accent.slice(0, 7)
  const line = foot?.line || T.accent
  /** Color de fondo del pie: el de la imagen si lo hay (con transparencia `alpha`), o el propio del estilo. */
  const tint = (own, alpha = '') => (foot?.fill ? foot.fill + alpha : own)
  const ink = (own) => foot?.text || own
  const gradient = () => (foot?.fill ? [foot.fill, foot.fill2 || darken(foot.fill, 0.35)] : [darken(accent, 0.74), darken(accent, 0.46)])

  if (!pill) {
    const bare = ['line', 'frame-line', 'plain'].includes(style) // sin fondo propio: las letras van sobre el diseño
    const float = style.startsWith('float')
    const two = style === 'bar-two'
    const green = style === 'bar-green'
    let fill = '', fill2 = '', color = '#ffffff', mono = false
    if (style === 'bar') { fill = tint(glass, 'e0'); color = ink('#ffffff') }
    else if (style === 'bar-dark' || style === 'bar-line' || style === 'bar-double' || two) { fill = tint(DARK + 'f2', 'f5'); color = ink('#ffffff') }
    else if (style === 'bar-white' || style === 'float-white') { fill = tint('#ffffff', 'fa'); color = ink(NAVY) }
    else if (style === 'bar-accent' || style === 'float-accent') { fill = tint(T.accent); color = ink(T.ink); mono = true }
    else if (style === 'bar-gradient' || style === 'float-gradient') { [fill, fill2] = gradient(); color = ink('#ffffff'); mono = true }
    else if (style === 'bar-fade') { const base = tint('#050c1c'); fill = base + (paper ? 'b3' : '00'); fill2 = base + 'fa'; color = ink('#ffffff') }
    else if (green) { fill = WA_GREEN; mono = true }
    else if (style === 'float') { fill = tint(T.photo || paper ? glass : '#050c1cb8', 'e6'); color = ink('#ffffff') }
    else color = paper ? NAVY : '#ffffff'

    // un fondo casi transparente no aclara el pie: manda el diseño de abajo
    const sheer = fill.length === 9 && parseInt(fill.slice(7), 16) < 128 && !fill2
    const lightFoot = bare ? paper : !sheer && lum(fill) > 0.72
    const colored = style.endsWith('accent') || green || (!!foot?.fill && !lightFoot && lum(foot.fill) > 0.24) // fondo de color: el logo va en su placa
    const left = id === 'sidebar' ? 0.165 : 0 // la franja lateral queda entera
    const top = mark ? 0.885 : 0.9
    const bottom = float ? (mark ? 0.986 : 0.978) : 1
    const box = (x, y, w, h, c, o = {}) => k.box(x, y, w, h, c, { box: { r: 0, ...o }, lock: true })
    const rule = (y, h = 0.003) => { const x = Math.max(left + 0.03, 0.065); return box(x, y, 0.935 - x, h, line, { r: 2 }) }
    const back = []
    if (float) back.push(box(left + 0.028, top - 0.004, 0.944 - left, bottom - top + 0.004, fill, { r: 34 }))
    else if (fill) back.push(box(left, style === 'bar-fade' ? top - 0.012 : top, 1 - left, 1 - top + (style === 'bar-fade' ? 0.012 : 0), fill))
    if (fill2) {
      const last = back[back.length - 1]
      back[back.length - 1] = { ...last, bg2: fill2, grad: style === 'bar-fade' ? 'v' : 'h' }
    }
    if (style === 'bar-line') back.push(box(left, top, 1 - left, 0.007, line))
    if (style === 'bar-double') back.push(box(left, top, 1 - left, 0.006, line), box(left, top + 0.0095, 1 - left, 0.0022, line))
    if (style === 'line') back.push(rule(top + 0.002))
    if (style === 'frame-line') back.push(rule(top + 0.002), rule(0.985))

    const middle = float ? (top + bottom) / 2 - 0.002 : style === 'frame-line' ? (top + 0.988) / 2 : (1 + top) / 2
    const white = green // el logo de WhatsApp verde se perdería sobre verde
    // Segundo bloque de «dos colores»: el WhatsApp va sobre su propio color
    const second = foot?.alt || (lum(accent) > 0.2 ? accent : '#1d4ed8')
    const secondInk = foot?.altText || (lum(second) < 0.52 ? '#ffffff' : NAVY)

    if (!mark) {
      if (two) {
        const mid = (1 + left) / 2, half = (1 - left) / 2
        return [...rest, ...back, box(mid, top, 1 - mid, 1 - top, second),
          contact({ color, phone: '', x: left + half / 2, y: middle, size: 36, fit: { w: half - 0.04 } }),
          contact({ color: secondInk, link: '', x: mid + half / 2, y: middle, size: 36, fit: { w: half - 0.04 } })]
      }
      return [...rest, ...back, contact({ color, mono, waWhite: white, x: (1 + left) / 2, y: middle, size: float || style === 'frame-line' ? 34 : 36, fit: { w: (float ? 0.88 : 0.92) - left } })]
    }
    // El logo pasa al pie, a la izquierda, y el contacto queda en dos líneas a la derecha
    const inset = float ? 0.015 : 0
    const small = float || style === 'frame-line'
    // la placa del logo se usa cuando su versión no contrasta con el pie
    const plate = colored ? true : lightFoot ? mark.brand === 'dark' : mark.brand === 'light'
    const moved = { ...mark, size: small ? 300 : 340, x: (left ? left + 0.025 : 0.045) + inset + (small ? 150 : 170) / 1080, y: middle, plate }
    if (two) back.push(box(0.56, top, 0.44, 1 - top, second))
    return [...rest.filter((l) => l !== mark), ...back, moved,
      contact({ color: two ? secondInk : color, mono: mono || two, waWhite: white, x: 0.955 - inset * 1.4, y: middle, size: small ? 30 : 33, align: 'right', stack: true, fit: { w: two ? 0.37 : (left ? 0.43 : 0.52) - inset * 2 } })]
  }

  const [from, to] = gradient()
  const accentLook = { bg: tint(T.accent), color: ink(T.ink), mono: true }
  const look = {
    pill: accentLook,
    'pill-white': { bg: tint('#ffffff'), color: ink(NAVY) },
    'pill-dark': { bg: tint(DARK, 'f5'), color: ink('#ffffff') },
    'pill-gradient': { bg: from, bg2: to, color: ink('#ffffff'), mono: true },
    'pill-glass': { bg: tint(glass, 'd9'), color: ink('#ffffff'), flat: true },
    'pill-outline': { bg: tint(paper ? '#ffffff' : '#050c1c', paper ? 'e6' : 'a6'), color: ink(paper ? NAVY : '#ffffff'), border: line, flat: true },
    'pill-square': { ...accentLook, square: true },
    'pill-split': { bg: tint('#ffffff'), color: ink(NAVY), split: true },
    'pill-duo': { bg: tint(DARK, 'f5'), color: ink('#ffffff'), split: true, alt: { bg: foot?.alt || accent, color: foot?.altText || T.ink } },
    'pill-green': { bg: WA_GREEN, color: '#ffffff', mono: true, waWhite: true },
  }[style] || accentLook
  if (mark && mark.x === 0.5) return [...rest, contact({ ...look, x: 0.5, y: 0.958, size: 24, fit: { w: 0.86 } })]
  if (mark) return [...rest, contact({ ...look, x: 0.945, y: 0.932, size: look.split ? 25 : 27, align: 'right', stack: true, fit: { w: 0.37 } })]
  const framed = id === 'editorial'
  return [...rest, contact({ ...look, x: 0.5, y: framed ? 0.922 : 0.937, size: framed ? 26 : 34, fit: { w: framed ? 0.76 : 0.86 } })]
}
