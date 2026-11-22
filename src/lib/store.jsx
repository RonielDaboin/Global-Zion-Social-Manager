import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { publishPost, cleanupPostMedia, handleOAuthCallback, onOAuthResult, fetchSocial, socialCall } from './social.js'
import { uid } from './formats.js'
import { t } from './i18n.jsx'
import { supabase, toSession } from './supabase.js'
import { deleteVideo, pushVideo } from './mediaStore.js'
import { fetchPosts, upsertPosts, deletePosts } from './cloud.js'
import { accessOf } from './plans.js'

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
  const [plansHint, setPlansHint] = useState(null) // null = cerrado; '' = abierto; texto = abierto con un aviso

  const key = session ? session.id : 'anon'
  const [accounts, setAccounts] = useState({})
  const [social, setSocial] = useState({ configured: {}, ready: false }) // redes configuradas en el servidor
  const [posts, setPosts] = useState([])
  const [draft, setDraft] = useState(null) // post en edición en el composer
  const loadedFor = useRef(null)
  const cloudReady = useRef(false) // true cuando ya se cargaron las publicaciones desde Supabase
  const syncedRef = useRef({}) // id -> JSON de la última versión guardada en Supabase

  useEffect(() => {
    cloudReady.current = false
    if (!session) { loadedFor.current = null; return }
    setAccounts(read(`gz_accounts_${key}`, {}))
    const local = read(`gz_posts_${key}`, [])
    setPosts(local)
    loadedFor.current = key
    // Publicaciones en Supabase. La primera vez en este navegador se fusionan con las locales (y se suben);
    // después, Supabase es la fuente de verdad.
    fetchPosts().then((remote) => {
      if (loadedFor.current !== key) return
      const ids = new Set(remote.map((p) => p.id))
      const merged = read(`gz_cloud_${key}`, false) ? remote : [...remote, ...local.filter((p) => !ids.has(p.id))]
      syncedRef.current = Object.fromEntries(remote.map((p) => [p.id, JSON.stringify(p)]))
      cloudReady.current = true
      write(`gz_cloud_${key}`, true)
      // Lo que se está publicando en este momento solo existe en memoria: se conserva al recargar la lista
      setPosts((cur) => {
        const busy = cur.filter((p) => p.status === 'publishing')
        const ids2 = new Set(busy.map((p) => p.id))
        return [...busy, ...merged.filter((p) => !ids2.has(p.id))]
      })
    }).catch(() => notify(t('No se pudo conectar con la nube; se usan los datos locales'), 'err'))
    // Cuentas reales (tokens en el servidor) + qué redes están configuradas
    fetchSocial().then((r) => {
      if (!r || loadedFor.current !== key) return
      setSocial({ configured: r.configured || {}, ready: true })
      const real = Object.fromEntries((r.accounts || []).map((x) => [x.platform, {
        real: true, accountId: x.account_id, username: x.username || x.name || '', name: x.name, avatar: x.avatar,
        provider: x.extra?.provider, connectedAt: new Date(x.connected_at).getTime(),
      }]))
      setAccounts((a) => ({ ...Object.fromEntries(Object.entries(a).filter(([, v]) => !v.real)), ...real }))
    })
    // Solo depende del usuario (key): antes dependía del objeto de sesión, que se recreaba en cada evento de Supabase
    // (volver a la pestaña, renovar token, guardar el perfil) y recargaba las publicaciones a mitad de una publicación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  // Solo las cuentas demo se guardan en el navegador; las reales viven en el servidor
  useEffect(() => { if (loadedFor.current === key) write(`gz_accounts_${key}`, Object.fromEntries(Object.entries(accounts).filter(([, v]) => !v.real))) }, [accounts, key])
  useEffect(() => {
    if (loadedFor.current === key) setStorageFull(!write(`gz_posts_${key}`, posts))
  }, [posts, key])

  // Guarda en Supabase lo que cambió (con una pequeña espera para agrupar cambios)
  useEffect(() => {
    if (!cloudReady.current || !session) return
    const h = setTimeout(async () => {
      const synced = syncedRef.current
      const stable = posts.filter((p) => p.status !== 'publishing')
      const up = stable.filter((p) => JSON.stringify(p) !== synced[p.id])
      const del = Object.keys(synced).filter((id) => !posts.some((p) => p.id === id))
      if (!up.length && !del.length) return
      try {
        for (const p of up) if (p.mediaType === 'video' && p.status !== 'published') await pushVideo(p.id).catch(() => {})
        await upsertPosts(session.id, up)
        await deletePosts(session.id, del)
        const next = { ...synced }
        up.forEach((p) => { next[p.id] = JSON.stringify(p) })
        del.forEach((id) => { delete next[id] })
        syncedRef.current = next
      } catch (e) { notify(t('No se pudo guardar en la nube:') + ' ' + e.message, 'err') }
    }, 900)
    return () => clearTimeout(h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, session])

  const notify = useCallback((msg, type = 'ok') => {
    setToast({ msg, type, id: uid() })
  }, [])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3800)
    return () => clearTimeout(t)
  }, [toast])

  // ---- Auth con Supabase ----
  // Si los datos del usuario no cambiaron se conserva el mismo objeto (evita renders y recargas innecesarias)
  const setSess = (u) => setSession((prev) => { const n = toSession(u); return JSON.stringify(prev) === JSON.stringify(n) ? prev : n })
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSess(data.session?.user); setAuthReady(true)
      // La sesión guardada puede ser antigua (sin foto/identidad de Google): se pide el usuario fresco al servidor
      if (data.session) supabase.auth.getUser().then(({ data: d }) => { if (d?.user) setSess(d.user) })
    })
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      setSess(s?.user)
      // Google a veces no incluye la foto en el token de identidad: se pide al endpoint userinfo con el token de este inicio de sesión
      if (e === 'SIGNED_IN' && s?.provider_token && !toSession(s.user).picture) {
        fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: 'Bearer ' + s.provider_token } })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => { if (j?.picture) setTimeout(() => supabase.auth.updateUser({ data: { avatar_url: j.picture } }), 0) })
          .catch(() => {})
      }
    })
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
    // Al volver de Google se abre el modal de planes (si el usuario no tiene suscripción) para que pueda pagar
    try { sessionStorage.setItem('gz_plans_after_login', '1') } catch { /* ignore */ }
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin, queryParams: { prompt: 'select_account' } } })
    if (error) throw authErr(error)
  }
  const logout = async () => { cloudReady.current = false; await supabase.auth.signOut(); setAccounts({}); setPosts([]) }

  // ---- Cuentas sociales ----
  const connectAccount = (platform, data) => setAccounts((a) => ({ ...a, [platform]: { ...data, connectedAt: Date.now() } }))
  const disconnectAccount = async (platform) => {
    if (accountsRef.current[platform]?.real) {
      try { await socialCall('disconnect', { platform }) } catch (e) { notify(e.message, 'err'); return false }
    }
    setAccounts((a) => { const n = { ...a }; delete n[platform]; return n })
    return true
  }

  useEffect(() => { if (session) cleanupPostMedia() }, [session?.id]) // eslint-disable-line

  // Resultado de la ventana emergente de inicio de sesión (la app original no se recarga)
  useEffect(() => {
    if (window.name === 'gz_oauth') return undefined // la propia ventana emergente no escucha
    return onOAuthResult((r) => {
      if (r.error) { notify(r.error, 'err'); return }
      connectAccount(r.platform, { ...r, accountId: r.username })
      notify(t('Cuenta de {p} conectada', { p: r.platform }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!session) return
    handleOAuthCallback()
      .then((r) => { if (r) { connectAccount(r.platform, { ...r, accountId: r.username }); notify(t('Cuenta de {p} conectada', { p: r.platform })) } })
      .catch((e) => notify(e.message, 'err'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // ---- Publicaciones ----
  const me = session ? { name: session.name, email: session.email } : null
  const savePost = (p0) => {
    const p = p0.author || !me ? p0 : { ...p0, author: me } // quién creó la publicación
    setPosts((list) => {
      const i = list.findIndex((x) => x.id === p.id)
      if (i >= 0) { const n = [...list]; n[i] = p; return n }
      return [p, ...list]
    })
  }
  const deletePost = (id) => { deleteVideo(id); setPosts((l) => l.filter((p) => p.id !== id)) }

  const postsRef = useRef(posts); postsRef.current = posts
  const accountsRef = useRef(accounts); accountsRef.current = accounts
  const meRef = useRef(me); meRef.current = me

  const publishNow = useCallback(async (id) => {
    const post = postsRef.current.find((p) => p.id === id)
    if (!post) return
    setPosts((l) => l.map((p) => (p.id === id ? { ...p, status: 'publishing' } : p)))
    let results
    try { results = await publishPost(post, accountsRef.current) } catch (e) {
      // Un error inesperado no debe dejar la publicación "publicando…" para siempre
      results = Object.fromEntries((post.platforms || []).map((pl) => [pl, { ok: false, error: e?.message || String(e) }]))
    }
    const allOk = Object.values(results).every((r) => r.ok)
    if (allOk && post.mediaType === 'video') deleteVideo(id) // ya publicado: no se guarda el video (ni en la nube ni local); queda solo la captura (post.image)
    setPosts((l) => l.map((p) => (p.id === id
      ? { ...p, status: allOk ? 'published' : 'failed', results, publishedAt: allOk ? Date.now() : p.publishedAt, publishedBy: allOk ? (meRef.current || p.publishedBy) : p.publishedBy }
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

  const access = accessOf(session)
  const openPlans = (hint = '') => setPlansHint(hint)
  const closePlans = () => setPlansHint(null)
  // Tras entrar con Google se muestran los planes una vez (solo si aún no hay suscripción)
  useEffect(() => {
    if (!session) return
    try {
      if (sessionStorage.getItem('gz_plans_after_login')) {
        sessionStorage.removeItem('gz_plans_after_login')
        if (access.onTrial) setPlansHint('')
      }
    } catch { /* ignore */ }
  }, [session?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const value = {
    access, plansHint, openPlans, closePlans,
    session, authReady, register, login, loginWithGoogle, logout,
    accounts, connectAccount, disconnectAccount, social,
    posts, savePost, deletePost, publishNow,
    draft, setDraft,
    toast, notify, storageFull,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
