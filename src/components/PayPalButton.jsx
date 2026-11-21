import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { PAYPAL } from '../lib/plans.js'
import { t } from '../lib/i18n.jsx'

// El SDK de PayPal se carga una sola vez, solo cuando se abre el modal de planes
let sdk
const loadSdk = () => sdk || (sdk = new Promise((res, rej) => {
  if (window.paypal?.Buttons) return res(window.paypal)
  const s = document.createElement('script')
  s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(PAYPAL.clientId)}&vault=true&intent=subscription&currency=USD`
  s.onload = () => (window.paypal?.Buttons ? res(window.paypal) : rej(new Error('PayPal no cargó')))
  s.onerror = () => { sdk = null; rej(new Error('No se pudo cargar PayPal')) }
  document.head.appendChild(s)
}))

/** Botón de suscripción mensual de PayPal para un plan. Al aprobar, el servidor verifica el pago y activa el plan. */
export default function PayPalButton({ planId, userId, onDone, onError }) {
  const box = useRef(null)
  const [state, setState] = useState('loading') // loading | ready | busy | error
  const cb = useRef({ onDone, onError }); cb.current = { onDone, onError }

  useEffect(() => {
    let buttons, dead = false
    loadSdk().then((pp) => {
      if (dead || !box.current) return
      buttons = pp.Buttons({
        style: { layout: 'vertical', shape: 'pill', color: 'gold', label: 'subscribe', height: 40 },
        // custom_id enlaza la suscripción con este usuario; el servidor lo comprueba
        createSubscription: (_d, actions) => actions.subscription.create({ plan_id: PAYPAL.plans[planId], custom_id: userId }),
        onApprove: async (data) => {
          setState('busy')
          const { error } = await supabase.functions.invoke('paypal-activate', { body: { subscriptionId: data.subscriptionID } })
          if (error) {
            let msg = error.message
            try { msg = (await error.context.json()).error || msg } catch { /* ignore */ }
            setState('ready'); return cb.current.onError(msg)
          }
          await supabase.auth.refreshSession() // trae el nuevo plan en el token
          cb.current.onDone()
        },
        onError: () => cb.current.onError(t('PayPal no pudo completar el pago. No se te ha cobrado nada.')),
      })
      buttons.render(box.current).then(() => !dead && setState('ready')).catch(() => !dead && setState('error'))
    }).catch(() => !dead && setState('error'))
    return () => { dead = true; try { buttons?.close() } catch { /* ignore */ } }
  }, [planId, userId])

  return (
    <div className="pp-wrap">
      {state === 'loading' && <span className="muted small">{t('Cargando PayPal…')}</span>}
      {state === 'busy' && <span className="muted small">{t('Activando tu plan…')}</span>}
      {state === 'error' && <span className="muted small">{t('No se pudo cargar PayPal. Revisa tu conexión o desactiva el bloqueador de anuncios.')}</span>}
      <div ref={box} className="pp-box" style={{ display: state === 'busy' || state === 'error' ? 'none' : undefined }} />
      {state === 'ready' && <span className="pp-secure">🔒 {t('Pago seguro con PayPal · cancela cuando quieras')}</span>}
    </div>
  )
}
