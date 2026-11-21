import { useEffect, useRef, useState } from 'react'
import { t, useLang } from '../lib/i18n.jsx'

// Visor independiente para trabajar solo la imagen: recortar, quitar el fondo y retocar con pincel.
const MIN = 0.03
const MAX_HIST = 15
const ZMIN = 0.5, ZMAX = 4
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

const load = (src) => new Promise((res, rej) => {
  const im = new Image()
  im.onload = () => res(im)
  im.onerror = rej
  im.src = src
})
const blobToDataURL = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b) })
const isPng = (s) => s.startsWith('data:image/png')

/** Recorta un dataURL con una región en fracciones (0..1). Conserva PNG si el original lo era. */
async function cropData(src, c) {
  const im = await load(src)
  const sx = Math.round(c.x * im.naturalWidth), sy = Math.round(c.y * im.naturalHeight)
  const sw = Math.max(1, Math.round(c.w * im.naturalWidth)), sh = Math.max(1, Math.round(c.h * im.naturalHeight))
  const cv = document.createElement('canvas')
  cv.width = sw; cv.height = sh
  cv.getContext('2d').drawImage(im, sx, sy, sw, sh, 0, 0, sw, sh)
  return isPng(src) ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.92)
}

const MAX_SIDE = 4096 // límite del lado mayor al reescalar (memoria del navegador y peso del archivo)

/** Reescala ×factor en pasos de ×2 con suavizado de alta calidad y un enfoque ligero final. */
async function upscaleData(src, factor) {
  const im = await load(src)
  let cv = document.createElement('canvas')
  cv.width = im.naturalWidth; cv.height = im.naturalHeight
  cv.getContext('2d').drawImage(im, 0, 0)
  const target = [Math.round(cv.width * factor), Math.round(cv.height * factor)]
  while (cv.width < target[0]) {
    const next = document.createElement('canvas')
    next.width = Math.min(target[0], cv.width * 2); next.height = Math.min(target[1], cv.height * 2)
    const c = next.getContext('2d')
    c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high'
    c.drawImage(cv, 0, 0, next.width, next.height)
    cv = next
  }
  // Enfoque ligero (núcleo 3×3) para recuperar la nitidez que pierde la interpolación
  const ctx = cv.getContext('2d', { willReadFrequently: true })
  const W = cv.width, H = cv.height
  const src32 = ctx.getImageData(0, 0, W, H), out = ctx.createImageData(W, H)
  const a = src32.data, o = out.data, k = 0.3
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - 1), y1 = Math.min(H - 1, y + 1)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const l = (y * W + Math.max(0, x - 1)) * 4, r = (y * W + Math.min(W - 1, x + 1)) * 4
      const u = (y0 * W + x) * 4, d = (y1 * W + x) * 4
      for (let j = 0; j < 3; j++) {
        const v = a[i + j] * (1 + 4 * k) - k * (a[l + j] + a[r + j] + a[u + j] + a[d + j])
        o[i + j] = v < 0 ? 0 : v > 255 ? 255 : v
      }
      o[i + 3] = a[i + 3]
    }
  }
  ctx.putImageData(out, 0, 0)
  return isPng(src) ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.93)
}

export default function ImageWorkshop({ image, ratioHint, onApply, onClose }) {
  useLang()
  const [src, setSrc] = useState(image)
  const [origin, setOrigin] = useState(image) // píxeles originales (con el fondo): de aquí restaura el pincel
  const [hist, setHist] = useState([])
  const [nat, setNat] = useState({ w: 1, h: 1 })
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 1, h: 1 })
  const [ratio, setRatio] = useState(null) // null = libre; número = ancho/alto
  const [tool, setTool] = useState('crop') // 'crop' | 'erase' | 'restore'
  const [size, setSize] = useState(40) // diámetro del pincel en px de pantalla
  const [tol, setTol] = useState(28) // tolerancia de color de la varita (0–100)
  const [autoMode, setAutoMode] = useState('erase') // varita: 'erase' borra por color · 'restore' recupera por color
  const [contig, setContig] = useState(true) // true: solo la zona conectada; false: todos los píxeles de ese color
  const [cur, setCur] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [fitW, setFitW] = useState(0)
  const scroller = useRef(null)
  const [busy, setBusy] = useState('')
  const [pct, setPct] = useState(0)
  const [err, setErr] = useState('')
  const box = useRef(null)
  const view = useRef(null)
  const originCv = useRef(null)
  const drag = useRef(null)
  const stroke = useRef(null)
  const lastSize = useRef('')

  // Dibuja la imagen actual en el lienzo visible
  useEffect(() => {
    let on = true
    load(src).then((im) => {
      if (!on) return
      const cv = view.current
      cv.width = im.naturalWidth; cv.height = im.naturalHeight
      const ctx = cv.getContext('2d')
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.drawImage(im, 0, 0)
      setNat({ w: im.naturalWidth, h: im.naturalHeight })
      const sig = `${im.naturalWidth}x${im.naturalHeight}`
      if (sig !== lastSize.current) { lastSize.current = sig; setCrop({ x: 0, y: 0, w: 1, h: 1 }); setRatio(null) }
    })
    return () => { on = false }
  }, [src])
  useEffect(() => {
    let on = true
    load(origin).then((im) => {
      if (!on) return
      const cv = document.createElement('canvas')
      cv.width = im.naturalWidth; cv.height = im.naturalHeight
      cv.getContext('2d').drawImage(im, 0, 0)
      originCv.current = cv
    })
    return () => { on = false }
  }, [origin])
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && !busy && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [busy]) // eslint-disable-line

  // ancho/alto en fracciones ↔ proporción en píxeles
  const hOf = (w, r) => (w * nat.w) / (r * nat.h)
  const wOf = (h, r) => (h * r * nat.h) / nat.w

  const pickRatio = (r) => {
    setRatio(r)
    if (!r) return
    let w = 1, h = hOf(1, r)
    if (h > 1) { h = 1; w = wOf(1, r) }
    setCrop({ x: (1 - w) / 2, y: (1 - h) / 2, w, h })
  }

  // ── Recorte ──
  const start = (e, kind) => {
    e.preventDefault(); e.stopPropagation()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const r = box.current.getBoundingClientRect()
    drag.current = { kind, r, px: e.clientX, py: e.clientY, c: { ...crop } }
  }
  const move = (e) => {
    const d = drag.current
    if (!d) return
    const dx = (e.clientX - d.px) / d.r.width, dy = (e.clientY - d.py) / d.r.height
    const c = d.c
    if (d.kind === 'move') {
      setCrop({ ...c, x: clamp(c.x + dx, 0, 1 - c.w), y: clamp(c.y + dy, 0, 1 - c.h) })
      return
    }
    // esquina: la opuesta queda fija
    const right = d.kind.includes('e'), bottom = d.kind.includes('s')
    const ax = right ? c.x : c.x + c.w, ay = bottom ? c.y : c.y + c.h
    const px = clamp((e.clientX - d.r.left) / d.r.width, 0, 1), py = clamp((e.clientY - d.r.top) / d.r.height, 0, 1)
    const sx = px >= ax ? 1 : -1, sy = py >= ay ? 1 : -1
    let w = Math.abs(px - ax), h = Math.abs(py - ay)
    if (ratio) { const hw = hOf(w, ratio); if (hw <= h) h = hw; else w = wOf(h, ratio) }
    const maxW = sx > 0 ? 1 - ax : ax, maxH = sy > 0 ? 1 - ay : ay
    if (w > maxW) { w = maxW; if (ratio) h = hOf(w, ratio) }
    if (h > maxH) { h = maxH; if (ratio) w = wOf(h, ratio) }
    if (w < MIN || h < MIN) return
    setCrop({ x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h })
  }
  const end = () => { drag.current = null }

  const push = (next, nextOrigin = origin) => {
    setHist((h) => [...h, { src, origin }].slice(-MAX_HIST))
    setSrc(next)
    if (nextOrigin !== origin) setOrigin(nextOrigin)
  }
  const undo = () => {
    const last = hist[hist.length - 1]
    if (!last) return
    setHist(hist.slice(0, -1)); setSrc(last.src); setOrigin(last.origin)
  }

  const full = crop.w > 0.995 && crop.h > 0.995
  const doCrop = async () => {
    if (full) return
    const [a, b] = await Promise.all([cropData(src, crop), origin === src ? null : cropData(origin, crop)])
    push(a, b || a)
  }

  const removeBg = async () => {
    setErr(''); setPct(0); setBusy('bg')
    try {
      const { removeBackground } = await import('@imgly/background-removal')
      const blob = await removeBackground(src, {
        output: { format: 'image/png' },
        progress: (_k, cur2, total) => total && setPct(Math.round((cur2 / total) * 100)),
      })
      push(await blobToDataURL(blob)) // el origen se conserva: el pincel puede restaurar desde él
    } catch (e) { setErr(e?.message || String(e)) }
    setBusy('')
  }

  const upscale = async (factor) => {
    setErr(''); setBusy('up')
    await new Promise((r) => setTimeout(r, 30)) // deja pintar el aviso antes del cálculo pesado
    try {
      const f = Math.min(factor, MAX_SIDE / Math.max(nat.w, nat.h))
      if (f < 1.1) throw new Error(t('La imagen ya tiene el tamaño máximo.'))
      const a = await upscaleData(src, f)
      const b = origin === src ? a : await upscaleData(origin, f)
      push(a, b)
      if (f < factor) setErr(t('Se limitó al tamaño máximo permitido.'))
    } catch (e) { setErr(e?.message || String(e)) }
    setBusy('')
  }

  // ── Pincel (borrar / restaurar) ──
  const pt = (e) => {
    const r = view.current.getBoundingClientRect()
    const k = nat.w / r.width
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, k }
  }
  const seg = (a, b, k) => {
    const ctx = view.current.getContext('2d')
    ctx.save()
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = size * k
    if (tool === 'erase') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = '#000' }
    else if (originCv.current) ctx.strokeStyle = ctx.createPattern(originCv.current, 'no-repeat')
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x + 0.01, b.y); ctx.stroke()
    ctx.restore()
  }
  // Borrado automático: elimina la zona del color pulsado (varita mágica)
  const magic = (e) => {
    const cv = view.current, ctx = cv.getContext('2d', { willReadFrequently: true })
    const p = pt(e)
    const W = cv.width, H = cv.height
    const sx = clamp(Math.floor(p.x), 0, W - 1), sy = clamp(Math.floor(p.y), 0, H - 1)
    const img = ctx.getImageData(0, 0, W, H), d = img.data
    const restore = autoMode === 'restore'
    let o = null // píxeles originales (solo al restaurar)
    if (restore) {
      const oc = originCv.current
      if (!oc || oc.width !== W || oc.height !== H) return
      o = oc.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data
    }
    const sm = restore ? o : d // imagen de la que se toma el color y la región
    const si = (sy * W + sx) * 4
    if (sm[si + 3] < 10) return // zona transparente: nada que seleccionar
    const r0 = sm[si], g0 = sm[si + 1], b0 = sm[si + 2]
    const lim = (tol / 100) * 441 // distancia máxima RGB (√(3·255²) ≈ 441)
    const lim2 = lim * lim
    const hit = (i) => {
      if (sm[i + 3] < 10) return false
      const dr = sm[i] - r0, dg = sm[i + 1] - g0, db = sm[i + 2] - b0
      return dr * dr + dg * dg + db * db <= lim2
    }
    const mask = new Uint8Array(W * H)
    if (contig) {
      const stack = [sy * W + sx]
      mask[stack[0]] = 1
      while (stack.length) {
        const n = stack.pop()
        const x = n % W, y = (n - x) / W
        if (x > 0 && !mask[n - 1] && hit((n - 1) * 4)) { mask[n - 1] = 1; stack.push(n - 1) }
        if (x < W - 1 && !mask[n + 1] && hit((n + 1) * 4)) { mask[n + 1] = 1; stack.push(n + 1) }
        if (y > 0 && !mask[n - W] && hit((n - W) * 4)) { mask[n - W] = 1; stack.push(n - W) }
        if (y < H - 1 && !mask[n + W] && hit((n + W) * 4)) { mask[n + W] = 1; stack.push(n + W) }
      }
    } else {
      for (let n = 0; n < W * H; n++) if (hit(n * 4)) mask[n] = 1
    }
    for (let n = 0; n < W * H; n++) {
      if (!mask[n]) continue
      const i = n * 4
      if (restore) { d[i] = o[i]; d[i + 1] = o[i + 1]; d[i + 2] = o[i + 2]; d[i + 3] = o[i + 3] }
      else d[i + 3] = 0
    }
    ctx.putImageData(img, 0, 0)
    setHist((h) => [...h, { src, origin }].slice(-MAX_HIST))
    setSrc(cv.toDataURL('image/png'))
  }
  const brushDown = (e) => {
    if (tool === 'crop' || busy) return
    e.preventDefault()
    if (tool === 'magic') { magic(e); return }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const p = pt(e)
    stroke.current = { last: p, before: src }
    seg(p, p, p.k)
  }
  const brushMove = (e) => {
    if (tool === 'crop' || tool === 'magic') return
    const fr = box.current.getBoundingClientRect()
    setCur({ x: e.clientX - fr.left, y: e.clientY - fr.top })
    const s = stroke.current
    if (!s) return
    const p = pt(e)
    seg(s.last, p, p.k)
    s.last = p
  }
  const brushUp = () => {
    const s = stroke.current
    if (!s) return
    stroke.current = null
    const out = view.current.toDataURL('image/png')
    setHist((h) => [...h, { src: s.before, origin }].slice(-MAX_HIST))
    setSrc(out)
  }

  const apply = () => onApply(src)
  const ratios = [[null, 'Libre'], [1, '1:1'], [4 / 5, '4:5'], [16 / 9, '16:9'], [9 / 16, '9:16']]
  if (ratioHint) ratios.push([ratioHint, 'Formato'])
  const pctS = (v) => `${v * 100}%`
  const brush = tool !== 'crop'

  // ── Zoom ──
  const zoomBy = (d) => setZoom((z) => clamp(+(z + d).toFixed(2), ZMIN, ZMAX))
  const wheel = (e) => {
    if (!(e.ctrlKey || e.metaKey)) return // rueda normal = desplazar; Ctrl + rueda = zoom
    e.preventDefault()
    zoomBy(e.deltaY < 0 ? 0.25 : -0.25)
  }
  // Arrastrar para desplazar: botón central, o con el recorte completo (arrastrar la imagen)
  const panDown = (e) => {
    const sc = scroller.current
    const onCrop = !brush && full && e.target.closest?.('.ws-crop') && !e.target.closest('.ws-h')
    if (!sc || !(e.button === 1 || onCrop)) return
    if (sc.scrollWidth <= sc.clientWidth && sc.scrollHeight <= sc.clientHeight) return
    e.preventDefault(); e.stopPropagation()
    const s = { x: e.clientX, y: e.clientY, l: sc.scrollLeft, t: sc.scrollTop }
    sc.style.cursor = 'grabbing'
    const mv = (ev) => { sc.scrollLeft = s.l - (ev.clientX - s.x); sc.scrollTop = s.t - (ev.clientY - s.y) }
    const up = () => { sc.style.cursor = ''; window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }
  // Tamaño "ajustado" de la imagen (cabe en el visor); el zoom lo multiplica
  useEffect(() => {
    const calc = () => {
      const el = scroller.current
      if (!el) return
      const cw = el.clientWidth - 20
      const maxH = window.innerHeight * (window.matchMedia('(max-width: 760px)').matches ? 0.46 : 0.62)
      setFitW(Math.max(40, Math.min(cw, maxH * (nat.w / nat.h))))
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [nat])

  return (
    <div className="modal-bg ws-bg" onClick={() => !busy && onClose()}>
      <div className="ws" onClick={(e) => e.stopPropagation()}>
        <div className="ws-top">
          <h4>{t('Editor de imagen')}</h4>
          <button className="btn ghost sm" disabled={!!busy} onClick={onClose}>✕</button>
        </div>

        <div className="ws-viewbox">
        <div className="ws-view" ref={scroller} onWheel={wheel} onPointerDownCapture={panDown}>
          <div className={'ws-frame' + (brush ? (tool === 'magic' ? ' wand' : ' brush') : '')} ref={box}
            style={{ aspectRatio: `${nat.w}/${nat.h}`, ...(fitW ? { width: fitW * zoom, maxWidth: 'none', maxHeight: 'none' } : {}) }}
            onPointerDown={brushDown} onPointerMove={brushMove} onPointerUp={brushUp} onPointerCancel={brushUp} onPointerLeave={() => setCur(null)}>
            <canvas ref={view} />
            {!brush && <>
              <div className="ws-shade" style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${pctS(crop.x)} ${pctS(crop.y)},${pctS(crop.x)} ${pctS(crop.y + crop.h)},${pctS(crop.x + crop.w)} ${pctS(crop.y + crop.h)},${pctS(crop.x + crop.w)} ${pctS(crop.y)},${pctS(crop.x)} ${pctS(crop.y)})` }} />
              <div className="ws-crop" onPointerDown={(e) => start(e, 'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
                style={{ left: pctS(crop.x), top: pctS(crop.y), width: pctS(crop.w), height: pctS(crop.h) }}>
                {['nw', 'ne', 'sw', 'se'].map((k) => (
                  <i key={k} className={'ws-h ' + k} onPointerDown={(e) => start(e, k)} onPointerMove={move} onPointerUp={end} onPointerCancel={end} />
                ))}
              </div>
            </>}
            {brush && tool !== 'magic' && cur && <i className={'ws-cursor ' + tool} style={{ left: cur.x, top: cur.y, width: size, height: size }} />}
          </div>
        </div>
        <div className="ws-zoom" role="group" aria-label="Zoom">
          <button onClick={() => zoomBy(-0.25)} disabled={zoom <= ZMIN} title="Zoom −" aria-label="Zoom −">−</button>
          <button className="val" onClick={() => setZoom(1)} title={t('Ajustar')}>{Math.round(zoom * 100)}%</button>
          <button onClick={() => zoomBy(0.25)} disabled={zoom >= ZMAX} title="Zoom +" aria-label="Zoom +">+</button>
        </div>
          {busy && (
            <div className="ws-busy">
              <span className="ws-spin" />
              {busy === 'up' ? <b>{t('Mejorando la calidad…')}</b> : <>
                <b>{t('Quitando el fondo…')} {pct > 0 ? `${pct}%` : ''}</b>
                <small>{t('La primera vez descarga el modelo (puede tardar un poco)')}</small>
              </>}
            </div>
          )}
        </div>

        <div className="ws-tools">
          <div className="ws-tabs" role="tablist">
            {TOOLS.map(([v, l, ic]) => (
              <button key={v} role="tab" aria-selected={tool === v} className={tool === v ? 'on' : ''} disabled={!!busy} onClick={() => setTool(v)}>
                <WsIcon d={ic} /><span>{t(l)}</span>
              </button>
            ))}
          </div>

          <div className="ws-card" key={tool}>
            {tool === 'crop' && (
              <>
                <div className="ws-label">{t('Proporción')}</div>
                <div className="chips">
                  {ratios.map(([r, l]) => (
                    <button key={l} className={'chip' + (ratio === r ? ' on' : '')} disabled={!!busy} onClick={() => pickRatio(r)}>{t(l)}</button>
                  ))}
                </div>
                <button className="btn ws-wide" disabled={!!busy || full} onClick={doCrop}>{t('Recortar')}</button>
                <p className="ws-hint">{t('Arrastra el recuadro o sus esquinas para elegir el recorte. Al quitar el fondo se verá el Color de fondo detrás.')}</p>
              </>
            )}

            {tool === 'magic' && (
              <>
                <div className="ws-pills">
                  {[['erase', 'Borrar'], ['restore', 'Restaurar']].map(([v, l]) => (
                    <button key={v} className={autoMode === v ? 'on' : ''} onClick={() => setAutoMode(v)}>{t(l)}</button>
                  ))}
                </div>
                <Slider label={t('Tolerancia')} min={0} max={100} value={tol} onChange={setTol} />
                <label className="ws-switch">
                  <input type="checkbox" checked={contig} onChange={(e) => setContig(e.target.checked)} />
                  <i /><span>{t('Solo la zona conectada')}</span>
                </label>
                <p className="ws-hint">{autoMode === 'erase' ? t('Toca un color de la imagen y se borra esa zona. Sube la tolerancia para incluir tonos parecidos.') : t('Toca una zona borrada y se recupera desde la imagen original, según el color de esa zona. Sube la tolerancia para incluir tonos parecidos.')}</p>
              </>
            )}

            {(tool === 'erase' || tool === 'restore') && (
              <>
                <Slider label={t('Tamaño')} min={8} max={160} value={size} onChange={setSize} unit="px" />
                <p className="ws-hint">{tool === 'erase' ? t('Pinta sobre la imagen para borrar esa zona (se vuelve transparente).') : t('Pinta para recuperar lo borrado, tomándolo de la imagen original.')}</p>
              </>
            )}
          </div>

          <div className="ws-card">
            <div className="ws-label">{t('Fondo')}</div>
            <div className="ws-actions">
              <button className="btn ghost sm" disabled={!!busy} onClick={removeBg}><WsIcon d={IC.wand} /> {t('Quitar fondo')}</button>
              <button className="btn ghost sm" disabled={!!busy || !hist.length} onClick={undo}><WsIcon d={IC.undo} /> {t('Deshacer')}</button>
            </div>
          </div>

          <div className="ws-card">
            <div className="ws-label">{t('Mejorar calidad')}<em>{nat.w}×{nat.h}px</em></div>
            <div className="ws-pills ws-scale">
              <button disabled={!!busy} onClick={() => upscale(2)}>×2</button>
              <button disabled={!!busy} onClick={() => upscale(4)}>×4</button>
            </div>
          </div>

          {err && <p className="ws-err">{err}</p>}
          <div className="ws-foot">
            <button className="btn ghost" disabled={!!busy} onClick={onClose}>{t('Cancelar')}</button>
            <button className="btn" disabled={!!busy || !hist.length} onClick={apply}>{t('Aplicar')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Piezas de interfaz ──
const IC = {
  crop: 'M6 2v14a2 2 0 0 0 2 2h14M2 6h14a2 2 0 0 1 2 2v14',
  erase: 'M20 20H9l-5.3-5.3a1 1 0 0 1 0-1.4l9.6-9.6a1 1 0 0 1 1.4 0l5.6 5.6a1 1 0 0 1 0 1.4L12 20M7 11l6 6',
  restore: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  wand: 'M15 4V2m0 14v-2m-7-5H6m18 0h-2m-2.8-4.2-1.4 1.4m0 7.6 1.4 1.4M3 21l9-9m1-1 1 1',
  undo: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
}
const TOOLS = [['crop', 'Recortar', IC.crop], ['erase', 'Borrar', IC.erase], ['restore', 'Restaurar', IC.restore], ['magic', 'Auto', IC.wand]]

function WsIcon({ d }) {
  return <svg className="ws-ic" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
}

function Slider({ label, min, max, value, onChange, unit = '' }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className="ws-slider">
      <div className="ws-label">{label}<em>{value}{unit}</em></div>
      <input type="range" min={min} max={max} value={value} style={{ '--p': pct + '%' }} onChange={(e) => onChange(+e.target.value)} />
    </div>
  )
}
