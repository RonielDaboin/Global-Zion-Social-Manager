import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t, useLang } from '../lib/i18n.jsx'

// Emojis por categoría (separados por espacio). Los recientes se guardan en el navegador.
export const CATS = [
  ['😀', 'Caras', '😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🤭 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👹 👺 🤡 💩 👻 💀 ☠️ 👽 👾 🤖 🎃 😺 😸 😹 😻 😼 😽 🙀 😿 😾'],
  ['👋', 'Gestos', '👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦵 🦶 👂 👃 🧠 👀 👁️ 👅 👄 👶 🧒 👦 👧 🧑 👨 👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🙇 🤦 🤷 👨‍💻 👩‍💻 👨‍💼 👩‍💼 🧑‍🎨 🧑‍🚀 🦸 🦹 🧙 🧚 🧜 🧞'],
  ['❤️', 'Corazones', '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ 💌 💋 💯 💢 💥 💫 💦 💨 🕳️ 💬 💭 🗯️ 💤 ✨ 🌟 ⭐ 🔥 ⚡ 🌈 ☀️ ⛅ ☁️ 🌙 🎉 🎊 🎈 🎁 🏆 🥇 🥈 🥉 🏅 🎖️'],
  ['🐶', 'Animales', '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🕷️ 🐢 🐍 🦎 🐙 🦑 🦐 🦀 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐘 🦒 🦓 🐪 🐑 🐐 🌵 🎄 🌲 🌳 🌴 🌱 🌿 ☘️ 🍀 🍁 🍂 🍃 🌺 🌻 🌹 🌷 🌼 🌸 💐'],
  ['🍕', 'Comida', '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥕 🌽 🌶️ 🥔 🍞 🥐 🧀 🥚 🍳 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🥪 🌮 🌯 🥗 🍝 🍜 🍲 🍣 🍱 🍤 🍙 🍚 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🍫 🍬 🍭 ☕ 🍵 🥤 🧃 🍺 🍻 🥂 🍷 🍸 🍹 🍾'],
  ['⚽', 'Actividades', '⚽ 🏀 🏈 ⚾ 🎾 🏐 🏉 🎱 🏓 🏸 🥊 🥋 ⛳ 🏹 🎣 🎽 ⛸️ 🎿 🏂 🏋️ 🤸 🚴 🏊 🧘 🏄 🎮 🕹️ 🎯 🎲 🧩 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🎻'],
  ['🚗', 'Viajes', '🚗 🚕 🚙 🚌 🏎️ 🚓 🚑 🚒 🚚 🚜 🏍️ 🚲 🛴 ✈️ 🛫 🛬 🚀 🛸 🚁 ⛵ 🚤 🚢 🏠 🏡 🏢 🏬 🏦 🏥 🏫 ⛪ 🕌 🗼 🗽 🏰 ⛰️ 🏔️ 🌋 🏖️ 🏝️ 🏕️ 🌅 🌄 🌃 🌉 🌍 🌎 🌏 🧭 🗺️'],
  ['💡', 'Objetos', '⌚ 📱 💻 🖥️ ⌨️ 🖱️ 🖨️ 💾 💿 📷 📸 📹 🎥 📞 ☎️ 📺 📻 🎙️ ⏰ ⏳ 📡 🔋 🔌 💡 🔦 🕯️ 💰 💳 💎 ⚖️ 🔧 🔨 🛠️ ⚙️ 🔒 🔓 🔑 🛡️ 🧰 🧲 📦 📫 📝 📄 📊 📈 📉 📌 📍 📎 ✂️ 🗂️ 📅 📆 🗑️ 🔍 🔎 📣 📢 🔔 🔖 🏷️ 🌐 🔗 ✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➡️ ⬅️ ⬆️ ⬇️ ↗️ 🔄 ⚠️ 🚫 ❓ ❗ ‼️ ™️ ©️ ®️ 🆕 🆓 🔝 🆗 💲'],
]
const RECENT_KEY = 'gz_emoji_recent'
const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY)) || [] } catch { return [] } }

/** Inserta `emoji` donde esté el cursor del campo (o al final) y devuelve el nuevo valor y la posición del cursor. */
export function insertAtCursor(el, value, emoji) {
  const s = el && typeof el.selectionStart === 'number' ? el.selectionStart : value.length
  const e = el && typeof el.selectionEnd === 'number' ? el.selectionEnd : value.length
  return { value: value.slice(0, s) + emoji + value.slice(e), caret: s + emoji.length }
}

/** Botón 😊 con selector de emojis tipo WhatsApp. Pon `inputRef` en el textarea/input y pásale su valor y su setter. */
export default function EmojiButton({ inputRef, value, onChange, className = '', label = false }) {
  useLang()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const pop = useRef(null)
  const [cat, setCat] = useState(0)
  const [recent, setRecent] = useState(readRecent)
  const box = useRef(null)
  const caret = useRef(null)

  useEffect(() => {
    if (!open) return
    const off = (e) => { if (box.current?.contains(e.target) || pop.current?.contains(e.target)) return; setOpen(false) }
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', off)
    window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', off); window.removeEventListener('keydown', esc) }
  }, [open])
  useEffect(() => { // tras insertar, devuelve el foco y el cursor al campo
    if (caret.current == null) return
    const el = inputRef?.current
    if (el) { el.focus(); try { el.setSelectionRange(caret.current, caret.current) } catch { /* ignore */ } }
    caret.current = null
  }, [value]) // eslint-disable-line

  // El selector se dibuja en <body> (fuera de las tarjetas con efecto cristal) y se coloca junto al botón
  const place = () => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    const W = Math.min(340, window.innerWidth - 16), H = 330
    const left = Math.max(8, Math.min(r.left, window.innerWidth - W - 8))
    const up = r.top > H + 12 || r.top > window.innerHeight - r.bottom
    setPos({ left, width: W, ...(up ? { bottom: window.innerHeight - r.top + 6 } : { top: r.bottom + 6 }) })
  }
  useLayoutEffect(() => {
    if (!open) return
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open]) // eslint-disable-line
  const toggle = () => setOpen((o) => !o)
  const pick = (em) => {
    const r = insertAtCursor(inputRef?.current, value, em)
    caret.current = r.caret
    onChange(r.value)
    const next = [em, ...recent.filter((x) => x !== em)].slice(0, 24)
    setRecent(next)
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  const tabs = [...(recent.length ? [['🕘', 'Recientes', recent.join(' ')]] : []), ...CATS]
  const cur = tabs[Math.min(cat, tabs.length - 1)]
  const list = cur[2].split(' ')

  return (
    <span className={'emoji-wrap ' + className} ref={box}>
      <button type="button" className="emoji-btn" onClick={toggle} title={t('Emojis')} aria-label={t('Emojis')} aria-expanded={open}>😊{label && <span>{t('Emojis')}</span>}</button>
      {open && pos && createPortal(
        <div className="emoji-pop" ref={pop} style={pos} role="dialog" aria-label={t('Emojis')}>
          <div className="emoji-tabs">
            {tabs.map((c, i) => <button key={c[1]} type="button" className={i === cat ? 'on' : ''} title={t(c[1])} onClick={() => setCat(i)}>{c[0]}</button>)}
          </div>
          <div className="emoji-title">{t(cur[1])}</div>
          <div className="emoji-grid">
            {list.map((em, i) => <button key={em + i} type="button" onClick={() => pick(em)}>{em}</button>)}
          </div>
        </div>,
        document.body,
      )}
    </span>
  )
}
