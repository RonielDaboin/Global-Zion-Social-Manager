// Música del catálogo de Instagram para los Reels: se busca, se escucha y se adjunta al publicar (API de audio de Meta).
// Como en Instagram, al entrar se ven las tendencias, con pestañas de música y de sonidos originales (estos son de otros
// usuarios y pueden tener derechos de terceros, por eso llevan un aviso).
import { useEffect, useRef, useState } from 'react'
import { socialCall } from '../lib/social.js'
import { t, useLang } from '../lib/i18n.jsx'

const KINDS = [['music', '🔥 Música en tendencia'], ['original_sound', '🎤 Sonidos originales']]
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
  const search = async ({ type = kind, text = query.trim(), after = null } = {}) => {
    const n = ++asked.current
    setBusy(true); setFailed('')
    if (!after) setList(null)
    try {
      const r = await socialCall('audio-search', { kind: type, query: text, after })
      if (n === asked.current) {
        setList((cur) => {
          const old = after && cur ? cur.tracks : []
          const have = new Set(old.map((x) => x.id))
          const fresh = (r.tracks || []).filter((x) => !have.has(x.id))
          return { tracks: [...old, ...fresh], after: fresh.length ? r.after || null : null, kind: type, text }
        })
      }
    } catch (e) {
      if (n === asked.current) setFailed(t('No se pudo buscar música: {e}', { e: e.message }))
    }
    if (n === asked.current) setBusy(false)
  }
  useEffect(() => { if (!value) search() }, []) // eslint-disable-line
  const show = () => { setOpen(true); if (!list) search() }
  const pickKind = (type) => { if (type === kind) return; stop(); setKind(type); search({ type }) }
  const tracks = list?.tracks
  const choose = (x) => {
    stop()
    onChange({ id: x.id, title: x.title, artist: x.artist, cover: x.cover, duration: x.duration, volume: value?.volume ?? 80, videoVolume: value?.videoVolume ?? 100 })
    setOpen(false)
  }
  // La carátula es el botón para escuchar, como en Instagram
  const playButton = (x) => (
    <button type="button" className="igm-play" onClick={() => play(x)} aria-label={(playing === x.id ? t('Pausar') : t('Escuchar')) + ' ' + x.title}>
      {x.cover && <img src={x.cover} alt="" loading="lazy" referrerPolicy="no-referrer" />}
      <span>{playing === x.id ? '⏸' : '▶'}</span>
    </button>
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
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); search() } }} placeholder={t('Buscar por estilo, canción o artista (vacío = tendencias)')} aria-label={t('Buscar música')} />
            <button type="button" className="btn primary sm" disabled={busy} onClick={() => search()}>{t('Buscar')}</button>
          </div>
          <small className="muted">{t('Catálogo que Instagram permite usar a las apps: no incluye todas las canciones que ves en Instagram.')}</small>
          {kind === 'original_sound' && <p className="warn">⚠️ {t('Los sonidos originales son de otros usuarios y pueden incluir música con derechos.')}</p>}
          {list && <b className="igm-title">{list.text ? t('Resultados de «{q}»', { q: list.text }) : t('En tendencia ahora')}</b>}
          {failed && <p className="warn">⚠️ {failed}</p>}
          {tracks && !tracks.length && <p className="muted">{t('No se encontró música con esa búsqueda.')}</p>}
          <div className="igm-list">
            {(tracks || []).map((x, i) => (
              <div key={x.id} className={'igm-row' + (value?.id === x.id ? ' on' : '')}>
                <i className="igm-n">{i + 1}</i>
                {playButton(x)}
                <div className="igm-info"><b>{x.title}</b><small>{[x.artist, length(x.duration)].filter(Boolean).join(' · ')}</small></div>
                <button type="button" className="btn blue sm" onClick={() => choose(x)}>{t('Usar')}</button>
              </div>
            ))}
            {list?.after && !busy && <button type="button" className="btn ghost sm" onClick={() => search({ type: list.kind, text: list.text, after: list.after })}>{t('Ver más')}</button>}
          </div>
          {busy && <p className="muted" role="status">{t('Buscando…')}</p>}
        </div>
      )}
    </div>
  )
}
