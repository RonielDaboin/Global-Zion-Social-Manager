import { useState, useEffect } from 'react'
import { useApp } from './lib/store.jsx'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import Accounts from './components/Accounts.jsx'
import AICredits from './components/AICredits.jsx'
import Composer from './components/Composer.jsx'
import Posts from './components/Posts.jsx'
import Calendar from './components/Calendar.jsx'
import { useLang, t } from './lib/i18n.jsx'
import { Logo, Icon, ThemeToggle, LangToggle } from './components/ui.jsx'

const NAV = [
  { id: 'dashboard', label: 'Panel', icon: 'home' },
  { id: 'composer', label: 'Crear publicación', icon: 'plus' },
  { id: 'posts', label: 'Publicaciones', icon: 'grid' },
  { id: 'calendar', label: 'Calendario', icon: 'cal' },
  { id: 'accounts', label: 'Cuentas', icon: 'link' },
  { id: 'credits', label: 'Créditos IA', icon: 'magic' },
]

const SLUG = { dashboard: 'dashboard', composer: 'create-post', posts: 'posts', calendar: 'calendar', accounts: 'accounts', credits: 'ai-credits' }
const PAGE_BY_SLUG = Object.fromEntries(Object.entries(SLUG).map(([k, v]) => [v, k]))

export default function App() {
  const { session, authReady, logout, toast, storageFull, setDraft, draft } = useApp()
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
  useLang()

  if (!authReady) return null
  if (!session) return <><Login />{toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}</>

  const go = (p) => {
    // 'composer-new' empieza una publicación nueva; 'composer' (menú lateral) retoma el trabajo en curso
    if (p === 'composer-new') { try { sessionStorage.removeItem('gz_edit') } catch { /* ignore */ } setDraft(null); setPage('composer') } else setPage(p)
  }
  const edit = (post) => { try { sessionStorage.setItem('gz_edit', post.id) } catch { /* ignore */ } setDraft(post); setPage('composer') }

  return (
    <div className="shell">
      <aside className="side">
        <Logo />
        <nav>
          {NAV.map((n) => (
            <button key={n.id} className={page === n.id ? 'nav on' : 'nav'} onClick={() => go(n.id)}>
              <Icon name={n.icon} /> <span>{t(n.label)}</span>
            </button>
          ))}
        </nav>
        <LangToggle className="side-lang" />
        <ThemeToggle />
        <div className="user">
          <div className="avatar">{session.picture ? <img src={session.picture} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none' }} /> : session.name[0]?.toUpperCase()}</div>
          <div className="uinfo"><b>{session.name}</b><small>{session.email}</small></div>
          <button className="icon-btn" title={t('Cerrar sesión')} onClick={logout}><Icon name="out" /></button>
        </div>
      </aside>
      <main className="main">
        <div className="mbar">
          <Logo />
          <div className="mbar-act">
            <LangToggle />
            <ThemeToggle />
            <button className="icon-btn" title={t('Cerrar sesión')} aria-label={t('Cerrar sesión')} onClick={logout}><Icon name="out" /></button>
          </div>
        </div>
        {storageFull && <div className="banner err">{t('El almacenamiento del navegador está lleno: elimina publicaciones antiguas con imágenes.')}</div>}
        {page === 'dashboard' && <Dashboard go={go} edit={edit} />}
        {page === 'composer' && <Composer key={composerKey + ':' + (draft?.id || '')} onDone={() => setPage('posts')} onDiscard={() => setComposerKey((k) => k + 1)} />}
        {page === 'posts' && <Posts edit={edit} go={go} />}
        {page === 'calendar' && <Calendar edit={edit} />}
        {page === 'accounts' && <Accounts />}
        {page === 'credits' && <AICredits />}
      </main>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
