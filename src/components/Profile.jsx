import { useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { t, locale } from '../lib/i18n.jsx'
import { Icon, Avatar, PlatformLogo, StatusTag, fmtDate } from './ui.jsx'
import { accessOf } from '../lib/plans.js'
import { PLATFORMS, accountLabel } from '../lib/formats.js'
import { supabase, toSession } from '../lib/supabase.js'
import { useUsageTime, fmtDur } from '../lib/useTime.js'

const fmt = (d) => (d ? new Date(d).toLocaleDateString(locale(), { dateStyle: 'long' }) : '—')
const PROV = { google: 'Google', email: 'Correo y contraseña' }
const CHANNELS = [['whatsapp', 'WhatsApp'], ['email', 'Correo'], ['call', 'Llamada']]

function Row({ p }) {
  return (
  <div className="pf-post">
    <div className="pf-thumb">{p.image ? <img src={p.image} alt="" /> : null}{p.mediaType === 'video' && <span>▶</span>}</div>
    <div className="pf-post-b">
      <b>{(p.caption || p.text || p.title || t('Sin texto')).toString().slice(0, 60)}</b>
      <small><span className="pf-nets">{(p.platforms || []).map((x) => <PlatformLogo key={x} id={x} size={16} />)}</span> {p.scheduledAt ? fmtDate(p.scheduledAt) : ''}</small>
    </div>
    <StatusTag s={p.status} />
  </div>
  )
}

// Muestra 2 publicaciones; la 3.ª aparece difuminada con «Ver más» para desplegar el resto
const List = ({ items, empty }) => {
  const [more, setMore] = useState(false)
  if (!items.length) return <p className="muted small">{empty}</p>
  if (more || items.length <= 2) return <>{items.map((p) => <Row key={p.id} p={p} />)}{items.length > 2 && <button className="btn ghost sm pf-more-btn" onClick={() => setMore(false)}>{t('Ver menos')}</button>}</>
  return (
    <>
      {items.slice(0, 2).map((p) => <Row key={p.id} p={p} />)}
      <div className="pf-peek">
        <div className="pf-peek-row"><Row p={items[2]} /></div>
        <button className="btn sm pf-more" onClick={() => setMore(true)}>{t('Ver más')} (+{items.length - 2})</button>
      </div>
    </>
  )
}

function Activity() {
  const { posts: all, accounts, session } = useApp()
  // Trabajo de esta persona: publicaciones que creó con su correo (las antiguas sin autor se consideran suyas)
  const posts = all.filter((p) => !p.author || p.author.email === session.email)
  const n = (st) => posts.filter((p) => p.status === st).length
  const nets = Object.keys(accounts).filter((id) => PLATFORMS[id])
  const upcoming = posts.filter((p) => p.status === 'scheduled').sort((a, b) => a.scheduledAt - b.scheduledAt).slice(0, 12)
  const recent = posts.filter((p) => p.status === 'published').sort((a, b) => (b.scheduledAt || 0) - (a.scheduledAt || 0)).slice(0, 12)
  const byNet = Object.keys(PLATFORMS).map((id) => [id, posts.filter((p) => p.platforms?.includes(id)).length]).filter(([, c]) => c).sort((a, b) => b[1] - a[1])
  const max = byNet[0]?.[1] || 1
  const kpis = [['Creadas por ti', posts.length, ''], ['Publicadas', n('published'), 'green'], ['Programadas', n('scheduled'), 'blue'], ['Borradores', n('draft'), ''], ['Fallidas', n('failed'), 'red']]
  return (
    <>
      <div className="card">
        <h3>{t('Tu actividad')}</h3>
        <div className="pf-kpis">{kpis.map(([l, v, c]) => <div key={l} className={'pf-kpi ' + c}><b>{v}</b><span>{t(l)}</span></div>)}</div>
      </div>
      <div className="card">
        <h3>{t('Redes conectadas')} <small className="muted">({nets.length}/{Object.keys(PLATFORMS).length})</small></h3>
        {nets.length ? <div className="pf-accs">{nets.map((id) => (
          <div key={id} className="pf-acc"><PlatformLogo id={id} size={26} /><div><b>{PLATFORMS[id].name}</b><small>{accounts[id].username ? accountLabel(PLATFORMS[id], accounts[id]) : '—'}{accounts[id].real ? '' : ' · demo'}</small></div></div>
        ))}</div> : <p className="muted small">{t('Aún no has conectado ninguna red.')}</p>}
      </div>
      {byNet.length > 0 && (
        <div className="card">
          <h3>{t('Publicaciones por red')}</h3>
          {byNet.map(([id, c]) => (
            <div key={id} className="pf-bar"><PlatformLogo id={id} size={18} /><div className="pf-track"><i style={{ width: (c / max) * 100 + '%' }} /></div><b>{c}</b></div>
          ))}
        </div>
      )}
      <div className="card">
        <h3>{t('Próximas programadas')}</h3>
        <List items={upcoming} empty={t('No tienes publicaciones programadas.')} />
      </div>
      <div className="card">
        <h3>{t('Últimas publicadas')}</h3>
        <List items={recent} empty={t('Aún no has publicado nada.')} />
      </div>
    </>
  )
}

function Stat({ label, value }) {
  return <div className="pf-stat"><b>{value}</b><span>{label}</span></div>
}
function Info({ label, value }) {
  return <div className="pf-info"><dt>{label}</dt><dd>{value || '—'}</dd></div>
}

export default function Profile({ onLogout }) {
  const { session: s } = useApp()
  const use = useUsageTime(s.id)
  const [phone, setPhone] = useState(s.phone || '')
  const [loc, setLoc] = useState(s.location || '')
  const [pref, setPref] = useState(s.contactPref)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // { ok, text }
  const google = s.providers?.includes('google')
  const { role, plan } = accessOf(s)
  const dirty = phone !== (s.phone || '') || loc !== (s.location || '') || pref !== s.contactPref
  const complete = !!(s.phone && s.location)

  const update = async (data, okText) => {
    setBusy(true); setMsg(null)
    const { error } = await supabase.auth.updateUser({ data })
    setBusy(false)
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: okText })
  }
  const save = () => update({ phone_number: phone.trim(), location: loc.trim(), contact_pref: pref }, t('Guardado'))
  const refresh = async () => {
    setBusy(true); setMsg(null)
    await supabase.auth.refreshSession()
    const { data } = await supabase.auth.getUser()
    setBusy(false)
    setMsg(data?.user && toSession(data.user).picture ? { ok: true, text: t('Foto actualizada') } : { ok: false, text: t('Google sigue sin entregar la foto. Cierra sesión y vuelve a entrar con Google.') })
  }
  const setAvatar =(mode) => mode !== s.avatarMode && update({ avatar_mode: mode }, t('Foto actualizada'))

  // Ubicación solo con el permiso del navegador; se guarda ciudad y país, no las coordenadas
  const locate = () => {
    if (!navigator.geolocation) return setMsg({ ok: false, text: t('Tu navegador no permite obtener la ubicación.') })
    setBusy(true); setMsg(null)
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=${locale().slice(0, 2)}`)
        const j = await r.json()
        const place = [j.city || j.locality, j.principalSubdivision, j.countryName].filter(Boolean).join(', ')
        if (place) setLoc(place)
        setMsg(place ? { ok: true, text: t('Ubicación detectada; pulsa Guardar.') } : { ok: false, text: t('No se pudo determinar el lugar.') })
      } catch { setMsg({ ok: false, text: t('No se pudo determinar el lugar.') }) }
      setBusy(false)
    }, () => { setBusy(false); setMsg({ ok: false, text: t('Permiso de ubicación denegado.') }) }, { timeout: 10000 })
  }

  return (
    <div className="profile">
      <div className="card pf-hero">
        <div className="pf-cover"><div className="pf-wm" aria-hidden="true"><b>GLOBAL ZION</b><span>SOCIAL MANAGER</span></div></div>
        <div className="pf-head">
          <Avatar session={s} size={96} />
          <div className="pf-who">
            <h2>{s.name}</h2>
            <p>{s.email}</p>
            <div className="pf-tags">
              {role.id !== 'user' && <span className="pf-tag owner"><Icon name="crown" size={13} /> {t(role.name)}</span>}
              <span className={'pf-tag plan ' + plan.tone}><Icon name="star" size={13} /> {plan.name}</span>
              {google && <span className="pf-tag">Google</span>}
              {s.emailVerified && <span className="pf-tag ok"><Icon name="check" size={13} /> {t('Correo verificado')}</span>}
            </div>
          </div>
        </div>
        {!s.picture && google && (
          <div className="pf-avatar-pick">
            <span>{t('Google no entregó tu foto todavía.')}<small className="muted" style={{ display: 'block' }}>{t('Datos recibidos de Google')}: {s.googleKeys?.join(', ') || '—'}. {t('Si no tienes foto de perfil en tu cuenta de Google, no hay nada que mostrar: agrégala en myaccount.google.com.')}</small></span>
            <button className="btn sm" disabled={busy} onClick={refresh}>{t('Actualizar desde Google')}</button>
          </div>
        )}
        {s.picture && (
          <div className="pf-avatar-pick">
            <span>{t('Mostrar como avatar')}</span>
            <div className="seg" role="group">
              <button className={s.avatarMode !== 'initial' ? 'on' : ''} disabled={busy} onClick={() => setAvatar('photo')}>{t('Foto de Google')}</button>
              <button className={s.avatarMode === 'initial' ? 'on' : ''} disabled={busy} onClick={() => setAvatar('initial')}>{t('Inicial')} ({(s.name[0] || '?').toUpperCase()})</button>
            </div>
          </div>
        )}
      </div>

      <div className="pf-cols">
      <div className="pf-col">
      <div className={'card pf-plan ' + plan.tone}>
        <div className="pf-title">
          <h3>{t('Tu plan')}</h3>
          <span className="pf-badge ok">{t('Activo')}</span>
        </div>
        <div className="pf-plan-name"><Icon name="star" size={22} /> <b>{plan.name}</b>{role.id === 'owner' && <span>· {t(role.name)}</span>}</div>
        <ul className="pf-perks">{plan.perks.map((k) => <li key={k}><Icon name="check" size={15} /> {t(k)}</li>)}</ul>
        {role.id === 'owner' && <p className="muted small">{t('Tienes acceso total como creador de la aplicación.')}</p>}
      </div>
      <div className="pf-stats">
        <Stat label={t('En esta sesión')} value={fmtDur(use.visit)} />
        <Stat label={t('Tiempo total de uso')} value={fmtDur(use.total)} />
        <Stat label={t('Sesiones iniciadas')} value={use.sessions} />
      </div>

      <div className="card pf-contact">
        <div className="pf-title">
          <h3>{t('Datos de contacto')}</h3>
          <span className={'pf-badge' + (complete ? ' ok' : '')}>{complete ? t('Completo') : t('Incompleto')}</span>
        </div>
        <p className="muted small">{t('Los usamos solo para avisarte si hay un problema con tu cuenta o con el servicio. Son opcionales.')}</p>

        <label className="pf-field"><span>{t('Teléfono')}</span>
          <input type="tel" inputMode="tel" autoComplete="tel" placeholder="+56 9 1234 5678" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        <label className="pf-field"><span>{t('Ubicación')}</span>
          <div className="pf-loc">
            <input type="text" autoComplete="off" placeholder={t('Ciudad, País')} value={loc} onChange={(e) => setLoc(e.target.value)} />
            <button className="btn" type="button" disabled={busy} onClick={locate}>{t('Usar mi ubicación')}</button>
          </div>
        </label>
        <div className="pf-field"><span>{t('¿Cómo prefieres que te contactemos?')}</span>
          <div className="seg" role="group">
            {CHANNELS.map(([id, label]) => <button key={id} type="button" className={pref === id ? 'on' : ''} onClick={() => setPref(id)}>{t(label)}</button>)}
          </div>
        </div>

        <div className="pf-actions">
          <button className="btn primary" disabled={busy || !dirty} onClick={save}>{t('Guardar')}</button>
          {msg && <span className={'pf-msg' + (msg.ok ? ' ok' : ' err')}>{msg.text}</span>}
        </div>
        <p className="muted small">{t('La ubicación se pide con tu permiso y solo se guarda la ciudad y el país, nunca las coordenadas.')}</p>
      </div>

      <div className="card">
        <h3>{t('Tu cuenta')}</h3>
        <dl className="pf-grid">
          <Info label={t('Nombre')} value={s.givenName} />
          <Info label={t('Apellido')} value={s.familyName} />
          <Info label={t('Método de acceso')} value={(s.providers?.length ? s.providers : ['email']).map((p) => t(PROV[p] || p)).join(', ')} />
          <Info label={t('Cuenta creada')} value={fmt(s.createdAt)} />
          <Info label={t('Último acceso')} value={fmt(s.lastSignIn)} />
          {google && <Info label={t('ID de Google')} value={s.googleId} />}
        </dl>
        <p className="muted small">{t('Para cambiar tu nombre o foto, edítalos en tu cuenta de Google; se actualizarán al volver a iniciar sesión.')}</p>
        <button className="btn danger" onClick={onLogout}><Icon name="out" /> {t('Cerrar sesión')}</button>
      </div>
      </div>
      <aside className="pf-col"><Activity /></aside>
      </div>
    </div>
  )
}
