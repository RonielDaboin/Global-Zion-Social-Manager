import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { PLATFORMS, accountLabel, blankDesign, getFormat, uid } from '../lib/formats.js'
import { renderToDataURL } from '../lib/render.js'
import { generateCaption, generateCaptionAI, shrinkImage, suggestHashtags, TONE_LIST } from '../lib/social.js'
import { t, useLang } from '../lib/i18n.jsx'
import ImageEditor from './ImageEditor.jsx'
import VideoEditor, { videoWarnings } from './VideoEditor.jsx'
import { saveVideo, loadVideo, deleteVideo } from '../lib/mediaStore.js'
import { Icon, PlatformBadge } from './ui.jsx'

const toLocalInput = (ts) => {
  const d = new Date(ts - new Date().getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

// Trabajo en curso: se guarda en el navegador para no perderlo al cambiar de sección ni al recargar (F5).
const wipRead = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null } }
const wipWrite = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* almacenamiento lleno: se ignora */ } }

export default function Composer({ onDone, onDiscard }) {
  const { draft, setDraft, savePost, publishNow, accounts, notify, session } = useApp()
  useLang()
  // Cada destino (publicación nueva o cada publicación que se edita) guarda su propio trabajo en curso.
  const base = `gz_wip_${session?.id || 'anon'}`
  const [wipKey] = useState(() => {
    let target = draft?.id || null
    if (!target) { // tras F5 el store está vacío: recuperamos qué publicación se estaba editando
      try { target = sessionStorage.getItem('gz_edit') } catch { /* ignore */ }
      if (target && !wipRead(`${base}_${target}`)) target = null
    }
    return `${base}_${target || 'new'}`
  })
  const [w] = useState(() => wipRead(wipKey))
  const src = w || draft || {}
  const [id] = useState(src.id || uid())
  const [editing] = useState(w ? !!w.editing : !!draft)
  const [createdAt] = useState(src.createdAt || null)
  const [design, setDesign] = useState(src.design || blankDesign())
  const [caption, setCaption] = useState(src.caption || '')
  const [platforms, setPlatforms] = useState(src.platforms || ['instagram'])
  const [subject, setSubject] = useState(src.subject || '')
  const [recipients, setRecipients] = useState(src.recipients || '')
  const [when, setWhen] = useState(w?.when || (draft?.scheduledAt ? toLocalInput(draft.scheduledAt) : toLocalInput(Date.now() + 3600e3)))
  const [topic, setTopic] = useState(w?.topic || '')
  const [tone, setTone] = useState(w?.tone || 'inspirador')
  const [useImage, setUseImage] = useState(w?.useImage ?? true)
  const [genBusy, setGenBusy] = useState(false)
  const [busy, setBusy] = useState(false)
  const [mediaType, setMediaType] = useState(src.mediaType || 'photo')
  const [video, setVideo] = useState(src.video || null)
  const [videoFile, setVideoFile] = useState(null)
  useEffect(() => { if (src.mediaType === 'video') loadVideo(src.id).then((b) => b && setVideoFile(b)) }, []) // eslint-disable-line
  // El archivo de video va a IndexedDB en cuanto se sube, para que también sobreviva a F5
  useEffect(() => { if (videoFile) saveVideo(id, videoFile).catch(() => {}) }, [videoFile, id])

  // Guardado automático del trabajo en curso (con pequeño retraso) + guardado final al salir o recargar
  const snap = { id, editing, createdAt, design, caption, platforms, subject, recipients, when, topic, tone, useImage, mediaType, video }
  const snapRef = useRef(snap); snapRef.current = snap
  const stopped = useRef(false)
  const flush = () => { if (!stopped.current) wipWrite(wipKey, snapRef.current) }
  useEffect(() => {
    const tm = setTimeout(flush, 500)
    return () => clearTimeout(tm)
  }, [design, caption, platforms, subject, recipients, when, topic, tone, useImage, mediaType, video]) // eslint-disable-line
  useEffect(() => {
    window.addEventListener('pagehide', flush)
    return () => { window.removeEventListener('pagehide', flush); flush() }
  }, []) // eslint-disable-line
  const clearWip = () => { stopped.current = true; try { localStorage.removeItem(wipKey); sessionStorage.removeItem('gz_edit') } catch { /* ignore */ } }
  const discard = () => {
    clearWip()
    if (!editing) deleteVideo(id)
    setDraft(null)
    onDiscard()
  }

  const fmt = getFormat(design.format)
  const togglePlat = (p) => setPlatforms((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]))
  const maxLen = Math.min(...(platforms.length ? platforms : ['instagram']).map((p) => PLATFORMS[p].limit))
  const tags = (caption.match(/#[\p{L}\p{N}_]+/gu) || []).length
  const tagLimit = Math.min(...(platforms.length ? platforms : ['instagram']).map((p) => PLATFORMS[p].maxTags))
  const formatMismatch = platforms.filter((p) => !fmt.platforms.includes(p) && !(fmt.w === 1080 && fmt.h === 1920))

  const hasEmail = platforms.includes('email')
  const needsTo = hasEmail || platforms.some((p) => PLATFORMS[p].kind === 'phone')

  const isVideo = mediaType === 'video'

  const build = async (status) => {
    const image = isVideo ? video.cover : await renderToDataURL(design)
    if (isVideo) await saveVideo(id, videoFile); else await deleteVideo(id)
    return { id, caption, subject, recipients, platforms, mediaType, video: isVideo ? video : null, format: design.format, design, image, status, scheduledAt: status === 'scheduled' ? new Date(when).getTime() : null, createdAt: createdAt || Date.now() }
  }

  const validate = (needPlatforms) => {
    if (isVideo && !videoFile) { notify(t('Sube un video para publicar.'), 'err'); return false }
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
    clearWip()
    setDraft(null)
    setBusy(false)
    onDone()
  }

  const gen = async () => {
    if (genBusy) return
    setGenBusy(true)
    try {
      let image = null
      if (useImage) {
        const src = isVideo ? video?.cover : await renderToDataURL(design, 'image/jpeg', 0.8, 768)
        image = src ? await shrinkImage(src) : null
      }
      const networks = platforms.map((p) => PLATFORMS[p].name)
      setCaption(await generateCaptionAI({ topic, tone, networks, maxLen, maxTags: tagLimit, mediaType, image }))
    } catch (e) {
      setCaption(generateCaption(topic, tone))
      notify(t('No se pudo usar la IA ({e}). Se usó una plantilla.', { e: e.message }), 'err')
    }
    setGenBusy(false)
  }
  const addTags = () => setCaption((c) => (c.trim() + '\n\n' + suggestHashtags(topic || c).join(' ')).trim())

  return (
    <div className="page cmp">
      <header className="ph row between"><div><h1>{editing ? t('Editar publicación') : t('Crear publicación')}</h1><p>{t('Elige foto o video, escribe el texto y publica o programa.')}</p></div>
        <button className="btn ghost sm" onClick={discard}><Icon name="trash" size={14} /> {editing ? t('Descartar cambios') : t('Empezar de cero')}</button></header>

      <div className="card">
        <h3>1 · {t('Tipo de contenido')}</h3>
        <div className="media-type">
          <button className={'mt' + (!isVideo ? ' on' : '')} onClick={() => setMediaType('photo')}>
            <span className="mt-ico">🖼️</span><b>{t('Foto')}</b><small>{t('Diseña una imagen con plantillas, textos y fondos')}</small>
          </button>
          <button className={'mt' + (isVideo ? ' on' : '')} onClick={() => setMediaType('video')}>
            <span className="mt-ico">🎬</span><b>{t('Video')}</b><small>{t('Sube un video, elige la portada y revisa los límites')}</small>
          </button>
        </div>
        <h3 className="sub">{isVideo ? t('Herramientas de video') : t('Herramientas de foto')}</h3>
        {isVideo
          ? <VideoEditor file={videoFile} setFile={setVideoFile} video={video} setVideo={setVideo} platforms={platforms} notify={notify} />
          : <ImageEditor design={design} setDesign={setDesign} />}
      </div>

      <div className="card">
        <h3>2 · {t('Texto de la publicación')}</h3>
        <div className="gen">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('Tema (ej. lanzamiento de producto)')} />
          <select value={tone} onChange={(e) => setTone(e.target.value)}>{TONE_LIST.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select>
          <button className="btn ghost" disabled={genBusy} onClick={gen}><Icon name="magic" size={16} /> {genBusy ? t('Generando…') : t('Generar texto con IA')}</button>
          <button className="btn ghost" onClick={addTags}>{t('# Hashtags')}</button>
        </div>
        <label className="check ai-opt"><input type="checkbox" checked={useImage} onChange={(e) => setUseImage(e.target.checked)} /> {t('Que la IA mire la imagen para escribir el texto')}</label>
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
        {isVideo && videoWarnings(video, platforms).map((w, i) => <p key={i} className="warn">⚠️ {w}</p>)}
        {!isVideo && formatMismatch.length > 0 && <p className="warn">⚠️ {t('El formato “{f}” no está pensado para {p}. Considera cambiar el formato.', { f: t(fmt.label), p: formatMismatch.map((m) => PLATFORMS[m].name).join(', ') })}</p>}
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
