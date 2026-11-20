import { useEffect, useRef, useState } from 'react'
import { FORMATS, FONTS, TEMPLATES, getFormat, newLayer } from '../lib/formats.js'
import { drawDesign, ensureFonts, loadImage, renderToDataURL } from '../lib/render.js'
import { Icon } from './ui.jsx'
import { t, useLang } from '../lib/i18n.jsx'

export default function ImageEditor({ design, setDesign }) {
  useLang()
  const canvas = useRef(null)
  const boxes = useRef([])
  const drag = useRef(null)
  const [sel, setSel] = useState(design.layers[0]?.id)
  const [img, setImg] = useState(null)
  const [tick, setTick] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [guides, setGuides] = useState(true)
  const [full, setFull] = useState(false)
  const [snap, setSnap] = useState({ x: false, y: false })
  const fmt = getFormat(design.format)
  const layer = design.layers.find((l) => l.id === sel)

  useEffect(() => { loadImage(design.bg.image).then(setImg) }, [design.bg.image])
  useEffect(() => { ensureFonts(design).then(() => setTick((t) => t + 1)) }, [design.layers.map((l) => l.font + l.weight).join()]) // eslint-disable-line

  useEffect(() => {
    const c = canvas.current
    c.width = fmt.w
    c.height = fmt.h
    const ctx = c.getContext('2d')
    boxes.current = drawDesign(ctx, design, img)
    if (layer && !drag.current?.hideSel) {
      const b = boxes.current.find((x) => x.id === layer.id)
      if (b) {
        ctx.save()
        ctx.setLineDash([14, 10]); ctx.lineWidth = 3; ctx.strokeStyle = '#2b82cf'
        ctx.strokeRect(b.x - 14, b.y - 10, b.w + 28, b.h + 20)
        ctx.restore()
      }
    }
    if (guides) {
      ctx.save()
      ctx.lineWidth = 2; ctx.setLineDash([])
      // zona segura (5%) y cuadrícula de tercios
      ctx.strokeStyle = 'rgba(255,255,255,.35)'
      ctx.strokeRect(fmt.w * 0.05, fmt.h * 0.05, fmt.w * 0.9, fmt.h * 0.9)
      ctx.strokeStyle = 'rgba(255,255,255,.18)'
      for (let i = 1; i < 3; i++) {
        ctx.beginPath(); ctx.moveTo((fmt.w * i) / 3, 0); ctx.lineTo((fmt.w * i) / 3, fmt.h); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, (fmt.h * i) / 3); ctx.lineTo(fmt.w, (fmt.h * i) / 3); ctx.stroke()
      }
      ctx.restore()
    }
    if (snap.x || snap.y) {
      ctx.save()
      ctx.lineWidth = 3; ctx.strokeStyle = '#ff3d8b'
      if (snap.x) { ctx.beginPath(); ctx.moveTo(fmt.w / 2, 0); ctx.lineTo(fmt.w / 2, fmt.h); ctx.stroke() }
      if (snap.y) { ctx.beginPath(); ctx.moveTo(0, fmt.h / 2); ctx.lineTo(fmt.w, fmt.h / 2); ctx.stroke() }
      ctx.restore()
    }
  }, [design, img, sel, tick, fmt.w, fmt.h, guides, snap]) // eslint-disable-line

  useEffect(() => {
    if (!full) return
    const k = (e) => e.key === 'Escape' && setFull(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [full])

  const patch = (p) => setDesign({ ...design, ...p })
  const patchBg = (p) => patch({ bg: { ...design.bg, ...p } })
  const patchLayer = (p) => patch({ layers: design.layers.map((l) => (l.id === sel ? { ...l, ...p } : l)) })

  const pt = (e) => {
    const c = canvas.current, r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height }
  }
  const down = (e) => {
    const p = pt(e)
    const hit = [...boxes.current].reverse().find((b) => p.x >= b.x - 30 && p.x <= b.x + b.w + 30 && p.y >= b.y - 30 && p.y <= b.y + b.h + 30)
    if (hit) {
      setSel(hit.id)
      const l = design.layers.find((x) => x.id === hit.id)
      drag.current = { id: hit.id, dx: p.x - l.x * fmt.w, dy: p.y - l.y * fmt.h }
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }
  const move = (e) => {
    if (!drag.current) return
    const p = pt(e), d = drag.current
    let x = Math.min(1, Math.max(0, (p.x - d.dx) / fmt.w))
    let y = Math.min(1, Math.max(0, (p.y - d.dy) / fmt.h))
    const T = 0.012 // imán al centro
    const sx = Math.abs(x - 0.5) < T, sy = Math.abs(y - 0.5) < T
    if (sx) x = 0.5
    if (sy) y = 0.5
    if (sx !== snap.x || sy !== snap.y) setSnap({ x: sx, y: sy })
    setDesign({ ...design, layers: design.layers.map((l) => (l.id === d.id ? { ...l, x, y } : l)) })
  }
  const up = () => { drag.current = null; if (snap.x || snap.y) setSnap({ x: false, y: false }) }
  const key = (e) => {
    if (!layer || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return
    const st = (e.shiftKey ? 10 : 1) / 200
    const m = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key]
    if (!m) return
    e.preventDefault()
    patchLayer({ x: Math.min(1, Math.max(0, layer.x + m[0])), y: Math.min(1, Math.max(0, layer.y + m[1])) })
  }

  const addLayer = () => {
    const l = newLayer({ text: t('Nuevo texto'), y: 0.6, size: 70 })
    patch({ layers: [...design.layers, l] })
    setSel(l.id)
  }
  const delLayer = () => {
    const rest = design.layers.filter((l) => l.id !== sel)
    patch({ layers: rest })
    setSel(rest[0]?.id)
  }
  const applyTemplate = (tpl) => {
    const d = tpl.make()
    setDesign({ format: design.format, ...d, bg: { ...d.bg, image: d.bg.type === 'image' ? design.bg.image : null } })
    setSel(d.layers[0].id)
  }
  const upload = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => {
      // Reduce tamaño para no saturar el almacenamiento local
      const im = new Image()
      im.onload = () => {
        const s = Math.min(1, 1600 / Math.max(im.width, im.height))
        const c = document.createElement('canvas')
        c.width = im.width * s; c.height = im.height * s
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height)
        patchBg({ type: 'image', image: c.toDataURL('image/jpeg', 0.82), dim: design.bg.dim || 0.3 })
      }
      im.src = r.result
    }
    r.readAsDataURL(f)
    e.target.value = ''
  }
  const download = async () => {
    const url = await renderToDataURL(design, 'image/png', 1, 1080)
    const a = document.createElement('a')
    a.href = url; a.download = `global-zion-${design.format}.png`; a.click()
  }

  return (
    <div className="editor">
      <div className="stage">
        <div className="stage-bar">
          <button className="btn ghost sm" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} title="Zoom -">−</button>
          <button className="btn ghost sm zoom-val" onClick={() => setZoom(1)} title={t('Ajustar')}>{Math.round(zoom * 100)}%</button>
          <button className="btn ghost sm" onClick={() => setZoom((z) => Math.min(2, +(z + 0.25).toFixed(2)))} title="Zoom +">+</button>
          <button className={'btn ghost sm' + (guides ? ' active' : '')} onClick={() => setGuides(!guides)} title={t('Guías')}>▦</button>
          <button className="btn ghost sm" onClick={() => setFull(true)} title={t('Pantalla completa')}>⛶</button>
        </div>
        <div className="canvas-scroll">
          <div className="canvas-wrap" tabIndex={0} onKeyDown={key} style={{ aspectRatio: `${fmt.w}/${fmt.h}`, width: `${zoom * 100}%`, maxHeight: zoom === 1 ? '74vh' : 'none' }}>
            <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          </div>
        </div>
        <p className="hint">{t('Arrastra los textos sobre la imagen para moverlos')} · {fmt.w}×{fmt.h}px</p>
        <button className="btn ghost sm" onClick={download}><Icon name="down" size={15} /> {t('Descargar PNG')}</button>
      </div>

      <div className="tools">
        <section>
          <h4>{t('Formato')}</h4>
          <div className="chips">
            {FORMATS.map((f) => (
              <button key={f.id} className={'chip' + (f.id === design.format ? ' on' : '')} onClick={() => patch({ format: f.id })}>{t(f.label)}</button>
            ))}
          </div>
        </section>

        <section>
          <h4>{t('Plantillas')}</h4>
          <div className="chips">
            {TEMPLATES.map((tpl) => <button key={tpl.id} className="chip" onClick={() => applyTemplate(tpl)}>{t(tpl.name)}</button>)}
          </div>
        </section>

        <section>
          <h4>{t('Fondo')}</h4>
          <div className="seg full">
            {[['gradient', 'Degradado'], ['solid', 'Color'], ['image', 'Imagen']].map(([v, l]) => (
              <button key={v} className={design.bg.type === v ? 'on' : ''} onClick={() => patchBg({ type: v })}>{t(l)}</button>
            ))}
          </div>
          {design.bg.type !== 'image' && (
            <div className="row">
              <label className="inl sw">{t('Color 1')}<input type="color" value={design.bg.c1} onChange={(e) => patchBg({ c1: e.target.value })} /></label>
              {design.bg.type === 'gradient' && <>
                <label className="inl sw">{t('Color 2')}<input type="color" value={design.bg.c2} onChange={(e) => patchBg({ c2: e.target.value })} /></label>
                <label className="inl grow">{t('Ángulo')}<input type="range" min="0" max="360" value={design.bg.angle} onChange={(e) => patchBg({ angle: +e.target.value })} /></label>
              </>}
            </div>
          )}
          {design.bg.type === 'image' && (
            <div className="row">
              <label className="btn ghost sm file"><Icon name="up" size={15} /> {design.bg.image ? t('Cambiar imagen') : t('Subir imagen')}<input type="file" accept="image/*" hidden onChange={upload} /></label>
              <label className="inl grow">{t('Oscurecer')}<input type="range" min="0" max="0.85" step="0.05" value={design.bg.dim} onChange={(e) => patchBg({ dim: +e.target.value })} /></label>
            </div>
          )}
          <label className="check"><input type="checkbox" checked={!!design.accent?.show} onChange={(e) => patch({ accent: { ...design.accent, show: e.target.checked } })} /> {t('Marco decorativo')}
            <input type="color" value={design.accent?.color || '#ffffff'} onChange={(e) => patch({ accent: { ...design.accent, color: e.target.value } })} />
          </label>
        </section>

        <section>
          <h4>{t('Textos')} <button className="btn ghost sm" onClick={addLayer}><Icon name="plus" size={14} /> {t('Añadir')}</button></h4>
          <div className="chips">
            {design.layers.map((l, i) => (
              <button key={l.id} className={'chip' + (l.id === sel ? ' on' : '')} onClick={() => setSel(l.id)}>
                {i + 1}. {l.text.replace(/\n/g, ' ').slice(0, 14) || t('(vacío)')}
              </button>
            ))}
          </div>
          {layer && (
            <div className="layer-ed">
              <textarea rows={2} value={layer.text} onChange={(e) => patchLayer({ text: e.target.value })} />
              <div className="row fonts">
                <select value={layer.font} onChange={(e) => patchLayer({ font: e.target.value })}>
                  {FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
                <select value={layer.weight} onChange={(e) => patchLayer({ weight: +e.target.value })}>
                  <option value={400}>{t('Normal')}</option><option value={600}>{t('Seminegrita')}</option><option value={800}>{t('Negrita')}</option><option value={900}>{t('Extra')}</option>
                </select>
                <input type="color" value={layer.color} onChange={(e) => patchLayer({ color: e.target.value })} />
              </div>
              <label className="inl"><span className="lbl">{t('Tamaño')} <b>{layer.size}</b></span><input type="range" min="20" max="300" value={layer.size} onChange={(e) => patchLayer({ size: +e.target.value })} /></label>
              <div className="row">
                <label className="inl grow">X<input type="range" min="0" max="1" step="0.01" value={layer.x} onChange={(e) => patchLayer({ x: +e.target.value })} /></label>
                <label className="inl grow">Y<input type="range" min="0" max="1" step="0.01" value={layer.y} onChange={(e) => patchLayer({ y: +e.target.value })} /></label>
              </div>
              <div className="row toolbar">
                <div className="seg">
                  {['left', 'center', 'right'].map((a) => <button key={a} className={layer.align === a ? 'on' : ''} onClick={() => patchLayer({ align: a })}>{{ left: '⇤', center: '↔', right: '⇥' }[a]}</button>)}
                </div>
                <label className="check"><input type="checkbox" checked={layer.shadow} onChange={(e) => patchLayer({ shadow: e.target.checked })} /> {t('Sombra')}</label>
                <label className="check"><input type="checkbox" checked={layer.upper} onChange={(e) => patchLayer({ upper: e.target.checked })} /> {t('MAYÚS')}</label>
                <button className="btn danger sm" onClick={delLayer}><Icon name="trash" size={14} /></button>
              </div>
            </div>
          )}
        </section>
      </div>
      {full && <FullPreview design={design} onClose={() => setFull(false)} />}
    </div>
  )
}

function FullPreview({ design, onClose }) {
  const [url, setUrl] = useState(null)
  useEffect(() => { renderToDataURL(design, 'image/jpeg', 0.92, 1080).then(setUrl) }, []) // eslint-disable-line
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="btn ghost sm lb-close" onClick={onClose}>✕</button>
      {url ? <img src={url} alt="" onClick={(e) => e.stopPropagation()} /> : <span className="hint">…</span>}
    </div>
  )
}
