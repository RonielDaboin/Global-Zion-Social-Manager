// Dictado por voz con el reconocimiento que trae el navegador (gratis, sin API propia). Chrome y Edge envían el audio
// a los servidores de su proveedor para convertirlo en texto; Safari usa el de Apple. Firefox no lo admite.
import { useEffect, useRef, useState } from 'react'
import { t, getLang } from './i18n.jsx'

const Recognition = () => (typeof window === 'undefined' ? null : window.SpeechRecognition || window.webkitSpeechRecognition || null)

const ERRORS = {
  'not-allowed': 'No hay permiso para usar el micrófono. Actívalo en el candado de la barra de direcciones y vuelve a intentarlo.',
  'service-not-allowed': 'Este navegador no permite el reconocimiento de voz. Prueba con Chrome o Edge.',
  'audio-capture': 'No se encontró un micrófono.',
  'no-speech': 'No escuché nada. Acércate al micrófono y vuelve a intentarlo.',
  network: 'El reconocimiento de voz necesita internet y no respondió. Intenta de nuevo.',
  'language-not-supported': 'El navegador no reconoce voz en este idioma.',
}

/**
 * `onText(texto)` recibe lo reconocido mientras se habla; `onDone(texto)` al terminar (tras una pausa o al detener);
 * `onError(mensaje)` explica por qué no se pudo. Devuelve { supported, listening, start, stop, cancel }.
 */
export function useSpeech({ onText, onDone, onError }) {
  const [listening, setListening] = useState(false)
  const current = useRef(null)
  const handlers = useRef({})
  handlers.current = { onText, onDone, onError } // siempre las más recientes, aunque se haya empezado a hablar antes

  /** Corta sin entregar el resultado. */
  const cancel = () => {
    const r = current.current
    if (!r) return
    current.current = null
    r.abort()
    setListening(false)
  }
  useEffect(() => cancel, []) // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    const Ctor = Recognition()
    if (!Ctor) return handlers.current.onError(t('Este navegador no permite dictar por voz. Usa Chrome, Edge o Safari.'))
    if (current.current) return undefined
    const r = new Ctor()
    r.lang = getLang() === 'en' ? 'en-US' : 'es-CL'
    r.interimResults = true
    r.continuous = false // se detiene solo cuando haces una pausa
    let heard = ''
    r.onresult = (e) => {
      if (current.current !== r) return
      heard = Array.from(e.results, (x) => x[0].transcript).join('').trim()
      handlers.current.onText(heard)
    }
    r.onerror = (e) => {
      if (current.current !== r || e.error === 'aborted') return
      heard = ''
      handlers.current.onError(t(ERRORS[e.error] || 'No se pudo reconocer la voz. Intenta de nuevo.'))
    }
    r.onend = () => {
      if (current.current !== r) return
      current.current = null
      setListening(false)
      if (heard) handlers.current.onDone(heard)
    }
    current.current = r
    try {
      r.start()
      setListening(true)
    } catch {
      current.current = null
      handlers.current.onError(t('No se pudo reconocer la voz. Intenta de nuevo.'))
    }
    return undefined
  }

  return { supported: !!Recognition(), listening, start, stop: () => current.current?.stop(), cancel }
}
