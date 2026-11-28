import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../lib/store.jsx'
import { loadVideo } from '../lib/mediaStore.js'
import { PLATFORMS, EMAIL_PROVIDERS } from '../lib/formats.js'
import { t, useLang } from '../lib/i18n.jsx'
import { PlatformLogo, StatusTag, Icon, fmtDate } from './ui.jsx'

function Media({ p, vurl, className }) {
  if (p.mediaType === 'video' && vurl) return <video className={className} src={vurl} poster={p.image} controls playsInline />
  // Video ya publicado: solo se conserva una captura como referencia
  return p.image ? <img className={className} src={p.image} alt={p.mediaType === 'video' ? t('Captura del video publicado') : ''} title={p.mediaType === 'video' ? t('Captura del video publicado') : undefined} /> : null
}

const Av = ({ name }) => <span className="sim-av">{(name || '?').replace('@', '').slice(0, 1).toUpperCase()}</span>

function Instagram({ p, h, vurl, when }) {
  return (
    <div className="sim sim-ig">
      <div className="sim-head"><Av name={h} /><b>{h.replace('@', '')}</b><span className="sim-dots">•••</span></div>
      <Media p={p} vurl={vurl} className="sim-media sq" />
      <div className="sim-acts"><span>♡</span><span>💬</span><span>➤</span><span className="r">🔖</span></div>
      <div className="sim-body"><b>{h.replace('@', '')}</b> {p.caption}</div>
      <small className="sim-time">{when}</small>
    </div>
  )
}

function TikTok({ p, h, vurl }) {
  return (
    <div className="sim sim-tt">
      <Media p={p} vurl={vurl} className="sim-bg" />
      <div className="sim-shade" />
      <div className="sim-side"><span>♥<small>0</small></span><span>💬<small>0</small></span><span>🔖</span><span>➦</span></div>
      <div className="sim-cap"><b>@{h.replace('@', '')}</b><p>{p.caption}</p><small>♫ {t('sonido original')}</small></div>
    </div>
  )
}

function Facebook({ p, h, vurl, when }) {
  return (
    <div className="sim sim-fb">
      <div className="sim-head"><Av name={h} /><div><b>{h.replace('@', '')}</b><small>{when} · 🌐</small></div><span className="sim-dots">•••</span></div>
      <div className="sim-body">{p.caption}</div>
      <Media p={p} vurl={vurl} className="sim-media" />
      <div className="sim-stats"><span>👍 0</span><span>0 {t('comentarios')}</span></div>
      <div className="sim-fbacts"><span>👍 {t('Me gusta')}</span><span>💬 {t('Comentar')}</span><span>↗ {t('Compartir')}</span></div>
    </div>
  )
}

function X({ p, h, vurl, when }) {
  return (
    <div className="sim sim-x">
      <Av name={h} />
      <div className="sim-xmain">
        <div><b>{h.replace('@', '')}</b> <span className="mut">@{h.replace('@', '')} · {when}</span></div>
        <div className="sim-body">{p.caption}</div>
        <Media p={p} vurl={vurl} className="sim-media rd" />
        <div className="sim-xacts"><span>💬 0</span><span>🔁 0</span><span>♡ 0</span><span>📊 0</span></div>
      </div>
    </div>
  )
}

function LinkedIn({ p, h, vurl, when }) {
  return (
    <div className="sim sim-li">
      <div className="sim-head"><Av name={h} /><div><b>{h.replace('@', '')}</b><small>{t('Página')} · {when} · 🌐</small></div><span className="sim-dots">•••</span></div>
      <div className="sim-body">{p.caption}</div>
      <Media p={p} vurl={vurl} className="sim-media" />
      <div className="sim-stats"><span>👍 0</span><span>0 {t('comentarios')}</span></div>
      <div className="sim-fbacts"><span>👍 {t('Me gusta')}</span><span>💬 {t('Comentar')}</span><span>🔁 {t('Compartir')}</span><span>✉ {t('Enviar')}</span></div>
    </div>
  )
}

function YouTube({ p, h, vurl, when }) {
  const [title, ...rest] = (p.caption || '').split('\n')
  return (
    <div className="sim sim-yt">
      <div className="sim-ytmedia"><Media p={p} vurl={vurl} className="sim-media" /></div>
      <div className="sim-ytinfo">
        <h4>{title || t('(sin título)')}</h4>
        <div className="sim-head"><Av name={h} /><div><b>{h.replace('@', '')}</b><small>0 {t('suscriptores')} · {when}</small></div><span className="sim-ytsub">{t('Suscribirse')}</span></div>
        {rest.join('\n').trim() && <div className="sim-body">{rest.join('\n').trim()}</div>}
        <div className="sim-ytacts"><span>👍 0</span><span>👎</span><span>↗ {t('Compartir')}</span></div>
      </div>
    </div>
  )
}

function WhatsApp({ p, h, vurl, when, biz }) {
  const time = new Date(p.publishedAt || p.scheduledAt || p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="sim sim-wa">
      <div className="sim-wahead"><span>‹</span><Av name={h} /><div><b>{h}</b><small>{biz ? t('Cuenta de empresa') : t('en línea')}</small></div></div>
      <div className="sim-chat">
        <div className="sim-bubble">
          <Media p={p} vurl={vurl} className="sim-media rd" />
          {p.caption && <div className="sim-body">{p.caption}</div>}
          <small className="sim-ts">{time} <span className="chk">✓✓</span></small>
        </div>
      </div>
    </div>
  )
}

function Email({ p, h, vurl, prov, when }) {
  return (
    <div className="sim sim-em">
      <div className="sim-emtop">{prov || t('Correo')}</div>
      <h4>{p.subject || t('(sin asunto)')}</h4>
      <div className="sim-head"><Av name={h} /><div><b>{h}</b><small>{t('para')}: {p.recipients || '—'}</small></div><small className="r">{when}</small></div>
      <Media p={p} vurl={vurl} className="sim-media" />
      <div className="sim-body">{p.caption}</div>
    </div>
  )
}

/** Solo la imagen, a pantalla completa. Al tocarla se amplía sobre ese punto para revisar los detalles. */
function ImageZoom({ src, onClose }) {
  const [zoomed, setZoomed] = useState(false)
  const toggle = (e) => {
    e.stopPropagation()
    const img = e.currentTarget
    const box = img.parentElement
    const r = img.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    setZoomed(!zoomed)
    if (!zoomed) requestAnimationFrame(() => {
      box.scrollLeft = img.offsetLeft + x * img.offsetWidth - box.clientWidth / 2
      box.scrollTop = img.offsetTop + y * img.offsetHeight - box.clientHeight / 2
    })
  }
  return createPortal(
    <div className={'lightbox pv-zoom' + (zoomed ? ' zoomed' : '')} onClick={onClose} role="dialog" aria-modal="true">
      <button type="button" className="btn ghost sm lb-close" onClick={onClose} title={t('Cerrar')} aria-label={t('Cerrar')}>✕</button>
      <img src={src} alt="" onClick={toggle} />
    </div>,
    document.body,
  )
}

export default function PostPreview({ p, onClose, actions }) {
  const { accounts, session } = useApp()
  const [vurl, setVurl] = useState(null)
  const [tab, setTab] = useState(p.platforms[0])
  useLang()
  useEffect(() => {
    if (p.mediaType !== 'video' || p.status === 'published') return
    let u
    loadVideo(p.id).then((b) => { if (b) { u = URL.createObjectURL(b); setVurl(u) } })
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [p.id, p.mediaType])

  const [zoom, setZoom] = useState(null) // imagen abierta a pantalla completa
  const openZoom = (e) => { if (e.target.matches('img.sim-media, img.sim-bg')) setZoom(e.target.src) }

  const [closing, setClosing] = useState(false)
  const close = () => { if (closing) return; setClosing(true); setTimeout(onClose, 220) }
  useEffect(() => {
    // Con la imagen ampliada, Esc cierra primero solo la imagen
    const k = (e) => { if (e.key !== 'Escape') return; if (zoom) setZoom(null); else close() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  })

  const acc = accounts[tab]
  const h = acc?.username || session?.name || 'globalzion'
  const when = fmtDate(p.publishedAt || p.scheduledAt || p.createdAt)
  const prov = acc?.provider ? EMAIL_PROVIDERS.find((e) => e.id === acc.provider)?.name : ''
  const props = { p, h, vurl, when }
  const r = p.results?.[tab]

  return createPortal(
    <div className={'modal-bg pm-bg' + (closing ? ' out' : '')} onClick={close}>
      <div className="modal post-modal" onClick={(e) => e.stopPropagation()}>
        <div className="row between">
          <div className="sim-tabs">{p.platforms.map((x) => (
            <button key={x} className={'chip' + (tab === x ? ' on' : '')} onClick={() => setTab(x)}><PlatformLogo id={x} size={16} /> {PLATFORMS[x].name}</button>
          ))}</div>
          <div className="row pv-end"><StatusTag s={p.status} /><button className="icon-btn pv-x" onClick={close} title={t('Cerrar')} aria-label={t('Cerrar')}><Icon name="x" size={20} /></button></div>
        </div>
        <div className="sim-stage" onClick={openZoom}>
          {tab === 'instagram' && <Instagram {...props} />}
          {tab === 'tiktok' && <TikTok {...props} />}
          {tab === 'facebook' && <Facebook {...props} />}
          {tab === 'twitter' && <X {...props} />}
          {tab === 'linkedin' && <LinkedIn {...props} />}
          {tab === 'youtube' && <YouTube {...props} />}
          {tab === 'whatsapp' && <WhatsApp {...props} />}
          {tab === 'whatsapp-business' && <WhatsApp {...props} biz />}
          {tab === 'email' && <Email {...props} prov={prov} />}
        </div>
        {r && <small className="muted">{r.ok ? '✅' : '❌'} {r.demo ? t('modo demo') : ''}{r.error ? ' ' + r.error : ''}</small>}
        <small className="muted">{p.num && <><span className="post-num">#{p.num}</span> </>}{p.author && <>👤 {p.author.name} · </>}{t('Simulación de cómo se ve la publicación')}</small>
        {actions && <div className="row">{actions(close)}</div>}
        {zoom && <ImageZoom src={zoom} onClose={() => setZoom(null)} />}
      </div>
    </div>,
    document.body,
  )
}
