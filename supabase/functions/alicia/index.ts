// Supabase Edge Function: Alicia, la asistente que convierte un pedido («haz 2 imágenes y 1 video el lunes y el martes»)
// en un plan de publicaciones. Solo planifica: las publicaciones las crea la app en el navegador. Usa Gemini.
//
// Despliegue:
//   supabase functions deploy alicia --project-ref bknwnurzxaxtkgnrriva
// (usa el mismo secreto GEMINI_API_KEY que generate-caption)

import { requirePlan } from '../_shared/plan.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Entender un pedido es una tarea corta: van primero los Flash Lite (500 peticiones gratis al día) y así los Flash
// normales (20 al día) quedan para escribir las publicaciones.
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash']
const MODEL = Deno.env.get('GEMINI_MODEL') || MODELS[0]
const ORDER = [MODEL, ...MODELS.filter((x) => x !== MODEL)]
const MAX_ITEMS = 10
const NETWORKS = ['instagram', 'facebook', 'tiktok', 'twitter', 'linkedin', 'youtube']

const line = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const denied = requirePlan(req, 2)
  if (denied) return json({ error: denied }, 403)
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ error: 'Falta configurar GEMINI_API_KEY en el servidor' }, 500)

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }

  const message = String(b.message || '').trim().slice(0, 1200)
  if (!message) return json({ error: 'Escribe tu pedido' }, 400)
  const history = (Array.isArray(b.history) ? b.history : []).slice(-10).map((m) => line(m, 400)).filter(Boolean)
  // La app manda el calendario ya armado (con su zona horaria) para que el modelo no tenga que calcular fechas
  const days = (Array.isArray(b.calendar) ? b.calendar : []).slice(0, 45).map((d) => line(d, 40)).filter(Boolean)
  const now = line(b.now, 40)
  const plan = (Array.isArray(b.plan) ? b.plan : []).slice(0, MAX_ITEMS)
  const topics = (Array.isArray(b.topics) ? b.topics : []).slice(0, 40).map((x) => line(x, 60)).filter(Boolean)
  const freeVideos = Math.max(0, Math.min(Number(b.freeVideos) || 0, 999))
  const lang = b.lang === 'en' ? 'inglés' : 'español'

  const instructions = [
    `Eres Alicia, la asistente de la app de redes sociales de Global Zion (agencia chilena de diseño y desarrollo web). Eres cercana, clara y breve. Respondes en ${lang}.`,
    `Tu trabajo es convertir pedidos en un PLAN de publicaciones. La app crea después las publicaciones y el usuario las revisa antes de programarlas. Tú no creas, no programas ni publicas nada: nunca digas que ya lo hiciste.`,
    `Ahora es: ${now}.`,
    `CALENDARIO (usa solo estas fechas, formato AAAA-MM-DD):\n${days.join('\n')}`,
    plan.length ? `PLAN ACTUAL sin crear todavía (JSON): ${JSON.stringify(plan).slice(0, 3000)}` : 'No hay un plan pendiente.',
    history.length ? `Conversación anterior: ${JSON.stringify(history)}` : '',
    `Videos disponibles en la sección Contenido: ${freeVideos}.`,
    `PEDIDO DEL USUARIO: ${JSON.stringify(message)}`,
    `REGLAS:`,
    `- "action": "plan" si el pedido crea o cambia el plan; "chat" si es una pregunta, un saludo, algo que no puedes hacer o falta un dato imprescindible (pregunta en "reply"). Con "chat", "items" va vacío.`,
    `- Con "plan", "items" es el plan COMPLETO que debe quedar (máximo ${MAX_ITEMS}). Si ajusta el plan actual, conserva igual lo que no pida cambiar. Si pide algo nuevo y distinto, reemplázalo.`,
    `- "type": "image" o "video". Los videos no se generan desde cero: la app usa videos ya subidos a Contenido. Si pide más videos de los disponibles, inclúyelos igual y avísalo en "reply".`,
    `- "date": un día de la semana significa el próximo que venga en el calendario. "Hoy" y "mañana" según la fecha actual.`,
    `- Si nombra varios días y una cantidad total (ej. «2 imágenes y 1 video lunes y martes»), reparte el total entre esos días de forma equilibrada, mezclando los tipos. Si dice «por día» o «cada día», esa cantidad va en cada día. Si no indica días, usa un día distinto para cada publicación desde mañana.`,
    `- "time": en formato HH:MM de 24 horas SOLO si el usuario pidió una hora (o ya estaba en el plan actual). Si no, "".`,
    `- "topic": de qué trata, en pocas palabras. Respeta el tema que pida. Si no pide tema, a cada imagen dale uno distinto de esta lista: ${topics.join(' | ')}. En los videos sin tema pedido, "" (la app mira el video para escribir el texto). No inventes ofertas, precios ni descuentos que el usuario no haya pedido.`,
    `- "networks": solo si el usuario nombra redes, con estos valores: ${NETWORKS.join(', ')}. Si no, lista vacía.`,
    `- "reply": de una a tres frases, con algún emoji que venga al caso. Si hay plan, resume cómo lo repartiste e invita a revisarlo y pulsar «Crear publicaciones».`,
  ].filter(Boolean).join('\n')

  const call = (thinking: boolean, model: string) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    // Un modelo saturado a veces no contesta nada: se corta y se prueba el siguiente (el total queda bajo los 150 s de Supabase)
    signal: AbortSignal.timeout(25000),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: instructions }] }],
      generationConfig: {
        temperature: 0.3,
        ...(thinking ? { thinkingConfig: { thinkingLevel: 'low' } } : {}),
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            action: { type: 'STRING', enum: ['plan', 'chat'] },
            reply: { type: 'STRING' },
            items: {
              type: 'ARRAY',
              maxItems: MAX_ITEMS,
              items: {
                type: 'OBJECT',
                properties: {
                  type: { type: 'STRING', enum: ['image', 'video'] },
                  date: { type: 'STRING' },
                  time: { type: 'STRING' },
                  topic: { type: 'STRING' },
                  networks: { type: 'ARRAY', items: { type: 'STRING' } },
                },
                required: ['type', 'date', 'time', 'topic', 'networks'],
              },
            },
          },
          required: ['action', 'reply', 'items'],
        },
      },
    }),
  })
  let res!: Response
  for (const m of ORDER) {
    try {
      res = await call(true, m)
      if (res.status === 400) res = await call(false, m)
    } catch (e) {
      console.warn('Gemini sin respuesta con', m, (e as Error).name, '→ probando otro modelo')
      res = new Response(JSON.stringify({ error: { message: 'Gemini no respondió a tiempo. Intenta de nuevo en un minuto.' } }), { status: 503 })
      continue
    }
    if (res.status !== 429 && res.status !== 503 && res.status !== 404) break
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
  let out: Record<string, unknown> = {}
  try { out = JSON.parse(raw) } catch { /* ignore */ }
  const reply = String(out.reply || '').trim().slice(0, 900)
  const items = (Array.isArray(out.items) ? out.items : []).slice(0, MAX_ITEMS).map((x) => ({
    type: x?.type === 'video' ? 'video' : 'image',
    date: line(x?.date, 10),
    time: line(x?.time, 5),
    topic: line(x?.topic, 160),
    networks: (Array.isArray(x?.networks) ? x.networks : []).map(String).filter((n: string) => NETWORKS.includes(n)),
  }))
  if (!reply && !items.length) return json({ error: 'Gemini no devolvió una respuesta (puede haber bloqueado el contenido)' }, 502)
  return json({ action: out.action === 'plan' && items.length ? 'plan' : 'chat', reply, items: out.action === 'plan' ? items : [] })
})
