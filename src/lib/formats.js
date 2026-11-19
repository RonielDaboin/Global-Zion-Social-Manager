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

export const FONTS = [
  { id: 'Poppins', label: 'Poppins' },
  { id: 'Montserrat', label: 'Montserrat' },
  { id: 'Playfair Display', label: 'Playfair' },
  { id: 'Bebas Neue', label: 'Bebas Neue' },
  { id: 'Inter', label: 'Inter' },
]

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
    id: 'photo', name: 'Foto + título',
    make: () => ({
      bg: { type: 'image', c1: '#111111', c2: '#111111', angle: 0, image: null, dim: 0.45 },
      accent: { show: false, color: '#ffffff' },
      layers: [
        layer({ text: t('Título sobre tu foto'), y: 0.78, size: 96, font: 'Montserrat', weight: 900 }),
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
]

export const newLayer = (o = {}) => layer(o)

export const blankDesign = (formatId = 'ig-square') => ({ format: formatId, ...TEMPLATES[0].make() })
