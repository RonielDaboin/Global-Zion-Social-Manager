// Reglas del plan de Alicia (fechas, horas y redes). Sin dependencias, para poder probarlas por separado.

// Hora de cada publicación cuando no se pide una: la primera del día a las 18:00, la segunda a las 12:00, etc.
export const DEFAULT_TIMES = ['18:00', '12:00', '20:00', '10:00', '15:00', '09:00', '13:00', '17:00', '19:00', '21:00']
const CALENDAR_DAYS = 35
const MARGIN = 5 * 60000 // lo que se programa debe quedar al menos 5 minutos en el futuro

const pad = (n) => String(n).padStart(2, '0')
export const dayString = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const timeString = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`

/** Fecha y hora locales en milisegundos; NaN si el texto no es válido. */
export const slotTime = (date, time) => (/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time) ? new Date(`${date}T${time}`).getTime() : NaN)
export const isPast = (date, time, now = Date.now()) => !(slotTime(date, time) > now + MARGIN)

/** Calendario que se le pasa a la IA: «2026-11-30 lunes (mañana)». */
export function calendarLines(now = new Date(), lang = 'es') {
  const name = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'es-CL', { weekday: 'long' })
  const marks = lang === 'en' ? ['today', 'tomorrow'] : ['hoy', 'mañana']
  return Array.from({ length: CALENDAR_DAYS }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, 12)
    return `${dayString(d)} ${name.format(d)}${marks[i] ? ` (${marks[i]})` : ''}`
  })
}

/**
 * Completa las horas que falten y ordena por fecha. Para cada día usa las horas por defecto que no estén ocupadas por
 * otra publicación del plan o ya programada (`taken`: milisegundos), saltando las que ya pasaron.
 */
export function fillTimes(items, taken = [], now = Date.now()) {
  const used = new Set(taken.filter(Boolean).map((ts) => `${dayString(new Date(ts))} ${timeString(new Date(ts))}`))
  for (const it of items) if (it.time) used.add(`${it.date} ${it.time}`)
  return items.map((it) => {
    if (it.time) return it
    const free = DEFAULT_TIMES.filter((h) => !used.has(`${it.date} ${h}`))
    const time = free.find((h) => !isPast(it.date, h, now)) || free[0] || DEFAULT_TIMES[0]
    used.add(`${it.date} ${time}`)
    return { ...it, time }
  }).sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
}

/** Limpia lo que devuelve la IA: descarta fechas inválidas y deja las horas bien escritas. */
export function cleanItems(items) {
  return (items || []).map((x) => {
    const date = String(x.date || '')
    const m = String(x.time || '').match(/^(\d{1,2}):(\d{2})$/)
    const time = m && Number(m[1]) < 24 && Number(m[2]) < 60 ? `${pad(Number(m[1]))}:${m[2]}` : ''
    const video = x.type === 'video'
    return { type: video ? 'video' : 'image', date, time, topic: String(x.topic || ''), networks: x.networks || [], music: !!x.music, musicQuery: String(x.musicQuery || '') }
  }).filter((x) => Number.isFinite(slotTime(x.date, '12:00')))
}

const ACCEPTS = {
  image: ['instagram', 'facebook', 'twitter', 'linkedin'], // TikTok y YouTube solo admiten video desde la app
  video: ['instagram', 'facebook', 'tiktok', 'twitter', 'linkedin', 'youtube'],
}

/**
 * Redes de una publicación: las pedidas, o las conectadas (las reales antes que las de demostración).
 * Siempre dentro de lo que admite el tipo y permite el plan. El correo y WhatsApp quedan fuera: piden destinatarios.
 */
export function networksFor(type, asked, accounts, allowed) {
  const ok = (id) => ACCEPTS[type].includes(id) && allowed.includes(id)
  const wanted = (asked || []).filter(ok)
  if (wanted.length) return wanted
  const connected = Object.keys(accounts).filter(ok)
  const real = connected.filter((id) => accounts[id].real)
  const list = real.length ? real : connected
  return list.length ? list : ['instagram']
}
