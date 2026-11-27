import { useState } from 'react'
import { PLATFORMS } from '../lib/formats.js'
import { t, useLang, locale } from '../lib/i18n.jsx'
// Logos oficiales de las marcas (paquete simple-icons); se importan como texto SVG y se extrae su trazo.
import igSvg from 'simple-icons/icons/instagram.svg?raw'
import ttSvg from 'simple-icons/icons/tiktok.svg?raw'
import fbSvg from 'simple-icons/icons/facebook.svg?raw'
import xSvg from 'simple-icons/icons/x.svg?raw'
import waSvg from 'simple-icons/icons/whatsapp.svg?raw'
import ytSvg from 'simple-icons/icons/youtube.svg?raw'

const pathOf = (svg) => svg.match(/<path d="([^"]+)"/)?.[1] || ''
const LOGO = {
  instagram: pathOf(igSvg), tiktok: pathOf(ttSvg), facebook: pathOf(fbSvg), twitter: pathOf(xSvg),
  whatsapp: pathOf(waSvg), 'whatsapp-business': pathOf(waSvg),
  youtube: pathOf(ytSvg),
  linkedin: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452z',
  email: 'M2 5h20v14H2zM2 6l10 7.5L22 6', // sobre genérico (el correo no es una marca única)
}
// Fondo del logo por red
const LOGO_BG = {
  instagram: 'linear-gradient(45deg,#feda75,#fa7e1e 25%,#d62976 50%,#962fbf 75%,#4f5bd5)',
  tiktok: '#010101', facebook: '#1877f2', twitter: '#000000',
  whatsapp: '#25d366', 'whatsapp-business': '#128c7e', email: '#ea4335', linkedin: '#0a66c2', youtube: '#ff0000',
}

export function PlatformLogo({ id, size = 22 }) {
  const d = LOGO[id]
  if (!d) return null
  const stroke = id === 'email'
  return (
    <span className="plogo" style={{ width: size, height: size, background: LOGO_BG[id] }} role="img" aria-label={PLATFORMS[id]?.name}>
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} fill={stroke ? 'none' : '#fff'} stroke={stroke ? '#fff' : 'none'} strokeWidth="1.8" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </span>
  )
}

/** Con `onClick` el logo es un botón (en la app lleva al Panel). */
export function Logo({ big, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  const action = onClick ? { type: 'button', onClick, title: t('Ir al Panel'), 'aria-label': 'Global Zion · ' + t('Ir al Panel') } : {}
  return (
    <Tag className={'logo' + (big ? ' big' : '') + (onClick ? ' logo-link' : '')} {...action}>
      <span className="logo-badge"><img src="/logo.webp" alt="Global Zion" width={big ? 56 : 30} height={big ? 56 : 30} /></span>
      <div><b>GLOBAL ZION</b><small>SOCIAL MANAGER</small></div>
    </Tag>
  )
}

export function ThemeToggle({ className = '' }) {
  useLang()
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const d = !dark
    const root = document.documentElement
    // Transición suave de colores en toda la app mientras cambia el tema
    root.classList.add('theming')
    clearTimeout(window.__gzThemeT)
    window.__gzThemeT = setTimeout(() => root.classList.remove('theming'), 450)
    root.classList.toggle('dark', d)
    document.documentElement.style.colorScheme = d ? 'dark' : 'light'
    try { localStorage.setItem('gz-theme', d ? 'dark' : 'light') } catch { /* ignore */ }
    setDark(d)
  }
  return (
    <button className={'theme-btn ' + className} role="switch" aria-checked={dark} onClick={toggle} title={t('Cambiar tema')}>
      <span className={'tsw' + (dark ? ' dark' : '')} aria-hidden="true">
        <Icon name="sun" size={13} /><Icon name="moon" size={13} /><i className="knob" />
      </span>
      <span className="tlabel">{dark ? t('Modo claro') : t('Modo oscuro')}</span>
    </button>
  )
}

/** Tema propio del modo cine (claro/oscuro), recordado en este navegador. Por defecto oscuro. */
export function useCineTheme() {
  const [light, setLight] = useState(() => { try { return localStorage.getItem('gz-cine-theme') === 'light' } catch { return false } })
  const toggle = () => setLight((v) => { const n = !v; try { localStorage.setItem('gz-cine-theme', n ? 'light' : 'dark') } catch { /* ignore */ } return n })
  return [light, toggle]
}

export function CineThemeSwitch({ light, onToggle }) {
  useLang()
  return (
    <button className="cine-theme" role="switch" aria-checked={!light} onClick={onToggle} title={light ? t('Modo oscuro') : t('Modo claro')} aria-label={t('Cambiar tema')}>
      <span className={'tsw' + (light ? '' : ' dark')} aria-hidden="true">
        <Icon name="sun" size={13} /><Icon name="moon" size={13} /><i className="knob" />
      </span>
    </button>
  )
}

const P = {
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',
  plus: 'M12 5v14M5 12h14',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  out: 'M9 4H5v16h4M16 8l4 4-4 4M20 12H9',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  send: 'M21 3L3 11l7 3 3 7z',
  clock: 'M12 7v5l3 2M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
  down: 'M12 4v12M7 11l5 5 5-5M5 20h14',
  up: 'M12 16V4M7 9l5-5 5 5M5 20h14',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  magic: 'M5 19L19 5M14 5h5v5M5 5v2M3 6h4M18 17v4M16 19h4',
  x: 'M6 6l12 12M18 6L6 18',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  check: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8 12.5l3 3 5-6',
  alert: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7.5v5M12 16v.5',
  draft: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  crown: 'M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  all: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
}
export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name]} />
    </svg>
  )
}

/** Avatar del usuario: foto de Google o inicial del nombre, según su preferencia (avatarMode). */
export function Avatar({ session, size = 36, mode }) {
  const [bad, setBad] = useState(false)
  const m = mode || session.avatarMode
  const photo = session.picture && m !== 'initial' && !bad
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {photo ? <img src={session.picture} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} /> : (session.name[0] || '?').toUpperCase()}
    </div>
  )
}

export function PlatformBadge({ id, small }) {
  const p = PLATFORMS[id]
  return (
    <span className={small ? 'pbadge small' : 'pbadge'} style={{ '--pc': p.color }}>
      <PlatformLogo id={id} size={small ? 16 : 22} /> {p.name}
    </span>
  )
}

export const STATUS = {
  draft: ['Borrador', 'gray'],
  scheduled: ['Programada', 'blue'],
  publishing: ['Publicando…', 'gold'],
  published: ['Publicada', 'green'],
  failed: ['Falló', 'red'],
}
export function StatusTag({ s }) {
  const [tx, c] = STATUS[s] || STATUS.draft
  return <span className={`tag ${c}`}>{t(tx)}</span>
}

export const fmtDate = (ts) =>
  new Date(ts).toLocaleString(locale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export function LangToggle({ className = '' }) {
  const { lang, setLang } = useLang()
  return (
    <div className={'seg lang ' + className} role="group" aria-label="Language">
      <button className={lang === 'es' ? 'on' : ''} onClick={() => setLang('es')}>ES</button>
      <button className={lang === 'en' ? 'on' : ''} onClick={() => setLang('en')}>EN</button>
    </div>
  )
}
