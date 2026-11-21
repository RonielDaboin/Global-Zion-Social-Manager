import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { PLATFORMS, accountLabel, blankDesign, designFormats, getFormat, uid } from '../lib/formats.js'
import { renderToDataURL } from '../lib/render.js'
import { generateCaption, generateCaptionAI, shrinkImage, suggestHashtags, TONE_LIST } from '../lib/social.js'
import { t, useLang } from '../lib/i18n.jsx'
import ImageEditor from './ImageEditor.jsx'
import AutoPost from './AutoPost.jsx'
import EmojiButton from './EmojiPicker.jsx'
import WhenPicker from './WhenPicker.jsx'
import MusicStudio from './MusicStudio.jsx'
import VideoEditor, { videoWarnings } from './VideoEditor.jsx'
import { extractFrames } from '../lib/videoProcess.js'
import { saveVideo, loadVideo, deleteVideo } from '../lib/mediaStore.js'
import { Icon, PlatformBadge } from './ui.jsx'
import { planFor, aiTextUsed, aiTextBump, scheduledInMonth } from '../lib/plans.js'
import { LockTag } from './Plans.jsx'

const toLocalInput = (ts) => {
  const d = new Date(ts - new Date().getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

// Trabajo en curso: se guarda en el navegador para no perderlo al cambiar de sección ni al recargar (F5).
const wipRead = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null } }
const wipWrite = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* almacenamiento lleno: se ignora */ } }

export default function Composer({ onDone, onDiscard }) {
  const { draft, setDraft, savePost, publishNow, accounts, notify, session, posts, access, openPlans } = useApp()
  const lim = access.limits
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
  const [autoOpen, setAutoOpen] = useState(false)
  const capRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const hashMedia = () => { const m = window.location.hash.match(/^#\/create-post\/(image|video)/); return m ? (m[1] === 'video' ? 'video' : 'photo') : null }
  const [mediaType, setMediaType] = useState(() => { const m = src.mediaType || hashMedia() || 'photo'; return m === 'video' && !lim.video ? 'photo' : m })
  const pickMedia = (m) => { if (m === 'video' && !lim.video) return openPlans(t('El editor de video está disponible desde el plan PRO.')); setMediaType(m) }
  // La URL refleja el tipo: #/create-post/image · #/create-post/video
  useEffect(() => {
    const h = '#/create-post/' + (mediaType === 'video' ? 'video' : 'image')
    if (window.location.hash !== h) window.history.replaceState(null, '', h)
  }, [mediaType])
  useEffect(() => {
    const on = () => { const m = hashMedia(); if (m) setMediaType(m) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, []) // eslint-disable-line
  const [video, setVideo] = useState(src.video || null)
  const [videoFile, setVideoFile] = useState(null)
  const [saveCopy, setSaveCopy] = useState(true) // descargar el video al ordenador al publicar/programar
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
  const togglePlat = (p) => {
    if (!lim.platforms.includes(p)) return openPlans(t('{p} está disponible desde el plan {n}.', { p: PLATFORMS[p].name, n: planFor((l) => l.platforms.includes(p)).name }))
    setPlatforms((l) => (l.includes(p) ? l.filter((x) => x !== p) : [...l, p]))
  }
  const maxLen = Math.min(...(platforms.length ? platforms : ['instagram']).map((p) => PLATFORMS[p].limit))
  const tags = (caption.match(/#[\p{L}\p{N}_]+/gu) || []).length
  const tagLimit = Math.min(...(platforms.length ? platforms : ['instagram']).map((p) => PLATFORMS[p].maxTags))
  const fmts = designFormats(design)
  const formatMismatch = platforms.filter((p) => !fmts.some((id) => { const f = getFormat(id); return f.platforms.includes(p) || (f.w === 1080 && f.h === 1920) }))
  const igFeedCount = fmts.filter((f) => f !== 'ig-story').length

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
    if (isVideo && video?.pending) { notify(t('Tienes cambios de video sin aplicar: pulsa “Aplicar” en el editor.'), 'err'); return false }
    if (caption.length > maxLen) { notify(t('El texto supera el límite de {n} caracteres', { n: maxLen }), 'err'); return false }
    if (needPlatforms && hasEmail && !subject.trim()) { notify(t('El correo necesita un asunto'), 'err'); return false }
    if (needPlatforms && needsTo && !recipients.trim()) { notify(t('Indica los destinatarios'), 'err'); return false }
    if (needPlatforms && platforms.some((p) => !lim.platforms.includes(p))) { const b = platforms.find((p) => !lim.platforms.includes(p)); openPlans(t('{p} está disponible desde el plan {n}.', { p: PLATFORMS[b].name, n: planFor((l) => l.platforms.includes(b)).name })); return false }
    if (needPlatforms && !platforms.length) { notify(t('Selecciona al menos una red social'), 'err'); return false }
    if (needPlatforms && !isVideo && platforms.includes('youtube')) { notify(t('YouTube solo admite videos: cambia a Video o quita YouTube.'), 'err'); return false }
    return true
  }

  const downloadVideo = () => {
    const ext = ((videoFile.type || 'video/mp4').split('/')[1] || 'mp4').replace('quicktime', 'mov')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(videoFile)
    a.download = `${(videoFile.name || 'video').replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '_') || 'video'}.${ext}`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 60000)
  }

  const run = async (status) => {
    if (!validate(status !== 'draft')) return
    if (status === 'scheduled' && new Date(when).getTime() <= Date.now()) return notify(t('Elige una fecha futura'), 'err')
    if (status === 'scheduled' && scheduledInMonth(posts, new Date(when).getTime(), id) >= lim.scheduledPerMonth) {
      return openPlans(lim.scheduledPerMonth ? t('Tu plan {a} permite programar hasta {n} publicaciones al mes.', { a: access.plan.name, n: lim.scheduledPerMonth }) : t('Programar publicaciones está disponible desde el plan PRO.'))
    }
    if (status !== 'draft') {
      const missing = platforms.filter((p) => !accounts[p])
      if (missing.length) return notify(t('Conecta primero: {p}', { p: missing.map((m) => PLATFORMS[m].name).join(', ') }), 'err')
    }
    if (isVideo && saveCopy && status !== 'draft') downloadVideo()
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

  // Rellena toda la publicación con el resultado del generador automático
  const applyAuto = (a) => {
    setDesign(a.design); setCaption(a.caption); setPlatforms(a.platforms); setWhen(a.when); setTopic(a.topic || '')
    setTone(a.tone); setMediaType('photo'); setAutoOpen(false)
    notify(t('Publicación generada. Revísala antes de publicar.'))
  }
  const gen = async () => {
    if (genBusy) return
    if (!lim.aiText) { setCaption(generateCaption(topic, tone)); return notify(t('Texto creado con una plantilla. La IA de textos está disponible desde el plan PRO.')) }
    if (aiTextUsed(session?.id) >= lim.aiTextPerDay) { setCaption(generateCaption(topic, tone)); openPlans(t('Llegaste al límite de {n} textos con IA de hoy. Se usó una plantilla.', { n: lim.aiTextPerDay })); return }
    setGenBusy(true)
    try {
      let image = null, frames = null
      if (useImage) {
        if (isVideo) {
          frames = videoFile ? await extractFrames(videoFile) : []
          if (!frames.length && video?.cover) image = await shrinkImage(video.cover) // sin fotogramas: al menos la portada
        } else {
          const src = await renderToDataURL(design, 'image/jpeg', 0.8, 768)
          image = src ? await shrinkImage(src) : null
        }
      }
      const networks = platforms.map((p) => PLATFORMS[p].name)
      setCaption(await generateCaptionAI({ topic, tone, networks, maxLen, maxTags: tagLimit, mediaType, image, frames }))
      aiTextBump(session?.id)
    } catch (e) {
      setCaption(generateCaption(topic, tone))
      notify(t('No se pudo usar la IA ({e}). Se usó una plantilla.', { e: e.message }), 'err')
    }
    setGenBusy(false)
  }
  const addTags = () => setCaption((c) => (c.trim() + '\n\n' + suggestHashtags(topic || c).join(' ')).trim())

  return (
    <div className="page cmp">
      <header className="ph row between"><div><h1>{editing ? t('Editar publicación') : t('Crear publicación')}</h1><p>{t('Elige imagen o video, escribe el texto y publica o programa.')}</p></div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn primary auto-btn" onClick={() => (lim.autoPost ? setAutoOpen(true) : openPlans(t('La publicación automática con IA está disponible en el plan PRO PLUS.')))}>✨ {t('Crear con IA')}{!lim.autoPost && <LockTag plan="PLUS" />}</button>
          <button className="btn ghost sm" onClick={discard}><Icon name="trash" size={14} /> {editing ? t('Descartar cambios') : t('Empezar de cero')}</button>
        </div></header>
      {autoOpen && <AutoPost onClose={() => setAutoOpen(false)} onGenerated={applyAuto} />}

      <div className="card">
        <h3>1 · {t('Tipo de contenido')}</h3>
        <div className="media-type">
          <button className={'mt' + (!isVideo ? ' on' : '')} onClick={() => pickMedia('photo')}>
            <span className="mt-ico">🖼️</span><b>{t('Imagen')}</b><small>{t('Diseña una imagen con plantillas, textos y fondos')}</small>
          </button>
          <button className={'mt' + (isVideo ? ' on' : '')} onClick={() => pickMedia('video')}>
            <span className="mt-ico">🎬</span><b>{t('Video')}{!lim.video && <LockTag plan="PRO" />}</b><small>{t('Sube un video, elige la portada y revisa los límites')}</small>
          </button>
        </div>
        <h3 className="sub">{isVideo ? t('Herramientas de video') : t('Herramientas de imagen')}</h3>
        {isVideo
          ? <VideoEditor file={videoFile} setFile={setVideoFile} video={video} setVideo={setVideo} platforms={platforms} notify={notify} maxMB={lim.videoMB} />
          : <>
            <ImageEditor design={design} setDesign={setDesign} />
            <MusicStudio design={design} lim={lim} maxMB={lim.videoMB || 100} notify={notify}
              onLocked={(msg) => openPlans(msg || t('La animación con música está disponible desde el plan PRO.'))}
              onCreated={(file, meta) => { setVideoFile(file); setVideo(meta); setMediaType('video'); notify(t('¡Video con música listo! Revísalo y publícalo.')) }} />
          </>}
      </div>

      <div className="card">
        <h3>2 · {t('Texto de la publicación')}</h3>
        <div className="gen">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={t('Tema (ej. lanzamiento de producto)')} />
          <select value={tone} onChange={(e) => setTone(e.target.value)}>{TONE_LIST.map((x) => <option key={x} value={x}>{t(x)}</option>)}</select>
          <button className="btn ghost" disabled={genBusy} onClick={gen}><Icon name="magic" size={16} /> {genBusy ? t('Generando…') : t('Generar texto con IA')}</button>
          <button className="btn ghost" onClick={addTags}>{t('# Hashtags')}</button>
        </div>
        <label className="check ai-opt"><input type="checkbox" checked={useImage} onChange={(e) => setUseImage(e.target.checked)} /> {isVideo ? t('Que la IA mire el video para escribir el texto') : t('Que la IA mire la imagen para escribir el texto')}</label>
        <textarea ref={capRef} className="caption" rows={7} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={t('Escribe el texto de tu publicación…')} />
        <div className="counter">
          <span className="counter-l">
            <EmojiButton inputRef={capRef} value={caption} onChange={setCaption} label />
            <span className={caption.length > maxLen ? 'bad' : ''}>{caption.length}/{maxLen} {t('caracteres')}</span>
          </span>
          {tagLimit < 99 && <span className={tags > tagLimit ? 'bad' : ''}>{tags}/{tagLimit} hashtags</span>}
        </div>
      </div>

      <div className="card">
        <h3>3 · {t('Publicar en')}</h3>
        <div className="plats">
          {Object.values(PLATFORMS).map((p) => (
            <button key={p.id} className={'plat' + (platforms.includes(p.id) ? ' on' : '')} style={{ '--pc': p.color }} onClick={() => togglePlat(p.id)}>
              <PlatformBadge id={p.id} />
              <small>{!lim.platforms.includes(p.id) ? <LockTag plan={planFor((l) => l.platforms.includes(p.id)).name} /> : accounts[p.id] ? accountLabel(p, accounts[p.id]) : t('No conectada')}</small>
            </button>
          ))}
        </div>
        {needsTo && (
          <div className="dest">
            {hasEmail && <label className="inl">{t('Asunto del correo')}<input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t('Asunto')} /></label>}
            <label className="inl">{t('Destinatarios (correos o números, separados por coma)')}<input value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="cliente@correo.com, +56 9 1234 5678" /></label>
          </div>
        )}
        {isVideo && (
          <label className="save-copy">
            <input type="checkbox" checked={saveCopy} onChange={(e) => setSaveCopy(e.target.checked)} />
            <span>
              <b>💾 {t('Descargar una copia del video en mi computadora')}</b>
              <small>{t('Recomendado: para ahorrar espacio, el video se elimina de la nube cuando se publica. Si lo programas, se descarga ahora y se borra al publicarse.')}</small>
            </span>
          </label>
        )}
        {!isVideo && platforms.includes('youtube') && <p className="warn">⚠️ {t('YouTube solo admite videos: cambia a Video o quita YouTube.')}</p>}
        {isVideo && videoWarnings(video, platforms).map((w, i) => <p key={i} className="warn">⚠️ {w}</p>)}
        {!isVideo && formatMismatch.length > 0 && <p className="warn">⚠️ {t('El formato “{f}” no está pensado para {p}. Considera cambiar el formato.', { f: t(fmt.label), p: formatMismatch.map((m) => PLATFORMS[m].name).join(', ') })}</p>}
        {!isVideo && fmts.length > 1 && platforms.includes('instagram') && igFeedCount > 1 && <p className="warn">⚠️ {t('Instagram publicará un solo post (“{f}”) y, si lo marcaste, la story.', { f: t(getFormat(fmts.find((f) => f !== 'ig-story')).label) })}</p>}
        {!isVideo && fmts.includes('ig-story') && platforms.includes('instagram') && <p className="hint" style={{ justifyContent: 'flex-start', textAlign: 'left' }}>{t('Las stories no llevan texto: lo que quieras mostrar debe ir dentro de la imagen.')}</p>}
        <div className="actions">
          <WhenPicker value={when} onChange={setWhen} />
          <button className="btn ghost" disabled={busy} onClick={() => run('draft')}>{t('Guardar borrador')}</button>
          <button className="btn blue" disabled={busy} onClick={() => run('scheduled')}><Icon name="clock" size={16} /> {t('Programar')}{!lim.scheduledPerMonth && <LockTag plan="PRO" />}</button>
          <button className="btn primary" disabled={busy} onClick={() => run('now')}><Icon name="send" size={16} /> {t('Publicar ahora')}</button>
        </div>
      </div>
    </div>
  )
}
