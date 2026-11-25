// Información de Global Zion (www.globalzion.cl) usada para generar publicaciones automáticas.
// Los datos salen de la web (servicios, planes, plazos, valores). Los puntos están escritos a mano para no inventar cifras.
export const BRAND = {
  site: 'www.globalzion.cl',
  whatsapp: '+56 9 3070 1132',
  // Colores de la web: azul marino, azules y celeste
  navy: ['#020618', '#0b1b3f', '#0f2a5c'],
  blue: ['#1d6fb8', '#2b82cf', '#3b92e0'],
  sky: ['#38bdf8', '#60a5fa', '#7cc0ff', '#8fc9ff'],
  green: '#34d399',
  hashtags: ['#globalzion', '#diseñoweb', '#paginasweb', '#wordpress', '#webchile', '#emprendedores', '#pymes', '#marketingdigital', '#tiendaonline', '#ciberseguridad'],
}

// Temas de publicación. kw: palabras del texto del usuario que activan el tema (pueden activarse varios a la vez).
// eats: frases propias del tema que se quitan antes de revisar los temas siguientes, para que no los activen por error
// («cotizador» no es pedir precios, «base de datos» no es ciberseguridad). Por eso los temas específicos van primero.
// about: de qué trata el tema, para pedir la imagen de fondo (si no se indica, es diseño web).
// Si cambia la web (herramientas, precios, servicios), actualiza aquí y en supabase/functions/_shared/knowledge.ts.
const SOFTWARE = 'business software tools for companies'
export const ANGLES = [
  { id: 'database', kw: /bases? de datos/i, eats: /bases? de datos/gi, kicker: 'Herramientas', title: 'Tu base de datos', about: SOFTWARE,
    scene: 'abstract glowing stacked data cylinders connected by soft light lines on a deep navy background',
    points: [
      'Base de datos a medida: clientes, proveedores y proyectos en un solo lugar',
      'Búsqueda y filtros instantáneos',
      'Importación desde Excel o CSV',
      'Historial de cambios y respaldos automáticos',
      'Reportes y exportación de datos',
      'Cada persona entra con su cuenta, con roles y permisos',
    ] },
  { id: 'quoter', kw: /cotizador(es)?( inteligentes?)?/i, eats: /cotizador(es)?( inteligentes?)?/gi, kicker: 'Herramientas', title: 'Cotizador inteligente', about: SOFTWARE,
    scene: 'abstract floating document sheets and glowing calculator keys in blue light',
    points: [
      'Cotizaciones profesionales en minutos, no en horas',
      'PDF con tu marca, envío por correo o WhatsApp',
      'Cálculo automático de descuentos, impuestos y totales',
      'Catálogo con precios y reglas de cálculo',
      'Seguimiento del estado de cada cotización',
      'Cada vendedor entra con su propia cuenta',
    ] },
  { id: 'crm', kw: /\bcrm\b|embudo de ventas|seguimiento de (clientes|ventas)/i, eats: /\bcrm\b|embudo de ventas|seguimiento de (clientes|ventas)/gi, kicker: 'Herramientas', title: 'CRM para tus ventas', about: SOFTWARE,
    scene: 'an abstract glowing sales funnel made of translucent layers and light particles',
    points: [
      'CRM: cada cliente y oportunidad de venta bajo control',
      'Embudo de ventas visual por etapas',
      'Historial de conversaciones y notas',
      'Recordatorios y tareas de seguimiento',
      'Se integra con el cotizador y la base de datos',
      'Reportes de ventas y desempeño del equipo',
    ] },
  { id: 'hr', kw: /gesti[oó]n de personal|recursos humanos|rr\.? ?hh|asistencia|vacaciones|emplead/i, eats: /gesti[oó]n de personal|recursos humanos|rr\.? ?hh\.?|asistencia|vacaciones|emplead\w*/gi, kicker: 'Herramientas', title: 'Gestión de personal', about: SOFTWARE,
    scene: 'abstract connected circular nodes forming a team network in soft blue light',
    points: [
      'Fichas de empleados y departamentos en un solo panel',
      'Control de asistencia diaria y registro de entrada',
      'Vacaciones y permisos con aprobación',
      'Contratos y documentos con alertas de vencimiento',
      'Calendario de equipo y cumpleaños',
      'Reportes y automatizaciones de RR.HH.',
    ] },
  { id: 'tools', kw: /herramienta|software|sistemas?\b|automatiz/i, eats: /herramientas?|software|sistemas?\b|automatiz\w*/gi, kicker: 'Herramientas', title: 'Herramientas para tu empresa', about: SOFTWARE,
    scene: 'abstract floating dashboard panels and glowing interface cards in blue and cyan',
    points: [
      'Base de datos: clientes, proveedores y proyectos en un solo lugar',
      'Cotizador inteligente: cotizaciones en PDF con tu marca',
      'CRM: contactos, embudo de ventas y seguimiento de clientes',
      'Gestión de personal: asistencia, vacaciones y contratos',
      'Portátiles: úsalas desde tu celular, tablet o computador',
      'A tu medida, con inicio de sesión seguro y permisos',
    ] },
  { id: 'pc', kw: /(optimiza\S*|limpi\S*|manten\S*)( de| del| mi| tu| los| el| un)* (pc|equipos?|notebooks?)\b|computador|\bpc\b|notebook|anydesk|optimizador|equipos? lentos?/i, eats: /(optimiza\S*|limpi\S*|manten\S*)( de| del| mi| tu| los| el| un)* (pc|equipos?|notebooks?|computador\w*)\b|computador\w*|\bpc\b|notebook\w*|anydesk|optimizador|equipos? lentos?/gi, kicker: 'Optimización de equipos', title: 'Tu computador más rápido', about: 'a remote computer optimization service',
    scene: 'a sleek laptop surrounded by abstract fast cyan light trails on a deep navy background',
    points: [
      'Optimización 100% remota de equipos Windows',
      'Express desde $14.990 por equipo: limpieza y revisión de virus',
      'Completa desde $24.990 por equipo (la más elegida), con informe',
      'Pack Oficina desde $59.990, hasta 3 equipos',
      'Sesión en vivo con AnyDesk, solo con tu autorización',
      'Usamos nuestra herramienta: el Optimizador Global Zion',
    ] },
  { id: 'custom', kw: /\breact\b|a (la )?medida|aplicaci[oó]n/i, eats: /\breact( js)?\b|a (la )?medida|aplicaci[oó]n\w*/gi, kicker: 'Desarrollo a medida', title: 'Tu proyecto, a tu medida',
    scene: 'abstract floating code blocks and modular interface pieces in blue and cyan light',
    points: [
      'Además de WordPress, desarrollamos con React JS y otras tecnologías',
      'Diseño 100% a medida, sin las limitaciones de una plantilla',
      'Calculadoras, cotizadores, paneles y filtros interactivos',
      'Elegimos la tecnología según tu negocio y tu momento',
      'Preparamos una propuesta a medida de tu proyecto',
    ] },
  { id: 'wordpress', kw: /wordpress|por qu[eé]|ventaja|beneficio/i, kicker: 'Global Zion', title: '¿Por qué WordPress?',
    scene: 'an abstract glowing blue network of connected nodes with soft light trails on a deep navy background',
    points: [
      'Tú administras tu web: editas textos e imágenes sin depender de nadie',
      'Es el sistema más usado del mundo, con gran comunidad y soporte',
      'Crece contigo: blog, tienda online, formularios y más',
      'Buen posicionamiento en Google con una base de SEO sólida',
      'Miles de plugins para sumar funciones cuando las necesites',
      'Te entregamos un panel y una capacitación corta',
    ] },
  { id: 'plans', kw: /plan|precio|cu[aá]nto|cuesta|valor|cotiz|barat|econ[oó]mic|esencial|profesional/i, kicker: 'Planes web', title: 'Elige tu plan',
    scene: 'abstract layered translucent glass panels with soft glowing blue gradients, elegant and minimal',
    points: [
      'Web Esencial desde $354.000: inicio a medida, SSL, SEO básico y WhatsApp',
      'Web Profesional desde $529.990 (la más elegida): hasta 7 páginas y blog',
      'Tienda Online desde $829.990: WooCommerce, carrito y medios de pago',
      'Presupuesto detallado, sin letra chica ni costos ocultos',
      'Valores referenciales: se ajustan al alcance de tu proyecto',
    ] },
  { id: 'time', kw: /tiempo|demora|plazo|cu[aá]nto tarda|r[aá]pid|entrega|lista|dura/i, kicker: 'Plazos', title: '¿Cuánto demora tu web?',
    scene: 'abstract flowing streaks of cyan and blue light suggesting speed, on a dark navy background',
    points: [
      'Respondemos tu consulta en menos de 24 horas hábiles',
      'Una Web Esencial queda lista en pocos días desde que nos entregas tus contenidos',
      'Plazos definidos desde el inicio, según el alcance de tu proyecto',
      'Proceso en 4 pasos: Hablamos, Diseñamos, Desarrollamos, Lanzamos',
      'Y después del lanzamiento, seguimos contigo con soporte',
    ] },
  { id: 'speed', kw: /optimi|velocidad|carga|seo|posicion|google|rendimiento|performance/i, kicker: 'Optimización', title: 'Una web rápida vende más',
    scene: 'abstract fast glowing light trails in cyan and electric blue on a dark navy background',
    points: [
      'Optimización de velocidad incluida en la Web Profesional',
      'Base de SEO para que Google te encuentre',
      'Google Analytics para medir visitas y resultados',
      'Diseño responsive: perfecto en computador, tablet y celular',
      'Mantención con optimización de rendimiento y revisión mensual',
    ] },
  { id: 'maintenance', kw: /mantenci|mantenimiento|soporte|actualiz|respaldo|backup|monitoreo/i, kicker: 'Mantención', title: 'Tu web siempre al día',
    scene: 'abstract smooth metallic gears and glowing circuit lines in blue tones',
    points: [
      'Básica desde $35.990/mes: actualizaciones, respaldos y monitoreo',
      'Profesional desde $59.990/mes (la más elegida): revisión de seguridad y soporte prioritario',
      'Premium desde $94.990/mes: cambios frecuentes y horas de desarrollo',
      'Soporte por correo y corrección de errores menores',
      'Tú te dedicas a tu negocio, nosotros a tu web',
    ] },
  { id: 'security', kw: /segur|ciber|cyber|hack|prote|\bley\b|datos|malware|firewall/i, kicker: 'Ciberseguridad', title: 'Protege tu WordPress',
    scene: 'an abstract glowing translucent shield shape with floating digital particles, deep blue',
    points: [
      'Cyber Essential: implementación $49.990 y $24.990 al mes',
      'Cyber Professional: $69.990 + $39.990 al mes, con 2FA y firewall',
      'Cyber Business: desde $99.990 + $69.990 al mes, respaldos diarios',
      'Escaneo de vulnerabilidades e informes de seguridad',
      'Prepárate para la Ley 21.719 de datos personales (1 dic 2026)',
    ] },
  { id: 'store', kw: /tienda|ecommerce|e-commerce|vend|woocommerce|carrito|pago/i, kicker: 'Tienda online', title: 'Vende 24/7 con tu tienda',
    scene: 'abstract floating 3D geometric shapes in blue and cyan with soft shadows',
    points: [
      'Tienda Online desde $829.990 con WordPress + WooCommerce',
      'Catálogo, carrito y checkout listos para vender',
      'Medios de pago y envíos configurados',
      'SSL y Google Analytics incluidos',
      'Tú gestionas productos y pedidos desde tu panel',
    ] },
  { id: 'how', kw: /proceso|c[oó]mo trabaj|pasos|empez|etapas/i, kicker: 'Así trabajamos', title: 'De la idea a tu web en 4 pasos',
    scene: 'an abstract rising path of glowing steps in a gradient of blue light',
    points: [
      '1 · Hablamos: entendemos tu negocio y tus objetivos',
      '2 · Diseñamos: diseño personalizado, no plantillas',
      '3 · Desarrollamos: en WordPress, rápido y responsive',
      '4 · Lanzamos: dominio, hosting y capacitación',
      'Después, soporte y mantención cuando lo necesites',
    ] },
  { id: 'trust', kw: /confian|transpar|cercan|valor|nosotros|equipo|por qu[eé] elegir/i, kicker: 'Global Zion', title: 'Por qué elegirnos',
    scene: 'abstract soft overlapping circles in calm blue gradients, trustworthy and clean',
    points: [
      'Transparencia: presupuesto claro y sin costos ocultos',
      'Cercanía: te respondemos en menos de 24 horas hábiles',
      'Calidad: diseño personalizado, probado en todos tus dispositivos',
      'Soporte después del lanzamiento',
      'Lenguaje simple, sin tecnicismos',
    ] },
  { id: 'services', kw: /servicio|qu[eé] (hacen|hacemos|ofrec)|ofrecen|ofrecemos/i, kicker: 'Global Zion', title: 'Lo que hacemos por ti', about: 'a digital agency offering websites, online stores and business software',
    scene: 'abstract connected glowing modules in blue and cyan on a deep navy background',
    points: [
      'Páginas web en WordPress y desarrollo a medida con React JS',
      'Tiendas online listas para vender',
      'Mantención y optimización de tu sitio',
      'Ciberseguridad para tu WordPress',
      'Herramientas: base de datos, cotizador, CRM y gestión de personal',
      'Optimización remota de equipos Windows',
    ] },
  { id: 'growth',kw: /emprend|pyme|negocio|cliente|crec|presencia/i, kicker: 'Para tu negocio', title: 'Haz crecer tu negocio online',
    scene: 'abstract ascending glowing bars and light particles in blue and cyan',
    points: [
      'Una web profesional que transmite confianza a tus clientes',
      'Diseño pensado para convertir visitantes en clientes',
      'Formulario de contacto y botón de WhatsApp para que te escriban',
      'Integración con tus redes sociales',
      'Webs para agencias, legal, inmobiliarias, restaurantes y comercio',
    ] },
]

/**
 * Elige los temas según lo que escribió el usuario (pueden ser varios) y arma el contenido de la publicación:
 * título, etiqueta, y entre 4 y 6 puntos explicativos. Sin texto, elige un tema al azar.
 */
export function buildContent(text) {
  let rest = text
  const hits = ANGLES.filter((a) => {
    const hit = a.kw.test(rest)
    if (hit && a.eats) rest = rest.replace(a.eats, ' ')
    return hit
  })
  // Sin coincidencias: si el usuario escribió algo, va el resumen de servicios; si no escribió nada, un tema al azar
  const fallback = text.trim() ? ANGLES.find((a) => a.id === 'services') : ANGLES[Math.floor(Math.random() * ANGLES.length)]
  const main = hits.length ? hits : [fallback]
  // Reparte los puntos entre los temas pedidos (en orden), hasta 6
  const points = []
  for (let i = 0; points.length < 6 && main.some((a) => a.points[i]); i++) {
    for (const a of main) if (a.points[i] && points.length < 6) points.push(a.points[i])
  }
  // Si hay pocos, completa con el resto del primer tema
  const more = main[0].points.filter((p) => !points.includes(p))
  while (points.length < 4 && more.length) points.push(more.shift())
  const first = main[0]
  return {
    angle: first,
    kicker: main.length > 1 ? 'Global Zion' : first.kicker,
    // Las herramientas comparten etiqueta: al combinar temas se usa su nombre para que el título no se repita
    title: main.length > 1 ? main.map((a) => (a.kicker === 'Herramientas' ? a.title : a.kicker)).slice(0, 2).join(' + ') : first.title,
    points,
    scene: first.scene,
    about: first.about || 'web design and website creation',
  }
}

// Fondos curados (sobrios, de la paleta de Global Zion). Los usa el generador automático y el selector de fondos del editor.
export const BG_PRESETS = [
  { id: 'zion', name: 'Zion', dark: true, c1: '#020618', c2: '#0f2a5c', c3: '#1d6fb8', angle: 160 },
  { id: 'ocean', name: 'Océano', dark: true, c1: '#0b1b3f', c2: '#1d6fb8', c3: '', angle: 140 },
  { id: 'midnight', name: 'Medianoche', dark: true, c1: '#020618', c2: '#0b1b3f', c3: '#0e7490', angle: 170 },
  { id: 'royal', name: 'Real', dark: true, c1: '#0f2a5c', c2: '#2b82cf', c3: '', angle: 135 },
  { id: 'slate', name: 'Pizarra', dark: true, c1: '#0f172a', c2: '#1e293b', c3: '#334155', angle: 160 },
  { id: 'teal', name: 'Petróleo', dark: true, c1: '#06283d', c2: '#0e7490', c3: '', angle: 150 },
  { id: 'cloud', name: 'Nube', dark: false, c1: '#ffffff', c2: '#dcebfa', c3: '', angle: 160 },
  { id: 'ice', name: 'Hielo', dark: false, c1: '#f4f9ff', c2: '#cfe3f7', c3: '', angle: 135 },
]
