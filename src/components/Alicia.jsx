// Alicia: la asistente de la app. Se le pide en palabras («2 imágenes y 1 video el lunes y el martes»), propone un plan,
// crea las publicaciones como borradores y las programa solo cuando el usuario lo confirma.
// Está siempre montada: sigue trabajando aunque se cierre el panel o se cambie de sección.
import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { PLATFORMS, uid } from '../lib/formats.js'
import { askAlicia, createPost } from '../lib/aliciaCreate.js'
import { calendarLines, cleanItems, fillTimes, isPast, networksFor, slotTime, dayString, timeString } from '../lib/aliciaPlan.js'
import { fetchContent } from '../lib/content.js'
import { contentUse } from '../lib/contentDraft.js'
import { ANGLES } from '../lib/brand.js'
import { aiTextUsed, aiTextBump, scheduledInMonth } from '../lib/plans.js'
import { useSpeech } from '../lib/useSpeech.js'
import { t, useLang, getLang, locale } from '../lib/i18n.jsx'
import { Icon, PlatformLogo, StatusTag } from './ui.jsx'

const AUTO_SEND_KEY = 'gz_voice_autosend'
const CINE_KEY = 'gz_alicia_cine'
const MAX_MESSAGES = 40
const EXAMPLES = [
  ['🎬', 'Haz 2 publicaciones de imagen y 1 de video para el lunes y el martes'],
  ['🗓️', 'Una imagen cada día de la próxima semana, de lunes a viernes'],
  ['🛒', 'Mañana a las 10:00 una imagen sobre tiendas online'],
]
const TOPICS = [...new Set(ANGLES.map((a) => a.title))]

const PATHS = {
  expand: 'M8 3H4a1 1 0 0 0-1 1v4M16 3h4a1 1 0 0 1 1 1v4M8 21H4a1 1 0 0 1-1-1v-4M16 21h4a1 1 0 0 0 1-1v-4',
  shrink: 'M3 8h4a1 1 0 0 0 1-1V3M21 8h-4a1 1 0 0 1-1-1V3M3 16h4a1 1 0 0 1 1 1v4M21 16h-4a1 1 0 0 0-1 1v4',
  refresh: 'M20 11a8 8 0 1 0-2.3 6.3M20 4v7h-7',
  mic: 'M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21',
  stop: 'M7 7h10v10H7z',
  up: 'M12 19V5M6 11l6-6 6 6',
}
const Glyph = ({ name, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PATHS[name]} /></svg>
)

const read = (key) => { try { return JSON.parse(localStorage.getItem(key)) || {} } catch { return {} } }
const dayLabel = (date) => new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(date + 'T12:00'))

/** Videos de Contenido que no se han publicado ni están en ninguna publicación. */
async function freeVideosFor(posts) {
  const use = contentUse(posts)
  const { items } = await fetchContent()
  return items.filter((x) => x.isVideo && !x.publishedAt && !use.has(x.id))
}

/** Reparte los videos libres entre las publicaciones de video del plan, conservando los ya elegidos. */
function assignVideos(items, videos, previous = []) {
  const kept = previous.filter((x) => x.type === 'video' && !x.postId).map((x) => x.contentId)
  const free = new Set(videos.map((v) => v.id))
  const pool = videos.map((v) => v.id).sort(() => Math.random() - 0.5)
  let n = 0
  return items.map((it) => {
    if (it.type !== 'video') return it
    const wanted = kept[n++]
    const contentId = wanted && free.has(wanted) ? wanted : pool.find((id) => free.has(id)) || null
    free.delete(contentId)
    return { ...it, contentId }
  })
}

function Item({ it, post, videos, busy, working, onChange, onRemove, onEdit }) {
  const video = it.type === 'video' ? videos?.find((v) => v.id === it.contentId) : null
  const created = !!it.postId
  const editableDate = !created || post?.status === 'draft'
  // Una vez programada o publicada manda la fecha de la publicación
  const at = post && post.status !== 'draft' && post.scheduledAt ? new Date(post.scheduledAt) : null
  const date = at ? dayString(at) : it.date
  const time = at ? timeString(at) : it.time
  const thumb = post?.image || video?.thumb
  const networks = post?.platforms || it.platforms
  return (
    <li className={'ali-item' + (working ? ' working' : '')}>
      <div className="ali-item-top">
        <span className="ali-thumb" aria-hidden="true">{thumb ? <img src={thumb} alt="" /> : it.type === 'video' ? '🎬' : '🖼️'}</span>
        <div className="ali-item-info">
          <b>{it.type === 'video' ? t('Video') : t('Imagen')} · {dayLabel(date)}</b>
          <span className="ali-nets">{networks.map((p) => <span key={p} title={PLATFORMS[p].name}><PlatformLogo id={p} size={14} /></span>)}</span>
          {post && <StatusTag s={post.status} />}
          {created && !post && <small className="muted">{t('Esta publicación ya no está.')}</small>}
        </div>
        {!created && <button type="button" className="icon-btn" disabled={busy} onClick={onRemove} title={t('Quitar')} aria-label={t('Quitar')}><Icon name="x" size={15} /></button>}
      </div>
      <div className="ali-when">
        <input type="date" value={date} disabled={busy || !editableDate} aria-label={t('Fecha')} onChange={(e) => e.target.value && onChange({ date: e.target.value })} />
        <input type="time" value={time} disabled={busy || !editableDate} aria-label={t('Hora')} onChange={(e) => e.target.value && onChange({ time: e.target.value })} />
      </div>
      {editableDate && isPast(date, time) && <p className="ali-warn">⚠️ {t('Esa hora ya pasó: cámbiala para poder programarla.')}</p>}
      {!created && (
        <>
          <input type="text" value={it.topic} maxLength={160} disabled={busy} aria-label={t('Tema')} onChange={(e) => onChange({ topic: e.target.value })}
            placeholder={it.type === 'video' ? t('Tema (opcional: la IA mira el video)') : t('Tema (si queda vacío, uno al azar)')} />
          {it.type === 'video' && videos && (videos.length
            ? (
              <select value={it.contentId || ''} disabled={busy} aria-label={t('Video de Contenido')} onChange={(e) => onChange({ contentId: e.target.value || null })}>
                <option value="">{t('Elige un video de Contenido…')}</option>
                {videos.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            )
            : <p className="ali-warn">⚠️ {t('No hay videos libres. Sube uno en la sección Contenido.')}</p>)}
        </>
      )}
      {post && <p className="ali-cap">{post.caption}</p>}
      {it.error && <p className="ali-warn">❌ {it.error}</p>}
      {post && !['published', 'publishing'].includes(post.status) && (
        <button type="button" className="btn ghost sm" disabled={busy} onClick={() => onEdit(post)}><Icon name="edit" size={13} /> {t('Ver y editar')}</button>
      )}
    </li>
  )
}

export default function Alicia({ onEdit }) {
  const { session, posts, accounts, access, openPlans, savePost, notify } = useApp()
  useLang()
  const storeKey = `gz_alicia_${session.id}`
  const [open, setOpen] = useState(false)
  const [cine, setCine] = useState(() => { try { return localStorage.getItem(CINE_KEY) === '1' } catch { return false } })
  const toggleCine = (on) => { setCine(on); try { localStorage.setItem(CINE_KEY, on ? '1' : '0') } catch { /* ignore */ } }
  const [msgs, setMsgs] = useState(() => read(storeKey).msgs || []) // { who: 'me' | 'ai' | 'err', text }
  const [items, setItems] = useState(() => read(storeKey).items || [])
  const [withPhoto, setWithPhoto] = useState(() => read(storeKey).withPhoto !== false)
  const [draft, setDraft] = useState('')
  const [thinking, setThinking] = useState(false)
  const [progress, setProgress] = useState(null) // { key, n, total, step } mientras se crean
  const [videos, setVideos] = useState(null) // videos libres de Contenido; null = sin cargar
  const stop = useRef(false)
  const body = useRef(null)
  const postsRef = useRef(posts); postsRef.current = posts
  const busy = thinking || !!progress

  useEffect(() => {
    try { localStorage.setItem(storeKey, JSON.stringify({ msgs: msgs.slice(-MAX_MESSAGES), items, withPhoto })) } catch { /* ignore */ }
  }, [msgs, items, withPhoto, storeKey])
  useEffect(() => () => { stop.current = 'unmounted' }, []) // al cerrar sesión no se sigue creando
  // Se deja arriba el último mensaje: así se lee la respuesta y debajo queda el plan
  useEffect(() => {
    const box = body.current
    const last = box?.querySelector('.ali-log')?.lastElementChild
    if (open && last) box.scrollTop += last.getBoundingClientRect().top - box.getBoundingClientRect().top - 14
  }, [open, msgs, thinking])
  useEffect(() => {
    if (!open) return undefined
    const k = (e) => {
      if (e.key !== 'Escape' || document.querySelector('.modal-bg')) return
      if (cine) toggleCine(false); else setOpen(false)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, cine])
  useEffect(() => {
    if (!open || !cine) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open, cine])
  // Recargar a medias dejaría publicaciones sin crear
  useEffect(() => {
    if (!progress) return undefined
    const warn = (e) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [!!progress]) // eslint-disable-line react-hooks/exhaustive-deps

  // Los videos libres se cargan al abrir el panel si el plan tiene videos por crear
  const needVideos = items.some((x) => x.type === 'video' && !x.postId)
  useEffect(() => {
    if (!open || !needVideos || videos) return
    freeVideosFor(postsRef.current).then(setVideos).catch((e) => notify(e.message, 'err'))
  }, [open, needVideos, videos]) // eslint-disable-line react-hooks/exhaustive-deps

  const say = (who, text) => setMsgs((l) => [...l, { who, text }].slice(-MAX_MESSAGES))
  const patch = (key, change) => setItems((l) => l.map((x) => (x.key === key ? { ...x, ...change } : x)))
  const overLimit = () => aiTextUsed(session.id) >= access.limits.aiTextPerDay
  const limitMessage = () => t('Llegaste al límite de {n} textos con IA de hoy.', { n: access.limits.aiTextPerDay })

  const send = async (text) => {
    const message = text.trim()
    if (!message || busy) return
    voice.cancel()
    setDraft('')
    say('me', message)
    if (overLimit()) { say('err', limitMessage()); return }
    setThinking(true)
    try {
      const free = await freeVideosFor(postsRef.current).catch(() => null)
      if (free) setVideos(free)
      const pending = items.filter((x) => !x.postId)
      const made = items.length - pending.length
      const history = msgs.filter((m) => m.who !== 'err').slice(-8).map((m) => `${m.who === 'me' ? 'Usuario' : 'Alicia'}: ${m.text}`)
      if (made) history.push(`(Nota de la app: ya se crearon ${made} publicaciones. No puedes modificarlas; para eso está el botón «Ver y editar».)`)
      const r = await askAlicia({
        message, history, topics: TOPICS, freeVideos: free?.length || 0,
        calendar: calendarLines(new Date(), getLang()), now: new Date().toString().slice(0, 21),
        plan: pending.map(({ type, date, time, topic, asked }) => ({ type, date, time, topic, networks: asked || [] })),
      })
      aiTextBump(session.id)
      const clean = r.action === 'plan' ? cleanItems(r.items) : []
      if (r.action === 'plan' && !clean.length) throw new Error(t('No entendí las fechas. Dime los días de otra forma.'))
      say('ai', r.reply || t('Este es el plan. Revísalo antes de crear las publicaciones.'))
      if (!clean.length) return
      const taken = postsRef.current.filter((p) => p.status === 'scheduled').map((p) => p.scheduledAt)
      const planned = fillTimes(clean, taken).map(({ networks, ...it }) => ({
        ...it, key: uid(), asked: networks, platforms: networksFor(it.type, networks, accounts, access.limits.platforms),
      }))
      setItems(assignVideos(planned, free || [], items))
      if (made) say('ai', t('Las publicaciones que ya había creado siguen guardadas en Publicaciones. 📁'))
    } catch (e) {
      say('err', e.message)
      setDraft(message)
    } finally { setThinking(false) }
  }

  const [autoSend, setAutoSend] = useState(() => { try { return localStorage.getItem(AUTO_SEND_KEY) === '1' } catch { return false } })
  const toggleAutoSend = (on) => { setAutoSend(on); try { localStorage.setItem(AUTO_SEND_KEY, on ? '1' : '0') } catch { /* ignore */ } }
  const before = useRef('')
  const withVoice = (heard) => [before.current, heard].filter(Boolean).join(' ').slice(0, 1200)
  const voice = useSpeech({
    onText: (heard) => setDraft(withVoice(heard)),
    onDone: (heard) => { const text = withVoice(heard); setDraft(text); if (autoSend) send(text) },
    onError: (message) => say('err', message),
  })
  const talk = () => {
    if (voice.listening) return voice.stop()
    before.current = draft.trim()
    return voice.start()
  }

  const pending = items.filter((x) => !x.postId)
  const create = async () => {
    if (busy || !pending.length) return
    stop.current = false
    const queue = [...pending]
    // La pantalla se mantiene encendida: si el teléfono se bloquea, se corta la creación
    const awake = await navigator.wakeLock?.request('screen').catch(() => null)
    let done = 0
    for (let i = 0; i < queue.length && !stop.current; i++) {
      const it = queue[i]
      const onStep = (step) => setProgress({ key: it.key, n: i + 1, total: queue.length, step })
      onStep(t('Empezando…'))
      patch(it.key, { error: null })
      try {
        if (overLimit()) throw new Error(limitMessage())
        let content = null
        if (it.type === 'video') {
          // Se vuelve a comprobar: otra persona pudo usar el video mientras tanto
          const free = await freeVideosFor(postsRef.current)
          content = free.find((v) => v.id === it.contentId)
          if (!content) throw new Error(it.contentId ? t('Ese video ya no está disponible. Elige otro.') : t('Elige un video de Contenido para esta publicación.'))
        }
        const id = uid()
        const post = await createPost({ type: it.type, id, topic: it.topic, platforms: it.platforms, scheduledAt: slotTime(it.date, it.time), content, withPhoto, onStep })
        if (stop.current === 'unmounted') return
        savePost(post)
        postsRef.current = [post, ...postsRef.current] // para que el siguiente video no repita este
        aiTextBump(session.id)
        patch(it.key, { postId: post.id })
        done++
      } catch (e) {
        patch(it.key, { error: e?.message || String(e) })
      }
    }
    awake?.release().catch(() => {})
    setProgress(null)
    setVideos(null)
    if (done) say('ai', t('¡Listo! ✨ Creé {n} de {total} como borrador. Revísalas y, cuando quieras, pulsa «Programar todo».', { n: done, total: queue.length }))
    else say('ai', t('No pude crear las publicaciones. 😕 Mira el aviso de cada una y vuelve a intentarlo.'))
    notify(t('Alicia terminó: {n} de {total} publicaciones creadas.', { n: done, total: queue.length }), done ? 'ok' : 'err')
  }

  const postOf = (it) => (it.postId ? posts.find((p) => p.id === it.postId) : null)
  const drafts = items.filter((x) => postOf(x)?.status === 'draft')

  const schedule = () => {
    if (!access.limits.scheduledPerMonth) return openPlans(t('Programar publicaciones está disponible desde el plan PRO.'))
    let list = postsRef.current, count = 0
    for (const it of drafts) {
      const post = postOf(it)
      const at = slotTime(it.date, it.time)
      const missing = post.platforms.filter((p) => !accounts[p])
      const error = isPast(it.date, it.time) ? t('Esa hora ya pasó: cámbiala para poder programarla.')
        : missing.length ? t('Conecta primero: {p}', { p: missing.map((p) => PLATFORMS[p].name).join(', ') })
          : scheduledInMonth(list, at, post.id) >= access.limits.scheduledPerMonth ? t('Tu plan no permite programar más publicaciones ese mes.') : null
      patch(it.key, { error })
      if (error) continue
      const next = { ...post, status: 'scheduled', scheduledAt: at }
      savePost(next)
      list = list.map((p) => (p.id === next.id ? next : p))
      count++
    }
    if (count) say('ai', t('📅 Programé {n}. Deja la app abierta a la hora de publicar: desde ella se envían.', { n: count }))
    if (count < drafts.length) say('ai', t('Quedaron {n} sin programar: mira el aviso de cada una.', { n: drafts.length - count }))
    return undefined
  }

  const change = (it, value) => {
    const next = { ...it, ...value, error: null }
    patch(it.key, { ...value, error: null })
    // En un borrador ya creado, la fecha nueva se guarda también en la publicación
    const post = postOf(it)
    const at = slotTime(next.date, next.time)
    if (post?.status === 'draft' && at) savePost({ ...post, scheduledAt: at })
  }

  const clear = () => { setMsgs([]); setItems([]); setDraft(''); setVideos(null) }

  const launch = () => {
    if (!access.limits.autoPost) return openPlans(t('Alicia está disponible en el plan Premium.'))
    return setOpen(true)
  }

  if (!open) {
    return (
      <button type="button" className={'ali-fab' + (progress ? ' working' : '')} onClick={launch} aria-label={t('Abrir a Alicia, tu asistente')}>
        <span aria-hidden="true">👩‍💼</span>
        <b>{progress ? `${progress.n}/${progress.total}` : 'Alicia'}</b>
      </button>
    )
  }

  const created = items.length - pending.length
  const empty = !msgs.length && !items.length
  const status = progress ? t('Creando tus publicaciones…') : thinking ? t('Pensando…') : voice.listening ? t('Te escucho…') : t('Tu asistente de publicaciones')
  const cineLabel = cine ? t('Salir del modo cine') : t('Modo cine')
  // El envoltorio existe siempre: al cambiar de modo la ventana no se vuelve a montar
  return (
    <div className={'ali-wrap' + (cine ? ' cine' : '')} onClick={(e) => { if (cine && e.target === e.currentTarget) toggleCine(false) }}>
      <section className="ali" role="dialog" aria-modal={cine} aria-label="Alicia">
        <header className="ali-head">
          <span className={'ali-av' + (busy ? ' busy' : '')} aria-hidden="true">👩‍💼</span>
          <div className="ali-title">
            <b>Alicia</b>
            <small><i aria-hidden="true" /> <span>{status}</span></small>
          </div>
          <button type="button" className="ali-tool" disabled={busy || empty} onClick={clear} title={t('Nueva charla') + '. ' + t('Lo que ya se creó se conserva en Publicaciones.')} aria-label={t('Nueva charla')}><Glyph name="refresh" /></button>
          <button type="button" className="ali-tool" aria-pressed={cine} onClick={() => toggleCine(!cine)} title={cineLabel} aria-label={cineLabel}><Glyph name={cine ? 'shrink' : 'expand'} /></button>
          <button type="button" className="ali-tool" onClick={() => setOpen(false)} title={t('Cerrar')} aria-label={t('Cerrar')}><Icon name="x" size={18} /></button>
        </header>

        <div className="ali-body" ref={body}>
          <div className="ali-log" aria-live="polite">
            {empty && !thinking ? (
              <div className="ali-hero">
                <span className="ali-hero-av" aria-hidden="true">👩‍💼</span>
                <h2>{t('¡Hola! Soy Alicia')} 👋</h2>
                <p>{t('Dime qué publicaciones quieres y para qué días. Antes de crear nada te muestro el plan, y no programo nada sin tu confirmación.')}</p>
                <div className="ali-examples">
                  {EXAMPLES.map(([icon, x]) => (
                    <button key={x} type="button" disabled={busy} onClick={() => send(t(x))}><span aria-hidden="true">{icon}</span> <span>{t(x)}</span></button>
                  ))}
                </div>
              </div>
            ) : msgs.map((m, i) => (
              <div key={i} className={'ali-row ' + m.who}>
                {m.who !== 'me' && <span className="ali-mini" aria-hidden="true">👩‍💼</span>}
                <p className={'ali-msg ' + m.who}>{m.text}</p>
              </div>
            ))}
            {thinking && (
              <div className="ali-row ai">
                <span className="ali-mini" aria-hidden="true">👩‍💼</span>
                <p className="ali-msg ai ali-typing" role="status" aria-label={t('Pensando…')}><i /><i /><i /></p>
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="ali-plan">
              <span className="ali-plan-tag">{created ? t('Tus publicaciones') : t('Plan propuesto')} <em>{items.length}</em></span>
              <ul>
                {items.map((it) => (
                  <Item key={it.key} it={it} post={postOf(it)} videos={videos} busy={busy} working={progress?.key === it.key}
                    onChange={(value) => change(it, value)} onRemove={() => setItems((l) => l.filter((x) => x.key !== it.key))}
                    onEdit={(post) => { setOpen(false); onEdit(post) }} />
                ))}
              </ul>
            </div>
          )}
        </div>

        {(progress || pending.length > 0 || drafts.length > 0) && (
          <div className="ali-actions">
            {progress ? (
              <>
                <div className="ali-progress" role="status"><span className="ws-spin" /> <span><b>{progress.n}/{progress.total}</b> · {progress.step}</span></div>
                <button type="button" className="btn ghost sm" onClick={() => { stop.current = true; notify(t('Alicia se detendrá al terminar la publicación actual.')) }}>⏹ {t('Detener')}</button>
                <span className="ali-bar" aria-hidden="true"><i style={{ width: ((progress.n - 0.5) / progress.total) * 100 + '%' }} /></span>
              </>
            ) : (
              <>
                {pending.some((x) => x.type === 'image') && (
                  <label className="ali-check"><input type="checkbox" checked={withPhoto} onChange={(e) => setWithPhoto(e.target.checked)} /> {t('Intentar fondos con foto de IA (tarda más)')}</label>
                )}
                {pending.length > 0 && <button type="button" className="btn primary" disabled={busy} onClick={create}>✨ {t('Crear publicaciones')} ({pending.length})</button>}
                {drafts.length > 0 && <button type="button" className="btn blue" disabled={busy} onClick={schedule}><Icon name="clock" size={15} /> {t('Programar todo')} ({drafts.length})</button>}
              </>
            )}
          </div>
        )}

        <form className="ali-form" onSubmit={(e) => { e.preventDefault(); send(draft) }}>
          {voice.listening && <p className="voice-status" role="status"><i aria-hidden="true" /> {autoSend ? t('Escuchando… se envía cuando hagas una pausa.') : t('Escuchando… haz una pausa o pulsa «Detener».')}</p>}
          <div className={'ali-input' + (voice.listening ? ' listening' : '')}>
            <textarea rows={cine ? 2 : 1} value={draft} maxLength={1200} disabled={busy} readOnly={voice.listening} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(draft) } }}
              placeholder={voice.listening ? t('Te escucho…') : t('Escríbele a Alicia…')} aria-label={t('Escríbele a Alicia…')} />
            <button type="button" className={'ali-round mic' + (voice.listening ? ' on' : '')} disabled={busy && !voice.listening} aria-pressed={voice.listening} onClick={talk}
              title={voice.listening ? t('Detener') : t('Hablar')} aria-label={voice.listening ? t('Detener') : t('Hablar')}><Glyph name={voice.listening ? 'stop' : 'mic'} /></button>
            <button type="submit" className="ali-round send" disabled={busy || !draft.trim()} title={t('Enviar')} aria-label={t('Enviar')}><Glyph name="up" size={20} /></button>
          </div>
          {voice.supported && <label className="ali-check"><input type="checkbox" checked={autoSend} onChange={(e) => toggleAutoSend(e.target.checked)} /> {t('Enviar al terminar de hablar')}</label>}
        </form>
      </section>
    </div>
  )
}
