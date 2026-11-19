import { useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { t, useLang } from '../lib/i18n.jsx'
import { PLATFORMS } from '../lib/formats.js'
import { Logo, ThemeToggle, LangToggle } from './ui.jsx'

const GoogleLogo = () => (
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

export default function Login() {
  const { login, register, loginWithGoogle } = useApp()
  useLang()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [err, setErr] = useState('')
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
      <div className="auth-top"><LangToggle /><ThemeToggle /></div>
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
          {Object.values(PLATFORMS).map((p) => <span key={p.id} style={{ '--pc': p.color }}><i />{p.name}</span>)}
        </div>
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
    </div>
  )
}
