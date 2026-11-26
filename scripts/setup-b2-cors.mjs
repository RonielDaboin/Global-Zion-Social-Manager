// Autoriza a la app a subir y leer archivos del bucket de Backblaze desde el navegador (reglas CORS).
// La web de Backblaze solo permite reglas de descarga, y cambiarlas requiere la «Master Application Key».
// La clave se escribe aquí oculta, se usa solo en esta ejecución y no se guarda en ningún archivo.
//
// Ejecútalo en tu propia terminal:   node scripts/setup-b2-cors.mjs
import readline from 'node:readline'

const BUCKET = process.argv[2] || 'globalzion-contenido'
const ORIGINS = ['https://social-manager.globalzion.cl', 'http://localhost:5173']

const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true })
let hidden = false
const write = rl._writeToOutput.bind(rl)
rl._writeToOutput = (s) => { if (!hidden) write(s) }
const ask = (q, secret = false) => new Promise((res) => {
  rl.question(q, (a) => { if (secret) process.stdout.write('\n'); hidden = false; res(a.trim()) })
  hidden = secret
})

const call = async (url, init) => {
  const r = await fetch(url, init)
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(d.message || `Error ${r.status}`)
  return d
}

try {
  const keyId = await ask('keyID de la Master Application Key: ')
  const key = await ask('applicationKey de la Master (no se mostrará al pegarla): ', true)
  const auth = await call('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', { headers: { Authorization: 'Basic ' + Buffer.from(`${keyId}:${key}`).toString('base64') } })
  const api = auth.apiInfo.storageApi.apiUrl
  const post = (name, body) => call(`${api}/b2api/v3/${name}`, { method: 'POST', headers: { Authorization: auth.authorizationToken }, body: JSON.stringify(body) })
  const { buckets } = await post('b2_list_buckets', { accountId: auth.accountId, bucketName: BUCKET })
  if (!buckets?.length) throw new Error(`No se encontró el bucket ${BUCKET}`)
  await post('b2_update_bucket', {
    accountId: auth.accountId,
    bucketId: buckets[0].bucketId,
    corsRules: [{ corsRuleName: 'globalzion-app', allowedOrigins: ORIGINS, allowedOperations: ['s3_put', 's3_get', 's3_head'], allowedHeaders: ['*'], exposeHeaders: ['etag'], maxAgeSeconds: 3600 }],
  })
  console.log(`\n✅ Listo: la app ya puede subir y leer archivos de ${BUCKET}. El cambio tarda cerca de un minuto.`)
} catch (e) {
  console.error('\n❌ No se pudo configurar: ' + e.message)
  process.exitCode = 1
} finally {
  rl.close()
}
