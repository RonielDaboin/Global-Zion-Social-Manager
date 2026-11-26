import { useEffect, useRef, useState } from 'react'
import { t } from '../lib/i18n.jsx'
import { shrinkImage } from '../lib/social.js'
import { useSpeech } from '../lib/useSpeech.js'

const AUTO_SEND_KEY = 'gz_voice_autosend'

// Pedidos de un toque
const QUICK = [
  ['🎨', 'Otro formato', 'Cambia a otro formato de diseño que le quede bien'],
  ['🔎', 'Fotos de la web', 'Busca fotos en la web para el fondo'],
  ['🌈', 'Otro color', 'Cambia el color del diseño por otro que combine'],
  ['🌓', 'Claro / oscuro', 'Cambia entre fondo claro y fondo oscuro'],
  ['🚀', 'Más vendedor', 'Haz el título y el texto más vendedores y con llamado a la acción'],
  ['✂️', 'Más corto', 'Acorta los puntos y el texto de la publicación'],
  ['💡', 'Dame ideas', 'Dame ideas para mejorar esta publicación, sin cambiarla todavía'],
]

const readFile = (file) => new Promise((res, rej) => {
  const r = new FileReader()
  r.onload = () => res(r.result)
  r.onerror = () => rej(r.error)
  r.readAsDataURL(file)
})

/** Fotos encontradas en la web: tocar una la pone de fondo. */
function Photos({ items, disabled, onPick }) {
  return (
    <div className="chat-photos">
      <div className="chat-photos-grid">
        {items.map((p) => (
          <button key={p.id} type="button" disabled={disabled} onClick={() => onPick(p)} title={p.title} aria-label={t('Usar como fondo') + ': ' + p.title}>
            <img src={p.thumb} alt="" loading="lazy" />
          </button>
        ))}
      </div>
      <small>{t('Toca una foto para usarla de fondo. Wikimedia Commons, licencia CC0 (uso libre).')}</small>
    </div>
  )
}

/**
 * Chat de trabajo de la publicación.
 * `onSend(texto, conversación, imagen)` aplica el pedido y devuelve { text, preview?, photos?, suggestions? }.
 * `onSearch(texto)` busca fotos en la web sin usar la IA. `onPhoto(foto)` la pone de fondo y devuelve lo mismo que onSend.
 * Si algo falla, el mensaje vuelve al cuadro de texto para reintentar.
 */
export default function PostChat({ caption, disabled, busy, onSend, onSearch, onPhoto }) {
  const [msgs, setMsgs] = useState([]) // { who: 'me' | 'ai' | 'err', text, image?, preview?, photos?, suggestions? }
  const [draft, setDraft] = useState('')
  const [ref, setRef] = useState(null) // imagen de referencia adjunta (dataURL)
  const log = useRef(null)
  const file = useRef(null)
  const off = busy || disabled
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight }, [msgs, busy])

  const add = (m) => setMsgs((l) => [...l, m])
  const fail = (err) => add({ who: 'err', text: err?.message || String(err) })

  const attach = async (f) => {
    if (!f || !f.type.startsWith('image/')) return
    try {
      const small = await shrinkImage(await readFile(f), 900)
      if (small) setRef(small); else fail(new Error(t('No se pudo leer la imagen.')))
    } catch (e) { fail(e) }
  }

  const send = async (text, image = null) => {
    if ((!text && !image) || off) return
    // Solo cuentan como conversación los pedidos que sí recibieron respuesta
    const done = msgs.flatMap((m, i) => (m.who === 'me' && msgs[i + 1]?.who === 'ai' ? [`Usuario: ${m.text}`, `Asistente: ${msgs[i + 1].text}`] : []))
    add({ who: 'me', text, image })
    try {
      add({ who: 'ai', ...(await onSend(text, done, image)) })
    } catch (err) {
      fail(err)
      setDraft(text)
      if (image) setRef(image)
    }
  }
  // Pedir por voz: lo reconocido se escribe en el cuadro (después de lo que ya hubiera)
  const [autoSend, setAutoSend] = useState(() => { try { return localStorage.getItem(AUTO_SEND_KEY) === '1' } catch { return false } })
  const toggleAutoSend = (on) => { setAutoSend(on); try { localStorage.setItem(AUTO_SEND_KEY, on ? '1' : '0') } catch { /* ignore */ } }
  const before = useRef('')
  const withVoice = (heard) => [before.current, heard].filter(Boolean).join(' ').slice(0, 1200)
  const voice = useSpeech({
    onText: (heard) => setDraft(withVoice(heard)),
    onDone: (heard) => {
      const text = withVoice(heard)
      setDraft(text)
      if (autoSend && !off) { const image = ref; setDraft(''); setRef(null); send(text, image) }
    },
    onError: (message) => fail(new Error(message)),
  })
  const talk = () => {
    if (voice.listening) return voice.stop()
    before.current = draft.trim()
    return voice.start()
  }

  const submit = (e) => {
    e?.preventDefault()
    voice.cancel() // al enviar a mano se deja de escuchar
    const text = draft.trim()
    if ((!text && !ref) || off) return
    const image = ref
    setDraft(''); setRef(null)
    send(text, image)
  }
  const find = async () => {
    const q = draft.trim()
    if (!q || off) return
    try { add({ who: 'ai', ...(await onSearch(q)) }) } catch (e) { fail(e) }
  }
  const pick = async (photo) => {
    try { add({ who: 'ai', ...(await onPhoto(photo)) }) } catch (e) { fail(e) }
  }

  const ideas = [...msgs].reverse().find((m) => m.who === 'ai' && m.suggestions?.length)?.suggestions || []

  return (
    <div className="post-chat" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); attach(e.dataTransfer.files?.[0]) }}>
      <span className="pick-tag">💬 {t('Asistente de la publicación')}</span>
      <div className="post-chat-log" ref={log} aria-live="polite">
        <p className="post-chat-msg ai">{t('Pídeme lo que necesites: corregir textos, cambiar el formato, los colores o el logo, buscar fotos en la web o crear una imagen. También puedes adjuntar una imagen de referencia.')}</p>
        {msgs.map((m, i) => (
          <div key={i} className={'post-chat-msg ' + m.who}>
            {m.image && <img className="chat-ref" src={m.image} alt={t('Imagen de referencia')} />}
            {m.text && <span>{m.text}</span>}
            {m.preview && <img className="chat-result" src={m.preview} alt={t('Resultado')} />}
            {m.photos?.length > 0 && <Photos items={m.photos} disabled={off} onPick={pick} />}
          </div>
        ))}
        {busy && <p className="post-chat-msg ai">{t('Trabajando…')}</p>}
      </div>
      <div className="chat-chips">
        {ideas.map((s) => <button key={s} type="button" className="chip chat-idea" disabled={off} onClick={() => send(s)}>✨ {s}</button>)}
        {QUICK.map(([ico, label, prompt]) => <button key={label} type="button" className="chip" disabled={off} onClick={() => send(t(prompt))}>{ico} {t(label)}</button>)}
      </div>
      {ref && (
        <div className="chat-attached">
          <img src={ref} alt="" />
          <span>{t('Imagen de referencia')}</span>
          <button type="button" className="btn ghost sm" onClick={() => setRef(null)}>{t('Quitar')}</button>
        </div>
      )}
      <form className="post-chat-form" onSubmit={submit}>
        <textarea rows={2} value={draft} maxLength={1200} disabled={busy} readOnly={voice.listening} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) submit(e) }}
          onPaste={(e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith('image/')); if (f) { e.preventDefault(); attach(f) } }}
          placeholder={voice.listening ? t('Te escucho…') : t('Escribe tu pedido o pulsa «Hablar»…')} aria-label={t('Asistente de la publicación')} />
        {voice.listening && (
          <p className="voice-status" role="status"><i aria-hidden="true" /> {autoSend ? t('Escuchando… se envía cuando hagas una pausa.') : t('Escuchando… haz una pausa o pulsa «Detener».')}</p>
        )}
        <div className="post-chat-tools">
          <button type="button" className={'btn sm voice-btn' + (voice.listening ? ' on' : ' ghost')} disabled={off && !voice.listening} aria-pressed={voice.listening} onClick={talk}
            title={t('Pide los cambios hablando. El navegador convierte tu voz en texto (Chrome y Edge usan sus servidores).')}>
            {voice.listening ? '⏹ ' + t('Detener') : '🎤 ' + t('Hablar')}
          </button>
          <button type="button" className="btn ghost sm" disabled={off} onClick={() => file.current?.click()}>📎 {t('Referencia')}</button>
          <button type="button" className="btn ghost sm" disabled={off || !draft.trim()} onClick={find} title={t('Busca fotos con las palabras que escribiste, sin usar la IA. En inglés hay más resultados.')}>🔎 {t('Buscar fotos')}</button>
          <button type="submit" className="btn primary sm" disabled={off || (!draft.trim() && !ref)}>{t('Enviar')}</button>
        </div>
        {voice.supported && <label className="voice-auto"><input type="checkbox" checked={autoSend} onChange={(e) => toggleAutoSend(e.target.checked)} /> {t('Enviar al terminar de hablar')}</label>}
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { attach(e.target.files?.[0]); e.target.value = '' }} />
      </form>
      <details className="post-chat-cap">
        <summary>{t('Ver el texto de la publicación')}</summary>
        <p>{caption}</p>
      </details>
    </div>
  )
}
