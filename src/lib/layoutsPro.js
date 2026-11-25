// Más composiciones profesionales para las publicaciones automáticas (se suman a las de designs.js).
// Cada una recibe la información y el tema de colores (`T`, con las piezas en `T.k`).

/** Reparte `n` filas entre las alturas `top` y `bottom` (fracciones). */
export const rowsIn = (n, top, bottom, gap = 0, maxH = 1) => {
  const h = Math.min(maxH, (bottom - top - gap * (n - 1)) / n)
  const start = top + (bottom - top - (h * n + gap * (n - 1))) / 2
  return Array.from({ length: n }, (_, i) => { const y = start + i * (h + gap); return { y, h, mid: y + h / 2 } })
}
export const two = (i) => String(i + 1).padStart(2, '0')
// Los puntos del tema «pasos» ya vienen numerados: en los diseños numerados se quita para no repetir el número
export const unnumber = (p) => p.replace(/^\d+\s*[·.)-]\s*/, '')

const INK = '#0f172a'
const PAPER = '#fffffff7'

/** Celdas de una cuadrícula de 2 columnas; si queda una sola en la última fila, ocupa todo el ancho. */
function cells(n, top, bottom, gap = 0.018, maxH = 0.2) {
  const rows = rowsIn(Math.ceil(n / 2), top, bottom, gap, maxH)
  return Array.from({ length: n }, (_, i) => {
    const wide = i === n - 1 && n % 2 === 1
    const r = rows[Math.floor(i / 2)]
    return { ...r, x: wide || i % 2 === 0 ? 0.065 : 0.51, w: wide ? 0.87 : 0.425 }
  })
}

export const PRO_LAYOUTS = [
  {
    id: 'split', name: 'Mitad y mitad', desc: 'encabezado a la izquierda en bloque de color y puntos en tarjeta debajo',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.465, 0.862, 0.012, 0.09)
      return [
        k.box(0, 0, 0.62, 0.42, T.accent, { box: { r: 0 }, lock: true }),
        k.solid({ text: kicker, x: 0.06, y: 0.075, size: 28, color: T.ink, weight: 700, upper: true, align: 'left', fit: { w: 0.5, h: 0.04 } }),
        k.solid({ text: title, x: 0.06, y: 0.24, size: 92, color: T.ink, font: 'Montserrat', weight: 800, align: 'left', fit: { w: 0.5, h: 0.26 } }),
        k.logo(0.81, 0.21, 270, { badge: '' }),
        ...rows.flatMap((r, i) => [
          k.box(0.065, r.y, 0.87, r.h, T.card, { box: { r: 18 } }),
          k.box(0.065, r.y, 0.012, r.h, T.accent, { box: { r: 6 } }),
          k.text({ text: points[i], x: 0.11, y: r.mid, size: 33, align: 'left', fit: { w: 0.8, h: r.h * 0.86 } }),
        ]),
        k.brand(0.065, 0.93, 360, { align: 'left' }),
        k.pill({ text: link, x: 0.935, y: 0.93, size: 28, align: 'right', fit: { w: 0.45, h: 0.04 } }),
      ]
    },
  },
  {
    id: 'magazine', name: 'Revista', desc: 'portada editorial con titular enorme serif y líneas finas',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.49, 0.862, 0, 0.09)
      return [
        k.brand(0.5, 0.08, 400),
        k.box(0.065, 0.14, 0.87, 0.002, T.line, { box: { r: 0 } }),
        k.text({ text: kicker, x: 0.065, y: 0.172, size: 27, color: T.accentText, weight: 700, upper: true, align: 'left', fit: { w: 0.87, h: 0.035 } }),
        k.title({ text: title, x: 0.065, y: 0.31, size: 132, font: 'Playfair Display', align: 'left', fit: { w: 0.87, h: 0.23 } }),
        k.box(0.065, 0.45, 0.87, 0.006, T.accent, { box: { r: 0 } }),
        ...rows.flatMap((r, i) => [
          k.text({ text: two(i), x: 0.065, y: r.mid, size: 44, color: T.accentText, font: 'Playfair Display', weight: 700, align: 'left' }),
          k.text({ text: unnumber(points[i]), x: 0.175, y: r.mid, size: 33, align: 'left', fit: { w: 0.76, h: r.h * 0.84 } }),
          k.box(0.065, r.y + r.h, 0.87, 0.0015, T.line, { box: { r: 0 } }),
        ]),
        k.pill({ text: link, y: 0.93, size: 32, weight: 600 }),
      ]
    },
  },
  {
    id: 'mosaic', name: 'Mosaico', desc: 'cuadrícula de bloques que alternan el color de acento',
    build: ({ kicker, title, points, link }, T, k) => {
      const list = cells(points.length, 0.35, 0.862, 0.014, 0.2)
      return [
        k.text({ text: kicker, y: 0.072, size: 28, color: T.accentText, weight: 700, upper: true, fit: { w: 0.8, h: 0.035 } }),
        k.title({ text: title, y: 0.205, size: 94, font: 'Bricolage Grotesque', fit: { w: 0.87, h: 0.2 } }),
        ...list.flatMap((c, i) => {
          const hot = [0, 3, 4].includes(i)
          return [
            k.box(c.x, c.y, c.w, c.h, hot ? T.accent : T.card, { box: { r: 30 } }),
            (hot ? k.solid : k.text)({ text: unnumber(points[i]), x: c.x + c.w / 2, y: c.mid, size: 36, weight: 700, ...(hot ? { color: T.ink } : {}), fit: { w: c.w - 0.07, h: c.h * 0.78 } }),
          ]
        }),
        k.brand(0.065, 0.93, 360, { align: 'left' }),
        k.pill({ text: link, x: 0.935, y: 0.93, size: 28, align: 'right', fit: { w: 0.45, h: 0.04 } }),
      ]
    },
  },
  {
    id: 'checklist', name: 'Lista de verificación', desc: 'hoja blanca central con casillas marcadas, ideal para consejos y requisitos',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.39, 0.84, 0, 0.1)
      return [
        k.brand(0.5, 0.082, 400),
        k.box(0.055, 0.15, 0.89, 0.72, PAPER, { box: { r: 34 } }),
        k.box(0.055, 0.15, 0.89, 0.2, T.accent, { box: { r: 34 } }),
        k.solid({ text: kicker, y: 0.185, size: 25, color: T.ink, weight: 700, upper: true, fit: { w: 0.76, h: 0.03 } }),
        k.solid({ text: title, y: 0.268, size: 70, color: T.ink, font: 'Poppins', weight: 800, fit: { w: 0.8, h: 0.12 } }),
        ...rows.flatMap((r, i) => [
          k.solid({ text: '✓', x: 0.135, y: r.mid, size: 24, color: T.ink, bg: T.accent, shape: 'circle', weight: 800, flat: true }),
          k.solid({ text: points[i], x: 0.195, y: r.mid, size: 33, color: INK, align: 'left', fit: { w: 0.69, h: r.h * 0.82 } }),
          ...(i < points.length - 1 ? [k.box(0.195, r.y + r.h, 0.69, 0.0014, '#0f172a1c', { box: { r: 0 } })] : []),
        ]),
        k.pill({ text: link, y: 0.932, size: 34, weight: 600 }),
      ]
    },
  },
  {
    id: 'browser', name: 'Ventana web', desc: 'simula una ventana de navegador, ideal para páginas web y sistemas',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.455, 0.865, 0.012, 0.09)
      return [
        k.brand(0.5, 0.08, 400),
        k.box(0.05, 0.145, 0.9, 0.74, T.card, { box: { r: 32 } }),
        k.box(0.05, 0.145, 0.9, 0.062, T.dark ? '#ffffff22' : '#0f172a14', { box: { r: 32 } }),
        ...['#ff5f57', '#febc2e', '#28c840'].map((c, i) => k.box(0.082 + i * 0.033, 0.168, 0.02, 0.016, c, { box: { r: 40 } })),
        k.box(0.21, 0.158, 0.7, 0.036, T.dark ? '#00000055' : '#ffffff', { box: { r: 40 } }),
        k.text({ text: '🔒 ' + link, x: 0.56, y: 0.176, size: 25, weight: 600, shadow: false, fit: { w: 0.64, h: 0.026 } }),
        k.text({ text: kicker, y: 0.245, size: 27, color: T.accentText, weight: 700, upper: true, fit: { w: 0.76, h: 0.035 } }),
        k.title({ text: title, y: 0.335, size: 78, font: 'Space Grotesk', weight: 700, fit: { w: 0.8, h: 0.13 } }),
        k.box(0.41, 0.425, 0.18, 0.006, T.accent, { box: { r: 4 } }),
        ...rows.flatMap((r, i) => [
          k.box(0.095, r.y, 0.81, r.h, T.dark ? '#ffffff12' : '#0f172a0a', { box: { r: 16 } }),
          k.box(0.12, r.mid - 0.01, 0.025, 0.02, T.accent, { box: { r: 7 } }),
          k.text({ text: points[i], x: 0.17, y: r.mid, size: 31, align: 'left', fit: { w: 0.71, h: r.h * 0.86 } }),
        ]),
        k.pill({ text: link, y: 0.935, size: 33, weight: 600 }),
      ]
    },
  },
  {
    id: 'notifications', name: 'Notificaciones', desc: 'cada punto como una notificación de celular',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.345, 0.862, 0.016, 0.1)
      const icons = ['⚡', '✅', '📌', '🚀', '🔒', '💬']
      return [
        k.text({ text: kicker, y: 0.072, size: 28, color: T.accentText, weight: 700, upper: true, fit: { w: 0.8, h: 0.035 } }),
        k.title({ text: title, y: 0.2, size: 90, fit: { w: 0.87, h: 0.19 } }),
        ...rows.flatMap((r, i) => [
          k.box(0.065, r.y, 0.87, r.h, PAPER, { box: { r: 36 } }),
          k.box(0.09, r.mid - r.h * 0.34, 0.098, r.h * 0.68, T.accent, { box: { r: 24 } }),
          k.solid({ text: icons[i % icons.length], x: 0.139, y: r.mid, size: 34, color: T.ink, fit: { w: 0.08, h: r.h * 0.6 } }),
          k.solid({ text: points[i], x: 0.215, y: r.mid, size: 31, color: INK, weight: 600, align: 'left', fit: { w: 0.69, h: r.h * 0.82 } }),
        ]),
        k.brand(0.065, 0.93, 360, { align: 'left' }),
        k.pill({ text: link, x: 0.935, y: 0.93, size: 28, align: 'right', fit: { w: 0.45, h: 0.04 } }),
      ]
    },
  },
  {
    id: 'conversation', name: 'Conversación', desc: 'globos de chat alternados, cercano y conversacional',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.35, 0.862, 0.016, 0.1)
      return [
        k.brand(0.5, 0.08, 400),
        k.pill({ text: kicker, y: 0.158, size: 26, fit: { w: 0.7, h: 0.035 } }),
        k.title({ text: title, y: 0.255, size: 74, font: 'Plus Jakarta Sans', fit: { w: 0.86, h: 0.13 } }),
        ...rows.flatMap((r, i) => {
          const right = i % 2 === 1, x = right ? 0.17 : 0.065
          return [
            k.box(x, r.y, 0.765, r.h, right ? T.accent : PAPER, { box: { r: 52 } }),
            k.box(right ? 0.892 : 0.065, r.y + r.h * 0.55, 0.043, r.h * 0.45, right ? T.accent : PAPER, { box: { r: 4 } }),
            k.solid({ text: points[i], x: x + 0.3825, y: r.mid, size: 31, weight: 600, color: right ? T.ink : INK, fit: { w: 0.68, h: r.h * 0.8 } }),
          ]
        }),
        k.pill({ text: link, y: 0.932, size: 33, weight: 600 }),
      ]
    },
  },
  {
    id: 'bignumber', name: 'Cifra destacada', desc: 'número gigante con la cantidad de puntos, para listas de claves o razones',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.42, 0.862, 0, 0.095)
      return [
        k.text({ text: String(points.length), x: 0.055, y: 0.235, size: 430, color: T.accentText, font: 'Bebas Neue', weight: 400, align: 'left', fit: { w: 0.3, h: 0.34 } }),
        k.text({ text: kicker, x: 0.37, y: 0.125, size: 28, color: T.accentText, weight: 700, upper: true, align: 'left', fit: { w: 0.57, h: 0.035 } }),
        k.title({ text: title, x: 0.37, y: 0.255, size: 84, align: 'left', font: 'Montserrat', fit: { w: 0.57, h: 0.2 } }),
        k.box(0.065, 0.395, 0.87, 0.005, T.accent, { box: { r: 3 } }),
        ...rows.flatMap((r, i) => [
          k.text({ text: '→', x: 0.075, y: r.mid, size: 38, color: T.accentText, weight: 800, align: 'left' }),
          k.text({ text: unnumber(points[i]), x: 0.155, y: r.mid, size: 34, align: 'left', fit: { w: 0.78, h: r.h * 0.84 } }),
        ]),
        k.brand(0.065, 0.93, 360, { align: 'left' }),
        k.pill({ text: link, x: 0.935, y: 0.93, size: 28, align: 'right', fit: { w: 0.45, h: 0.04 } }),
      ]
    },
  },
  {
    id: 'stairs', name: 'Escalera', desc: 'peldaños que avanzan, ideal para procesos y crecimiento',
    build: ({ kicker, title, points, link }, T, k) => {
      const n = points.length, rows = rowsIn(n, 0.355, 0.865, 0.012, 0.1)
      const step = n > 1 ? 0.2 / (n - 1) : 0
      return [
        ...[k.brand(0.065, 0.082, 380, { align: 'left' })],
        k.text({ text: kicker, x: 0.065, y: 0.158, size: 27, color: T.accentText, weight: 700, upper: true, align: 'left', fit: { w: 0.87, h: 0.035 } }),
        k.title({ text: title, x: 0.065, y: 0.255, size: 80, align: 'left', font: 'Plus Jakarta Sans', fit: { w: 0.87, h: 0.14 } }),
        ...rows.flatMap((r, i) => {
          const x = 0.065 + step * i
          return [
            k.box(x, r.y, 0.67, r.h, T.card, { box: { r: 20 } }),
            k.box(x, r.y, 0.09, r.h, T.accent, { box: { r: 20 } }),
            k.solid({ text: two(i), x: x + 0.045, y: r.mid, size: 34, color: T.ink, font: 'Montserrat', weight: 800, fit: { w: 0.07, h: r.h * 0.7 } }),
            k.text({ text: unnumber(points[i]), x: x + 0.11, y: r.mid, size: 29, align: 'left', fit: { w: 0.54, h: r.h * 0.86 } }),
          ]
        }),
        k.pill({ text: link, y: 0.932, size: 33, weight: 600 }),
      ]
    },
  },
  {
    id: 'ribbon', name: 'Banda central', desc: 'franja de color en el centro con el título, muy llamativo para anuncios',
    build: ({ kicker, title, points, link }, T, k) => {
      const list = cells(points.length, 0.48, 0.865, 0.016, 0.13)
      return [
        k.brand(0.5, 0.095, 440),
        k.text({ text: kicker, y: 0.185, size: 30, color: T.accentText, weight: 700, upper: true, fit: { w: 0.8, h: 0.04 } }),
        k.box(0, 0.22, 1, 0.225, T.accent, { box: { r: 0 }, lock: true }),
        k.solid({ text: title, y: 0.332, size: 108, color: T.ink, font: 'Oswald', weight: 700, upper: true, fit: { w: 0.88, h: 0.19 } }),
        ...list.flatMap((c, i) => [
          k.box(c.x, c.y, c.w, c.h, T.card, { box: { r: 22 } }),
          k.text({ text: points[i], x: c.x + c.w / 2, y: c.mid, size: 29, weight: 600, fit: { w: c.w - 0.05, h: c.h * 0.82 } }),
        ]),
        k.pill({ text: link, y: 0.932, size: 34, weight: 600 }),
      ]
    },
  },
  {
    id: 'sheet', name: 'Hoja inferior', desc: 'título grande arriba y panel blanco que sube desde abajo, muy limpio sobre fotos',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.47, 0.858, 0, 0.09)
      return [
        k.brand(0.065, 0.085, 400, { align: 'left' }),
        k.pill({ text: kicker, x: 0.065, y: 0.185, size: 27, align: 'left', fit: { w: 0.7, h: 0.04 } }),
        k.title({ text: title, x: 0.065, y: 0.3, size: 104, align: 'left', font: 'Montserrat', fit: { w: 0.87, h: 0.18 } }),
        k.box(0, 0.43, 1, 0.62, PAPER, { box: { r: 70 }, lock: true }),
        ...rows.flatMap((r, i) => [
          k.solid({ text: String(i + 1), x: 0.105, y: r.mid, size: 24, color: T.ink, bg: T.accent, shape: 'circle', weight: 800, flat: true }),
          k.solid({ text: unnumber(points[i]), x: 0.17, y: r.mid, size: 33, color: INK, align: 'left', fit: { w: 0.76, h: r.h * 0.86 } }),
        ]),
        k.box(0.065, 0.887, 0.87, 0.0016, '#0f172a1f', { box: { r: 0 } }),
        k.solid({ text: '🌐 ' + link, y: 0.938, size: 36, color: INK, weight: 700, fit: { w: 0.86, h: 0.05 } }),
      ]
    },
  },
  {
    id: 'editorial', name: 'Marco elegante', desc: 'composición centrada y sobria con doble marco, estilo premium',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.46, 0.8, 0, 0.08)
      const frame = (m) => [
        k.box(m, m * 0.8, 1 - 2 * m, 0.0018, T.accent, { box: { r: 0 } }),
        k.box(m, 1 - m * 0.8, 1 - 2 * m, 0.0018, T.accent, { box: { r: 0 } }),
        k.box(m, m * 0.8, 0.0022, 1 - 1.6 * m, T.accent, { box: { r: 0 } }),
        k.box(1 - m - 0.0022, m * 0.8, 0.0022, 1 - 1.6 * m, T.accent, { box: { r: 0 } }),
      ]
      return [
        ...frame(0.045), ...frame(0.062),
        k.text({ text: kicker, y: 0.125, size: 26, color: T.accentText, weight: 700, upper: true, fit: { w: 0.7, h: 0.035 } }),
        k.title({ text: title, y: 0.27, size: 96, font: 'Playfair Display', weight: 700, fit: { w: 0.76, h: 0.21 } }),
        k.text({ text: '◆', y: 0.415, size: 28, color: T.accentText }),
        ...rows.flatMap((r, i) => [
          k.text({ text: points[i], y: r.mid, size: 30, fit: { w: 0.74, h: r.h * 0.84 } }),
          ...(i ? [k.box(0.46, r.y, 0.08, 0.0018, T.accent, { box: { r: 0 } })] : []),
        ]),
        k.brand(0.5, 0.855, 380),
        k.text({ text: link, y: 0.92, size: 29, color: T.accentText, weight: 700, fit: { w: 0.7, h: 0.035 } }),
      ]
    },
  },
  {
    id: 'poster', name: 'Póster', desc: 'tipografía condensada gigante, impacto máximo con pocos puntos',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.525, 0.862, 0.008, 0.072)
      return [
        k.pill({ text: kicker, x: 0.065, y: 0.075, size: 28, align: 'left', fit: { w: 0.75, h: 0.04 } }),
        k.title({ text: title, x: 0.062, y: 0.295, size: 240, font: 'Bebas Neue', weight: 400, upper: true, align: 'left', fit: { w: 0.88, h: 0.36 } }),
        k.box(0.065, 0.495, 0.25, 0.012, T.accent, { box: { r: 0 } }),
        ...rows.flatMap((r, i) => [
          k.box(0.065, r.y, 0.87, r.h, T.card, { box: { r: 8 } }),
          k.text({ text: points[i], x: 0.095, y: r.mid, size: 29, weight: 600, align: 'left', fit: { w: 0.81, h: r.h * 0.92 } }),
        ]),
        k.brand(0.065, 0.93, 360, { align: 'left' }),
        k.pill({ text: link, x: 0.935, y: 0.93, size: 28, align: 'right', fit: { w: 0.45, h: 0.04 } }),
      ]
    },
  },
  {
    id: 'featured', name: 'Idea principal', desc: 'el primer punto en una tarjeta de color destacada y el resto en lista',
    build: ({ kicker, title, points, link }, T, k) => {
      const rest = points.slice(1)
      const rows = rest.length ? rowsIn(rest.length, 0.56, 0.862, 0, 0.082) : []
      return [
        k.brand(0.065, 0.082, 380, { align: 'left' }),
        k.text({ text: kicker, x: 0.065, y: 0.162, size: 27, color: T.accentText, weight: 700, upper: true, align: 'left', fit: { w: 0.87, h: 0.035 } }),
        k.title({ text: title, x: 0.065, y: 0.265, size: 86, align: 'left', font: 'Bricolage Grotesque', fit: { w: 0.87, h: 0.15 } }),
        k.box(0.065, 0.36, 0.87, 0.175, T.accent, { box: { r: 34 } }),
        k.solid({ text: '★', x: 0.135, y: 0.4475, size: 66, color: T.ink }),
        k.solid({ text: unnumber(points[0]), x: 0.215, y: 0.4475, size: 46, color: T.ink, weight: 700, align: 'left', fit: { w: 0.68, h: 0.14 } }),
        ...rows.flatMap((r, i) => [
          ...(i ? [k.box(0.065, r.y, 0.87, 0.0015, T.line, { box: { r: 0 } })] : []),
          k.text({ text: '+', x: 0.08, y: r.mid, size: 42, color: T.accentText, weight: 800, align: 'left' }),
          k.text({ text: unnumber(rest[i]), x: 0.145, y: r.mid, size: 32, align: 'left', fit: { w: 0.79, h: r.h * 0.86 } }),
        ]),
        k.pill({ text: link, y: 0.932, size: 34, weight: 600 }),
      ]
    },
  },
  {
    id: 'medallions', name: 'Medallones', desc: 'dos columnas centradas, cada punto con un número en círculo',
    build: ({ kicker, title, points, link }, T, k) => {
      const list = cells(points.length, 0.37, 0.868, 0.012, 0.2)
      return [
        k.brand(0.5, 0.082, 400),
        k.text({ text: kicker, y: 0.165, size: 28, color: T.accentText, weight: 700, upper: true, fit: { w: 0.8, h: 0.035 } }),
        k.title({ text: title, y: 0.265, size: 80, fit: { w: 0.87, h: 0.14 } }),
        ...list.flatMap((c, i) => [
          k.pill({ text: String(i + 1), x: c.x + c.w / 2, y: c.y + c.h * 0.19, size: Math.round(Math.min(30, c.h * 190)), shape: 'circle', font: 'Montserrat', weight: 800 }),
          k.text({ text: unnumber(points[i]), x: c.x + c.w / 2, y: c.y + c.h * 0.69, size: 30, fit: { w: c.w - 0.04, h: c.h * 0.54 } }),
        ]),
        k.pill({ text: link, y: 0.932, size: 34, weight: 600 }),
      ]
    },
  },
  {
    id: 'slant', name: 'Corte diagonal', desc: 'bloque de color inclinado, dinámico y moderno',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.505, 0.862, 0, 0.088)
      return [
        k.box(-0.15, -0.12, 1.3, 0.52, T.accent, { box: { r: 0 }, lock: true, rot: -7 }),
        k.solid({ text: kicker, x: 0.065, y: 0.07, size: 28, color: T.ink, weight: 700, upper: true, align: 'left', fit: { w: 0.8, h: 0.035 } }),
        k.solid({ text: title, x: 0.065, y: 0.195, size: 100, color: T.ink, font: 'Poppins', weight: 800, align: 'left', fit: { w: 0.82, h: 0.19 } }),
        k.brand(0.935, 0.432, 380, { align: 'right' }),
        ...rows.flatMap((r, i) => [
          k.box(0.07, r.mid - 0.012, 0.03, 0.024, T.accent, { box: { r: 4 }, rot: 45 }),
          k.text({ text: points[i], x: 0.135, y: r.mid, size: 33, align: 'left', fit: { w: 0.8, h: r.h * 0.86 } }),
        ]),
        k.pill({ text: link, y: 0.932, size: 34, weight: 600 }),
      ]
    },
  },
  {
    id: 'terminal', name: 'Consola tech', desc: 'estética de consola de programación, ideal para tecnología y ciberseguridad',
    build: ({ kicker, title, points, link }, T, k) => {
      const rows = rowsIn(points.length, 0.485, 0.83, 0, 0.085)
      const mono = 'Chakra Petch'
      return [
        k.brand(0.5, 0.082, 400),
        k.box(0.05, 0.148, 0.9, 0.725, '#050a16f2', { box: { r: 26 } }),
        k.box(0.05, 0.148, 0.9, 0.05, '#ffffff14', { box: { r: 26 } }),
        ...['#ff5f57', '#febc2e', '#28c840'].map((c, i) => k.box(0.082 + i * 0.033, 0.165, 0.02, 0.016, c, { box: { r: 40 } })),
        k.solid({ text: '> ' + kicker, x: 0.095, y: 0.24, size: 29, color: '#4ade80', font: mono, weight: 600, align: 'left', fit: { w: 0.8, h: 0.035 } }),
        k.solid({ text: title, x: 0.095, y: 0.345, size: 84, color: '#ffffff', font: mono, weight: 700, align: 'left', fit: { w: 0.81, h: 0.16 } }),
        k.box(0.095, 0.445, 0.81, 0.0016, '#ffffff30', { box: { r: 0 } }),
        ...rows.flatMap((r, i) => [
          k.solid({ text: '[✓]', x: 0.095, y: r.mid, size: 27, color: '#4ade80', font: mono, weight: 700, align: 'left' }),
          k.solid({ text: points[i], x: 0.18, y: r.mid, size: 31, color: '#dbe7f5', font: mono, weight: 500, align: 'left', fit: { w: 0.73, h: r.h * 0.86 } }),
        ]),
        k.solid({ text: '$ ' + link + ' _', x: 0.095, y: 0.845, size: 29, color: '#4ade80', font: mono, weight: 600, align: 'left', fit: { w: 0.8, h: 0.035 } }),
        k.pill({ text: link, y: 0.932, size: 34, weight: 600 }),
      ]
    },
  },
  {
    id: 'cover', name: 'Portada', desc: 'título abajo como portada de campaña, deja ver bien la foto o el fondo',
    build: ({ kicker, title, points, link }, T, k) => {
      const list = cells(points.length, 0.665, 0.875, 0.01, 0.075)
      return [
        k.brand(0.065, 0.085, 420, { align: 'left' }),
        k.logo(0.5, 0.31, 360, { badge: '', opacity: T.photo ? 0 : 0.95 }),
        k.pill({ text: kicker, x: 0.065, y: 0.485, size: 27, align: 'left', fit: { w: 0.7, h: 0.04 } }),
        k.title({ text: title, x: 0.065, y: 0.58, size: 94, align: 'left', font: 'Plus Jakarta Sans', fit: { w: 0.87, h: 0.13 } }),
        ...list.flatMap((c, i) => [
          k.box(c.x, c.y, c.w, c.h, T.card, { box: { r: 16 } }),
          k.text({ text: unnumber(points[i]), x: c.x + c.w / 2, y: c.mid, size: 25, weight: 600, fit: { w: c.w - 0.035, h: c.h * 0.86 } }),
        ]),
        k.pill({ text: link, y: 0.932, size: 34, weight: 600 }),
      ]
    },
  },
]
