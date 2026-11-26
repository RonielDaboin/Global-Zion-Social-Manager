// Ficha de una publicación (título, descripción y tags) y cómo se arma con ella el texto que se publica.

/** Convierte lo que haya escrito en el campo de tags en hashtags: «web, diseño #chile» → «#web #diseño #chile». */
export const normalizeTags = (value) => {
  const list = (Array.isArray(value) ? value : String(value || '').split(/[\s,;]+/))
    .map((x) => String(x).replace(/[^\p{L}\p{N}_]/gu, ''))
    .filter(Boolean)
    .map((x) => '#' + x)
  return [...new Set(list)].join(' ')
}

export const composeCaption = (sheet) => [sheet.title, sheet.description, normalizeTags(sheet.tags)]
  .map((x) => String(x || '').trim())
  .filter(Boolean)
  .join('\n\n')

/** Ficha con la que se abre el editor. Si el texto guardado no sale de la ficha (publicaciones anteriores o
 * escritas a mano), se conserva completo en la descripción. */
export const initialSheet = (sheet, caption) => {
  const text = String(caption || '')
  if (sheet && composeCaption(sheet) === text.trim()) return sheet
  return { title: '', description: text, tags: '' }
}
