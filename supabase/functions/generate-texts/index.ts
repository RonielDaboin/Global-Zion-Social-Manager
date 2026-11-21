// Supabase Edge Function: escribe los textos de un diseño (título, mensaje principal, etc.) con Gemini.
// Recibe las capas de texto activas del diseño y devuelve un texto por cada una, en el mismo orden.
// La API key vive solo aquí, como secreto (GEMINI_API_KEY).
//
// Despliegue:
//   supabase functions deploy generate-texts --project-ref bknwnurzxaxtkgnrriva
// (usa el mismo secreto GEMINI_API_KEY que generate-caption)

import { requirePlan } from '../_shared/plan.ts'

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
const ORDER = [MODEL, ...MODELS.filter((x) => x !== MODEL)]

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const denied = requirePlan(req, 1)
  if (denied) return json({ error: denied }, 403)
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ error: 'Falta configurar GEMINI_API_KEY en el servidor' }, 500)

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

  type Slot = { text?: string; size?: number; y?: number }
  const slots: Slot[] = (Array.isArray(b.layers) ? b.layers : []).slice(0, 12)
  if (!slots.length) return json({ error: 'No hay textos para generar' }, 400)

  const topic = String(b.topic || '').slice(0, 300)
  const lang = b.lang === 'en' ? 'inglés' : 'español'

  // Descripción de cada espacio: orden, tamaño relativo y texto actual como referencia de longitud
  const maxSize = Math.max(...slots.map((s) => Number(s.size) || 0), 1)
  const list = slots.map((s, i) => {
    const cur = String(s.text || '').slice(0, 200)
    const rel = (Number(s.size) || 0) / maxSize
    const rol = rel >= 0.85 ? 'el más grande: título principal, muy corto y de impacto' : rel >= 0.5 ? 'tamaño medio: mensaje o subtítulo' : 'tamaño pequeño: detalle, llamada a la acción o contacto'
    return `${i + 1}. (${rol}; texto actual: "${cur}"; longitud aprox. ${cur.length || 20} caracteres)`
  }).join('\n')

  const instructions = [
    `Eres el community manager de Global Zion, una agencia chilena de diseño y desarrollo web (sitios web, tiendas online, branding y gestión de redes sociales).`,
    `Vas a escribir los textos que se ven sobre una imagen de publicación en redes, en ${lang}.`,
    `Hay ${slots.length} espacios de texto, en este orden:\n${list}`,
    topic ? `Tema o idea de la publicación: "${topic}".` : `El usuario no indicó tema: elige uno atractivo relacionado con los servicios de Global Zion.`,
    `Reglas: devuelve exactamente ${slots.length} textos, uno por espacio y en el mismo orden. Cada texto debe ser corto y legible sobre una imagen, respetando la longitud aproximada del espacio (puedes variar ±40%). Los textos deben formar un mensaje coherente entre sí, sin repetirse.`,
    `Sin hashtags, sin comillas alrededor, sin explicaciones. Usa saltos de línea solo si el texto actual ya los tiene. Si un espacio actual parece un contacto (web, correo, teléfono, @usuario), conserva ese dato tal cual.`,
  ].join('\n')

  const call = (thinking: boolean, model: string) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: instructions }] }],
      generationConfig: {
        temperature: 1,
        ...(thinking ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}),
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { texts: { type: 'ARRAY', items: { type: 'STRING' }, minItems: slots.length, maxItems: slots.length } },
          required: ['texts'],
        },
      },
    }),
  })
  // La cuota gratuita es por modelo: si uno está agotado (429) o saturado (503), prueba el siguiente.
  let res!: Response
  for (const m of ORDER) {
    res = await call(true, m)
    if (res.status === 400) res = await call(false, m)
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
  let texts: unknown = []
  try { texts = JSON.parse(raw).texts } catch { /* ignore */ }
  if (!Array.isArray(texts) || !texts.length) return json({ error: 'Gemini no devolvió textos (puede haber bloqueado el contenido)' }, 502)
  return json({ texts: texts.slice(0, slots.length).map((x) => String(x ?? '').trim()) })
})
