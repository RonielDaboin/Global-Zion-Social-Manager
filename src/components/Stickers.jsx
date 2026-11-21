import { useEffect, useRef, useState } from 'react'
import { CATS } from './EmojiPicker.jsx'
import { t, useLang } from '../lib/i18n.jsx'

// Stickers estilo story de Instagram: porcentajes de oferta, barras/anillos de carga, etiquetas, emojis/objetos y formas.
// Cada uno se agrega como una capa movible.
const RED = '#ef4444', YEL = '#facc15', GRN = '#10b981', BLU = '#1d6fb8', NAVY = '#0f2a5c', SKY = '#38bdf8', PINK = '#ec4899', ORG = '#f97316', PUR = '#7c3aed', WHT = '#ffffff', DARK = '#1e293b'
const S = (text, shape, bg, color = WHT, size = 80, rot = 0) => ({ text, shape, bg, color, size, rot })
// Carga: bg = fondo (pista), fill = color que se llena según p
const P = (p, shape, bg, fill, size = 70, rot = 0) => ({ text: `${p}%`, shape, bg, fill, progress: p, color: WHT, size, rot })

const OFFER = [
  S('5%', 'burst', PUR, WHT, 90, -6), S('10%', 'burst', RED, WHT, 90, -8), S('15%', 'burst', ORG, WHT, 90, 6), S('20%', 'burst', PINK, WHT, 90, -6),
  S('25%', 'burst', BLU, WHT, 90, 7), S('30%', 'burst', GRN, WHT, 90, -7), S('40%', 'burst', PUR, WHT, 95, 6), S('50%', 'burst', RED, WHT, 100, 8),
  S('60%', 'burst', ORG, WHT, 100, -8), S('70%', 'burst', NAVY, YEL, 100, -8), S('80%', 'burst', PINK, WHT, 100, 6), S('90%', 'burst', RED, YEL, 100, -6),
  S('-10%', 'pill', YEL, '#111827', 80, -6), S('-15%', 'pill', ORG, WHT, 80, 5), S('-20%', 'pill', RED, WHT, 80, -5), S('-25%', 'pill', PINK, WHT, 80, 4),
  S('-30%', 'pill', BLU, WHT, 80, -5), S('-40%', 'pill', PUR, WHT, 80, 5), S('-50%', 'pill', NAVY, SKY, 80, -4), S('-60%', 'pill', GRN, WHT, 80, 4), S('-70%', 'pill', RED, YEL, 80, -4),
  S('50%\nOFF', 'circle', RED, WHT, 80, -10), S('30%\nOFF', 'circle', PUR, WHT, 80, 8), S('20%\nOFF', 'circle', BLU, WHT, 80, -8), S('2x1', 'circle', BLU, WHT, 90, 8), S('3x2', 'circle', GRN, WHT, 90, -8),
  S('HASTA 50%', 'rect', YEL, '#111827', 70, -4), S('DESC. 15%', 'rect', RED, WHT, 64, 4), S('SALE 50%', 'rect', NAVY, YEL, 70, -3), S('100%', 'rect', GRN, WHT, 80, -4),
]
const LOADING = [
  P(10, 'pill', DARK, SKY), P(25, 'pill', DARK, GRN), P(50, 'pill', DARK, ORG), P(75, 'pill', DARK, PINK), P(90, 'pill', DARK, SKY), P(100, 'pill', DARK, GRN),
  P(30, 'rect', NAVY, YEL), P(60, 'rect', NAVY, SKY), P(80, 'rect', NAVY, GRN),
  P(25, 'ring', NAVY, SKY, 70), P(50, 'ring', NAVY, GRN, 70), P(75, 'ring', NAVY, ORG, 70), P(90, 'ring', NAVY, PINK, 70), P(100, 'ring', NAVY, YEL, 70),
  P(30, 'circle', NAVY, BLU, 70), P(60, 'circle', NAVY, GRN, 70), P(90, 'circle', NAVY, PINK, 70),
]
const LABELS = [
  S('NUEVO', 'pill', GRN, WHT, 64, -6), S('OFERTA', 'pill', RED, WHT, 64, 5), S('GRATIS', 'pill', PINK, WHT, 64, -4),
  S('HOY', 'rect', YEL, '#111827', 70, 4), S('ÚLTIMOS DÍAS', 'pill', ORG, WHT, 54, -5), S('ENVÍO GRATIS', 'pill', BLU, WHT, 54, 4),
  S('¡NO TE LO PIERDAS!', 'pill', NAVY, SKY, 50, -3), S('DESDE $354.000', 'pill', BLU, WHT, 54, 3),
  S('www.globalzion.cl', 'pill', WHT, NAVY, 50, 0), S('COTIZA AQUÍ', 'rect', SKY, NAVY, 56, -3), S('WHATSAPP +56 9 3070 1132', 'pill', GRN, WHT, 44, 0),
]
const SHAPES = [
  S(' ', 'circle', SKY, WHT, 80), S(' ', 'circle', RED, WHT, 80), S(' ', 'rect', BLU, WHT, 80), S(' ', 'rect', WHT, WHT, 80),
  S(' ', 'star', YEL, WHT, 90), S(' ', 'star', PINK, WHT, 90), S(' ', 'burst', ORG, WHT, 90), S(' ', 'burst', GRN, WHT, 90),
]

// Muestra solo 3 filas y, si hay más, el botón «Ver más / Ver menos»
function ClampGrid({ className, children, rows = 3 }) {
  useLang()
  const ref = useRef(null)
  const [open, setOpen] = useState(false)
  const [more, setMore] = useState(false)
  const [h, setH] = useState(0)
  useEffect(() => {
    const calc = () => {
      const el = ref.current
      if (!el || !el.firstElementChild) return
      const kids = [...el.children]
      const tops = [...new Set(kids.map((k) => k.offsetTop - kids[0].offsetTop))].sort((a, b) => a - b)
      setMore(tops.length > rows)
      setH(tops.length > rows ? tops[rows] - 8 : 0)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [children]) // eslint-disable-line
  return (
    <>
      <div ref={ref} className={className} style={!open && more ? { maxHeight: h + 4, overflow: 'hidden' } : undefined}>{children}</div>
      {more && <button className="btn ghost sm tpl-more" onClick={() => setOpen((o) => !o)}>{open ? t('Ver menos') : t('Ver más')}</button>}
    </>
  )
}

const previewStyle = (it) => {
  if (it.progress == null) return { background: it.bg, color: it.color }
  const p = it.progress
  if (it.shape === 'ring') return { background: `radial-gradient(${it.bg} 52%, transparent 54%), conic-gradient(${it.fill} ${p}%, #ffffff33 0)`, color: it.color }
  if (it.shape === 'circle') return { background: `linear-gradient(to top, ${it.fill} ${p}%, ${it.bg} ${p}%)`, color: it.color }
  return { background: `linear-gradient(90deg, ${it.fill} ${p}%, ${it.bg} ${p}%)`, color: it.color }
}

export default function Stickers({ onAdd }) {
  useLang()
  const [tab, setTab] = useState('percent')
  const [cat, setCat] = useState(0)
  const [n, setN] = useState(25)
  const tabs = [['percent', '％', 'Porcentajes'], ['loading', '⏳', 'Carga'], ['labels', '🏷️', 'Etiquetas'], ['emoji', '😊', 'Emojis y objetos'], ['shapes', '⭐', 'Formas']]
  const items = { percent: OFFER, loading: LOADING, labels: LABELS, shapes: SHAPES }[tab]
  const emojis = CATS[Math.min(cat, CATS.length - 1)][2].split(' ')

  return (
    <div className="stk">
      <div className="stk-tabs" role="tablist">
        {tabs.map(([id, ico, label]) => <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)} title={t(label)}><span>{ico}</span><small>{t(label)}</small></button>)}
      </div>

      {tab === 'percent' && (
        <div className="stk-custom">
          <label className="inl"><span className="lbl">{t('Porcentaje')} <b>{n}%</b></span><input type="range" min="1" max="100" value={n} onChange={(e) => setN(+e.target.value)} /></label>
          <button className="btn sm" onClick={() => onAdd(S(`${n}%\nOFF`, 'burst', RED, WHT, 90, -8))}>＋ {t('Añadir')} {n}% OFF</button>
        </div>
      )}
      {tab === 'loading' && (
        <div className="stk-custom">
          <label className="inl"><span className="lbl">{t('Porcentaje')} <b>{n}%</b></span><input type="range" min="0" max="100" value={n} onChange={(e) => setN(+e.target.value)} /></label>
          <div className="row">
            <button className="btn sm" onClick={() => onAdd(P(n, 'pill', DARK, SKY))}>＋ {t('Barra')} {n}%</button>
            <button className="btn sm" onClick={() => onAdd(P(n, 'ring', NAVY, SKY))}>＋ {t('Anillo')} {n}%</button>
          </div>
        </div>
      )}

      {tab === 'emoji' ? (
        <>
          <div className="stk-cats">{CATS.map((c, i) => <button key={c[1]} className={i === cat ? 'on' : ''} title={t(c[1])} onClick={() => setCat(i)}>{c[0]}</button>)}</div>
          <div className="stk-grid emo">{emojis.map((em, i) => <button key={em + i} onClick={() => onAdd({ text: em, size: 170, shadow: false, bg: '', rot: 0 })}>{em}</button>)}</div>
        </>
      ) : (
        <ClampGrid key={tab} className="stk-grid flat">
          {items.map((it, i) => (
            <button key={i} className="stk-item" onClick={() => onAdd(it)} title={t('Añadir')}>
              <span className={'stk-prev ' + it.shape} style={previewStyle(it)}>{it.text.trim() ? it.text.replace('\n', ' ') : ''}</span>
            </button>
          ))}
        </ClampGrid>
      )}
      <p className="hint">{t('Se agregan al centro: arrástralos sobre la imagen, cambia tamaño, color y rotación abajo.')}</p>
    </div>
  )
}
