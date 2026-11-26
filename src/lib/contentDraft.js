// Publicaciones nuevas a partir de un video de la sección Contenido.
import { blankDesign, uid } from './formats.js'
import { saveVideo } from './mediaStore.js'
import { downloadContentBlob } from './content.js'

const COVER_SECOND = 3 // la misma portada que se ve en Contenido

/** Baja el video, lo deja listo para el editor y devuelve la publicación nueva. `extra` completa o cambia campos. */
export async function videoDraft(item, extra = {}) {
  const base = { id: uid(), fromContent: true, contentId: item.id, caption: '' }
  const blob = await downloadContentBlob(item)
  await saveVideo(base.id, new File([blob], item.name, { type: item.mime }))
  return {
    ...base,
    mediaType: 'video',
    video: { name: item.name, size: item.size, duration: 0, width: 0, height: 0, cover: null, coverTime: 0, autoCover: COVER_SECOND },
    design: blankDesign(),
    ...extra,
  }
}

/** Primer día libre a las 18:00 (sin otra publicación programada ese día), con al menos 30 minutos de margen. */
export function nextFreeSlot(posts, now = Date.now()) {
  const taken = new Set(posts.filter((p) => p.scheduledAt && ['scheduled', 'publishing'].includes(p.status)).map((p) => new Date(p.scheduledAt).toDateString()))
  for (let i = 0; i < 120; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    d.setHours(18, 0, 0, 0)
    if (d.getTime() > now + 30 * 60000 && !taken.has(d.toDateString())) return d.getTime()
  }
  return now + 3600e3
}

/** Redes para un video nuevo: las conectadas que el plan permite y aceptan video (el correo no). */
export function videoPlatforms(accounts, allowed) {
  const list = Object.keys(accounts).filter((id) => id !== 'email' && allowed.includes(id))
  return list.length ? list : ['instagram']
}

/** Cómo se está usando cada video en las publicaciones: contentId → 'published' | 'scheduled' | 'draft'. */
export function contentUse(posts) {
  const rank = { draft: 1, failed: 1, scheduled: 2, publishing: 2, published: 3 }
  const names = [null, 'draft', 'scheduled', 'published']
  const best = new Map()
  for (const p of posts) if (p.contentId) best.set(p.contentId, Math.max(best.get(p.contentId) || 0, rank[p.status] || 0))
  return new Map([...best].map(([id, n]) => [id, names[n]]))
}
