// Supabase Edge Function: segundo almacenamiento de la sección Contenido en Backblaze B2 (bucket privado).
// La clave vive solo aquí; el navegador recibe enlaces temporales para subir y ver sus archivos.
//
// Secretos: B2_KEY_ID y B2_APP_KEY (clave limitada al bucket, con lectura y escritura).
// Opcionales: B2_BUCKET y B2_ENDPOINT si se cambia de bucket.
//   supabase functions deploy b2-storage --project-ref bknwnurzxaxtkgnrriva
import { createClient } from 'npm:@supabase/supabase-js@2'
import { AwsClient } from 'npm:aws4fetch@1.0.20'

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

const env = (k: string) => Deno.env.get(k) || ''
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'))

const KEY_ID = env('B2_KEY_ID').trim()
const APP_KEY = env('B2_APP_KEY').trim()
const BUCKET = env('B2_BUCKET') || 'globalzion-contenido'
const ENDPOINT = env('B2_ENDPOINT') || 's3.us-east-005.backblazeb2.com'
const LIMIT = 10 * 1024 ** 3 // 10 GB gratis
const STOP = 9.5 * 1024 ** 3 // se deja de subir antes, para no llegar a pagar
const MAX_FILE = 50 * 1024 ** 2 // igual que CONTENT_MAX_MB en src/lib/content.js
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm']

const aws = new AwsClient({ accessKeyId: KEY_ID, secretAccessKey: APP_KEY, service: 's3', region: ENDPOINT.split('.')[1] })
const objectUrl = (path: string) => new URL(`https://${ENDPOINT}/${BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`)

async function presign(url: URL, method: string, headers: Record<string, string> = {}) {
  url.searchParams.set('X-Amz-Expires', '3600')
  const signed = await aws.sign(url.toString(), { method, headers, aws: { signQuery: true, allHeaders: true } })
  return signed.url
}

// Bytes guardados ahora mismo en el bucket.
async function usedBytes() {
  let total = 0
  let token = ''
  do {
    const url = new URL(`https://${ENDPOINT}/${BUCKET}`)
    url.searchParams.set('list-type', '2')
    if (token) url.searchParams.set('continuation-token', token)
    const r = await aws.fetch(url.toString())
    const xml = await r.text()
    if (!r.ok) throw new HttpError(502, `Backblaze: ${xml.match(/<Message>([^<]*)</)?.[1] || r.status}`)
    for (const m of xml.matchAll(/<Size>(\d+)<\/Size>/g)) total += Number(m[1])
    token = xml.match(/<NextContinuationToken>([^<]+)</)?.[1] || ''
  } while (token)
  return total
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const jwt = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const { data: u, error: ue } = await admin.auth.getUser(jwt)
    if (ue || !u.user) throw new HttpError(401, 'Inicia sesión para continuar')
    const { data: ws, error: we } = await admin.rpc('member_workspace', { p_user: u.user.id })
    if (we) throw new HttpError(500, we.message)
    if (!ws) throw new HttpError(403, 'Esta app es privada: tu cuenta no tiene acceso.')
    const b = await req.json().catch(() => ({}))
    const configured = Boolean(KEY_ID && APP_KEY)

    if (b.action === 'status') {
      if (!configured) return json({ configured: false })
      return json({ configured: true, used: await usedBytes(), limit: LIMIT, stop: STOP })
    }
    if (!configured) throw new HttpError(400, 'Backblaze todavía no está configurado en el servidor')

    // Cada quien solo toca la carpeta del espacio compartido
    const own = (p: unknown) => {
      const path = String(p || '')
      if (!path.startsWith(`${ws}/`) || path.split('/').some((s) => !s || s === '.' || s === '..')) throw new HttpError(403, 'Archivo no permitido')
      return path
    }

    if (b.action === 'upload-url') {
      const path = own(b.path)
      const size = Number(b.size)
      if (!TYPES.includes(b.mime)) throw new HttpError(400, 'Formato no admitido')
      if (!Number.isInteger(size) || size <= 0 || size > MAX_FILE) throw new HttpError(400, 'El archivo supera el máximo permitido')
      if ((await usedBytes()) + size > STOP) return json({ full: true })
      // El tamaño y el tipo van firmados: el enlace no sirve para subir otra cosa
      return json({ url: await presign(objectUrl(path), 'PUT', { 'content-type': b.mime, 'content-length': String(size) }) })
    }
    if (b.action === 'download-url') {
      const url = objectUrl(own(b.path))
      if (b.name) url.searchParams.set('response-content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(String(b.name)).replace(/['()*]/g, (c) => '%' + c.charCodeAt(0).toString(16))}`)
      return json({ url: await presign(url, 'GET') })
    }
    if (b.action === 'delete') {
      const paths = (Array.isArray(b.paths) ? b.paths.slice(0, 100) : []).map(own)
      for (const path of paths) {
        const r = await aws.fetch(objectUrl(path).toString(), { method: 'DELETE' })
        if (!r.ok && r.status !== 404) throw new HttpError(502, `Backblaze no pudo borrar un archivo (${r.status})`)
      }
      return json({ ok: true })
    }
    throw new HttpError(400, 'Acción desconocida')
  } catch (e) {
    const s = e instanceof HttpError ? e.status : 500
    return json({ error: (e as Error).message || 'Error' }, s)
  }
})
