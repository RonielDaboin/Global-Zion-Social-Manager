import { useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { PLATFORMS } from '../lib/formats.js'
import { renderToDataURL } from '../lib/render.js'
import { generateAutoPost, photoVariant, webPhotoVariant, toolsVariant, makePalette, retext, restyle } from '../lib/autoPost.js'
import { LAYOUTS, DECOS } from '../lib/designs.js'
import { searchWebPhotos, loadWebPhoto } from '../lib/webImages.js'
import { refinePostAI } from '../lib/social.js'
import { aiTextUsed, aiTextBump } from '../lib/plans.js'
import { t, useLang } from '../lib/i18n.jsx'
import PostChat from './PostChat.jsx'

const SPIN = { borderColor: 'var(--line)', borderTopColor: 'var(--violet, #7c3aed)' }
const preview = (design) => renderToDataURL(design, 'image/jpeg', 0.85, 560)

/** Tira con las versiones anteriores: tocar una la vuelve a poner como la actual. */
function History({ items, sel, onSel, disabled }) {
  if (items.length < 2) return null
  return (
    <div className="pick-hist">
      <span className="hint">{t('Anteriores')}</span>
      <div className="pick-hist-row">
        {items.map((it, i) => (
          <button key={it.id} type="button" disabled={disabled} className={'pick-th' + (i === sel ? ' on' : '')} onClick={() => onSel(i)} title={t('Volver a esta') + ' (' + (i + 1) + ')'}>
            <img src={it.url} alt="" />
            <b>{i + 1}</b>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Cambios rápidos sin IA sobre la versión que se está viendo: formato y versión del logo. */
function Tools({ design, disabled, onChange }) {
  return (
    <div className="pick-tools">
      <label>
        <span>{t('Formato')} ({LAYOUTS.length})</span>
        <select value={design.auto.layout} disabled={disabled} onChange={(e) => onChange({ layout: e.target.value })}>
          {LAYOUTS.map((l) => <option key={l.id} value={l.id}>{t(l.name)}</option>)}
        </select>
      </label>
      <button type="button" className="btn ghost sm" disabled={disabled} onClick={() => onChange({ logo: design.auto.logo === 'dark' ? 'light' : 'dark' })}>
        🌓 {design.auto.logo === 'dark' ? t('Logo claro') : t('Logo oscuro')}
      </button>
    </div>
  )
}

export default function AutoPost({ onClose, onGenerated }) {
  const { accounts, notify, session, access } = useApp()
  useLang()
  const [text, setText] = useState('')
  const [withImage, setWithImage] = useState(true)
  const [step, setStep] = useState('')
  const [busy, setBusy] = useState(false)
  const [snap, setSnap] = useState(null) // resultado con dos opciones para elegir
  const [histA, setHistA] = useState([]) // versiones con imagen de IA: { id, design, url }
  const [selA, setSelA] = useState(-1)
  const [failA, setFailA] = useState(null) // motivos si el último intento no aprobó
  const [histB, setHistB] = useState([]) // plantillas con las herramientas: { id, design, url }
  const [selB, setSelB] = useState(0)
  const [retry, setRetry] = useState(false)
  const [busyB, setBusyB] = useState(false)
  const [busyChat, setBusyChat] = useState(false)
  const [target, setTarget] = useState('b') // opción sobre la que el chat hace los cambios de diseño
  const connected = Object.keys(accounts).filter((id) => PLATFORMS[id])

  const run = async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await generateAutoPost({ text, platforms: connected.slice(0, 2), withImage, onStep: setStep })
      setStep(t('Preparando las opciones…'))
      const b0 = { id: 1, design: r.design, url: await preview(r.design) }
      const a0 = r.options.photo ? { id: 1, design: r.options.photo, url: await preview(r.options.photo) } : null
      setHistB([b0]); setSelB(0)
      setHistA(a0 ? [a0] : []); setSelA(a0 ? 0 : -1); setFailA(r.options.why); setTarget('b')
      setSnap(r)
      setBusy(false)
    } catch (e) {
      notify(e?.message || String(e), 'err')
      setBusy(false)
    }
  }

  const tryAgain = async () => {
    if (retry || !snap?.options) return
    setRetry(true)
    try {
      const o = snap.options
      // cada nuevo intento prueba otros colores
      const prompt = o.prompt.replace(/Color palette: .*?, well lit/, () => `Color palette: ${makePalette({ dark: true, avoid: o.info?.hue }).ai}, well lit`)
      const r = await photoVariant(o.base, { prompt, context: o.context, info: o.info })
      if (r.design) {
        await push('a', r.design)
      } else setFailA(r.why)
    } finally { setRetry(false) }
  }
  const reTools = async () => {
    if (busyB || !snap?.options?.info) return
    setBusyB(true)
    try {
      const r = toolsVariant({ ...snap.options.info, hue: histB[selB]?.design.auto.palette.hue ?? snap.options.info.hue })
      await push('b', r.design)
    } finally { setBusyB(false) }
  }
  const hasA = !failA && !!histA[selA]
  const side = target === 'a' && hasA ? 'a' : 'b'

  // Agrega una versión nueva a una opción (las anteriores quedan en la tira para volver atrás)
  const push = async (to, design, lists = { a: histA, b: histB }) => {
    const item = { id: Date.now(), design, url: await preview(design) }
    const next = [...lists[to], item]
    lists[to] = next
    if (to === 'a') { setHistA(next); setSelA(next.length - 1); setFailA(null) } else { setHistB(next); setSelB(next.length - 1) }
    setTarget(to)
    return item
  }
  const tweak = async (to, change) => {
    const cur = to === 'a' ? histA[selA] : histB[selB]
    if (!cur || busyChat) return
    setBusyChat(true)
    try { await push(to, restyle(cur.design, snap.options.info, change)) } finally { setBusyChat(false) }
  }

  const findPhotos = async (query) => {
    setBusyChat(true)
    try {
      const photos = await searchWebPhotos(query)
      return { text: photos.length ? t('Esto encontré en la web para «{q}»:', { q: query }) : t('No encontré fotos para «{q}». Prueba con otras palabras (en inglés hay más).', { q: query }), photos }
    } finally { setBusyChat(false) }
  }
  const usePhoto = async (photo) => {
    setBusyChat(true)
    try {
      const o = snap.options
      const design = await webPhotoVariant(o.base, { image: await loadWebPhoto(photo.url), info: o.info })
      const item = await push('a', design)
      return { text: t('Puse la foto de fondo en la opción A.'), preview: item.url }
    } finally { setBusyChat(false) }
  }

  // Chat de trabajo: los textos se actualizan en todas las versiones; el diseño y el fondo, en la opción elegida
  const chat = async (message, history, image) => {
    const limit = access.limits.aiTextPerDay
    if (aiTextUsed(session?.id) >= limit) throw new Error(t('Llegaste al límite de {n} textos con IA de hoy.', { n: limit }))
    setBusyChat(true)
    try {
      const o = snap.options
      const maxLen = Math.min(...snap.platforms.map((p) => PLATFORMS[p].limit))
      const { kicker, title, points, link } = o.info
      const cur = side === 'a' ? histA[selA] : histB[selB]
      const { auto, bg } = cur.design
      const r = await refinePostAI({
        message, history, image, kicker, title, points, link, caption: snap.caption, maxLen,
        design: { layout: auto.layout, mode: auto.palette.dark ? 'dark' : 'light', accent: auto.palette.accent, logo: auto.logo, deco: bg.deco?.type || 'none', photo: auto.photo },
        layouts: LAYOUTS.map(({ id, name, desc }) => ({ id, name, desc })),
        decos: DECOS,
      })
      aiTextBump(session?.id)

      const info = { ...o.info, kicker: r.kicker, title: r.title, points: r.points, link: r.link || link }
      const textChanged = JSON.stringify([info.kicker, info.title, info.points, info.link]) !== JSON.stringify([kicker, title, points, link])
      let lists = { a: histA, b: histB }
      let base = o.base
      let result = null
      if (textChanged) {
        const redo = (list) => Promise.all(list.map(async (it) => {
          const design = retext(it.design, info)
          return { ...it, design, url: await preview(design) }
        }))
        const [a, b] = await Promise.all([redo(histA), redo(histB)])
        lists = { a, b }
        base = retext(base, info)
        setHistA(a)
        setHistB(b)
        result = lists[side][side === 'a' ? selA : selB]
      }
      // Los próximos «Probar otra imagen» y «Probar otro diseño» parten ya con los textos corregidos
      setSnap({ ...snap, caption: r.caption, options: { ...o, info, base } })

      const change = {}
      for (const key of ['layout', 'mode', 'logo', 'deco']) if (r[key]) change[key] = r[key]
      if (r.hue >= 0) change.hue = r.hue
      if (r.photo === 'remove' && side === 'a') change.removePhoto = true
      if (Object.keys(change).length) {
        const from = lists[side][side === 'a' ? selA : selB]
        // Al quitar la foto, el resultado pasa a la opción sin foto
        result = await push(change.removePhoto ? 'b' : side, restyle(from.design, info, change), lists)
      }

      const reply = { text: r.reply || t('Listo, actualicé la publicación.'), suggestions: r.suggestions }
      try {
        if (r.photo === 'web') {
          reply.photos = await searchWebPhotos(r.photoQuery || 'modern office')
          if (!reply.photos.length) reply.text += '\n' + t('No encontré fotos para «{q}». Prueba con otras palabras (en inglés hay más).', { q: r.photoQuery })
        } else if (r.photo === 'ai' && r.photoQuery) {
          const prompt = `${r.photoQuery}. Premium corporate social media background, well lit, sharp details, modern and clean, empty space for text. Absolutely no text, letters, numbers, logos or watermarks. No people, faces or hands.`
          const made = await photoVariant(base, { prompt, context: o.context, info })
          if (made.design) result = await push('a', made.design, lists)
          else reply.text += '\n' + t('No se obtuvo una imagen de buena calidad ({r}).', { r: made.why.join(', ') || t('sin detalle') })
        }
      } catch (e) { reply.text += '\n' + (e?.message || String(e)) } // los demás cambios ya quedaron aplicados
      if (result) reply.preview = result.url
      return reply
    } finally { setBusyChat(false) }
  }
  const choose = (design) => { const { options, ...rest } = snap; onGenerated({ ...rest, design }) }

  if (snap) {
    const curA = failA ? null : histA[selA]
    const curB = histB[selB]
    const why = failA?.length ? failA.join(', ') : t('sin detalle')
    const working = retry || busyB || busyChat
    // Sin cierre al tocar fuera: aquí hay trabajo que se perdería
    return (
      <div className="modal-bg">
        <div className="modal auto-post auto-pick">
          <h3>✨ {t('Elige y ajusta tu publicación')}</h3>
          <p className="hint">{t('Trabaja con el asistente y, cuando te guste, pulsa «Usar esta».')}</p>
          <div className="pick-work">
            <div className="pick-grid">
              <div className={'pick-card' + (side === 'a' ? ' sel' : '')}>
                <span className="pick-tag">A · {t('Fondo con foto')}</span>
                <div className="pick-img">
                  {retry ? <><span className="ws-spin" style={SPIN} /><p className="hint">{t('Creando otra imagen, puede tardar hasta 1–2 minutos…')}</p></>
                    : curA ? <img src={curA.url} alt="" />
                    : <p className="hint">{failA ? t('No se obtuvo una imagen de buena calidad ({r}).', { r: why }) : t('Aún sin foto. Crea una con IA o pide fotos de la web al asistente.')}</p>}
                </div>
                {curA && <button className="btn primary" disabled={working} onClick={() => choose(curA.design)}>{t('Usar esta')}</button>}
                {curA && <Tools design={curA.design} disabled={working} onChange={(c) => tweak('a', c)} />}
                <button className={'btn' + (curA ? ' ghost sm' : '')} disabled={working} onClick={tryAgain}>🔄 {t(histA.length ? 'Probar otra imagen' : 'Crear imagen con IA')}</button>
                <History items={histA} sel={failA ? -1 : selA} disabled={working} onSel={(i) => { setSelA(i); setFailA(null); setTarget('a') }} />
              </div>
              <div className={'pick-card' + (side === 'b' ? ' sel' : '')}>
                <span className="pick-tag">B · {t('Fondo con las herramientas de la app')}</span>
                <div className="pick-img">{curB && !busyB ? <img src={curB.url} alt="" /> : <span className="ws-spin" style={SPIN} />}</div>
                <button className="btn primary" disabled={working} onClick={() => choose(curB.design)}>{t('Usar esta')}</button>
                {curB && <Tools design={curB.design} disabled={working} onChange={(c) => tweak('b', c)} />}
                <button className="btn ghost sm" disabled={working} onClick={reTools}>🔄 {t('Probar otro diseño')}</button>
                <History items={histB} sel={selB} disabled={working} onSel={(i) => { setSelB(i); setTarget('b') }} />
              </div>
            </div>
            <div className="pick-side">
              <div className="pick-target" role="group" aria-label={t('Cambios de diseño en')}>
                <span>{t('Cambios de diseño en')}</span>
                <button type="button" className={'chip' + (side === 'a' ? ' on' : '')} disabled={!hasA} onClick={() => setTarget('a')}>A</button>
                <button type="button" className={'chip' + (side === 'b' ? ' on' : '')} onClick={() => setTarget('b')}>B</button>
              </div>
              <PostChat caption={snap.caption} busy={busyChat} disabled={retry || busyB} onSend={chat} onSearch={findPhotos} onPhoto={usePhoto} />
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn ghost" onClick={onClose}>{t('Cancelar')}</button></div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-bg" onClick={() => !busy && onClose()}>
      <div className="modal auto-post" onClick={(e) => e.stopPropagation()}>
        <h3>✨ {t('Crear con IA')}</h3>
        <p className="hint">{t('Escribe una idea (herramientas, páginas web, ciberseguridad, optimización de equipos…) o déjalo vacío. Se genera con la info de www.globalzion.cl.')}</p>
        <textarea rows={3} autoFocus disabled={busy} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={t('Ej: Invítalos a entrar a www.globalzion.cl (opcional)')} />
        <label className="inl" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={withImage} disabled={busy} onChange={(e) => setWithImage(e.target.checked)} />
          {t('Comparar también con un fondo de imagen de IA')}
        </label>
        {busy && <div className="auto-step"><span className="ws-spin" style={{ borderColor: 'var(--line)', borderTopColor: 'var(--violet, #7c3aed)' }} /> {step}</div>}
        {busy && <p className="hint">{withImage ? t('Con imagen de IA puede tardar 1–2 minutos. No cierres esta ventana.') : t('Puede tardar unos segundos. No cierres esta ventana.')}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" disabled={busy} onClick={onClose}>{t('Cancelar')}</button>
          <button className="btn primary" disabled={busy} onClick={run}>✨ {text.trim() ? t('Generar publicación') : t('Sorpréndeme')}</button>
        </div>
      </div>
    </div>
  )
}
