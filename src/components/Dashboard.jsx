import { useApp } from '../lib/store.jsx'
import { t, useLang } from '../lib/i18n.jsx'
import { PLATFORMS } from '../lib/formats.js'
import { Icon } from './ui.jsx'
import { PostCard } from './Posts.jsx'

export default function Dashboard({ go, edit }) {
  const { session, posts, accounts } = useApp()
  useLang()
  const count = (s) => posts.filter((p) => p.status === s).length
  const next = posts.filter((p) => p.status === 'scheduled').sort((a, b) => a.scheduledAt - b.scheduledAt).slice(0, 3)
  const connected = Object.keys(accounts)

  return (
    <div className="page">
      <header className="ph row between">
        <div><h1>{t('Hola, {name}', { name: session.name.split(' ')[0] })} 👋</h1><p>{t('Este es el resumen de tu gestor de redes.')}</p></div>
        <button className="btn primary" onClick={() => go('composer')}><Icon name="plus" size={16} /> {t('Crear publicación')}</button>
      </header>

      <div className="stats">
        <div className="stat"><small>{t('Borradores')}</small><b>{count('draft')}</b></div>
        <div className="stat blue"><small>{t('Programadas')}</small><b>{count('scheduled')}</b></div>
        <div className="stat green"><small>{t('Publicadas')}</small><b>{count('published')}</b></div>
        <div className="stat gold"><small>{t('Cuentas conectadas')}</small><b>{connected.length}/{Object.keys(PLATFORMS).length}</b></div>
      </div>

      {connected.length < Object.keys(PLATFORMS).length && (
        <div className="card cta">
          <div>
            <h3>{t('Conecta tus redes')}</h3>
            <p>{connected.length === 0 ? t('Aún no has conectado ninguna red.') : t('Falta {p}.', { p: Object.values(PLATFORMS).filter((p) => !accounts[p.id]).map((p) => p.name).join(', ') })}</p>
          </div>
          <button className="btn ghost" onClick={() => go('accounts')}>{t('Ir a Cuentas')}</button>
        </div>
      )}

      <h3 className="sec">{t('Próximas publicaciones')}</h3>
      {next.length === 0
        ? <div className="empty card">{t('No hay nada programado.')} <a href="#" onClick={(e) => { e.preventDefault(); go('composer') }}>{t('Crea tu primera publicación')}</a>.</div>
        : <div className="post-grid">{next.map((p) => <PostCard key={p.id} p={p} edit={edit} />)}</div>}
    </div>
  )
}
