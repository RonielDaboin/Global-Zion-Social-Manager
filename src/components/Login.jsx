import { useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { t, useLang } from '../lib/i18n.jsx'
import { PLATFORMS } from '../lib/formats.js'
import { Logo, ThemeToggle, LangToggle, Icon } from './ui.jsx'
import { Footer } from './Legal.jsx'

export const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6C12.3 13.5 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.4 28.8A14.5 14.5 0 0 1 9.5 24c0-1.7.3-3.3.9-4.8l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.7-4-13.6-9.8l-7.8 6C6.5 42.6 14.6 48 24 48z" />
  </svg>
)

function GoogleSignIn({ onLogin, onError }) {
  return (
    <button type="button" className="btn gbtn wide" onClick={() => onLogin().catch((e) => onError(e.message))}>
      <GoogleLogo /> {t('Continuar con Google')}
    </button>
  )
}

const FLOATS = [
  { k: 'heart', x: '8%', y: '18%', s: 54, d: 0 },
  { k: 'play', x: '42%', y: '10%', s: 46, d: 1.5 },
  { k: 'chat', x: '30%', y: '72%', s: 50, d: 3 },
  { k: 'cam', x: '88%', y: '14%', s: 48, d: 2 },
  { k: 'note', x: '76%', y: '80%', s: 52, d: 4 },
  { k: 'send', x: '12%', y: '84%', s: 42, d: 5 },
]
const PATHS = {
  heart: <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.9 4.5 6.6 4.5c2 0 3.6 1.1 5.4 3.1 1.8-2 3.4-3.1 5.4-3.1 3.7 0 5.7 3.9 4.2 7.3C19.5 16.4 12 21 12 21z" />,
  play: <path d="M8 5v14l11-7z" />,
  chat: <path d="M4 4h16v12H8l-4 4z" />,
  cam: <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.5" cy="6.5" r="1.2" /></>,
  note: <path d="M14 3v11.2a3.5 3.5 0 1 1-2-3.2V3h2c.3 2.4 1.9 4 4 4.2v2.2c-1.5 0-2.9-.5-4-1.4" />,
  send: <path d="M3 11l18-8-8 18-2-8z" />,
}

const WA_BUBBLE = 'M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.3A9.5 9.5 0 1 0 12 2.5z'
const NET_GLYPH = {
  instagram: <><rect x="3.5" y="3.5" width="17" height="17" rx="5" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="12" cy="12" r="3.8" fill="none" stroke="currentColor" strokeWidth="2" /><circle cx="17.2" cy="6.8" r="1.2" /></>,
  tiktok: PATHS.note,
  facebook: <path d="M14 8V6.5c0-.7.3-1 1-1h1.5v-3H14C11.8 2.5 10.5 3.9 10.5 6V8H8v3h2.5v10.5H14V11h2.3l.4-3z" />,
  twitter: <path d="M17.8 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.3L5.3 21H2.2l7.2-8.3L1.8 3h6.4l4.4 5.8zm-1.1 16.2h1.7L7.4 4.7H5.6z" />,
  linkedin: <path d="M4 9h3.5v11H4zM5.75 3.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM10 9h3.3v1.5c.5-.9 1.7-1.8 3.4-1.8 3.4 0 4 2.2 4 5.1V20h-3.5v-5.4c0-1.3 0-2.9-1.8-2.9s-2 1.4-2 2.8V20H10z" />,
  youtube: <path fillRule="evenodd" d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3z" />,
  whatsapp: <><path d={WA_BUBBLE} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><path d="M9 7.5c-.4 0-1 .6-1 1.6 0 2.7 3.2 6 6 6 1 0 1.7-.7 1.7-1.2l-.1-.5-1.8-.9-.8.9c-1-.4-2.4-1.8-2.9-2.9l.8-.8-.8-1.9z" /></>,
  'whatsapp-business': <><path d={WA_BUBBLE} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /><text x="12" y="16" textAnchor="middle" fontSize="10.5" fontWeight="800" fontFamily="Arial, sans-serif">B</text></>,
  email: <><rect x="3" y="5.5" width="18" height="13" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M4 7.5l8 6 8-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></>,
}

function NetIcon({ id }) {
  return (
    <b className="ni" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="currentColor">{NET_GLYPH[id]}</svg>
    </b>
  )
}

function AuthBg() {
  return (
    <div className="auth-bg" aria-hidden="true">
      <span className="orb o1" /><span className="orb o2" /><span className="orb o3" /><span className="orb o4" />
      <div className="auth-grid" />
      {FLOATS.map((f) => (
        <svg key={f.k} className="flt" viewBox="0 0 24 24" fill="currentColor"
          style={{ left: f.x, top: f.y, width: f.s, height: f.s, animationDelay: `-${f.d}s` }}>{PATHS[f.k]}</svg>
      ))}
    </div>
  )
}

/** Si Supabase/Google devolvió un error en la URL (p. ej. registro desactivado) se muestra y se limpia la dirección. */
function urlAuthError() {
  try {
    const q = new URLSearchParams(window.location.search)
    const code = q.get('error_code'), desc = q.get('error_description')
    if (!code && !desc) return ''
    window.history.replaceState(null, '', window.location.pathname + '#/dashboard')
    if (code === 'signup_disabled') return t('El registro de cuentas nuevas está desactivado por ahora. Escríbenos para darte acceso.')
    return desc ? desc.replace(/\+/g, ' ') : t('No se pudo iniciar sesión con Google. Inténtalo de nuevo.')
  } catch { return '' }
}

export default function Login() {
  const { login, register, loginWithGoogle, openPlans } = useApp()
  useLang()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [err, setErr] = useState(urlAuthError)
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    if (mode === 'register' && f.password.length < 6) return setErr(t('La contraseña debe tener al menos 6 caracteres'))
    setBusy(true)
    try {
      if (mode === 'login') await login(f.email, f.password)
      else await register(f.name, f.email, f.password)
    } catch (ex) {
      setErr(ex.message)
    }
    setBusy(false)
  }

  return (
    <div className="auth">
      <AuthBg />
      <div className="auth-top">
        <button type="button" className="link-plans" onClick={() => openPlans()}><Icon name="star" size={15} /> <span>{t('Ver planes')}</span></button>
        <LangToggle /><ThemeToggle />
      </div>
      <div className="auth-hero">
        <Logo big />
        <h1>{t('Crea, programa y controla tus publicaciones de')} <span className="grad">Instagram</span> {t('y')} <span className="grad">TikTok</span>.</h1>
        <ul>
          <li>🎨 {t('Editor de imágenes con formatos para Post, Story, Reel y TikTok')}</li>
          <li>✍️ {t('Generador de textos y hashtags')}</li>
          <li>🔗 {t('Conecta tus cuentas y gestiona todo desde un solo lugar')}</li>
          <li>📅 {t('Calendario y programación de publicaciones')}</li>
        </ul>
        <div className="net-pills">
          {Object.values(PLATFORMS).map((p) => <span key={p.id} style={{ '--pc': p.color }}><NetIcon id={p.id} />{p.name}</span>)}
        </div>
        <button type="button" className="btn primary hero-plans" onClick={() => openPlans()}><Icon name="crown" size={16} /> {t('Ver planes: Básico, PRO y Premium')}</button>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <h2>{mode === 'login' ? t('Iniciar sesión') : t('Crear cuenta')}</h2>
        <GoogleSignIn onLogin={loginWithGoogle} onError={setErr} />
        <div className="or"><span>{t('o con tu correo')}</span></div>
        {mode === 'register' && (
          <label>{t('Nombre')}<input required value={f.name} onChange={set('name')} placeholder={t('Tu nombre')} /></label>
        )}
        <label>{t('Correo')}<input required type="email" value={f.email} onChange={set('email')} placeholder="tucorreo@ejemplo.com" /></label>
        <label>{t('Contraseña')}<input required type="password" value={f.password} onChange={set('password')} placeholder="••••••" /></label>
        {err && <p className="error">{err}</p>}
        <button className="btn primary wide" disabled={busy}>{busy ? t('Un momento…') : mode === 'login' ? t('Entrar') : t('Crear cuenta')}</button>
        <p className="switch">
          {mode === 'login' ? t('¿Primera vez?') : t('¿Ya tienes cuenta?')}{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); setErr(''); setMode(mode === 'login' ? 'register' : 'login') }}>
            {mode === 'login' ? t('Crea tu cuenta') : t('Inicia sesión')}
          </a>
        </p>
      </form>
      <Footer className="auth-foot" />
    </div>
  )
}
