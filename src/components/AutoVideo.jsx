// «Crear con IA»: elección entre imagen y video, y el selector de videos de Contenido que aún no se publican.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../lib/store.jsx'
import { fetchContent } from '../lib/content.js'
import { videoDraft, nextFreeSlot, videoPlatforms, contentUse } from '../lib/contentDraft.js'
import { t, useLang } from '../lib/i18n.jsx'

function Modal({ onClose, locked, className = '', label, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && !locked && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose, locked])
  return createPortal(
    <div className="modal-bg" onClick={() => !locked && onClose()}>
      <div className={'modal auto-post ' + className} role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>,
    document.body,
  )
}

export function AutoChoice({ onClose, onImage, onVideo }) {
  useLang()
  return (
    <Modal onClose={onClose} label={t('Crear con IA')}>
      <h3>✨ {t('Crear con IA')}</h3>
      <p className="hint">{t('¿Qué quieres crear?')}</p>
      <div className="ai-choice">
        <button type="button" autoFocus onClick={onImage}>
          <span aria-hidden="true">🖼️</span><b>{t('Imagen con IA')}</b><small>{t('La IA diseña la imagen y escribe el texto a partir de una idea.')}</small>
        </button>
        <button type="button" onClick={onVideo}>
          <span aria-hidden="true">🎬</span><b>{t('Video con IA')}</b><small>{t('Elige un video de Contenido sin publicar y la IA prepara la publicación.')}</small>
        </button>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn ghost" onClick={onClose}>{t('Cancelar')}</button></div>
    </Modal>
  )
}

export default function AutoVideo({ onClose, onBack, onReady }) {
  const { posts, accounts, access, notify } = useApp()
  useLang()
  const [items, setItems] = useState(null) // null = cargando
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState(null)
  const [busy, setBusy] = useState(false)
  const alive = useRef(true)

  const load = () => {
    setError(null)
    setItems(null)
    fetchContent()
      .then((r) => { if (alive.current) setItems(r.items.filter((x) => x.isVideo && !x.publishedAt)) })
      .catch((e) => { if (alive.current) { setItems([]); setError(e.message) } })
  }
  useEffect(() => { alive.current = true; load(); return () => { alive.current = false } }, []) // eslint-disable-line

  const use = contentUse(posts)
  const pending = (items || []).filter((x) => use.get(x.id) !== 'published')
  const free = pending.filter((x) => use.get(x.id) !== 'scheduled') // lo ya programado no se repite
  const q = search.trim().toLowerCase()
  const list = pending.filter((x) => !q || x.name.toLowerCase().includes(q))
  const chosen = free.find((x) => x.id === picked)

  const random = () => {
    const pool = free.filter((x) => !use.get(x.id) && x.id !== picked)
    const next = (pool.length ? pool : free)[Math.floor(Math.random() * (pool.length || free.length))]
    if (next) { setSearch(''); setPicked(next.id) }
  }
  // La tarjeta elegida queda a la vista (por ejemplo, al elegir al azar)
  useEffect(() => { document.querySelector('.av-item.on')?.scrollIntoView({ block: 'nearest' }) }, [picked])

  const generate = async () => {
    if (!chosen || busy) return
    setBusy(true)
    try {
      const draft = await videoDraft(chosen, {
        autoAI: true,
        platforms: videoPlatforms(accounts, access.limits.platforms),
        scheduledAt: nextFreeSlot(posts),
      })
      if (alive.current) onReady(draft)
    } catch (e) {
      notify(e.message, 'err')
      if (alive.current) setBusy(false)
    }
  }

  return (
    <Modal onClose={onClose} locked={busy} className="auto-video" label={t('Video con IA')}>
      <h3>🎬 {t('Video con IA')}</h3>
      <p className="hint">{t('Elige un video sin publicar. Se prepara con portada, redes, fecha sugerida, título, descripción y tags. Nada se publica sin que lo confirmes.')}</p>
      {error ? (
        <div className="banner err lib-error"><span>{error}</span><button className="btn ghost sm" onClick={load}>{t('Reintentar')}</button></div>
      ) : items === null ? <p className="muted av-empty">{t('Cargando…')}</p>
        : !pending.length ? <p className="muted av-empty">{t('No hay videos sin publicar. Sube videos en la sección Contenido.')}</p>
          : (
            <>
              <div className="av-tools">
                <input type="search" value={search} disabled={busy} onChange={(e) => setSearch(e.target.value)} placeholder={t('Buscar por nombre…')} aria-label={t('Buscar por nombre…')} />
                <button type="button" className="btn ghost sm" disabled={busy || !free.length} onClick={random}>🎲 {t('Elegir uno al azar')}</button>
              </div>
              <small className="muted">{t('Disponibles: {n}', { n: free.length })}</small>
              <div className="av-grid">
                {list.map((x) => {
                  const state = use.get(x.id)
                  return (
                    <button key={x.id} type="button" className={'av-item' + (picked === x.id ? ' on' : '')} aria-pressed={picked === x.id}
                      disabled={busy || state === 'scheduled'} onClick={() => setPicked(x.id)} title={x.name}>
                      <span className="av-thumb">
                        {x.thumb ? <img src={x.thumb} alt="" loading="lazy" /> : <span aria-hidden="true">🎬</span>}
                        {state && <em className={state}>{state === 'scheduled' ? t('Ya programado') : t('En borrador')}</em>}
                        {picked === x.id && <i aria-hidden="true">✓</i>}
                      </span>
                      <small>{x.name}</small>
                    </button>
                  )
                })}
                {!list.length && <p className="muted av-empty">{t('Ningún video coincide con la búsqueda.')}</p>}
              </div>
            </>
          )}
      {chosen && <p className="av-chosen">{t('Elegido:')} <b>{chosen.name}</b></p>}
      <div className="row av-actions">
        <button className="btn ghost" disabled={busy} onClick={onBack}>← {t('Volver')}</button>
        <span>
          <button className="btn ghost" disabled={busy} onClick={onClose}>{t('Cancelar')}</button>
          <button className="btn primary" disabled={!chosen || busy} onClick={generate}>{busy ? t('Preparando el video…') : '✨ ' + t('Generar publicación')}</button>
        </span>
      </div>
    </Modal>
  )
}
