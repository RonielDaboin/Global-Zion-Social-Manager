import { t } from './i18n.jsx'

const ALL = ['instagram', 'facebook', 'twitter', 'whatsapp', 'whatsapp-business', 'email']
export const FORMATS = [
  { id: 'ig-square', label: 'Post Instagram 1:1', short: '1:1', w: 1080, h: 1080, platforms: ALL },
  { id: 'ig-portrait', label: 'Post Instagram 4:5', short: '4:5', w: 1080, h: 1350, platforms: ['instagram', 'facebook'] },
  { id: 'ig-story', label: 'Story Instagram', short: 'Story 9:16', w: 1080, h: 1920, platforms: ['instagram', 'facebook', 'whatsapp', 'whatsapp-business'] },
  { id: 'ig-reel', label: 'Portada Reel', short: 'Reel 9:16', w: 1080, h: 1920, platforms: ['instagram', 'facebook'] },
  { id: 'tt-cover', label: 'Portada TikTok', short: 'TikTok 9:16', w: 1080, h: 1920, platforms: ['tiktok'] },
  { id: 'fb-post', label: 'Post Facebook 1.91:1', short: 'FB 1.91:1', w: 1200, h: 630, platforms: ['facebook', 'twitter', 'email', 'whatsapp', 'whatsapp-business'] },
  { id: 'x-post', label: 'Post X (Twitter) 16:9', short: 'X 16:9', w: 1600, h: 900, platforms: ['twitter', 'facebook', 'email'] },
  { id: 'email-banner', label: 'Banner de correo', short: 'Correo 3:1', w: 1200, h: 400, platforms: ['email'] },
]

export const getFormat = (id) => FORMATS.find((f) => f.id === id) || FORMATS[0]

// kind: 'user' (@usuario), 'phone' (número con código de país), 'email' (proveedor + dirección)
export const PLATFORMS = {
  instagram: { id: 'instagram', name: 'Instagram', color: '#e1306c', limit: 2200, maxTags: 30, kind: 'user', ico: 'IG' },
  tiktok: { id: 'tiktok', name: 'TikTok', color: '#25f4ee', limit: 2200, maxTags: 20, kind: 'user', ico: 'TT' },
  facebook: { id: 'facebook', name: 'Facebook', color: '#1877f2', limit: 63206, maxTags: 30, kind: 'user', ico: 'f' },
  twitter: { id: 'twitter', name: 'X (Twitter)', color: '#1d9bf0', limit: 280, maxTags: 10, kind: 'user', ico: 'X' },
  whatsapp: { id: 'whatsapp', name: 'WhatsApp', color: '#25d366', limit: 4096, maxTags: 99, kind: 'phone', ico: 'WA' },
  'whatsapp-business': { id: 'whatsapp-business', name: 'WhatsApp Business', color: '#128c7e', limit: 4096, maxTags: 99, kind: 'phone', ico: 'WB' },
  email: { id: 'email', name: 'Correo', color: '#ea4335', limit: 100000, maxTags: 99, kind: 'email', ico: '@' },
}

export const EMAIL_PROVIDERS = [
  { id: 'gmail', name: 'Gmail' },
  { id: 'outlook', name: 'Outlook / Microsoft 365' },
  { id: 'yahoo', name: 'Yahoo Mail' },
  { id: 'icloud', name: 'iCloud Mail' },
  { id: 'zoho', name: 'Zoho Mail' },
  { id: 'smtp', name: 'Otro (SMTP / IMAP)' },
]

export const accountLabel = (p, acc) => (p.kind === 'user' ? '@' + acc.username : acc.username)

import fontData from './fonts.json'
export const FONT_GROUPS = fontData.groups
export const FONTS_UPDATED = fontData.updated
export const FONTS = FONT_GROUPS.flatMap((g) => g.fonts)

const uid = () => Math.random().toString(36).slice(2, 9)
export { uid }

const layer = (o) => ({
  id: uid(), text: 'Texto', x: 0.5, y: 0.5, size: 90, color: '#ffffff',
  font: 'Poppins', weight: 800, align: 'center', shadow: true, upper: false, ...o,
})

// Plantillas de diseño. Cada una devuelve un diseño completo para un formato.
export const TEMPLATES = [
  {
    id: 'zion-blue', name: 'Zion Azul',
    make: () => ({
      bg: { type: 'gradient', c1: '#020618', c2: '#1d6fb8', angle: 160, image: null, dim: 0 },
      accent: { show: true, color: '#7cc0ff' },
      layers: [
        layer({ text: t('GLOBAL ZION'), y: 0.14, size: 38, color: '#7cc0ff', font: 'Montserrat', weight: 700, upper: true, shadow: false }),
        layer({ text: t('Tu mensaje principal aquí'), y: 0.46, size: 104, font: 'Poppins' }),
        layer({ text: t('Subtítulo o llamada a la acción'), y: 0.8, size: 44, font: 'Inter', weight: 500, color: '#dbeafe', shadow: false }),
      ],
    }),
  },
  {
    id: 'sunset', name: 'Atardecer',
    make: () => ({
      bg: { type: 'gradient', c1: '#ff7a18', c2: '#af002d', angle: 135, image: null, dim: 0 },
      accent: { show: false, color: '#ffffff' },
      layers: [
        layer({ text: t('NUEVO'), y: 0.3, size: 150, font: 'Bebas Neue', weight: 400 }),
        layer({ text: t('Algo grande viene en camino'), y: 0.52, size: 72, font: 'Playfair Display', weight: 700 }),
        layer({ text: t('@globalzion'), y: 0.88, size: 42, font: 'Inter', weight: 600, shadow: false }),
      ],
    }),
  },
  {
    id: 'minimal', name: 'Minimal claro',
    make: () => ({
      bg: { type: 'solid', c1: '#f6f3ee', c2: '#f6f3ee', angle: 0, image: null, dim: 0 },
      accent: { show: true, color: '#111111' },
      layers: [
        layer({ text: t('Menos ruido,\nmás impacto.'), y: 0.45, size: 110, color: '#111111', font: 'Playfair Display', weight: 900, shadow: false }),
        layer({ text: t('globalzion.com'), y: 0.86, size: 38, color: '#555555', font: 'Inter', weight: 500, shadow: false }),
      ],
    }),
  },
  {
    id: 'photo', name: 'Imagen + título',
    make: () => ({
      bg: { type: 'image', c1: '#111111', c2: '#111111', angle: 0, image: null, dim: 0.45 },
      accent: { show: false, color: '#ffffff' },
      layers: [
        layer({ text: t('Título sobre tu imagen'), y: 0.78, size: 96, font: 'Montserrat', weight: 900 }),
        layer({ text: t('Sube una imagen de fondo en el panel'), y: 0.9, size: 38, font: 'Inter', weight: 500, shadow: false }),
      ],
    }),
  },
  {
    id: 'neon', name: 'Neón TikTok',
    make: () => ({
      bg: { type: 'gradient', c1: '#050505', c2: '#0b2a3a', angle: 180, image: null, dim: 0 },
      accent: { show: true, color: '#25f4ee' },
      layers: [
        layer({ text: t('3 TIPS'), y: 0.32, size: 190, color: '#25f4ee', font: 'Bebas Neue', weight: 400 }),
        layer({ text: t('que cambiarán\ntu contenido'), y: 0.52, size: 84, font: 'Poppins', weight: 800 }),
        layer({ text: t('Desliza →'), y: 0.88, size: 44, color: '#fe2c55', font: 'Montserrat', weight: 700, shadow: false }),
      ],
    }),
  },
  {
    id: 'quote', name: 'Cita',
    make: () => ({
      bg: { type: 'gradient', c1: '#1d6fb8', c2: '#020618', angle: 150, image: null, dim: 0 },
      accent: { show: true, color: '#7cc0ff' },
      layers: [
        layer({ text: t('“'), y: 0.2, size: 260, color: '#7cc0ff', font: 'Playfair Display', weight: 900, shadow: false }),
        layer({ text: t('La constancia vence\nal talento.'), y: 0.5, size: 86, font: 'Playfair Display', weight: 700 }),
        layer({ text: t('— Autor'), y: 0.82, size: 42, font: 'Inter', weight: 500, color: '#cbd5e1', shadow: false }),
      ],
    }),
  },
  {
    id: 'bold-yellow', name: 'Amarillo impacto',
    make: () => ({
      bg: { type: 'solid', c1: '#ffd400', c2: '#ffd400', angle: 0, image: null, dim: 0 },
      accent: { show: true, color: '#111111' },
      layers: [
        layer({ text: t('OFERTA'), y: 0.34, size: 200, color: '#111111', font: 'Bebas Neue', weight: 400, shadow: false }),
        layer({ text: t('Solo por tiempo limitado'), y: 0.56, size: 64, color: '#111111', font: 'Poppins', weight: 800, shadow: false }),
        layer({ text: t('Compra ahora →'), y: 0.86, size: 44, color: '#111111', font: 'Montserrat', weight: 700, shadow: false }),
      ],
    }),
  },
  {
    id: 'aurora', name: 'Aurora',
    make: () => ({
      bg: { type: 'gradient', c1: '#0f0c29', c2: '#302b63', c3: '#24c6dc', angle: 150, image: null, dim: 0 },
      accent: { show: true, color: '#24c6dc' },
      layers: [
        layer({ text: t('Inspira.'), y: 0.38, size: 130, color: '#ffffff', font: 'Poppins', weight: 800, upper: true, shadow: false }),
        layer({ text: t('Crea. Conecta.'), y: 0.56, size: 70, color: '#a5f3fc', font: 'Poppins', weight: 600, upper: true, shadow: false }),
        layer({ text: t('@globalzion'), y: 0.88, size: 40, color: '#cbd5e1', font: 'Inter', weight: 500, shadow: false }),
      ],
    }),
  },
  {
    id: 'pink-pop', name: 'Rosa pop',
    make: () => ({
      bg: { type: 'gradient', c1: '#ff4ecd', c2: '#ff9a44', angle: 45, image: null, dim: 0 },
      accent: { show: true, color: '#ffffff' },
      layers: [
        layer({ text: t('¡HOLA!'), y: 0.3, size: 190, color: '#ffffff', font: 'Bebas Neue', weight: 400, upper: true, shadow: false }),
        layer({ text: t('Tenemos algo para ti'), y: 0.54, size: 68, color: '#ffffff', font: 'Poppins', weight: 800, upper: true, shadow: false }),
        layer({ text: t('Descúbrelo hoy'), y: 0.86, size: 42, color: '#fff7ed', font: 'Inter', weight: 600, shadow: false }),
      ],
    }),
  },
  {
    id: 'dark-gold', name: 'Oscuro elegante',
    make: () => ({
      bg: { type: 'gradient', c1: '#0a0a0a', c2: '#2b2110', angle: 160, image: null, dim: 0 },
      accent: { show: true, color: '#d4af37' },
      layers: [
        layer({ text: t('EXCLUSIVO'), y: 0.2, size: 40, color: '#d4af37', font: 'Montserrat', weight: 700, shadow: false }),
        layer({ text: t('Calidad que\nse nota'), y: 0.48, size: 104, color: '#f5e6b3', font: 'Playfair Display', weight: 800, upper: true, shadow: false }),
        layer({ text: t('globalzion.com'), y: 0.88, size: 38, color: '#a8a29e', font: 'Inter', weight: 500, shadow: false }),
      ],
    }),
  },
  {
    id: 'green-fresh', name: 'Verde fresco',
    make: () => ({
      bg: { type: 'gradient', c1: '#11998e', c2: '#38ef7d', angle: 135, image: null, dim: 0 },
      accent: { show: true, color: '#ffffff' },
      layers: [
        layer({ text: t('Vive mejor'), y: 0.4, size: 130, color: '#ffffff', font: 'Poppins', weight: 800, upper: true, shadow: false }),
        layer({ text: t('Pequeños hábitos, grandes cambios'), y: 0.62, size: 48, color: '#ecfdf5', font: 'Inter', weight: 600, shadow: false }),
      ],
    }),
  },
  {
    id: 'announce', name: 'Anuncio',
    make: () => ({
      bg: { type: 'gradient', c1: '#e11d48', c2: '#7c3aed', angle: 120, image: null, dim: 0 },
      accent: { show: true, color: '#ffffff' },
      layers: [
        layer({ text: t('ANUNCIO'), y: 0.22, size: 46, color: '#ffffff', font: 'Montserrat', weight: 800, shadow: false }),
        layer({ text: t('Gran\nlanzamiento'), y: 0.5, size: 120, color: '#ffffff', font: 'Poppins', weight: 900, upper: true, shadow: false }),
        layer({ text: t('Próximamente'), y: 0.84, size: 48, color: '#fde68a', font: 'Inter', weight: 700, shadow: false }),
      ],
    }),
  },
  {
    id: 'tip', name: 'Consejo del día',
    make: () => ({
      bg: { type: 'solid', c1: '#0f172a', c2: '#0f172a', angle: 0, image: null, dim: 0 },
      accent: { show: true, color: '#38bdf8' },
      layers: [
        layer({ text: t('💡 CONSEJO'), y: 0.18, size: 48, color: '#38bdf8', font: 'Montserrat', weight: 800, shadow: false }),
        layer({ text: t('Escribe aquí tu consejo en pocas palabras'), y: 0.5, size: 78, color: '#f1f5f9', font: 'Poppins', weight: 700, upper: true, shadow: false }),
        layer({ text: t('Guárdalo para después'), y: 0.88, size: 38, color: '#94a3b8', font: 'Inter', weight: 500, shadow: false }),
      ],
    }),
  },
  {
    id: 'paper', name: 'Papel crema',
    make: () => ({
      bg: { type: 'solid', c1: '#fdf6e3', c2: '#fdf6e3', angle: 0, image: null, dim: 0 },
      accent: { show: true, color: '#b45309' },
      layers: [
        layer({ text: t('Hoy\nagradecemos'), y: 0.42, size: 100, color: '#78350f', font: 'Playfair Display', weight: 800, shadow: false }),
        layer({ text: t('Gracias por ser parte'), y: 0.8, size: 44, color: '#b45309', font: 'Inter', weight: 600, shadow: false }),
      ],
    }),
  },
  {
    id: 'ocean', name: 'Océano',
    make: () => ({
      bg: { type: 'gradient', c1: '#2193b0', c2: '#6dd5ed', angle: 180, image: null, dim: 0 },
      accent: { show: true, color: '#ffffff' },
      layers: [
        layer({ text: t('Verano'), y: 0.36, size: 170, color: '#ffffff', font: 'Bebas Neue', weight: 400, upper: true, shadow: false }),
        layer({ text: t('Hasta 40% de descuento'), y: 0.58, size: 64, color: '#ffffff', font: 'Poppins', weight: 800, upper: true, shadow: false }),
      ],
    }),
  },
  {
    id: 'photo-bottom', name: 'Foto + franja',
    make: () => ({
      bg: { type: 'image', c1: '#111111', c2: '#111111', angle: 0, image: null, dim: 0.25 },
      accent: { show: true, color: '#ffffff' },
      layers: [
        layer({ text: t('Escribe tu título'), y: 0.84, size: 84, color: '#ffffff', font: 'Montserrat', weight: 900, upper: true, shadow: false }),
        layer({ text: t('Más detalles aquí'), y: 0.93, size: 36, color: '#e5e7eb', font: 'Inter', weight: 500, shadow: false }),
      ],
    }),
  },
  {
    id: 'purple-night', name: 'Noche púrpura',
    make: () => ({
      bg: { type: 'gradient', c1: '#2e1065', c2: '#7c3aed', angle: 160, image: null, dim: 0 },
      accent: { show: true, color: '#c4b5fd' },
      layers: [
        layer({ text: t('Noche de estrenos'), y: 0.4, size: 110, color: '#ffffff', font: 'Poppins', weight: 800, upper: true, shadow: false }),
        layer({ text: t('Viernes · 8:00 PM'), y: 0.62, size: 50, color: '#ddd6fe', font: 'Inter', weight: 600, shadow: false }),
      ],
    }),
  },
  {
    id: 'coral', name: 'Coral',
    make: () => ({
      bg: { type: 'gradient', c1: '#ff6b6b', c2: '#feca57', angle: 135, image: null, dim: 0 },
      accent: { show: true, color: '#ffffff' },
      layers: [
        layer({ text: t('Buenos días'), y: 0.42, size: 130, color: '#ffffff', font: 'Playfair Display', weight: 800, shadow: false }),
        layer({ text: t('Empieza el día con energía'), y: 0.64, size: 46, color: '#fff7ed', font: 'Inter', weight: 600, shadow: false }),
      ],
    }),
  },
  {
    id: 'mono', name: 'Blanco y negro',
    make: () => ({
      bg: { type: 'solid', c1: '#ffffff', c2: '#ffffff', angle: 0, image: null, dim: 0 },
      accent: { show: true, color: '#000000' },
      layers: [
        layer({ text: t('MENOS\nES MÁS'), y: 0.45, size: 140, color: '#000000', font: 'Bebas Neue', weight: 400, shadow: false }),
        layer({ text: t('— Estudio'), y: 0.86, size: 38, color: '#525252', font: 'Inter', weight: 500, shadow: false }),
      ],
    }),
  },
  {
    id: 'midnight', name: 'Medianoche',
    make: () => ({
      bg: { type: 'gradient', c1: '#000000', c2: '#1e3a8a', angle: 180, image: null, dim: 0 },
      accent: { show: true, color: '#60a5fa' },
      layers: [
        layer({ text: t('Ideas que brillan'), y: 0.45, size: 110, color: '#ffffff', font: 'Montserrat', weight: 800, upper: true, shadow: false }),
        layer({ text: t('globalzion.com'), y: 0.88, size: 38, color: '#93c5fd', font: 'Inter', weight: 500, shadow: false }),
      ],
    }),
  },
  {
    id: 'mint', name: 'Menta suave',
    make: () => ({
      bg: { type: 'solid', c1: '#d1fae5', c2: '#d1fae5', angle: 0, image: null, dim: 0 },
      accent: { show: true, color: '#047857' },
      layers: [
        layer({ text: t('Cuida\ntu bienestar'), y: 0.44, size: 100, color: '#065f46', font: 'Playfair Display', weight: 800, shadow: false }),
        layer({ text: t('Respira · Descansa · Sonríe'), y: 0.82, size: 42, color: '#047857', font: 'Inter', weight: 600, shadow: false }),
      ],
    }),
  },
  {
    id: 'fire', name: 'Fuego',
    make: () => ({
      bg: { type: 'gradient', c1: '#f12711', c2: '#f5af19', angle: 160, image: null, dim: 0 },
      accent: { show: true, color: '#ffffff' },
      layers: [
        layer({ text: t('HOT'), y: 0.34, size: 220, color: '#ffffff', font: 'Bebas Neue', weight: 400, upper: true, shadow: false }),
        layer({ text: t('Las ofertas más calientes'), y: 0.58, size: 60, color: '#ffffff', font: 'Poppins', weight: 800, shadow: false }),
      ],
    }),
  },
  {
    id: 'lavender', name: 'Lavanda',
    make: () => ({
      bg: { type: 'gradient', c1: '#e0c3fc', c2: '#8ec5fc', angle: 135, image: null, dim: 0 },
      accent: { show: true, color: '#4c1d95' },
      layers: [
        layer({ text: t('Tómate un respiro'), y: 0.44, size: 100, color: '#3b0764', font: 'Playfair Display', weight: 800, shadow: false }),
        layer({ text: t('Tu tiempo también importa'), y: 0.66, size: 44, color: '#4c1d95', font: 'Inter', weight: 600, shadow: false }),
      ],
    }),
  },
  {
    id: 'retro', name: 'Retro',
    make: () => ({
      bg: { type: 'gradient', c1: '#f9d423', c2: '#ff4e50', angle: 150, image: null, dim: 0 },
      accent: { show: true, color: '#1f2937' },
      layers: [
        layer({ text: t('RETRO'), y: 0.36, size: 200, color: '#1f2937', font: 'Bebas Neue', weight: 400, shadow: false }),
        layer({ text: t('Vuelve lo clásico'), y: 0.6, size: 64, color: '#1f2937', font: 'Poppins', weight: 800, shadow: false }),
      ],
    }),
  },
  {
    id: 'forest', name: 'Bosque',
    make: () => ({
      bg: { type: 'gradient', c1: '#134e5e', c2: '#71b280', angle: 160, image: null, dim: 0 },
      accent: { show: true, color: '#ecfdf5' },
      layers: [
        layer({ text: t('Conecta con la naturaleza'), y: 0.45, size: 92, color: '#ffffff', font: 'Playfair Display', weight: 700, shadow: false }),
        layer({ text: t('Aire libre · Calma'), y: 0.8, size: 42, color: '#d1fae5', font: 'Inter', weight: 500, shadow: false }),
      ],
    }),
  },
  {
    id: 'event', name: 'Invitación',
    make: () => ({
      bg: { type: 'gradient', c1: '#141e30', c2: '#243b55', angle: 160, image: null, dim: 0 },
      accent: { show: true, color: '#fbbf24' },
      layers: [
        layer({ text: t('ESTÁS INVITADO'), y: 0.2, size: 44, color: '#fbbf24', font: 'Montserrat', weight: 800, shadow: false }),
        layer({ text: t('Gran\nevento'), y: 0.48, size: 130, color: '#ffffff', font: 'Playfair Display', weight: 800, shadow: false }),
        layer({ text: t('Sábado 15 · 6:00 PM'), y: 0.82, size: 46, color: '#e5e7eb', font: 'Inter', weight: 600, shadow: false }),
      ],
    }),
  },
  {
    id: 'news', name: 'Noticia',
    make: () => ({
      bg: { type: 'solid', c1: '#dc2626', c2: '#dc2626', angle: 0, image: null, dim: 0 },
      accent: { show: true, color: '#ffffff' },
      layers: [
        layer({ text: t('ÚLTIMA HORA'), y: 0.2, size: 56, color: '#ffffff', font: 'Montserrat', weight: 900, shadow: false }),
        layer({ text: t('Escribe aquí el titular de la noticia'), y: 0.52, size: 78, color: '#ffffff', font: 'Poppins', weight: 800, shadow: false }),
      ],
    }),
  },
  {
    id: 'pastel', name: 'Pastel',
    make: () => ({
      bg: { type: 'gradient', c1: '#fbc2eb', c2: '#a6c1ee', angle: 135, image: null, dim: 0 },
      accent: { show: true, color: '#ffffff' },
      layers: [
        layer({ text: t('Hecho con amor'), y: 0.44, size: 110, color: '#ffffff', font: 'Playfair Display', weight: 800, shadow: false }),
        layer({ text: t('Pedidos por mensaje'), y: 0.68, size: 44, color: '#fdf4ff', font: 'Inter', weight: 600, shadow: false }),
      ],
    }),
  },
  {
    id: 'steel', name: 'Acero',
    make: () => ({
      bg: { type: 'gradient', c1: '#232526', c2: '#414345', angle: 160, image: null, dim: 0 },
      accent: { show: true, color: '#9ca3af' },
      layers: [
        layer({ text: t('RESULTADOS'), y: 0.32, size: 130, color: '#f3f4f6', font: 'Bebas Neue', weight: 400, shadow: false }),
        layer({ text: t('+120% de crecimiento'), y: 0.55, size: 70, color: '#ffffff', font: 'Poppins', weight: 800, shadow: false }),
      ],
    }),
  },
  {
    id: 'tropic', name: 'Trópico',
    make: () => ({
      bg: { type: 'gradient', c1: '#00c9ff', c2: '#92fe9d', angle: 150, image: null, dim: 0 },
      accent: { show: true, color: '#0f172a' },
      layers: [
        layer({ text: t('Vacaciones'), y: 0.38, size: 140, color: '#0f172a', font: 'Bebas Neue', weight: 400, shadow: false }),
        layer({ text: t('Reserva tu aventura'), y: 0.6, size: 56, color: '#0f172a', font: 'Poppins', weight: 800, shadow: false }),
      ],
    }),
  },
]

export const newLayer = (o = {}) => layer(o)

export const blankDesign = (formatId = 'ig-square') => ({ format: formatId, ...TEMPLATES[0].make() })
