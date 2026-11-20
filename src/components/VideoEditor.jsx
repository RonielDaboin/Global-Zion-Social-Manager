import { useEffect, useRef, useState } from 'react'
import { PLATFORMS } from '../lib/formats.js'
import { Icon } from './ui.jsx'
import { t, useLang } from '../lib/i18n.jsx'

export const MAX_VIDEO_MB = 500
// Límites orientativos por plataforma (segundos / MB)
const LIMITS = {
  instagram: { sec: 90, label: 'Reels' },
  tiktok: { sec: 600 },
  facebook: { sec: 14400 },
  twitter: { sec: 140 },
  whatsapp: { mb: 16 },
  'whatsapp-business': { mb: 16 },
}

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const fmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB')
const orientation = (w, h) => (h > w * 1.2 ? 'vertical 9:16' : w > h * 1.2 ? 'horizontal 16:9' : 'cuadrado 1:1')

export function videoWarnings(video, platforms) {
  if (!video) return []
  const out = []
  for (const p of platforms) {
    const l = LIMITS[p]
    if (p === 'email') { out.push(t('El correo no admite video: se enviará solo la portada.')); continue }
    if (!l) continue
    if (l.sec && video.duration > l.sec) out.push(t('El video dura {d} y {p} admite máximo {m}.', { d: fmtTime(video.duration), p: PLATFORMS[p].name, m: fmtTime(l.sec) }))
    if (l.mb && video.size > l.mb * 1048576) out.push(t('El video pesa {s} y {p} admite máximo {m} MB.', { s: fmtSize(video.size), p: PLATFORMS[p].name, m: l.mb }))
  }
  return out
}

export default function VideoEditor({ file, video, setVideo, setFile, platforms, notify }) {
  useLang()
  const ref = useRef(null)
  const [url, setUrl] = useState(null)
  const [time, setTime] = useState(video?.coverTime || 0)

  useEffect(() => {
    if (!file) { setUrl(null); return }
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  const captureCover = (at) => {
    const v = ref.current
    if (!v || !v.videoWidth) return null
    const s = Math.min(1, 1080 / Math.max(v.videoWidth, v.videoHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s)
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
    return { cover: c.toDataURL('image/jpeg', 0.8), coverTime: at }
  }

  const onPick = (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('video/')) return notify(t('Selecciona un archivo de video (MP4, MOV, WebM).'), 'err')
    if (f.size > MAX_VIDEO_MB * 1048576) return notify(t('El video supera {n} MB.', { n: MAX_VIDEO_MB }), 'err')
    setFile(f)
    setVideo({ name: f.name, size: f.size, duration: 0, width: 0, height: 0, cover: null, coverTime: 0 })
    setTime(0)
  }

  const onMeta = () => {
    const v = ref.current
    setVideo((old) => ({ ...old, duration: v.duration, width: v.videoWidth, height: v.videoHeight }))
    v.currentTime = Math.min(0.1, v.duration / 2)
  }
  // Tras cada búsqueda de fotograma, actualiza la portada
  const onSeeked = () => {
    const c = captureCover(ref.current.currentTime)
    if (c) setVideo((old) => ({ ...old, ...c }))
  }
  const seek = (v) => {
    setTime(v)
    if (ref.current) ref.current.currentTime = v
  }
  const remove = () => { setFile(null); setVideo(null) }
  const warns = videoWarnings(video, platforms)

  return (
    <div className="editor">
      <div className="stage">
        <div className="canvas-wrap video-wrap" style={{ aspectRatio: video?.width ? `${video.width}/${video.height}` : '9/16' }}>
          {url
            ? <video ref={ref} src={url} controls playsInline preload="metadata" onLoadedMetadata={onMeta} onSeeked={onSeeked} />
            : <div className="video-empty"><Icon name="up" size={28} /><span>{t('Aún no has subido ningún video')}</span></div>}
        </div>
        {video && (
          <p className="hint">
            {video.width ? `${video.width}×${video.height}px · ${t(orientation(video.width, video.height))} · ` : ''}
            {fmtTime(video.duration || 0)} · {fmtSize(video.size)}
          </p>
        )}
      </div>

      <div className="tools">
        <section>
          <h4>{t('Video')}</h4>
          <div className="row">
            <label className="btn ghost sm file"><Icon name="up" size={15} /> {file ? t('Cambiar video') : t('Subir video')}<input type="file" accept="video/*" hidden onChange={onPick} /></label>
            {file && <button className="btn danger sm" onClick={remove}><Icon name="trash" size={14} /> {t('Quitar video')}</button>}
          </div>
          <p className="muted small">{t('Formatos: MP4, MOV o WebM. Máximo {n} MB. Recomendado: vertical 9:16 para Reels, TikTok e Historias.', { n: MAX_VIDEO_MB })}</p>
          {video && <p className="muted small">📎 {video.name}</p>}
        </section>

        {video?.duration > 0 && (
          <section>
            <h4>{t('Portada')}</h4>
            <p className="muted small">{t('Elige el fotograma que se usará como portada del video.')}</p>
            <label className="inl">{t('Fotograma')} {fmtTime(time)}
              <input type="range" min="0" max={video.duration} step="0.1" value={time} onChange={(e) => seek(+e.target.value)} />
            </label>
            {video.cover && <img className="cover-prev" src={video.cover} alt="" />}
          </section>
        )}

        <section>
          <h4>{t('Límites por red')}</h4>
          <ul className="limits">
            {platforms.filter((p) => LIMITS[p]).map((p) => (
              <li key={p}><b>{PLATFORMS[p].name}</b> · {LIMITS[p].sec ? t('hasta {m}', { m: fmtTime(LIMITS[p].sec) }) : t('hasta {n} MB', { n: LIMITS[p].mb })}</li>
            ))}
            {!platforms.some((p) => LIMITS[p]) && <li className="muted">{t('Selecciona una red en el paso 3 para ver sus límites.')}</li>}
          </ul>
          {warns.map((w, i) => <p key={i} className="warn">⚠️ {w}</p>)}
        </section>
      </div>
    </div>
  )
}
