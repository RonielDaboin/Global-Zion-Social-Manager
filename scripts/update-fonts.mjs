// Actualiza las listas de fuentes del editor según los rankings de Google Fonts.
// Uso: npm run update-fonts   (también corre solo cada mes vía GitHub Actions)
import { readFileSync, writeFileSync } from 'node:fs'

const META = 'https://fonts.google.com/metadata/fonts'
const PER_GROUP = 10
// Fuentes de sistema/marca o clones que no aportan variedad al editor.
const EXCLUDE = /^(Google Sans|Arimo|Tinos|Cousine)/
// "En tendencia" solo considera fuentes con uso real (evita rarezas recién publicadas).
const TRENDING_MAX_POPULARITY = 150
// Candidatas de estilo gamer / tech / retro (Google no etiqueta estilos, así que se curan aquí;
// el ranking de Google decide cuáles de ellas entran y en qué orden).
const GAMER = new Set(['Orbitron', 'Press Start 2P', 'Black Ops One', 'Rajdhani', 'Audiowide', 'Russo One', 'Bungee', 'Exo 2', 'Chakra Petch', 'Share Tech', 'Saira', 'Michroma', 'Zen Dots', 'Teko', 'Aldrich', 'VT323', 'Silkscreen', 'Goldman', 'Iceland', 'Oxanium', 'Tourney', 'Bai Jamjuree', 'Electrolize', 'Squada One', 'Monoton'])
// Fuentes que usan las plantillas: siempre deben estar disponibles.
const PINNED = ['Poppins', 'Montserrat', 'Inter', 'Bebas Neue', 'Playfair Display']

const res = await fetch(META)
if (!res.ok) throw new Error(`Google Fonts metadata: ${res.status}`)
const all = (await res.json()).familyMetadataList

const staticWeights = (f) => Object.keys(f.fonts).filter((k) => /^\d+$/.test(k)).map(Number)
const pool = all.filter(
  (f) => f.subsets?.includes('latin') && !f.isNoto && !f.isBrandFont && !EXCLUDE.test(f.family) && f.category !== 'Monospace' && staticWeights(f).some((w) => w >= 400),
)
const byPop = [...pool].sort((a, b) => a.popularity - b.popularity)
const used = new Set()
const take = (list, n) => {
  const out = []
  for (const f of list) {
    if (out.length >= n) break
    if (!used.has(f.family)) { used.add(f.family); out.push(f) }
  }
  return out
}
const isCasual = (f) => f.category === 'Handwriting' || f.category === 'Display'

const popular = take(byPop, PER_GROUP)
const trending = take(byPop.filter((f) => f.popularity <= TRENDING_MAX_POPULARITY).sort((a, b) => a.trending - b.trending), PER_GROUP)
const gamer = take(byPop.filter((f) => GAMER.has(f.family)), PER_GROUP)
const business = take(byPop.filter((f) => !isCasual(f)), PER_GROUP)
const casual = take(byPop.filter(isCasual), PER_GROUP)
const others = take(byPop, PER_GROUP)
for (const name of PINNED) {
  const f = pool.find((x) => x.family === name)
  if (f && !used.has(name)) { used.add(name); others.push(f) }
}

const groups = [
  ['popular', popular], ['trending', trending], ['business', business], ['casual', casual], ['gamer', gamer], ['others', others],
].map(([id, fonts]) => ({ id, fonts: fonts.map((f) => ({ id: f.family, label: f.family })) }))

const chosen = [...popular, ...trending, ...business, ...casual, ...gamer, ...others]
const spec = (f) => {
  const name = f.family.replace(/ /g, '+')
  const wght = f.axes.find((a) => a.tag === 'wght')
  if (wght) return `family=${name}:wght@${Math.max(400, wght.min)}..${Math.min(900, wght.max)}`
  const ws = staticWeights(f).filter((w) => w >= 400 && w <= 900).sort((a, b) => a - b)
  return ws.length === 1 && ws[0] === 400 ? `family=${name}` : `family=${name}:wght@${ws.join(';')}`
}
const css = `https://fonts.googleapis.com/css2?${chosen.map(spec).join('&')}&display=swap`
const check = await fetch(css, { headers: { 'User-Agent': 'Mozilla/5.0' } })
if (!check.ok) throw new Error(`La URL de Google Fonts no es válida (${check.status})`)

const updated = new Date().toISOString().slice(0, 7)
writeFileSync('src/lib/fonts.json', JSON.stringify({ updated, groups }, null, 2) + '\n')
const html = readFileSync('index.html', 'utf8')
const next = html.replace(/<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]*"/, () => `<link href="${css}"`)
if (next === html && !html.includes(css)) throw new Error('No encontré el <link> de fuentes en index.html')
writeFileSync('index.html', next)
console.log(`Fuentes actualizadas (${updated}): ${chosen.length} familias`)
for (const g of groups) console.log(` ${g.id}: ${g.fonts.map((f) => f.id).join(', ')}`)
