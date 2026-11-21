// Supabase Edge Function: revisa con Gemini (visión) si una imagen generada con IA sirve como fondo de una publicación corporativa.
// Detecta lo que las métricas de píxeles no ven: caras o manos deformadas, objetos fusionados, pantallas o texto sin sentido, etc.
// La API key vive solo aquí, como secreto (GEMINI_API_KEY).
//
// Despliegue:
//   supabase functions deploy judge-image --project-ref axshbrskybmydywwpdla
// (usa el mismo secreto GEMINI_API_KEY que generate-caption)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.5-flash'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return json({ error: 'Falta configurar GEMINI_API_KEY en el servidor' }, 500)

  let b: Record<string, unknown>
  try { b = await req.json() } catch { return json({ error: 'JSON inválido' }, 400) }
  const image = typeof b.image === 'string' ? b.image : ''
  const m = image.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
  if (!m || m[2].length > 4_000_000) return json({ error: 'Imagen no válida' }, 400)
  const context = String(b.context || '').slice(0, 300)

  const instructions = [
    `Eres director de arte de una agencia web corporativa. Evalúa si esta imagen sirve como FONDO PREMIUM de una publicación de redes sociales (moderna, elegante y empresarial).`,
    context ? `Contexto de la publicación: "${context}".` : '',
    `Puntúa de 0 a 10. Marca usable=false (y puntaje menor a 6) solo si hay un defecto GRAVE: si hay cualquiera de estos problemas: personas o caras deformadas, manos o cuerpos distorsionados, objetos fusionados o sin sentido, pantallas con texto o interfaces falsas e ilegibles, texto o letras falsas, manchas, borrosidad, ruido o artefactos, composición confusa, baja calidad o aspecto amateur. Detalles menores de estilo (composición algo genérica, reflejos o brillos suaves) NO son motivo para rechazar.`,
    `Oficinas, computadores, laptops y maquetas web abstractas (sin texto legible, sin personas) son válidos, y la paleta puede ser azul, naranja, gris, amarillo, verde petróleo o dorado siempre que se vea corporativa. Una imagen abstracta, limpia y nítida (degradados, formas, luces, partículas) con buena composición sí es usable. Devuelve en "issues" los problemas encontrados, cortos y en español (máximo 4).`,
  ].filter(Boolean).join('\n')

  const call = (thinking: boolean) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: instructions }, { inline_data: { mime_type: m[1], data: m[2] } }] }],
      generationConfig: {
        temperature: 0.2,
        ...(thinking ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}),
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            score: { type: 'NUMBER' },
            usable: { type: 'BOOLEAN' },
            issues: { type: 'ARRAY', items: { type: 'STRING' } },
          },
          required: ['score', 'usable', 'issues'],
        },
      },
    }),
  })
  let res = await call(true)
  if (res.status === 400) res = await call(false)
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('Gemini error', res.status, detail.slice(0, 500))
    return json({ error: res.status === 429 ? 'Se alcanzó el límite de uso de Gemini. Intenta en un minuto.' : `Gemini respondió ${res.status}` }, 502)
  }
  const data = await res.json()
  const raw = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text || '').join('') || ''
  try {
    const r = JSON.parse(raw)
    const score = Math.max(0, Math.min(10, Number(r.score) || 0))
    return json({ score, usable: !!r.usable && score >= 6, issues: Array.isArray(r.issues) ? r.issues.slice(0, 4).map(String) : [] })
  } catch {
    return json({ error: 'Gemini no devolvió una evaluación válida' }, 502)
  }
})
