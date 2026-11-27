// Interruptor «Publicar como Reel con música» para las imágenes: muestra cómo quedará el Reel y deja elegir la canción.
import { useEffect, useState } from 'react'
import { renderToDataURL } from '../lib/render.js'
import { reelFrame, REEL_SECONDS } from '../lib/photoReel.js'
import { t, useLang } from '../lib/i18n.jsx'
import IgMusic from './IgMusic.jsx'

export default function PhotoReel({ on, onToggle, design, format, music, onMusic, notify }) {
  useLang()
  const [view, setView] = useState(null)
  useEffect(() => {
    if (!on) return undefined
    let off = false
    const wait = setTimeout(() => {
      renderToDataURL({ ...design, format }, 'image/jpeg', 0.85, 540)
        .then((src) => reelFrame(src, 360))
        .then((c) => { if (!off) setView(c.toDataURL('image/jpeg', 0.85)) })
        .catch(() => {})
    }, 200)
    return () => { off = true; clearTimeout(wait) }
  }, [on, design, format])

  return (
    <div className="preel">
      <div className="save-copy">
        <span>
          <b id="photo-reel-title">🎵 {t('Publicar como Reel con música')}</b>
          <small>{t('Instagram solo deja poner música en Reels: tu imagen se publica como un Reel de {n} segundos.', { n: REEL_SECONDS })}</small>
        </span>
        <button type="button" className="lib-switch" role="switch" aria-checked={on} aria-labelledby="photo-reel-title" onClick={onToggle}>
          <span className="lib-switch-track" aria-hidden="true"><i /></span>
          <span>{on ? t('Encendido') : t('Apagado')}</span>
        </button>
      </div>
      {on && (
        <div className="preel-body">
          <figure className="preel-view">
            {view ? <img src={view} alt="" /> : <span />}
            <figcaption>{t('Así se verá el Reel')}</figcaption>
          </figure>
          <IgMusic photo value={music} onChange={onMusic} notify={notify} />
        </div>
      )}
    </div>
  )
}
