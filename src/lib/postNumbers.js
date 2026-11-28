// Número fijo de cada publicación (#1, #2…), para nombrarla al hablar con Alicia. Se guarda en la propia publicación:
// no cambia al borrar otras.

export const maxNum = (posts) => posts.reduce((max, p) => Math.max(max, p.num || 0), 0)

/**
 * Pone número a las que no tienen (de la más antigua a la más nueva) y a las repetidas (dos personas creando a la vez:
 * se lo queda la más antigua). `floor` es el último número entregado y `skip(p)` deja para después las que no conviene
 * tocar ahora. Devuelve la misma lista si no hay nada que cambiar.
 */
export function fillNumbers(posts, floor = 0, skip = () => false) {
  const taken = new Set()
  const pending = []
  for (const p of [...posts].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || String(a.id).localeCompare(String(b.id)))) {
    if (p.num && !taken.has(p.num)) taken.add(p.num)
    else if (!skip(p)) pending.push(p.id)
  }
  if (!pending.length) return posts
  let last = Math.max(floor, maxNum(posts))
  const given = new Map(pending.map((id) => [id, ++last]))
  return posts.map((p) => (given.has(p.id) ? { ...p, num: given.get(p.id) } : p))
}

/** Todos los números que aparecen en un mensaje: esas publicaciones se le muestran siempre a Alicia. */
export const numbersIn = (message) => [...String(message).matchAll(/\d+/g)].map((m) => Number(m[0]))

// «#3», «publicación 3», «la publicación número 3», «post n° 3». No cuenta «2 publicaciones», fechas ni horas.
const NAMED = /(?:#|\b(?:publicaci[oó]n|post|n[uú]mero|n[°º])\s*(?:n[uú]mero\s*|n[°º]\s*)?#?)\s*(\d+)(?![\d:])/gi

/** El número de publicación que el usuario nombró sin lugar a dudas; null si no nombró ninguno o nombró varios. */
export function namedNumber(message) {
  const found = new Set([...String(message).matchAll(NAMED)].map((m) => Number(m[1])))
  return found.size === 1 ? [...found][0] : null
}
