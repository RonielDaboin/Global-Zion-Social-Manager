// Diseños de las publicaciones automáticas: muchas composiciones distintas, todas con el logo de Global Zion
// (versión clara u oscura, que se van alternando). Aquí están las primeras; el resto en layoutsPro.js.
// Las posiciones son fracciones del lienzo y cada texto lleva `fit` (espacio máximo): el motor de dibujo achica
// la letra hasta que quepa, así cualquier texto y formato (4:5, 1:1, story…) queda ordenado.
import { newLayer } from './formats.js'
import { withFooter, contactStyle, isPill, paperFoot } from './footer.js'
import { PRO_LAYOUTS, rowsIn, two, unnumber } from './layoutsPro.js'
import { EXTRA_LAYOUTS } from './layoutsExtra.js'

export { CONTACT_STYLES, saveContactStyle } from './footer.js'

const NAVY = '#0b1b3f'

// Luminosidad percibida (0-1) de un color #rrggbb
const lum = (hex) => { const n = parseInt(hex.slice(1, 7), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 }
const lighten = (hex, f) => '#' + [1, 3, 5].map((i) => { const v = parseInt(hex.slice(i, i + 2), 16); return Math.round(v + (255 - v) * f).toString(16).padStart(2, '0') }).join('')

const darken = (hex, f) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f)).toString(16).padStart(2, '0')).join('')

/** ¿La composición deja un fondo claro al pie con esa paleta? */
export const lightBottom = (layout, palette, photo) => paperFoot(layout, theme(palette, photo))

/** Aplica a una paleta los colores elegidos a mano: `accent` (elementos), `bg` (fondo) y `text` (letras). */
export function paintPalette(palette, { accent, bg, text } = {}) {
  const out = { ...palette }
  if (accent) out.accent = accent
  if (text) out.text = text
  if (bg) {
    const dark = lum(bg) < 0.58
    Object.assign(out, { c1: dark ? darken(bg, 0.45) : lighten(bg, 0.45), c2: bg, c3: '', dark })
  }
  return out
}

/** Colores de trabajo de una paleta. Sobre foto (`photo`) siempre se usa texto claro con sombra. */
function theme(palette, photo) {
  const dark = photo || palette.dark
  return {
    dark, photo,
    accent: palette.accent,
    ink: lum(palette.accent) < 0.52 ? '#ffffff' : NAVY, // texto sobre el color de acento
    accentText: dark && lum(palette.accent) < 0.58 ? lighten(palette.accent, 0.45) : !dark && lum(palette.accent) > 0.42 ? darken(palette.accent, 0.3) : palette.accent, // acento usado como letra
    title: palette.text || (dark ? '#ffffff' : '#0f172a'), // `text`: color de letras elegido a mano
    body: palette.text || (dark ? '#e8eef7' : '#1f2937'),
    card: photo ? '#050c1cbf' : dark ? '#ffffff17' : '#ffffffeb',
    line: photo || dark ? '#ffffff2e' : '#0f172a1f',
  }
}

// ---- Piezas ----
function kit(T, version) {
  const text = (o) => newLayer({ font: 'Inter', weight: 500, color: T.body, shadow: T.photo, ...o })
  // Texto que va sobre una forma de color: nunca lleva sombra ni se recolorea
  const solid = (o) => text({ shadow: false, panel: true, ...o })
  const title = (o) => text({ weight: 800, color: T.title, shadow: T.dark, font: 'Montserrat', ...o })
  const pill = (o) => solid({ shape: 'pill', bg: T.accent, color: T.ink, weight: 700, ...o })
  /** Rectángulo en coordenadas de borde (x, y, ancho, alto en fracciones). */
  const box = (x, y, w, h, fill, o = {}) => newLayer({ text: '', x: x + w / 2, y: y + h / 2, size: 100, box: { w, h, r: 26, ...o.box }, bg: fill, flat: true, shadow: false, lock: !!o.lock, rot: o.rot || 0 })
  const logo = (x, y, size, o = {}) => newLayer({ text: '', x, y, size, logo: true, badge: 'tile', shadow: false, ...o })
  /**
   * Logo completo «GLOBAL ZION · DIGITAL SOLUTIONS» de ancho `w` (px sobre 1080). `version` es la clara u oscura;
   * cuando no coincide con el fondo (o va sobre un color) se dibuja dentro de su propia placa, para que se lea.
   */
  const brand = (x, y, w, o = {}) => {
    const cx = o.align === 'left' ? x + w / 2160 : o.align === 'right' ? x - w / 2160 : x
    return newLayer({ text: '', x: cx, y, size: w, brand: version, plate: o.on === 'accent' || (version === 'light') === T.dark, font: 'Plus Jakarta Sans', weight: 800, shadow: false })
  }
  return { text, solid, title, pill, box, logo, brand }
}

// ---- Composiciones ----
export const LAYOUTS = [
  {
    id: 'classic', name: 'Clásico', desc: 'centrado con logo arriba, lista con vistos y marco', frame: true,
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.405, 0.865, 0, 0.1)
      return [
        k.brand(0.5, 0.1, 420),
        k.pill({ text: kicker, y: 0.19, size: 29, fit: { w: 0.7, h: 0.04 } }),
        k.title({ text: title, y: 0.28, size: 76, fit: { w: 0.84, h: 0.115 } }),
        k.box(0.43, 0.35, 0.14, 0.006, T.accent, { box: { r: 4 } }),
        ...rows.flatMap((r, i) => [
          ...(i ? [k.box(0.1, r.y, 0.8, 0.0015, T.line, { box: { r: 0 } })] : []),
          k.pill({ text: '✓', x: 0.12, y: r.mid, size: 22, shape: 'circle', weight: 800 }),
          k.text({ text: points[i], x: 0.175, y: r.mid, size: 35, align: 'left', fit: { w: 0.73, h: r.h * 0.86 } }),
        ]),
        k.pill({ text: link, y: 0.925, size: 35, weight: 600 }),
      ]
    },
  },
  {
    id: 'cards', name: 'Tarjetas', desc: 'puntos en tarjetas numeradas en dos columnas',
    build: ({ kicker, title, points, link }, T, k) => {
      const n = points.length
      const rows = rowsIn(Math.ceil(n / 2), 0.345, 0.87, 0.018, 0.21)
      return [
        k.brand(0.065, 0.082, 400, { align: 'left' }),
        k.pill({ text: kicker, x: 0.935, y: 0.082, size: 25, align: 'right', fit: { w: 0.37, h: 0.04 } }),
        k.title({ text: title, x: 0.07, y: 0.235, size: 84, align: 'left', font: 'Plus Jakarta Sans', fit: { w: 0.86, h: 0.16 } }),
        ...points.flatMap((p, i) => {
          const wide = i === n - 1 && n % 2 === 1
          const x = wide || i % 2 === 0 ? 0.065 : 0.51, w = wide ? 0.87 : 0.425, r = rows[Math.floor(i / 2)]
          return [
            k.box(x, r.y, w, r.h, T.card),
            k.box(x + 0.03, r.y, 0.09, 0.006, T.accent, { box: { r: 3 } }),
            k.text({ text: two(i), x: x + 0.03, y: r.y + r.h * 0.22, size: 40, color: T.accentText, font: 'Montserrat', weight: 800, align: 'left', shadow: false, panel: true, fit: { w: 0.15, h: r.h * 0.26 } }),
            k.text({ text: unnumber(p), x: x + 0.03, y: r.y + r.h * 0.65, size: 32, align: 'left', fit: { w: w - 0.06, h: r.h * 0.56 } }),
          ]
        }),
        k.pill({ text: link, y: 0.93, size: 34, weight: 600 }),
      ]
    },
  },
  {
    id: 'panel', name: 'Panel claro', desc: 'título grande y panel blanco con la lista',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.43, 0.868, 0, 0.1)
      return [
        k.brand(0.935, 0.08, 370, { align: 'right' }),
        k.pill({ text: kicker, x: 0.085, y: 0.08, size: 26, align: 'left', fit: { w: 0.42, h: 0.04 } }),
        k.title({ text: title, x: 0.07, y: 0.265, size: 108, align: 'left', font: 'Bricolage Grotesque', fit: { w: 0.84, h: 0.23 } }),
        k.box(0.045, 0.41, 0.91, 0.478, '#fffffff5', { box: { r: 40 } }),
        ...rows.flatMap((r, i) => [
          k.box(0.095, r.mid - 0.011, 0.0275, 0.022, T.accent, { box: { r: 8 } }),
          k.solid({ text: points[i], x: 0.15, y: r.mid, size: 34, color: '#0f172a', align: 'left', fit: { w: 0.76, h: r.h * 0.93 } }),
        ]),
        k.pill({ text: link, y: 0.93, size: 36, weight: 600 }),
      ]
    },
  },
  {
    id: 'numbers', name: 'Lista numerada', desc: 'lista numerada en barras',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.36, 0.875, 0.014, 0.1)
      return [
        k.brand(0.065, 0.082, 390, { align: 'left' }),
        k.pill({ text: kicker, x: 0.935, y: 0.082, size: 25, align: 'right', fit: { w: 0.36, h: 0.04 } }),
        k.title({ text: title, y: 0.24, size: 90, font: 'Space Grotesk', weight: 700, fit: { w: 0.87, h: 0.17 } }),
        ...rows.flatMap((r, i) => [
          k.box(0.065, r.y, 0.87, r.h, T.card, { box: { r: 22 } }),
          k.box(0.065, r.y, 0.12, r.h, T.accent, { box: { r: 22 } }),
          k.solid({ text: String(i + 1), x: 0.125, y: r.mid, size: 46, color: T.ink, font: 'Space Grotesk', weight: 700, fit: { w: 0.09, h: r.h * 0.8 } }),
          k.text({ text: unnumber(points[i]), x: 0.215, y: r.mid, size: 33, align: 'left', fit: { w: 0.69, h: r.h * 0.84 } }),
        ]),
        k.pill({ text: link, y: 0.932, size: 34, weight: 600 }),
      ]
    },
  },
  {
    id: 'hero', name: 'Bloque de color', desc: 'bloque de color arriba con el título',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.45, 0.882, 0, 0.092)
      return [
        k.box(0, 0, 1, 0.355, T.accent, { box: { r: 0 }, lock: true }),
        k.solid({ text: kicker, y: 0.075, size: 30, color: T.ink, weight: 700, upper: true, fit: { w: 0.8, h: 0.04 } }),
        k.solid({ text: title, y: 0.205, size: 104, color: T.ink, font: 'Poppins', weight: 800, fit: { w: 0.86, h: 0.2 } }),
        k.brand(0.5, 0.358, 460, { on: 'accent' }),
        ...rows.flatMap((r, i) => [
          ...(i ? [k.box(0.47, r.y - 0.0015, 0.06, 0.003, T.accent, { box: { r: 3 } })] : []),
          k.text({ text: points[i], y: r.mid, size: 33, fit: { w: 0.84, h: r.h * 0.8 } }),
        ]),
        k.box(0, 0.9, 1, 0.1, T.dark ? '#ffffff1c' : '#0f172aed', { box: { r: 0 }, lock: true }),
        k.solid({ text: '🌐 ' + link, y: 0.95, size: 38, color: '#ffffff', weight: 700, fit: { w: 0.86, h: 0.05 } }),
      ]
    },
  },
  {
    id: 'sidebar', name: 'Franja lateral', desc: 'franja de color vertical a la izquierda',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.405, 0.87, 0, 0.1)
      return [
        k.box(0, 0, 0.165, 1, T.accent, { box: { r: 0 }, lock: true }),
        k.logo(0.0825, 0.082, 124),
        k.solid({ text: 'GLOBAL ZION', x: 0.0825, y: 0.6, size: 72, rot: -90, color: T.ink, font: 'Oswald', weight: 700 }),
        k.text({ text: kicker, x: 0.225, y: 0.09, size: 31, color: T.accentText, weight: 700, upper: true, align: 'left', fit: { w: 0.71, h: 0.045 } }),
        k.title({ text: title, x: 0.22, y: 0.235, size: 112, align: 'left', font: 'Oswald', weight: 700, upper: true, fit: { w: 0.72, h: 0.23 } }),
        k.box(0.225, 0.372, 0.16, 0.008, T.accent, { box: { r: 4 } }),
        ...rows.flatMap((r, i) => [
          k.box(0.225, r.mid - 0.003, 0.032, 0.006, T.accent, { box: { r: 3 } }),
          k.text({ text: points[i], x: 0.28, y: r.mid, size: 34, align: 'left', fit: { w: 0.66, h: r.h * 0.84 } }),
        ]),
        k.brand(0.215, 0.93, 360, { align: 'left' }),
        k.pill({ text: link, x: 0.945, y: 0.93, size: 26, weight: 600, align: 'right', fit: { w: 0.35, h: 0.04 } }),
      ]
    },
  },
  {
    id: 'timeline', name: 'Línea de tiempo', desc: 'línea de tiempo vertical, para procesos',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.375, 0.865, 0, 0.11)
      const a = rows[0].mid, z = rows[rows.length - 1].mid
      return [
        k.brand(0.065, 0.075, 370, { align: 'left' }),
        k.pill({ text: kicker, x: 0.935, y: 0.075, size: 25, align: 'right', fit: { w: 0.4, h: 0.035 } }),
        k.title({ text: title, x: 0.065, y: 0.19, size: 70, align: 'left', font: 'Plus Jakarta Sans', fit: { w: 0.87, h: 0.12 } }),
        k.box(0.065, 0.275, 0.87, 0.0018, T.line, { box: { r: 0 } }),
        k.box(0.1425, a, 0.005, Math.max(0.01, z - a), T.accent, { box: { r: 3 } }),
        ...rows.flatMap((r, i) => [
          k.pill({ text: String(i + 1), x: 0.145, y: r.mid, size: 30, shape: 'circle', weight: 800, font: 'Montserrat' }),
          k.box(0.215, r.y + r.h * 0.07, 0.72, r.h * 0.86, T.card, { box: { r: 20 } }),
          k.text({ text: unnumber(points[i]), x: 0.245, y: r.mid, size: 32, align: 'left', fit: { w: 0.66, h: r.h * 0.72 } }),
        ]),
        k.pill({ text: link, y: 0.93, size: 35, weight: 600 }),
      ]
    },
  },
  {
    id: 'spotlight', name: 'Logo protagonista', desc: 'logo gigante de fondo y puntos en píldoras', frame: true,
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.405, 0.848, 0.008, 0.078)
      return [
        k.logo(0.5, 0.62, 880, { badge: '', opacity: T.photo ? 0.14 : 0.12, lock: true }),
        k.title({ text: title, y: 0.205, size: 92, font: 'Playfair Display', fit: { w: 0.84, h: 0.2 } }),
        k.text({ text: kicker, y: 0.085, size: 29, color: T.accentText, weight: 700, upper: true, fit: { w: 0.8, h: 0.04 } }),
        k.box(0.39, 0.34, 0.22, 0.003, T.accent, { box: { r: 2 } }),
        k.text({ text: '✦', y: 0.378, size: 34, color: T.accentText }),
        ...rows.flatMap((r, i) => [
          k.box(0.1, r.y, 0.8, r.h, T.card, { box: { r: 60 } }),
          k.text({ text: points[i], y: r.mid, size: 30, weight: 600, fit: { w: 0.75, h: r.h * 0.94 } }),
        ]),
        k.brand(0.5, 0.89, 400),
        k.text({ text: link, y: 0.95, size: 28, color: T.accentText, weight: 700, fit: { w: 0.7, h: 0.03 } }),
      ]
    },
  },
  ...PRO_LAYOUTS,
  ...EXTRA_LAYOUTS,
]

// Patrones de fondo que se combinan con cualquier composición (se dibujan en render.js)
export const DECOS = ['rings', 'dots', 'grid', 'diagonal', 'waves', 'glow', 'blobs', 'logo']

// Se recuerda lo usado hace poco para que las publicaciones no se repitan
export function pickFresh(key, ids, keep) {
  let recent = []
  try { recent = JSON.parse(localStorage.getItem(key) || '[]') } catch { /* sin almacenamiento */ }
  let pool = ids.filter((id) => !recent.includes(id))
  if (!pool.length) pool = ids.filter((id) => id !== recent[0])
  const id = pool[Math.floor(Math.random() * pool.length)]
  try { localStorage.setItem(key, JSON.stringify([id, ...recent.filter((r) => r !== id)].slice(0, keep))) } catch { /* sin almacenamiento */ }
  return id
}
// No se repite un formato hasta haber pasado por casi todos
export const pickLayout = () => pickFresh('gz_auto_layouts', LAYOUTS.map((l) => l.id), LAYOUTS.length - 3)
// El logo claro y el oscuro se van turnando entre publicaciones
export const pickLogo = () => pickFresh('gz_auto_logo', ['light', 'dark'], 1)
export const pickDeco = () => pickFresh('gz_auto_decos', DECOS, 5)
export const layoutName = (design) => LAYOUTS.find((l) => l.id === design?.auto?.layout)?.name || ''

/**
 * Arma un diseño completo. `info` = { kicker, title, points, link }. `design.auto` guarda cómo se armó
 * para poder cambiar solo los textos después.
 */
export function buildDesign({ info, palette, layout = pickLayout(), deco = pickDeco(), photo = false, logo = pickLogo(), contact = contactStyle(), foot = null }) {
  const L = LAYOUTS.find((l) => l.id === layout) || LAYOUTS[0]
  const T = theme(palette, photo)
  const k = kit(T, logo)
  return {
    format: 'ig-portrait',
    bg: { type: 'gradient', c1: palette.c1, c2: palette.c2, c3: palette.c3, angle: palette.angle, image: null, dim: 0, ...(photo || !deco ? {} : { deco: { type: deco, color: palette.accent } }) },
    accent: { show: !!L.frame && isPill(contact), color: palette.accent }, // el marco cruzaría la barra
    layers: withFooter(L.build(info, T, k), { id: L.id, link: info.link, T, k, style: contact, foot }),
    auto: { layout: L.id, photo, logo, contact, foot, palette: { c1: palette.c1, c2: palette.c2, c3: palette.c3, angle: palette.angle, dark: palette.dark, accent: palette.accent, hue: palette.hue, text: palette.text } },
  }
}
