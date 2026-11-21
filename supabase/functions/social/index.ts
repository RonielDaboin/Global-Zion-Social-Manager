// Supabase Edge Function: conexión OAuth y publicación en Instagram, Facebook y Gmail.
// Los tokens viven solo en la tabla social_accounts (sin acceso desde el navegador).
//
// Secretos necesarios (solo las redes que quieras activar):
//   supabase secrets set META_APP_ID=... META_APP_SECRET=...            # Instagram + Facebook
//   supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=...  # Gmail
//   supabase functions deploy social --project-ref bknwnurzxaxtkgnrriva
import { createClient } from 'npm:@supabase/supabase-js@2'
import { planOfUser, trialExpired, PLATFORMS_BY_PLAN, MAX_ACCOUNTS } from '../_shared/plan.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
class HttpError extends Error {
  status: number
  constructor(status: number, m: string) { super(m); this.status = status }
}

const GRAPH = 'https://graph.facebook.com/v21.0'
const env = (k: string) => Deno.env.get(k) || ''
const META = { id: env('META_APP_ID'), secret: env('META_APP_SECRET') }
// ID de la configuración de Facebook Login for Business (no es secreto)
const META_CONFIG_ID = env('META_CONFIG_ID') || '1127819070150160'
const GOOGLE = { id: env('GOOGLE_CLIENT_ID'), secret: env('GOOGLE_CLIENT_SECRET') }
const configured = {
  instagram: Boolean(META.id && META.secret),
  facebook: Boolean(META.id && META.secret),
  email: Boolean(GOOGLE.id && GOOGLE.secret),
}
const SCOPES: Record<string, string> = {
  facebook: 'pages_show_list,pages_manage_posts,pages_read_engagement',
  instagram: 'pages_show_list,pages_read_engagement,instagram_basic,instagram_content_publish',
}

const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))
const SECRET = env('STATE_SECRET') || env('SUPABASE_SERVICE_ROLE_KEY')

// ---- state firmado (liga el OAuth a un usuario y evita CSRF) ----
const b64u = (b: ArrayBuffer | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b)
  let s = ''
  for (const x of bytes) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
async function sign(data: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64u(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)))
}
async function makeState(platform: string, uid: string) {
  const payload = b64u(JSON.stringify({ u: uid, p: platform, e: Date.now() + 15 * 60_000, n: crypto.randomUUID() }))
  return `${platform}:${payload}.${await sign(payload)}`
}
async function readState(state: string, uid: string) {
  const rest = state.slice(state.indexOf(':') + 1)
  const [payload, sig] = rest.split('.')
  if (!payload || sig !== await sign(payload)) throw new HttpError(400, 'Estado OAuth inválido')
  const d = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  if (d.u !== uid || d.e < Date.now()) throw new HttpError(400, 'La autorización expiró, inténtalo de nuevo')
  return d.p as string
}

const getJson = async (url: string, init?: RequestInit) => {
  const r = await fetch(url, init)
  const d = await r.json().catch(() => ({}))
  if (!r.ok || d.error) {
    throw new HttpError(502, d.error?.message || d.error_description || (typeof d.error === 'string' ? d.error : '') || `Error ${r.status}`)
  }
  return d
}
const qs = (o: Record<string, string>) => new URLSearchParams(o).toString()
const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' }

// ---- OAuth: URL de autorización ----
function authUrl(platform: string, redirectUri: string, state: string) {
  if (!configured[platform as keyof typeof configured]) throw new HttpError(400, 'Esta red aún no está configurada en el servidor')
  if (platform === 'email') {
    return 'https://accounts.google.com/o/oauth2/v2/auth?' + qs({
      client_id: GOOGLE.id, redirect_uri: redirectUri, response_type: 'code', state,
      scope: 'openid email profile https://www.googleapis.com/auth/gmail.send',
      access_type: 'offline', prompt: 'consent select_account',
    })
  }
  // Facebook Login for Business: usa una "configuración" (config_id) en lugar de scope.
  if (META_CONFIG_ID) {
    return 'https://www.facebook.com/v21.0/dialog/oauth?' + qs({
      client_id: META.id, redirect_uri: redirectUri, response_type: 'code', state,
      config_id: META_CONFIG_ID, override_default_response_type: 'true',
    })
  }
  return 'https://www.facebook.com/v21.0/dialog/oauth?' + qs({ client_id: META.id, redirect_uri: redirectUri, response_type: 'code', state, scope: SCOPES[platform] })
}

// ---- OAuth: canje del código y guardado de la cuenta ----
async function save(uid: string, platform: string, row: Record<string, unknown>) {
  const { error } = await admin.from('social_accounts').upsert({ user_id: uid, platform, ...row, connected_at: new Date().toISOString() })
  if (error) throw new HttpError(500, error.message)
}

async function connectMeta(uid: string, platform: string, code: string, redirectUri: string) {
  const short = await getJson(`${GRAPH}/oauth/access_token?` + qs({ client_id: META.id, client_secret: META.secret, redirect_uri: redirectUri, code }))
  const long = await getJson(`${GRAPH}/oauth/access_token?` + qs({ grant_type: 'fb_exchange_token', client_id: META.id, client_secret: META.secret, fb_exchange_token: short.access_token }))
  const pages = await getJson(`${GRAPH}/me/accounts?` + qs({
    fields: 'id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}',
    access_token: long.access_token,
  }))
  let list = pages.data || []
  if (!list.length) {
    // /me/accounts puede venir vacío con Páginas de un portfolio: se leen las que el usuario autorizó (granular scopes).
    const dbg = await getJson(`${GRAPH}/debug_token?` + qs({ input_token: long.access_token, access_token: `${META.id}|${META.secret}` })).catch(() => ({ data: {} }))
    const ids = new Set<string>()
    for (const g of dbg.data?.granular_scopes || []) {
      if (/^(pages_|instagram_)/.test(g.scope)) for (const t of g.target_ids || []) ids.add(String(t))
    }
    const fields = 'id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}'
    for (const id of ids) {
      const p = await getJson(`${GRAPH}/${id}?` + qs({ fields, access_token: long.access_token })).catch(() => null)
      if (p?.access_token) list.push(p)
    }
  }
  if (!list.length) {
    // Páginas propiedad de un portfolio (requiere business_management): /me/businesses -> owned_pages / client_pages
    const fields = 'id,name,access_token,picture{url},instagram_business_account{id,username,name,profile_picture_url}'
    const biz = await getJson(`${GRAPH}/me/businesses?` + qs({ fields: 'id', access_token: long.access_token })).catch(() => ({ data: [] }))
    const seen = new Set<string>()
    for (const b of biz.data || []) {
      for (const edge of ['owned_pages', 'client_pages']) {
        const r = await getJson(`${GRAPH}/${b.id}/${edge}?` + qs({ fields: 'id', access_token: long.access_token })).catch(() => ({ data: [] }))
        for (const pg of r.data || []) {
          if (seen.has(pg.id)) continue
          seen.add(pg.id)
          const p = await getJson(`${GRAPH}/${pg.id}?` + qs({ fields, access_token: long.access_token })).catch(() => null)
          if (p?.access_token) list.push(p)
        }
      }
    }
  }
  if (!list.length) {
    throw new HttpError(400, 'No se encontró ninguna página de Facebook administrada por esta cuenta. Inicia sesión con la cuenta que administra la Página y, en el diálogo de Meta, concédele acceso a «Global Zion».')
  }
  if (platform === 'facebook') {
    const p = list[0]
    const avatar = p.picture?.data?.url || null
    await save(uid, 'facebook', { account_id: p.id, username: p.name, name: p.name, avatar, access_token: p.access_token, extra: { pageId: p.id } })
    return { username: p.name, name: p.name, avatar }
  }
  const p = list.find((x: { instagram_business_account?: unknown }) => x.instagram_business_account)
  if (!p) throw new HttpError(400, 'Ninguna de tus páginas tiene una cuenta profesional de Instagram vinculada')
  const ig = p.instagram_business_account
  const username = ig.username || ig.name
  await save(uid, 'instagram', { account_id: ig.id, username, name: ig.name || username, avatar: ig.profile_picture_url || null, access_token: p.access_token, extra: { pageId: p.id } })
  return { username, name: ig.name || username, avatar: ig.profile_picture_url || null }
}

async function connectGoogle(uid: string, code: string, redirectUri: string) {
  const tok = await getJson('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: FORM,
    body: qs({ code, client_id: GOOGLE.id, client_secret: GOOGLE.secret, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  })
  if (!tok.refresh_token) throw new HttpError(400, 'Google no devolvió permiso de envío; vuelve a autorizar')
  const me = await getJson('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${tok.access_token}` } })
  await save(uid, 'email', {
    account_id: me.email, username: me.email, name: me.name || me.email, avatar: me.picture || null,
    access_token: tok.access_token, refresh_token: tok.refresh_token,
    expires_at: new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString(), extra: { provider: 'gmail' },
  })
  return { username: me.email, name: me.name || me.email, avatar: me.picture || null, provider: 'gmail' }
}

// ---- Publicación ----
type Acc = { account_id: string; access_token: string; refresh_token: string | null; expires_at: string | null; extra: Record<string, string> }
type Job = { caption?: string; imageUrl?: string; videoUrl?: string; mediaType?: string; subject?: string; recipients?: string; format?: string }

async function publishInstagram(a: Acc, j: Job) {
  const ig = a.account_id, tk = a.access_token
  const isVideo = j.mediaType === 'video' && j.videoUrl
  if (!isVideo && !j.imageUrl) throw new HttpError(400, 'Instagram necesita una imagen o un video')
  const body: Record<string, string> = { access_token: tk }
  if (isVideo) {
    body.video_url = j.videoUrl!
    body.media_type = j.format === 'ig-story' ? 'STORIES' : 'REELS'
    if (j.caption) body.caption = j.caption
  } else {
    body.image_url = j.imageUrl!
    if (j.format === 'ig-story') body.media_type = 'STORIES'
    else if (j.caption) body.caption = j.caption
  }
  const c = await getJson(`${GRAPH}/${ig}/media`, { method: 'POST', headers: FORM, body: qs(body) })
  for (let i = 0; i < 40; i++) { // espera a que Instagram procese el medio
    const s = await getJson(`${GRAPH}/${c.id}?` + qs({ fields: 'status_code', access_token: tk }))
    if (s.status_code === 'FINISHED') break
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new HttpError(502, 'Instagram no pudo procesar el archivo')
    await new Promise((r) => setTimeout(r, 3000))
  }
  const p = await getJson(`${GRAPH}/${ig}/media_publish`, { method: 'POST', headers: FORM, body: qs({ creation_id: c.id, access_token: tk }) })
  let permalink: string | undefined
  try { permalink = (await getJson(`${GRAPH}/${p.id}?` + qs({ fields: 'permalink', access_token: tk }))).permalink } catch { /* opcional */ }
  return { id: p.id, permalink }
}

async function publishFacebook(a: Acc, j: Job) {
  const page = a.account_id, tk = a.access_token
  const post = (path: string, o: Record<string, string>) =>
    getJson(`${GRAPH}/${page}/${path}`, { method: 'POST', headers: FORM, body: qs({ ...o, access_token: tk }) })
  if (j.mediaType === 'video' && j.videoUrl) return post('videos', { file_url: j.videoUrl, description: j.caption || '' })
  if (j.imageUrl) return post('photos', { url: j.imageUrl, caption: j.caption || '', published: 'true' })
  if (!j.caption) throw new HttpError(400, 'La publicación está vacía')
  return post('feed', { message: j.caption })
}

async function gmailToken(uid: string, a: Acc) {
  if (a.expires_at && new Date(a.expires_at).getTime() > Date.now()) return a.access_token
  if (!a.refresh_token) throw new HttpError(401, 'Reconecta tu cuenta de Gmail')
  const t = await getJson('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: FORM,
    body: qs({ client_id: GOOGLE.id, client_secret: GOOGLE.secret, refresh_token: a.refresh_token, grant_type: 'refresh_token' }),
  })
  await admin.from('social_accounts')
    .update({ access_token: t.access_token, expires_at: new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString() })
    .eq('user_id', uid).eq('platform', 'email')
  return t.access_token as string
}

const ENT: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ENT[c])
const b64 = (s: string) => {
  let o = ''
  for (const x of new TextEncoder().encode(s)) o += String.fromCharCode(x)
  return btoa(o)
}
const wrap76 = (s: string) => s.replace(/(.{76})/g, '$1\r\n')

async function publishEmail(uid: string, a: Acc, j: Job) {
  const to = (j.recipients || '').split(/[,;\s]+/).filter((x) => /^\S+@\S+\.\S+$/.test(x))
  if (!to.length) throw new HttpError(400, 'Indica al menos un destinatario con correo válido')
  const img = j.imageUrl ? `<img src="${esc(j.imageUrl)}" alt="" style="width:100%;border-radius:8px;margin-bottom:16px">` : ''
  const html = `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">${img}<p style="font-size:15px;line-height:1.6">${esc(j.caption || '').replace(/\n/g, '<br>')}</p></div>`
  const mime = [
    `From: ${a.account_id}`, `To: ${to.join(', ')}`,
    `Subject: =?UTF-8?B?${b64(j.subject || 'Global Zion')}?=`,
    'MIME-Version: 1.0', 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap76(b64(html)),
  ].join('\r\n')
  const token = await gmailToken(uid, a)
  return getJson('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ raw: b64u(mime) }),
  })
}

// ---- Servidor ----
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: u, error: ue } = await admin.auth.getUser(jwt)
    if (ue || !u.user) throw new HttpError(401, 'Inicia sesión para continuar')
    const uid = u.user.id
    const b = await req.json().catch(() => ({}))
    const platform = String(b.platform || '')
    // Reglas del plan (app_metadata.plan): redes permitidas y número de cuentas conectadas
    const plan = planOfUser(u.user.email, u.user.app_metadata?.plan)
    if ((b.action === 'auth-url' || b.action === 'publish') && trialExpired(u.user)) {
      throw new HttpError(402, 'Tu prueba gratuita de 15 días terminó. Suscríbete a un plan para seguir publicando.')
    }
    if ((b.action === 'auth-url' || b.action === 'publish') && !PLATFORMS_BY_PLAN[plan].includes(platform)) {
      throw new HttpError(403, 'Esta red no está incluida en tu plan. Sube de plan para usarla.')
    }

    if (b.action === 'list') {
      const { data } = await admin.from('social_accounts').select('platform,account_id,username,name,avatar,connected_at,extra').eq('user_id', uid)
      return json({ configured, accounts: data || [] })
    }
    if (b.action === 'auth-url') {
      const { data: mine } = await admin.from('social_accounts').select('platform').eq('user_id', uid)
      if (!(mine || []).some((m: { platform: string }) => m.platform === platform) && (mine || []).length >= MAX_ACCOUNTS[plan]) {
        throw new HttpError(403, `Tu plan permite hasta ${MAX_ACCOUNTS[plan]} cuentas conectadas. Desconecta una o sube de plan.`)
      }
      const state = await makeState(platform, uid)
      return json({ url: authUrl(platform, String(b.redirectUri), state), state })
    }
    if (b.action === 'callback') {
      const p = await readState(String(b.state), uid)
      const info = p === 'email' ? await connectGoogle(uid, String(b.code), String(b.redirectUri)) : await connectMeta(uid, p, String(b.code), String(b.redirectUri))
      return json({ platform: p, ...info })
    }
    if (b.action === 'disconnect') {
      await admin.from('social_accounts').delete().eq('user_id', uid).eq('platform', platform)
      return json({ ok: true })
    }
    if (b.action === 'permalink') { // enlace directo a una publicación de Instagram (por id o, si no hay, buscándola)
      const { data: a } = await admin.from('social_accounts').select('account_id,access_token').eq('user_id', uid).eq('platform', 'instagram').maybeSingle()
      if (!a) throw new HttpError(400, 'Cuenta no conectada')
      if (b.mediaId) {
        const m = await getJson(`${GRAPH}/${b.mediaId}?` + qs({ fields: 'permalink', access_token: a.access_token }))
        return json({ permalink: m.permalink || null })
      }
      const l = await getJson(`${GRAPH}/${a.account_id}/media?` + qs({ fields: 'permalink,caption,timestamp', limit: '50', access_token: a.access_token }))
      const cap = String(b.caption || '').trim(), t0 = Number(b.publishedAt) || 0
      const items = (l.data || []) as { permalink: string; caption?: string; timestamp: string }[]
      const same = items.filter((m) => (m.caption || '').trim() === cap)
      const pool = same.length ? same : items
      pool.sort((x, y) => Math.abs(new Date(x.timestamp).getTime() - t0) - Math.abs(new Date(y.timestamp).getTime() - t0))
      return json({ permalink: pool[0]?.permalink || null })
    }
    if (b.action === 'publish') {
      const { data: a } = await admin.from('social_accounts').select('*').eq('user_id', uid).eq('platform', platform).maybeSingle()
      if (!a) throw new HttpError(400, 'Cuenta no conectada')
      let out
      if (platform === 'instagram') out = await publishInstagram(a, b)
      else if (platform === 'facebook') out = await publishFacebook(a, b)
      else if (platform === 'email') out = await publishEmail(uid, a, b)
      else throw new HttpError(400, 'Red no soportada')
      return json({ ok: true, result: out })
    }
    throw new HttpError(400, 'Acción desconocida')
  } catch (e) {
    const s = e instanceof HttpError ? e.status : 500
    return json({ error: (e as Error).message || 'Error' }, s)
  }
})
