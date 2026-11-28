// Recupera los textos de un diseño automático ya guardado, para poder volver a armarlo (edición rápida).
// Se arma la misma composición con marcas en lugar de textos y se lee qué hay en esas mismas capas: así valen también
// las publicaciones antiguas y los textos corregidos a mano en el editor.
import { buildDesign } from './designs.js'
import { BRAND } from './brand.js'

const MAX_POINTS = 6
const MARK = /§(k|t|l|p\d)§/

const shape = (l) => [!!l.logo, !!l.brand, !!l.box].join()

function match(design, n) {
  const { layout, palette, photo, logo, contact, foot } = design.auto
  const info = { kicker: '§k§', title: '§t§', points: Array.from({ length: n }, (_, i) => `§p${i}§`), link: '§l§' }
  const probe = buildDesign({ info, palette, layout, photo, logo, contact, foot, deco: null })
  if (probe.layers.length !== design.layers.length) return null
  const found = {}
  for (let i = 0; i < probe.layers.length; i++) {
    const want = probe.layers[i], got = design.layers[i]
    if (shape(want) !== shape(got)) return null
    const mark = String(want.text || '').match(MARK)
    if (!mark) continue
    const before = want.text.slice(0, mark.index), after = want.text.slice(mark.index + mark[0].length)
    const text = String(got.text || '')
    if (!text.startsWith(before) || !text.endsWith(after)) return null
    found[mark[1]] ??= text.slice(before.length, text.length - after.length)
  }
  const points = info.points.map((_, i) => found['p' + i])
  if (found.t === undefined || points.some((p) => p === undefined)) return null
  return { kicker: found.k ?? 'Global Zion', title: found.t, points, link: found.l || BRAND.site }
}

/**
 * Devuelve { kicker, title, points, link }, o null si no es un diseño automático o se le agregaron o quitaron elementos
 * a mano (volver a armarlo los perdería).
 */
export function readInfo(design) {
  if (!design?.auto || !Array.isArray(design.layers)) return null
  for (let n = 1; n <= MAX_POINTS; n++) {
    const info = match(design, n)
    if (info) return info
  }
  return null
}

/** ¿Se puede abrir esta publicación en la edición rápida? */
export const canQuickEdit = (post) => !!post && post.mediaType !== 'video' && !!readInfo(post.design)
