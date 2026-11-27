// Música del catálogo de Instagram para los Reels: se busca, se escucha y se adjunta al publicar (API de audio de Meta).
// Como en Instagram, al entrar se ven las tendencias, con pestañas de música y de sonidos originales (estos son de otros
// usuarios y pueden tener derechos de terceros, por eso llevan un aviso). Las listas se piden a Instagram cada vez que se
// abren y se renuevan solas; los favoritos se guardan en el espacio compartido.
import { useEffect, useRef, useState } from 'react'
import { socialCall } from '../lib/social.js'
import { fetchFavorites, addFavorite, removeFavorite, updateFavorite } from '../lib/musicFavs.js'
import { t, useLang } from '../lib/i18n.jsx'

const KINDS = [['music', '🔥 Música en tendencia'], ['original_sound', '🎤 Sonidos originales'], ['fav', '⭐ Favoritos']]
const FRESH_MS = 10 * 60000 // pasado este tiempo, la lista abierta se vuelve a pedir
const plain = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
const length = (ms) => (ms ? `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}` : '')

export default function IgMusic({ value, onChange, notify }) {
  useLang()
  const [open, setOpen] = useState(!value)
  const [kind, setKind] = useState('music')
  const [query, setQuery] = useState('')
  const [list, setList] = useState(null) // { tracks, after, kind, text }: lo último que respondió Instagram
  const [failed, setFailed] = useState('')
  const [busy, setBusy] = useState(false)
  const [playing, setPlaying] = useState(null) // id de la pista que suena
  const audio = useRef(null)
  const wanted = useRef(null)
  const asked = useRef(0)
  const [favs, setFavs] = useState(null) // null = cargando o sin poder leerlos
  const [favError, setFavError] = useState('')
  const renewed = useRef(new Set()) // carátulas que ya se intentaron renovar

  const stop = () => { wanted.current = null; audio.current?.pause(); audio.current = null; setPlaying(null) }
  useEffect(() => stop, [])

  /** Escucha una pista. El enlace de prueba caduca, así que si no está se pide de nuevo. */
  const play = async (track) => {
    if (playing === track.id) return stop()
    stop()
    wanted.current = track.id
    setPlaying(track.id)
    // El reproductor se crea en el mismo toque: en el iPhone no puede sonar si se crea después de esperar al servidor
    const a = new Audio()
    audio.current = a
    a.onended = stop
    try {
      let url = track.preview
      if (!url) {
        a.play().catch(() => {})
        url = (await socialCall('audio-info', { audioId: track.id })).track?.preview
      }
      if (wanted.current !== track.id) return
      if (!url) throw new Error()
      a.src = url
      await a.play()
    } catch {
      if (wanted.current !== track.id) return
      stop()
      notify(t('No se puede escuchar esta pista desde la app.'), 'err')
    }
  }

  /** Sin `after` empieza la lista; con `after` agrega la página siguiente. Sin texto, Instagram devuelve las tendencias. */
  const search = async ({ type = kind, text = query.trim(), after = null, quiet = false } = {}) => {
    if (type === 'fav') return // los favoritos se filtran aquí, sin pedir nada a Instagram
    const n = ++asked.current
    setBusy(true); setFailed('')
    if (!after && !quiet) setList(null)
    try {
      const r = await socialCall('audio-search', { kind: type, query: text, after })
      if (n === asked.current) {
        setList((cur) => {
          const old = after && cur ? cur.tracks : []
          const have = new Set(old.map((x) => x.id))
          const fresh = (r.tracks || []).filter((x) => !have.has(x.id))
          return { tracks: [...old, ...fresh], after: fresh.length ? r.after || null : null, kind: type, text, at: Date.now() }
        })
      }
    } catch (e) {
      if (n === asked.current && !quiet) setFailed(t('No se pudo buscar música: {e}', { e: e.message }))
    }
    if (n === asked.current) setBusy(false)
  }
  useEffect(() => { if (!value) search() }, []) // eslint-disable-line

  const loadFavs = () => fetchFavorites().then((l) => { setFavs(l); setFavError('') }).catch((e) => setFavError(e.message))
  useEffect(() => { loadFavs() }, [])

  // Con la lista abierta, se renueva sola cuando Instagram pudo haberla cambiado: cada 10 minutos o al volver a la app
  const latest = useRef({})
  latest.current = { open, kind, list, busy, search }
  useEffect(() => {
    const renew = () => {
      const c = latest.current
      if (document.hidden || !c.open || c.busy || c.kind === 'fav' || !c.list || Date.now() - c.list.at < FRESH_MS) return
      c.search({ type: c.list.kind, text: c.list.text, quiet: true })
    }
    const back = () => { if (!document.hidden) { renew(); loadFavs() } } // la otra persona pudo guardar favoritos
    const timer = setInterval(renew, 60000)
    document.addEventListener('visibilitychange', back)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', back) }
  }, []) // eslint-disable-line

  const show = () => { setOpen(true); loadFavs(); search() }
  const pickKind = (type) => { if (type === kind) return; stop(); setKind(type); if (type === 'fav') loadFavs(); else search({ type }) }

  const isFav = (id) => Boolean(favs?.some((f) => f.id === id))
  const toggleFav = async (x) => {
    const had = isFav(x.id)
    const track = { ...x, kind: x.kind || (kind === 'fav' ? 'music' : kind) }
    setFavs((l) => (had ? (l || []).filter((f) => f.id !== x.id) : [track, ...(l || [])]))
    try { await (had ? removeFavorite(x.id) : addFavorite(track)) } catch (e) {
      notify(t('No se pudo guardar el favorito: {e}', { e: e.message }), 'err')
      // No se guardó: la estrella vuelve a como estaba
      setFavs((l) => (had ? [track, ...(l || [])] : (l || []).filter((f) => f.id !== x.id)))
      loadFavs()
    }
  }
  /** La carátula guardada caducó: se pide una nueva una sola vez. */
  const renewCover = async (id) => {
    const fav = favs?.find((f) => f.id === id)
    if (!fav || renewed.current.has(id)) return
    renewed.current.add(id)
    const cover = (await socialCall('audio-info', { audioId: id }).catch(() => null))?.track?.cover
    if (!cover || cover === fav.cover) return
    setFavs((l) => (l || []).map((f) => (f.id === id ? { ...f, cover } : f)))
    updateFavorite({ ...fav, cover }).catch(() => {})
  }

  const isFavTab = kind === 'fav'
  const tracks = isFavTab ? favs?.filter((x) => plain(x.title + ' ' + x.artist).includes(plain(query.trim()))) : list?.tracks
  const choose = (x) => {
    stop()
    onChange({ id: x.id, title: x.title, artist: x.artist, cover: x.cover, duration: x.duration, kind: x.kind || (kind === 'fav' ? 'music' : kind), volume: value?.volume ?? 80, videoVolume: value?.videoVolume ?? 100 })
    setOpen(false)
  }
  // La carátula es el botón para escuchar, como en Instagram
  const playButton = (x) => (
    <button type="button" className="igm-play" onClick={() => play(x)} aria-label={(playing === x.id ? t('Pausar') : t('Escuchar')) + ' ' + x.title}>
      {x.cover && <img key={x.cover} src={x.cover} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; renewCover(x.id) }} />}
      <span>{playing === x.id ? '⏸' : '▶'}</span>
    </button>
  )

  const star = (x) => (
    <button type="button" className={'igm-star' + (isFav(x.id) ? ' on' : '')} onClick={() => toggleFav(x)} aria-pressed={isFav(x.id)}
      aria-label={(isFav(x.id) ? t('Quitar de favoritos') : t('Guardar en favoritos')) + ' ' + x.title}>{isFav(x.id) ? '★' : '☆'}</button>
  )

  return (
    <div className="igm">
      <div className="igm-head">
        <div><b>🎵 {t('Música de Instagram (opcional)')}</b><small>{t('Instagram la agrega al publicar el Reel. No se puede ver la mezcla antes de publicar.')}</small></div>
        {!open && <button type="button" className="btn ghost sm" onClick={show}>{value ? t('Cambiar música') : t('Elegir música')}</button>}
        {open && <button type="button" className="btn ghost sm" onClick={() => { stop(); setOpen(false) }}>{t('Cerrar')}</button>}
      </div>

      {value && (
        <div className="igm-chosen">
          <div className="igm-row">
            {playButton(value)}
            <div className="igm-info"><b>{value.title}</b><small>{[value.artist, length(value.duration)].filter(Boolean).join(' · ')}</small></div>
            {star(value)}
            <button type="button" className="btn danger sm" onClick={() => { stop(); onChange(null) }}>{t('Quitar')}</button>
          </div>
          <div className="igm-vols">
            {[['volume', 'Volumen de la música'], ['videoVolume', 'Volumen de tu video']].map(([key, label]) => (
              <label key={key}>{t(label)}: {value[key]}%
                <input type="range" min="1" max="100" value={value[key]} onChange={(e) => onChange({ ...value, [key]: Number(e.target.value) })} />
              </label>
            ))}
          </div>
          <small className="muted">{t('Si tu video ya tiene música con derechos, baja su volumen al mínimo.')}</small>
        </div>
      )}

      {open && (
        <div className="igm-panel">
          <div className="igm-tabs" role="group" aria-label={t('Tipo de audio')}>
            {KINDS.map(([id, label]) => (
              <button key={id} type="button" className={'chip' + (kind === id ? ' on' : '')} aria-pressed={kind === id} onClick={() => pickKind(id)}>{t(label)}</button>
            ))}
          </div>
          <div className="igm-search">
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }} placeholder={isFavTab ? t('Buscar en tus favoritos') : t('Buscar por estilo, canción o artista (vacío = tendencias)')} aria-label={t('Buscar música')} />
            {!isFavTab && <button type="button" className="btn primary sm" disabled={busy} onClick={() => search()}>{t('Buscar')}</button>}
          </div>
          <small className="muted">{t('Catálogo que Instagram permite usar a las apps: no incluye todas las canciones que ves en Instagram.')}</small>
          {(kind === 'original_sound' || (isFavTab && tracks?.some((x) => x.kind === 'original_sound'))) && <p className="warn">⚠️ {t('Los sonidos originales son de otros usuarios y pueden incluir música con derechos.')}</p>}
          {!isFavTab && list && (
            <div className="igm-bar">
              <b className="igm-title">{list.text ? t('Resultados de «{q}»', { q: list.text }) : t('En tendencia ahora')}</b>
              <span>
                <small className="muted">{t('Actualizado a las {h}', { h: new Date(list.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })}</small>
                <button type="button" className="btn ghost sm" disabled={busy} onClick={() => search({ type: list.kind, text: list.text, quiet: true })}>↻ {t('Actualizar')}</button>
              </span>
            </div>
          )}
          {!isFavTab && failed && <p className="warn">⚠️ {failed}</p>}
          {isFavTab && favError && <p className="warn">⚠️ {t('No se pudieron cargar los favoritos: {e}', { e: favError })}</p>}
          {isFavTab && favs && !favs.length && <p className="muted">{t('Aún no tienes favoritos: toca la ☆ de una canción para guardarla.')}</p>}
          {tracks && !tracks.length && (!isFavTab || favs.length > 0) && <p className="muted">{t('No se encontró música con esa búsqueda.')}</p>}
          <div className="igm-list">
            {(tracks || []).map((x, i) => (
              <div key={x.id} className={'igm-row' + (value?.id === x.id ? ' on' : '')}>
                <i className="igm-n">{i + 1}</i>
                {playButton(x)}
                <div className="igm-info"><b>{x.title}</b><small>{[x.artist, length(x.duration)].filter(Boolean).join(' · ')}</small></div>
                {star(x)}
                <button type="button" className="btn blue sm" onClick={() => choose(x)}>{t('Usar')}</button>
              </div>
            ))}
            {!isFavTab && list?.after && !busy && <button type="button" className="btn ghost sm" onClick={() => search({ type: list.kind, text: list.text, after: list.after })}>{t('Ver más')}</button>}
          </div>
          {!isFavTab && busy && <p className="muted" role="status">{t('Buscando…')}</p>}
        </div>
      )}
    </div>
  )
}
