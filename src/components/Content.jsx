import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../lib/store.jsx'
import { blankDesign, uid } from '../lib/formats.js'
import { renderToDataURL } from '../lib/render.js'
import { saveVideo } from '../lib/mediaStore.js'
import { t, useLang, locale } from '../lib/i18n.jsx'
import { Icon } from './ui.jsx'
import {
  CONTENT_ACCEPT, CONTENT_DAYS, CONTENT_MAX_MB, contentImage, contentUrl, daysLeft, deleteContent,
  downloadContentBlob, expiresAt, fetchContent, markContentPublished, uploadContent,
} from '../lib/content.js'

const fmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB')
const fmtDay = (ts) => new Date(ts).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' })

const FILTERS = [
  ['all', 'Todo', () => true],
  ['pending', 'Sin publicar', (x) => !x.publishedAt],
  ['published', 'Publicado', (x) => !!x.publishedAt],
]

/** Formato de publicación que menos recorta una imagen con esas medidas. */
const formatFor = (w, h) => {
  const r = w / h
  if (r < 0.68) return 'ig-story'
  if (r < 0.9) return 'ig-portrait'
  if (r < 1.3) return 'ig-square'
  return r < 1.84 ? 'x-post' : 'fb-post'
}

function Dialog({ onClose, className = '', children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div className="modal-bg" onClick={onClose}>
      <div className={'modal ' + className} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>,
    document.body,
  )
}

function Preview({ item, onClose }) {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => { contentUrl(item).then(setUrl).catch((e) => setError(e.message)) }, [item])
  return (
    <Dialog onClose={onClose} className="lib-preview">
      {error ? <p className="warn">{error}</p>
        : !url ? <p className="muted">{t('Cargando…')}</p>
          : item.isVideo ? <video src={url} controls autoPlay playsInline /> : <img src={url} alt={item.name} />}
      <b className="lib-name">{item.name}</b>
      <button className="btn ghost" onClick={onClose}>{t('Cerrar')}</button>
    </Dialog>
  )
}

function ContentCard({ item, busy, onPreview, onUse, onDownload, onMark, onDelete }) {
  const left = daysLeft(item)
  const urgent = left !== null && left <= 5
  return (
    <article className="lib-card">
      <button className="lib-thumb" onClick={onPreview} aria-label={t('Ver') + ' ' + item.name}>
        {item.thumb ? <img src={item.thumb} alt="" loading="lazy" /> : <span className="lib-noimg">🎬</span>}
        <span className="lib-kind">{item.isVideo ? '▶ ' + t('Video') : t('Imagen')}</span>
        <span className={'lib-state' + (item.publishedAt ? (urgent ? ' urgent' : ' pub') : '')}>
          {item.publishedAt ? (left === 1 ? t('Queda 1 día') : t('Quedan {n} días', { n: left })) : t('Sin publicar')}
        </span>
      </button>
      {item.publishedAt && (
        <div className="lib-life" role="img" aria-label={t('Se elimina el {d}', { d: fmtDay(expiresAt(item)) })}>
          <i className={urgent ? 'urgent' : ''} style={{ width: Math.min(100, (left / CONTENT_DAYS) * 100) + '%' }} />
        </div>
      )}
      <div className="lib-body">
        <b className="lib-name" title={item.name}>{item.name}</b>
        <small className="muted">{fmtSize(item.size)} · {t('Subido el {d}', { d: fmtDay(item.createdAt) })}</small>
        <small className="muted">{item.publishedAt ? t('Se elimina el {d}', { d: fmtDay(expiresAt(item)) }) : t('Se guarda hasta que lo publiques')}</small>
        <div className="lib-act">
          <button className="btn primary sm lib-use" disabled={busy} onClick={onUse}><Icon name="send" size={14} /> {busy ? t('Preparando…') : t('Usar en publicación')}</button>
          {!item.publishedAt && <button className="btn ghost sm" title={t('Marcar como publicado')} aria-label={t('Marcar como publicado')} onClick={onMark}><Icon name="check" size={15} /></button>}
          <button className="btn ghost sm" title={t('Descargar')} aria-label={t('Descargar')} onClick={onDownload}><Icon name="down" size={15} /></button>
          <button className="btn danger sm" title={t('Eliminar')} aria-label={t('Eliminar')} onClick={onDelete}><Icon name="trash" size={15} /></button>
        </div>
      </div>
    </article>
  )
}

export default function Content({ use }) {
  const { notify, access, openPlans } = useApp()
  useLang()
  const [items, setItems] = useState(null) // null = cargando
  const [error, setError] = useState(null)
  const [filter, setFilter] = useState('all')
  const [uploading, setUploading] = useState(null) // {done, total, name}
  const [over, setOver] = useState(false)
  const [preview, setPreview] = useState(null)
  const [ask, setAsk] = useState(null) // {type: 'delete' | 'mark', item}
  const [busyId, setBusyId] = useState(null)
  const input = useRef(null)
  const alive = useRef(true)

  const load = () => {
    setError(null)
    fetchContent().then((l) => alive.current && setItems(l)).catch((e) => { if (alive.current) { setItems([]); setError(e.message) } })
  }
  useEffect(() => { alive.current = true; load(); return () => { alive.current = false } }, []) // eslint-disable-line

  const upload = async (fileList) => {
    const files = [...(fileList || [])]
    if (!files.length || uploading) return
    let ok = 0
    const failed = []
    for (const [i, f] of files.entries()) {
      setUploading({ done: i, total: files.length, name: f.name })
      try {
        const item = await uploadContent(f)
        ok++
        if (alive.current) setItems((l) => [item, ...(l || [])])
      } catch (e) { failed.push(`${f.name}: ${e.message}`) }
    }
    if (alive.current) setUploading(null)
    if (failed.length) notify(failed.join(' · '), 'err')
    else if (ok) notify(ok === 1 ? t('Contenido guardado') : t('{n} archivos guardados', { n: ok }))
  }

  const drop = (e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files) }

  // Crea una publicación nueva a partir del archivo y abre el editor
  const useItem = async (item) => {
    if (item.isVideo && !access.limits.video) return openPlans(t('El editor de video está disponible desde el plan PRO.'))
    setBusyId(item.id)
    try {
      const base = { id: uid(), fromContent: true, contentId: item.id, caption: '' }
      if (item.isVideo) {
        const blob = await downloadContentBlob(item)
        const file = new File([blob], item.name, { type: item.mime })
        await saveVideo(base.id, file)
        use({ ...base, mediaType: 'video', video: { name: item.name, size: item.size, duration: 0, width: 0, height: 0, cover: null, coverTime: 0 }, design: blankDesign() })
      } else {
        const img = await contentImage(item)
        const format = formatFor(img.width, img.height)
        const design = { format, bg: { ...blankDesign().bg, type: 'image', image: img.dataUrl, dim: 0 }, accent: { show: false, color: '#7cc0ff' }, layers: [] }
        await renderToDataURL(design, 'image/jpeg', 0.8, 64) // deja la imagen cargada antes de abrir el editor
        use({ ...base, mediaType: 'photo', design })
      }
    } catch (e) {
      notify(e.message, 'err')
      if (alive.current) setBusyId(null)
    }
  }

  const download = async (item) => {
    try {
      const a = document.createElement('a')
      a.href = await contentUrl(item, true)
      document.body.appendChild(a); a.click(); a.remove()
    } catch (e) { notify(e.message, 'err') }
  }

  const confirm = async () => {
    const { type, item } = ask
    setAsk(null)
    try {
      if (type === 'delete') {
        await deleteContent(item)
        setItems((l) => l.filter((x) => x.id !== item.id))
        notify(t('Contenido eliminado'))
      } else {
        const at = Date.now()
        await markContentPublished(item.id, at)
        setItems((l) => l.map((x) => (x.id === item.id ? { ...x, publishedAt: at } : x)))
        notify(t('Marcado como publicado: se eliminará en {n} días.', { n: CONTENT_DAYS }))
      }
    } catch (e) { notify(e.message, 'err') }
  }

  const list = (items || []).filter(FILTERS.find((f) => f[0] === filter)[2])
  const used = (items || []).reduce((n, x) => n + x.size, 0)

  return (
    <div className="page lib">
      <header className="ph row between">
        <div><h1>{t('Contenido')}</h1><p>{t('Guarda tus imágenes y videos y úsalos cuando quieras publicar.')}</p></div>
        <button className="btn primary" disabled={!!uploading || !!error} onClick={() => input.current.click()}><Icon name="up" size={16} /> {t('Subir contenido')}</button>
      </header>
      <input ref={input} type="file" accept={CONTENT_ACCEPT} multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = '' }} />

      {error ? (
        <div className="banner err lib-error"><span>{error}</span><button className="btn ghost sm" onClick={load}>{t('Reintentar')}</button></div>
      ) : (
        <button type="button" className={'lib-drop' + (over ? ' over' : '') + (uploading ? ' busy' : '')} disabled={!!uploading}
          onClick={() => input.current.click()} onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={drop}>
          <span className="lib-drop-ico"><Icon name="up" size={24} /></span>
          {uploading ? (
            <>
              <b aria-live="polite">{t('Subiendo {i} de {n}…', { i: uploading.done + 1, n: uploading.total })}</b>
              <small>{uploading.name}</small>
              <span className="lib-bar" />
            </>
          ) : (
            <>
              <b>{t('Arrastra tus archivos aquí o toca para elegirlos')}</b>
              <small>{t('Imágenes y videos de hasta {n} MB cada uno', { n: CONTENT_MAX_MB })}</small>
            </>
          )}
        </button>
      )}

      <p className="lib-note"><Icon name="clock" size={16} /> <span>{t('Cada archivo se conserva hasta que lo publiques. Después tiene {n} días de vigencia y se elimina solo para liberar memoria.', { n: CONTENT_DAYS })}</span></p>

      {!error && (
        <div className="row between lib-bar-row">
          <div className="chips">{FILTERS.map(([id, label, test]) => (
            <button key={id} className={'chip' + (filter === id ? ' on' : '')} onClick={() => setFilter(id)}>{t(label)} ({(items || []).filter(test).length})</button>
          ))}</div>
          <small className="muted">{t('Espacio usado: {s}', { s: used ? fmtSize(used) : '0 MB' })}</small>
        </div>
      )}

      {items === null ? <div className="empty card">{t('Cargando…')}</div>
        : error ? null
          : !list.length ? <div key={filter} className="empty card flt-in">{t('No hay contenido aquí todavía.')}</div>
            : (
              <div key={filter} className="lib-grid">
                {list.map((item) => (
                  <ContentCard key={item.id} item={item} busy={busyId === item.id}
                    onPreview={() => setPreview(item)} onUse={() => !busyId && useItem(item)} onDownload={() => download(item)}
                    onMark={() => setAsk({ type: 'mark', item })} onDelete={() => setAsk({ type: 'delete', item })} />
                ))}
              </div>
            )}

      {preview && <Preview item={preview} onClose={() => setPreview(null)} />}
      {ask && (
        <Dialog onClose={() => setAsk(null)}>
          <h3>{ask.type === 'delete' ? t('¿Eliminar este contenido?') : t('¿Marcar como publicado?')}</h3>
          <p className="muted">{ask.type === 'delete' ? t('Esta acción no se puede deshacer.') : t('Úsalo si lo publicaste fuera de la app. Desde ahora tendrá {n} días de vigencia y después se eliminará.', { n: CONTENT_DAYS })}</p>
          <button className={'btn ' + (ask.type === 'delete' ? 'danger' : 'primary')} onClick={confirm}>{ask.type === 'delete' ? t('Eliminar') : t('Marcar como publicado')}</button>
          <button className="btn ghost" onClick={() => setAsk(null)}>{t('Cancelar')}</button>
        </Dialog>
      )}
    </div>
  )
}
