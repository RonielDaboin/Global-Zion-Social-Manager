import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../lib/store.jsx'
import { blankDesign, uid } from '../lib/formats.js'
import { renderToDataURL } from '../lib/render.js'
import { videoDraft } from '../lib/contentDraft.js'
import { t, useLang, locale } from '../lib/i18n.jsx'
import { Icon } from './ui.jsx'
import {
  CONTENT_ACCEPT, CONTENT_DAYS, createCover, CONTENT_MAX_MB, STORAGE_LIMIT, fetchStorageUsed, contentImage, contentUrl, daysLeft, deleteContent,
  expiresAt, fetchContent, markContentPublished, uploadContent, deleteContents, setAutoDelete,
} from '../lib/content.js'

const fmtSize = (b) => (b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB')
const fmtDay = (ts) => new Date(ts).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' })

const FILTERS = [
  ['all', 'Todo', () => true],
  ['pending', 'Sin publicar', (x) => !x.publishedAt],
  ['published', 'Publicado', (x) => !!x.publishedAt],
]

// Cada tipo tiene su bloque y su color
const KINDS = [
  { id: 'video', label: 'Videos', emoji: '🎬', test: (x) => x.isVideo },
  { id: 'image', label: 'Imágenes', emoji: '🖼️', test: (x) => !x.isVideo },
]

/** Formato de publicación que menos recorta una imagen con esas medidas. */
const formatFor = (w, h) => {
  const r = w / h
  if (r < 0.68) return 'ig-story'
  if (r < 0.9) return 'ig-portrait'
  if (r < 1.3) return 'ig-square'
  return r < 1.84 ? 'x-post' : 'fb-post'
}

const fmtSpace = (b) => (b >= 1073741824 ? +(b / 1073741824).toFixed(2) + ' GB' : b >= 1048576 ? Math.round(b / 1048576) + ' MB' : b > 0 ? Math.max(1, Math.round(b / 1024)) + ' KB' : '0 MB')

/** Cuánto espacio está ocupado y cuánto queda. `total` es el del proyecto entero (null = no se pudo medir). */
function StorageMeter({ items, total }) {
  const mine = items.reduce((n, x) => n + x.size, 0)
  const used = total == null ? null : Math.max(total, mine)
  const free = used === null ? null : Math.max(0, STORAGE_LIMIT - used)
  const pct = used === null ? 0 : Math.min(100, (used / STORAGE_LIMIT) * 100)
  const level = pct >= 90 ? ' full' : pct >= 75 ? ' warn' : ''
  const width = (b) => Math.min(100, (b / STORAGE_LIMIT) * 100) + '%'
  // Referencia de cuántos archivos más caben: según el peso medio de los ya subidos, o el máximo por archivo si no hay
  const avg = items.length ? mine / items.length : null
  const fits = free === null ? null : Math.floor(free / (avg || CONTENT_MAX_MB * 1048576))
  return (
    <section className={'card lib-space' + level} aria-label={t('Espacio de almacenamiento')}>
      <div className="lib-space-nums">
        <div><small>{t('Ocupado')}</small><b>{used === null ? '—' : fmtSpace(used)}</b></div>
        <div className="free"><small>{t('Disponible')}</small><b>{free === null ? '—' : fmtSpace(free)}</b></div>
        <div><small>{t('Límite total')}</small><b>{fmtSpace(STORAGE_LIMIT)}</b></div>
        <div><small>{t('Archivos en Contenido')}</small><b>{items.length}</b></div>
      </div>
      <div className="lib-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(pct)} aria-label={t('Espacio ocupado')}>
        <i className="mine" style={{ width: width(mine) }} />
        {used !== null && <i className="rest" style={{ width: width(used - mine) }} />}
      </div>
      <div className="lib-space-legend">
        <span><i className="mine" />{t('Tu contenido: {s}', { s: fmtSpace(mine) })}</span>
        {used !== null && <span><i className="rest" />{t('Publicaciones y otros: {s}', { s: fmtSpace(used - mine) })}</span>}
        {used !== null && <span className="pct">{t('{n} % ocupado', { n: pct > 0 && pct < 1 ? '<1' : Math.round(pct) })}</span>}
      </div>
      <p className="muted">
        {free === null ? (total === undefined ? t('Midiendo el espacio…') : t('No se pudo medir el espacio total en este momento.'))
          : fits < 1 ? t('Queda poco espacio: elimina contenido para poder subir más.')
            : avg ? t('Caben aproximadamente {n} archivos más, según el peso promedio de los que subiste ({s}).', { n: fits.toLocaleString(locale()), s: fmtSpace(avg) })
              : t('Caben al menos {n} archivos del tamaño máximo ({m} MB); si pesan menos, caben más.', { n: fits.toLocaleString(locale()), m: CONTENT_MAX_MB })}
        {' '}{t('El límite se comparte entre todos los usuarios de la app.')}
      </p>
    </section>
  )
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

/** Botón para encender o apagar el borrado automático de lo ya publicado. */
function AutoDelete({ policy, saving, onToggle }) {
  const on = policy.autoDelete
  return (
    <section className={'lib-auto' + (on ? ' on' : '')}>
      <span className="lib-auto-ico" aria-hidden="true"><Icon name="clock" size={18} /></span>
      <div>
        <b>{t('Borrado automático')}</b>
        <p>{policy.unknown ? t('No se pudo leer este ajuste. Mientras tanto no se borra nada.')
          : on ? t('Cada archivo se conserva hasta que lo publiques. Después tiene {n} días de vigencia y se elimina solo para liberar memoria.', { n: CONTENT_DAYS })
            : t('Apagado: los archivos no se borran solos, aunque ya estén publicados. Elimínalos tú cuando quieras liberar espacio.')}</p>
      </div>
      <button type="button" className="lib-switch" role="switch" aria-checked={on} aria-label={t('Borrado automático')} disabled={saving || policy.unknown} onClick={() => onToggle(!on)}>
        <span className="lib-switch-track" aria-hidden="true"><i /></span>
        <span>{on ? t('Encendido') : t('Apagado')}</span>
      </button>
    </section>
  )
}

function ContentCard({ item, policy, selecting, selected, onSelect, busy, onPreview, onUse, onEdit, onDownload, onMark, onDelete }) {
  const expires = expiresAt(item, policy)
  const left = daysLeft(item, policy)
  const urgent = left !== null && left <= 5
  return (
    <article className={'lib-card ' + (item.isVideo ? 'is-video' : 'is-image') + (selected ? ' selected' : '')}>
      <button className="lib-thumb" onClick={selecting ? onSelect : onPreview} aria-pressed={selecting ? selected : undefined} aria-label={(selecting ? t('Seleccionar') : t('Ver')) + ' ' + item.name}>
        {item.thumb && item.isVideo && <span className="lib-backdrop" style={{ backgroundImage: `url(${item.thumb})` }} aria-hidden="true" />}
        {item.thumb ? <img className={item.isVideo ? 'whole' : undefined} src={item.thumb} alt="" loading="lazy" /> : <span className="lib-noimg">🎬</span>}
        <span className="lib-kind">{item.isVideo ? '▶ ' + t('Video') : t('Imagen')}</span>
        <span className={'lib-state' + (item.publishedAt ? (urgent ? ' urgent' : ' pub') : '')}>
          {!item.publishedAt ? t('Sin publicar') : !expires ? t('Publicado') : left === 1 ? t('Queda 1 día') : t('Quedan {n} días', { n: left })}
        </span>
        {selecting && <span className="lib-check" aria-hidden="true">{selected ? '✓' : ''}</span>}
      </button>
      {expires && (
        <div className="lib-life" role="img" aria-label={t('Se elimina el {d}', { d: fmtDay(expires) })}>
          <i className={urgent ? 'urgent' : ''} style={{ width: Math.min(100, (left / CONTENT_DAYS) * 100) + '%' }} />
        </div>
      )}
      <div className="lib-body">
        <b className="lib-name" title={item.name}>{item.name}</b>
        <small className="muted">{fmtSize(item.size)} · {t('Subido el {d}', { d: fmtDay(item.createdAt) })}</small>
        <small className="muted">{expires ? t('Se elimina el {d}', { d: fmtDay(expires) }) : item.publishedAt ? t('Publicado: no se borra solo') : t('Se guarda hasta que lo publiques')}</small>
        {selecting ? (
          <div className="lib-act">
            <button type="button" className={'btn sm lib-use ' + (selected ? 'primary' : 'ghost')} aria-pressed={selected} onClick={onSelect}>{selected ? '✓ ' + t('Seleccionado') : t('Seleccionar')}</button>
          </div>
        ) : (
        <div className="lib-act">
          <button className="btn primary sm lib-use" disabled={!!busy} onClick={onEdit}><Icon name="edit" size={14} /> {busy === 'ai' ? t('Preparando…') : t('Editar con IA')}</button>
          <button className="btn ghost sm lib-use" disabled={!!busy} onClick={onUse}><Icon name="send" size={14} /> {busy === 'use' ? t('Preparando…') : t('Usar en publicación')}</button>
          {!item.publishedAt && <button className="btn ghost sm" title={t('Marcar como publicado')} aria-label={t('Marcar como publicado')} onClick={onMark}><Icon name="check" size={15} /></button>}
          <button className="btn ghost sm" title={t('Descargar')} aria-label={t('Descargar')} onClick={onDownload}><Icon name="down" size={15} /></button>
          <button className="btn danger sm" title={t('Eliminar')} aria-label={t('Eliminar')} onClick={onDelete}><Icon name="trash" size={15} /></button>
        </div>
        )}
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
  const [kind, setKind] = useState('all') // 'all' | 'video' | 'image'
  const [uploading, setUploading] = useState(null) // {done, total, name}
  const [over, setOver] = useState(false)
  const [preview, setPreview] = useState(null)
  const [ask, setAsk] = useState(null) // {type: 'delete' | 'mark', item}
  const [busy, setBusy] = useState(null) // {id, mode} del archivo que se está abriendo en el editor
  const [total, setTotal] = useState(undefined) // bytes ocupados en todo el proyecto (undefined = midiendo, null = falló)
  const [policy, setPolicy] = useState({ autoDelete: true, since: null })
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [picked, setPicked] = useState(() => new Set()) // ids marcados para borrar
  const [deleting, setDeleting] = useState(false)
  const input = useRef(null)
  const alive = useRef(true)

  const load = () => {
    setError(null)
    fetchContent().then((r) => { if (alive.current) { setItems(r.items); setPolicy(r.policy) } }).catch((e) => { if (alive.current) { setItems([]); setError(e.message) } })
  }
  useEffect(() => { alive.current = true; load(); return () => { alive.current = false } }, []) // eslint-disable-line

  // El total se vuelve a medir cada vez que cambia la lista (subir o eliminar)
  const count = items?.length
  useEffect(() => {
    if (count === undefined) return
    fetchStorageUsed().then((n) => alive.current && setTotal(n))
  }, [count])

  // Crea de a una las portadas de video que falten (solo con la pestaña visible: en segundo plano el video no carga)
  const covers = useRef({ busy: false, tried: new Set() })
  const [coverTick, setCoverTick] = useState(0)
  useEffect(() => {
    const state = covers.current
    const next = !state.busy && (items || []).find((x) => x.isVideo && !x.thumb && !state.tried.has(x.id))
    if (!next) return undefined
    if (document.hidden) {
      const wake = () => setCoverTick((n) => n + 1)
      document.addEventListener('visibilitychange', wake, { once: true })
      return () => document.removeEventListener('visibilitychange', wake)
    }
    state.busy = true
    state.tried.add(next.id) // si falla, se reintenta al volver a abrir la sección
    createCover(next)
      .then((thumb) => { if (thumb && alive.current) setItems((l) => l.map((x) => (x.id === next.id ? { ...x, thumb } : x))) })
      .catch(() => {})
      .finally(() => { state.busy = false; if (alive.current) setCoverTick((n) => n + 1) })
    return undefined
  }, [items, coverTick])

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

  // Crea una publicación nueva a partir del archivo y abre el editor (con `ai`, la IA lo analiza al abrir)
  const useItem = async (item, ai = false) => {
    if (item.isVideo && !access.limits.video) return openPlans(t('El editor de video está disponible desde el plan PRO.'))
    setBusy({ id: item.id, mode: ai ? 'ai' : 'use' })
    try {
      const base = { id: uid(), fromContent: true, autoAI: ai, contentId: item.id, caption: '' }
      if (item.isVideo) {
        use(await videoDraft(item, { autoAI: ai }))
      } else {
        const img = await contentImage(item)
        const format = formatFor(img.width, img.height)
        const design = { format, bg: { ...blankDesign().bg, type: 'image', image: img.dataUrl, dim: 0 }, accent: { show: false, color: '#7cc0ff' }, layers: [] }
        await renderToDataURL(design, 'image/jpeg', 0.8, 64) // deja la imagen cargada antes de abrir el editor
        use({ ...base, mediaType: 'photo', design })
      }
    } catch (e) {
      notify(e.message, 'err')
      if (alive.current) setBusy(null)
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
        notify(policy.autoDelete ? t('Marcado como publicado: se eliminará en {n} días.', { n: CONTENT_DAYS }) : t('Marcado como publicado.'))
      }
    } catch (e) { notify(e.message, 'err') }
  }

  const toggleAuto = async (on) => {
    setSavingPolicy(true)
    try {
      setPolicy(await setAutoDelete(on))
      notify(on ? t('Borrado automático encendido: lo ya publicado tiene {n} días desde hoy.', { n: CONTENT_DAYS }) : t('Borrado automático apagado.'))
    } catch (e) { notify(e.message, 'err') }
    if (alive.current) setSavingPolicy(false)
  }

  // ---- Selección para borrar varios ----
  const stopSelecting = () => { setSelecting(false); setPicked(new Set()) }
  const toggleOne = (id) => setPicked((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n })
  /** Marca todos los de la lista, o los desmarca si ya estaban todos marcados. */
  const toggleMany = (many) => setPicked((cur) => {
    const n = new Set(cur)
    const all = many.every((x) => n.has(x.id))
    many.forEach((x) => { if (all) n.delete(x.id); else n.add(x.id) })
    return n
  })
  const chosen = (items || []).filter((x) => picked.has(x.id))
  const chosenSize = chosen.reduce((n, x) => n + x.size, 0)

  const deleteChosen = async () => {
    const targets = ask.items
    setAsk(null)
    setDeleting(true)
    try {
      await deleteContents(targets)
      const gone = new Set(targets.map((x) => x.id))
      setItems((l) => l.filter((x) => !gone.has(x.id)))
      stopSelecting()
      notify(targets.length === 1 ? t('Contenido eliminado') : t('{n} archivos eliminados', { n: targets.length }))
    } catch (e) {
      notify(e.message, 'err')
      load() // pudo borrarse una parte: se vuelve a leer la lista
    }
    if (alive.current) setDeleting(false)
  }

  const byKind = (items || []).filter((x) => kind === 'all' || KINDS.find((k) => k.id === kind).test(x))
  const list = byKind.filter(FILTERS.find((f) => f[0] === filter)[2])
  const groups = KINDS.map((k) => ({ ...k, list: list.filter(k.test) })).filter((g) => g.list.length)

  return (
    <div className="page lib">
      <header className="ph row between">
        <div><h1>{t('Contenido')}</h1><p>{t('Guarda tus imágenes y videos y úsalos cuando quieras publicar.')}</p></div>
        <button className="btn primary" disabled={!!uploading || !!error} onClick={() => input.current.click()}><Icon name="up" size={16} /> {t('Subir contenido')}</button>
      </header>
      <input ref={input} type="file" accept={CONTENT_ACCEPT} multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = '' }} />

      {!error && items !== null && <StorageMeter items={items} total={total} />}

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

      {!error && items !== null && <AutoDelete policy={policy} saving={savingPolicy} onToggle={toggleAuto} />}

      {!error && (
        <div className="lib-kinds" role="group" aria-label={t('Tipo de contenido')}>
          {[{ id: 'all', label: 'Todo', emoji: '📁', test: () => true }, ...KINDS].map((k) => (
            <button key={k.id} type="button" className={'lib-kind-btn ' + k.id + (kind === k.id ? ' on' : '')} aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>
              <span aria-hidden="true">{k.emoji}</span> {t(k.label)} <b>{(items || []).filter(k.test).length}</b>
            </button>
          ))}
        </div>
      )}

      {!error && (
        <div className="row between lib-bar-row">
          <div className="chips">{FILTERS.map(([id, label, test]) => (
            <button key={id} className={'chip' + (filter === id ? ' on' : '')} onClick={() => setFilter(id)}>{t(label)} ({byKind.filter(test).length})</button>
          ))}</div>
          {!!items?.length && (
            <button type="button" className={'btn sm lib-select ' + (selecting ? 'primary' : 'ghost')} aria-pressed={selecting} onClick={() => (selecting ? stopSelecting() : setSelecting(true))}>
              <Icon name={selecting ? 'x' : 'check'} size={15} /> {selecting ? t('Salir de la selección') : t('Seleccionar para borrar')}
            </button>
          )}
        </div>
      )}

      {items === null ? <div className="empty card">{t('Cargando…')}</div>
        : error ? null
          : !list.length ? <div key={kind + filter} className="empty card flt-in">{t('No hay contenido aquí todavía.')}</div>
            : groups.map((g) => (
              <section key={g.id + filter} className={'lib-group ' + g.id} aria-labelledby={'lib-' + g.id}>
                <header>
                  <span className="lib-group-ico" aria-hidden="true">{g.emoji}</span>
                  <h2 id={'lib-' + g.id}>{t(g.label)}</h2>
                  <small>{g.list.length} · {fmtSize(g.list.reduce((n, x) => n + x.size, 0))}</small>
                  {selecting && <button type="button" className="btn ghost sm lib-group-pick" onClick={() => toggleMany(g.list)}>{g.list.every((x) => picked.has(x.id)) ? t('Quitar este bloque') : t('Marcar este bloque')}</button>}
                </header>
                <div className="lib-grid">
                  {g.list.map((item) => (
                    <ContentCard key={item.id} item={item} policy={policy} busy={busy?.id === item.id ? busy.mode : null}
                      selecting={selecting} selected={picked.has(item.id)} onSelect={() => toggleOne(item.id)}
                      onPreview={() => setPreview(item)} onUse={() => !busy && useItem(item)} onEdit={() => !busy && useItem(item, true)} onDownload={() => download(item)}
                      onMark={() => setAsk({ type: 'mark', item })} onDelete={() => setAsk({ type: 'delete', item })} />
                  ))}
                </div>
              </section>
            ))}

      {selecting && (
        <div className="lib-selbar" role="region" aria-label={t('Archivos seleccionados')}>
          <b aria-live="polite">{chosen.length === 1 ? t('1 seleccionado') : t('{n} seleccionados', { n: chosen.length })}{chosen.length > 0 && <small> · {fmtSize(chosenSize)}</small>}</b>
          <div>
            <button type="button" className="btn ghost sm" disabled={!list.length || deleting} onClick={() => toggleMany(list)}>{list.length && list.every((x) => picked.has(x.id)) ? t('Quitar todos') : t('Seleccionar todos ({n})', { n: list.length })}</button>
            <button type="button" className="btn ghost sm" disabled={deleting} onClick={stopSelecting}>{t('Cancelar')}</button>
            <button type="button" className="btn sm lib-del" disabled={!chosen.length || deleting} onClick={() => setAsk({ type: 'bulk', items: chosen, hidden: chosen.filter((x) => !list.includes(x)).length })}>
              <Icon name="trash" size={15} /> {deleting ? t('Eliminando…') : t('Eliminar ({n})', { n: chosen.length })}
            </button>
          </div>
        </div>
      )}

      {preview && <Preview item={preview} onClose={() => setPreview(null)} />}
      {ask?.type === 'bulk' && (
        <Dialog onClose={() => setAsk(null)}>
          <h3>{ask.items.length === 1 ? t('¿Eliminar este contenido?') : t('¿Eliminar {n} archivos?', { n: ask.items.length })}</h3>
          <p className="muted">{t('Se liberarán {s}. Esta acción no se puede deshacer.', { s: fmtSize(ask.items.reduce((n, x) => n + x.size, 0)) })}</p>
          {ask.items.some((x) => !x.publishedAt) && <p className="warn">⚠️ {t('Sin publicar todavía: {n}', { n: ask.items.filter((x) => !x.publishedAt).length })}</p>}
          {ask.hidden > 0 && <p className="warn">⚠️ {t('No se ven con el filtro actual: {n}', { n: ask.hidden })}</p>}
          <button className="btn danger" onClick={deleteChosen}>{t('Eliminar ({n})', { n: ask.items.length })}</button>
          <button className="btn ghost" onClick={() => setAsk(null)}>{t('Cancelar')}</button>
        </Dialog>
      )}
      {ask && ask.type !== 'bulk' && (
        <Dialog onClose={() => setAsk(null)}>
          <h3>{ask.type === 'delete' ? t('¿Eliminar este contenido?') : t('¿Marcar como publicado?')}</h3>
          <p className="muted">{ask.type === 'delete' ? t('Esta acción no se puede deshacer.') : policy.autoDelete ? t('Úsalo si lo publicaste fuera de la app. Desde ahora tendrá {n} días de vigencia y después se eliminará.', { n: CONTENT_DAYS }) : t('Úsalo si lo publicaste fuera de la app. El borrado automático está apagado, así que no se eliminará solo.')}</p>
          <button className={'btn ' + (ask.type === 'delete' ? 'danger' : 'primary')} onClick={confirm}>{ask.type === 'delete' ? t('Eliminar') : t('Marcar como publicado')}</button>
          <button className="btn ghost" onClick={() => setAsk(null)}>{t('Cancelar')}</button>
        </Dialog>
      )}
    </div>
  )
}
