import { useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { t, useLang } from '../lib/i18n.jsx'
import { PLATFORMS, EMAIL_PROVIDERS, accountLabel } from '../lib/formats.js'
import { startRealOAuth } from '../lib/social.js'
import { fmtDate, PlatformLogo, Icon } from './ui.jsx'
import { planFor } from '../lib/plans.js'

const BLURB = {
  instagram: 'Publica posts, stories y reels en tu cuenta profesional de Instagram.',
  tiktok: 'Publica imágenes y videos en tu cuenta de TikTok.',
  facebook: 'Publica en tu página de Facebook.',
  twitter: 'Publica posts en tu cuenta de X (Twitter).',
  linkedin: 'Publica posts y videos en tu perfil o página de LinkedIn.',
  youtube: 'Sube videos y Shorts a tu canal de YouTube.',
  whatsapp: 'Envía mensajes e imágenes desde tu WhatsApp personal.',
  'whatsapp-business': 'Envía mensajes y catálogos con la API de WhatsApp Business.',
  email: 'Envía correos y newsletters con Gmail, Outlook u otro gestor de correo.',
}
const valid = (p, v, prov) => {
  const x = v.trim()
  if (p.kind === 'phone') return x.replace(/\D/g, '').length >= 8
  if (p.kind === 'email') return /^\S+@\S+\.\S+$/.test(x) && Boolean(prov)
  return x.replace('@', '').length >= 2
}

export default function Accounts() {
  const { accounts, connectAccount, disconnectAccount, notify, social, access, openPlans } = useApp()
  const lim = access.limits
  const nConnected = Object.keys(accounts).filter((k) => PLATFORMS[k]).length
  useLang()
  const [modal, setModal] = useState(null) // platform id
  const [user, setUser] = useState('')
  const [step, setStep] = useState(0)
  const [prov, setProv] = useState('gmail')

  // El login se abre en una ventana aparte: la app queda como está y se cierra el modal de espera
  const realOAuth = (p) => startRealOAuth(p).then(() => setModal(null)).catch((e) => { notify(e.message, 'err'); setModal(null) })
  const isReal = (p) => Boolean(social.configured[p])
  const realEmail = modal === 'email' && prov === 'gmail' && isReal('email') // Gmail: OAuth de Google
  const open = (p) => {
    if (!lim.platforms.includes(p)) return openPlans(t('{p} está disponible desde el plan {n}.', { p: PLATFORMS[p].name, n: planFor((l) => l.platforms.includes(p)).name }))
    if (nConnected >= lim.accounts) return openPlans(t('Tu plan {a} permite hasta {n} cuentas conectadas. Desconecta una o sube de plan.', { a: access.plan.name, n: lim.accounts }))
    if (isReal(p) && p !== 'email') return realOAuth(p)
    setUser(''); setStep(0); setProv('gmail'); setModal(p)
  }
  const authorize = () => {
    setStep(1)
    if (realEmail) return realOAuth('email')
    setTimeout(() => {
      const k = PLATFORMS[modal].kind
      const u = k === 'user' ? user.replace('@', '').trim() : user.trim()
      connectAccount(modal, { username: u, name: u, demo: true, provider: k === 'email' ? prov : undefined })
      notify(t('{u} conectada en {p}', { u: k === 'user' ? '@' + u : u, p: PLATFORMS[modal].name }))
      setModal(null)
    }, 1200)
  }

  return (
    <div className="page acct">
      <header className="ph"><h1>{t('Cuentas conectadas')}</h1><p>{t('Inicia sesión con tus redes para controlar las publicaciones.')}</p></header>
      <div className="cards2">
        {Object.values(PLATFORMS).map((p) => {
          const acc = accounts[p.id]
          return (
            <div className="card acc" key={p.id} style={{ '--pc': p.color }}>
              <div className="acc-top">
                <div className="acc-ico"><PlatformLogo id={p.id} size={34} /></div>
                <div><h3>{p.name}</h3><p>{t(BLURB[p.id])}</p></div>
              </div>
              {acc ? (
                <>
                  <div className="acc-info">
                    <div className="avatar">{acc.avatar ? <img src={acc.avatar} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} /> : acc.username[0]?.toUpperCase()}</div>
                    <div><b>{accountLabel(p, acc)}</b><small>{acc.provider ? EMAIL_PROVIDERS.find((e) => e.id === acc.provider)?.name + ' · ' : ''}{t('Conectada')} · {fmtDate(acc.connectedAt)}{!acc.real ? ' · ' + t('modo demo') : ''}</small></div>
                    <span className="dot on" />
                  </div>
                  <button className="btn ghost" onClick={async () => { if (await disconnectAccount(p.id)) notify(t('Cuenta desconectada')) }}>{t('Desconectar')}</button>
                </>
              ) : (
                lim.platforms.includes(p.id)
                  ? <button className="btn primary" onClick={() => open(p.id)}>{t('Iniciar sesión con {p}', { p: p.name })}</button>
                  : <button className="btn locked" onClick={() => open(p.id)}><Icon name="lock" size={15} /> {t('Disponible en {n}', { n: planFor((l) => l.platforms.includes(p.id)).name })}</button>
              )}
            </div>
          )
        })}
      </div>

      <div className="card note">
        <h3>ℹ️ {t('Sobre la conexión real')}</h3>
        {social.ready && <p><b>{t('Estado del servidor')}:</b> {['instagram', 'facebook', 'tiktok', 'email'].map((k) => `${PLATFORMS[k].name} ${social.configured[k] ? '✅' : '—'}`).join(' · ')}</p>}
        <p>
          {t('Sin credenciales configuradas, la app funciona en modo demo: la autorización y la publicación se simulan en tu navegador.')}{' '}
          {t('Para publicar de verdad necesitas registrar tu app en Meta for Developers (Instagram, Facebook y WhatsApp Cloud API), TikTok for Developers, X Developer Portal, LinkedIn Developers y Google Cloud (YouTube Data API), conectar tu gestor de correo (Gmail API, Microsoft Graph o SMTP) en el backend, definir las claves en .env y desplegar un pequeño backend que guarde los tokens. Los pasos están en el README.md.')}
        </p>
      </div>

      {modal && (
        <div className="modal-bg" onClick={() => step === 0 && setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ '--pc': PLATFORMS[modal].color }}>
            <div className="acc-ico"><PlatformLogo id={modal} size={34} /></div>
            <h3>{t('Iniciar sesión con {p}', { p: PLATFORMS[modal].name })}</h3>
            <p className="muted">{realEmail ? t('Se abrirá Google para que autorices el envío de correos desde tu cuenta de Gmail.') : t('Simulación de autorización (modo demo). GLOBAL ZION solicitaría permiso para publicar contenido en tu nombre.')}</p>
            {step === 0 ? (
              <>
                {PLATFORMS[modal].kind === 'email' && (
                  <label>{t('Gestor de correo')}<select value={prov} onChange={(e) => setProv(e.target.value)}>{EMAIL_PROVIDERS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
                )}
                {!realEmail && <label>
                  {PLATFORMS[modal].kind === 'phone' ? t('Número con código de país') : PLATFORMS[modal].kind === 'email' ? t('Correo electrónico') : t('Usuario')}
                  <input autoFocus value={user} onChange={(e) => setUser(e.target.value)}
                    placeholder={PLATFORMS[modal].kind === 'phone' ? '+56 9 1234 5678' : PLATFORMS[modal].kind === 'email' ? 'tu@correo.com' : '@tu_usuario'} />
                </label>}
                <div className="row end">
                  <button className="btn ghost" onClick={() => setModal(null)}>{t('Cancelar')}</button>
                  <button className="btn primary" disabled={!realEmail && !valid(PLATFORMS[modal], user, prov)} onClick={authorize}>{t('Autorizar')}</button>
                </div>
              </>
            ) : <div className="spin">{t('Autorizando…')}</div>}
          </div>
        </div>
      )}
    </div>
  )
}
