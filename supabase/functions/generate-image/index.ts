// Supabase Edge Function: genera (o edita) imágenes con Gemini ("Nano Banana").
// La API key vive solo aquí, como secreto (GEMINI_API_KEY, el mismo que usa generate-caption).
//
// Despliegue:
//   supabase functions deploy generate-image --project-ref bknwnurzxaxtkgnrriva
//
// Proveedor (secreto IMAGE_PROVIDER):
//   cloudflare                 -> Cloudflare Workers AI (FLUX.1 schnell). Requiere los secretos CF_ACCOUNT_ID y CF_API_TOKEN
//                                 (token con permiso "Workers AI"). Tiene capa gratuita diaria. Solo texto a imagen.
//   pollinations (por defecto) -> gratis y sin clave, solo texto a imagen (hoy suele responder 402: pide créditos)
//   gemini                     -> requiere facturación en Google AI Studio; permite editar imágenes
//   cloudflare / auto          -> Cloudflare primero y, si falla o se acaba la cuota, Pollinations (nunca Gemini)
// Opcional: GEMINI_IMAGE_MODEL para fijar otro modelo de Gemini; CF_IMAGE_MODEL para otro modelo de Cloudflare.
//
// Cloudflare:
//   supabase secrets set CF_ACCOUNT_ID=tu_account_id CF_API_TOKEN=tu_token IMAGE_PROVIDER=cloudflare --project-ref bknwnurzxaxtkgnrriva
// Exige un usuario con sesión iniciada (verify_jwt = true). La generación de imágenes en la
// API de Gemini normalmente requiere facturación activada en Google AI Studio.

import { requirePlan } from '../_shared/plan.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Se prueban en orden hasta que uno responda (los nombres cambian con el tiempo)
const DEFAULTS = ['gemini-3.1-flash-image', 'gemini-3-pro-image', 'gemini-2.5-flash-image']
const MODELS = [Deno.env.get('GEMINI_IMAGE_MODEL'), ...DEFAULTS].filter((m, i, a): m is string => !!m && a.indexOf(m) === i)
const PROVIDER = (Deno.env.get('IMAGE_PROVIDER') || 'pollinations').toLowerCase()
const RATIOS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9']

const toBase64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

// Gratis y sin clave. Devuelve un dataURL o lanza un Error con un mensaje para el usuario.
async function pollinations(prompt: string, aspectRatio: string): Promise<string> {
  const [rw, rh] = aspectRatio.split(':').map(Number)
  const k = 1024 / Math.max(rw, rh)
  const w = Math.round((rw * k) / 16) * 16, h = Math.round((rh * k) / 16) * 16
  const full = `${prompt}. Sin texto ni letras en la imagen.`
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}?width=${w}&height=${h}&model=flux&nologo=true&enhance=false&seed=${Math.floor(Math.random() * 1e9)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(90_000) })
  const type = res.headers.get('content-type') || ''
  if (!res.ok || !type.startsWith('image/')) {
    console.error('Pollinations error', res.status, type)
    throw new Error(res.status === 429 ? 'El generador gratuito está saturado. Intenta de nuevo en unos segundos.' : `El generador gratuito respondió ${res.status}. Intenta de nuevo.`)
  }
  return `data:${type.split(';')[0]};base64,${toBase64(new Uint8Array(await res.arrayBuffer()))}`
}

// Cloudflare Workers AI: FLUX.1 schnell devuelve un JSON { result: { image: <base64 JPEG> } }. No admite tamaño: sale cuadrada.
const CF_ACCOUNT = Deno.env.get('CF_ACCOUNT_ID') || ''
const CF_TOKEN = Deno.env.get('CF_API_TOKEN') || ''
const CF_MODEL = Deno.env.get('CF_IMAGE_MODEL') || '@cf/black-forest-labs/flux-1-schnell'
async function cloudflare(prompt: string): Promise<string> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/ai/run/${CF_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt: `${prompt}. No text or letters in the image.`.slice(0, 2000), steps: 6 }),
    signal: AbortSignal.timeout(90_000),
  })
  const detail = await res.text().catch(() => '')
  if (!res.ok) {
    console.error('Cloudflare AI error', res.status, detail.slice(0, 500))
    let why = ''
    try { why = JSON.parse(detail)?.errors?.[0]?.message || '' } catch { /* ignore */ }
    throw new Error(res.status === 401 || res.status === 403
      ? 'Cloudflare rechazó el token (revisa CF_API_TOKEN: necesita el permiso "Workers AI" y el CF_ACCOUNT_ID correcto).'
      : res.status === 429 ? 'Se alcanzó el límite de Cloudflare Workers AI. Intenta más tarde.'
      : `Cloudflare respondió ${res.status}: ${why.slice(0, 200) || 'sin detalle'}`)
  }
  let b64 = ''
  try { b64 = JSON.parse(detail)?.result?.image || '' } catch { /* ignore */ }
  if (!b64) throw new Error('Cloudflare no devolvió una imagen. Prueba con otra descripción.')
  return `data:image/jpeg;base64,${b64}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const denied = requirePlan(req, 2)
  if (denied) return json({ error: denied }, 403)
  const key = Deno.env.get('GEMINI_API_KEY')

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

  const prompt = String(b.prompt || '').trim().slice(0, 1000)
  if (!prompt) return json({ error: 'Escribe una descripción de la imagen' }, 400)
  const aspectRatio = RATIOS.includes(String(b.aspectRatio)) ? String(b.aspectRatio) : '1:1'
  const image = typeof b.image === 'string' ? b.image : ''

  const free = async () => {
    try { return json({ image: await pollinations(prompt, aspectRatio), model: 'pollinations' }) }
    catch (e) { return json({ error: (e as Error).message }, 502) }
  }
  const cfReady = !!(CF_ACCOUNT && CF_TOKEN)
  // Imágenes: SIEMPRE Cloudflare Workers AI primero; si falla o se agota la cuota gratuita, pasa a Pollinations (Gemini no se usa para imágenes)
  if (PROVIDER === 'cloudflare' || PROVIDER === 'auto') {
    if (image) return json({ error: 'Editar una imagen existente no está disponible: Cloudflare y Pollinations solo crean imágenes nuevas.' }, 400)
    if (cfReady) {
      try { return json({ image: await cloudflare(prompt), model: 'cloudflare' }) }
      catch (e) { console.error('Cloudflare falló, se usa Pollinations:', (e as Error).message) }
    }
    return await free()
  }
  if (PROVIDER === 'pollinations') {
    if (image) return json({ error: 'Editar una imagen existente requiere Gemini (facturación activada). Con el generador gratuito solo puedes crear imágenes nuevas.' }, 400)
    return await free()
  }
  if (!key) return json({ error: 'Falta configurar GEMINI_API_KEY en el servidor' }, 500)

  const instruction = image
    ? `Edita la imagen adjunta según esta instrucción: ${prompt}`
    : `Genera una imagen para una publicación en redes sociales. Descripción: ${prompt}. Sin texto ni letras en la imagen, a menos que se pida expresamente.`
  const parts: unknown[] = [{ text: instruction }]
  const m = image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
  if (m && m[2].length < 6_000_000) parts.push({ inline_data: { mime_type: m[1], data: m[2] } })

  let lastStatus = 0
  let lastWhy = ''
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio } },
      }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('Gemini image error', model, res.status, detail.slice(0, 500))
      lastStatus = res.status
      try { lastWhy = JSON.parse(detail)?.error?.message || '' } catch { lastWhy = '' }
      // modelo inexistente, sin soporte o sin cuota (la cuota es por modelo): prueba el siguiente
      if (res.status === 404 || res.status === 400 || res.status === 429) continue
      break
    }
    const data = await res.json()
    const outParts = data?.candidates?.[0]?.content?.parts || []
    const img = outParts.find((p: { inlineData?: unknown; inline_data?: unknown }) => p.inlineData || p.inline_data)
    const d = img?.inlineData || img?.inline_data
    if (!d?.data) return json({ error: 'Gemini no devolvió una imagen (puede haber bloqueado el contenido). Prueba con otra descripción.' }, 502)
    return json({ image: `data:${d.mimeType || d.mime_type || 'image/png'};base64,${d.data}`, model })
  }

  if (PROVIDER === 'auto' && !image) return await free()
  const msg = lastStatus === 429
    ? `Límite o cuota de Gemini agotada (${lastWhy.slice(0, 220) || 'sin detalle'}). Si dice "limit: 0", la clave no tiene cuota para imágenes: activa la facturación en Google AI Studio.`
    : lastStatus === 403
      ? 'Gemini no permite generar imágenes con esta clave (revisa que la facturación esté activada en Google AI Studio).'
      : `Gemini respondió ${lastStatus}: ${lastWhy.slice(0, 200) || 'sin detalle'}`
  return json({ error: msg }, 502)
})
