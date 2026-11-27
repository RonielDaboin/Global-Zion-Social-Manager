import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t, locale } from '../lib/i18n.jsx'

const pad = (n) => String(n).padStart(2, '0')
const toInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
const at = (days, h, m = 0) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(h, m, 0, 0); return d }
const nextMonday = () => { const d = at(0, 9); d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); return d }
const same = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

const PRESETS = [
  { l: 'En 1 hora', d: () => new Date(Date.now() + 3600e3) },
  { l: 'Hoy 18:00', d: () => at(0, 18) },
  { l: 'Mañana 9:00', d: () => at(1, 9) },
  { l: 'Mañana 18:00', d: () => at(1, 18) },
  { l: 'Lunes 9:00', d: nextMonday },
]

/** Calendario + hora propios (el del navegador no se puede estilizar). */
export function WhenPopover({ anchor, value, onChange, onClose }) {
  const sel = new Date(value)
  const [view, setView] = useState(() => new Date(sel.getFullYear(), sel.getMonth(), 1))
  const [pos, setPos] = useState(null)
  const [dir, setDir] = useState(1) // 1 = mes siguiente, -1 = anterior (sentido de la animación)
  const box = useRef(null)
  const hRef = useRef(null), mRef = useRef(null)
  const mobile = typeof window !== 'undefined' && window.innerWidth < 600
  const today = new Date()
  const loc = locale()

  useLayoutEffect(() => {
    if (mobile) return
    const r = anchor.getBoundingClientRect()
    const hgt = box.current?.offsetHeight || 380
    const below = window.innerHeight - r.bottom
    const top = below >= hgt + 12 || r.top < hgt + 12 ? Math.min(r.bottom + 8, window.innerHeight - hgt - 8) : r.top - hgt - 8
    setPos({ top: Math.max(8, top), left: Math.min(Math.max(8, r.left), window.innerWidth - 348) })
  }, [anchor, mobile, view])

  useEffect(() => {
    const down = (e) => { if (!box.current?.contains(e.target) && !anchor.contains(e.target)) onClose() }
    const key = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('mousedown', down)
    window.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); window.removeEventListener('keydown', key) }
  }, [anchor, onClose])

  useEffect(() => { // deja visibles la hora y los minutos elegidos
    for (const r of [hRef, mRef]) r.current?.querySelector('.on')?.scrollIntoView({ block: 'center' })
  }, [])

  const pickDay = (d) => { const n = new Date(sel); n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); onChange(toInput(n)) }
  const setH = (h) => { const n = new Date(sel); n.setHours(h); onChange(toInput(n)) }
  const setM = (m) => { const n = new Date(sel); n.setMinutes(m); onChange(toInput(n)) }

  const off = (view.getDay() + 6) % 7
  const cells = Array.from({ length: 42 }, (_, i) => new Date(view.getFullYear(), view.getMonth(), 1 - off + i))
  const wd = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(loc, { weekday: 'short' }).replace('.', ''))
  const mins = [...new Set([...Array.from({ length: 12 }, (_, i) => i * 5), sel.getMinutes()])].sort((a, b) => a - b)
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const shift = (n) => { setDir(n); setView(new Date(view.getFullYear(), view.getMonth() + n, 1)) }
  const mk = view.getFullYear() * 12 + view.getMonth()

  const ui = (
    <div className={mobile ? 'wp-bg' : undefined}>
      <div ref={box} className={'wp' + (mobile ? ' sheet' : '')} style={mobile ? undefined : { top: pos?.top ?? -9999, left: pos?.left ?? -9999 }} role="dialog" aria-label={t('Programar para')}>
        <div className="wp-cal">
          <div className="wp-head">
            <button type="button" className="wp-nav" onClick={() => shift(-1)} aria-label="‹">‹</button>
            <span className="wp-title"><b key={mk} className={dir > 0 ? "to-next" : "to-prev"}>{cap(view.toLocaleDateString(loc, { month: 'long', year: 'numeric' }))}</b></span>
            <button type="button" className="wp-nav" onClick={() => shift(1)} aria-label="›">›</button>
          </div>
          <div className="wp-grid wp-wd">{wd.map((w) => <span key={w}>{w}</span>)}</div>
          <div className="wp-clip"><div key={mk} className={"wp-grid wp-days " + (dir > 0 ? "to-next" : "to-prev")}>
            {cells.map((d) => {
              const out = d.getMonth() !== view.getMonth()
              const past = d < startToday
              return (
                <button key={d.getTime()} type="button" disabled={past}
                  className={'wp-day' + (out ? ' out' : '') + (same(d, sel) ? ' on' : '') + (same(d, today) ? ' today' : '')}
                  onClick={() => pickDay(d)}>{d.getDate()}</button>
              )
            })}
          </div></div>
        </div>
        <div className="wp-time">
          <small>{t('Hora')}</small>
          <div className="wp-cols">
            <div className="wp-col" ref={hRef}>{Array.from({ length: 24 }, (_, h) => <button key={h} type="button" className={h === sel.getHours() ? 'on' : ''} onClick={() => setH(h)}>{pad(h)}</button>)}</div>
            <div className="wp-col" ref={mRef}>{mins.map((m) => <button key={m} type="button" className={m === sel.getMinutes() ? 'on' : ''} onClick={() => setM(m)}>{pad(m)}</button>)}</div>
          </div>
        </div>
        <div className="wp-foot">
          <button type="button" className="btn ghost sm" onClick={() => { const n = new Date(Date.now() + 3600e3); onChange(toInput(n)); setDir(n >= view ? 1 : -1); setView(new Date(n.getFullYear(), n.getMonth(), 1)) }}>{t('En 1 hora')}</button>
          <button type="button" className="btn primary sm" onClick={onClose}>{t('Listo')}</button>
        </div>
      </div>
    </div>
  )
  return createPortal(ui, document.body)
}

/** Selector de fecha y hora para programar: tarjeta con la fecha legible + calendario propio + atajos. `value` es "YYYY-MM-DDTHH:mm". */
export default function WhenPicker({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const anchor = useRef(null)
  const d = new Date(value)
  const ok = !isNaN(d)
  const past = ok && d.getTime() <= Date.now()
  const day = ok ? cap(d.toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })) : '—'
  const time = ok ? d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : ''
  const sel = (p) => ok && toInput(p.d()) === value

  return (
    <div className="when">
      <span className="when-l">{t('Programar para')}</span>
      <button type="button" ref={anchor} className={'when-box' + (past ? ' bad' : '') + (open ? ' open' : '')} onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}>
        <span className="when-ico" aria-hidden="true">🗓️</span>
        <span className="when-txt"><b>{day}</b><small>{time && `🕒 ${time}`}{past && ` · ${t('Elige una fecha futura')}`}</small></span>
        <span className="when-edit">{t('Cambiar')}</span>
      </button>
      {open && ok && <WhenPopover anchor={anchor.current} value={value} onChange={onChange} onClose={() => setOpen(false)} />}
      <div className="when-chips">
        {PRESETS.map((p) => (
          <button key={p.l} type="button" className={'chip' + (sel(p) ? ' on' : '')} onClick={() => onChange(toInput(p.d()))}>{t(p.l)}</button>
        ))}
      </div>
    </div>
  )
}
