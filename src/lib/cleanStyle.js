// «Estilo Global Zion»: la selección exigente que usa Alicia, tomada de las publicaciones que mejor se ven en
// @globalzion.cl. Logo arriba, título grande, puntos ordenados en tarjetas o filas separadas y un pie sobrio.
// El generador de «Crear con IA» y el editor siguen teniendo todas las composiciones.
import { pickFresh } from './designs.js'

/** Composiciones aprobadas: aireadas, ordenadas y con letra que se lee en el teléfono. */
export const CLEAN_LAYOUTS = [
  'browser', 'stairs', 'poster', 'panel', 'checklist', 'numbers', 'timeline', 'sheet',
  'whitecards', 'colorhead', 'glass', 'table', 'capsules', 'framedcards', 'cards', 'bignums',
]
/** Sobre foto solo van las que ponen los puntos encima de una tarjeta o fila, para que la foto no estorbe. */
export const CLEAN_PHOTO_LAYOUTS = CLEAN_LAYOUTS.filter((id) => id !== 'bignums')

/** Colores de marca: azules sobre todo, grafito con amarillo o dorado, y dos versiones claras. */
export const CLEAN_PALETTES = [
  { id: 'zion', dark: true, c1: '#020618', c2: '#0f2a5c', c3: '#1d6fb8', angle: 160, accent: '#38bdf8', ai: 'deep navy blue with bright sky blue highlights and soft white light' },
  { id: 'midnight', dark: true, c1: '#020618', c2: '#0b1b3f', c3: '', angle: 165, accent: '#60a5fa', ai: 'midnight navy blue with soft royal blue light' },
  { id: 'ocean', dark: true, c1: '#06152e', c2: '#124a7d', c3: '', angle: 150, accent: '#7cc0ff', ai: 'corporate royal blue and sky blue with soft white light' },
  { id: 'teal', dark: true, c1: '#041c2c', c2: '#0b5468', c3: '', angle: 155, accent: '#5eead4', ai: 'deep petrol teal with soft mint light' },
  { id: 'graphite', dark: true, c1: '#0f172a', c2: '#1f2937', c3: '#374151', angle: 160, accent: '#fbbf24', ai: 'graphite gray and slate with warm golden yellow highlights' },
  { id: 'gold', dark: true, c1: '#020618', c2: '#0f2a5c', c3: '', angle: 165, accent: '#f5b942', ai: 'dark navy blue with elegant gold highlights' },
  { id: 'cloud', dark: false, c1: '#ffffff', c2: '#e3effb', c3: '', angle: 160, accent: '#1d6fb8', ai: 'bright white and pale sky blue, airy minimalist daylight' },
  { id: 'ice', dark: false, c1: '#f8fbff', c2: '#d6e7f8', c3: '', angle: 135, accent: '#0f4c81', ai: 'bright clean white and light blue, airy minimalist daylight' },
]

const CONTACTS = { dark: ['bar', 'float', 'bar-line'], light: ['bar-white', 'float-white'] }
const DECOS = ['glow', 'rings', 'none']
export const CLEAN_MAX_POINTS = 5
export const CLEAN_PHOTO_DIM = 0.68 // la foto queda bien atrás: manda el texto

export const cleanContact = (dark) => pickFresh('gz_clean_contact', CONTACTS[dark ? 'dark' : 'light'], 1)

/** Paleta, composición, pie y adorno de una publicación nueva, sin repetir los de las últimas. */
export function cleanLook() {
  // Las claras salen menos: el feed es sobre todo oscuro
  const id = pickFresh('gz_clean_palettes', CLEAN_PALETTES.map((p) => p.id), 5)
  const palette = CLEAN_PALETTES.find((p) => p.id === id)
  const deco = pickFresh('gz_clean_decos', DECOS, 1)
  const layout = pickFresh('gz_clean_layouts', CLEAN_LAYOUTS, 10)
  // El logo oscuro solo va sobre fondo oscuro: sobre claro o sobre un bloque de color dejaría una placa negra pesada
  const logo = palette.dark && layout !== 'colorhead' ? pickFresh('gz_clean_logo', ['light', 'dark'], 1) : 'light'
  return { palette, layout, logo, contact: cleanContact(palette.dark), deco: deco === 'none' ? null : deco }
}
