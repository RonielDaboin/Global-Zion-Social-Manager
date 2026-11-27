import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { PLATFORMS, accountLabel, blankDesign, designFormats, getFormat, uid } from '../lib/formats.js'
import { renderToDataURL } from '../lib/render.js'
import { generatePostSheetAI, shrinkImage, suggestHashtags } from '../lib/social.js'
import { t, useLang } from '../lib/i18n.jsx'
import ImageEditor from './ImageEditor.jsx'
import AutoPost from './AutoPost.jsx'
import AutoVideo, { AutoChoice } from './AutoVideo.jsx'
import EmojiButton from './EmojiPicker.jsx'
import WhenPicker from './WhenPicker.jsx'
import MusicStudio from './MusicStudio.jsx'
import IgMusic from './IgMusic.jsx'
import VideoEditor, { videoWarnings } from './VideoEditor.jsx'
import { extractFrames } from '../lib/videoProcess.js'
import { saveVideo, loadVideo, deleteVideo } from '../lib/mediaStore.js'
import { Icon, PlatformBadge } from './ui.jsx'
import { composeCaption, normalizeTags, initialSheet, sheetFromCaption, withContact, CONTACT_LENGTH } from '../lib/postSheet.js'
import { planFor, aiTextUsed, aiTextBump, scheduledInMonth } from '../lib/plans.js'
import { LockTag } from './Plans.jsx'

const toLocalInput = (ts) => {
  const d = new Date(ts - new Date().getTimezoneOffset() * 60000)
  return d.toISOString().slice(0, 16)
}

// Tonos que se le pueden pedir a la IA [valor, etiqueta]
const TONES = [['recomendado', '⭐ Recomendado'], ['profesional', 'Profesional'], ['inspirador', 'Inspirador'], ['promocional', 'Promocional'], ['divertido', 'Divertido']]
const DEFAULT_TONE = 'recomendado'
// Lo que se le explica a la IA con el tono por defecto (los demás se entienden con su nombre)
const TONE_HINTS = { recomendado: 'equilibrado y pensado para vender: profesional pero cercano, claro y directo; un gancho que plantee la necesidad del cliente, beneficios concretos en frases cortas o lista y una invitación a contactar' }

// Trabajo en curso: se guarda en el navegador para no perderlo al cambiar de sección ni al recargar (F5).
const wipRead = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null } catch { return null } }
const wipWrite = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* almacenamiento lleno: se ignora */ } }

export default function Composer({ onDone, onDiscard, onOpen }) {
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
  const [editing] = useState(w ? !!w.editing : !!draft && !draft.fromContent)
  const [contentId] = useState(src.contentId || null) // archivo de la sección Contenido usado en esta publicación
  const [createdAt] = useState(src.createdAt || null)
  const [design, setDesign] = useState(src.design || blankDesign())
  // El texto que se publica se arma siempre con la ficha: título, descripción y tags
  const [sheet, setSheet] = useState(() => initialSheet(src.sheet, src.caption))
  const caption = composeCaption(sheet)
  const [platforms, setPlatforms] = useState(src.platforms || ['instagram'])
  const [subject, setSubject] = useState(src.subject || '')
  const [recipients, setRecipients] = useState(src.recipients || '')
  const [when, setWhen] = useState(w?.when || (draft?.scheduledAt ? toLocalInput(draft.scheduledAt) : toLocalInput(Date.now() + 3600e3)))
  const [tone, setTone] = useState(w?.tone || DEFAULT_TONE)
  const [autoOpen, setAutoOpen] = useState(null) // «Crear con IA»: null | 'choose' | 'image' | 'video'
  const titleRef = useRef(null)
  const descRef = useRef(null)
  const [emojiField, setEmojiField] = useState('description') // dónde inserta el botón de emojis (el último campo usado)
  const [sheetBusy, setSheetBusy] = useState(false)
  const [autoAI] = useState(() => !w && !!draft?.autoAI) // «Editar con IA» desde Contenido: se analiza al abrir
  const autoDone = useRef(false)
  const sheetRef = useRef(null)
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
  const [igMusic, setIgMusic] = useState(src.igMusic || null) // pista del catálogo de Instagram para el Reel
  const [saveCopy, setSaveCopy] = useState(true) // descargar el video al ordenador al publicar/programar
  useEffect(() => { if (src.mediaType === 'video') loadVideo(src.id).then((b) => b && setVideoFile(b)) }, []) // eslint-disable-line
  // El archivo de video va a IndexedDB en cuanto se sube, para que también sobreviva a F5
  useEffect(() => { if (videoFile) saveVideo(id, videoFile).catch(() => {}) }, [videoFile, id])

  // Guardado automático del trabajo en curso (con pequeño retraso) + guardado final al salir o recargar
  const snap = { id, contentId, sheet, editing, createdAt, design, caption, platforms, subject, recipients, when, tone, mediaType, video, igMusic }
  const snapRef = useRef(snap); snapRef.current = snap
  const stopped = useRef(false)
  const flush = () => { if (!stopped.current) wipWrite(wipKey, snapRef.current) }
  useEffect(() => {
    const tm = setTimeout(flush, 500)
    return () => clearTimeout(tm)
  }, [design, platforms, subject, recipients, when, tone, mediaType, video, sheet, igMusic]) // eslint-disable-line
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
    return { id, contentId, sheet, caption, subject, recipients, platforms, mediaType, video: isVideo ? video : null, igMusic: isVideo ? igMusic : null, format: design.format, design, image, status, scheduledAt: status === 'scheduled' ? new Date(when).getTime() : null, createdAt: createdAt || Date.now() }
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
    savePost(post, { publishing: status === 'now' })
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
    setDesign(a.design); setSheet(sheetFromCaption(a.caption)); setPlatforms(a.platforms); setWhen(a.when)
    setTone(a.tone); setMediaType('photo'); setAutoOpen(null)
    notify(t('Publicación generada. Revísala antes de publicar.'))
  }
  /** Lo que ve la IA: fotogramas del video, o la imagen del diseño. */
  const mediaForAI = async () => {
    if (isVideo) {
      const frames = videoFile ? await extractFrames(videoFile) : []
      return { frames, image: !frames.length && video?.cover ? await shrinkImage(video.cover) : null }
    }
    const url = await renderToDataURL(design, 'image/jpeg', 0.8, 768)
    return { frames: null, image: url ? await shrinkImage(url) : null }
  }

  const genSheet = async () => {
    if (sheetBusy) return
    if (!lim.aiText) return openPlans(t('La IA de textos está disponible desde el plan PRO.'))
    if (aiTextUsed(session?.id) >= lim.aiTextPerDay) return openPlans(t('Llegaste al límite de {n} textos con IA de hoy.', { n: lim.aiTextPerDay }))
    if (isVideo && !videoFile) return notify(t('Sube un video para que la IA lo pueda mirar.'), 'err')
    setSheetBusy(true)
    try {
      const media = await mediaForAI()
      if (!media.image && !media.frames?.length) throw new Error(t('No se pudo leer el contenido'))
      // se le deja a la IA el espacio que ocupan el WhatsApp y la web, que se agregan después
      const out = await generatePostSheetAI({ topic: '', tone: TONE_HINTS[tone] || tone, networks: platforms.map((p) => PLATFORMS[p].name), maxLen: maxLen - CONTACT_LENGTH, maxTags: tagLimit, mediaType, ...media })
      const next = { title: out.title, description: withContact(out.description), tags: normalizeTags(out.tags), ai: true }
      setSheet(next)
      if (!subject.trim()) setSubject(next.title) // el correo usa el título como asunto
      aiTextBump(session?.id)
      notify(t('La IA preparó el título, la descripción y los tags. Revísalos antes de publicar.'))
    } catch (e) {
      notify(t('No se pudo usar la IA: {e}', { e: e.message }), 'err')
    }
    setSheetBusy(false)
  }

  // Al venir de «Editar con IA»: analiza una sola vez, cuando el archivo ya está cargado
  useEffect(() => {
    if (!autoAI || autoDone.current || (isVideo && !videoFile)) return
    autoDone.current = true
    // El editor de arriba cambia de alto al cargar: se baja hasta la ficha al empezar y al terminar
    const show = () => setTimeout(() => sheetRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 400)
    show()
    genSheet().then(show)
  }, [videoFile]) // eslint-disable-line

  const editSheet = (patch) => setSheet((cur) => ({ ...cur, ...patch }))
  const copy = (text) => { navigator.clipboard?.writeText(text); notify(t('Texto copiado')) }
  /** Agrega hashtags sugeridos según el título (o la descripción) sin repetir los que ya están. */
  const addTags = () => {
    const have = normalizeTags(sheet.tags).split(' ').filter(Boolean)
    const seen = new Set(have.map((x) => x.toLowerCase()))
    const extra = suggestHashtags(sheet.title || sheet.description).filter((x) => !seen.has(x.toLowerCase()))
    const room = Math.max(0, Math.min(tagLimit, 12) - have.length)
    if (!room || !extra.length) return notify(t('Ya tienes suficientes hashtags.'))
    editSheet({ tags: normalizeTags([...have, ...extra.slice(0, room)]) })
  }

  return (
    <div className="page cmp">
      <header className="ph row between"><div><h1>{editing ? t('Editar publicación') : t('Crear publicación')}</h1><p>{t('Elige imagen o video, escribe el texto y publica o programa.')}</p></div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button className="btn primary auto-btn" onClick={() => (lim.autoPost ? setAutoOpen('choose') : openPlans(t('La publicación automática con IA está disponible en el plan Premium.')))}>✨ {t('Crear con IA')}{!lim.autoPost && <LockTag plan="PREMIUM" />}</button>
          <button className="btn ghost sm" onClick={discard}><Icon name="trash" size={14} /> {editing ? t('Descartar cambios') : t('Empezar de cero')}</button>
        </div></header>
      {autoOpen === 'choose' && <AutoChoice onClose={() => setAutoOpen(null)} onImage={() => setAutoOpen('image')} onVideo={() => setAutoOpen('video')} />}
      {autoOpen === 'image' && <AutoPost onClose={() => setAutoOpen(null)} onGenerated={applyAuto} />}
      {/* El video se abre como publicación aparte: el trabajo que había en el editor se conserva */}
      {autoOpen === 'video' && <AutoVideo onClose={() => setAutoOpen(null)} onBack={() => setAutoOpen('choose')} onReady={(d) => { setAutoOpen(null); onOpen(d) }} />}

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
        <div className="sheet" ref={sheetRef} aria-busy={sheetBusy}>
          <div className="sheet-head">
            <div><b>✨ {t('Título, descripción y tags con IA')}</b><small>{isVideo ? t('La IA mira varios fotogramas del video (no escucha el audio).') : t('La IA mira la imagen y lo que tiene escrito.')}</small></div>
            <button type="button" className="btn primary sm" disabled={sheetBusy} onClick={genSheet}>{sheetBusy ? t('Analizando el contenido…') : sheet.ai ? t('Generar de nuevo') : t('Generar con IA')}</button>
          </div>
          <div className="sheet-tones" role="group" aria-label={t('Tono del texto')}>
            <small>{t('Tono del texto')}</small>
            {TONES.map(([value, label]) => (
              <button key={value} type="button" className={'chip' + (tone === value ? ' on' : '')} aria-pressed={tone === value} onClick={() => setTone(value)}>{t(label)}</button>
            ))}
          </div>
          {sheetBusy && <span className="lib-bar" />}
          <div className="sheet-fields">
            {[['title', 'Título', 'Escribe un título o genera con IA'], ['description', 'Descripción', 'Escribe el texto de tu publicación…'], ['tags', 'Tags', '#hashtags']].map(([key, label, hint]) => (
              <div key={key} className="sheet-field">
                <div>
                  <label htmlFor={'sheet-' + key}>{t(label)}</label>
                  <span className="sheet-actions">
                    {key === 'tags' && <button type="button" className="btn ghost sm" onClick={addTags}>{t('# Hashtags')}</button>}
                    <button type="button" className="btn ghost sm" onClick={() => copy(key === 'tags' ? normalizeTags(sheet.tags) : sheet[key])} aria-label={t('Copiar') + ' ' + t(label)}><Icon name="copy" size={13} /></button>
                  </span>
                </div>
                {key === 'description'
                  ? <textarea ref={descRef} id="sheet-description" rows={9} value={sheet.description} placeholder={t(hint)} onFocus={() => setEmojiField(key)} onChange={(e) => editSheet({ description: e.target.value })} />
                  : <input ref={key === 'title' ? titleRef : undefined} id={'sheet-' + key} value={sheet[key]} placeholder={t(hint)}
                    onFocus={key === 'title' ? () => setEmojiField(key) : undefined}
                    onBlur={key === 'tags' ? () => editSheet({ tags: normalizeTags(sheet.tags) }) : undefined}
                    onChange={(e) => editSheet({ [key]: e.target.value })} />}
              </div>
            ))}
          </div>
        </div>
        <div className="counter">
          <span className="counter-l">
            <EmojiButton inputRef={emojiField === 'title' ? titleRef : descRef} value={sheet[emojiField]} onChange={(value) => editSheet({ [emojiField]: value })} label />
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
        {isVideo && platforms.includes('instagram') && design.format !== 'ig-story' && (accounts.instagram?.real
          ? <IgMusic value={igMusic} onChange={setIgMusic} notify={notify} />
          : <p className="muted">🎵 {t('Conecta Instagram en Cuentas para poder usar su música.')}</p>)}
        {isVideo && igMusic && platforms.some((p) => p !== 'instagram') && <p className="warn">⚠️ {t('La música de Instagram solo se agrega en Instagram: en las otras redes el video va sin ella.')}</p>}
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
