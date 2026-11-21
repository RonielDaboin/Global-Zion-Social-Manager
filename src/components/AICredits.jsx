import { useCallback, useEffect, useState } from 'react'
import { t, useLang } from '../lib/i18n.jsx'
import { PROVIDERS, dayStart, getExtra, getLimit, loadSnapshots, loadUsage, setExtra as setExtraLS, setLimit } from '../lib/aiUsage.js'

/** Cuotas por modelo copiadas de AI Studio («Límite de frecuencia»). Se sincronizan a pedido, no en tiempo real. */
function SnapRows({ snap, appUsed, since }) {
  // Peticiones hechas desde esta app después de la última lectura de AI Studio: se descuentan por orden de prioridad (la app usa primero el mejor modelo y pasa al siguiente al agotarse).
  let rest = since
  const models = snap.data.models.map((m) => {
    if (!m.app || rest <= 0) return m
    const free = Math.max(0, m.rpd[1] - m.rpd[0])
    const take = Math.min(free, rest)
    rest -= take
    return take ? { ...m, rpd: [m.rpd[0] + take, m.rpd[1]] } : m
  })
  const left = (m) => Math.max(0, m.rpd[1] - m.rpd[0])
  const mine = models.filter((m) => m.app)
  const others = models.filter((m) => !m.app)
  const total = mine.reduce((a, m) => a + left(m), 0)
  const ageH = (Date.now() - new Date(snap.taken_at).getTime()) / 3600e3
  const Row = ({ m }) => {
    const pct = m.rpd[1] ? Math.min(100, Math.round((m.rpd[0] / m.rpd[1]) * 100)) : 100
    const level = pct >= 100 ? 'bad' : pct >= 65 ? 'mid' : 'ok'
    return (
      <div className="ai-row">
        <div className="row between"><span className="small">{m.name}</span><b className="small">{pct >= 100 ? t('Agotado') : left(m)}<span className="muted"> / {m.rpd[1]}</span></b></div>
        <div className={'ai-bar ' + level}><i style={{ width: 100 - pct + '%' }} /></div>
      </div>
    )
  }
  return (
    <>
      <div className="ai-big"><b>{total > 0 ? total : t('Agotado')}</b> <span>{total > 0 ? t('peticiones restantes hoy') : t('hoy')}</span></div>
      <p className="muted small">{t('Suma de los modelos que usa la app (peticiones por día).')}</p>
      {mine.map((m) => <Row key={m.name} m={m} />)}
      <details className="ai-more">
        <summary>{t('Otros modelos gratuitos')} ({others.length})</summary>
        {others.map((m) => <Row key={m.name} m={m} />)}
      </details>
      <p className="muted small">{t('Desde esta app hoy')}: <b>{appUsed}</b> {t('peticiones')}</p>
      {since > 0 && <p className="muted small">{t('Incluye {n} peticiones hechas desde esta app después de la última sincronización (estimado).', { n: since })}</p>}
      <p className={ageH > 12 ? 'warn' : 'muted small'}>
        {ageH > 12 ? '⚠️ ' : '✅ '}{t('Sincronizado con AI Studio')}: {new Date(snap.taken_at).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
        {ageH > 12 ? ' · ' + t('puede estar desactualizado: pide a Claude que lo sincronice.') : ''}
      </p>
    </>
  )
}

function Card({ p, rows, snap }) {
  const sinceSnap = snap ? rows.filter((r) => r.provider === 'gemini' && r.status === 'ok' && r.kind !== 'Imágenes' && new Date(r.created_at) > new Date(snap.taken_at)).length : 0
  const [limit, setLim] = useState(() => getLimit(p))
  const start = dayStart(p.tz)
  const [extra, setExtra] = useState(() => getExtra(p, start)) // usadas hoy que la app no vio (antes del registro u otros usos)
  const today = rows.filter((r) => r.provider === p.id && new Date(r.created_at).getTime() >= start)
  const logged = today.filter((r) => r.status === 'ok').length
  const used = logged + extra
  const limited = today.filter((r) => r.status === 'limit').length
  const kinds = {}
  today.filter((r) => r.status === 'ok').forEach((r) => { kinds[r.kind || '—'] = (kinds[r.kind || '—'] || 0) + 1 })
  const exhausted = limited > 0 || (limit ? used >= limit : false)
  const left = limit ? (exhausted ? 0 : Math.max(0, limit - used)) : null
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const level = exhausted || pct >= 90 ? 'bad' : pct >= 65 ? 'mid' : 'ok'
  const useSnap = p.id === 'gemini' && snap?.data?.models?.length > 0
  const reset = new Date(start + 86400e3).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const edit = (v) => {
    const n = v === '' ? null : Math.max(0, Math.round(+v))
    setLim(n); setLimit(p, n)
  }

  return (
    <div className="card ai-card">
      <h3>{p.name}</h3>
      {useSnap ? <SnapRows snap={snap} appUsed={logged} since={sinceSnap} /> : (<>
      {limit ? (
        <>
          <div className="ai-big"><b>{exhausted ? t('Agotado') : left}</b> <span>{exhausted ? t('hoy') : `${t(p.unit)} ${t('restantes hoy')}`}</span></div>
          <div className={'ai-bar ' + level} role="progressbar" aria-label={t('Restante')} aria-valuenow={100 - pct} aria-valuemin="0" aria-valuemax="100"><i style={{ width: (exhausted ? 0 : 100 - pct) + '%' }} /></div>
          <p className="muted small">{t('Usadas hoy')}: <b>{used}</b> / {limit}</p>
        </>
      ) : (
        <div className="ai-big"><b>{used}</b> <span>{t(p.unit)} {t('usadas hoy')}</span></div>
      )}
      {limited > 0 && <p className="warn">⚠️ {t('El proveedor avisó de límite alcanzado {n} vez/veces hoy.', { n: limited })}</p>}
      {Object.keys(kinds).length > 0 && (
        <ul className="limits">{Object.entries(kinds).map(([k, n]) => <li key={k}>{t(k)}: <b>{n}</b></li>)}</ul>
      )}
      <label className="inl">{t('Límite diario')} ({t(p.unit)})
        <input type="number" min="0" value={limit ?? ''} placeholder={t('Sin límite')} onChange={(e) => edit(e.target.value)} />
      </label>
      <label className="inl">{t('Ya usadas hoy antes del registro')}
        <input type="number" min="0" value={extra || ''} placeholder="0" onChange={(e) => { const n = Math.max(0, Math.round(+e.target.value || 0)); setExtra(n); setExtraLS(p, start, n) }} />
      </label>
      </>)}
      <p className="muted small">{t(p.note)}</p>
      <p className="muted small">{t('Próximo reinicio')}: {reset}</p>
      <a className="btn ghost sm" href={p.link} target="_blank" rel="noreferrer">{t('Ver saldo oficial')} ↗</a>
    </div>
  )
}

export default function AICredits() {
  useLang()
  const [rows, setRows] = useState(null)
  const [err, setErr] = useState('')
  const [snaps, setSnaps] = useState({})
  const [busy, setBusy] = useState(false)
  const [at, setAt] = useState(null)
  const load = useCallback(async () => {
    setErr(''); setBusy(true)
    const [u, sn] = await Promise.allSettled([loadUsage(), loadSnapshots()])
    if (u.status === 'fulfilled') setRows(u.value); else setErr(u.reason?.message || 'error')
    if (sn.status === 'fulfilled') setSnaps(sn.value)
    setAt(new Date()); setBusy(false)
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className="page cred">
      <header className="ph row between">
        <div><h1>{t('Créditos IA')}</h1><p>{t('Una estimación de lo que te queda hoy en cada proveedor gratuito.')}</p></div>
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          {at && !busy && <span className="muted small">{t('Actualizado')} {at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
          <button className="btn ghost sm" onClick={load} disabled={busy}>{busy ? t('Actualizando…') : t('Actualizar')}</button>
        </div>
      </header>
      {err && <div className="banner err">{t('No se pudo leer el registro de uso. ¿Aplicaste la migración ai_usage?')} ({err})</div>}
      <div className="ai-grid">
        {PROVIDERS.map((p) => <Card key={p.id} p={p} rows={rows || []} snap={snaps[p.id]} />)}
      </div>
      <p className="muted small">{t('Los números salen de las llamadas hechas desde esta app: son una estimación. Los proveedores no entregan el saldo exacto por API; usa «Ver saldo oficial» para confirmarlo.')}</p>
    </div>
  )
}
