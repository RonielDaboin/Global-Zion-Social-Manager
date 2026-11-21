// Registro de uso de IA por proveedor, para estimar cuánto cupo gratuito queda (pantalla «Créditos IA»).
import { supabase } from './supabase.js'

/** Anota una llamada a la IA. Nunca lanza: si la tabla no existe todavía, simplemente no se registra. */
export const logAI = (provider, kind, status = 'ok') => {
  try { supabase.from('ai_usage').insert({ provider, kind, status }).then(() => {}, () => {}) } catch { /* ignore */ }
}
export const isLimitMsg = (m = '') => /l[ií]mite|429|cuota|quota|saturad/i.test(m)

export const PROVIDERS = [
  {
    id: 'cloudflare', name: 'Cloudflare Workers AI', unit: 'imágenes', def: 400, tz: 'UTC',
    note: 'Capa gratuita: 10 000 neuronas al día (≈ 400 imágenes FLUX schnell, aproximado). Se reinicia a las 00:00 UTC.',
    link: 'https://dash.cloudflare.com/',
  },
  {
    id: 'gemini', name: 'Google Gemini', unit: 'peticiones', def: 500, tz: 'America/Los_Angeles',
    note: 'El cupo gratuito es por modelo: los Flash Lite dan 500 peticiones al día y los Flash normales solo 20. Se reinicia a medianoche (hora del Pacífico).',
    link: 'https://aistudio.google.com/rate-limit',
  },
  {
    id: 'pollinations', name: 'Pollinations', unit: 'imágenes', def: null, tz: 'UTC',
    note: 'Gratis y sin cupo fijo: depende de la carga del servicio (a veces pide créditos y responde 402). Aquí solo se cuenta lo que has generado.',
    link: 'https://pollinations.ai/',
  },
]

/** Instante (ms) en que empezó el «día» actual en la zona horaria dada. */
export const dayStart = (tz, now = Date.now()) => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(now))
  const g = (k) => Number(parts.find((p) => p.type === k).value) % 24
  return now - ((g('hour') * 60 + g('minute')) * 60 + g('second')) * 1000
}

export async function loadUsage() {
  const since = new Date(Date.now() - 3 * 86400e3).toISOString()
  const { data, error } = await supabase.from('ai_usage').select('provider,kind,status,created_at').gte('created_at', since).limit(5000)
  if (error) throw error
  return data || []
}

// Ajuste manual de «usadas hoy» (vale solo para el día en curso de cada proveedor)
const EXTRA_KEY = (p, start) => `gz_ai_extra_${p.id}_${new Date(start).toISOString().slice(0, 10)}`
export const getExtra = (p, start) => { try { return Number(localStorage.getItem(EXTRA_KEY(p, start))) || 0 } catch { return 0 } }
export const setExtra = (p, start, n) => { try { localStorage.setItem(EXTRA_KEY(p, start), String(n)) } catch { /* ignore */ } }

const LIM_KEY = (id) => 'gz_ai_limit_' + id
export const getLimit = (p) => {
  try { const v = localStorage.getItem(LIM_KEY(p.id)); if (v !== null) return v === '' ? null : Number(v) } catch { /* ignore */ }
  return p.def
}
export const setLimit = (p, v) => { try { localStorage.setItem(LIM_KEY(p.id), v === null ? '' : String(v)) } catch { /* ignore */ } }

/** Última lectura guardada de las cuotas de cada proveedor, por proveedor: { gemini: { data, taken_at } }. */
export async function loadSnapshots() {
  const { data, error } = await supabase.from('ai_snapshots').select('provider,data,taken_at')
  if (error) throw error
  return Object.fromEntries((data || []).map((r) => [r.provider, r]))
}
