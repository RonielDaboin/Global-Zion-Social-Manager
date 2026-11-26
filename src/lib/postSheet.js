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

// Datos de contacto que toda descripción debe llevar
const PHONE_LINE = '📲 WhatsApp: +56 9 3070 1132'
const WEB_LINE = '🌐 www.globalzion.cl'
export const CONTACT_LENGTH = PHONE_LINE.length + WEB_LINE.length + 3
const HAS_PHONE = /9[\s.-]*3070[\s.-]*1132/
const HAS_WEB = /(^|[^@\w.])(https?:\/\/)?(www\.)?globalzion\.cl/i // un correo o el @ de Instagram no cuentan como la web

/** Agrega al final de la descripción el WhatsApp y la web que le falten (sin repetir los que ya estén). */
export const withContact = (description) => {
  const text = String(description || '').trim()
  const missing = [!HAS_PHONE.test(text) && PHONE_LINE, !HAS_WEB.test(text) && WEB_LINE].filter(Boolean)
  return [text, missing.join('\n')].filter(Boolean).join('\n\n')
}

/** Ficha para un texto ya redactado (publicación automática): los hashtags del final pasan al campo de tags. */
export const sheetFromCaption = (caption) => {
  const text = String(caption || '').trim()
  const end = text.match(/(?:^|\s)((?:#[\p{L}\p{N}_]+\s*)+)$/u)
  return { title: '', description: withContact(end ? text.slice(0, end.index) : text), tags: end ? normalizeTags(end[1]) : '' }
}

/** Ficha con la que se abre el editor. Una publicación nueva empieza con el contacto puesto. Si el texto guardado
 * no sale de la ficha (publicaciones anteriores o escritas a mano), se conserva completo en la descripción. */
export const initialSheet = (sheet, caption) => {
  const text = String(caption || '')
  if (sheet && composeCaption(sheet) === text.trim()) return sheet
  return { title: '', description: text.trim() ? text : withContact(''), tags: '' }
}
