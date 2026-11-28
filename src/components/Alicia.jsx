// Alicia: la asistente de la app. Se le pide en palabras («2 imágenes y 1 video el lunes y el martes»), propone un plan,
// crea las publicaciones como borradores y las programa solo cuando el usuario lo confirma.
// Está siempre montada: sigue trabajando aunque se cierre el panel o se cambie de sección.
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../lib/store.jsx'
import { PLATFORMS, uid } from '../lib/formats.js'
import { askAlicia, createPost, pickIgMusic } from '../lib/aliciaCreate.js'
import { WhenPopover } from './WhenPicker.jsx'
import { calendarLines, cleanItems, fillTimes, isPast, networksFor, slotTime, soonTime, dayString, timeString } from '../lib/aliciaPlan.js'
import { fetchContent } from '../lib/content.js'
import { contentUse } from '../lib/contentDraft.js'
import { ANGLES } from '../lib/brand.js'
import { aiTextUsed, aiTextBump, scheduledInMonth } from '../lib/plans.js'
import { appContext, editorBridge, planEdit, editSavedPost, toWhen, EDITABLE } from '../lib/aliciaHelp.js'
import { composeCaption, sheetFromCaption, initialSheet } from '../lib/postSheet.js'
import { canQuickEdit } from '../lib/designInfo.js'
import { numbersIn, namedNumber } from '../lib/postNumbers.js'
import { renderToDataURL } from '../lib/render.js'
import AutoPost from './AutoPost.jsx'
import { useSpeech } from '../lib/useSpeech.js'
import { t, useLang, getLang, locale } from '../lib/i18n.jsx'
import { Icon, PlatformLogo, StatusTag } from './ui.jsx'
import AiOrb from './AiOrb.jsx'
import PostPreview from './PostPreview.jsx'

const AUTO_SEND_KEY = 'gz_voice_autosend'
const CINE_KEY = 'gz_alicia_cine'
const AUTO_MODE_KEY = 'gz_alicia_auto'
const MAX_MESSAGES = 40
const EXAMPLES = [
  ['🎬', 'Haz 2 publicaciones de imagen y 1 de video para el lunes y el martes'],
  ['🗓️', 'Una imagen cada día de la próxima semana, de lunes a viernes'],
  ['🛒', 'Mañana a las 10:00 una imagen sobre tiendas online'],
]
// Atajos mientras se está en el editor
const HELP = [
  ['👀', 'Revisa lo que estoy creando'],
  ['✍️', 'Mejora el texto'],
  ['#️⃣', 'Ponme mejores hashtags'],
]
const FIELDS = [['title', 'Título'], ['description', 'Descripción'], ['tags', 'Tags']]
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

/** Encabezado de una lista de la charla, con el botón para plegarla y que no tape la conversación. */
function ListHead({ label, count, folded, onToggle }) {
  return (
    <button type="button" className="ali-plan-tag" aria-expanded={!folded} onClick={onToggle}>
      <span>{label}</span> <em>{count}</em>
      <span className="ali-fold">{folded ? t('Ver') : t('Ocultar')} <i aria-hidden="true" /></span>
    </button>
  )
}

/** Fecha y hora de una publicación con el calendario propio de la app. */
function When({ date, time, disabled, onChange }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef(null)
  return (
    <>
      <button type="button" ref={anchor} className={'ali-field ali-when' + (open ? ' open' : '')} disabled={disabled} onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={t('Fecha') + ' ' + t('Hora')}>
        <span className="ali-field-ico" aria-hidden="true">🗓️</span>
        <span className="ali-field-txt">{dayLabel(date)}</span>
        <span className="ali-time">{time}</span>
      </button>
      {open && !disabled && <WhenPopover anchor={anchor.current} value={`${date}T${time}`} onClose={() => setOpen(false)} onChange={(v) => onChange({ date: v.slice(0, 10), time: v.slice(11, 16) })} />}
    </>
  )
}

/** Lista de videos de Contenido con su miniatura. */
function VideoPick({ videos, value, disabled, onChange }) {
  const [open, setOpen] = useState(false)
  const box = useRef(null)
  const chosen = videos.find((v) => v.id === value)
  const thumb = (v) => <span className="ali-field-ico" aria-hidden="true">{v?.thumb ? <img src={v.thumb} alt="" /> : '🎬'}</span>
  useEffect(() => {
    if (!open) return undefined
    const down = (e) => { if (!box.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [open])
  return (
    <div className="ali-pick" ref={box}>
      <button type="button" className={'ali-field' + (open ? ' open' : '')} disabled={disabled} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t('Video de Contenido')}>
        {thumb(chosen)}
        <span className="ali-field-txt">{chosen ? chosen.name : t('Elige un video de Contenido…')}</span>
        <i className="ali-chev" aria-hidden="true" />
      </button>
      {open && !disabled && (
        <ul className="ali-options">
          {videos.map((v) => (
            <li key={v.id}>
              <button type="button" className={v.id === value ? 'on' : ''} aria-pressed={v.id === value} onClick={() => { onChange(v.id); setOpen(false) }}>
                {thumb(v)}<span className="ali-field-txt">{v.name}</span>{v.id === value && <b aria-hidden="true">✓</b>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Item({ it, post, videos, busy, working, onChange, onRemove, onEdit, onQuick }) {
  const video = it.type === 'video' ? videos?.find((v) => v.id === it.contentId) : null
  const created = !!it.postId
  const editableDate = !created || post?.status === 'draft'
  // Una vez programada o publicada manda la fecha de la publicación
  const at = post && post.status !== 'draft' && post.scheduledAt ? new Date(post.scheduledAt) : null
  const date = at ? dayString(at) : it.date
  const time = at ? timeString(at) : it.time
  const thumb = post?.image || video?.thumb
  const networks = post?.platforms || it.platforms
  const [viewing, setViewing] = useState(false)
  const quick = useMemo(() => canQuickEdit(post), [post?.design, post?.mediaType]) // eslint-disable-line react-hooks/exhaustive-deps
  // La tarjeta de una publicación creada abre su vista previa, salvo al usar sus controles
  const view = (e) => {
    // La vista previa y el calendario son portales: sus clics también llegan aquí
    if (!e.currentTarget.contains(e.target) || e.target.closest('button, input, label')) return
    setViewing(true)
  }
  const picture = thumb ? <img src={thumb} alt="" /> : it.type === 'video' ? '🎬' : '🖼️'
  return (
    <li className={'ali-item' + (working ? ' working' : '') + (post ? ' can-view' : '')} onClick={post ? view : undefined}>
      <div className="ali-item-top">
        {post
          ? <button type="button" className="ali-thumb" onClick={() => setViewing(true)} title={t('Vista previa')} aria-label={t('Vista previa')}>{picture}</button>
          : <span className="ali-thumb" aria-hidden="true">{picture}</span>}
        <div className="ali-item-info">
          <b>{post?.num && <span className="post-num">#{post.num}</span>}{it.type === 'video' ? t('Video') : t('Imagen')} · {dayLabel(date)}</b>
          <span className="ali-nets">{networks.map((p) => <span key={p} title={PLATFORMS[p].name}><PlatformLogo id={p} size={14} /></span>)}</span>
          {post && <StatusTag s={post.status} />}
          {created && !post && <small className="muted">{t('Esta publicación ya no está.')}</small>}
        </div>
        {!created && <button type="button" className="icon-btn" disabled={busy} onClick={onRemove} title={t('Quitar')} aria-label={t('Quitar')}><Icon name="x" size={15} /></button>}
      </div>
      <When date={date} time={time} disabled={busy || !editableDate} onChange={onChange} />
      {editableDate && isPast(date, time) && <p className="ali-warn">⚠️ {t('Esa hora ya pasó: cámbiala para poder programarla.')}</p>}
      {!created && (
        <>
          <input type="text" value={it.topic} maxLength={160} disabled={busy} aria-label={t('Tema')} onChange={(e) => onChange({ topic: e.target.value })}
            placeholder={it.type === 'video' ? t('Tema (opcional: la IA mira el video)') : t('Tema (si queda vacío, uno al azar)')} />
          {it.type === 'video' && videos && (videos.length
            ? <VideoPick videos={videos} value={it.contentId} disabled={busy} onChange={(contentId) => onChange({ contentId })} />
            : <p className="ali-warn">⚠️ {t('No hay videos libres. Sube uno en la sección Contenido.')}</p>)}
          <label className="ali-check"><input type="checkbox" checked={!!it.music} disabled={busy} onChange={(e) => onChange({ music: e.target.checked })} /> 🎵 {it.type === 'video' ? t('Con música de Instagram') : t('Con música: en Instagram sale como Reel')}</label>
        </>
      )}
      {post?.igMusic && <p className="ali-song">🎵 {[post.igMusic.title, post.igMusic.artist].filter(Boolean).join(' · ')}</p>}
      {post && <p className="ali-cap">{post.caption}</p>}
      {it.error && <p className="ali-warn">❌ {it.error}</p>}
      {post && !['published', 'publishing'].includes(post.status) && (
        <div className="ali-item-btns">
          <button type="button" className="btn ghost sm" disabled={busy} onClick={() => onEdit(post)}><Icon name="edit" size={13} /> {t('Ver y editar')}</button>
          {quick && <button type="button" className="btn primary sm" disabled={busy} onClick={() => onQuick(post)}>⚡ {t('Edición rápida')}</button>}
        </div>
      )}
      {viewing && post && <PostPreview p={post} onClose={() => setViewing(false)} />}
    </li>
  )
}

/** Un cambio propuesto por Alicia: se aplica solo cuando el usuario lo pulsa. */
function Change({ ed, post, busy, onApply, onUndo, onRemove }) {
  const v = ed.values
  const name = ed.target === 'editor' ? t('La publicación del editor') : post ? initialSheet(post.sheet, post.caption).title || post.caption.slice(0, 60) : t('Esta publicación ya no está.')
  return (
    <li className={'ali-item ali-change' + (ed.before || ed.sent || ed.rebuilt ? ' done' : '')}>
      <div className="ali-item-top">
        <span className="ali-thumb" aria-hidden="true">{post?.image ? <img src={post.image} alt="" /> : '✏️'}</span>
        <div className="ali-item-info">
          <b>{post?.num && <span className="post-num">#{post.num}</span>}{name}</b>
          {post && <StatusTag s={post.status} />}
        </div>
        <button type="button" className="icon-btn" disabled={busy} onClick={onRemove} title={t('Quitar')} aria-label={t('Quitar')}><Icon name="x" size={15} /></button>
      </div>
      <dl>
        {v.rebuild && <div><dt>{t('Acción')}</dt><dd>{t('Reconstruir la imagen')}</dd></div>}
        {v.send && <div><dt>{t('Acción')}</dt><dd>{v.send === 'now' ? t('Publicar ahora') : t('Programar')}</dd></div>}
        {FIELDS.filter(([k]) => v[k]).map(([k, label]) => <div key={k}><dt>{t(label)}</dt><dd>{v[k]}</dd></div>)}
        {v.networks.length > 0 && <div><dt>{t('Redes')}</dt><dd>{v.networks.map((p) => PLATFORMS[p]?.name || p).join(', ')}</dd></div>}
        {(v.date || v.time) && <div><dt>{t('Fecha')}</dt><dd>{[v.date, v.time].filter(Boolean).join(' · ')}</dd></div>}
      </dl>
      {ed.error && <p className="ali-warn">❌ {ed.error}</p>}
      {v.rebuild ? (
        <div className="ali-change-act">
          {ed.rebuilt && <span className="ali-done">✅ {ed.inEditor ? t('Aplicado en el editor: revisa y guarda, programa o publica.') : t('Cambio guardado.')}</span>}
          <button type="button" className={'btn sm ' + (ed.rebuilt ? 'ghost' : 'primary')} disabled={busy} onClick={onApply}>🔁 {ed.rebuilt ? t('Reconstruir otra vez') : t('Ver la nueva versión')}</button>
        </div>
      ) : ed.sent ? (
        <div className="ali-change-act"><span className="ali-done">✅ {ed.sent === 'now' ? t('Enviada a publicar.') : t('Quedó programada.')}</span></div>
      ) : ed.before ? (
        <div className="ali-change-act">
          <span className="ali-done">✅ {ed.inEditor ? t('Aplicado en el editor: revisa y guarda, programa o publica.') : t('Cambio guardado.')}</span>
          <button type="button" className="btn ghost sm" disabled={busy} onClick={onUndo}>↩️ {t('Deshacer')}</button>
        </div>
      ) : (
        <div className="ali-change-act">
          <button type="button" className="btn primary sm" disabled={busy} onClick={onApply}>{v.send === 'now' ? `🚀 ${t('Publicar ahora')}` : v.send === 'schedule' ? `📅 ${t('Programar')}` : `✨ ${t('Aplicar cambios')}`}</button>
        </div>
      )}
    </li>
  )
}

export default function Alicia({ page, onEdit }) {
  const { session, posts, accounts, access, openPlans, savePost, publishNow, notify } = useApp()
  useLang()
  const storeKey = `gz_alicia_${session.id}`
  const [open, setOpen] = useState(false)
  const [cine, setCine] = useState(() => { try { return localStorage.getItem(CINE_KEY) === '1' } catch { return false } })
  const toggleCine = (on) => { setCine(on); try { localStorage.setItem(CINE_KEY, on ? '1' : '0') } catch { /* ignore */ } }
  const [msgs, setMsgs] = useState(() => read(storeKey).msgs || []) // { who: 'me' | 'ai' | 'err', text }
  const [items, setItems] = useState(() => read(storeKey).items || [])
  const [edits, setEdits] = useState(() => read(storeKey).edits || []) // cambios propuestos a publicaciones
  const [withPhoto, setWithPhoto] = useState(() => read(storeKey).withPhoto !== false)
  const [draft, setDraft] = useState('')
  // Modo autoritario: crea, programa y publica lo pedido sin preguntar. Se recuerda en este dispositivo.
  const autoKey = `${AUTO_MODE_KEY}_${session.id}`
  const [auto, setAuto] = useState(() => { try { return localStorage.getItem(autoKey) === '1' } catch { return false } })
  const toggleAuto = () => setAuto((on) => { try { localStorage.setItem(autoKey, on ? '0' : '1') } catch { /* ignore */ } return !on })
  const [folded, setFolded] = useState(() => read(storeKey).folded || {}) // listas plegadas: { plan, edits }
  const fold = (name) => setFolded((f) => ({ ...f, [name]: !f[name] }))
  const [watch, setWatch] = useState(() => read(storeKey).watch || []) // lo que lanzó sola y aún no termina
  const [thinking, setThinking] = useState(false)
  const [quick, setQuick] = useState(null) // edición rápida abierta: { target, editKey, initial }
  const [progress, setProgress] = useState(null) // { key, n, total, step } mientras se crean
  const [videos, setVideos] = useState(null) // videos libres de Contenido; null = sin cargar
  const stop = useRef(false)
  const sending = useRef(new Set()) // lo que se está mandando a publicar, para no hacerlo dos veces
  const body = useRef(null)
  const postsRef = useRef(posts); postsRef.current = posts
  const busy = thinking || !!progress

  useEffect(() => {
    try { localStorage.setItem(storeKey, JSON.stringify({ msgs: msgs.slice(-MAX_MESSAGES), items, edits, watch, folded, withPhoto })) } catch { /* ignore */ }
  }, [msgs, items, edits, watch, folded, withPhoto, storeKey])
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
      if (e.key !== 'Escape' || document.querySelector('.modal-bg, .wp')) return
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
  // En pantallas anchas la app se corre a un lado para ver el editor junto a Alicia
  useEffect(() => {
    if (!open || cine) return undefined
    document.body.classList.add('ali-docked')
    return () => document.body.classList.remove('ali-docked')
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
    let job = null // lo que toca hacer sin preguntar, cuando la IA ya contestó
    try {
      const free = await freeVideosFor(postsRef.current).catch(() => null)
      if (free) setVideos(free)
      const pending = items.filter((x) => !x.postId)
      const made = items.length - pending.length
      const history = msgs.filter((m) => m.who !== 'err').slice(-8).map((m) => `${m.who === 'me' ? 'Usuario' : 'Alicia'}: ${m.text}`)
      if (made) history.push(`(Nota de la app: ya se crearon ${made} publicaciones y están en "posts". No las vuelvas a crear: para cambiarlas, publicarlas o programarlas usa "edit".)`)
      const editor = editorBridge.current?.snapshot() || null
      const picture = editor?.hasMedia ? await editorBridge.current.image().catch(() => null) : null
      const { context, refs } = appContext({ page, posts: postsRef.current, accounts, editor, onScreen: items.map((x) => x.postId).filter(Boolean), numbers: numbersIn(message) })
      const r = await askAlicia({
        context, image: picture, auto,
        message, history, topics: TOPICS, freeVideos: free?.length || 0,
        calendar: calendarLines(new Date(), getLang()), now: new Date().toString().slice(0, 21),
        // En modo autoritario solo se actúa sobre lo que se pide ahora: un plan viejo sin crear no se lanza solo
        plan: auto ? [] : pending.map(({ type, date, time, topic, asked, music, musicQuery }) => ({ type, date, time, topic, networks: asked || [], music: !!music, musicQuery: musicQuery || '' })),
      })
      aiTextBump(session.id)
      const clean = r.action === 'plan' ? cleanItems(r.items) : []
      const proposed = (r.action === 'edit' ? r.edits || [] : []).map(({ target, ...values }) => ({
        key: uid(), target: target === 'editor' ? (editor ? 'editor' : null) : refs[target], editorId: editor?.id,
        // Una versión nueva siempre la elige el usuario: nunca se publica ni se programa junto con ella
        values: { ...values, networks: values.networks || [], ...(values.rebuild ? { title: '', description: '', tags: '', date: '', time: '', networks: [], send: '', request: message } : {}) },
      })).filter((e) => e.target)
      // Si el usuario nombró una por su número («la publicación 3»), manda ese número aunque la IA haya elegido otra
      const num = namedNumber(message)
      const named = num ? postsRef.current.find((p) => p.num === num) : null
      if (named && proposed.length === 1) Object.assign(proposed[0], { target: named.id === editor?.id ? 'editor' : named.id, editorId: editor?.id })
      if (r.action === 'edit' && !proposed.length) throw new Error(t('No supe qué publicación cambiar. Dime cuál es.'))
      if (r.action === 'plan' && !clean.length) throw new Error(t('No entendí las fechas. Dime los días de otra forma.'))
      say('ai', r.reply || (proposed.length ? t('Te propongo estos cambios. Revísalos antes de aplicarlos.') : t('Este es el plan. Revísalo antes de crear las publicaciones.')))
      // Un servidor sin actualizar no entiende este modo (ignoraría la música): ahí se pide confirmación como siempre
      const free_ = auto && !!r.publish
      if (auto && !r.publish) say('err', t('El modo autoritario necesita actualizar el servidor de Alicia. Por ahora confirma tú con los botones.'))
      if (proposed.length) {
        setEdits(proposed)
        setFolded((f) => ({ ...f, edits: false }))
        const redo = proposed.find((e) => e.values.rebuild) // la versión nueva se abre sola
        if (free_) job = async () => { for (const e of proposed) if (!e.values.rebuild) await apply(e); if (redo) apply(redo) }
        else if (redo) job = () => apply(redo)
      }
      // Sin `return` aquí: lo que haya que hacer sola (`job`) se ejecuta al final, también si solo son cambios
      if (clean.length) {
        const taken = postsRef.current.filter((p) => p.status === 'scheduled').map((p) => p.scheduledAt)
        const planned = fillTimes(clean, taken).map(({ networks, ...it }) => ({
          ...it, key: uid(), asked: networks, platforms: networksFor(it.type, networks, accounts, access.limits.platforms),
        }))
        const next = assignVideos(planned, free || [], free_ ? [] : items)
        setItems(next)
        setFolded((f) => ({ ...f, plan: false }))
        if (free_) job = () => run(next, r.publish === 'draft' ? null : r.publish)
        if (made) say('ai', t('Las publicaciones que ya había creado siguen guardadas en Publicaciones. 📁'))
      }
    } catch (e) {
      say('err', e.message)
      setDraft(message)
    } finally { setThinking(false) }
    await job?.()
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
  const clock = (ts) => timeString(new Date(ts))
  const watchPost = (id) => setWatch((l) => [...l.filter((x) => x !== id), id].slice(-30))
  const missingError = (platforms) => {
    const missing = platforms.filter((p) => !accounts[p])
    return missing.length ? t('Conecta primero: {p}', { p: missing.map((p) => PLATFORMS[p].name).join(', ') }) : null
  }
  /** Deja la publicación programada para `at`. Lanza un error si no se puede. */
  const scheduleAt = (post, at) => {
    if (!access.limits.scheduledPerMonth || scheduledInMonth(postsRef.current, at, post.id) >= access.limits.scheduledPerMonth) throw new Error(t('Tu plan no permite programar más publicaciones ese mes.'))
    const next = { ...post, status: 'scheduled', scheduledAt: at }
    savePost(next)
    postsRef.current = [next, ...postsRef.current.filter((p) => p.id !== next.id)]
    watchPost(next.id)
  }
  /** Publica ya. Si ni siquiera se puede empezar, la deja programada para unos minutos después y lo cuenta. */
  const publishOrSoon = async (post) => {
    savePost(post, { publishing: true })
    postsRef.current = [post, ...postsRef.current.filter((p) => p.id !== post.id)]
    await new Promise((r) => setTimeout(r, 150)) // el guardado se asienta antes de publicar
    publishNow(post.id).then((result) => {
      // Se avisa cómo terminó recién ahora: una que había fallado antes todavía figuraría como fallida
      if (result !== 'unreached') { if (result === 'done') watchPost(post.id); return }
      const at = soonTime()
      try {
        scheduleAt(post, at)
        say('ai', t('⏳ No pude publicarla al instante, así que la programé para las {h}, en unos minutos. Deja la app abierta: desde ella se envía.', { h: clock(at) }))
      } catch (e) { say('err', t('No pude publicarla ni programarla: {e}', { e: e.message })) }
    })
    return t('🚀 La estoy publicando ahora.')
  }
  /** Programa para `at`; si esa hora ya no alcanza, para unos minutos después. Devuelve el mensaje para el chat. */
  const scheduleOrSoon = (post, at) => {
    if (at > Date.now() + 30000) {
      scheduleAt(post, at)
      return t('📅 Programada para {w}. Deja la app abierta a esa hora: desde ella se envía.', { w: `${dayLabel(dayString(new Date(at)))} · ${clock(at)}` })
    }
    const soon = soonTime()
    scheduleAt(post, soon)
    return t('⏳ La hora pedida ya pasó, así que la programé para las {h}, en unos minutos. Deja la app abierta: desde ella se envía.', { h: clock(soon) })
  }

  // Programa o publica sin preguntar lo que se acaba de crear en modo autoritario. Devuelve el mensaje para el chat.
  const launchNow = async (it, post, mode, wasFuture) => {
    const at = slotTime(it.date, it.time)
    const missing = missingError(post.platforms)
    if (missing) throw new Error(missing)
    // Si la hora pedida llegó mientras se creaba, se publica ya; si ya había pasado al pedirlo, en unos minutos
    if (mode === 'now' || (wasFuture && at <= Date.now())) return publishOrSoon(post)
    return scheduleOrSoon(post, at)
  }

  /** Crea las publicaciones de `list`. Con `mode` ('schedule' | 'now') además las programa o publica sin preguntar. */
  const run = async (list, mode = null) => {
    if (!list.length) return
    stop.current = false
    const queue = [...list]
    const requested = Date.now()
    // La pantalla se mantiene encendida: si el teléfono se bloquea, se corta la creación
    const awake = await navigator.wakeLock?.request('screen').catch(() => null)
    let done = 0
    const numbered = [] // números de las creadas, para avisarlos al terminar
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
          if (!content) throw new Error(it.contentId ? t('Ese video ya no está disponible. Elige otro.') : free.length ? t('Elige un video de Contenido para esta publicación.') : t('No hay videos libres. Sube uno en la sección Contenido.'))
        }
        // La música se elige antes de crear: si no se puede poner, no se gasta nada ni se publica sin ella
        let igMusic = null
        if (it.music) {
          if (!it.platforms.includes('instagram') || !accounts.instagram?.real) throw new Error(t('La música solo se puede poner en Reels con Instagram conectado.'))
          onStep(t('Eligiendo la música…'))
          igMusic = await pickIgMusic(it.musicQuery, { photo: it.type === 'image' })
        }
        const id = uid()
        const made = await createPost({ type: it.type, id, topic: it.topic, platforms: it.platforms, scheduledAt: slotTime(it.date, it.time), content, withPhoto, onStep })
        const post = igMusic ? { ...made, igMusic } : made
        if (stop.current === 'unmounted') return
        const saved = savePost(post)
        postsRef.current = [saved, ...postsRef.current] // para que el siguiente video no repita este
        aiTextBump(session.id)
        patch(it.key, { postId: saved.id })
        numbered.push('#' + saved.num)
        done++
        // Si se pulsó «Detener», lo ya creado queda como borrador
        if (mode && !stop.current) {
          const note = await launchNow(it, saved, mode, slotTime(it.date, it.time) > requested)
          say('ai', `#${saved.num} · ` + (igMusic ? t('🎵 Le puse «{m}».', { m: [igMusic.title, igMusic.artist].filter(Boolean).join(' · ') }) + ' ' : '') + note)
        }
      } catch (e) {
        const message = e?.message || String(e)
        patch(it.key, { error: message })
        if (mode) say('err', message)
      }
    }
    awake?.release().catch(() => {})
    setProgress(null)
    setVideos(null)
    if (!done) say('ai', t('No pude crear las publicaciones. 😕 Mira el aviso de cada una y vuelve a intentarlo.'))
    else if (!mode) say('ai', t('¡Listo! ✨ Creé {n} de {total} como borrador. Revísalas y, cuando quieras, pulsa «Programar todo».', { n: done, total: queue.length }) + ' ' + t('Son: {list}. Nómbralas por su número para pedirme cambios.', { list: numbered.join(', ') }))
    notify(t('Alicia terminó: {n} de {total} publicaciones creadas.', { n: done, total: queue.length }), done ? 'ok' : 'err')
  }
  const create = () => (busy ? undefined : run(pending))

  // De lo que Alicia lanzó sola, avisa en el chat cómo terminó
  useEffect(() => {
    const ended = watch.map((id) => posts.find((p) => p.id === id)).filter((p) => p && ['published', 'failed'].includes(p.status))
    if (!ended.length) return
    setWatch((l) => l.filter((id) => !ended.some((p) => p.id === id)))
    for (const p of ended) {
      if (p.status === 'published') say('ai', t('✅ ¡Publicada con éxito!'))
      else say('err', t('La publicación falló: {e}', { e: Object.entries(p.results || {}).filter(([, r]) => !r.ok).map(([k, r]) => `${PLATFORMS[k]?.name || k}: ${r.error}`).join(' · ') }))
    }
  }, [posts, watch]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const markEdit = (key, value) => setEdits((l) => l.map((x) => (x.key === key ? { ...x, ...value } : x)))
  /** El editor abierto, si es la publicación a la que apunta el cambio. */
  const editorFor = (ed) => {
    const live = editorBridge.current?.snapshot()
    return live && live.id === (ed.target === 'editor' ? ed.editorId : ed.target) ? live : null
  }
  // Lo que el editor tiene a medio hacer de una publicación guardada se actualiza igual, para que no tape el cambio
  const patchWip = (post, extra = {}) => {
    const key = `gz_wip_${session.id}_${post.id}`
    try {
      const wip = JSON.parse(localStorage.getItem(key))
      if (wip) localStorage.setItem(key, JSON.stringify({ ...wip, sheet: post.sheet, caption: post.caption, platforms: post.platforms, ...(post.scheduledAt ? { when: toWhen(post.scheduledAt) } : {}), ...extra }))
    } catch { /* ignore */ }
  }
  /** Publica o programa una publicación que ya existe (la del editor o una guardada). */
  const sendPost = async (ed) => {
    const { send: mode, date, time } = ed.values
    const lock = ed.key // una tarjeta enviada no se vuelve a enviar, ni con un doble clic
    if (sending.current.has(lock)) return
    sending.current.add(lock)
    try {
      const content = { ...ed.values, date: '', time: '' } // la hora se resuelve al programar, con su plan B
      const changes = content.title || content.description || content.tags || content.networks.length
      let post, close, planned
      const live = editorFor(ed)
      if (live) {
        planned = live.when
        if (changes) {
          const r = planEdit({ sheet: live.sheet, platforms: live.platforms, when: live.when, mediaType: live.mediaType }, content, access)
          if (r.error) throw new Error(r.error)
          editorBridge.current.apply(r.next)
          await new Promise((res) => setTimeout(res, 250)) // el editor termina de actualizarse
        }
        const ready = await editorBridge.current.prepare()
        if (ready.error) throw new Error(ready.error)
        post = ready.post; close = ready.close
      } else {
        if (ed.target === 'editor') throw new Error(t('Abre esa publicación en el editor para aplicar el cambio.'))
        const saved = postsRef.current.find((p) => p.id === ed.target)
        if (!saved) throw new Error(t('Esta publicación ya no está.'))
        if (!EDITABLE.includes(saved.status)) throw new Error(t('Esa publicación ya no se puede cambiar.'))
        const r = editSavedPost(saved, content, { access, accounts, posts: postsRef.current })
        if (r.error) throw new Error(r.error)
        post = r.post
        planned = saved.scheduledAt ? toWhen(saved.scheduledAt) : ''
      }
      const missing = missingError(post.platforms)
      if (missing) throw new Error(missing)
      let note
      if (mode === 'now') note = await publishOrSoon(post)
      else {
        const at = slotTime(date || planned.slice(0, 10), time || planned.slice(11, 16))
        if (!Number.isFinite(at)) throw new Error(t('No entendí las fechas. Dime los días de otra forma.'))
        note = scheduleOrSoon(post, at)
      }
      patchWip(postsRef.current.find((p) => p.id === post.id) || post)
      close?.()
      markEdit(ed.key, { error: null, sent: mode, before: null })
      say('ai', note)
    } catch (e) {
      markEdit(ed.key, { error: e.message })
      say('err', e.message)
      sending.current.delete(lock) // no salió: se puede volver a intentar
    }
  }

  /** Abre la edición rápida de la publicación `target` (con `request`, la IA reconstruye una versión). */
  const openQuick = (target, request = '', editKey = null) => {
    const live = editorBridge.current?.snapshot()
    const inEditor = !!live && live.id === target
    const post = postsRef.current.find((p) => p.id === target)
    const from = inEditor ? editorBridge.current.design() : post
    const error = !from ? t('Esta publicación ya no está.')
      : !inEditor && !EDITABLE.includes(post.status) ? t('Esa publicación ya no se puede cambiar.')
        : !canQuickEdit(from) ? t('Esta imagen no admite edición rápida: ábrela con «Ver y editar».') : null
    if (editKey) markEdit(editKey, { error })
    if (error) return say('err', error)
    return setQuick({ target, editKey, initial: { design: from.design, caption: from.caption, platforms: from.platforms, request } })
  }
  /** Guarda la versión elegida: en el editor si la publicación está abierta, y si no, en la publicación guardada. */
  const saveQuick = async (r) => {
    const { target, editKey, initial } = quick
    setQuick(null)
    try {
      const sheet = r.caption !== initial.caption ? sheetFromCaption(r.caption) : null
      const live = editorBridge.current?.snapshot()
      const inEditor = !!live && live.id === target
      if (inEditor) editorBridge.current.applyDesign(r.design, sheet)
      else {
        const image = await renderToDataURL(r.design)
        const post = postsRef.current.find((p) => p.id === target)
        if (!post || !EDITABLE.includes(post.status)) throw new Error(t('Esa publicación ya no se puede cambiar.'))
        const maxLen = Math.min(...(post.platforms.length ? post.platforms : ['instagram']).map((p) => PLATFORMS[p].limit))
        const caption = sheet ? composeCaption(sheet) : post.caption
        if (caption.length > maxLen) throw new Error(t('El texto supera el límite de {n} caracteres', { n: maxLen }))
        const next = { ...post, design: r.design, format: r.design.format, image, ...(sheet ? { sheet, caption } : {}) }
        savePost(next)
        postsRef.current = postsRef.current.map((p) => (p.id === next.id ? next : p))
        patchWip(next, { design: next.design })
      }
      if (editKey) markEdit(editKey, { error: null, rebuilt: true, inEditor })
      const tag = postsRef.current.find((p) => p.id === target)?.num
      say('ai', (tag ? `#${tag} · ` : '') + (inEditor ? t('✨ Puse la nueva versión en el editor: revisa y guarda, programa o publica.') : t('✨ Guardé la nueva versión de la publicación.')))
    } catch (e) {
      if (editKey) markEdit(editKey, { error: e.message })
      say('err', e.message)
    }
  }

  const apply = (ed) => {
    if (ed.values.rebuild) return openQuick(ed.target === 'editor' ? ed.editorId : ed.target, ed.values.request, ed.key)
    if (ed.sent) return undefined
    if (ed.values.send) return sendPost(ed)
    const live = editorFor(ed)
    if (live) {
      const r = planEdit({ sheet: live.sheet, platforms: live.platforms, when: live.when, mediaType: live.mediaType }, ed.values, access)
      if (r.error) return markEdit(ed.key, { error: r.error })
      editorBridge.current.apply(r.next)
      markEdit(ed.key, { error: null, inEditor: true, before: { sheet: live.sheet, platforms: live.platforms, when: live.when } })
      // En el teléfono el panel tapa el editor: se cierra para que se vea el cambio
      if (window.matchMedia('(max-width: 600px)').matches) { setOpen(false); notify(t('Cambios aplicados en el editor ✨')) }
      return undefined
    }
    if (ed.target === 'editor') return markEdit(ed.key, { error: t('Abre esa publicación en el editor para aplicar el cambio.') })
    const post = postsRef.current.find((p) => p.id === ed.target)
    if (!post) return markEdit(ed.key, { error: t('Esta publicación ya no está.') })
    const r = editSavedPost(post, ed.values, { access, accounts, posts: postsRef.current })
    if (r.error) return markEdit(ed.key, { error: r.error })
    savePost(r.post)
    patchWip(r.post)
    const { sheet, caption, platforms, scheduledAt } = post
    return markEdit(ed.key, { error: null, inEditor: false, before: { sheet: initialSheet(sheet, caption), caption, platforms, scheduledAt } })
  }
  const undo = (ed) => {
    if (ed.inEditor) {
      if (!editorFor(ed)) return markEdit(ed.key, { error: t('Abre esa publicación en el editor para deshacer el cambio.') })
      editorBridge.current.apply(ed.before)
    } else {
      const post = postsRef.current.find((p) => p.id === ed.target)
      if (!post || !EDITABLE.includes(post.status)) return markEdit(ed.key, { error: t('Esa publicación ya no se puede cambiar.') })
      const old = { ...post, ...ed.before }
      // Volver a una hora que ya pasó haría que se publicara al instante
      if (old.status === 'scheduled' && !(old.scheduledAt > Date.now())) return markEdit(ed.key, { error: t('No se puede deshacer: la hora anterior ya pasó y se publicaría al instante.') })
      savePost(old)
      patchWip(old)
    }
    return markEdit(ed.key, { error: null, before: null })
  }

  const clear = () => { setMsgs([]); setItems([]); setEdits([]); setDraft(''); setVideos(null) } // lo programado se sigue vigilando

  const launch = () => {
    if (!access.limits.autoPost) return openPlans(t('Alicia está disponible en el plan Premium.'))
    return setOpen(true)
  }

  if (!open) {
    return (
      <button type="button" className={'ali-fab' + (progress ? ' working' : '')} onClick={launch} aria-label={t('Abrir a Alicia, tu asistente')}>
        <AiOrb className="ali-fab-aiorb" busy={!!progress} />
        <b>{progress ? `${progress.n}/${progress.total}` : 'Alicia'}</b>
      </button>
    )
  }

  const created = items.length - pending.length
  const empty = !msgs.length && !items.length && !edits.length
  const composing = page === 'composer'
  const status = progress ? t('Creando tus publicaciones…') : thinking ? t('Pensando…') : voice.listening ? t('Te escucho…') : composing ? t('Viendo lo que estás creando 👀') : auto ? t('Modo autoritario activo ⚡') : t('Tu asistente de publicaciones')
  const cineLabel = cine ? t('Salir del modo cine') : t('Modo cine')
  // El envoltorio existe siempre: al cambiar de modo la ventana no se vuelve a montar
  return (
    <div className={'ali-wrap' + (cine ? ' cine' : '') + (auto ? ' auto' : '')} onClick={(e) => { if (cine && e.target === e.currentTarget) toggleCine(false) }}>
      <section className="ali" role="dialog" aria-modal={cine} aria-label="Alicia">
        <header className="ali-head">
          <AiOrb className="ali-av" orbit busy={busy} />
          <div className="ali-title">
            <b>Alicia</b>
            <small><i aria-hidden="true" /> <span>{status}</span></small>
          </div>
          <button type="button" className="ali-tool" disabled={busy || empty} onClick={clear} title={t('Nueva charla') + '. ' + t('Lo que ya se creó se conserva en Publicaciones.')} aria-label={t('Nueva charla')}><Glyph name="refresh" /></button>
          <button type="button" className="ali-tool" aria-pressed={cine} onClick={() => toggleCine(!cine)} title={cineLabel} aria-label={cineLabel}><Glyph name={cine ? 'shrink' : 'expand'} /></button>
          <button type="button" className="ali-tool" onClick={() => setOpen(false)} title={t('Cerrar')} aria-label={t('Cerrar')}><Icon name="x" size={18} /></button>
        </header>

        <button type="button" className="ali-auto" role="switch" aria-checked={auto} disabled={busy} onClick={toggleAuto}>
          <span className="ali-auto-ico" aria-hidden="true">⚡</span>
          <span className="ali-auto-txt">
            <b>{t('Modo autoritario')}</b>
            <small>{auto ? t('Alicia crea, programa y publica sin preguntar.') : t('Alicia te pide confirmación antes de actuar.')}</small>
          </span>
          <em>{auto ? 'ON' : 'OFF'}</em>
          <i aria-hidden="true" />
        </button>

        <div className="ali-body" ref={body}>
          <div className="ali-log" aria-live="polite">
            {empty && !thinking ? (
              <div className="ali-hero">
                <AiOrb className="ali-hero-av" orbit />
                <h2>{t('¡Hola! Soy Alicia')} 👋</h2>
                <p>{auto ? t('Dime qué publicar y cuándo. Lo hago todo sola: elijo el video y la música, y lo programo o publico sin preguntarte.') : t('Dime qué publicaciones quieres y para qué días. Antes de crear nada te muestro el plan, y no programo nada sin tu confirmación.')}</p>
                <div className="ali-examples">
                  {EXAMPLES.map(([icon, x]) => (
                    <button key={x} type="button" disabled={busy} onClick={() => send(t(x))}><span aria-hidden="true">{icon}</span> <span>{t(x)}</span></button>
                  ))}
                </div>
              </div>
            ) : msgs.map((m, i) => (
              <div key={i} className={'ali-row ' + m.who}>
                {m.who !== 'me' && <AiOrb className="ali-mini" />}
                <p className={'ali-msg ' + m.who}>{m.text}</p>
              </div>
            ))}
            {thinking && (
              <div className="ali-row ai">
                <AiOrb className="ali-mini" busy />
                <p className="ali-msg ai ali-typing" role="status" aria-label={t('Pensando…')}><i /><i /><i /></p>
              </div>
            )}
          </div>

          {edits.length > 0 && (
            <div className="ali-plan">
              <ListHead label={t('Cambios propuestos')} count={edits.length} folded={folded.edits} onToggle={() => fold('edits')} />
              <ul hidden={folded.edits}>
                {edits.map((ed) => (
                  <Change key={ed.key} ed={ed} post={ed.target === 'editor' ? null : posts.find((p) => p.id === ed.target)} busy={busy}
                    onApply={() => apply(ed)} onUndo={() => undo(ed)} onRemove={() => setEdits((l) => l.filter((x) => x.key !== ed.key))} />
                ))}
              </ul>
            </div>
          )}

          {items.length > 0 && (
            <div className="ali-plan">
              <ListHead label={created ? t('Tus publicaciones') : t('Plan propuesto')} count={items.length} folded={folded.plan} onToggle={() => fold('plan')} />
              <ul hidden={folded.plan}>
                {items.map((it) => (
                  <Item key={it.key} it={it} post={postOf(it)} videos={videos} busy={busy} working={progress?.key === it.key}
                    onChange={(value) => change(it, value)} onRemove={() => setItems((l) => l.filter((x) => x.key !== it.key))}
                    onEdit={(post) => { setOpen(false); onEdit(post) }} onQuick={(post) => openQuick(post.id)} />
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
          {composing && !progress && (
            <div className="ali-help">
              {HELP.map(([icon, x]) => <button key={x} type="button" disabled={busy} onClick={() => send(t(x))}><span aria-hidden="true">{icon}</span> {t(x)}</button>)}
            </div>
          )}
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
      {quick && createPortal(<AutoPost key={quick.target + quick.initial.request} initial={quick.initial} onClose={() => setQuick(null)} onGenerated={saveQuick} />, document.body)}
    </div>
  )
}
