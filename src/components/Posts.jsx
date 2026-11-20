import { useState } from 'react'
import PostPreview from './PostPreview.jsx'
import { useApp } from '../lib/store.jsx'
import { t, useLang } from '../lib/i18n.jsx'
import { Icon, PlatformBadge, StatusTag, fmtDate } from './ui.jsx'

export function PostCard({ p, edit }) {
  const [open, setOpen] = useState(false)
  const { deletePost, publishNow, notify } = useApp()
  useLang()
  const canPublish = ['draft', 'scheduled', 'failed'].includes(p.status)
  return (
    <div className="post" onClick={() => setOpen(true)} style={{ cursor: 'pointer' }}>
      {open && <div onClick={(e) => e.stopPropagation()}><PostPreview p={p} onClose={() => setOpen(false)} /></div>}
      <div className="thumb"><img src={p.image} alt="" />{p.mediaType === 'video' && <span className="vbadge">▶ {t('Video')}</span>}</div>
      <div className="pbody">
        <div className="row between">
          <div className="row">{p.platforms.map((x) => <PlatformBadge key={x} id={x} small />)}</div>
          <StatusTag s={p.status} />
        </div>
        <p className="cap">{p.caption || <i className="muted">{t('Sin texto')}</i>}</p>
        <small className="muted">
          {p.status === 'scheduled' && <>📅 {fmtDate(p.scheduledAt)}</>}
          {p.status === 'published' && <>✅ {fmtDate(p.publishedAt)}</>}
          {(p.status === 'draft' || p.status === 'failed') && <>{t('Creada')} {fmtDate(p.createdAt)}</>}
        </small>
        {p.author && <small className="muted" title={p.author.email}>👤 {t('Creada por')} {p.author.name}{p.publishedBy && p.publishedBy.email !== p.author.email ? ` · ${t('publicada por')} ${p.publishedBy.name}` : ''}</small>}
        <div className="row pact" onClick={(e) => e.stopPropagation()}>
          {canPublish && <button className="btn primary sm" onClick={() => publishNow(p.id)}><Icon name="send" size={14} /> {t('Publicar')}</button>}
          {p.status !== 'published' && p.status !== 'publishing' && <button className="btn ghost sm" onClick={() => edit(p)}><Icon name="edit" size={14} /> {t('Editar')}</button>}
          <button className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(p.caption); notify(t('Texto copiado')) }}><Icon name="copy" size={14} /></button>
          <button className="btn danger sm" onClick={() => deletePost(p.id)}><Icon name="trash" size={14} /></button>
        </div>
      </div>
    </div>
  )
}

const FILTERS = [['all', 'Todas'], ['draft', 'Borradores'], ['scheduled', 'Programadas'], ['published', 'Publicadas'], ['failed', 'Fallidas']]

export default function Posts({ edit, go }) {
  const { posts } = useApp()
  useLang()
  const [f, setF] = useState('all')
  const list = posts.filter((p) => f === 'all' || p.status === f)
  return (
    <div className="page">
      <header className="ph row between">
        <div><h1>{t('Publicaciones')}</h1><p>{t('Controla el estado de todo tu contenido.')}</p></div>
        <button className="btn primary" onClick={() => go('composer-new')}><Icon name="plus" size={16} /> {t('Nueva')}</button>
      </header>
      <div className="chips">{FILTERS.map(([id, l]) => (
        <button key={id} className={'chip' + (f === id ? ' on' : '')} onClick={() => setF(id)}>{t(l)} ({id === 'all' ? posts.length : posts.filter((p) => p.status === id).length})</button>
      ))}</div>
      {list.length === 0 ? <div key={f} className="empty card flt-in">{t('No hay publicaciones aquí todavía.')}</div> : (
        <div key={f} className="post-grid flt-in-grid">{list.map((p, i) => <div key={p.id} className="flt-item" style={{ '--i': Math.min(i, 8) }}><PostCard p={p} edit={edit} /></div>)}</div>
      )}
    </div>
  )
}
