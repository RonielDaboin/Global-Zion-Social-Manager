// Copia local de las publicaciones. Las imágenes pesan demasiado para localStorage (unos 5 MB en total),
// así que se guarda en IndexedDB; localStorage queda solo como respaldo si IndexedDB no está disponible.
const DB = 'gz-cache'
const STORE = 'posts'

const run = (mode, fn) => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(STORE)
  r.onerror = () => rej(r.error)
  r.onsuccess = () => {
    const db = r.result
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); res(req?.result) }
    tx.onerror = tx.onabort = () => { db.close(); rej(tx.error) }
  }
})

const oldKey = (key) => `gz_posts_${key}`

export async function readPostCache(key) {
  // Si queda una copia en localStorage es la más reciente (se borra al guardar en IndexedDB)
  try { const v = localStorage.getItem(oldKey(key)); if (v) return JSON.parse(v) } catch { /* ignore */ }
  try { return (await run('readonly', (s) => s.get(key))) || [] } catch { return [] }
}

/** Devuelve false solo si no se pudo guardar en ningún sitio. */
export async function writePostCache(key, posts) {
  try {
    await run('readwrite', (s) => s.put(posts, key))
    try { localStorage.removeItem(oldKey(key)) } catch { /* ignore */ } // libera el espacio que ocupaba
    return true
  } catch {
    try { localStorage.setItem(oldKey(key), JSON.stringify(posts)); return true } catch { return false }
  }
}
