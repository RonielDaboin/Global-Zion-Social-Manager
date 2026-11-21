import { useState, useEffect } from 'react'
import { useApp } from './lib/store.jsx'
import { paypalReady } from './lib/plans.js'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import Accounts from './components/Accounts.jsx'
import AICredits from './components/AICredits.jsx'
import Composer from './components/Composer.jsx'
import Posts from './components/Posts.jsx'
import Calendar from './components/Calendar.jsx'
import { useUsageTime } from './lib/useTime.js'
import Profile from './components/Profile.jsx'
import PlansModal from './components/Plans.jsx'
import Legal, { Footer } from './components/Legal.jsx'
import { useLang, t } from './lib/i18n.jsx'
import { Logo, Icon, ThemeToggle, LangToggle, Avatar } from './components/ui.jsx'

const NAV = [
  { id: 'dashboard', label: 'Panel', icon: 'home' },
  { id: 'composer', label: 'Crear publicación', icon: 'plus' },
  { id: 'posts', label: 'Publicaciones', icon: 'grid' },
  { id: 'calendar', label: 'Calendario', icon: 'cal' },
  { id: 'accounts', label: 'Cuentas', icon: 'link' },
  { id: 'credits', label: 'Créditos IA', icon: 'magic' },
]

const SLUG = { dashboard: 'dashboard', composer: 'create-post', posts: 'posts', calendar: 'calendar', accounts: 'accounts', credits: 'ai-credits', profile: 'profile' }
const PAGE_BY_SLUG = Object.fromEntries(Object.entries(SLUG).map(([k, v]) => [v, k]))

// Páginas públicas (se ven sin iniciar sesión; Meta y Google exigen una URL pública de privacidad)
const LEGAL = { privacy: 'privacy', terms: 'terms' }
const legalFromHash = () => LEGAL[window.location.hash.replace(/^#\/?/, '').split('/')[0]] || null

function PlanBadge({ access, onClick, className = '' }) {
  if (access.plan.id === 'basic') return null
  return (
    <button className={`plan-badge ${access.plan.tone} ${className}`} onClick={onClick} title={`${t('Tu plan')}: ${access.plan.name}`}>
      <Icon name={access.role.id === 'owner' ? 'crown' : 'star'} size={13} />
      <b>{access.plan.name.toUpperCase()}</b>
      {access.role.id === 'owner' && <small>{t('Dueño')}</small>}
    </button>
  )
}

export default function App() {
  const [legal, setLegal] = useState(legalFromHash)
  useEffect(() => {
    const on = () => { setLegal(legalFromHash()); window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const { session, authReady, logout, toast, storageFull, setDraft, draft, access: acc0, openPlans } = useApp()
  // La sección actual se refleja en la URL (#/create-post) y se puede abrir/compartir directamente
  const [page, setPageRaw] = useState(() => {
    const fromHash = PAGE_BY_SLUG[window.location.hash.replace(/^#\/?/, '').split('/')[0]]
    if (fromHash) return fromHash
    try { return sessionStorage.getItem('gz_page') || 'dashboard' } catch { return 'dashboard' }
  })
  const setPage = (p) => {
    try { sessionStorage.setItem('gz_page', p) } catch { /* ignore */ }
    setPageRaw(p)
    const h = '#/' + (SLUG[p] || p)
    if (!window.location.hash.startsWith(h)) window.location.hash = h
  }
  useEffect(() => {
    const sync = () => { const p = PAGE_BY_SLUG[window.location.hash.replace(/^#\/?/, '').split('/')[0]]; if (p) setPageRaw(p) }
    sync()
    if (!window.location.hash) window.history.replaceState(null, '', '#/' + (SLUG[page] || page))
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, []) // eslint-disable-line
  const [composerKey, setComposerKey] = useState(0)
  const [askOut, setAskOut] = useState(false)
  useLang()
  useUsageTime(session?.id)

  if (legal) return <Legal doc={legal} />
  if (!authReady) return null
  if (!session) return <><Login /><PlansModal />{toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}</>

  const access = acc0
  const go = (p) => {
    // 'composer-new' empieza una publicación nueva; 'composer' (menú lateral) retoma el trabajo en curso
    if (p === 'composer-new') { try { sessionStorage.removeItem('gz_edit') } catch { /* ignore */ } setDraft(null); setPage('composer') } else setPage(p)
  }
  const edit = (post) => { try { sessionStorage.setItem('gz_edit', post.id) } catch { /* ignore */ } setDraft(post); setPage('composer') }

  return (
    <div className="shell">
      <aside className="side">
        <Logo />
        <PlanBadge access={access} onClick={() => go('profile')} className="side-plan" />
        <nav>
          {NAV.filter((n) => n.id !== 'credits' || access.role.id === 'owner').map((n) => (
            <button key={n.id} className={page === n.id ? 'nav on' : 'nav'} onClick={() => go(n.id)}>
              <Icon name={n.icon} /> <span>{t(n.label)}</span>
            </button>
          ))}
        </nav>
        <LangToggle className="side-lang" />
        <ThemeToggle />
        <div className="user">
          <button className={'user-link' + (page === 'profile' ? ' on' : '')} title={t('Mi perfil')} onClick={() => go('profile')}>
          <span className="u-av"><Avatar session={session} /><i className="u-dot" /></span>
          <div className="uinfo">
            <b>{session.name}{access.plan.id !== 'basic' && <em className={'u-plan ' + access.plan.tone}>{access.plan.id === 'pro_plus' ? 'PRO+' : access.plan.name.toUpperCase()}</em>}</b>
            <small>{access.role.id !== 'user' ? t(access.role.name) : session.email}</small>
          </div>
          <span className="u-chev" aria-hidden="true">›</span>
          </button>
          <button className="icon-btn u-out" title={t('Cerrar sesión')} aria-label={t('Cerrar sesión')} onClick={() => setAskOut(true)}><Icon name="out" /></button>
        </div>
      </aside>
      <main className="main">
        <div className="mbar">
          <div className="mbar-logo"><Logo /><PlanBadge access={access} onClick={() => go('profile')} /></div>
          <div className="mbar-act">
            <LangToggle />
            <ThemeToggle />
            <button className="icon-btn mbar-avatar" title={t('Mi perfil')} aria-label={t('Mi perfil')} onClick={() => go('profile')}>
              <Avatar session={session} size={34} />
            </button>
            <button className="icon-btn" title={t('Cerrar sesión')} aria-label={t('Cerrar sesión')} onClick={() => setAskOut(true)}><Icon name="out" /></button>
          </div>
        </div>
        {paypalReady && access.onTrial && !access.expired && (
          <div className="banner trial">
            <span>{t('Prueba gratuita: te quedan {n} días.', { n: access.trialDaysLeft })}</span>
            <button type="button" className="btn primary sm" onClick={() => openPlans()}>{t('Suscribirme')}</button>
          </div>
        )}
        {storageFull && <div className="banner err">{t('El almacenamiento del navegador está lleno: elimina publicaciones antiguas con imágenes.')}</div>}
        {page === 'dashboard' && <Dashboard go={go} edit={edit} />}
        {page === 'composer' && <Composer key={composerKey + ':' + (draft?.id || '')} onDone={() => setPage('posts')} onDiscard={() => setComposerKey((k) => k + 1)} />}
        {page === 'posts' && <Posts edit={edit} go={go} />}
        {page === 'calendar' && <Calendar edit={edit} />}
        {page === 'accounts' && <Accounts />}
        {page === 'credits' && access.role.id === 'owner' && <AICredits />}
        {page === 'profile' && <Profile onLogout={() => setAskOut(true)} />}
        <Footer />
      </main>
      <PlansModal />
      {askOut && (
        <div className="modal-bg" onClick={() => setAskOut(false)}>
          <div className="modal" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{t('¿Estás seguro de cerrar sesión?')}</h3>
            <p className="muted">{t('Tendrás que iniciar sesión de nuevo para volver a usar la app.')}</p>
            <button className="btn danger" autoFocus onClick={() => { setAskOut(false); logout() }}><Icon name="out" /> {t('Cerrar sesión')}</button>
            <button className="btn ghost" onClick={() => setAskOut(false)}>{t('Cancelar')}</button>
          </div>
        </div>
      )}
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
