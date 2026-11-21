import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FONT_GROUPS, FONTS_UPDATED } from '../lib/formats.js'
import { t, locale } from '../lib/i18n.jsx'

const LABELS = { popular: '⭐ Popular', trending: '🔥 En tendencia', business: '💼 Empresarial', casual: '😄 Casual', gamer: '🎮 Gamer', others: '🗂️ Otros' }

const groupLabel = (id) => {
  if (id !== 'trending') return t(LABELS[id])
  const d = new Date(FONTS_UPDATED + '-15').toLocaleDateString(locale(), { month: 'long', year: 'numeric' })
  return `${t(LABELS[id])} · ${d}`
}

// Selector de fuentes con categorías contraídas que se despliegan al hacer clic.
export default function FontPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState({})
  const ref = useRef(null)
  const panelRef = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => { if (!ref.current?.contains(e.target) && !panelRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  // Panel fijo a la ventana: no lo recorta el modal y usa todo el alto disponible.
  const [pos, setPos] = useState(null)
  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = btnRef.current.getBoundingClientRect()
      const below = window.innerHeight - r.bottom - 12
      const above = r.top - 12
      const up = below < 300 && above > below
      const space = up ? above : below
      setPos({ left: r.left, width: r.width, maxHeight: Math.min(560, Math.max(200, space)), ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [open])

  const toggle = (id) => setOpenGroups((s) => ({ ...s, [id]: !s[id] }))

  return (
    <div className="fpick" ref={ref}>
      <button type="button" className="fpick-btn" ref={btnRef} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span style={{ fontFamily: `"${value}", sans-serif` }}>{value}</span>
        <span className="fpick-caret">{open ? '▴' : '▾'}</span>
      </button>
      {open && pos && createPortal(
        <div className="fpick-panel" ref={panelRef} style={pos}>
          {FONT_GROUPS.map((g) => (
            <div key={g.id}>
              <button type="button" className="fpick-group" onClick={() => toggle(g.id)} aria-expanded={!!openGroups[g.id]}>
                <span>{groupLabel(g.id)} <small>{g.fonts.length}</small></span>
                <span>{openGroups[g.id] ? '▴' : '▾'}</span>
              </button>
              {openGroups[g.id] && g.fonts.map((f) => (
                <button type="button" key={f.id} className={'fpick-opt' + (f.id === value ? ' on' : '')} style={{ fontFamily: `"${f.id}", sans-serif` }}
                  onClick={() => { onChange(f.id); setOpen(false) }}>
                  {f.label}
                </button>
              ))}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
