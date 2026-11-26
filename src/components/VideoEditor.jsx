import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { PLATFORMS } from '../lib/formats.js'
import { Icon, PlatformLogo, useCineTheme, CineThemeSwitch } from './ui.jsx'
import FontPicker from './FontPicker.jsx'
import { t, useLang } from '../lib/i18n.jsx'
import { TEXT_PRESETS, newTextLayer, drawTextLayers, ensureTextFonts, hasText } from '../lib/videoText.js'
import { FRAME0, VFORMATS, vFormat, frameIsDefault, frameRect, targetSize, FX0, PRESETS, fxCss, fxSame, vignetteCss, drawVignette, fxIsDefault, processVideo, canProcessVideo, canFilterVideo } from '../lib/videoProcess.js'

export const MAX_VIDEO_MB = 500
// Límites orientativos por plataforma (segundos / MB)
const LIMITS = {
  instagram: { sec: 90, label: 'Reels' },
  tiktok: { sec: 600 },
  facebook: { sec: 14400 },
  twitter: { sec: 140 },
  linkedin: { sec: 600 },
  youtube: { sec: 900, label: 'Shorts hasta 3 min' },
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
const CARET_COLORS = ['#f58529', '#dd2a7b', '#8134af', '#25f4ee']
const DEFAULT_TEXTS = new Set([...TEXT_PRESETS.map((p) => p[1].text), 'Texto'])

/** Línea de tiempo de los textos: cada texto es una barra que se arrastra (mover) o se estira desde sus bordes (aparece/desaparece). */
function TextTimeline({ texts, selT, onSelect, dur, cur, onSeek, onPatch }) {
  const track = useRef(null)
  const drag = useRef(null)
  const MIN = 0.3
  const timeAt = (e) => { const r = track.current.getBoundingClientRect(); return Math.max(0, Math.min(dur, ((e.clientX - r.left) / r.width) * dur)) }
  const down = (e, l, kind) => {
    e.stopPropagation(); e.preventDefault()
    document.activeElement?.blur?.() // así Ctrl+C / Ctrl+V actúan sobre el texto de la línea de tiempo y no sobre un campo
    onSelect(l.id)
    drag.current = { id: l.id, kind, t0: timeAt(e), from0: l.from, end0: l.to > 0 ? l.to : dur }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const move = (e) => {
    const d = drag.current
    if (!d) return
    const t = timeAt(e)
    if (d.kind === 'from') {
      const f = Math.max(0, r1(Math.min(t, d.end0 - MIN)))
      onPatch(d.id, { from: f }); onSeek(f)
    } else if (d.kind === 'to') {
      const v = Math.max(t, d.from0 + MIN)
      onPatch(d.id, { to: v >= dur - 0.05 ? 0 : r1(v) }); onSeek(Math.min(v, dur))
    } else {
      const len = d.end0 - d.from0
      const f = r1(Math.max(0, Math.min(dur - len, d.from0 + (t - d.t0))))
      const to = r1(f + len)
      onPatch(d.id, { from: f, to: to >= dur - 0.05 ? 0 : to }); onSeek(f)
    }
  }
  const up = () => { drag.current = null }
  const pc = (x) => (x / dur) * 100 + '%'
  return (
    <div className="ttl">
      <div className="ttl-track" ref={track} style={{ height: Math.max(1, texts.length) * 26 + 8 }} onPointerDown={(e) => onSeek(timeAt(e))}>
        {texts.map((l, i) => {
          const end = l.to > 0 ? l.to : dur
          return (
            <div key={l.id} className={'ttl-bar' + (l.id === selT ? ' on' : '')} style={{ left: pc(l.from), width: pc(Math.max(0.2, end - l.from)), top: 4 + i * 26 }}
              onPointerDown={(e) => down(e, l, 'move')} onPointerMove={move} onPointerUp={up} onPointerCancel={up} title={l.text}>
              <i className="ttl-h l" onPointerDown={(e) => down(e, l, 'from')} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
              <span>{l.text.replace(/\n/g, ' ').slice(0, 24) || '…'}</span>
              <i className="ttl-h r" onPointerDown={(e) => down(e, l, 'to')} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
            </div>
          )
        })}
        <div className="ttl-head" style={{ left: pc(Math.min(cur, dur)) }} />
      </div>
      <div className="ttl-scale"><span>0:00</span><span>{fmtTime(dur / 2)}</span><span>{fmtTime(dur)}</span></div>
    </div>
  )
}

export default function VideoEditor({ file, video, setVideo, setFile, platforms, notify, maxMB = MAX_VIDEO_MB }) {
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
  const [mode, setMode] = useState('basic') // 'basic' | 'adv'
  const [frame, setFrame] = useState(FRAME0) // formato de salida (relación de aspecto) y encuadre
  const layerTxt = useRef(null)
  const wantFocus = useRef(null) // 'all' | 'end': al hacer clic en un texto del visor, el cursor pasa al campo de texto
  const [focusTick, setFocusTick] = useState(0)
  const [editing, setEditing] = useState(false)
  const [caretPos, setCaretPos] = useState(0)
  const [blink, setBlink] = useState({ on: true, n: 0 }) // cursor parpadeante con los colores del logo
  useEffect(() => {
    if (!editing) return
    setBlink({ on: true, n: 0 })
    const id = setInterval(() => setBlink((b) => ({ on: !b.on, n: b.on ? b.n : b.n + 1 })), 480)
    return () => clearInterval(id)
  }, [editing])
  useEffect(() => {
    if (!wantFocus.current) return
    const el = layerTxt.current
    if (!el) return
    const how = wantFocus.current
    wantFocus.current = null
    el.focus({ preventScroll: true })
    if (how === 'all') el.select(); else el.setSelectionRange(el.value.length, el.value.length)
    setCaretPos(el.selectionStart)
  }, [focusTick])
  const guide = useRef(null) // {x,y}: arrastrando un texto (y si está centrado en cada eje)
  const [cine, setCine] = useState(false) // modo cine: vista grande en vivo con el panel al lado
  const [cineLight, toggleCineTheme] = useCineTheme()
  // El editor vive en un contenedor que se MUEVE al <body> en modo cine (sin remontar: el video, el recorte y los textos se conservan)
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
  const reframed = !frameIsDefault(frame)
  const dirty = trimmed || filtered || mute || withText || reframed
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
    const { w: tw, h: th } = targetSize(frame, v.videoWidth, v.videoHeight)
    const s = Math.min(1, 1080 / Math.max(tw, th))
    const c = document.createElement('canvas')
    c.width = Math.round(tw * s); c.height = Math.round(th * s)
    const ctx = c.getContext('2d')
    if (reframed && frame.fit === 'contain') { ctx.fillStyle = frame.bg; ctx.fillRect(0, 0, c.width, c.height) }
    if (canFilterVideo()) ctx.filter = fxCss(fx)
    const R = frameRect(v.videoWidth, v.videoHeight, c.width, c.height, frame)
    ctx.drawImage(v, R.dx, R.dy, R.dw, R.dh)
    drawVignette(ctx, c.width, c.height, fx.vignette)
    drawTextLayers(ctx, c.width, c.height, texts, at)
    return { cover: c.toDataURL('image/jpeg', 0.8), coverTime: at }
  }

  const onPick = (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('video/')) return notify(t('Selecciona un archivo de video (MP4, MOV, WebM).'), 'err')
    if (f.size > maxMB * 1048576) return notify(t('El video supera {n} MB (límite de tu plan).', { n: maxMB }), 'err')
    origRef.current = null
    wantCover.current = true
    setFx(FX0); setMute(false); setTexts([]); setSelT(null); setFrame(FRAME0)
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
    // Un video que viene de Contenido pide su portada en un segundo concreto (solo la primera vez que se carga)
    const first = video?.autoCover ? Math.min(video.autoCover, Math.max(0, d - 0.1)) : Math.min(0.1, d / 2)
    if (video?.autoCover) { setTime(first); setCur(first); setVideo((old) => ({ ...old, autoCover: 0 })) }
    v.currentTime = first
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
      const { blob, duration } = await processVideo(file, { start: trim.start, end: trim.end, fx, mute, texts, frame, onProgress: setProg, ctl: ctl.current })
      origRef.current = src
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const out = new File([blob], video.name.replace(/\.[^.]+$/, '').replace(/-editado$/, '') + '-editado.' + ext, { type: blob.type })
      wantCover.current = true
      setFx(FX0); setMute(false); setTexts([]); setSelT(null); setFrame(FRAME0)
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
    setFx(FX0); setMute(false); setTexts([]); setSelT(null); setFrame(FRAME0)
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
    boxes.current = drawTextLayers(ctx, W, H, texts, v.currentTime, busy ? null : selT, !playing && !busy, mode === 'adv' && !busy && !playing,
      editing && blink.on && !playing && !busy && selT ? { id: selT, pos: caretPos, color: CARET_COLORS[blink.n % CARET_COLORS.length] } : null)
    const g = guide.current
    if (g) {
      // Mientras se arrastra un texto: la mitad del ancho y del alto siempre visibles; en rosa al quedar centrado
      const u = Math.max(1, W / 540)
      ctx.save()
      ctx.setLineDash([10 * u, 8 * u]); ctx.lineWidth = 1.6 * u; ctx.strokeStyle = 'rgba(255,255,255,.8)'
      ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 3 * u
      ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke()
      ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.lineWidth = 3 * u; ctx.strokeStyle = '#ff3d8b'
      if (g.x) { ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H); ctx.stroke() }
      if (g.y) { ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke() }
      ctx.restore()
    }
  }
  useEffect(() => { drawOverlay() }, [texts, selT, cur, url, fontTick, dur, busy, playing, mode, editing, blink, caretPos]) // eslint-disable-line
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
    // Básico: el texto dura todo el video. Avanzado: arranca donde está el video y dura 4 s (se ajusta en la línea de tiempo)
    const from = mode === 'adv' ? r1(Math.max(trim.start, Math.min(cur, trim.end - 0.5))) : 0
    const to = mode === 'adv' ? (from + 4 < trim.end - 0.05 ? r1(from + 4) : 0) : 0
    const l = newTextLayer({ ...(preset ? preset[1] : {}), from, to })
    setTexts((a) => [...a, l]); setSelT(l.id)
  }
  const dupText = () => { if (!tl) return; const l = { ...tl, id: newTextLayer().id, x: Math.min(0.95, tl.x + 0.04), y: Math.min(0.95, tl.y + 0.04) }; setTexts((a) => [...a, l]); setSelT(l.id) }
  // Copiar / pegar textos: el pegado queda en el instante actual del video (mismo estilo, posición y duración)
  const clip = useRef(null)
  const copyText = () => {
    if (!tl) return
    clip.current = { ...tl }
    notify?.(t('Texto copiado: mueve el video y pega con Ctrl+V'))
  }
  const pasteText = () => {
    const c = clip.current
    if (!c) return
    const start = r1(Math.max(0, Math.min(cur, Math.max(0, dur - 0.3))))
    const len = c.to > 0 ? c.to - c.from : 0 // 0 = el texto copiado duraba hasta el final
    const end = len ? start + len : 0
    const l = { ...c, id: newTextLayer().id, from: start, to: end && end < dur - 0.05 ? r1(end) : 0 }
    setTexts((a) => [...a, l]); setSelT(l.id)
  }
  const kb = useRef(null)
  kb.current = (e) => {
    const tag = document.activeElement?.tagName
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || document.activeElement?.isContentEditable || busy) return
    const mod = e.ctrlKey || e.metaKey
    if (mod && e.key.toLowerCase() === 'c' && tl) { e.preventDefault(); copyText() }
    else if (mod && e.key.toLowerCase() === 'v' && clip.current) { e.preventDefault(); pasteText() }
    else if (e.key === 'Delete' && tl) { e.preventDefault(); delText() }
  }
  useEffect(() => {
    const h = (e) => kb.current?.(e)
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])
  const delText = () => { setTexts((a) => a.filter((l) => l.id !== selT)); setSelT(null) }
  const ovPos = (e) => {
    const c = ovRef.current, r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height, W: c.width, H: c.height }
  }
  // Lleva un punto del lienzo al sistema de la caja (deshace el giro) para detectar toques sobre textos girados
  const toLocal = (b, p) => {
    const dx = p.x - b.cx, dy = p.y - b.cy, c = Math.cos(-b.rot), s = Math.sin(-b.rot)
    return { x: b.cx + dx * c - dy * s, y: b.cy + dx * s + dy * c }
  }
  const ovDown = (e) => {
    if (busy) return
    const p = ovPos(e)
    // 1) tiradores del texto seleccionado (solo en modo avanzado)
    const sel = boxes.current.find((b) => b.id === selT && b.rotH)
    if (sel) {
      const q = toLocal(sel, p), near = (h) => Math.hypot(q.x - h.x, q.y - h.y) <= sel.hs * 1.6
      if (near(sel.rotH)) { drag.current = { id: sel.id, mode: 'rot' }; e.currentTarget.setPointerCapture(e.pointerId); return }
      if (near(sel.sizeH)) {
        const l = texts.find((x) => x.id === sel.id)
        drag.current = { id: sel.id, mode: 'size', size0: l.size, d0: Math.max(1, Math.hypot(p.x - sel.cx, p.y - sel.cy)) }
        e.currentTarget.setPointerCapture(e.pointerId); return
      }
    }
    // 2) mover un texto
    const hit = [...boxes.current].reverse().find((b) => { const q = toLocal(b, p); return q.x >= b.x && q.x <= b.x + b.w && q.y >= b.y && q.y <= b.y + b.h })
    if (!hit) {
      setSelT(null)
      // Con un formato que recorta el video (Rellenar), arrastrar sobre el visor mueve el encuadre
      if (reframed && frame.fit !== 'contain') {
        drag.current = { mode: 'pan', sx: p.x, sy: p.y, px0: frame.px, py0: frame.py, moved: false }
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }
      toggle(); return
    }
    setSelT(hit.id)
    drag.current = { id: hit.id, mode: 'move', ox: p.x - hit.cx, oy: p.y - hit.cy, sx: p.x, sy: p.y, moved: false }
    guide.current = { x: false, y: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const ovMove = (e) => {
    const d = drag.current
    if (!d) return
    const p = ovPos(e)
    if (d.mode === 'pan') {
      const v = ref.current
      if (!v?.videoWidth) return
      if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > 4 * Math.max(1, p.W / 540)) d.moved = true
      const k = Math.max(p.W / v.videoWidth, p.H / v.videoHeight)
      const ox = v.videoWidth * k - p.W, oy = v.videoHeight * k - p.H // cuánto sobra en cada eje
      const cl = (n) => Math.min(1, Math.max(0, n))
      setFrame((f) => ({ ...f, px: ox > 1 ? Math.round(cl(d.px0 - (p.x - d.sx) / ox) * 100) / 100 : f.px, py: oy > 1 ? Math.round(cl(d.py0 - (p.y - d.sy) / oy) * 100) / 100 : f.py }))
      return
    }
    const b = boxes.current.find((x) => x.id === d.id)
    if (d.mode === 'rot' && b) {
      let deg = (Math.atan2(p.y - b.cy, p.x - b.cx) * 180) / Math.PI + 90
      deg = ((deg + 540) % 360) - 180
      const snap = Math.round(deg / 15) * 15
      if (Math.abs(deg - snap) < 4) deg = snap // imanta a 0, 15, 45, 90 grados…
      setTexts((a) => a.map((l) => (l.id === d.id ? { ...l, rot: Math.round(deg) } : l)))
      return
    }
    if (d.mode === 'size' && b) {
      const size = Math.min(30, Math.max(2, d.size0 * (Math.hypot(p.x - b.cx, p.y - b.cy) / d.d0)))
      setTexts((a) => a.map((l) => (l.id === d.id ? { ...l, size: Math.round(size * 2) / 2 } : l)))
      return
    }
    if (!d.moved && Math.hypot(p.x - d.sx, p.y - d.sy) > 5 * Math.max(1, p.W / 540)) d.moved = true
    let x = Math.min(1, Math.max(0, (p.x - d.ox) / p.W)), y = Math.min(1, Math.max(0, (p.y - d.oy) / p.H))
    const T = 0.012 // imán al centro
    const sx = Math.abs(x - 0.5) < T, sy = Math.abs(y - 0.5) < T
    if (sx) x = 0.5
    if (sy) y = 0.5
    guide.current = { x: sx, y: sy }
    setTexts((a) => a.map((l) => (l.id === d.id ? { ...l, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 } : l)))
  }
  const ovUp = () => {
    const d = drag.current
    drag.current = null; guide.current = null; drawOverlay()
    if (d && d.mode === 'pan') { if (!d.moved && !busy) toggle(); return }
    // Clic simple sobre un texto (sin arrastrar): se puede escribir de inmediato
    if (d && d.mode === 'move' && !d.moved && !busy) {
      const l = texts.find((x) => x.id === d.id)
      if (l) { wantFocus.current = DEFAULT_TEXTS.has(l.text) ? 'all' : 'end'; setFocusTick((n) => n + 1) }
    }
  }

  const body = (
    <div className={'editor' + (cine ? ' cine' : '') + (cine && cineLight ? ' cine-light' : '')}>
      {cine && <div className="cine-bar"><b>🎬 {t('Modo cine')}</b><span className="hint">{t('Los cambios se ven en vivo · Esc para salir')}</span><CineThemeSwitch light={cineLight} onToggle={toggleCineTheme} /><button className="btn sm" onClick={() => setCine(false)}>✕ {t('Salir')}</button></div>}
      <div className="stage vstage">
        <div className="canvas-wrap video-wrap" style={{ aspectRatio: reframed ? `${vFormat(frame.format).w}/${vFormat(frame.format).h}` : video?.width ? `${video.width}/${video.height}` : '9/16', background: reframed && frame.fit === 'contain' ? frame.bg : undefined }}>
          {url
            ? <video ref={ref} src={url} playsInline preload="metadata" style={{ filter: fxCss(fx), ...(reframed ? { objectFit: frame.fit === 'contain' ? 'contain' : 'cover', objectPosition: `${frame.px * 100}% ${frame.py * 100}%`, background: 'transparent' } : null) }} onClick={toggle}
                onLoadedMetadata={onMeta} onSeeked={onSeeked} onTimeUpdate={onTime} onEnded={onEnded} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
            : <label className="video-empty" tabIndex={0} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), e.currentTarget.querySelector('input').click())}>
                <Icon name="up" size={28} /><span>{t('Aún no has subido ningún video')}</span><small>{t('Toca aquí para subir un video')}</small>
                <input type="file" accept="video/*" hidden onChange={onPick} />
              </label>}
          {url && fx.vignette > 0 && <div className="vvig" style={{ background: vignetteCss(fx.vignette) }} />}
          {url && <canvas ref={ovRef} className={'vtext-ov' + (reframed && frame.fit !== 'contain' ? ' pannable' : '')} onDoubleClick={() => reframed && frame.fit !== 'contain' && setFrame((f) => ({ ...f, px: 0.5, py: 0.5 }))} aria-label={t('Textos sobre el video')} onPointerDown={ovDown} onPointerMove={ovMove} onPointerUp={ovUp} onPointerCancel={ovUp} />}
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
            <button className={'btn ghost sm cine-btn' + (cine ? ' active' : '')} onClick={() => setCine((c) => !c)} title={t('Modo cine')} aria-label={t('Modo cine')} aria-pressed={cine}>🎬</button>
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
        <div className="seg full mode-seg" data-mode={mode}>
          <button className={mode === 'basic' ? 'on' : ''} onClick={() => setMode('basic')}>{t('Básico')}</button>
          <button className={mode === 'adv' ? 'on' : ''} onClick={() => setMode('adv')}>{t('Avanzado')}</button>
        </div>
        <section>
          <h4>{t('Video')}</h4>
          <div className="row">
            <label className="btn ghost sm file"><Icon name="up" size={15} /> {file ? t('Cambiar video') : t('Subir video')}<input type="file" accept="video/*" hidden onChange={onPick} disabled={busy} /></label>
            {file && <button className="btn danger sm" onClick={remove} disabled={busy}><Icon name="trash" size={14} /> {t('Quitar video')}</button>}
          </div>
          <p className="muted small">{t('Formatos: MP4, MOV o WebM. Máximo {n} MB. Recomendado: vertical 9:16 para Reels, TikTok e Historias.', { n: maxMB })}</p>
          {video && <p className="muted small">📎 {video.name}</p>}
        </section>

        {dur > 0 && (
          <>
            <section className="vfmt-sec">
              <h4>📐 {t('Formato')}</h4>
              <div className="vf-grid" role="group" aria-label={t('Formato')}>
                {VFORMATS.map((f) => (
                  <button key={f.id} className={'vf-card' + (frame.format === f.id ? ' on' : '')} disabled={busy} aria-pressed={frame.format === f.id} onClick={() => setFrame({ ...frame, format: f.id })}>
                    <span className="vf-top">
                      <i className="vf-shape" style={f.w ? { aspectRatio: `${f.w}/${f.h}` } : undefined} />
                      <b>{f.id === 'orig' ? t(f.label) : f.label}</b>
                      {f.w ? <small>{f.w}×{f.h}</small> : <small>{t('Sin cambios')}</small>}
                    </span>
                    {f.nets.length > 0 && (
                      <span className="vf-nets">
                        {f.nets.map(([id, note]) => (
                          <span key={id} className="vf-net"><PlatformLogo id={id} size={16} />{PLATFORMS[id].name.replace(' (Twitter)', '')}{note ? <em> · {t(note)}</em> : null}</span>
                        ))}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="muted small">{reframed ? `${t(vFormat(frame.format).sub)} · ${vFormat(frame.format).w}×${vFormat(frame.format).h}px` : t(vFormat(frame.format).sub)}</p>
              {reframed && frame.fit !== 'contain' && <p className="pan-hint">✋ {t('Arrastra el video en el visor para elegir qué parte se ve. Doble clic para centrar.')}</p>}
              {reframed && <p className="muted small">{t('Se aplica al pulsar “Aplicar”: el video se recorta o se ajusta a esta forma.')}</p>}
              <div className={'collapse' + (mode === 'adv' && reframed ? ' open' : '')} aria-hidden={!(mode === 'adv' && reframed)}><div className="collapse-in">
                <div className="vfmt-adv">
                  <div className="seg" role="group">
                    <button className={frame.fit !== 'contain' ? 'on' : ''} disabled={busy} onClick={() => setFrame({ ...frame, fit: 'cover' })}>{t('Rellenar')}</button>
                    <button className={frame.fit === 'contain' ? 'on' : ''} disabled={busy} onClick={() => setFrame({ ...frame, fit: 'contain' })}>{t('Ajustar')}</button>
                  </div>
                  <p className="muted small">{frame.fit === 'contain' ? t('Se ve todo el video y los lados se rellenan con un color.') : t('El video llena todo el cuadro y se recortan los bordes.')}</p>
                  {frame.fit === 'contain'
                    ? <label className="inl sw"><span className="lbl">{t('Color de las barras')}</span><input type="color" value={frame.bg} disabled={busy} onChange={(e) => setFrame({ ...frame, bg: e.target.value })} /></label>
                    : <>
                        <label className="inl"><span className="lbl">{t('Encuadre horizontal')} <b>{Math.round(frame.px * 100)}%</b></span><input type="range" min="0" max="1" step="0.01" value={frame.px} disabled={busy} onChange={(e) => setFrame({ ...frame, px: +e.target.value })} /></label>
                        <label className="inl"><span className="lbl">{t('Encuadre vertical')} <b>{Math.round(frame.py * 100)}%</b></span><input type="range" min="0" max="1" step="0.01" value={frame.py} disabled={busy} onChange={(e) => setFrame({ ...frame, py: +e.target.value })} /></label>
                      </>}
                </div>
              </div></div>
            </section>

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
                  <textarea ref={layerTxt} rows={2} value={tl.text} disabled={busy} onChange={(e) => { patchT({ text: e.target.value }); setCaretPos(e.target.selectionStart) }}
                    onFocus={(e) => { setEditing(true); setCaretPos(e.target.selectionStart) }} onBlur={() => setEditing(false)}
                    onSelect={(e) => setCaretPos(e.target.selectionStart)} onKeyUp={(e) => setCaretPos(e.target.selectionStart)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.currentTarget.blur() } }} />
                  <div className="row">
                    <label className="inl grow"><span className="lbl">{t('Tamaño')} <b>{tl.size}</b></span><input type="range" min="2" max="30" step="0.5" value={tl.size} onChange={(e) => patchT({ size: +e.target.value })} /></label>
                    <input type="color" value={tl.color} onChange={(e) => patchT({ color: e.target.value })} aria-label={t('Color')} />
                  </div>
<div className={'collapse' + (mode === 'adv' ? ' open' : '')} aria-hidden={mode !== 'adv'}><div className="collapse-in">
                  <div className="row fonts">
                    <FontPicker value={tl.font} onChange={(font) => patchT({ font })} />
                    <select value={tl.weight} onChange={(e) => patchT({ weight: +e.target.value })}>
                      <option value={400}>{t('Normal')}</option><option value={600}>{t('Seminegrita')}</option><option value={800}>{t('Negrita')}</option><option value={900}>{t('Extra')}</option>
                    </select>
                  </div>
                  <label className="inl"><span className="lbl">{t('Rotación')} <b>{tl.rot || 0}°</b></span>
                    <input type="range" min="-180" max="180" step="1" value={tl.rot || 0} onChange={(e) => patchT({ rot: +e.target.value })} onDoubleClick={() => patchT({ rot: 0 })} title={t('Doble clic para restablecer')} />
                  </label>
                  <p className="muted small">{t('Sobre el video: ↻ gira y ⤡ cambia el tamaño del texto seleccionado.')}</p>
                  <div className="row">
                    <label className="inl grow">X<input type="range" min="0" max="1" step="0.01" value={tl.x} onChange={(e) => patchT({ x: +e.target.value })} /></label>
                    <label className="inl grow">Y<input type="range" min="0" max="1" step="0.01" value={tl.y} onChange={(e) => patchT({ y: +e.target.value })} /></label>
                  </div>
                  <div className="tm-block">
                    <h5>⏱ {t('Cuándo aparece')}</h5>
                    <TextTimeline texts={texts} selT={selT} onSelect={setSelT} dur={dur} cur={cur} onSeek={scrub} onPatch={(id, p) => setTexts((arr) => arr.map((x) => (x.id === id ? { ...x, ...p } : x)))} />
                    <p className="muted small">{t('Arrastra la barra para moverla y sus bordes para ajustar cuándo aparece y desaparece.')} {t('Ctrl+C copia el texto seleccionado y Ctrl+V lo pega donde está el video.')}</p>
                    <div className="row">
                      <label className="inl grow"><span className="lbl">{t('Aparece en')} <b>{tl.from.toFixed(1)} s</b></span>
                        <input type="number" min="0" max={Math.max(0, (tl.to > 0 ? tl.to : dur) - 0.3)} step="0.1" value={tl.from} onChange={(e) => { const f = Math.max(0, Math.min(+e.target.value || 0, (tl.to > 0 ? tl.to : dur) - 0.3)); patchT({ from: r1(f) }); scrub(f) }} />
                      </label>
                      <label className="inl grow"><span className="lbl">{t('Desaparece en')} <b>{tl.to > 0 ? tl.to.toFixed(1) + ' s' : t('el final')}</b></span>
                        <input type="number" min={r1(tl.from + 0.3)} max={dur} step="0.1" value={tl.to > 0 ? tl.to : r1(dur)} onChange={(e) => { const v = Math.max(+e.target.value || 0, tl.from + 0.3); patchT({ to: v >= dur - 0.05 ? 0 : r1(v) }); scrub(Math.min(v, dur)) }} />
                      </label>
                    </div>
                    <div className="chips">
                      <button className={'chip' + (tl.from <= 0.05 && !tl.to ? ' on' : '')} onClick={() => patchT({ from: 0, to: 0 })}>{t('Todo el video')}</button>
                      {[2, 4, 6].map((n) => <button key={n} className="chip" onClick={() => patchT({ to: tl.from + n >= dur - 0.05 ? 0 : r1(tl.from + n) })}>{n} s</button>)}
                      <button className="chip" onClick={() => patchT({ to: 0 })}>{t('Hasta el final')}</button>
                    </div>
                    <div className="row">
                      <button className="btn ghost sm" onClick={() => patchT({ from: r1(cur), to: tl.to > 0 && tl.to < cur + 0.3 ? 0 : tl.to })}>{t('Aparece aquí')}</button>
                      <button className="btn ghost sm" onClick={() => patchT({ to: cur > tl.from + 0.3 ? r1(cur) : tl.to })}>{t('Desaparece aquí')}</button>
                      <button className="btn ghost sm" onClick={copyText} title="Ctrl+C">📋 {t('Copiar')}</button>
                      <button className="btn ghost sm" disabled={!clip.current} onClick={pasteText} title="Ctrl+V">{t('Pegar aquí')}</button>
                      <button className="btn ghost sm" onClick={() => scrub(tl.from)} title={t('Ir al inicio del texto')}>⏮</button>
                      <button className="btn ghost sm" onClick={() => scrub(Math.max(0, (tl.to > 0 ? tl.to : dur) - 0.05))} title={t('Ir al final del texto')}>⏭</button>
                    </div>
                    {tl.fade && (
                      <label className="inl"><span className="lbl">{t('Duración del desvanecido')} <b>{(tl.fadeDur || 0.3).toFixed(1)} s</b></span>
                        <input type="range" min="0.1" max="2" step="0.1" value={tl.fadeDur || 0.3} onChange={(e) => patchT({ fadeDur: +e.target.value })} />
                      </label>
                    )}
                  </div>
                  </div></div>
                  {mode === 'basic' && (tl.from > 0.05 || tl.to > 0
                    ? <div className="tm-note warnish">
                        <span>⏱ {t('Este texto aparece solo de {a} a {b}.', { a: tl.from.toFixed(1) + ' s', b: tl.to > 0 ? tl.to.toFixed(1) + ' s' : t('el final') })}</span>
                        <button className="btn ghost sm" onClick={() => patchT({ from: 0, to: 0 })}>{t('Mostrar en todo el video')}</button>
                      </div>
                    : <p className="muted small">✓ {t('El texto se muestra durante todo el video. Para elegir cuándo aparece, usa el modo Avanzado.')}</p>)}
<div className={'collapse' + (mode === 'adv' ? ' open' : '')} aria-hidden={mode !== 'adv'}><div className="collapse-in">
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
                  </div></div>
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
              <div className={'collapse' + (mode === 'adv' ? ' open' : '')} aria-hidden={mode !== 'adv'}><div className="collapse-in">
              {SLIDERS.map(([k, label, min, max]) => (
                <label className="inl" key={k}><span className="lbl">{t(label)} <b>{fx[k]}</b></span>
                  <input type="range" min={min} max={max} step="1" value={fx[k]} disabled={busy} onChange={(e) => setFx({ ...fx, [k]: +e.target.value })} />
                </label>
              ))}
              </div></div>
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
  return <><div ref={slot} style={{ display: 'contents' }} />{createPortal(body, host)}</>
}
