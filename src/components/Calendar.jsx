import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../lib/store.jsx'
import { t, useLang, locale } from '../lib/i18n.jsx'
import { Icon, StatusTag } from './ui.jsx'
import { loadVideo, saveVideo } from '../lib/mediaStore.js'
import PostPreview from './PostPreview.jsx'
import DeleteDialog from './DeleteDialog.jsx'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' }
function StatIcon({ k }) {
  const f = { fill: 'currentColor', fillOpacity: .22, stroke: 'none' }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      {k === 'all' && <><rect x="3" y="3" width="8" height="8" rx="2.2" {...f} /><rect x="13" y="3" width="8" height="8" rx="2.2" {...f} /><rect x="3" y="13" width="8" height="8" rx="2.2" {...f} /><rect x="13" y="13" width="8" height="8" rx="2.2" {...f} />
        <g {...S}><rect x="3" y="3" width="8" height="8" rx="2.2" /><rect x="13" y="3" width="8" height="8" rx="2.2" /><rect x="3" y="13" width="8" height="8" rx="2.2" /><rect x="13" y="13" width="8" height="8" rx="2.2" /></g></>}
      {k === 'scheduled' && <><circle cx="12" cy="12" r="9" {...f} /><g {...S}><circle cx="12" cy="12" r="9" /><path d="M12 6.8V12l3.4 2" /></g></>}
      {k === 'published' && <><circle cx="12" cy="12" r="9" {...f} /><g {...S}><circle cx="12" cy="12" r="9" /><path d="M7.8 12.4l3 3 5.4-6.2" /></g></>}
      {k === 'failed' && <><path d="M12 3.2l9.4 16.3H2.6z" {...f} /><g {...S}><path d="M12 3.2l9.4 16.3H2.6z" /><path d="M12 9.8v4.4M12 17.2v.2" /></g></>}
      {k === 'draft' && <><path d="M5 3h9l5 5v13H5z" {...f} /><g {...S}><path d="M5 3h9l5 5v13H5z" /><path d="M14 3v5h5M8.5 13h7M8.5 17h4.5" /></g></>}
    </svg>
  )
}

export default function Calendar({ edit }) {
  const { posts, savePost, notify } = useApp()
  useLang()
  const [cur, setCur] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const y = cur.getFullYear(), m = cur.getMonth()
  const first = (new Date(y, m, 1).getDay() + 6) % 7
  const dim = new Date(y, m + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((first + dim) / 7) * 7 }, (_, i) => i - first + 1)
  const when = (p) => p.scheduledAt || p.publishedAt || p.createdAt
  const [filter, setFilter] = useState('all')
  const forDay = (d) => posts.filter((p) => { const t = new Date(when(p)); return (filter === 'all' || p.status === filter) && t.getFullYear() === y && t.getMonth() === m && t.getDate() === d })
  const today = new Date()
  const isCur = today.getFullYear() === y && today.getMonth() === m
  const monthPosts = posts.filter((p) => { const t = new Date(when(p)); return t.getFullYear() === y && t.getMonth() === m })
  const counts = monthPosts.reduce((a, p) => ({ ...a, [p.status]: (a[p.status] || 0) + 1 }), {})
  const [open, setOpen] = useState(null)
  const [exp, setExp] = useState(null)
  const [day, setDay] = useState(null)
  const dayPosts = day ? forDay(day).sort((a, b) => new Date(when(a)) - new Date(when(b))) : []
  const closeDay = () => setDay(null)
  const [del, setDel] = useState(null)
  // Copia la publicación como borrador; devuelve la copia (o null si no se pudo)
  const copyAsDraft = async (p) => {
    const id = Math.random().toString(36).slice(2, 9)
    if (p.mediaType === 'video') {
      let b = null
      try { b = await loadVideo(p.id); if (b) await saveVideo(id, b) } catch { /* ignore */ }
      if (!b) { notify(t('El video de esta publicación ya no se guarda: solo queda una captura de referencia.'), 'err'); return null }
    }
    const { results, publishedAt, publishedBy, ...rest } = p
    const copy = { ...rest, id, status: 'draft', scheduledAt: null, createdAt: when(p) + 1000 }
    savePost(copy)
    return copy
  }
  const duplicate = async (p) => { if (await copyAsDraft(p)) notify(t('Publicación duplicada como borrador')) }
  // Lo ya publicado no se puede modificar en la red: se edita una copia en borrador
  const editPost = async (p) => {
    if (p.status !== 'published') { edit(p); return closeDay() }
    const copy = await copyAsDraft(p)
    if (!copy) return
    notify(t('Ya está publicada: estás editando una copia en borrador.'))
    edit(copy); closeDay()
  }
  const schedule = (p, ts) => { savePost({ ...p, status: 'scheduled', scheduledAt: ts }); notify(t('Publicación programada')) }
  const MAX = 2
  const hm = (p) => new Date(when(p)).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="page">
     <div className="cal-panel">
      <header className="ph row between">
        <div><h1>{t('Calendario')}</h1><p>{t('Visualiza lo programado y lo publicado.')}</p></div>
        <div className="cal-nav">
          <button className="cal-arrow" aria-label="‹" onClick={() => setCur(new Date(y, m - 1, 1))}>‹</button>
          <b className="month">{cur.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</b>
          <button className="cal-arrow" aria-label="›" onClick={() => setCur(new Date(y, m + 1, 1))}>›</button>
          <button className="cal-today" onClick={() => setCur(new Date(today.getFullYear(), today.getMonth(), 1))}>{t('Hoy')}</button>
        </div>
      </header>
      <div className="cal-stats" role="group">
        <button type="button" className={'cs all' + (filter === 'all' ? ' on' : '')} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          <span className="ci"><StatIcon k="all" /></span><b>{monthPosts.length}</b> {t('Total')}
        </button>
        {[['scheduled', 'Programadas', 'clock'], ['published', 'Publicadas', 'check'], ['failed', 'Fallidas', 'alert'], ['draft', 'Borradores', 'draft']].map(([s, label, ic]) => counts[s] > 0 && (
          <button type="button" key={s} className={'cs ' + s + (filter === s ? ' on' : '')} aria-pressed={filter === s} onClick={() => setFilter(filter === s ? 'all' : s)}>
            <span className="ci"><StatIcon k={s} /></span><b className="n">{counts[s]}</b> {t(label)}
          </button>
        ))}
      </div>
      <div className="cal" key={y + '-' + m}>
        {DAYS.map((d, k) => <div key={d} className={'cal-h' + (isCur && k === (today.getDay() + 6) % 7 ? ' now' : '')}>{t(d)}</div>)}
        {cells.map((d, i) => {
          const ok = d >= 1 && d <= dim
          const ps = ok ? forDay(d) : []
          const isToday = ok && today.getFullYear() === y && today.getMonth() === m && today.getDate() === d
          return (
            <div key={i} style={{ '--i': i }} className={'cal-c' + (ok ? '' : ' off') + (isToday ? ' today' : '') + (i % 7 > 4 ? ' wknd' : '') + (isCur && ok && d < today.getDate() ? ' past' : '') + (ps.length ? ' has' : '')}>
              {ok && (
                <span
                  className={'dn' + (ps.length ? ' link' : '')}
                  {...(ps.length ? { role: 'button', tabIndex: 0, title: t('Ver publicaciones del día'), onClick: () => setDay(d), onKeyDown: (e) => e.key === 'Enter' && setDay(d) } : {})}
                >{d}{ps.length > 0 && <small>{ps.length}</small>}</span>
              )}
              {(exp === d ? ps : ps.slice(0, MAX)).map((p) => (
                <button key={p.id} className={'cal-p ' + p.status} onClick={() => setOpen(p)} title={p.caption}>
                  <img src={p.image} alt="" />
                  <i className="cal-shade" />
                  {p.mediaType === 'video' && <em className="cal-vid">▶</em>}
                  <span className="cal-t"><b className="cal-dot" />{hm(p)}</span>
                </button>
              ))}
              {ps.length > MAX && <button className="cal-more" onClick={() => setExp(exp === d ? null : d)}>{exp === d ? '−' : `+${ps.length - MAX}`}</button>}
            </div>
          )
        })}
      </div>
      <div className="cal-legend">
        <span><b className="cal-dot scheduled" />{t('Programadas')}</span>
        <span><b className="cal-dot published" />{t('Publicadas')}</span>
        <span><b className="cal-dot failed" />{t('Fallidas')}</span>
        <span><b className="cal-dot draft" />{t('Borradores')}</span>
      </div>
     </div>
      {day && (
        <DayViewer
          date={new Date(y, m, day)} posts={dayPosts} when={when} hm={hm}
          onOpen={setOpen} onClose={closeDay} suspended={!!open || !!del}
          onDuplicate={duplicate} onSchedule={schedule}
          onEdit={editPost} onDelete={setDel}
        />
      )}
      {del && (
        <DeleteDialog
          p={del} onClose={() => setDel(null)}
          onDeleted={() => { if (dayPosts.length <= 1) closeDay(); notify(t('Publicación eliminada')) }}
        />
      )}
      {open && (
        <PostPreview
          p={open}
          onClose={() => setOpen(null)}
          actions={() => open.status !== 'published' && open.status !== 'publishing' && (
            <button className="btn primary sm" onClick={() => { edit(open); setOpen(null) }}><Icon name="edit" size={14} /> {t('Editar')}</button>
          )}
        />
      )}
      <p className="hint"><Icon name="clock" size={14} /> {t('Las publicaciones programadas se envían automáticamente mientras esta ventana esté abierta (en modo real, usa un backend con cron).')}</p>
    </div>
  )
}

const toLocalInput = (ts) => new Date(ts - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)

function DayViewer({ date, posts, when, hm, onOpen, onEdit, onDelete, onDuplicate, onSchedule, onClose, suspended }) {
  useLang()
  const [sch, setSch] = useState(null) // { id, value }
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && !suspended && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })
  const editable = (p) => p.status !== 'published' && p.status !== 'publishing'
  const startSch = (p) => {
    const base = p.scheduledAt && p.scheduledAt > Date.now() ? p.scheduledAt : new Date(date).setHours(new Date(when(p)).getHours(), new Date(when(p)).getMinutes())
    setSch({ id: p.id, value: toLocalInput(Math.max(base, Date.now() + 60000)) })
  }
  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <div className="modal dv" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <div>
            <h3 className="dv-title">{date.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
            <small className="muted">{posts.length} {t('Total')}</small>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label={t('Cerrar')}><Icon name="x" size={20} /></button>
        </div>
        <div className="dv-list">
          {posts.map((p) => (
            <div key={p.id} className={'dv-item ' + p.status}>
              <button className="dv-main" onClick={() => onOpen(p)}>
                <span className="dv-thumb">{p.image && <img src={p.image} alt="" />}{p.mediaType === 'video' && <em>▶</em>}</span>
                <span className="dv-info">
                  <b>{hm(p)}</b>
                  <span className="dv-cap">{p.caption || '—'}</span>
                  <StatusTag s={p.status} />
                </span>
              </button>
              <div className="dv-acts">
                <button className="btn ghost sm" onClick={() => onDuplicate(p)}><Icon name="copy" size={14} /> {t('Duplicar')}</button>
                {p.status !== 'publishing' && <button className="btn ghost sm" onClick={() => onEdit(p)}><Icon name="edit" size={14} /> {t('Editar')}</button>}
                {editable(p) && <button className="btn ghost sm" onClick={() => (sch?.id === p.id ? setSch(null) : startSch(p))}><Icon name="clock" size={14} /> {t('Programar')}</button>}
                {p.status !== 'publishing' && <button className="btn danger sm" onClick={() => onDelete(p)}><Icon name="trash" size={14} /> {t('Eliminar')}</button>}
              </div>
              {sch?.id === p.id && (
                <div className="dv-sch">
                  <input type="datetime-local" value={sch.value} min={toLocalInput(Date.now())} onChange={(e) => setSch({ ...sch, value: e.target.value })} />
                  <button className="btn primary sm" disabled={!sch.value || new Date(sch.value).getTime() <= Date.now()} onClick={() => { onSchedule(p, new Date(sch.value).getTime()); setSch(null) }}>{t('Confirmar')}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}
