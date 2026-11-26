// Supabase Edge Function: genera textos para publicaciones con Gemini.
// La API key vive solo aquí, como secreto (GEMINI_API_KEY); nunca llega al navegador.
//
// Despliegue:
//   supabase secrets set GEMINI_API_KEY=tu_clave --project-ref bknwnurzxaxtkgnrriva
//   supabase functions deploy generate-caption --project-ref bknwnurzxaxtkgnrriva
//
// Por defecto exige un usuario con sesión iniciada (verify_jwt = true).

import { requirePlan } from '../_shared/plan.ts'
import { KNOWLEDGE, KNOWLEDGE_RULES } from '../_shared/knowledge.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Modelos gratuitos de mejor a peor calidad. Siempre se intenta primero el mejor; si su cupo diario se agota (429) o está saturado (503) pasa al siguiente.
// Cupo gratuito por modelo (AI Studio): los Flash normales dan 20 peticiones/día y los Flash Lite 500.
const MODELS = ['gemini-3.8-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']
// GEMINI_MODEL (opcional) fuerza un modelo concreto al principio de la lista
const MODEL = Deno.env.get('GEMINI_MODEL') || MODELS[0]
// Modelos que el cliente puede pedir (lista cerrada, para poder comparar velocidad y calidad)
const ALLOWED = MODELS

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ error: 'Falta configurar GEMINI_API_KEY en el servidor' }, 500)

  // GET: lista los modelos disponibles (solo nombres) para elegir uno rápido. No expone la key.
  if (req.method === 'GET') {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } })
    const d = await r.json().catch(() => ({}))
    const names = (d.models || [])
      .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes('generateContent'))
      .map((m: { name: string }) => m.name.replace('models/', ''))
    return json({ current: MODEL, models: names })
  }
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const denied = requirePlan(req, 1)
  if (denied) return json({ error: denied }, 403)

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

  const topic = String(b.topic || '').slice(0, 300)
  const tone = String(b.tone || 'profesional')
  const lang = b.lang === 'en' ? 'inglés' : 'español'
  const networks = Array.isArray(b.networks) ? (b.networks as string[]).slice(0, 8).join(', ') : ''
  const maxLen = Math.max(50, Math.min(Number(b.maxLen) || 2200, 4000))
  const maxTags = Math.max(0, Math.min(Number(b.maxTags) || 10, 15))
  const frames = (Array.isArray(b.frames) ? b.frames : []).filter((f): f is string => typeof f === 'string').slice(0, 8)
  const mediaType = b.mediaType === 'video' ? (frames.length ? 'video (se te dan fotogramas en orden cronológico)' : 'video (se te da la portada)') : 'foto o diseño'
  const image = typeof b.image === 'string' ? b.image : ''
  // Ficha: título, descripción y tags por separado (en vez de un solo texto)
  const sheet = b.structured === true
  const tagCount = Math.min(maxTags, 8)

  const instructions = [
    `Eres el community manager de Global Zion, una agencia chilena de diseño y desarrollo web.`,
    KNOWLEDGE,
    KNOWLEDGE_RULES,
    sheet ? `Prepara la ficha de una publicación en ${lang}: título, descripción y tags.` : `Escribe el texto (caption) de una publicación en ${lang}.`,
    `Tono: ${tone}. Tipo de contenido: ${mediaType}. Redes: ${networks || 'redes sociales'}.`,
    topic ? `Tema indicado por el usuario: "${topic}".` : `El usuario no indicó tema: básate en lo que muestra la imagen.`,
    frames.length ? `Se adjuntan ${frames.length} fotogramas del video en orden cronológico: deduce de qué trata y qué ocurre, y conecta el texto con eso; no inventes datos, nombres ni sonido que no puedas ver.` : '',
    image ? `Se adjunta la imagen de la publicación: descríbela con naturalidad y conecta el texto con lo que se ve; no inventes datos que no aparezcan.` : '',
    sheet ? `Lee los textos que aparezcan escritos en el contenido (titulares, precios, servicio ofrecido) y respétalos tal cual.` : '',
    sheet ? `«title»: un gancho claro de máximo 70 caracteres, con uno o dos emojis que encajen con el tema y sin hashtags.` : '',
    sheet ? `«description»: no repitas el título; usa saltos de línea y cierra con una llamada a la acción. Sin hashtags.` : '',
    sheet ? (tagCount > 0 ? `«tags»: hasta ${tagCount} hashtags relevantes, sin espacios dentro de cada uno.` : '«tags»: lista vacía.') : '',
    sheet ? `Entre título, descripción y tags no superes ${Math.max(40, maxLen - 40)} caracteres.` : `Reglas: máximo ${Math.max(40, maxLen - 30)} caracteres en total (incluyendo hashtags y espacios; no te pases). Empieza con un gancho que llame la atención.`,
    sheet ? '' : `Usa saltos de línea para facilitar la lectura y cierra con una llamada a la acción.`,
    // Regla fija del negocio: los textos siempre llevan emojis
    `Incluye SIEMPRE emojis que correspondan a lo que dice cada frase (por ejemplo 💻 para computadores, 🔒 para seguridad, 🛒 para tiendas online): en cada párrafo o punto de lista pon al menos uno que encaje, sin amontonar varios seguidos. Los hashtags van sin emojis.`,
    sheet ? '' : maxTags > 0 ? `Termina con hasta ${Math.min(maxTags, 8)} hashtags relevantes.` : 'No uses hashtags.',
    `No uses comillas alrededor del texto ni expliques lo que hiciste. Devuelve únicamente el JSON pedido.`,
  ].filter(Boolean).join('\n')

  const parts: unknown[] = [{ text: instructions }]
  const m = image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
  if (m && m[2].length < 4_000_000) parts.push({ inline_data: { mime_type: m[1], data: m[2] } })
  for (const f of frames) {
    const fm = f.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
    if (fm && fm[2].length < 1_500_000) parts.push({ inline_data: { mime_type: fm[1], data: fm[2] } })
  }

  const model = ALLOWED.includes(String(b.model)) ? String(b.model) : MODEL
  const call = (thinking: boolean, model: string) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    // Un modelo saturado a veces no contesta nada: se corta y se prueba el siguiente (el total queda bajo los 150 s de Supabase)
    signal: AbortSignal.timeout(model.includes('lite') ? 40000 : 20000),
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0.9,
        // Un caption corto no necesita razonar mucho: el nivel mínimo baja la espera de ~90 s a pocos segundos.
        ...(thinking ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}),
        responseMimeType: 'application/json',
        responseSchema: sheet
          ? { type: 'OBJECT', properties: { title: { type: 'STRING' }, description: { type: 'STRING' }, tags: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['title', 'description', 'tags'] }
          : { type: 'OBJECT', properties: { caption: { type: 'STRING' } }, required: ['caption'] },
      },
    }),
  })
  // La cuota gratuita es por modelo: si uno está agotado (429) o saturado (503), prueba los demás antes de rendirse.
  const order = [model, ...ALLOWED.filter((x) => x !== model)]
  let res!: Response
  for (const m of order) {
    try {
      res = await call(true, m)
      if (res.status === 400) res = await call(false, m) // por si el modelo no admite ese ajuste
    } catch (e) {
      console.warn('Gemini sin respuesta con', m, (e as Error).name, '→ probando otro modelo')
      res = new Response(JSON.stringify({ error: { message: 'Gemini no respondió a tiempo. Intenta de nuevo en un minuto.' } }), { status: 503 })
      continue
    }
    if (res.status !== 429 && res.status !== 503) break
    console.warn('Gemini', res.status, 'con', m, '→ probando otro modelo')
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('Gemini error', res.status, detail.slice(0, 500))
    let why = ''
    try { why = JSON.parse(detail)?.error?.message || '' } catch { /* ignore */ }
    return json({ error: res.status === 429 ? 'Se alcanzó el límite de uso de Gemini. Intenta en un minuto.' : `Gemini respondió ${res.status}: ${why.slice(0, 200) || 'sin detalle'}` }, 502)
  }

  const data = await res.json()
  const raw = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || ''
  if (sheet) {
    let out: { title?: unknown; description?: unknown; tags?: unknown } = {}
    try { out = JSON.parse(raw) } catch { /* se informa abajo */ }
    const title = String(out.title || '').trim()
    const description = String(out.description || '').trim()
    const tags = (Array.isArray(out.tags) ? out.tags : []).map((x) => String(x).trim()).filter(Boolean).slice(0, tagCount)
    if (!title && !description) return json({ error: 'Gemini no devolvió texto (puede haber bloqueado el contenido)' }, 502)
    return json({ title, description, tags })
  }
  let caption = ''
  try { caption = JSON.parse(raw).caption } catch { caption = raw }
  caption = String(caption || '').trim()
  if (!caption) return json({ error: 'Gemini no devolvió texto (puede haber bloqueado el contenido)' }, 502)
  if (caption.length > maxLen) {
    // Corta en la última palabra completa para no dejar un hashtag a medias
    const cut = caption.slice(0, maxLen).replace(/\s+\S*$/, '').trimEnd()
    caption = cut || caption.slice(0, maxLen)
  }
  return json({ caption })
})
