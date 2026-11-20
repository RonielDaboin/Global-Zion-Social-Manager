import { useApp } from '../lib/store.jsx'
import { t, useLang, locale } from '../lib/i18n.jsx'
import { PLATFORMS, accountLabel, EMAIL_PROVIDERS } from '../lib/formats.js'
import { Icon, PlatformLogo, StatusTag, fmtDate } from './ui.jsx'

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export default function Dashboard({ go, edit }) {
  const { session, posts, accounts } = useApp()
  useLang()
  const count = (s) => posts.filter((p) => p.status === s).length
  const scheduled = posts.filter((p) => p.status === 'scheduled').sort((a, b) => a.scheduledAt - b.scheduledAt)
  const next = scheduled.slice(0, 4)
  const connected = Object.keys(accounts).filter((id) => PLATFORMS[id])
  const missing = Object.values(PLATFORMS).filter((p) => !accounts[p.id])
  const total = Object.keys(PLATFORMS).length
  const failed = count('failed')
  const today = cap(new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long' }))

  const summary = scheduled.length
    ? t('Tienes {n} publicaciones programadas. La próxima: {d}.', { n: scheduled.length, d: fmtDate(scheduled[0].scheduledAt) })
    : t('No tienes publicaciones programadas.')

  const stats = [
    { id: 'draft', label: 'Borradores', sub: 'Sin publicar', icon: 'edit', value: count('draft'), tone: '' },
    { id: 'scheduled', label: 'Programadas', sub: 'En espera', icon: 'clock', value: scheduled.length, tone: 'blue' },
    { id: 'published', label: 'Publicadas', sub: 'Completadas', icon: 'send', value: count('published'), tone: 'green' },
  ]
  const bar = [
    ['draft', 'Borradores', count('draft')],
    ['scheduled', 'Programadas', scheduled.length],
    ['published', 'Publicadas', count('published')],
    ['failed', 'Fallidas', failed],
  ]
  const barTotal = bar.reduce((a, b) => a + b[2], 0)

  return (
    <div className="page dash">
      {/* Bienvenida */}
      <section className="hero">
        <div className="hero-txt">
          <small>{today}</small>
          <h1>{t('Hola, {name}', { name: session.name.split(' ')[0] })} 👋</h1>
          <p>{summary}</p>
          <div className="hero-act">
            <button className="btn primary" onClick={() => go('composer-new')}><Icon name="plus" size={16} /> {t('Crear publicación')}</button>
            <button className="btn ghost" onClick={() => go('calendar')}><Icon name="cal" size={16} /> {t('Calendario')}</button>
          </div>
        </div>
        <div className="hero-nets" aria-hidden="true">
          {Object.keys(PLATFORMS).map((id) => <span key={id} className={accounts[id] ? 'on' : ''}><PlatformLogo id={id} size={34} /></span>)}
        </div>
      </section>

      {failed > 0 && (
        <button className="alert" onClick={() => go('posts')}>
          <span>⚠️ {t('{n} publicaciones fallaron. Revísalas y vuelve a intentarlo.', { n: failed })}</span> <span>{t('Ver')} →</span>
        </button>
      )}

      {/* Indicadores */}
      <div className="kpis">
        {stats.map((s) => (
          <div key={s.id} className={'kpi ' + s.tone}>
            <span className="kpi-ico"><Icon name={s.icon} size={24} /></span>
            <div><small>{t(s.label)}</small><b>{s.value}</b><em>{t(s.sub)}</em></div>
          </div>
        ))}
        <div className="kpi gold">
          <span className="kpi-ico"><Icon name="link" size={24} /></span>
          <div>
            <small>{t('Cuentas conectadas')}</small><b>{connected.length}<i>/{total}</i></b>
            <div className="meter"><span style={{ width: `${(connected.length / total) * 100}%` }} /></div>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        {/* Columna principal */}
        <div className="dash-main">
          <section className="card panel">
            <header className="panel-h"><h3>{t('Estado de tus publicaciones')}</h3><small>{barTotal} {t('en total')}</small></header>
            {barTotal === 0
              ? <p className="muted">{t('Aún no hay publicaciones.')}</p>
              : (
                <>
                  <div className="stack" role="img" aria-label={t('Estado de tus publicaciones')}>
                    {bar.filter((b) => b[2]).map(([k, , n]) => <span key={k} className={'seg-' + k} style={{ flexGrow: n }} />)}
                  </div>
                  <ul className="legend">
                    {bar.map(([k, l, n]) => <li key={k}><i className={'seg-' + k} />{t(l)} <b>{n}</b></li>)}
                  </ul>
                </>
              )}
          </section>

          <section className="card panel">
            <header className="panel-h">
              <h3>{t('Próximas publicaciones')}</h3>
              {scheduled.length > 0 && <button className="link-btn" onClick={() => go('posts')}>{t('Ver todas')} →</button>}
            </header>
            {next.length === 0 ? (
              <div className="empty-in">
                <span>🗓️</span>
                <p>{t('No hay nada programado.')}</p>
                <button className="btn ghost sm" onClick={() => go('composer-new')}>{t('Crea tu primera publicación')}</button>
              </div>
            ) : (
              <ul className="up-list">
                {next.map((p) => (
                  <li key={p.id} className="up">
                    <div className="up-thumb"><img src={p.image} alt="" />{p.mediaType === 'video' && <span>▶</span>}</div>
                    <div className="up-body">
                      <p>{p.caption || <i className="muted">{t('Sin texto')}</i>}</p>
                      <div className="up-meta">
                        <span className="up-nets">{p.platforms.map((x) => <PlatformLogo key={x} id={x} size={20} />)}</span>
                        <small>📅 {fmtDate(p.scheduledAt)}</small>
                      </div>
                    </div>
                    <StatusTag s={p.status} />
                    <button className="btn ghost sm" onClick={() => edit(p)}><Icon name="edit" size={14} /> {t('Editar')}</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Columna lateral */}
        <aside className="dash-side">
          <section className="card panel">
            <header className="panel-h"><h3>{t('Tus cuentas conectadas')}</h3><button className="link-btn" onClick={() => go('accounts')}>{t('Gestionar')} →</button></header>
            {connected.length === 0
              ? <p className="muted">{t('Aún no has conectado ninguna red.')}</p>
              : (
                <ul className="acc-list">
                  {connected.map((id) => {
                    const p = PLATFORMS[id], acc = accounts[id]
                    return (
                      <li key={id} className="acc-row">
                        <PlatformLogo id={id} size={38} />
                        <div>
                          <b>{accountLabel(p, acc)}</b>
                          <small>{p.name}{acc.provider ? ' · ' + EMAIL_PROVIDERS.find((e) => e.id === acc.provider)?.name : ''}{acc.demo ? ' · ' + t('modo demo') : ''}</small>
                        </div>
                        <span className="live" title={t('Conectada')} />
                      </li>
                    )
                  })}
                </ul>
              )}
            {missing.length > 0 && (
              <div className="pending">
                <small>{t('Pendientes de conectar')}</small>
                <div>
                  {missing.map((p) => (
                    <button key={p.id} className="pend" onClick={() => go('accounts')} title={p.name}><PlatformLogo id={p.id} size={26} /></button>
                  ))}
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
