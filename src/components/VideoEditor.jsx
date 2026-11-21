import { useEffect, useRef, useState } from 'react'
import { PLATFORMS } from '../lib/formats.js'
import { Icon } from './ui.jsx'
import { t, useLang } from '../lib/i18n.jsx'
import { FX0, PRESETS, fxCss, fxSame, vignetteCss, drawVignette, fxIsDefault, processVideo, canProcessVideo, canFilterVideo } from '../lib/videoProcess.js'

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

const SLIDERS = [
  ['brightness', 'Brillo', 40, 180], ['contrast', 'Contraste', 40, 180], ['saturate', 'Saturación', 0, 200],
  ['hue', 'Tono', -180, 180], ['sepia', 'Sepia', 0, 100], ['gray', 'Blanco y negro', 0, 100], ['blur', 'Desenfoque', 0, 10], ['sharp', 'Nitidez', 0, 100], ['vignette', 'Viñeta', 0, 100],
]
const r1 = (n) => Math.round(n * 10) / 10

export default function VideoEditor({ file, video, setVideo, setFile, platforms, notify }) {
  useLang()
  const ref = useRef(null)
  const origRef = useRef(null) // archivo original, para poder deshacer lo aplicado
  const wantCover = useRef(true)
  const ctl = useRef({ cancel: false })
  const [url, setUrl] = useState(null)
  const [time, setTime] = useState(video?.coverTime || 0)
  const [trim, setTrim] = useState({ start: 0, end: video?.duration || 0 })
  const [fx, setFx] = useState(FX0)
  const [mute, setMute] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [moreFx, setMoreFx] = useState(false)
  const [loop, setLoop] = useState(true) // repite el tramo para ver los cambios mientras se edita
  const [cur, setCur] = useState(0)
  const [prog, setProg] = useState(null) // null = sin procesar; 0..1 = procesando

  const dur = video?.duration || 0
  const trimmed = dur > 0 && (trim.start > 0.05 || trim.end < dur - 0.05)
  const filtered = !fxIsDefault(fx)
  const dirty = trimmed || filtered || mute
  const canEdit = canProcessVideo()
  const busy = prog !== null

  useEffect(() => {
    if (!file) { setUrl(null); return }
    const u = URL.createObjectURL(file)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [file])

  // Avisa al compositor de que hay cambios sin aplicar (para no publicar el video sin editar)
  useEffect(() => {
    setVideo((old) => (old && !!old.pending !== dirty ? { ...old, pending: dirty } : old))
  }, [dirty]) // eslint-disable-line

  const captureCover = (at) => {
    const v = ref.current
    if (!v || !v.videoWidth) return null
    const s = Math.min(1, 1080 / Math.max(v.videoWidth, v.videoHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s)
    const ctx = c.getContext('2d')
    if (canFilterVideo()) ctx.filter = fxCss(fx)
    ctx.drawImage(v, 0, 0, c.width, c.height)
    drawVignette(ctx, c.width, c.height, fx.vignette)
    return { cover: c.toDataURL('image/jpeg', 0.8), coverTime: at }
  }

  const onPick = (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('video/')) return notify(t('Selecciona un archivo de video (MP4, MOV, WebM).'), 'err')
    if (f.size > MAX_VIDEO_MB * 1048576) return notify(t('El video supera {n} MB.', { n: MAX_VIDEO_MB }), 'err')
    origRef.current = null
    wantCover.current = true
    setFx(FX0); setMute(false)
    setFile(f)
    setVideo({ name: f.name, size: f.size, duration: 0, width: 0, height: 0, cover: null, coverTime: 0 })
    setTime(0); setTrim({ start: 0, end: 0 })
  }

  const onMeta = () => {
    const v = ref.current
    let d = v.duration
    if (!isFinite(d)) d = video?.duration || 0 // WebM regrabado: la duración ya la conocemos
    setVideo((old) => ({ ...old, duration: d, width: v.videoWidth, height: v.videoHeight }))
    setTrim({ start: 0, end: d })
    setTime(0); setCur(0)
    wantCover.current = true
    v.currentTime = Math.min(0.1, d / 2)
  }
  // Solo recapturamos la portada cuando se pidió (no al arrastrar el recorte)
  const onSeeked = () => {
    if (!wantCover.current) return
    wantCover.current = false
    const c = captureCover(ref.current.currentTime)
    if (c) setVideo((old) => ({ ...old, ...c }))
  }
  const seekCover = (val) => {
    setTime(val)
    wantCover.current = true
    if (ref.current) ref.current.currentTime = val
  }

  /* ---- Reproducción acotada al tramo elegido ---- */
  const onTime = () => {
    const v = ref.current
    if (!v) return
    setCur(v.currentTime)
    if (!v.paused && trim.end > 0 && v.currentTime >= trim.end) {
      v.currentTime = trim.start
      if (!loop) v.pause()
    }
  }
  const onEnded = () => { // el tramo llega al final del archivo
    const v = ref.current
    if (!v) return
    v.currentTime = trim.start
    if (loop) v.play().catch(() => {})
  }
  const toggle = () => {
    const v = ref.current
    if (!v || busy) return
    if (v.paused) {
      if (v.currentTime < trim.start || v.currentTime >= trim.end - 0.05) v.currentTime = trim.start
      v.play().catch(() => {})
    } else v.pause()
  }
  const scrub = (val) => { if (ref.current) { ref.current.currentTime = val; setCur(val) } }
  const setStart = (val) => { const s = Math.max(0, Math.min(val, trim.end - 0.5)); setTrim({ ...trim, start: s }); scrub(s) }
  const setEnd = (val) => { const e = Math.min(dur, Math.max(val, trim.start + 0.5)); setTrim({ ...trim, end: e }); scrub(e) }

  const apply = async () => {
    if (!file || busy) return
    ref.current?.pause()
    ctl.current = { cancel: false }
    setProg(0)
    try {
      const src = origRef.current || file
      const { blob, duration } = await processVideo(file, { start: trim.start, end: trim.end, fx, mute, onProgress: setProg, ctl: ctl.current })
      origRef.current = src
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const out = new File([blob], video.name.replace(/\.[^.]+$/, '').replace(/-editado$/, '') + '-editado.' + ext, { type: blob.type })
      wantCover.current = true
      setFx(FX0); setMute(false)
      setVideo((old) => ({ ...old, name: out.name, size: out.size, duration, pending: false, edited: true }))
      setFile(out)
      if (ext === 'webm') notify(t('Tu navegador generó WebM. Instagram y Facebook prefieren MP4: usa Chrome o Edge actualizados.'), 'err')
      else notify(t('Cambios aplicados al video.'), 'ok')
    } catch (e) {
      if (e.message !== 'cancel') notify(e.message || t('No se pudo procesar el video.'), 'err')
    } finally { setProg(null) }
  }
  const restore = () => {
    const f = origRef.current
    if (!f) return
    origRef.current = null
    wantCover.current = true
    setFx(FX0); setMute(false)
    setVideo((old) => ({ ...old, name: f.name, size: f.size, edited: false }))
    setFile(f)
  }
  const remove = () => { origRef.current = null; setFile(null); setVideo(null) }
  const warns = videoWarnings(video, platforms)

  return (
    <div className="editor">
      <div className="stage">
        <div className="canvas-wrap video-wrap" style={{ aspectRatio: video?.width ? `${video.width}/${video.height}` : '9/16' }}>
          {url
            ? <video ref={ref} src={url} playsInline preload="metadata" style={{ filter: fxCss(fx) }} onClick={toggle}
                onLoadedMetadata={onMeta} onSeeked={onSeeked} onTimeUpdate={onTime} onEnded={onEnded} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
            : <label className="video-empty" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), e.currentTarget.querySelector('input').click())}>
                <Icon name="up" size={28} /><span>{t('Aún no has subido ningún video')}</span><small>{t('Toca aquí para subir un video')}</small>
                <input type="file" accept="video/*" hidden onChange={onPick} />
              </label>}
          {url && fx.vignette > 0 && <div className="vvig" style={{ background: vignetteCss(fx.vignette) }} />}
          {busy && (
            <div className="vproc">
              <b>{t('Procesando…')} {Math.round(prog * 100)}%</b>
              <div className="vbar"><i style={{ width: prog * 100 + '%' }} /></div>
              <small>{t('Mantén esta pestaña visible hasta que termine.')}</small>
              <button className="btn ghost sm" onClick={() => { ctl.current.cancel = true }}>{t('Cancelar')}</button>
            </div>
          )}
        </div>
        {dur > 0 && (
          <div className="vplayer">
            <button className="btn ghost sm" onClick={toggle} disabled={busy} aria-label={playing ? t('Pausar') : t('Reproducir')}>{playing ? '⏸' : '▶'}</button>
            <button className={'btn ghost sm vloop' + (loop ? ' on' : '')} onClick={() => setLoop(!loop)} aria-pressed={loop} title={t('Repetir en bucle')} aria-label={t('Repetir en bucle')}>🔁</button>
            <input type="range" min="0" max={dur} step="0.05" value={cur} onChange={(e) => scrub(+e.target.value)} disabled={busy} aria-label={t('Posición')} />
            <span className="muted small">{fmtTime(cur)} / {fmtTime(dur)}</span>
          </div>
        )}
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
            <label className="btn ghost sm file"><Icon name="up" size={15} /> {file ? t('Cambiar video') : t('Subir video')}<input type="file" accept="video/*" hidden onChange={onPick} disabled={busy} /></label>
            {file && <button className="btn danger sm" onClick={remove} disabled={busy}><Icon name="trash" size={14} /> {t('Quitar video')}</button>}
          </div>
          <p className="muted small">{t('Formatos: MP4, MOV o WebM. Máximo {n} MB. Recomendado: vertical 9:16 para Reels, TikTok e Historias.', { n: MAX_VIDEO_MB })}</p>
          {video && <p className="muted small">📎 {video.name}</p>}
        </section>

        {dur > 0 && (
          <>
            <section>
              <h4>✂️ {t('Recortar')}</h4>
              {!canEdit && <p className="warn">⚠️ {t('Este navegador no puede editar videos. Prueba con Chrome o Edge.')}</p>}
              <div className="vtrim" aria-hidden="true">
                <i style={{ left: (trim.start / dur) * 100 + '%', width: ((trim.end - trim.start) / dur) * 100 + '%' }} />
                <u style={{ left: (cur / dur) * 100 + '%' }} />
              </div>
              <label className="inl">{t('Inicio')} {fmtTime(trim.start)}
                <input type="range" min="0" max={dur} step="0.1" value={trim.start} disabled={busy} onChange={(e) => setStart(+e.target.value)} />
              </label>
              <label className="inl">{t('Fin')} {fmtTime(trim.end)}
                <input type="range" min="0" max={dur} step="0.1" value={trim.end} disabled={busy} onChange={(e) => setEnd(+e.target.value)} />
              </label>
              <div className="row">
                <button className="btn ghost sm" disabled={busy} onClick={() => setStart(r1(cur))}>{t('Inicio aquí')}</button>
                <button className="btn ghost sm" disabled={busy} onClick={() => setEnd(r1(cur))}>{t('Fin aquí')}</button>
                {trimmed && <button className="btn ghost sm" disabled={busy} onClick={() => setTrim({ start: 0, end: dur })}>{t('Restablecer')}</button>}
              </div>
              <p className="muted small">{t('Duración resultante')}: <b>{fmtTime(trim.end - trim.start)}</b></p>
            </section>

            <section>
              <div className="row between">
                <h4>🎨 {t('Filtros')}</h4>
                <button className="btn ghost sm" disabled={busy || (filtered === false && !mute)} onClick={() => { setFx(FX0); setMute(false) }}>{t('Restablecer')}</button>
              </div>
              {!canFilterVideo() && <p className="warn">⚠️ {t('Tu navegador no aplica filtros al exportar; el recorte sí funciona.')}</p>}
              <div className={'chips presets' + (moreFx ? '' : ' one')}>
                {PRESETS.map(([name, p]) => (
                  <button key={name} className={'chip' + (fxSame({ ...FX0, ...p }, fx) ? ' on' : '')} disabled={busy} onClick={() => setFx({ ...FX0, ...p })}>{t(name)}</button>
                ))}
              </div>
              <button className="btn ghost sm" onClick={() => setMoreFx(!moreFx)} aria-expanded={moreFx}>{moreFx ? t('Ver menos') : t('Ver más')}</button>
              {SLIDERS.map(([k, label, min, max]) => (
                <label className="inl" key={k}>{t(label)} <span className="muted">{fx[k]}</span>
                  <input type="range" min={min} max={max} step="1" value={fx[k]} disabled={busy} onChange={(e) => setFx({ ...fx, [k]: +e.target.value })} />
                </label>
              ))}
              <label className="inl chk"><input type="checkbox" checked={mute} disabled={busy} onChange={(e) => setMute(e.target.checked)} /> {t('Quitar el audio')}</label>
            </section>

            <section>
              <h4>{t('Aplicar cambios')}</h4>
              <p className="muted small">{t('Se genera un video MP4 nuevo con el recorte y los filtros. Suele tardar menos que la duración del tramo.')}</p>
              {dirty && !busy && <p className="warn">⚠️ {t('Tienes cambios sin aplicar: pulsa “Aplicar” antes de publicar.')}</p>}
              <div className="row">
                <button className="btn primary sm" disabled={!dirty || busy || !canEdit} onClick={apply}>{busy ? t('Procesando…') : t('Aplicar')}</button>
                {origRef.current && <button className="btn ghost sm" disabled={busy} onClick={restore}>{t('Volver al original')}</button>}
              </div>
            </section>

            <section>
              <h4>{t('Portada')}</h4>
              <p className="muted small">{t('Elige el fotograma que se usará como portada del video.')}</p>
              <label className="inl">{t('Fotograma')} {fmtTime(time)}
                <input type="range" min="0" max={dur} step="0.1" value={time} disabled={busy} onChange={(e) => seekCover(+e.target.value)} />
              </label>
              {video.cover && <img className="cover-prev" src={video.cover} alt="" />}
            </section>
          </>
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
