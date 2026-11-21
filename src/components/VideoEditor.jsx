import { useEffect, useRef, useState } from 'react'
import { PLATFORMS } from '../lib/formats.js'
import { Icon } from './ui.jsx'
import FontPicker from './FontPicker.jsx'
import { t, useLang } from '../lib/i18n.jsx'
import { TEXT_PRESETS, newTextLayer, drawTextLayers, ensureTextFonts, hasText } from '../lib/videoText.js'
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
  const [texts, setTexts] = useState([]) // textos sobre el video (títulos, subtítulos…)
  const [selT, setSelT] = useState(null)
  const [fontTick, setFontTick] = useState(0)
  const ovRef = useRef(null)
  const boxes = useRef([])
  const drag = useRef(null)

  const dur = video?.duration || 0
  const trimmed = dur > 0 && (trim.start > 0.05 || trim.end < dur - 0.05)
  const filtered = !fxIsDefault(fx)
  const withText = hasText(texts)
  const dirty = trimmed || filtered || mute || withText
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
    drawTextLayers(ctx, c.width, c.height, texts, at)
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
    setFx(FX0); setMute(false); setTexts([]); setSelT(null)
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
      const { blob, duration } = await processVideo(file, { start: trim.start, end: trim.end, fx, mute, texts, onProgress: setProg, ctl: ctl.current })
      origRef.current = src
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const out = new File([blob], video.name.replace(/\.[^.]+$/, '').replace(/-editado$/, '') + '-editado.' + ext, { type: blob.type })
      wantCover.current = true
      setFx(FX0); setMute(false); setTexts([]); setSelT(null)
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
    setFx(FX0); setMute(false); setTexts([]); setSelT(null)
    setVideo((old) => ({ ...old, name: f.name, size: f.size, edited: false }))
    setFile(f)
  }
  const remove = () => { origRef.current = null; setFile(null); setVideo(null) }
  const warns = videoWarnings(video, platforms)

  /* ---- Textos sobre el video ---- */
  const fontKey = texts.map((l) => l.font + l.weight).join()
  useEffect(() => { ensureTextFonts(texts).then(() => setFontTick((n) => n + 1)) }, [fontKey]) // eslint-disable-line
  const drawOverlay = () => {
    const c = ovRef.current, v = ref.current
    if (!c || !v) return
    const r = c.getBoundingClientRect()
    const k = Math.min(2, window.devicePixelRatio || 1)
    const W = Math.max(2, Math.round(r.width * k)), H = Math.max(2, Math.round(r.height * k))
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H }
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, W, H)
    boxes.current = drawTextLayers(ctx, W, H, texts, v.currentTime, busy ? null : selT)
  }
  useEffect(() => { drawOverlay() }, [texts, selT, cur, url, fontTick, dur, busy]) // eslint-disable-line
  useEffect(() => { // mientras se reproduce se redibuja en cada fotograma (desvanecidos suaves)
    if (!playing) return
    let id
    const loop = () => { drawOverlay(); id = requestAnimationFrame(loop) }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [playing, texts, selT]) // eslint-disable-line
  useEffect(() => {
    const el = ovRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(drawOverlay)
    ro.observe(el)
    return () => ro.disconnect()
  }) // eslint-disable-line

  const tl = texts.find((l) => l.id === selT)
  const patchT = (p) => setTexts((a) => a.map((l) => (l.id === selT ? { ...l, ...p } : l)))
  const addText = (preset) => {
    const from = r1(Math.max(trim.start, Math.min(cur, trim.end - 0.5)))
    const to = from + 4 < trim.end - 0.05 ? r1(from + 4) : 0
    const l = newTextLayer({ ...(preset ? preset[1] : {}), from, to })
    setTexts((a) => [...a, l]); setSelT(l.id)
  }
  const dupText = () => { if (!tl) return; const l = { ...tl, id: newTextLayer().id, x: Math.min(0.95, tl.x + 0.04), y: Math.min(0.95, tl.y + 0.04) }; setTexts((a) => [...a, l]); setSelT(l.id) }
  const delText = () => { setTexts((a) => a.filter((l) => l.id !== selT)); setSelT(null) }
  const ovPos = (e) => {
    const c = ovRef.current, r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height, W: c.width, H: c.height }
  }
  const ovDown = (e) => {
    if (busy) return
    const p = ovPos(e)
    const hit = [...boxes.current].reverse().find((b) => p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h)
    if (!hit) { setSelT(null); toggle(); return }
    setSelT(hit.id)
    drag.current = { id: hit.id, ox: p.x - (hit.x + hit.w / 2), oy: p.y - (hit.y + hit.h / 2) }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const ovMove = (e) => {
    const d = drag.current
    if (!d) return
    const p = ovPos(e)
    const x = Math.min(1, Math.max(0, (p.x - d.ox) / p.W)), y = Math.min(1, Math.max(0, (p.y - d.oy) / p.H))
    setTexts((a) => a.map((l) => (l.id === d.id ? { ...l, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 } : l)))
  }
  const ovUp = () => { drag.current = null }

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
          {url && <canvas ref={ovRef} className="vtext-ov" aria-label={t('Textos sobre el video')} onPointerDown={ovDown} onPointerMove={ovMove} onPointerUp={ovUp} onPointerCancel={ovUp} />}
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

            <section className="vtext-sec">
              <h4>📝 {t('Textos')}</h4>
              <p className="muted small">{t('Agrega títulos, subtítulos y más sobre el video. Arrástralos sobre la imagen para moverlos y elige en qué momento aparecen.')}</p>
              <div className="chips">
                {TEXT_PRESETS.map((p) => <button key={p[0]} className="chip" disabled={busy} onClick={() => addText(p)}>+ {t(p[0])}</button>)}
              </div>
              {texts.length > 0 && (
                <div className="chips">
                  {texts.map((l, i) => (
                    <button key={l.id} className={'chip' + (l.id === selT ? ' on' : '')} disabled={busy} onClick={() => setSelT(l.id)}>
                      {i + 1}. {l.text.replace(/\n/g, ' ').slice(0, 14) || t('(vacío)')}
                    </button>
                  ))}
                </div>
              )}
              {tl && (
                <div className="layer-ed">
                  <textarea rows={2} value={tl.text} disabled={busy} onChange={(e) => patchT({ text: e.target.value })} />
                  <div className="row fonts">
                    <FontPicker value={tl.font} onChange={(font) => patchT({ font })} />
                    <select value={tl.weight} onChange={(e) => patchT({ weight: +e.target.value })}>
                      <option value={400}>{t('Normal')}</option><option value={600}>{t('Seminegrita')}</option><option value={800}>{t('Negrita')}</option><option value={900}>{t('Extra')}</option>
                    </select>
                    <input type="color" value={tl.color} onChange={(e) => patchT({ color: e.target.value })} aria-label={t('Color')} />
                  </div>
                  <label className="inl"><span className="lbl">{t('Tamaño')} <b>{tl.size}</b></span><input type="range" min="2" max="20" step="0.5" value={tl.size} onChange={(e) => patchT({ size: +e.target.value })} /></label>
                  <div className="row">
                    <label className="inl grow">X<input type="range" min="0" max="1" step="0.01" value={tl.x} onChange={(e) => patchT({ x: +e.target.value })} /></label>
                    <label className="inl grow">Y<input type="range" min="0" max="1" step="0.01" value={tl.y} onChange={(e) => patchT({ y: +e.target.value })} /></label>
                  </div>
                  <label className="inl">{t('Aparece en')} {fmtTime(tl.from)}
                    <input type="range" min="0" max={dur} step="0.1" value={tl.from} onChange={(e) => { const f = +e.target.value; patchT({ from: f, to: tl.to > 0 && tl.to < f + 0.3 ? 0 : tl.to }); scrub(f) }} />
                  </label>
                  <label className="inl">{t('Desaparece en')} {tl.to > 0 ? fmtTime(tl.to) : t('el final')}
                    <input type="range" min="0" max={dur} step="0.1" value={tl.to > 0 ? tl.to : dur} onChange={(e) => { const v = Math.max(+e.target.value, tl.from + 0.3); patchT({ to: v >= dur - 0.05 ? 0 : r1(v) }); scrub(Math.min(v, dur)) }} />
                  </label>
                  <div className="row">
                    <button className="btn ghost sm" onClick={() => patchT({ from: r1(cur), to: tl.to > 0 && tl.to < cur + 0.3 ? 0 : tl.to })}>{t('Aparece aquí')}</button>
                    <button className="btn ghost sm" onClick={() => patchT({ to: cur > tl.from + 0.3 ? r1(cur) : tl.to })}>{t('Desaparece aquí')}</button>
                  </div>
                  <div className="row">
                    <div className="seg">
                      {['left', 'center', 'right'].map((a) => <button key={a} className={tl.align === a ? 'on' : ''} onClick={() => patchT({ align: a })}>{{ left: '⇤', center: '↔', right: '⇥' }[a]}</button>)}
                    </div>
                    <label className="check"><input type="checkbox" checked={tl.shadow} onChange={(e) => patchT({ shadow: e.target.checked })} /> {t('Sombra')}</label>
                    <label className="check"><input type="checkbox" checked={tl.stroke} onChange={(e) => patchT({ stroke: e.target.checked })} /> {t('Contorno')}</label>
                    <label className="check"><input type="checkbox" checked={tl.upper} onChange={(e) => patchT({ upper: e.target.checked })} /> {t('MAYÚS')}</label>
                    <label className="check"><input type="checkbox" checked={tl.fade} onChange={(e) => patchT({ fade: e.target.checked })} /> {t('Desvanecer')}</label>
                  </div>
                  <div className="row">
                    <label className="check"><input type="checkbox" checked={!!tl.bg} onChange={(e) => patchT({ bg: e.target.checked ? (tl.bg || '#000000') : '' })} /> {t('Fondo del texto')}</label>
                    {tl.bg && <input type="color" value={tl.bg} onChange={(e) => patchT({ bg: e.target.value })} aria-label={t('Color de fondo')} />}
                  </div>
                  {tl.bg && <label className="inl"><span className="lbl">{t('Opacidad del fondo')} <b>{Math.round(tl.bgOpacity * 100)}%</b></span><input type="range" min="10" max="100" value={Math.round(tl.bgOpacity * 100)} onChange={(e) => patchT({ bgOpacity: +e.target.value / 100 })} /></label>}
                  <div className="row">
                    <button className="btn ghost sm" onClick={dupText}>{t('Duplicar')}</button>
                    <button className="btn danger sm" onClick={delText}><Icon name="trash" size={14} /> {t('Quitar texto')}</button>
                  </div>
                </div>
              )}
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
              <p className="muted small">{t('Se genera un video MP4 nuevo con el recorte, los filtros y los textos. Suele tardar menos que la duración del tramo.')}</p>
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
