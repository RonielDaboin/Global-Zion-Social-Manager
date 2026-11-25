import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FORMATS, TEMPLATES, designFormats, getFormat, newLayer, uid } from '../lib/formats.js'
import { drawDesign, ensureFonts, loadImage, renderToDataURL, FX_DEFAULT } from '../lib/render.js'
import { Icon, useCineTheme, CineThemeSwitch } from './ui.jsx'
import FontPicker from './FontPicker.jsx'
import EmojiButton from './EmojiPicker.jsx'
import Stickers from './Stickers.jsx'
import { BG_PRESETS } from '../lib/brand.js'
import { vetImage } from '../lib/imageQuality.js'
import ImageWorkshop from './ImageWorkshop.jsx'
import { t, useLang } from '../lib/i18n.jsx'
import { useApp } from '../lib/store.jsx'
import { aiTextUsed, aiTextBump } from '../lib/plans.js'
import { LockTag } from './Plans.jsx'
import { generateImageAI, generateLayerTextsAI, shrinkImage } from '../lib/social.js'

// Relación de aspecto más cercana entre las que admite Gemini
const RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']
const nearestRatio = (r) => RATIOS.reduce((best, s) => {
  const [a, b] = s.split(':').map(Number), [c, d] = best.split(':').map(Number)
  return Math.abs(Math.log(a / b / r)) < Math.abs(Math.log(c / d / r)) ? s : best
})

// Colores del logo del panel (naranja, rosa, morado, turquesa): el cursor de escritura los recorre al parpadear
const CARET_COLORS = ['#f58529', '#dd2a7b', '#8134af', '#25f4ee']

// Dibuja la barra de escritura en la posición `pos` del texto de la capa (usa las líneas ya ajustadas por drawDesign)
function drawCaret(ctx, b, pos, color, size) {
  const text = b.text
  let at = 0, li = b.lines.length - 1, off = b.lines[li].length
  for (let i = 0; i < b.lines.length; i++) {
    const idx = text.indexOf(b.lines[i], at)
    const start = idx < 0 ? at : idx, end = start + b.lines[i].length
    if (pos <= end) { li = i; off = Math.max(0, Math.min(b.lines[i].length, pos - start)); break }
    at = end
  }
  ctx.save()
  ctx.font = b.font
  if (b.rot) { ctx.translate(b.cx, b.cy); ctx.rotate((b.rot * Math.PI) / 180); ctx.translate(-b.cx, -b.cy) }
  const line = b.lines[li], full = ctx.measureText(line).width, pre = ctx.measureText(line.slice(0, off)).width
  const x = (b.align === 'center' ? b.cx - full / 2 : b.align === 'right' ? b.cx - full : b.cx) + pre
  const y = b.startY + li * b.lh
  const h = b.lh * 0.9
  ctx.lineCap = 'round'; ctx.lineWidth = Math.max(5, size * 0.07)
  ctx.shadowColor = color; ctx.shadowBlur = 16
  ctx.strokeStyle = color
  ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x, y + h / 2); ctx.stroke()
  ctx.restore()
}

const isShape = (l) => !!(l?.logo || l?.brand || l?.box) // logos y rectángulos: sin texto
// Al cambiar el tamaño a mano deja de limitarse el alto (si no, el ajuste automático impediría agrandar la letra)
const resized = (l, size) => (l.fit ? { ...l, size, fit: { w: l.fit.w } } : { ...l, size })

let layerClip = null // portapapeles interno de elementos (Ctrl+C / Ctrl+X / Ctrl+V)

export default function ImageEditor({ design, setDesign }) {
  useLang()
  const { access, openPlans, session } = useApp()
  const lim = access.limits
  const canvas = useRef(null)
  const layerTxt = useRef(null)
  const wrapRef = useRef(null)
  const wantFocus = useRef(false)
  const [editing, setEditing] = useState(false) // el campo de texto de la capa tiene el foco
  const [caretPos, setCaretPos] = useState(0)
  const [blink, setBlink] = useState({ on: true, n: 0 }) // cursor parpadeante con los colores del logo
  const boxes = useRef([])
  const drag = useRef(null)
  const [sel, setSel] = useState(design.layers[0]?.id)
  const [img, setImg] = useState(null)
  const [tick, setTick] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [mode, setMode] = useState('basic') // 'basic' | 'adv'
  const [shop, setShop] = useState(false) // editor de imagen (recortar / quitar fondo)
  const [guides, setGuides] = useState(true)
  const [full, setFull] = useState(false)
  const [cine, setCine] = useState(false) // modo cine: vista grande en vivo con el panel al lado
  const [cineLight, toggleCineTheme] = useCineTheme()
  const [snap, setSnap] = useState({ x: false, y: false })
  const [moving, setMoving] = useState(false) // arrastrando un texto: se muestran las líneas del centro
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiImage, setAiImage] = useState(null) // última imagen generada con IA, para reutilizarla sin regenerar
  const [upImage, setUpImage] = useState(null) // última imagen subida; cada origen se conserva por separado
  const [aiBusy, setAiBusy] = useState(false)
  const [aiIdea, setAiIdea] = useState(design.bg.prompt || '') // prompt memorizado: lo que se pidió al crear con IA
  const [aiTweak, setAiTweak] = useState(design.bg.tweak || '') // indicaciones para mejorar la imagen actual
  const [aiErr, setAiErr] = useState('')
  const [txtTopic, setTxtTopic] = useState('')
  const [txtBusy, setTxtBusy] = useState(false)
  const [txtErr, setTxtErr] = useState('')
  const fmt = getFormat(design.format)
  const layer = design.layers.find((l) => l.id === sel)

  useEffect(() => { loadImage(design.bg.image).then(setImg) }, [design.bg.image])
  useEffect(() => { if (design.bg.prompt && design.bg.prompt !== aiIdea) setAiIdea(design.bg.prompt) }, [design.bg.prompt]) // eslint-disable-line
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
        const H = handlesOf(layer, b)
        ctx.save()
        ctx.translate(H.cx, H.cy); ctx.rotate(H.rad); ctx.translate(-H.cx, -H.cy)
        ctx.setLineDash([14, 10]); ctx.lineWidth = 3; ctx.strokeStyle = '#2b82cf'
        ctx.strokeRect(b.x - 14, b.y - 10, b.w + 28, b.h + 20)
        ctx.restore()
        if (editing && blink.on && b.lines) drawCaret(ctx, b, Math.min(caretPos, layer.text.length), CARET_COLORS[blink.n % CARET_COLORS.length], layer.size)
        if (mode === 'adv') {
          ctx.save()
          ctx.lineWidth = 3; ctx.setLineDash([]); ctx.strokeStyle = '#2b82cf'
          ctx.beginPath(); ctx.moveTo(H.top.x, H.top.y); ctx.lineTo(H.rot.x, H.rot.y); ctx.stroke()
          ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2b82cf'; ctx.lineWidth = 4
          ctx.beginPath(); ctx.arc(H.rot.x, H.rot.y, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
          ctx.fillStyle = '#2b82cf'; ctx.font = '700 30px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText('↻', H.rot.x, H.rot.y + 1)
          ctx.fillStyle = '#ffffff'
          ctx.beginPath(); ctx.arc(H.scl.x, H.scl.y, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
          ctx.fillStyle = '#2b82cf'; ctx.font = '700 24px sans-serif'; ctx.fillText('⤡', H.scl.x, H.scl.y + 1)
          ctx.restore()
        }
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
    if (moving || snap.x || snap.y) {
      // Mientras se arrastra: la mitad del ancho y del alto siempre visibles; se resaltan en rosa al quedar centrado
      ctx.save()
      const u = Math.max(1, fmt.w / 540)
      ctx.setLineDash([10 * u, 8 * u]); ctx.lineWidth = 1.6 * u; ctx.strokeStyle = 'rgba(255,255,255,.75)'
      ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 3 * u
      ctx.beginPath(); ctx.moveTo(fmt.w / 2, 0); ctx.lineTo(fmt.w / 2, fmt.h); ctx.moveTo(0, fmt.h / 2); ctx.lineTo(fmt.w, fmt.h / 2); ctx.stroke()
      ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.lineWidth = 3 * u; ctx.strokeStyle = '#ff3d8b'
      if (snap.x) { ctx.beginPath(); ctx.moveTo(fmt.w / 2, 0); ctx.lineTo(fmt.w / 2, fmt.h); ctx.stroke() }
      if (snap.y) { ctx.beginPath(); ctx.moveTo(0, fmt.h / 2); ctx.lineTo(fmt.w, fmt.h / 2); ctx.stroke() }
      ctx.restore()
    }
  }, [design, img, sel, tick, fmt.w, fmt.h, guides, snap, moving, mode, editing, blink, caretPos, cine]) // eslint-disable-line

  useEffect(() => {
    if (!editing) return
    setBlink({ on: true, n: 0 })
    const id = setInterval(() => setBlink((b) => ({ on: !b.on, n: b.on ? b.n : b.n + 1 })), 480)
    return () => clearInterval(id)
  }, [editing])
  useEffect(() => { // al empezar a escribir sobre la imagen, el cursor pasa al campo de texto de la capa
    if (!wantFocus.current) return
    wantFocus.current = false
    const el = layerTxt.current
    if (el) { el.focus({ preventScroll: true }); el.setSelectionRange(el.value.length, el.value.length) }
  })
  useEffect(() => {
    if (!cine) return
    const k = (e) => { if (e.key === 'Escape' && !['TEXTAREA', 'INPUT', 'SELECT'].includes(document.activeElement?.tagName)) setCine(false) }
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [cine])
  useEffect(() => {
    if (!full) return
    const k = (e) => e.key === 'Escape' && setFull(false)
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [full])

  // Asas de la capa seleccionada (giran con ella): rotar (arriba) y escalar (esquina inferior derecha)
  function handlesOf(l, b) {
    const cx = l.x * fmt.w, cy = l.y * fmt.h, rad = ((l.rot || 0) * Math.PI) / 180
    const R = (x, y) => ({ x: cx + (x - cx) * Math.cos(rad) - (y - cy) * Math.sin(rad), y: cy + (x - cx) * Math.sin(rad) + (y - cy) * Math.cos(rad) })
    const mid = b.x + b.w / 2
    return { cx, cy, rad, top: R(mid, b.y - 10), rot: R(mid, b.y - 80), scl: R(b.x + b.w + 14, b.y + b.h + 10) }
  }
  const patch = (p) => setDesign({ ...design, ...p })
  const fmts = designFormats(design)
  // Los botones de formato se marcan/desmarcan; el visor muestra uno y se rota con ‹ ›
  const toggleFormat = (id) => {
    if (fmts.includes(id)) {
      if (fmts.length === 1) return
      const next = fmts.filter((x) => x !== id)
      patch({ formats: next, format: design.format === id ? next[0] : design.format })
    } else if (!lim.multiFormat) {
      if (fmts.length) openPlans(t('Publicar en varios formatos a la vez está disponible desde el plan PRO. En Básico se usa un formato.'))
      patch({ formats: [id], format: id })
    } else patch({ formats: [...fmts, id], format: id })
  }
  const goFormat = (dir) => patch({ format: fmts[(fmts.indexOf(design.format) + dir + fmts.length) % fmts.length] })
  const patchBg = (p) => patch({ bg: { ...design.bg, ...p } })
  const patchLayer = (p) => patch({ layers: design.layers.map((l) => (l.id === sel ? { ...l, ...p } : l)) })

  const pt = (e) => {
    const c = canvas.current, r = c.getBoundingClientRect()
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height }
  }
  const down = (e) => {
    const p = pt(e)
    if (mode === 'adv' && layer) {
      const b = boxes.current.find((x) => x.id === layer.id)
      if (b) {
        const H = handlesOf(layer, b)
        const near = (q, r) => Math.hypot(p.x - q.x, p.y - q.y) <= r
        if (near(H.rot, 50)) { drag.current = { id: layer.id, kind: 'rot', cx: H.cx, cy: H.cy }; e.currentTarget.setPointerCapture(e.pointerId); return }
        if (near(H.scl, 46)) { drag.current = { id: layer.id, kind: 'scl', cx: H.cx, cy: H.cy, d0: Math.hypot(H.scl.x - H.cx, H.scl.y - H.cy), size0: b.fs || layer.size }; e.currentTarget.setPointerCapture(e.pointerId); return }
      }
    }
    const hit = [...boxes.current].reverse().find((b) => !b.lock && p.x >= b.x - 30 && p.x <= b.x + b.w + 30 && p.y >= b.y - 30 && p.y <= b.y + b.h + 30)
    if (hit) {
      setSel(hit.id)
      wrapRef.current?.focus({ preventScroll: true })
      const l = design.layers.find((x) => x.id === hit.id)
      drag.current = { id: hit.id, dx: p.x - l.x * fmt.w, dy: p.y - l.y * fmt.h }
      setMoving(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
  }
  const move = (e) => {
    if (!drag.current) return
    const p = pt(e), d = drag.current
    if (d.kind === 'rot') {
      let a = (Math.atan2(p.y - d.cy, p.x - d.cx) * 180) / Math.PI + 90
      a = ((a + 540) % 360) - 180
      const m = Math.round(a / 45) * 45
      if (Math.abs(a - m) < 4) a = m // imán a 0°, 45°, 90°…
      setDesign({ ...design, layers: design.layers.map((l) => (l.id === d.id ? { ...l, rot: Math.round(a) } : l)) })
      return
    }
    if (d.kind === 'scl') {
      const size = Math.min(1000, Math.max(20, Math.round((d.size0 * Math.hypot(p.x - d.cx, p.y - d.cy)) / d.d0)))
      setDesign({ ...design, layers: design.layers.map((l) => (l.id === d.id ? resized(l, size) : l)) })
      return
    }
    let x = Math.min(1, Math.max(0, (p.x - d.dx) / fmt.w))
    let y = Math.min(1, Math.max(0, (p.y - d.dy) / fmt.h))
    const T = 0.012 // imán al centro
    const sx = Math.abs(x - 0.5) < T, sy = Math.abs(y - 0.5) < T
    if (sx) x = 0.5
    if (sy) y = 0.5
    if (sx !== snap.x || sy !== snap.y) setSnap({ x: sx, y: sy })
    setDesign({ ...design, layers: design.layers.map((l) => (l.id === d.id ? { ...l, x, y } : l)) })
  }
  const up = () => { drag.current = null; setMoving(false); if (snap.x || snap.y) setSnap({ x: false, y: false }) }
  const key = (e) => {
    const inField = e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT'
    if ((e.ctrlKey || e.metaKey) && !inField && ['c', 'x', 'v', 'd'].includes(e.key.toLowerCase())) {
      const k = e.key.toLowerCase()
      if (k === 'v' || k === 'd') { // pegar (o duplicar): copia desplazada y seleccionada
        const base = k === 'd' ? layer : layerClip
        if (!base) return
        e.preventDefault()
        const x = Math.min(1, base.x + 0.04), y = Math.min(1, base.y + 0.04)
        const l = { ...base, id: uid(), x, y }
        if (k === 'v') layerClip = { ...base, x, y } // pegados seguidos se van escalonando
        patch({ layers: [...design.layers, l] })
        setSel(l.id)
        return
      }
      if (!layer) return
      e.preventDefault()
      layerClip = { ...layer }
      if (k === 'x') delLayer()
      return
    }
    if (!layer || inField) return
    if (e.key === 'Delete') { e.preventDefault(); delLayer(); return } // Supr elimina el elemento seleccionado
    if (e.key === 'Enter' && !isShape(layer)) { e.preventDefault(); wantFocus.current = true; setTick((n) => n + 1); return }
    if (!isShape(layer) && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { // escribir directamente edita el texto
      e.preventDefault()
      wantFocus.current = true
      patchLayer({ text: layer.text + e.key })
      return
    }
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
  // Stickers (porcentajes, etiquetas, emojis, formas): son capas con fondo y rotación opcionales
  const addSticker = (st) => {
    const l = newLayer({ font: 'Poppins', weight: 800, shadow: false, upper: false, align: 'center', x: 0.5 + (Math.random() - 0.5) * 0.2, y: 0.5 + (Math.random() - 0.5) * 0.2, ...st })
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
    setDesign({ format: design.format, formats: design.formats, ...d, bg: { ...d.bg, image: design.bg.image || aiImage?.image || upImage?.image || null } })
    setSel(d.layers[0].id)
  }
  // Reduce tamaño para no saturar el almacenamiento local
  const setBgImage = (src, dim, isAi, extra = {}, layersFn = null) => {
    const im = new Image()
    im.onload = () => {
      const s = Math.min(1, 1600 / Math.max(im.width, im.height))
      const c = document.createElement('canvas')
      c.width = im.width * s; c.height = im.height * s
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height)
      const out = c.toDataURL('image/jpeg', 0.82)
      if (isAi) setAiImage({ image: out, dim })
      else setUpImage({ image: out, dim })
      setDesign({ ...design, bg: { ...design.bg, type: 'image', image: out, dim, ...extra }, ...(layersFn ? { layers: design.layers.map(layersFn) } : {}) })
    }
    im.src = src
  }
  const upload = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const r = new FileReader()
    r.onload = () => setBgImage(r.result, design.bg.dim || 0.3)
    r.readAsDataURL(f)
    e.target.value = ''
  }
  // Elimina la imagen cargada; si era el fondo activo pasa a la de IA (si existe)
  const removeUpload = () => {
    const wasActive = design.bg.image === upImage?.image
    setUpImage(null)
    if (wasActive) patchBg(aiImage ? { image: aiImage.image, dim: aiImage.dim } : { image: null })
  }
  // Guarda la imagen editada en el fondo y en la ranura (subida / IA) de la que venía
  const applyWorkshop = (out) => {
    const old = design.bg.image
    if (upImage?.image === old) setUpImage({ ...upImage, image: out })
    if (aiImage?.image === old) setAiImage({ ...aiImage, image: out })
    patchBg({ image: out })
    setShop(false)
  }
  const aiGenerate = async () => {
    if (!aiPrompt.trim() || aiBusy) return
    if (!lim.aiImage) return openPlans(t('Las imágenes con IA están disponibles en el plan Premium.'))
    setAiBusy(true); setAiErr('')
    try {
      const url = await generateImageAI({ prompt: aiPrompt.trim(), aspectRatio: nearestRatio(fmt.w / fmt.h) })
      setBgImage(url, 0, true, { prompt: aiPrompt.trim() })
      setAiIdea(aiPrompt.trim())
      const q = await vetImage(url, { context: aiPrompt.trim() })
      if (!q.ok) setAiErr(t('La imagen salió con baja calidad ({r}). Prueba a generar otra o usa un fondo del editor.', { r: q.reasons.join(', ') }))
    } catch (e) { setAiErr(e.message || String(e)) }
    setAiBusy(false)
  }
  // Regenera la imagen de fondo: parte de la imagen actual (si el generador permite editar) y del prompt memorizado,
  // aplica las indicaciones de mejora y repite hasta 3 veces si la calidad no es buena.
  const aiRegen = async () => {
    if (aiBusy) return
    if (!lim.aiImage) return openPlans(t('Las imágenes con IA están disponibles en el plan Premium.'))
    setAiBusy(true); setAiErr('')
    try {
      const titles = design.layers.filter((l) => !l.bg && !l.panel && l.text.trim()).slice(0, 2).map((l) => l.text.replace(/\n/g, ' ')).join(' - ')
      const idea = aiIdea.trim() || design.bg.prompt || titles
      const scene = design.bg.scene ? ` Scene: ${design.bg.scene}.` : ''
      const base = idea
        ? `Premium social media background image for a post about: ${idea}.${scene} Modern, clean, professional style with deep navy blue, blue and cyan tones. No text, letters, logos or watermarks. No people, faces, hands, devices or screens.`
        : 'Premium professional background image about web design, modern, clean, no text, letters or logos.'
      if (!aiIdea.trim() && idea) setAiIdea(idea)
      const tweak = aiTweak.trim()
      const improve = tweak || 'sharper, higher quality, more detail, professional lighting'
      const ratio = nearestRatio(fmt.w / fmt.h)
      const cur = design.bg.image ? await shrinkImage(design.bg.image, 768) : null
      let best = null, ok = false, lastWhy = []
      for (let i = 0; i < 3 && !ok; i++) {
        let u = null
        if (cur && i === 0) { // reinterpreta la imagen actual (requiere un generador que permita editar)
          try { u = await generateImageAI({ prompt: `Recreate the attached image as a high-quality background, keeping its subject and composition. Improvements: ${improve}. Context: ${base}`, aspectRatio: ratio, image: cur }) } catch { u = null }
        }
        if (!u) u = await generateImageAI({ prompt: `${base}. ${improve}`, aspectRatio: ratio })
        const q = await vetImage(u, { context: idea })
        best = u; ok = q.ok; lastWhy = q.reasons
      }
      const wasImg = design.bg.type === 'image'
      const lum = (hex) => { const n = parseInt((hex || '#000000').slice(1, 7), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 }
      const light = !wasImg && lum(design.bg.c1) > 0.6 // texto oscuro sobre fondo claro: pasa a blanco para leerse sobre la foto
      setBgImage(best, wasImg ? design.bg.dim : 0.6, true,
        { prompt: idea, scene: design.bg.scene, tweak, ...(wasImg ? {} : { fx: { ...FX_DEFAULT, detail: 30, contrast: 108, saturate: 105, vignette: 28 } }) },
        light ? (l) => (l.bg || l.logo || l.brand || l.panel ? l : { ...l, color: '#ffffff', shadow: true }) : null)
      if (!ok) setAiErr(t('Tras 3 intentos la imagen sigue con baja calidad ({r}). Puedes volver a pulsar el botón.', { r: lastWhy.join(', ') }))
    } catch (e) { setAiErr(e.message || String(e)) }
    setAiBusy(false)
  }
  // Escribe todos los textos activos (los que existen ahora mismo, sean 3 o más) con IA
  const aiTexts = async () => {
    if (txtBusy || !design.layers.length) return
    if (!lim.aiText) return openPlans(t('Los textos con IA están disponibles desde el plan PRO.'))
    if (aiTextUsed(session?.id) >= lim.aiTextPerDay) return openPlans(t('Llegaste al límite de {n} textos con IA de hoy.', { n: lim.aiTextPerDay }))
    setTxtBusy(true); setTxtErr('')
    try {
      const layers = design.layers
      const written = layers.filter((l) => !isShape(l) && l.text.trim()) // el logo y los rectángulos no llevan texto
      const texts = await generateLayerTextsAI({ layers: written, topic: txtTopic.trim() })
      aiTextBump(session?.id)
      const byId = new Map(written.map((l, i) => [l.id, texts[i]]))
      setDesign({ ...design, layers: layers.map((l) => (byId.get(l.id) ? { ...l, text: byId.get(l.id) } : l)) })
    } catch (e) { setTxtErr(e.message || String(e)) }
    setTxtBusy(false)
  }
  const download = async () => {
    const url = await renderToDataURL(design, 'image/png', 1, 1080)
    const a = document.createElement('a')
    a.href = url; a.download = `global-zion-${design.format}.png`; a.click()
  }

  const body = (
    <div className={'editor' + (cine ? ' cine' : '') + (cine && cineLight ? ' cine-light' : '')}>
      {cine && <div className="cine-bar"><b>🎬 {t('Modo cine')}</b><span className="hint">{t('Los cambios se ven en vivo · Esc para salir')}</span><CineThemeSwitch light={cineLight} onToggle={toggleCineTheme} /><button className="btn sm" onClick={() => setCine(false)}>✕ {t('Salir')}</button></div>}
      <div className="stage">
        <div className="stage-bar">
          <button className="btn ghost sm" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))} title="Zoom -">−</button>
          <button className="btn ghost sm zoom-val" onClick={() => setZoom(1)} title={t('Ajustar')}>{Math.round(zoom * 100)}%</button>
          <button className="btn ghost sm" onClick={() => setZoom((z) => Math.min(2, +(z + 0.25).toFixed(2)))} title="Zoom +">+</button>
          <button className={'btn ghost sm' + (guides ? ' active' : '')} onClick={() => setGuides(!guides)} title={t('Guías')}>▦</button>
          <button className="btn ghost sm" onClick={() => setFull(true)} title={t('Pantalla completa')}>⛶</button>
          <button className={'btn ghost sm cine-btn' + (cine ? ' active' : '')} onClick={() => setCine((c) => !c)} title={t('Modo cine')} aria-pressed={cine}>🎬</button>
        </div>
        {fmts.length > 1 && (
          <div className="fmt-nav" role="group" aria-label={t('Formatos a publicar')}>
            <button className="btn ghost sm" onClick={() => goFormat(-1)} aria-label={t('Formato anterior')}>‹</button>
            <div className="fmt-dots">
              {fmts.map((id) => <button key={id} className={'fmt-dot' + (id === design.format ? ' on' : '')} onClick={() => patch({ format: id })}>{getFormat(id).short}</button>)}
            </div>
            <button className="btn ghost sm" onClick={() => goFormat(1)} aria-label={t('Formato siguiente')}>›</button>
          </div>
        )}
        <div className="canvas-scroll">
          <div className="canvas-wrap" ref={wrapRef} tabIndex={0} onKeyDown={key} style={{ aspectRatio: `${fmt.w}/${fmt.h}`, width: `${zoom * 100}%`, maxHeight: zoom === 1 ? '74vh' : 'none' }}>
            <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} />
          </div>
        </div>
        <p className="hint">{t('Arrastra los textos sobre la imagen para moverlos')} · {t('Haz clic y escribe para editar · Supr elimina · Ctrl+C / Ctrl+V copia y pega')}{mode === 'adv' ? ' · ' + t('↻ gira, ⤡ cambia el tamaño') : ''} · {fmt.w}×{fmt.h}px</p>
        <button className="btn ghost sm" onClick={download}><Icon name="down" size={15} /> {t('Descargar PNG')}</button>
      </div>

      <div className="tools">
        <div className="seg full mode-seg" data-mode={mode}>
          <button className={mode === 'basic' ? 'on' : ''} onClick={() => setMode('basic')}>{t('Básico')}</button>
          <button className={mode === 'adv' ? 'on' : ''} onClick={() => setMode('adv')}>{t('Avanzado')}</button>
        </div>
        <section>
          <h4>📐 {t('Formato')}</h4>
          <div className="chips" role="group" aria-label={t('Formato')}>
            {FORMATS.map((f) => (
              <button key={f.id} aria-pressed={fmts.includes(f.id)} className={'chip' + (fmts.includes(f.id) ? ' on' : '') + (f.id === design.format ? ' cur' : '')} onClick={() => toggleFormat(f.id)}>{fmts.includes(f.id) ? '✓ ' : ''}{t(f.label)}</button>
            ))}
          </div>
          <p className="hint" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>{t('Marca varios formatos para publicarlos a la vez (Instagram: un post y una story).')}</p>
        </section>

        <section>
          <h4>🧩 {t('Plantillas')}</h4>
          <TemplateChips onPick={applyTemplate} limit={lim.templates} onLocked={() => openPlans(t('Tu plan {a} incluye {n} plantillas. Todas las plantillas están en el plan Premium.', { a: access.plan.name, n: lim.templates }))} />
        </section>

        <section>
          <h4>🖼️ {t('Fondo')}</h4>
          <div className="seg full">
            {[['gradient', 'Degradado'], ['solid', 'Color'], ['image', 'Imagen']].map(([v, l]) => (
              <button key={v} className={design.bg.type === v ? 'on' : ''} onClick={() => patchBg({ type: v })}>{t(l)}</button>
            ))}
          </div>
          <div className={'collapse' + (mode === 'adv' ? ' open' : '')} aria-hidden={mode !== 'adv'}><div className="collapse-in">
            <div className="regen">
              <label className="inl">{t('Prompt memorizado')}
                <textarea rows={2} value={aiIdea} maxLength={1000} onChange={(e) => setAiIdea(e.target.value)} placeholder={t('Aún no hay prompt: se usará el tema de tu publicación')} />
              </label>
              <label className="inl">{t('Indicaciones para mejorar la imagen')}
                <textarea rows={2} value={aiTweak} maxLength={300} onChange={(e) => setAiTweak(e.target.value)} placeholder={t('Ej: más luz, más nítida, estilo oficina moderna, sin personas…')} />
              </label>
              <button className="btn primary sm" disabled={aiBusy} onClick={aiRegen}>🔄 {aiBusy ? t('Generando…') : t('Regenerar imagen')}</button>
              {design.bg.image && <span className="hint">{t('Se usa la imagen actual como referencia cuando el generador lo permite.')}</span>}
              {aiErr && <span className="hint" style={{ color: 'var(--danger, #ff5d73)' }}>{aiErr}</span>}
            </div>
          </div></div>
          {design.bg.type !== 'image' && (
            <div className="bg-presets" role="group" aria-label={t('Estilos de fondo')}>
              {BG_PRESETS.map((p) => (
                <button key={p.id} type="button" title={t(p.name)} aria-label={t(p.name)}
                  style={{ background: `linear-gradient(${p.angle}deg, ${p.c1}, ${p.c2}${p.c3 ? ', ' + p.c3 : ''})` }}
                  onClick={() => patchBg({ type: 'gradient', c1: p.c1, c2: p.c2, c3: p.c3, angle: p.angle })} />
              ))}
            </div>
          )}
          {design.bg.type !== 'image' && (
            <div className="row">
              <label className="inl sw">{t('Color 1')}<input type="color" value={design.bg.c1} onChange={(e) => patchBg({ c1: e.target.value })} /></label>
              {design.bg.type === 'gradient' && <>
                <label className="inl sw">{t('Color 2')}<input type="color" value={design.bg.c2} onChange={(e) => patchBg({ c2: e.target.value })} /></label>
                <label className="inl grow">{t('Ángulo')}<input type="range" min="0" max="360" value={design.bg.angle} onChange={(e) => patchBg({ angle: +e.target.value })} /></label>
              </>}
            </div>
          )}
          {design.bg.type === 'image' && (upImage || aiImage) && (
            <div className="seg full">
              {upImage && <button className={design.bg.image === upImage.image ? 'on' : ''} onClick={() => patchBg({ image: upImage.image, dim: upImage.dim })}>{t('Imagen subida')}</button>}
              {aiImage && <button className={design.bg.image === aiImage.image ? 'on' : ''} onClick={() => patchBg({ image: aiImage.image, dim: aiImage.dim })}>{t('Imagen generada con IA')}</button>}
            </div>
          )}
          {design.bg.type === 'image' && (
            <div className="row">
              <label className="btn ghost sm file"><Icon name="up" size={15} /> {design.bg.image ? t('Cambiar imagen') : t('Subir imagen')}<input type="file" accept="image/*" hidden onChange={upload} /></label>
              {upImage && <button className="btn ghost sm" onClick={removeUpload}>{t('Eliminar imagen cargada')}</button>}
              <label className="inl grow">{t('Oscurecer')}<input type="range" min="0" max="0.85" step="0.05" value={design.bg.dim} onChange={(e) => patchBg({ dim: +e.target.value })} /></label>
            </div>
          )}
          {design.bg.type === 'image' && design.bg.image && (() => {
            const fx = { ...FX_DEFAULT, ...(design.bg.fx || {}) }
            const setFx = (k, v) => patchBg({ fx: { ...fx, [k]: v } })
            const dirty = Object.keys(FX_DEFAULT).some((k) => fx[k] !== FX_DEFAULT[k])
            const sliders = [
              ['brightness', 'Brillo', 40, 180, 1], ['contrast', 'Contraste', 40, 180, 1], ['detail', 'Detalle', 0, 100, 1],
              ['saturate', 'Saturación', 0, 200, 1], ['warmth', 'Temperatura', -100, 100, 1],
              ['hue', 'Tono', -180, 180, 1], ['sepia', 'Sepia', 0, 100, 1],
              ['gray', 'Blanco y negro', 0, 100, 1], ['blur', 'Desenfoque', 0, 30, 1],
              ['vignette', 'Viñeta', 0, 100, 1],
            ]
            return (
              <div className={'collapse' + (mode === 'adv' ? ' open' : '')} aria-hidden={mode !== 'adv'}><div className="collapse-in"><div className="fx">
                <button className="btn primary ws-open ws-open-full" onClick={() => (lim.workshop ? setShop(true) : openPlans(t('El taller de imagen (recortar y borrar) está disponible desde el plan PRO.')))}>✂️ {t('Recortar / editar / quitar fondo')}{!lim.workshop && <LockTag plan="PRO" />}</button>
                <div className="bg-adv">
                  <div className="bg-adv-colors">
                    <label className="bg-sw">{t('Color de fondo')}<input type="color" value={design.bg.c1} onChange={(e) => patchBg({ c1: e.target.value })} /></label>
                    {design.bg.type !== 'solid' && <>
                      <label className="bg-sw">{t('Color 2')}<input type="color" value={design.bg.c2} onChange={(e) => patchBg({ c2: e.target.value })} /></label>
                      <div className="bg-sw">
                        <span className="bg-chk"><input type="checkbox" id="bg3" checked={!!design.bg.c3} onChange={(e) => patchBg({ c3: e.target.checked ? (design.bg.c3 || design.bg.c1) : '' })} /><label htmlFor="bg3">{t('Color 3')}</label></span>
                        <input type="color" disabled={!design.bg.c3} value={design.bg.c3 || '#000000'} onChange={(e) => patchBg({ c3: e.target.value })} />
                      </div>
                    </>}
                  </div>
                  {design.bg.type !== 'solid' && (
                    <label className="inl bg-angle"><span>{t('Inclinación')} <b>{design.bg.angle}°</b></span><input type="range" min="0" max="360" value={design.bg.angle} onChange={(e) => patchBg({ angle: +e.target.value })} /></label>
                  )}
                </div>
                <h4 style={{ margin: '10px 0 4px' }}>🎚️ {t('Ajustes de imagen')}
                  {dirty && <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => patchBg({ fx: { ...FX_DEFAULT } })}>{t('Restablecer')}</button>}
                </h4>
                {sliders.map(([key, label, min, max, step]) => (
                  <label key={key} className="inl grow" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '4px 0' }}>
                    <span style={{ minWidth: 104 }}>{t(label)}</span>
                    <input type="range" style={{ flex: 1, minWidth: 0 }} min={min} max={max} step={step} value={fx[key]} onChange={(e) => setFx(key, +e.target.value)} onDoubleClick={() => setFx(key, FX_DEFAULT[key])} />
                    <span style={{ minWidth: 30, textAlign: 'right', opacity: 0.7 }}>{fx[key]}</span>
                  </label>
                ))}
              </div></div></div>
            )
          })()}
          <label className="check"><input type="checkbox" checked={!!design.accent?.show} onChange={(e) => patch({ accent: { ...design.accent, show: e.target.checked } })} /> {t('Marco decorativo')}
            <input type="color" value={design.accent?.color || '#ffffff'} onChange={(e) => patch({ accent: { ...design.accent, color: e.target.value } })} />
          </label>
        </section>

        <section>
          <h4>✨ {t('Imagen con IA')}</h4>
          <textarea rows={2} value={aiPrompt} maxLength={1000} onChange={(e) => setAiPrompt(e.target.value)}
            placeholder={t('Describe la imagen que quieres generar…')} />
          <div className="row">
            <button className="btn sm" disabled={aiBusy || !aiPrompt.trim()} onClick={aiGenerate}>
              {aiBusy ? t('Generando…') : t('Generar')}{!lim.aiImage && <LockTag plan="PREMIUM" />}
            </button>
          </div>
          {aiErr && <p className="hint" style={{ color: 'var(--danger, #ff5d73)' }}>{aiErr}</p>}
        </section>

        <div className={'collapse' + (mode === 'adv' ? ' open' : '')} aria-hidden={mode !== 'adv'}><div className="collapse-in">
          <section>
            <h4>😀 {t('Stickers')}{!lim.stickers && <LockTag plan="PRO" />}</h4>
            {lim.stickers ? <Stickers onAdd={addSticker} /> : <button className="btn ghost sm" onClick={() => openPlans(t('Los stickers están disponibles desde el plan PRO.'))}>🔒 {t('Desbloquear stickers')}</button>}
          </section>
        </div></div>

        <section>
          <h4>📝 {t('Textos')} <button className="btn ghost sm" onClick={addLayer}><Icon name="plus" size={14} /> {t('Añadir')}</button></h4>
          <div className="ai-texts">
            <input type="text" value={txtTopic} maxLength={300} onChange={(e) => setTxtTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && aiTexts()} placeholder={t('Tema o idea (opcional)')} />
            <button className="btn sm" disabled={txtBusy || !design.layers.length} onClick={aiTexts}>
              <Icon name="magic" size={14} /> {txtBusy ? t('Generando…') : t('Escribir textos con IA')}{!lim.aiText && <LockTag plan="PRO" />}
            </button>
          </div>
          {txtErr && <p className="hint" style={{ color: 'var(--danger, #ff5d73)' }}>{txtErr}</p>}
          <div className="chips">
            {design.layers.map((l, i) => (
              <button key={l.id} className={'chip' + (l.id === sel ? ' on' : '')} onClick={() => setSel(l.id)}>
                {i + 1}. {l.logo || l.brand ? 'Logo' : l.box ? t('Rectángulo') : l.text.replace(/\n/g, ' ').slice(0, 14) || t('(vacío)')}
              </button>
            ))}
          </div>
          {layer && (
            <div className="layer-ed">
              {!isShape(layer) && <>
              <textarea ref={layerTxt} rows={2} value={layer.text} onChange={(e) => { patchLayer({ text: e.target.value }); setCaretPos(e.target.selectionStart) }}
                onFocus={(e) => { setEditing(true); setCaretPos(e.target.selectionStart) }} onBlur={() => setEditing(false)}
                onSelect={(e) => setCaretPos(e.target.selectionStart)} onKeyUp={(e) => setCaretPos(e.target.selectionStart)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') { e.preventDefault(); wrapRef.current?.focus({ preventScroll: true }) }
                  else if (e.key === 'Delete' && !layer.text) { e.preventDefault(); delLayer(); wrapRef.current?.focus({ preventScroll: true }) }
                }} />
              <div className="emoji-row"><EmojiButton inputRef={layerTxt} value={layer.text} onChange={(text) => patchLayer({ text })} label /></div>
              <div className="row fonts">
                <FontPicker value={layer.font} onChange={(font) => patchLayer({ font })} />
                <select value={layer.weight} onChange={(e) => patchLayer({ weight: +e.target.value })}>
                  <option value={400}>{t('Normal')}</option><option value={600}>{t('Seminegrita')}</option><option value={800}>{t('Negrita')}</option><option value={900}>{t('Extra')}</option>
                </select>
                <input type="color" value={layer.color} onChange={(e) => patchLayer({ color: e.target.value })} />
              </div>
              </>}
              {layer.box && <label className="check">{t('Color')} <input type="color" value={(layer.bg || '#ffffff').slice(0, 7)} onChange={(e) => patchLayer({ bg: e.target.value + (layer.bg || '').slice(7) })} /></label>}
              {layer.brand && <>
                <label className="inl"><span className="lbl">{t('Versión del logo')}</span>
                  <select value={layer.brand} onChange={(e) => patchLayer({ brand: e.target.value })} style={{ width: 'auto' }}>
                    <option value="light">{t('Clara')}</option>
                    <option value="dark">{t('Oscura')}</option>
                  </select>
                </label>
                <label className="check"><input type="checkbox" checked={!!layer.plate} onChange={(e) => patchLayer({ plate: e.target.checked })} /> {t('Con placa de fondo')}</label>
              </>}
              {layer.logo && <label className="inl"><span className="lbl">{t('Fondo del logo')}</span>
                <select value={layer.badge || ''} onChange={(e) => patchLayer({ badge: e.target.value })} style={{ width: 'auto' }}>
                  <option value="tile">{t('Blanco')}</option><option value="ring">{t('Aro de colores')}</option><option value="">{t('Sin fondo')}</option>
                </select>
              </label>}
              <label className="inl"><span className="lbl">{t('Tamaño')} <b>{layer.size}</b></span><input type="range" min="20" max={layer.logo || layer.brand ? 1000 : 400} value={layer.size} onChange={(e) => patch({ layers: design.layers.map((l) => (l.id === sel ? resized(l, +e.target.value) : l)) })} /></label>
              <div className="row">
                <label className="inl grow">X<input type="range" min="0" max="1" step="0.01" value={layer.x} onChange={(e) => patchLayer({ x: +e.target.value })} /></label>
                <label className="inl grow">Y<input type="range" min="0" max="1" step="0.01" value={layer.y} onChange={(e) => patchLayer({ y: +e.target.value })} /></label>
              </div>
              <div className={'collapse' + (mode === 'adv' ? ' open' : '')} aria-hidden={mode !== 'adv'}><div className="collapse-in">
                {!isShape(layer) && <div className="row" style={{ alignItems: 'center', margin: '4px 0' }}>
                  <label className="check"><input type="checkbox" checked={!!layer.bg} onChange={(e) => patchLayer({ bg: e.target.checked ? (layer.bg || '#ef4444') : '', shape: layer.shape || 'pill' })} /> {t('Fondo del texto')}</label>
                  {layer.bg && <>
                    <input type="color" value={layer.bg} onChange={(e) => patchLayer({ bg: e.target.value })} />
                    <select value={layer.shape || 'pill'} onChange={(e) => patchLayer({ shape: e.target.value })} style={{ width: 'auto' }}>
                      {[['pill', 'Píldora'], ['rect', 'Rectángulo'], ['circle', 'Círculo'], ['ring', 'Anillo'], ['burst', 'Sello'], ['star', 'Estrella']].map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
                    </select>
                  </>}
                </div>}
                {layer.progress != null && (
                  <div className="row" style={{ alignItems: 'center', margin: '4px 0' }}>
                    <label className="inl grow"><span className="lbl">{t('Progreso')} <b>{layer.progress}%</b></span><input type="range" min="0" max="100" value={layer.progress} onChange={(e) => patchLayer({ progress: +e.target.value, text: layer.text.replace(/\d+(?=%)/, e.target.value) })} /></label>
                    <input type="color" value={layer.fill || '#38bdf8'} title={t('Color de relleno')} onChange={(e) => patchLayer({ fill: e.target.value })} />
                  </div>
                )}
                <label className="inl"><span className="lbl">{t('Opacidad')} <b>{Math.round((layer.opacity ?? 1) * 100)}%</b></span><input type="range" min="5" max="100" value={Math.round((layer.opacity ?? 1) * 100)} onChange={(e) => patchLayer({ opacity: +e.target.value / 100 })} onDoubleClick={() => patchLayer({ opacity: 1 })} /></label>
                <label className="inl"><span className="lbl">{t('Rotación')} <b>{layer.rot || 0}°</b></span><input type="range" min="-180" max="180" value={layer.rot || 0} onChange={(e) => patchLayer({ rot: +e.target.value })} onDoubleClick={() => patchLayer({ rot: 0 })} /></label>
              </div></div>
              <div className="row toolbar">
                {!isShape(layer) && <>
                <div className="seg">
                  {['left', 'center', 'right'].map((a) => <button key={a} className={layer.align === a ? 'on' : ''} onClick={() => patchLayer({ align: a })}>{{ left: '⇤', center: '↔', right: '⇥' }[a]}</button>)}
                </div>
                <label className="check"><input type="checkbox" checked={layer.shadow} onChange={(e) => patchLayer({ shadow: e.target.checked })} /> {t('Sombra')}</label>
                <label className="check"><input type="checkbox" checked={layer.upper} onChange={(e) => patchLayer({ upper: e.target.checked })} /> {t('MAYÚS')}</label>
                </>}
                <button className="btn danger sm" onClick={delLayer}><Icon name="trash" size={14} /></button>
              </div>
            </div>
          )}
        </section>
      </div>
      {shop && design.bg.image && <ImageWorkshop canRemoveBg={lim.removeBg} canUpscale={lim.upscale} onLocked={(m) => openPlans(m)} image={design.bg.image} ratioHint={fmt.w / fmt.h} onApply={applyWorkshop} onClose={() => setShop(false)} />}
      {full && <FullPreview design={design} onClose={() => setFull(false)} />}
    </div>
  )
  return cine ? createPortal(body, document.body) : body
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

// Plantillas: muestra 2 filas y, si hay más, el botón «Ver más / Ver menos»
function TemplateChips({ onPick, limit = Infinity, onLocked }) {
  useLang()
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  const [more, setMore] = useState(false)
  const [h2, setH2] = useState(0)
  useEffect(() => {
    const calc = () => {
      const el = ref.current
      if (!el || !el.firstElementChild) return
      const kids = [...el.children]
      const top0 = kids[0].offsetTop
      const rowTops = [...new Set(kids.map((k) => k.offsetTop - top0))].sort((a, b) => a - b)
      const rows = rowTops.length
      const bottom2 = rows > 2 ? rowTops[2] - 8 : el.scrollHeight
      setMore(rows > 2)
      setH2(bottom2)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])
  return (
    <>
      <div className="chips tpl-chips" ref={ref} style={!open && more ? { maxHeight: h2 + 4, overflow: 'hidden' } : undefined}>
        {TEMPLATES.map((tpl, i) => i < limit
          ? <button key={tpl.id} className="chip" onClick={() => onPick(tpl)}>{t(tpl.name)}</button>
          : <button key={tpl.id} className="chip locked" onClick={onLocked}>🔒 {t(tpl.name)}</button>)}
      </div>
      {more && <button className="btn ghost sm tpl-more" onClick={() => setOpen((o) => !o)}>{open ? t('Ver menos') : t('Ver más')} ({TEMPLATES.length})</button>}
    </>
  )
}
