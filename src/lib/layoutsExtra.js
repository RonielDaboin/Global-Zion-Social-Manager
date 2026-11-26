// Tercera tanda de composiciones: letra grande y mucho contraste, pensadas para leerse bien en el celular.
// No dibujan el pie: la web y el WhatsApp los agrega designs.js (barra o píldora), así que el contenido
// termina en 0.87 y los logos van arriba.
import { rowsIn, two, unnumber } from './layoutsPro.js'

const INK = '#0f172a'
const PAPER = '#fffffff7'
const SOFT = '#0f172a14'

export const EXTRA_LAYOUTS = [
  {
    id: 'whitecards', name: 'Tarjetas blancas', desc: 'lista en tarjetas blancas con número de color, muy legible',
    build: ({ kicker, title, points }, T, k) => {
      const rows = rowsIn(points.length, 0.365, 0.87, 0.016, 0.1)
      return [
        k.brand(0.5, 0.082, 400),
        k.pill({ text: kicker, y: 0.165, size: 28, fit: { w: 0.75, h: 0.04 } }),
        k.title({ text: title, y: 0.262, size: 82, font: 'Montserrat', fit: { w: 0.87, h: 0.13 } }),
        ...rows.flatMap((r, i) => [
          k.box(0.065, r.y, 0.87, r.h, PAPER, { box: { r: 24 } }),
          k.solid({ text: String(i + 1), x: 0.125, y: r.mid, size: 30, color: T.ink, bg: T.accent, shape: 'circle', weight: 800, flat: true }),
          k.solid({ text: unnumber(points[i]), x: 0.2, y: r.mid, size: 36, color: INK, weight: 600, align: 'left', fit: { w: 0.7, h: r.h * 0.84 } }),
        ]),
      ]
    },
  },
  {
    id: 'checkgrid', name: 'Cuadrícula con vistos', desc: 'dos columnas de tarjetas blancas con un visto de color',
    build: ({ kicker, title, points }, T, k) => {
      const n = points.length
      const rows = rowsIn(Math.ceil(n / 2), 0.37, 0.87, 0.018, 0.22)
      return [
        k.brand(0.5, 0.082, 400),
        k.text({ text: kicker, y: 0.165, size: 30, color: T.accentText, weight: 700, upper: true, fit: { w: 0.8, h: 0.04 } }),
        k.title({ text: title, y: 0.262, size: 84, font: 'Plus Jakarta Sans', fit: { w: 0.87, h: 0.13 } }),
        ...points.flatMap((p, i) => {
          const wide = i === n - 1 && n % 2 === 1
          const x = wide || i % 2 === 0 ? 0.065 : 0.51, w = wide ? 0.87 : 0.425, r = rows[Math.floor(i / 2)]
          return [
            k.box(x, r.y, w, r.h, PAPER, { box: { r: 30 } }),
            k.solid({ text: '✓', x: x + w / 2, y: r.y + r.h * 0.23, size: 26, color: T.ink, bg: T.accent, shape: 'circle', weight: 800, flat: true }),
            k.solid({ text: unnumber(p), x: x + w / 2, y: r.y + r.h * 0.68, size: 34, color: INK, weight: 600, fit: { w: w - 0.05, h: r.h * 0.52 } }),
          ]
        }),
      ]
    },
  },
  {
    id: 'titlecard', name: 'Título en tarjeta', desc: 'título en una tarjeta blanca y puntos grandes debajo',
    build: ({ kicker, title, points }, T, k) => {
      const rows = rowsIn(points.length, 0.455, 0.87, 0, 0.09)
      return [
        k.brand(0.5, 0.08, 400),
        k.box(0.065, 0.15, 0.87, 0.27, PAPER, { box: { r: 40 } }),
        k.solid({ text: kicker, y: 0.19, size: 27, color: '#475569', weight: 700, upper: true, fit: { w: 0.76, h: 0.035 } }),
        k.solid({ text: title, y: 0.29, size: 90, color: INK, font: 'Poppins', weight: 800, fit: { w: 0.78, h: 0.15 } }),
        k.box(0.41, 0.382, 0.18, 0.008, T.accent, { box: { r: 5 } }),
        ...rows.flatMap((r, i) => [
          k.box(0.075, r.mid - 0.011, 0.028, 0.022, T.accent, { box: { r: 40 } }),
          k.text({ text: points[i], x: 0.135, y: r.mid, size: 37, weight: 600, align: 'left', fit: { w: 0.8, h: r.h * 0.86 } }),
        ]),
      ]
    },
  },
  {
    id: 'colorhead', name: 'Cabecera de color', desc: 'cabecera de color a todo el ancho y hoja blanca con la lista',
    build: ({ kicker, title, points }, T, k) => {
      const rows = rowsIn(points.length, 0.44, 0.855, 0, 0.09)
      return [
        k.box(0, 0, 1, 0.37, T.accent, { box: { r: 0 }, lock: true }),
        k.brand(0.5, 0.082, 400, { on: 'accent' }),
        k.solid({ text: kicker, y: 0.165, size: 28, color: T.ink, weight: 700, upper: true, fit: { w: 0.8, h: 0.035 } }),
        k.solid({ text: title, y: 0.265, size: 90, color: T.ink, font: 'Montserrat', weight: 800, fit: { w: 0.87, h: 0.14 } }),
        k.box(0.055, 0.405, 0.89, 0.47, PAPER, { box: { r: 36 } }),
        ...rows.flatMap((r, i) => [
          k.solid({ text: '✓', x: 0.13, y: r.mid, size: 23, color: T.ink, bg: T.accent, shape: 'circle', weight: 800, flat: true }),
          k.solid({ text: points[i], x: 0.19, y: r.mid, size: 34, color: INK, weight: 600, align: 'left', fit: { w: 0.7, h: r.h * 0.84 } }),
          ...(i ? [k.box(0.19, r.y, 0.7, 0.0014, SOFT, { box: { r: 0 } })] : []),
        ]),
      ]
    },
  },
  {
    id: 'minimal', name: 'Minimalista', desc: 'mucho aire, título grande a la izquierda y líneas finas',
    build: ({ kicker, title, points }, T, k) => {
      const rows = rowsIn(points.length, 0.44, 0.87, 0, 0.095)
      return [
        k.brand(0.07, 0.082, 380, { align: 'left' }),
        k.box(0.07, 0.165, 0.1, 0.008, T.accent, { box: { r: 5 } }),
        k.text({ text: kicker, x: 0.07, y: 0.205, size: 29, color: T.accentText, weight: 700, upper: true, align: 'left', fit: { w: 0.86, h: 0.04 } }),
        k.title({ text: title, x: 0.07, y: 0.32, size: 108, align: 'left', font: 'Bricolage Grotesque', fit: { w: 0.86, h: 0.17 } }),
        ...rows.flatMap((r, i) => [
          k.box(0.07, r.y, 0.86, 0.0016, T.line, { box: { r: 0 } }),
          k.text({ text: points[i], x: 0.07, y: r.mid, size: 39, weight: 600, align: 'left', fit: { w: 0.86, h: r.h * 0.84 } }),
        ]),
      ]
    },
  },
  {
    id: 'bignums', name: 'Números grandes', desc: 'numeración gigante en color y texto amplio',
    build: ({ kicker, title, points }, T, k) => {
      const rows = rowsIn(points.length, 0.37, 0.87, 0, 0.105)
      return [
        k.brand(0.5, 0.082, 400),
        k.text({ text: kicker, y: 0.165, size: 30, color: T.accentText, weight: 700, upper: true, fit: { w: 0.8, h: 0.04 } }),
        k.title({ text: title, y: 0.262, size: 84, font: 'Montserrat', fit: { w: 0.87, h: 0.13 } }),
        ...rows.flatMap((r, i) => [
          k.text({ text: two(i), x: 0.075, y: r.mid, size: 66, color: T.accentText, font: 'Bebas Neue', weight: 400, align: 'left' }),
          k.box(0.19, r.mid - r.h * 0.3, 0.004, r.h * 0.6, T.accent, { box: { r: 2 } }),
          k.text({ text: unnumber(points[i]), x: 0.225, y: r.mid, size: 37, weight: 600, align: 'left', fit: { w: 0.7, h: r.h * 0.84 } }),
        ]),
      ]
    },
  },
  {
    id: 'stripes', name: 'Franjas alternadas', desc: 'filas a todo el ancho que se alternan, orden muy claro',
    build: ({ kicker, title, points }, T, k) => {
      const rows = rowsIn(points.length, 0.385, 0.87, 0, 0.095)
      return [
        k.brand(0.5, 0.082, 400),
        k.pill({ text: kicker, y: 0.167, size: 28, fit: { w: 0.75, h: 0.04 } }),
        k.title({ text: title, y: 0.27, size: 86, font: 'Poppins', fit: { w: 0.87, h: 0.14 } }),
        ...rows.flatMap((r, i) => [
          ...(i % 2 ? [] : [k.box(0, r.y, 1, r.h, T.card, { box: { r: 0 } })]),
          k.box(0, r.y, 0.022, r.h, T.accent, { box: { r: 0 } }),
          k.text({ text: points[i], y: r.mid, size: 36, weight: 600, fit: { w: 0.86, h: r.h * 0.82 } }),
        ]),
      ]
    },
  },
  {
    id: 'tags', name: 'Etiquetas blancas', desc: 'cada punto en una etiqueta blanca centrada',
    build: ({ kicker, title, points }, T, k) => {
      const rows = rowsIn(points.length, 0.375, 0.87, 0.018, 0.092)
      return [
        k.brand(0.5, 0.082, 420),
        k.text({ text: kicker, y: 0.168, size: 30, color: T.accentText, weight: 700, upper: true, fit: { w: 0.8, h: 0.04 } }),
        k.title({ text: title, y: 0.265, size: 86, font: 'Space Grotesk', weight: 700, fit: { w: 0.87, h: 0.13 } }),
        k.box(0.43, 0.345, 0.14, 0.007, T.accent, { box: { r: 5 } }),
        ...rows.flatMap((r, i) => [
          k.box(0.09, r.y, 0.82, r.h, PAPER, { box: { r: 80 } }),
          k.solid({ text: points[i], y: r.mid, size: 33, color: INK, weight: 600, fit: { w: 0.74, h: r.h * 0.82 } }),
        ]),
      ]
    },
  },
  {
    id: 'glass', name: 'Tarjeta central', desc: 'una gran tarjeta translúcida centrada con todo el contenido, ideal sobre fotos',
    build: ({ kicker, title, points }, T, k) => {
      const rows = rowsIn(points.length, 0.43, 0.84, 0, 0.09)
      return [
        k.brand(0.5, 0.082, 420),
        k.box(0.055, 0.152, 0.89, 0.718, T.card, { box: { r: 44 } }),
        k.pill({ text: kicker, y: 0.2, size: 27, fit: { w: 0.7, h: 0.035 } }),
        k.title({ text: title, y: 0.3, size: 82, font: 'Plus Jakarta Sans', fit: { w: 0.8, h: 0.13 } }),
        k.box(0.12, 0.39, 0.76, 0.0018, T.line, { box: { r: 0 } }),
        ...rows.flatMap((r, i) => [
          k.pill({ text: '✓', x: 0.135, y: r.mid, size: 21, shape: 'circle', weight: 800, flat: true }),
          k.text({ text: points[i], x: 0.19, y: r.mid, size: 35, weight: 600, align: 'left', fit: { w: 0.7, h: r.h * 0.84 } }),
        ]),
      ]
    },
  },
  {
    id: 'colorcard', name: 'Lista en color', desc: 'la lista completa dentro de un gran bloque del color principal',
    build: ({ kicker, title, points }, T, k) => {
      const rows = rowsIn(points.length, 0.425, 0.845, 0, 0.095)
      return [
        k.brand(0.065, 0.082, 400, { align: 'left' }),
        k.text({ text: kicker, x: 0.065, y: 0.167, size: 29, color: T.accentText, weight: 700, upper: true, align: 'left', fit: { w: 0.87, h: 0.04 } }),
        k.title({ text: title, x: 0.065, y: 0.272, size: 92, align: 'left', font: 'Montserrat', fit: { w: 0.87, h: 0.15 } }),
        k.box(0.055, 0.39, 0.89, 0.48, T.accent, { box: { r: 44 } }),
        ...rows.flatMap((r, i) => [
          k.solid({ text: '➜', x: 0.105, y: r.mid, size: 32, color: T.ink, weight: 800, align: 'left' }),
          k.solid({ text: unnumber(points[i]), x: 0.18, y: r.mid, size: 36, color: T.ink, weight: 700, align: 'left', fit: { w: 0.72, h: r.h * 0.84 } }),
        ]),
      ]
    },
  },
  {
    id: 'table', name: 'Tabla ordenada', desc: 'tabla blanca con encabezado de color y filas alternadas',
    build: ({ kicker, title, points }, T, k) => {
      const rows = rowsIn(points.length, 0.43, 0.855, 0, 0.09)
      const top = rows[0].y, bottom = rows[rows.length - 1].y + rows[0].h
      return [
        k.brand(0.5, 0.082, 400),
        k.title({ text: title, y: 0.24, size: 88, font: 'Plus Jakarta Sans', fit: { w: 0.87, h: 0.16 } }),
        k.box(0.055, top - 0.075, 0.89, bottom - top + 0.09, PAPER, { box: { r: 30 } }),
        k.box(0.055, top - 0.075, 0.89, 0.068, T.accent, { box: { r: 30 } }),
        k.solid({ text: kicker, y: top - 0.041, size: 29, color: T.ink, weight: 800, upper: true, fit: { w: 0.8, h: 0.035 } }),
        ...rows.flatMap((r, i) => [
          ...(i % 2 ? [k.box(0.055, r.y, 0.89, r.h, SOFT, { box: { r: 0 } })] : []),
          k.solid({ text: two(i), x: 0.095, y: r.mid, size: 32, color: INK, font: 'Montserrat', weight: 800, align: 'left' }),
          k.solid({ text: unnumber(points[i]), x: 0.18, y: r.mid, size: 33, color: INK, weight: 600, align: 'left', fit: { w: 0.72, h: r.h * 0.84 } }),
        ]),
      ]
    },
  },
  {
    id: 'whitetop', name: 'Portada blanca', desc: 'mitad superior blanca con logo y título, puntos sobre el fondo',
    build: ({ kicker, title, points }, T, k) => {
      const rows = rowsIn(points.length, 0.465, 0.87, 0.012, 0.09)
      return [
        k.box(0, 0, 1, 0.42, PAPER, { box: { r: 0 }, lock: true }),
        k.box(0, 0.42, 1, 0.012, T.accent, { box: { r: 0 }, lock: true }),
        k.brand(0.065, 0.085, 420, { align: 'left', on: 'accent' }),
        k.solid({ text: kicker, x: 0.065, y: 0.175, size: 29, color: '#475569', weight: 700, upper: true, align: 'left', fit: { w: 0.87, h: 0.04 } }),
        k.solid({ text: title, x: 0.065, y: 0.29, size: 104, color: INK, font: 'Montserrat', weight: 800, align: 'left', fit: { w: 0.87, h: 0.19 } }),
        ...rows.flatMap((r, i) => [
          k.box(0.065, r.y, 0.87, r.h, T.card, { box: { r: 18 } }),
          k.box(0.092, r.mid - 0.011, 0.028, 0.022, T.accent, { box: { r: 8 } }),
          k.text({ text: points[i], x: 0.15, y: r.mid, size: 35, weight: 600, align: 'left', fit: { w: 0.76, h: r.h * 0.86 } }),
        ]),
      ]
    },
  },
  {
    id: 'capsules', name: 'Cápsulas numeradas', desc: 'cápsulas redondeadas con el número en un círculo de color',
    build: ({ kicker, title, points }, T, k) => {
      const rows = rowsIn(points.length, 0.37, 0.87, 0.018, 0.092)
      return [
        k.brand(0.065, 0.082, 400, { align: 'left' }),
        k.text({ text: kicker, x: 0.065, y: 0.165, size: 29, color: T.accentText, weight: 700, upper: true, align: 'left', fit: { w: 0.87, h: 0.04 } }),
        k.title({ text: title, x: 0.065, y: 0.262, size: 88, align: 'left', font: 'Poppins', fit: { w: 0.87, h: 0.13 } }),
        ...rows.flatMap((r, i) => [
          k.box(0.1, r.y, 0.835, r.h, T.card, { box: { r: 80 } }),
          k.pill({ text: String(i + 1), x: 0.115, y: r.mid, size: 36, shape: 'circle', weight: 800, font: 'Montserrat' }),
          k.text({ text: unnumber(points[i]), x: 0.2, y: r.mid, size: 34, weight: 600, align: 'left', fit: { w: 0.69, h: r.h * 0.84 } }),
        ]),
      ]
    },
  },
  {
    id: 'zigzag', name: 'Ruta en zigzag', desc: 'puntos a izquierda y derecha de una línea central, para procesos',
    build: ({ kicker, title, points }, T, k) => {
      const rows = rowsIn(points.length, 0.37, 0.87, 0.008, 0.1)
      const a = rows[0].mid, z = rows[rows.length - 1].mid
      return [
        k.brand(0.5, 0.082, 400),
        k.text({ text: kicker, y: 0.165, size: 29, color: T.accentText, weight: 700, upper: true, fit: { w: 0.8, h: 0.04 } }),
        k.title({ text: title, y: 0.262, size: 82, font: 'Montserrat', fit: { w: 0.87, h: 0.13 } }),
        k.box(0.4975, a, 0.005, Math.max(0.01, z - a), T.accent, { box: { r: 3 } }),
        ...rows.flatMap((r, i) => {
          const x = i % 2 ? 0.555 : 0.045
          return [
            k.box(x, r.y, 0.4, r.h, PAPER, { box: { r: 22 } }),
            k.solid({ text: unnumber(points[i]), x: x + 0.2, y: r.mid, size: 31, color: INK, weight: 600, fit: { w: 0.36, h: r.h * 0.86 } }),
            k.pill({ text: String(i + 1), x: 0.5, y: r.mid, size: 25, shape: 'circle', weight: 800, font: 'Montserrat' }),
          ]
        }),
      ]
    },
  },
  {
    id: 'sidetitle', name: 'Título destacado', desc: 'título gigante en un bloque de color redondeado y lista limpia',
    build: ({ kicker, title, points }, T, k) => {
      const rows = rowsIn(points.length, 0.49, 0.87, 0, 0.085)
      return [
        k.brand(0.5, 0.08, 400),
        k.box(0.055, 0.15, 0.89, 0.31, T.accent, { box: { r: 48 } }),
        k.solid({ text: kicker, y: 0.195, size: 28, color: T.ink, weight: 700, upper: true, fit: { w: 0.76, h: 0.035 } }),
        k.solid({ text: title, y: 0.325, size: 112, color: T.ink, font: 'Oswald', weight: 700, upper: true, fit: { w: 0.8, h: 0.2 } }),
        ...rows.flatMap((r, i) => [
          k.text({ text: '✔', x: 0.08, y: r.mid, size: 34, color: T.accentText, weight: 800, align: 'left' }),
          k.text({ text: points[i], x: 0.15, y: r.mid, size: 36, weight: 600, align: 'left', fit: { w: 0.78, h: r.h * 0.86 } }),
          ...(i ? [k.box(0.15, r.y, 0.78, 0.0015, T.line, { box: { r: 0 } })] : []),
        ]),
      ]
    },
  },
  {
    id: 'framedcards', name: 'Marco y tarjetas', desc: 'marco fino de color, título elegante y tarjetas centradas', frame: true,
    build: ({ kicker, title, points }, T, k) => {
      const rows = rowsIn(points.length, 0.385, 0.865, 0.016, 0.092)
      return [
        k.brand(0.5, 0.095, 400),
        k.text({ text: kicker, y: 0.178, size: 28, color: T.accentText, weight: 700, upper: true, fit: { w: 0.76, h: 0.035 } }),
        k.title({ text: title, y: 0.275, size: 86, font: 'Playfair Display', weight: 700, fit: { w: 0.8, h: 0.14 } }),
        ...rows.flatMap((r, i) => [
          k.box(0.1, r.y, 0.8, r.h, T.card, { box: { r: 14 } }),
          k.box(0.4, r.y, 0.2, 0.004, T.accent, { box: { r: 2 } }),
          k.text({ text: points[i], y: r.mid, size: 34, weight: 600, fit: { w: 0.74, h: r.h * 0.82 } }),
        ]),
      ]
    },
  },
]
