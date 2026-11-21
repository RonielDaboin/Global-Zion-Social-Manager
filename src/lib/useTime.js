import { useEffect, useState } from 'react'

// Tiempo de uso acumulado por usuario (solo cuenta con la pestaña visible). Se guarda en este navegador.
const key = (id) => 'gz_usage_' + id
const read = (id) => { try { return JSON.parse(localStorage.getItem(key(id))) || { total: 0, sessions: 0 } } catch { return { total: 0, sessions: 0 } } }
const write = (id, v) => { try { localStorage.setItem(key(id), JSON.stringify(v)) } catch { /* ignore */ } }
const START = Date.now()

/** Registra el uso mientras haya sesión. Devuelve segundos de esta visita y el total acumulado. */
export function useUsageTime(userId) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!userId) return
    let seen = null
    try { seen = sessionStorage.getItem('gz_counted_' + userId) } catch { /* ignore */ }
    if (!seen) {
      const u = read(userId)
      u.sessions += 1
      write(userId, u)
      try { sessionStorage.setItem('gz_counted_' + userId, '1') } catch { /* ignore */ }
    }
    let last = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      if (document.visibilityState === 'visible') {
        const cur = read(userId)
        cur.total += Math.min(now - last, 60000)
        write(userId, cur)
      }
      last = now
      tick((n) => n + 1)
    }, 15000)
    return () => clearInterval(id)
  }, [userId])
  if (!userId) return { visit: 0, total: 0, sessions: 0 }
  const u = read(userId)
  return { visit: Math.floor((Date.now() - START) / 1000), total: Math.floor(u.total / 1000), sessions: u.sessions }
}

export const fmtDur = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h} h ${m} min` : `${m} min`
}
