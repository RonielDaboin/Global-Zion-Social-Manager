import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { publishPost, handleOAuthCallback } from './social.js'
import { uid } from './formats.js'
import { t } from './i18n.jsx'
import { supabase, toSession } from './supabase.js'

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

const read = (k, d) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d }
}
const write = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); return true } catch { return false }
}

export function AppProvider({ children }) {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [toast, setToast] = useState(null)
  const [storageFull, setStorageFull] = useState(false)

  const key = session ? session.id : 'anon'
  const [accounts, setAccounts] = useState({})
  const [posts, setPosts] = useState([])
  const [draft, setDraft] = useState(null) // post en edición en el composer
  const loadedFor = useRef(null)

  useEffect(() => {
    if (!session) { loadedFor.current = null; return }
    setAccounts(read(`gz_accounts_${key}`, {}))
    setPosts(read(`gz_posts_${key}`, []))
    loadedFor.current = key
  }, [key, session])

  useEffect(() => { if (loadedFor.current === key) write(`gz_accounts_${key}`, accounts) }, [accounts, key])
  useEffect(() => {
    if (loadedFor.current === key) setStorageFull(!write(`gz_posts_${key}`, posts))
  }, [posts, key])

  const notify = useCallback((msg, type = 'ok') => {
    setToast({ msg, type, id: uid() })
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3800)
    return () => clearTimeout(t)
  }, [toast])

  // ---- Auth con Supabase ----
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(toSession(data.session?.user)); setAuthReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(toSession(s?.user)))
    return () => sub.subscription.unsubscribe()
  }, [])

  const authErr = (e) => {
    const m = e.message || ''
    if (/invalid login/i.test(m)) return new Error(t('Correo o contraseña incorrectos'))
    if (/already registered/i.test(m)) return new Error(t('Ese correo ya está registrado'))
    if (/not confirmed/i.test(m)) return new Error(t('Confirma tu correo antes de entrar'))
    return new Error(m)
  }
  const register = async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin },
    })
    if (error) throw authErr(error)
    if (!data.session) throw new Error(t('Revisa tu correo para confirmar la cuenta'))
  }
  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) throw authErr(error)
  }
  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    if (error) throw authErr(error)
  }
  const logout = async () => { await supabase.auth.signOut(); setAccounts({}); setPosts([]) }

  // ---- Cuentas sociales ----
  const connectAccount = (platform, data) => setAccounts((a) => ({ ...a, [platform]: { ...data, connectedAt: Date.now() } }))
  const disconnectAccount = (platform) => setAccounts((a) => { const n = { ...a }; delete n[platform]; return n })

  useEffect(() => {
    if (!session) return
    handleOAuthCallback()
      .then((r) => { if (r) { connectAccount(r.platform, r); notify(t('Cuenta de {p} conectada', { p: r.platform })) } })
      .catch((e) => notify(e.message, 'err'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // ---- Publicaciones ----
  const savePost = (p) => {
    setPosts((list) => {
      const i = list.findIndex((x) => x.id === p.id)
      if (i >= 0) { const n = [...list]; n[i] = p; return n }
      return [p, ...list]
    })
  }
  const deletePost = (id) => setPosts((l) => l.filter((p) => p.id !== id))

  const postsRef = useRef(posts); postsRef.current = posts
  const accountsRef = useRef(accounts); accountsRef.current = accounts

  const publishNow = useCallback(async (id) => {
    const post = postsRef.current.find((p) => p.id === id)
    if (!post) return
    setPosts((l) => l.map((p) => (p.id === id ? { ...p, status: 'publishing' } : p)))
    const results = await publishPost(post, accountsRef.current)
    const allOk = Object.values(results).every((r) => r.ok)
    setPosts((l) => l.map((p) => (p.id === id
      ? { ...p, status: allOk ? 'published' : 'failed', results, publishedAt: allOk ? Date.now() : p.publishedAt }
      : p)))
    const demo = Object.values(results).some((r) => r.demo)
    if (allOk) notify(demo ? t('Publicado (modo demo: simulado)') : t('¡Publicado con éxito!'))
    else notify(t('Falló:') + ' ' + Object.entries(results).filter(([, r]) => !r.ok).map(([k, r]) => `${k}: ${r.error}`).join(', '), 'err')
  }, [notify])

  // Programador: revisa cada 15 s las publicaciones cuyo momento ya llegó (mientras la app esté abierta)
  useEffect(() => {
    if (!session) return
    const t = setInterval(() => {
      postsRef.current
        .filter((p) => p.status === 'scheduled' && p.scheduledAt <= Date.now())
        .forEach((p) => publishNow(p.id))
    }, 15000)
    return () => clearInterval(t)
  }, [session, publishNow])

  const value = {
    session, authReady, register, login, loginWithGoogle, logout,
    accounts, connectAccount, disconnectAccount,
    posts, savePost, deletePost, publishNow,
    draft, setDraft,
    toast, notify, storageFull,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
