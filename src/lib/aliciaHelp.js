// Lo que Alicia puede ver de la app y cómo se aplican los cambios que propone. Nunca publica ni borra.
import { PLATFORMS } from './formats.js'
import { composeCaption, normalizeTags, initialSheet, withContact } from './postSheet.js'
import { dayString, timeString, slotTime, isPast } from './aliciaPlan.js'
import { scheduledInMonth } from './plans.js'
import { t } from './i18n.jsx'

/** El editor abierto se anuncia aquí: { snapshot(), image(), apply(valores) }. null si no está en pantalla. */
export const editorBridge = { current: null }

/** Estados en los que se puede cambiar una publicación guardada. */
export const EDITABLE = ['draft', 'scheduled', 'failed']
const MAX_PENDING = 15
const MAX_PUBLISHED = 6

export const toWhen = (ts) => `${dayString(new Date(ts))}T${timeString(new Date(ts))}`

/**
 * Resumen de la app para la IA. A cada publicación guardada se le da una referencia corta (p1, p2…);
 * `refs` permite volver de la referencia al id.
 */
export function appContext({ page, posts, accounts, editor }) {
  const byDate = (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  const pending = posts.filter((p) => p.status !== 'published' && p.id !== editor?.id).sort(byDate).slice(0, MAX_PENDING)
  const published = posts.filter((p) => p.status === 'published').sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0)).slice(0, MAX_PUBLISHED)
  const refs = {}
  const list = [...pending, ...published].map((p, i) => {
    const ref = 'p' + (i + 1)
    refs[ref] = p.id
    const sheet = initialSheet(p.sheet, p.caption)
    const at = p.status === 'published' ? p.publishedAt : p.scheduledAt
    const errors = Object.entries(p.results || {}).filter(([, r]) => !r.ok).map(([network, r]) => `${network}: ${r.error}`)
    // De lo ya publicado no se puede cambiar nada: basta con el comienzo
    const short = p.status === 'published'
    return {
      ref, status: p.status, type: p.mediaType === 'video' ? 'video' : 'image', when: at ? toWhen(at) : '', networks: p.platforms,
      title: sheet.title, description: short ? sheet.description.slice(0, 160) : sheet.description, tags: sheet.tags, errors,
    }
  })
  const connected = Object.keys(accounts).map((id) => id + (accounts[id].real ? '' : ' (demo)'))
  return { refs, context: { page, connected, posts: list, editor: editor ? { ...editor, id: undefined } : null } }
}

/**
 * Calcula cómo queda una publicación con los cambios pedidos (los campos vacíos no se tocan).
 * `base`: { sheet, platforms, when: 'AAAA-MM-DDTHH:MM', mediaType }. Devuelve { next } o { error }.
 */
export function planEdit(base, values, access) {
  const sheet = { ...base.sheet }
  if (values.title) sheet.title = values.title
  if (values.description) sheet.description = withContact(values.description)
  if (values.tags) sheet.tags = normalizeTags(values.tags)
  let platforms = base.platforms
  if (values.networks?.length) {
    platforms = values.networks.filter((p) => PLATFORMS[p] && access.limits.platforms.includes(p) && !(p === 'youtube' && base.mediaType !== 'video'))
    if (!platforms.length) return { error: t('Esas redes no están disponibles para esta publicación.') }
  }
  let when = base.when
  if (values.date || values.time) {
    const date = values.date || base.when.slice(0, 10)
    const time = values.time || base.when.slice(11, 16)
    if (!Number.isFinite(slotTime(date, time))) return { error: t('No entendí las fechas. Dime los días de otra forma.') }
    if (isPast(date, time)) return { error: t('Esa hora ya pasó: cámbiala para poder programarla.') }
    when = `${date}T${time}`
  }
  const maxLen = Math.min(...(platforms.length ? platforms : ['instagram']).map((p) => PLATFORMS[p].limit))
  if (composeCaption(sheet).length > maxLen) return { error: t('El texto supera el límite de {n} caracteres', { n: maxLen }) }
  return { next: { sheet, platforms, when } }
}

/** Aplica los cambios a una publicación guardada. Devuelve { post } o { error }. */
export function editSavedPost(post, values, { access, accounts, posts }) {
  if (!EDITABLE.includes(post.status)) return { error: t('Esa publicación ya no se puede cambiar.') }
  const scheduledAt = post.scheduledAt || Date.now() + 3600e3
  const r = planEdit({ sheet: initialSheet(post.sheet, post.caption), platforms: post.platforms, when: toWhen(scheduledAt), mediaType: post.mediaType }, values, access)
  if (r.error) return r
  const { sheet, platforms, when } = r.next
  const moved = !!(values.date || values.time)
  const at = moved ? new Date(when).getTime() : post.scheduledAt
  if (post.status === 'scheduled') {
    const missing = platforms.filter((p) => !accounts[p])
    if (missing.length) return { error: t('Conecta primero: {p}', { p: missing.map((p) => PLATFORMS[p].name).join(', ') }) }
    if (moved && scheduledInMonth(posts, at, post.id) >= access.limits.scheduledPerMonth) return { error: t('Tu plan no permite programar más publicaciones ese mes.') }
  }
  return { post: { ...post, sheet, caption: composeCaption(sheet), platforms, scheduledAt: at } }
}
