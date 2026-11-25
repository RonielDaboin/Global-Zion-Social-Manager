import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { socialCall } from '../lib/social.js'
import { useApp } from '../lib/store.jsx'
import { t, useLang } from '../lib/i18n.jsx'

/** ¿La publicación existe de verdad en Instagram? (no es demo y se publicó bien) */
export const isOnInstagram = (p) => p.status === 'published' && p.platforms.includes('instagram') && !!p.results?.instagram?.ok && !p.results.instagram.demo

/** Confirmación para eliminar una publicación; si está en Instagram ofrece abrirla para borrarla allí. */
export default function DeleteDialog({ p, onClose, onDeleted }) {
  const { deletePost, notify } = useApp()
  useLang()
  const onIg = isOnInstagram(p)
  const [link, setLink] = useState(undefined) // undefined = buscando, null = no encontrada
  useEffect(() => {
    if (!onIg) return
    const ig = p.results.instagram
    if (ig.permalink) { setLink(ig.permalink); return }
    let off = false
    socialCall('permalink', { mediaId: ig.mediaId, caption: p.caption, publishedAt: p.publishedAt })
      .then((r) => { if (!off) setLink(r.permalink || null) })
      .catch(() => { if (!off) setLink(null) })
    return () => { off = true }
  }, [p.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const remove = () => { deletePost(p.id); onDeleted?.(p); onClose() }
  return createPortal(
    <div className="modal-bg" onClick={(e) => { e.stopPropagation(); onClose() }}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t('¿Eliminar publicación?')}</h3>
        {onIg ? (
          <>
            <p className="muted">{t('¿Dónde quieres eliminarla?')}</p>
            <p className="muted"><small>{t('Instagram no permite borrar desde aplicaciones: se eliminará de la app y se abrirá la publicación para que la borres allí (⋯ → Eliminar).')}</small></p>
            <button className="btn danger" onClick={remove}>{t('Solo en la app')}</button>
            {link
              ? <a className="btn primary" href={link} target="_blank" rel="noopener noreferrer" onClick={remove}>{t('También en Instagram')}</a>
              : <button className="btn primary" disabled={link === undefined} onClick={() => { notify(t('No se pudo localizar la publicación en Instagram; búscala en tu perfil.'), 'err'); remove() }}>{link === undefined ? t('Buscando en Instagram…') : t('También en Instagram')}</button>}
          </>
        ) : (
          <>
            <p className="muted">{t('Esta acción no se puede deshacer.')}</p>
            <button className="btn danger" onClick={remove}>{t('Eliminar')}</button>
          </>
        )}
        <button className="btn ghost" onClick={onClose}>{t('Cancelar')}</button>
      </div>
    </div>,
    document.body,
  )
}
