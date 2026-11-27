// Foto como Reel: Instagram no deja que una app le ponga música a un post de foto, solo a los Reels.
// Por eso, al publicar, la imagen se convierte en un video corto en el navegador (sin servidores ni costo).
import { t } from './i18n.jsx'

export const REEL_W = 1080
export const REEL_H = 1920
export const REEL_SECONDS = 15
const FPS = 30
const SAMPLE_RATE = 48000

const loadImage = (src) => new Promise((res, rej) => {
  const im = new Image()
  im.onload = () => res(im)
  im.onerror = () => rej(new Error(t('No se pudo leer la imagen.')))
  im.src = src
})

/**
 * El cuadro del Reel (9:16): la imagen entera al centro y, arriba y abajo, la continuación de sus colores.
 * La cuadrícula del perfil recorta los Reels a 3:4 por el centro, así que una imagen 4:5 o 1:1 se ve completa.
 */
export async function reelFrame(imageSrc, width = REEL_W) {
  const img = await loadImage(imageSrc)
  const canvas = document.createElement('canvas')
  canvas.width = width; canvas.height = Math.round((width * REEL_H) / REEL_W)
  const { width: w, height: h } = canvas
  const ctx = canvas.getContext('2d')
  const fit = Math.min(w / img.width, h / img.height)
  const iw = img.width * fit, ih = img.height * fit, ix = (w - iw) / 2, iy = (h - ih) / 2
  ctx.imageSmoothingQuality = 'high'
  // Lo que sobra continúa los colores de cada borde, como si el diseño se hubiera hecho en vertical. El borde se
  // reduce a pocos puntos para que quede un degradado liso, sin rayas de los adornos.
  const extend = (sourceY, y, height) => {
    const strip = document.createElement('canvas')
    strip.width = 3; strip.height = 1
    strip.getContext('2d').drawImage(img, 0, sourceY, img.width, 2, 0, 0, 3, 1)
    ctx.drawImage(strip, 0.5, 0, 2, 1, 0, y, w, height)
  }
  ctx.fillStyle = '#020618'
  ctx.fillRect(0, 0, w, h)
  if (iy > 0) { extend(0, 0, iy + 1); extend(img.height - 2, iy + ih - 1, h - iy - ih + 1) }
  ctx.drawImage(img, ix, iy, iw, ih)
  return canvas
}

/** Video MP4 (H.264) con la imagen fija y una pista de audio en silencio, sobre la que Instagram pone la música. */
export async function makePhotoReel(imageSrc, seconds = REEL_SECONDS) {
  const unsupported = () => new Error(t('Este navegador no puede crear el Reel. Usa Chrome o Edge actualizados.'))
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') throw unsupported()
  const mb = await import('mediabunny')
  const canvas = await reelFrame(imageSrc)
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() })
  const video = new mb.CanvasSource(canvas, { codec: 'avc', bitrate: 6e6, keyFrameInterval: 2 })
  const audio = new mb.AudioBufferSource({ codec: 'aac', bitrate: 128e3 })
  output.addVideoTrack(video, { frameRate: FPS })
  output.addAudioTrack(audio)
  try {
    await output.start()
    await audio.add(new AudioBuffer({ length: SAMPLE_RATE * seconds, sampleRate: SAMPLE_RATE, numberOfChannels: 2 }))
    for (let i = 0; i < seconds * FPS; i++) await video.add(i / FPS, 1 / FPS)
    await output.finalize()
  } catch (e) {
    await output.cancel().catch(() => {})
    console.warn('No se pudo crear el Reel:', e)
    throw unsupported()
  }
  return new Blob([output.target.buffer], { type: 'video/mp4' })
}
