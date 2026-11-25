// Fotos de la web para los fondos: Wikimedia Commons, gratis y sin clave. Solo se piden fotos con licencia CC0
// (dominio público), que se pueden publicar sin dar crédito, y su servidor permite usarlas en el lienzo (CORS).
import { shrinkImage } from './social.js'
import { t } from './i18n.jsx'

const API = 'https://commons.wikimedia.org/w/api.php'
const CC0 = 'haswbstatement:P275=Q6938433'

async function search(query, limit) {
  const params = new URLSearchParams({
    action: 'query', format: 'json', origin: '*', generator: 'search',
    gsrsearch: `${query} filemime:image/jpeg ${CC0} filew:>1000`, gsrnamespace: '6', gsrlimit: String(limit),
    prop: 'imageinfo', iiprop: 'url|size|mime', iiurlwidth: '1280',
  })
  const res = await fetch(`${API}?${params}`, { signal: AbortSignal.timeout?.(20000) })
  if (!res.ok) throw new Error(t('No se pudo buscar fotos en la web.'))
  const data = await res.json()
  return Object.values(data.query?.pages || {})
    .sort((a, b) => a.index - b.index)
    .map((p) => ({ page: p, info: p.imageinfo?.[0] }))
    .filter(({ info }) => info?.thumburl && info.mime === 'image/jpeg')
    .map(({ page, info }) => ({
      id: page.pageid,
      title: page.title.replace(/^File:|\.\w+$/g, ''),
      url: info.thumburl,
      thumb: info.thumburl.replace('/1280px-', '/330px-'),
      page: info.descriptionurl,
    }))
}

/** Busca fotos CC0. Si la frase completa no encuentra nada, va quitando palabras desde el final. */
export async function searchWebPhotos(query, limit = 12) {
  const words = String(query || '').replace(/[^\p{L}\p{N} -]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 5)
  while (words.length) {
    const found = await search(words.join(' '), limit)
    if (found.length) return found
    words.pop()
  }
  return []
}

const toDataURL = (blob) => new Promise((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(r.result)
  r.onerror = () => rej(r.error)
  r.readAsDataURL(blob)
})

/** Descarga una foto encontrada y la deja como dataURL lista para usar de fondo. */
export async function loadWebPhoto(url, max = 1350) {
  const res = await fetch(url, { signal: AbortSignal.timeout?.(30000) })
  if (!res.ok) throw new Error(t('No se pudo descargar la foto.'))
  const img = await shrinkImage(await toDataURL(await res.blob()), max)
  if (!img) throw new Error(t('No se pudo descargar la foto.'))
  return img
}
