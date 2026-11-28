import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { publishPost, cleanupPostMedia, handleOAuthCallback, onOAuthResult, fetchSocial, socialCall, mayBePublished, reconcilePost } from './social.js'
import { uid } from './formats.js'
import { t } from './i18n.jsx'
import { supabase, toSession } from './supabase.js'
import { deleteVideo, pushVideo, dropLocalVideo } from './mediaStore.js'
import { fetchPosts, fetchPostIndex, fetchPostsByIds, upsertPosts, deletePosts, claimPost } from './cloud.js'
import { checkAccess, workspaceId } from './workspace.js'
import { accessOf } from './plans.js'
import { cleanupContent, markContentPublished } from './content.js'
import { readPostCache, writePostCache } from './postCache.js'
import { fillNumbers, maxNum } from './postNumbers.js'
import { sendAlert, syncPush } from './push.js'

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
  const versionsRef = useRef({}) // id -> versión (updated_at) de lo que ya tenemos
  const socialReady = useRef(false) // las redes conectadas ya se cargaron
  const claiming = useRef(new Set()) // publicaciones que este navegador está publicando
  // La app es privada: 'checking' | 'ok' | 'denied' | 'error'
  const [memberState, setMemberState] = useState({ key: null, status: 'checking' })
  const [accessTry, setAccessTry] = useState(0)
  const member = memberState.key === key ? memberState.status : 'checking'
  useEffect(() => {
    if (!session) return
    setMemberState({ key, status: 'checking' })
    checkAccess()
      .then((r) => setMemberState({ key, status: r.ws ? 'ok' : 'denied' }))
      .catch(() => setMemberState({ key, status: 'error' }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, accessTry])

  // Cuentas reales (tokens en el servidor) + qué redes están configuradas
  const loadSocial = (forKey) => fetchSocial().then((r) => {
    if (!r || loadedFor.current !== forKey) return
    socialReady.current = true
    setSocial({ configured: r.configured || {}, ready: true })
    const real = Object.fromEntries((r.accounts || []).map((x) => [x.platform, {
      real: true, accountId: x.account_id, username: x.username || x.name || '', name: x.name, avatar: x.avatar,
      provider: x.extra?.provider, connectedAt: new Date(x.connected_at).getTime(),
    }]))
    setAccounts((a) => ({ ...Object.fromEntries(Object.entries(a).filter(([, v]) => !v.real)), ...real }))
  })

  useEffect(() => {
    cloudReady.current = false
    socialReady.current = false
    syncedRef.current = {}; versionsRef.current = {}
    if (!session || member !== 'ok') { loadedFor.current = null; return }
    setAccounts(read(`gz_accounts_${key}`, {}))
    let off = false
    readPostCache(key).then((local) => {
    if (off) return
    setPosts(local)
    loadedFor.current = key
    // Publicaciones en Supabase. La primera vez en este navegador se fusionan con las locales (y se suben);
    // después, Supabase es la fuente de verdad.
    fetchPosts().then((rows) => {
      if (loadedFor.current !== key) return
      const remote = rows.map((r) => r.post)
      const ids = new Set(remote.map((p) => p.id))
      const merged = read(`gz_cloud_${key}`, false) ? remote : [...remote, ...local.filter((p) => !ids.has(p.id))]
      syncedRef.current = Object.fromEntries(remote.map((p) => [p.id, JSON.stringify(p)]))
      versionsRef.current = Object.fromEntries(rows.map((r) => [r.post.id, r.version]))
      cloudReady.current = true
      write(`gz_cloud_${key}`, true)
      // Trabajo a medio editar de publicaciones ya publicadas: no sirve y ocupa espacio
      merged.filter((p) => p.status === 'published').forEach((p) => { try { localStorage.removeItem(`gz_wip_${key}_${p.id}`) } catch { /* ignore */ } })
      // Lo que este navegador está publicando solo está al día en memoria: se conserva al recargar la lista
      setPosts((cur) => {
        const busy = cur.filter((p) => claiming.current.has(p.id))
        const ids2 = new Set(busy.map((p) => p.id))
        return [...busy, ...merged.filter((p) => !ids2.has(p.id))]
      })
    }).catch(() => notify(t('No se pudo conectar con la nube; se usan los datos locales'), 'err'))
    loadSocial(key)
    })
    return () => { off = true }
    // Solo depende del usuario (key): antes dependía del objeto de sesión, que se recreaba en cada evento de Supabase
    // (volver a la pestaña, renovar token, guardar el perfil) y recargaba las publicaciones a mitad de una publicación.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, member])

  // Trae lo que cambió otra persona (cada 20 s con la pestaña visible, y al volver a ella)
  const refreshing = useRef(false)
  const refresh = useCallback(async () => {
    const forKey = loadedFor.current
    if (!cloudReady.current || refreshing.current) return
    refreshing.current = true
    try {
      const known = Object.keys(syncedRef.current) // lo guardado antes de consultar: lo creado mientras tanto no se toca
      const index = await fetchPostIndex()
      const changed = index.filter((r) => versionsRef.current[r.id] !== r.version).map((r) => r.id)
      const rows = changed.length ? await fetchPostsByIds(changed) : []
      if (loadedFor.current !== forKey || !cloudReady.current) return
      const alive = new Set(index.map((r) => r.id))
      const synced = syncedRef.current
      const local = new Map(postsRef.current.map((p) => [p.id, p]))
      // Un cambio local sin guardar manda sobre el remoto
      const dirty = (id) => claiming.current.has(id) || (local.has(id) ? synced[id] !== JSON.stringify(local.get(id)) : !!synced[id])
      const updates = new Map()
      for (const { post, version } of rows) {
        if (dirty(post.id)) continue
        if (post.mediaType === 'video' && local.has(post.id)) dropLocalVideo(post.id) // pudo cambiar el video
        synced[post.id] = JSON.stringify(post)
        versionsRef.current[post.id] = version
        updates.set(post.id, post)
      }
      const removed = new Set(known.filter((id) => !alive.has(id) && !claiming.current.has(id) && local.has(id) && !dirty(id)))
      removed.forEach((id) => { delete synced[id]; delete versionsRef.current[id] })
      if (!updates.size && !removed.size) return
      setPosts((cur) => {
        const have = new Set(cur.map((p) => p.id))
        const added = [...updates.values()].filter((p) => !have.has(p.id))
        return [...added, ...cur.filter((p) => !removed.has(p.id)).map((p) => updates.get(p.id) || p)]
      })
    } catch { /* se reintenta en la próxima vuelta */ } finally { refreshing.current = false }
  }, [])
  useEffect(() => {
    if (!session || member !== 'ok') return undefined
    const tick = () => { if (!document.hidden) refresh() }
    const back = () => { if (!document.hidden) { refresh(); loadSocial(key) } }
    const timer = setInterval(tick, 20000)
    document.addEventListener('visibilitychange', back)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', back) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, member, refresh])

  // Solo las cuentas demo se guardan en el navegador; las reales viven en el servidor
  useEffect(() => { if (loadedFor.current === key) write(`gz_accounts_${key}`, Object.fromEntries(Object.entries(accounts).filter(([, v]) => !v.real))) }, [accounts, key])
  useEffect(() => {
    if (loadedFor.current === key) writePostCache(key, posts).then((ok) => setStorageFull(!ok))
  }, [posts, key])

  // Número fijo de cada publicación: se recuerda el último entregado para no repetirlo si se borra la más nueva
  const lastNum = useRef(0)
  const numberFloor = () => Math.max(lastNum.current, read(`gz_postnum_${key}`, 0))
  const keepNumber = (n) => { if (n > numberFloor()) write(`gz_postnum_${key}`, n); lastNum.current = Math.max(lastNum.current, n) }
  useEffect(() => { lastNum.current = 0 }, [key])
  // Se numeran las que no tienen (las anteriores a la numeración). Solo con la lista de la nube ya cargada.
  useEffect(() => {
    if (!cloudReady.current) return
    // No se toca lo que se está publicando ni lo que está por salir: guardarlo ahora podría pisar esa reserva
    const busy = (p) => p.status === 'publishing' || claiming.current.has(p.id) || (p.status === 'scheduled' && p.scheduledAt < Date.now() + 120000)
    const next = fillNumbers(posts, numberFloor(), busy)
    if (next === posts) { keepNumber(maxNum(posts)); return }
    keepNumber(maxNum(next))
    const given = new Map(next.map((p) => [p.id, p.num]))
    setPosts((cur) => cur.map((p) => (given.get(p.id) && given.get(p.id) !== p.num ? { ...p, num: given.get(p.id) } : p)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts])

  // Guarda en Supabase lo que cambió (con una pequeña espera para agrupar cambios)
  useEffect(() => {
    if (!cloudReady.current || !session) return
    const h = setTimeout(async () => {
      const synced = syncedRef.current
      const stable = posts.filter((p) => p.status !== 'publishing' && !claiming.current.has(p.id)) // lo reservado no se pisa
      const up = stable.filter((p) => JSON.stringify(p) !== synced[p.id])
      const del = Object.keys(synced).filter((id) => !posts.some((p) => p.id === id))
      if (!up.length && !del.length) return
      try {
        const ws = await workspaceId()
        for (const p of up) if (p.mediaType === 'video' && p.status !== 'published') await pushVideo(p.id).catch(() => {})
        const versions = await upsertPosts(ws, up)
        await deletePosts(ws, del)
        up.forEach((p) => { syncedRef.current[p.id] = JSON.stringify(p) })
        Object.assign(versionsRef.current, versions)
        del.forEach((id) => { delete syncedRef.current[id]; delete versionsRef.current[id] })
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
    if (/database error saving new user|signup_disabled/i.test(m)) return new Error(t('Esta app es privada: ese correo no tiene acceso.'))
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

  useEffect(() => { if (session && member === 'ok') { cleanupPostMedia(); cleanupContent(); syncPush() } }, [session?.id, member]) // eslint-disable-line

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
  const me = session ? { name: session.name, email: session.email, picture: session.picture || null } : null
  // publishing = se guarda justo antes de «Publicar ahora», así que no cuenta como cancelación
  const savePost = (p0, { publishing = false } = {}) => {
    // Pasar una programada a borrador cancela la publicación
    if (!publishing && p0.status === 'draft' && postsRef.current.find((x) => x.id === p0.id)?.status === 'scheduled') sendAlert('cancelled', p0)
    const signed = p0.author || !me ? p0 : { ...p0, author: me } // quién creó la publicación
    // El editor arma la publicación de nuevo: el número se conserva de la guardada
    const num = signed.num || postsRef.current.find((x) => x.id === signed.id)?.num || Math.max(numberFloor(), maxNum(postsRef.current)) + 1
    keepNumber(num)
    const p = { ...signed, num }
    setPosts((list) => {
      const i = list.findIndex((x) => x.id === p.id)
      if (i >= 0) { const n = [...list]; n[i] = p; return n }
      return [p, ...list]
    })
    return p
  }
  const deletePost = (id) => {
    const gone = postsRef.current.find((p) => p.id === id)
    if (gone?.status === 'scheduled') sendAlert('cancelled', gone)
    deleteVideo(id); setPosts((l) => l.filter((p) => p.id !== id))
  }

  const postsRef = useRef(posts); postsRef.current = posts
  const accountsRef = useRef(accounts); accountsRef.current = accounts
  const meRef = useRef(me); meRef.current = me

  const publishNow = useCallback(async (id, { scheduled = false } = {}) => {
    const local = postsRef.current.find((p) => p.id === id)
    // Devuelve 'done' (se intentó publicar), 'taken' (ya la tiene otra sesión) o 'unreached' (no se pudo ni empezar)
    if (!local || claiming.current.has(id)) return 'taken'
    claiming.current.add(id)
    let post
    try {
      if (!scheduled && local.mediaType === 'video') await pushVideo(id).catch(() => {})
      post = await claimPost(id, scheduled ? null : local)
    } catch (e) {
      claiming.current.delete(id)
      setPosts((l) => [...l]) // vuelve a activar el guardado que se pausó durante la reserva
      if (!scheduled) notify(t('No se pudo publicar:') + ' ' + e.message, 'err')
      return 'unreached'
    }
    if (!post) { // ya la tomó o publicó la otra sesión, o cambió
      claiming.current.delete(id)
      if (!scheduled) notify(t('Esta publicación ya se está publicando o ya se publicó desde otra sesión.'), 'err')
      refresh()
      return 'taken'
    }
    syncedRef.current[id] = '' // obliga a guardar el resultado final
    setPosts((l) => l.map((p) => (p.id === id ? { ...post, status: 'publishing' } : p)))
    // La pantalla se mantiene encendida mientras se publica: si el teléfono se bloquea, se corta la conexión
    const awake = await navigator.wakeLock?.request('screen').catch(() => null)
    let results
    try {
      results = await publishPost(post, accountsRef.current, { onWaiting: () => notify(t('Se cortó la conexión: comprobando en el servidor si se publicó…')) })
    } catch (e) {
      // Un error inesperado no debe dejar la publicación "publicando…" para siempre
      results = Object.fromEntries((post.platforms || []).map((pl) => [pl, { ok: false, error: e?.message || String(e) }]))
    }
    awake?.release().catch(() => {})
    const allOk = Object.values(results).every((r) => r.ok)
    if (allOk && post.mediaType === 'video') deleteVideo(id) // ya publicado: no se guarda el video (ni en la nube ni local); queda solo la captura (post.image)
    setPosts((l) => l.map((p) => (p.id === id
      ? { ...p, status: allOk ? 'published' : 'failed', results, publishedAt: allOk ? Date.now() : p.publishedAt, publishedBy: allOk ? (meRef.current || p.publishedBy) : p.publishedBy }
      : p)))
    claiming.current.delete(id)
    sendAlert(allOk ? 'published' : 'failed', post, results)
    // Si usó un archivo de la sección Contenido y llegó a publicarse en alguna red, empieza su vigencia de 30 días
    if (post.contentId && Object.values(results).some((r) => r.ok && !r.demo)) markContentPublished(post.contentId).catch(() => {})
    const demo = Object.values(results).some((r) => r.demo)
    if (allOk) notify(demo ? t('Publicado (modo demo: simulado)') : t('¡Publicado con éxito!'))
    else notify(t('Falló:') + ' ' + Object.entries(results).filter(([, r]) => !r.ok).map(([k, r]) => `${k}: ${r.error}`).join(', '), 'err')
    return 'done'
  }, [notify, refresh])

  // Publicaciones que quedaron como fallidas o «publicando…» por un corte de conexión: se pregunta qué pasó de verdad.
  // Cada una se revisa una vez, y otra vez al volver a la app.
  const checked = useRef(new Set())
  const [checkRound, setCheckRound] = useState(0)
  useEffect(() => {
    const back = () => { if (!document.hidden) { checked.current.clear(); setCheckRound((n) => n + 1) } }
    document.addEventListener('visibilitychange', back)
    return () => document.removeEventListener('visibilitychange', back)
  }, [])
  useEffect(() => {
    if (!cloudReady.current || !session || member !== 'ok') return
    posts.filter((p) => mayBePublished(p) && !claiming.current.has(p.id) && !checked.current.has(p.id)).forEach(async (p) => {
      checked.current.add(p.id)
      const found = await reconcilePost(p).catch(() => null)
      const now = postsRef.current.find((x) => x.id === p.id)
      if (!found || !now || claiming.current.has(p.id) || now.status !== p.status) return
      if (!found.allOk && p.status === 'publishing') return // puede seguir publicándose en otro dispositivo
      setPosts((l) => l.map((x) => (x.id === p.id
        ? { ...x, results: found.results, ...(found.allOk ? { status: 'published', publishedAt: found.publishedAt, publishedBy: x.publishedBy || x.author } : {}) }
        : x)))
      if (!found.allOk) return
      if (p.mediaType === 'video') deleteVideo(p.id)
      if (p.contentId) markContentPublished(p.contentId).catch(() => {})
      sendAlert('published', p, found.results)
      notify(t('Confirmado: la publicación sí se publicó'))
    })
  }, [posts, checkRound, session, member, notify])

  // Programador: revisa cada 15 s las publicaciones cuyo momento ya llegó (mientras la app esté abierta)
  useEffect(() => {
    if (!session || member !== 'ok') return
    const t = setInterval(() => {
      if (!socialReady.current) { loadSocial(key); return } // sin las redes cargadas fallaría con «cuenta no conectada»: se reintenta
      postsRef.current
        .filter((p) => p.status === 'scheduled' && p.scheduledAt <= Date.now())
        .forEach((p) => publishNow(p.id, { scheduled: true }))
    }, 15000)
    return () => clearInterval(t)
  }, [session, member, publishNow])

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
    member, retryAccess: () => setAccessTry((n) => n + 1),
    session, authReady, register, login, loginWithGoogle, logout,
    accounts, connectAccount, disconnectAccount, social,
    posts, savePost, deletePost, publishNow,
    draft, setDraft,
    toast, notify, storageFull,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
