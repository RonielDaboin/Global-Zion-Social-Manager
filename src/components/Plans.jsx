import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../lib/store.jsx'
import { t, useLang } from '../lib/i18n.jsx'
import { PLAN_LIST, COMPARE } from '../lib/plans.js'
import { Icon } from './ui.jsx'

const Cell = ({ v }) => (v === true ? <Icon name="check" size={16} /> : v === false ? <span className="pl-no">—</span> : <span>{t(v)}</span>)

/** Ventana con los tres planes y la tabla comparativa. Se abre desde el login, el perfil o al tocar algo bloqueado. */
export default function PlansModal() {
  const { plansHint, closePlans, session, access } = useApp()
  useLang()
  const open = plansHint !== null
  useEffect(() => {
    if (!open) return
    const k = (e) => e.key === 'Escape' && closePlans()
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = prev }
  }, [open, closePlans])
  if (!open) return null
  const cur = session ? access.plan.id : null

  return createPortal(
    <div className="modal-bg plans-bg" onClick={closePlans}>
      <div className="plans" role="dialog" aria-modal="true" aria-label={t('Planes')} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn plans-x" aria-label={t('Cerrar')} onClick={closePlans}>✕</button>
        <h2>{t('Elige tu plan')}</h2>
        <p className="muted">{t('Empieza con Básico y sube de plan cuando necesites más redes, programación o herramientas de IA.')}</p>
        {plansHint && <p className="plans-hint"><Icon name="lock" size={15} /> {plansHint}</p>}

        <div className="plan-cards">
          {PLAN_LIST.map((p) => (
            <div key={p.id} className={`plan-card ${p.tone}` + (p.id === cur ? ' cur' : '') + (p.id === 'pro_plus' ? ' best' : '')}>
              {p.id === 'pro_plus' && <span className="plan-ribbon">{t('Más completo')}</span>}
              <h3><Icon name={p.id === 'basic' ? 'home' : p.id === 'pro' ? 'star' : 'crown'} size={20} /> {t(p.name)}</h3>
              <p className="muted small">{t(p.tagline)}</p>
              <ul>{p.perks.map((k) => <li key={k}><Icon name="check" size={15} /> <span>{t(k)}</span></li>)}</ul>
              {p.id === cur && <span className="plan-cur">{t('Tu plan actual')}</span>}
            </div>
          ))}
        </div>

        <h3 className="plans-sub">{t('Comparativa')}</h3>
        <div className="plan-table-wrap">
          <table className="plan-table">
            <thead><tr><th /><th>{t(PLAN_LIST[0].name)}</th><th>{PLAN_LIST[1].name}</th><th className="gold">{PLAN_LIST[2].name}</th></tr></thead>
            <tbody>
              {COMPARE.map(([label, ...vals]) => (
                <tr key={label}><th scope="row">{t(label)}</th>{vals.map((v, i) => <td key={i}><Cell v={v} /></td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small plans-note">{t('Para cambiar de plan escríbenos y activaremos tu cuenta.')}</p>
        <button className="btn primary wide" onClick={closePlans}>{session ? t('Cerrar') : t('Entendido')}</button>
      </div>
    </div>,
    document.body,
  )
}

/** Candado pequeño para etiquetar botones bloqueados por el plan. */
export const LockTag = ({ plan }) => <span className="lock-tag"><Icon name="lock" size={11} /> {plan}</span>
