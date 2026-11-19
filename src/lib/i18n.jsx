import { createContext, useContext, useState } from 'react'
import EN from './en.js'

const detect = () => {
  try {
    const s = localStorage.getItem('gz-lang')
    if (s === 'es' || s === 'en') return s
  } catch { /* ignore */ }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'es'
}

let current = detect()
if (typeof document !== 'undefined') document.documentElement.lang = current

/** Traduce una cadena escrita en español. Admite {variables}. Usable dentro y fuera de React. */
export const t = (s, v) => {
  let r = current === 'en' ? EN[s] ?? s : s
  if (v) for (const k in v) r = r.replaceAll(`{${k}}`, v[k])
  return r
}
export const getLang = () => current
export const locale = () => (current === 'en' ? 'en-US' : 'es-CL')

const Ctx = createContext({ lang: current, setLang: () => {} })
export const useLang = () => useContext(Ctx)

export function LangProvider({ children }) {
  const [lang, set] = useState(current)
  const setLang = (l) => {
    current = l
    document.documentElement.lang = l
    try { localStorage.setItem('gz-lang', l) } catch { /* ignore */ }
    set(l)
  }
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>
}
