import { useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { t, useLang, locale } from '../lib/i18n.jsx'
import { Icon } from './ui.jsx'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export default function Calendar({ edit }) {
  const { posts } = useApp()
  useLang()
  const [cur, setCur] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const y = cur.getFullYear(), m = cur.getMonth()
  const first = (new Date(y, m, 1).getDay() + 6) % 7
  const dim = new Date(y, m + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((first + dim) / 7) * 7 }, (_, i) => i - first + 1)
  const when = (p) => p.scheduledAt || p.publishedAt || p.createdAt
  const forDay = (d) => posts.filter((p) => { const t = new Date(when(p)); return t.getFullYear() === y && t.getMonth() === m && t.getDate() === d })
  const today = new Date()

  return (
    <div className="page">
      <header className="ph row between">
        <div><h1>{t('Calendario')}</h1><p>{t('Visualiza lo programado y lo publicado.')}</p></div>
        <div className="row">
          <button className="btn ghost sm" onClick={() => setCur(new Date(y, m - 1, 1))}>‹</button>
          <b className="month">{cur.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}</b>
          <button className="btn ghost sm" onClick={() => setCur(new Date(y, m + 1, 1))}>›</button>
        </div>
      </header>
      <div className="cal">
        {DAYS.map((d) => <div key={d} className="cal-h">{t(d)}</div>)}
        {cells.map((d, i) => {
          const ok = d >= 1 && d <= dim
          const ps = ok ? forDay(d) : []
          const isToday = ok && today.getFullYear() === y && today.getMonth() === m && today.getDate() === d
          return (
            <div key={i} className={'cal-c' + (ok ? '' : ' off') + (isToday ? ' today' : '')}>
              {ok && <span className="dn">{d}</span>}
              {ps.map((p) => (
                <button key={p.id} className={'cal-p ' + p.status} onClick={() => p.status !== 'published' && edit(p)} title={p.caption}>
                  <img src={p.image} alt="" />
                  <span>{new Date(when(p)).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}</span>
                </button>
              ))}
            </div>
          )
        })}
      </div>
      <p className="hint"><Icon name="clock" size={14} /> {t('Las publicaciones programadas se envían automáticamente mientras esta ventana esté abierta (en modo real, usa un backend con cron).')}</p>
    </div>
  )
}
