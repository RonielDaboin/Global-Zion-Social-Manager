import { useState } from 'react'
import { PLATFORMS } from '../lib/formats.js'
import { t, useLang, locale } from '../lib/i18n.jsx'

export function Logo({ big }) {
  return (
    <div className={big ? 'logo big' : 'logo'}>
      <span className="logo-badge"><img src="/logo.webp" alt="Global Zion" width={big ? 56 : 30} height={big ? 56 : 30} /></span>
      <div><b>GLOBAL ZION</b><small>SOCIAL MANAGER</small></div>
    </div>
  )
}

export function ThemeToggle({ className = '' }) {
  useLang()
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const d = !dark
    document.documentElement.classList.toggle('dark', d)
    document.documentElement.style.colorScheme = d ? 'dark' : 'light'
    try { localStorage.setItem('gz-theme', d ? 'dark' : 'light') } catch { /* ignore */ }
    setDark(d)
  }
  return (
    <button className={'theme-btn ' + className} onClick={toggle} title={t('Cambiar tema')}>
      <Icon name={dark ? 'sun' : 'moon'} size={16} /> <span>{dark ? t('Modo claro') : t('Modo oscuro')}</span>
    </button>
  )
}

const P = {
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
}
export function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={P[name]} />
    </svg>
  )
}

export function PlatformBadge({ id, small }) {
  const p = PLATFORMS[id]
  return (
    <span className={small ? 'pbadge small' : 'pbadge'} style={{ '--pc': p.color }}>
      <i /> {p.name}
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
