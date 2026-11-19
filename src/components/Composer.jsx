import { useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { PLATFORMS, accountLabel, blankDesign, getFormat, uid } from '../lib/formats.js'
import { renderToDataURL } from '../lib/render.js'
import { generateCaption, suggestHashtags, TONE_LIST } from '../lib/social.js'
import { t, useLang } from '../lib/i18n.jsx'
import ImageEditor from './ImageEditor.jsx'
import { Icon, PlatformBadge } from './ui.jsx'

const toLocalInput = (ts) => {
  const d = new Date(ts - new Date().getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

export default function Composer({ onDone }) {
  const { draft, setDraft, savePost, publishNow, accounts, notify } = useApp()
  useLang()
  const [id] = useState(draft?.id || uid())
  const [design, setDesign] = useState(draft?.design || blankDesign())
  const [caption, setCaption] = useState(draft?.caption || '')
  const [platforms, setPlatforms] = useState(draft?.platforms || ['instagram'])
  const [subject, setSubject] = useState(draft?.subject || '')
  const [recipients, setRecipients] = useState(draft?.recipients || '')
  const [when, setWhen] = useState(draft?.scheduledAt ? toLocalInput(draft.scheduledAt) : toLocalInput(Date.now() + 3600e3))
  const [topic, setTopic] = useState('')
  const [tone, setTone] = useState('inspirador')
  const [busy, setBusy] = useState(false)

  const fmt = getFormat(design.format)
  const togglePlat = (p) => setPlatforms((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]))
  const maxLen = Math.min(...(platforms.length ? platforms : ['instagram']).map((p) => PLATFORMS[p].limit))
  const tags = (caption.match(/#[\p{L}\p{N}_]+/gu) || []).length
  const tagLimit = Math.min(...(platforms.length ? platforms : ['instagram']).map((p) => PLATFORMS[p].maxTags))
  const formatMismatch = platforms.filter((p) => !fmt.platforms.includes(p) && !(fmt.w === 1080 && fmt.h === 1920))

  const hasEmail = platforms.includes('email')
  const needsTo = hasEmail || platforms.some((p) => PLATFORMS[p].kind === 'phone')

  const build = async (status) => {
    const image = await renderToDataURL(design)
    return { id, caption, subject, recipients, platforms, format: design.format, design, image, status, scheduledAt: status === 'scheduled' ? new Date(when).getTime() : null, createdAt: draft?.createdAt || Date.now() }
  }

  const validate = (needPlatforms) => {
    if (caption.length > maxLen) { notify(t('El texto supera el límite de {n} caracteres', { n: maxLen }), 'err'); return false }
    if (needPlatforms && hasEmail && !subject.trim()) { notify(t('El correo necesita un asunto'), 'err'); return false }
    if (needPlatforms && needsTo && !recipients.trim()) { notify(t('Indica los destinatarios'), 'err'); return false }
    if (needPlatforms && !platforms.length) { notify(t('Selecciona al menos una red social'), 'err'); return false }
    return true
  }

  const run = async (status) => {
    if (!validate(status !== 'draft')) return
    if (status === 'scheduled' && new Date(when).getTime() <= Date.now()) return notify(t('Elige una fecha futura'), 'err')
    if (status !== 'draft') {
      const missing = platforms.filter((p) => !accounts[p])
      if (missing.length) return notify(t('Conecta primero: {p}', { p: missing.map((m) => PLATFORMS[m].name).join(', ') }), 'err')
    }
    setBusy(true)
    const post = await build(status === 'now' ? 'draft' : status)
    savePost(post)
    if (status === 'now') {
      // pequeña espera para que el estado se asiente antes de publicar
      setTimeout(() => publishNow(post.id), 50)
    } else notify(status === 'draft' ? t('Borrador guardado') : t('Publicación programada'))
    setDraft(null)
    setBusy(false)
    onDone()
  }

  const gen = () => setCaption(generateCaption(topic, tone))
  const addTags = () => setCaption((c) => (c.trim() + '\n\n' + suggestHashtags(topic || c).join(' ')).trim())

  return (
    <div className="page">
      <header className="ph"><h1>{draft ? t('Editar publicación') : t('Crear publicación')}</h1><p>{t('Diseña la imagen, escribe el texto y publica o programa.')}</p></header>

      <div className="card"><h3>1 · {t('Diseño de imagen')}</h3><ImageEditor design={design} setDesign={setDesign} /></div>

      <div className="card">
        <h3>2 · {t('Texto de la publicación')}</h3>
        <div className="gen">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('Tema (ej. lanzamiento de producto)')} />
          <select value={tone} onChange={(e) => setTone(e.target.value)}>{TONE_LIST.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select>
          <button className="btn ghost" onClick={gen}><Icon name="magic" size={16} /> {t('Generar texto')}</button>
          <button className="btn ghost" onClick={addTags}>{t('# Hashtags')}</button>
        </div>
        <textarea className="caption" rows={7} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t('Escribe el texto de tu publicación…')} />
        <div className="counter">
          <span className={caption.length > maxLen ? 'bad' : ''}>{caption.length}/{maxLen} {t('caracteres')}</span>
          {tagLimit < 99 && <span className={tags > tagLimit ? 'bad' : ''}>{tags}/{tagLimit} hashtags</span>}
        </div>
      </div>

      <div className="card">
        <h3>3 · {t('Publicar en')}</h3>
        <div className="plats">
          {Object.values(PLATFORMS).map((p) => (
            <button key={p.id} className={'plat' + (platforms.includes(p.id) ? ' on' : '')} style={{ '--pc': p.color }} onClick={() => togglePlat(p.id)}>
              <PlatformBadge id={p.id} />
              <small>{accounts[p.id] ? accountLabel(p, accounts[p.id]) : t('No conectada')}</small>
            </button>
          ))}
        </div>
        {needsTo && (
          <div className="dest">
            {hasEmail && <label className="inl">{t('Asunto del correo')}<input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('Asunto')} /></label>}
            <label className="inl">{t('Destinatarios (correos o números, separados por coma)')}<input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="cliente@correo.com, +56 9 1234 5678" /></label>
          </div>
        )}
        {formatMismatch.length > 0 && <p className="warn">⚠️ {t('El formato “{f}” no está pensado para {p}. Considera cambiar el formato.', { f: t(fmt.label), p: formatMismatch.map((m) => PLATFORMS[m].name).join(', ') })}</p>}
        <div className="actions">
          <label className="inl">{t('Programar para')}<input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
          <button className="btn ghost" disabled={busy} onClick={() => run('draft')}>{t('Guardar borrador')}</button>
          <button className="btn blue" disabled={busy} onClick={() => run('scheduled')}><Icon name="clock" size={16} /> {t('Programar')}</button>
          <button className="btn primary" disabled={busy} onClick={() => run('now')}><Icon name="send" size={16} /> {t('Publicar ahora')}</button>
        </div>
      </div>
    </div>
  )
}
