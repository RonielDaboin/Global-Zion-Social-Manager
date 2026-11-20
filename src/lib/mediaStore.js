// Los videos pesan demasiado para localStorage: se guardan en IndexedDB, por id de publicación.
const DB = 'gz-media'
const STORE = 'videos'

const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1)
  r.onupgradeneeded = () => r.result.createObjectStore(STORE)
  r.onsuccess = () => res(r.result)
  r.onerror = () => rej(r.error)
})

const run = async (mode, fn) => {
  const db = await open()
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); res(req?.result) }
    tx.onerror = () => { db.close(); rej(tx.error) }
  })
}

export const saveVideo = (id, blob) => run('readwrite', (s) => s.put(blob, id))
export const loadVideo = (id) => run('readonly', (s) => s.get(id)).catch(() => null)
export const deleteVideo = (id) => run('readwrite', (s) => s.delete(id)).catch(() => {})
