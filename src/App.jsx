import { useState } from 'react'
import { useApp } from './lib/store.jsx'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'
import Accounts from './components/Accounts.jsx'
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
]

export default function App() {
  const { session, authReady, logout, toast, storageFull, setDraft } = useApp()
  const [page, setPage] = useState('dashboard')
  useLang()

  if (!authReady) return null
  if (!session) return <><Login />{toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}</>

  const go = (p) => { if (p === 'composer') setDraft(null); setPage(p) }
  const edit = (post) => { setDraft(post); setPage('composer') }

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
        {storageFull && <div className="banner err">{t('El almacenamiento del navegador está lleno: elimina publicaciones antiguas con imágenes.')}</div>}
        {page === 'dashboard' && <Dashboard go={go} edit={edit} />}
        {page === 'composer' && <Composer onDone={() => setPage('posts')} />}
        {page === 'posts' && <Posts edit={edit} go={go} />}
        {page === 'calendar' && <Calendar edit={edit} />}
        {page === 'accounts' && <Accounts />}
      </main>
      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
