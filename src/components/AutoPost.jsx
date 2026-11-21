import { useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { PLATFORMS } from '../lib/formats.js'
import { renderToDataURL } from '../lib/render.js'
import { generateAutoPost, photoVariant, toolsVariant, makePalette } from '../lib/autoPost.js'
import { t, useLang } from '../lib/i18n.jsx'

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

export default function AutoPost({ onClose, onGenerated }) {
  const { accounts, notify } = useApp()
  useLang()
  const [text, setText] = useState('')
  const [withImage, setWithImage] = useState(true)
  const [step, setStep] = useState('')
  const [busy, setBusy] = useState(false)
  const [snap, setSnap] = useState(null) // resultado con dos opciones para elegir
  const [histA, setHistA] = useState([]) // versiones con imagen de IA: { id, design, url }
  const [selA, setSelA] = useState(-1)
  const [failA, setFailA] = useState(null) // motivos si el último intento no aprobó
  const [histB, setHistB] = useState([]) // plantillas con las herramientas: { id, design, url, hue }
  const [selB, setSelB] = useState(0)
  const [retry, setRetry] = useState(false)
  const [busyB, setBusyB] = useState(false)
  const connected = Object.keys(accounts).filter((id) => PLATFORMS[id])

  const run = async () => {
    if (busy) return
    setBusy(true)
    try {
      const r = await generateAutoPost({ text, platforms: connected.slice(0, 2), withImage, onStep: setStep })
      if (!r.options) { onGenerated(r); return } // sin imagen de IA: no hay nada que comparar
      setStep(t('Preparando las opciones…'))
      const b0 = { id: 1, design: r.design, url: await preview(r.design), hue: r.options.info?.hue }
      const a0 = r.options.photo ? { id: 1, design: r.options.photo, url: await preview(r.options.photo) } : null
      setHistB([b0]); setSelB(0)
      setHistA(a0 ? [a0] : []); setSelA(a0 ? 0 : -1); setFailA(a0 ? null : r.options.why)
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
        const it = { id: Date.now(), design: r.design, url: await preview(r.design) }
        setSelA(histA.length)
        setHistA((h) => [...h, it])
        setFailA(null)
      } else setFailA(r.why)
    } finally { setRetry(false) }
  }
  const reTools = async () => {
    if (busyB || !snap?.options?.info) return
    setBusyB(true)
    try {
      const r = toolsVariant({ ...snap.options.info, hue: histB[selB]?.hue ?? snap.options.info.hue })
      const it = { id: Date.now(), design: r.design, url: await preview(r.design), hue: r.hue }
      setSelB(histB.length)
      setHistB((h) => [...h, it])
    } finally { setBusyB(false) }
  }
  const choose = (design) => { const { options, ...rest } = snap; onGenerated({ ...rest, design }) }

  if (snap) {
    const curA = failA ? null : histA[selA]
    const curB = histB[selB]
    const why = failA?.length ? failA.join(', ') : t('sin detalle')
    return (
      <div className="modal-bg" onClick={onClose}>
        <div className="modal auto-post auto-pick" onClick={(e) => e.stopPropagation()}>
          <h3>✨ {t('Elige el fondo')}</h3>
          <p className="hint">{t('Escoge una de las 2 opciones y seguirás trabajando con esa.')}</p>
          <div className="pick-grid">
            <div className={'pick-card' + (curA ? '' : ' off')}>
              <span className="pick-tag">A · {t('Fondo con imagen de IA')}</span>
              <div className="pick-img">
                {retry ? <span className="ws-spin" style={SPIN} />
                  : curA ? <img src={curA.url} alt="" />
                  : <p className="hint">{t('No se obtuvo una imagen de buena calidad ({r}).', { r: why })}</p>}
              </div>
              {curA && <button className="btn primary" disabled={retry} onClick={() => choose(curA.design)}>{t('Usar esta')}</button>}
              <button className={'btn' + (curA ? ' ghost sm' : '')} disabled={retry} onClick={tryAgain}>🔄 {t('Probar otra imagen')}</button>
              <History items={histA} sel={failA ? -1 : selA} disabled={retry} onSel={(i) => { setSelA(i); setFailA(null) }} />
            </div>
            <div className="pick-card">
              <span className="pick-tag">B · {t('Fondo con las herramientas de la app')}</span>
              <div className="pick-img">{curB && !busyB ? <img src={curB.url} alt="" /> : <span className="ws-spin" style={SPIN} />}</div>
              <button className="btn primary" disabled={busyB} onClick={() => choose(curB.design)}>{t('Usar esta')}</button>
              <button className="btn ghost sm" disabled={busyB} onClick={reTools}>🔄 {t('Generar otra plantilla')}</button>
              <History items={histB} sel={selB} disabled={busyB} onSel={setSelB} />
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
        <p className="hint">{t('Escribe una idea (o déjalo vacío) y se generará todo sobre creación de páginas web con los colores y la info de Global Zion.')}</p>
        <textarea rows={3} autoFocus disabled={busy} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={t('Ej: Invítalos a entrar a www.globalzion.cl (opcional)')} />
        <label className="inl" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={withImage} disabled={busy} onChange={(e) => setWithImage(e.target.checked)} />
          {t('Comparar también con un fondo de imagen de IA')}
        </label>
        {busy && <div className="auto-step"><span className="ws-spin" style={{ borderColor: 'var(--line)', borderTopColor: 'var(--violet, #7c3aed)' }} /> {step}</div>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" disabled={busy} onClick={onClose}>{t('Cancelar')}</button>
          <button className="btn primary" disabled={busy} onClick={run}>✨ {text.trim() ? t('Generar publicación') : t('Sorpréndeme')}</button>
        </div>
      </div>
    </div>
  )
}
