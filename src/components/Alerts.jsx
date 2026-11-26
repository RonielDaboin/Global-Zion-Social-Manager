import { useEffect, useState } from 'react'
import { useApp } from '../lib/store.jsx'
import { t, useLang } from '../lib/i18n.jsx'
import { pushState, enablePush, disablePush, testPush } from '../lib/push.js'

const LATER_KEY = 'gz-push-later'
const IOS_HINT = 'En iPhone primero agrega la app a la pantalla de inicio: en Safari toca Compartir → «Añadir a pantalla de inicio», ábrela desde ese icono y activa las alertas.'

function useAlerts() {
  const { notify } = useApp()
  useLang()
  const [state, setState] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { pushState().then(setState) }, [])
  const act = async (fn, ok) => {
    setBusy(true)
    try { await fn(); notify(t(ok)) } catch (e) { notify(t('No se pudieron activar las alertas:') + ' ' + e.message, 'err') }
    setState(await pushState())
    setBusy(false)
  }
  return { state, busy, act, enable: () => act(enablePush, 'Alertas activadas en este dispositivo.') }
}

/** Aviso en el panel para activar las alertas en este dispositivo (se puede posponer). */
export function AlertsBanner() {
  const { state, busy, enable } = useAlerts()
  const [later, setLater] = useState(() => { try { return !!localStorage.getItem(LATER_KEY) } catch { return false } })
  if (later || (state !== 'off' && state !== 'ios-install')) return null
  const dismiss = () => { try { localStorage.setItem(LATER_KEY, '1') } catch { /* ignore */ } setLater(true) }
  return (
    <div className="banner trial">
      <span>🔔 {t(state === 'off' ? 'Activa las alertas para saber cuándo se publica o se cancela una publicación.' : IOS_HINT)}</span>
      <span className="row">
        {state === 'off' && <button type="button" className="btn primary sm" disabled={busy} onClick={enable}>{t('Activar alertas')}</button>}
        <button type="button" className="btn ghost sm" onClick={dismiss}>{t('Ahora no')}</button>
      </span>
    </div>
  )
}

/** Ajuste de alertas en el perfil. */
export function AlertsCard() {
  const { state, busy, act, enable } = useAlerts()
  return (
    <div className="card">
      <div className="pf-title">
        <h3>🔔 {t('Alertas de publicación')}</h3>
        {state === 'on' && <span className="pf-badge ok">{t('Activadas en este dispositivo')}</span>}
      </div>
      <p className="muted small">{t('Recibe un aviso en este dispositivo cuando una publicación se publique, falle o se cancele, aunque la app esté cerrada.')} {t('Actívalas en cada teléfono y computadora donde quieras recibirlas.')}</p>
      {state === 'ios-install' && <p className="warn">📲 {t(IOS_HINT)}</p>}
      {state === 'blocked' && <p className="warn">⚠️ {t('Las notificaciones están bloqueadas. Permítelas en los ajustes del navegador o del teléfono para este sitio.')}</p>}
      {state === 'unsupported' && <p className="warn">⚠️ {t('Este navegador no admite notificaciones.')}</p>}
      <div className="row" style={{ flexWrap: 'wrap' }}>
        {state === 'off' && <button type="button" className="btn primary" disabled={busy} onClick={enable}>{t('Activar alertas')}</button>}
        {state === 'on' && <>
          <button type="button" className="btn primary" disabled={busy} onClick={() => act(testPush, 'Alerta de prueba enviada: debería aparecer en unos segundos.')}>{t('Enviar alerta de prueba')}</button>
          <button type="button" className="btn ghost" disabled={busy} onClick={() => act(disablePush, 'Alertas desactivadas en este dispositivo.')}>{t('Desactivar')}</button>
        </>}
      </div>
    </div>
  )
}
