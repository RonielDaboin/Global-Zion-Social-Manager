import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../lib/i18n.jsx'
import { getFormat } from '../lib/formats.js'
import { renderToDataURL } from '../lib/render.js'
import { useCineTheme, CineThemeSwitch } from './ui.jsx'
import { MOTION_GROUPS, audioDuration, canMakeMusicVideo, drawBars, runMusicVideo } from '../lib/musicVideo.js'

const even = (n) => Math.max(2, Math.round(n / 2) * 2)
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** Convierte la imagen diseñada en un video con música y movimiento. Entrega el resultado a `onCreated(file, meta)`. */
export default function MusicStudio({ design, allowed, onLocked, onCreated, notify, maxMB }) {
  const [audio, setAudio] = useState(null)
  const [aDur, setADur] = useState(0)
  const [motion, setMotion] = useState('zoomin')
  const [bars, setBars] = useState(true)
  const [barsH, setBarsH] = useState(10) // alto máximo de las barras, % del alto del video
  const [barsPos, setBarsPos] = useState('bottom')
  const [barsColor, setBarsColor] = useState('#ffffff')
  const [start, setStart] = useState(0)
  const [dur, setDur] = useState(15)
  const [vol, setVol] = useState(1)
  const [mode, setMode] = useState(null) // null | 'preview' | 'render'
  const [prog, setProg] = useState(0)
  const ctl = useRef({ cancel: false })
  const live = useRef({})
  const cv = useRef(null)
  const supported = canMakeMusicVideo()
  const busy = !!mode
  const lock = mode === 'render' // en la vista previa se puede cambiar animación, barras y volumen en vivo

  const { w: fw, h: fh } = getFormat(design.format)
  const size = (max) => { const k = Math.min(1, max / Math.max(fw, fh)); return { w: even(fw * k), h: even(fh * k) } }

  useEffect(() => () => { ctl.current.cancel = true }, [])

  // ---- Modo cine: el estudio se MUEVE al <body> (sin remontar, así la vista previa en marcha no se corta) ----
  const [cine, setCine] = useState(false)
  const [cineLight, toggleCineTheme] = useCineTheme()
  const host = useMemo(() => { const d = document.createElement('div'); d.style.display = 'contents'; return d }, [])
  const slot = useRef(null)
  useLayoutEffect(() => {
    const target = cine ? document.body : slot.current
    if (target && host.parentNode !== target) target.appendChild(host)
  }, [cine, host])
  useEffect(() => () => host.remove(), [host])
  useEffect(() => {
    if (!cine) return
    const k = (e) => { if (e.key === 'Escape' && !['TEXTAREA', 'INPUT', 'SELECT'].includes(document.activeElement?.tagName)) setCine(false) }
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [cine])

  // ---- Imagen en vivo: cualquier cambio del diseño de arriba se refleja aquí (también durante la vista previa) ----
  const liveImg = useRef(null)
  const [imgTick, setImgTick] = useState(0)
  const fmtId = design.format
  useEffect(() => {
    let off = false
    const h = setTimeout(() => {
      renderToDataURL(design, 'image/jpeg', 0.85, 720).then((src) => {
        if (off) return
        const im = new Image()
        im.onload = () => { if (off) return; liveImg.current = im; live.current.img = im; setImgTick((n) => n + 1) }
        im.src = src
      }).catch(() => {})
    }, 160)
    return () => { off = true; clearTimeout(h) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [design])
  // Si cambia el formato (proporciones) con la vista previa en marcha, se detiene para no deformar el cuadro
  useEffect(() => { if (mode === 'preview') ctl.current.cancel = true }, [fmtId]) // eslint-disable-line
  // Con la animación detenida se dibuja la imagen actual con las barras de ejemplo
  useEffect(() => {
    const c = cv.current, im = liveImg.current
    if (busy || !c || !im) return
    const { w, h } = size(cine ? 900 : 540)
    c.width = w; c.height = h
    const k = Math.max(w / im.width, h / im.height)
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h)
    ctx.drawImage(im, (w - im.width * k) / 2, (h - im.height * k) / 2, im.width * k, im.height * k)
    if (bars) drawBars(ctx, w, h, Array.from({ length: 32 }, (_, i) => 0.35 + 0.65 * Math.abs(Math.sin(i * 0.7))), { heightPct: barsH / 100, pos: barsPos, color: barsColor })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgTick, busy, bars, barsH, barsPos, barsColor, cine, fw, fh])

  const pick = async (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('audio/') && !/\.(mp3|m4a|aac|wav|ogg|opus|flac)$/i.test(f.name)) return notify(t('Selecciona un archivo de audio (MP3, M4A, WAV, OGG).'), 'err')
    try {
      const d = await audioDuration(f)
      setAudio(f); setADur(d); setStart(0); setDur(Math.max(3, Math.min(15, Math.floor(d || 15))))
    } catch (ex) { notify(ex.message, 'err') }
  }

  const maxDur = Math.max(3, Math.min(60, Math.floor((aDur || 60) - start)))
  const d = Math.min(dur, maxDur)

  live.current = { motion, bars, barsH: barsH / 100, barsPos, barsColor, volume: vol, img: liveImg.current } // se lee en cada fotograma
  const opts = () => ({ audioFile: audio, motion, bars, barsH: barsH / 100, barsPos, barsColor, start, duration: d, volume: vol })

  const preview = async () => {
    if (!allowed) return onLocked()
    if (busy) { ctl.current.cancel = true; return }
    ctl.current = { cancel: false }
    setMode('preview'); setProg(0)
    try {
      const { w, h } = size(cine ? 900 : 540)
      cv.current.width = w; cv.current.height = h
      await runMusicVideo({ ...opts(), imageSrc: liveImg.current?.src || await renderToDataURL(design, 'image/jpeg', 0.85, 720), canvas: cv.current, live, onProgress: setProg, ctl: ctl.current })
    } catch (ex) { if (ex.message !== 'cancel') notify(ex.message, 'err') }
    setMode(null); setProg(0)
  }

  const create = async () => {
    if (!allowed) return onLocked()
    if (busy) { ctl.current.cancel = true; return }
    ctl.current = { cancel: false }
    setMode('render'); setProg(0)
    try {
      const { w, h } = size(1080)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const imageSrc = await renderToDataURL(design, 'image/jpeg', 0.92, 1080)
      const r = await runMusicVideo({ ...opts(), imageSrc, canvas: c, record: true, onProgress: setProg, ctl: ctl.current })
      if (r.blob.size > maxMB * 1048576) throw new Error(t('El video supera {n} MB (límite de tu plan).', { n: maxMB }))
      const ext = r.blob.type.includes('mp4') ? 'mp4' : 'webm'
      const file = new File([r.blob], `imagen-musica.${ext}`, { type: r.blob.type })
      onCreated(file, { name: file.name, size: file.size, duration: r.duration, width: w, height: h, cover: await renderToDataURL(design, 'image/jpeg', 0.8, 1080), coverTime: 0 })
    } catch (ex) { if (ex.message !== 'cancel') notify(ex.message, 'err') }
    setMode(null); setProg(0)
  }

  const body = (
    <div className={cine ? 'editor cine ms-cine' + (cineLight ? ' cine-light' : '') : 'ms-wrap'}>
      {cine && <div className="cine-bar"><b>🎬 {t('Modo cine')} · {t('Animación')}</b><span className="hint">{t('Los cambios se ven en vivo · Esc para salir')}</span><CineThemeSwitch light={cineLight} onToggle={toggleCineTheme} /><button className="btn sm" onClick={() => setCine(false)}>✕ {t('Salir')}</button></div>}
      {!cine && <h3 className="sub">🎞️ {t('Animación')} <em className="ms-opt">{t('(opcional)')}</em></h3>}
      {!cine && <p className="muted small">{t('Anima tu imagen y ponle música: elige el movimiento y el visualizador de barras. Usa solo música de tu propiedad o libre de derechos.')}</p>}
      {!supported && <p className="warn">⚠️ {t('Este navegador no puede crear videos. Prueba con Chrome o Edge.')}</p>}
      <div className={cine ? 'ms-cgrid' : 'ms-grid'}>
        <div className={cine ? 'stage ms-cstage' : 'ms-stage'}>
          {!cine && <button type="button" className="btn ghost sm cine-btn ms-cinebtn" onClick={() => setCine(true)} title={t('Modo cine')} aria-label={t('Modo cine')}>🎬</button>}
          <div className={cine ? 'canvas-wrap' : 'ms-cw'} style={{ aspectRatio: `${fw} / ${fh}` }}><canvas ref={cv} /></div>
        </div>
        <div className={cine ? 'tools ms-ctrl' : 'ms-ctrl'}>
          <label className="btn ghost ms-pick">
            🎶 {audio ? t('Cambiar música') : t('Elegir música')}
            <input type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac" hidden disabled={busy} onChange={pick} />
          </label>
          {audio && <p className="ms-file">🎧 <b>{audio.name}</b> · {fmt(aDur)}</p>}
          {MOTION_GROUPS.map((g) => (
            <div key={g.label} className="ms-group">
              <small>{t(g.label)}</small>
              <div className="ms-motions">
                {g.items.map((m) => (
                  <button key={m.id} type="button" disabled={lock} className={'chip' + (motion === m.id ? ' on' : '')} onClick={() => setMotion(m.id)}>{m.ico} {t(m.label)}</button>
                ))}
              </div>
            </div>
          ))}
          <label className="ms-row">{t('Duración')}: <b>{d}s</b>
            <input type="range" min="3" max={maxDur} value={d} disabled={busy || !audio} onChange={(e) => setDur(+e.target.value)} />
          </label>
          <label className="ms-row">{t('Empezar la canción en')}: <b>{fmt(start)}</b>
            <input type="range" min="0" max={Math.max(0, Math.floor(aDur - 3))} value={start} disabled={busy || !audio} onChange={(e) => setStart(+e.target.value)} />
          </label>
          <label className="ms-row">{t('Volumen')}: <b>{Math.round(vol * 100)}%</b>
            <input type="range" min="0.1" max="1" step="0.05" value={vol} disabled={lock} onChange={(e) => setVol(+e.target.value)} />
          </label>
          <label className="check"><input type="checkbox" checked={bars} disabled={lock} onChange={(e) => setBars(e.target.checked)} /> {t('Visualizador de música (barras al ritmo)')}</label>
          {bars && (
            <div className="ms-bars">
              <label className="ms-row">{t('Altura de las barras')}: <b>{barsH}%</b>
                <input type="range" min="3" max="40" value={barsH} disabled={lock} onChange={(e) => setBarsH(+e.target.value)} />
              </label>
              <div className="ms-row2">
                <div className="ms-motions">
                  {[['bottom', 'Abajo'], ['middle', 'Centro'], ['top', 'Arriba']].map(([id, l]) => (
                    <button key={id} type="button" disabled={lock} className={'chip' + (barsPos === id ? ' on' : '')} onClick={() => setBarsPos(id)}>{t(l)}</button>
                  ))}
                </div>
                <label className="ms-color">{t('Color')} <input type="color" value={barsColor} disabled={lock} onChange={(e) => setBarsColor(e.target.value)} /></label>
              </div>
            </div>
          )}
          <div className="ms-actions">
            <button type="button" className="btn ghost" disabled={!audio || !supported || mode === 'render'} onClick={preview}>{mode === 'preview' ? '⏹ ' + t('Detener') : '▶ ' + t('Vista previa')}</button>
            <button type="button" className="btn primary" disabled={!audio || !supported || mode === 'preview'} onClick={create}>
              {mode === 'render' ? `⏳ ${Math.round(prog * 100)}% · ${t('Cancelar')}` : '🎬 ' + t('Crear video con música')}
            </button>
          </div>
          {mode === 'render' && <><div className="ms-bar"><i style={{ width: prog * 100 + '%' }} /></div><p className="muted small">{t('Se graba en tiempo real: no cambies de pestaña hasta que termine.')}</p></>}
        </div>
      </div>
    </div>
  )
  return (
    <>
      <div ref={slot} />
      {createPortal(body, host)}
    </>
  )
}
