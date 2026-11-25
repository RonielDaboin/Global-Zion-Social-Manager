// Ficha de www.globalzion.cl que la IA usa al escribir textos. Copiada de los datos de la web (24-11-2026).
// Si cambia la web (herramientas, precios, servicios), actualiza aquí y en src/lib/brand.js, y vuelve a desplegar
// generate-caption y generate-texts.

export const KNOWLEDGE = `INFORMACIÓN OFICIAL DE GLOBAL ZION (www.globalzion.cl)
Agencia chilena (Región Metropolitana de Santiago). WhatsApp +56 9 3070 1132 · contacto@globalzion.cl · Instagram @globalzion.cl.
Horario: lunes a jueves 09:00-18:00, viernes 09:00-14:00. Los precios están en pesos chilenos y son referenciales.

HERRAMIENTAS PARA EMPRESAS (www.globalzion.cl/herramientas). Son cuatro:
1. Base de datos: clientes, proveedores y proyectos en un solo lugar; búsqueda y filtros; importación desde Excel o CSV; historial de cambios y respaldos automáticos; reportes y exportación.
2. Cotizador inteligente: catálogo con precios y reglas de cálculo; cotizaciones en PDF con la marca del cliente; descuentos, impuestos y totales automáticos; envío por correo o WhatsApp; seguimiento e historial de cotizaciones. La web muestra una demostración en video.
3. CRM: ficha de cada cliente y contacto; embudo de ventas visual; historial de conversaciones y notas; recordatorios de seguimiento; integración con el cotizador y la base de datos; reportes de ventas.
4. Gestión de personal: fichas de empleados y departamentos; asistencia diaria; vacaciones y permisos con aprobación; contratos y documentos con alertas de vencimiento; calendario de equipo; reportes de RR.HH.
Todas son portátiles (celular, tablet y computador), se adaptan a cada empresa y tienen inicio de sesión seguro con perfiles y permisos. También se crean otras herramientas a medida. No tienen precio publicado: se cotizan.

OPTIMIZACIÓN DE EQUIPOS: remota, para computadores Windows, con AnyDesk, en vivo y solo con autorización del cliente, usando el Optimizador Global Zion (herramienta propia).
Express desde $14.990 por equipo. Completa desde $24.990 por equipo (la más elegida; incluye respaldo previo, actualizaciones e informe). Pack Oficina desde $59.990 hasta 3 equipos.

DESARROLLO WEB: principalmente WordPress; también React JS y otras tecnologías a medida. Diseño web, tiendas online, diseño responsive, optimización y mantenimiento.
Web Esencial desde $354.000. Web Profesional desde $529.990 (la más elegida; hasta 7 páginas y blog). Tienda Online desde $829.990 (WordPress + WooCommerce).
Proceso: Hablamos, Diseñamos, Desarrollamos, Lanzamos. Una web esencial suele estar lista en pocos días desde la entrega de contenidos. Se responde en menos de 24 horas hábiles.

MANTENCIÓN MENSUAL: Básica desde $35.990. Profesional desde $59.990 (la más elegida). Premium desde $94.990.

CIBERSEGURIDAD (WordPress):
Cyber Essential: implementación $49.990 + $24.990 al mes (protección de acceso, escaneo de vulnerabilidades, informe).
Cyber Professional (la más elegida): implementación $69.990 + $39.990 al mes (agrega 2FA por correo, firewall WAF de Cloudflare, escaneo de malware y respaldos semanales).
Cyber Business: implementación desde $99.990 + $69.990 al mes (agrega respaldos diarios, revisión semanal y soporte prioritario).
La Ley 21.719 de datos personales entra en vigencia el 1 de diciembre de 2026.

PROYECTOS DE MUESTRA (ejemplos de lo que se puede crear, no son casos de clientes): NextCore Systems, Verlar & Ríos Consultora Legal, Numbrao Agency, Hogar Bright, Ardor Cocina Viva y Áurea Inmobiliaria.
La web también tiene un blog.`

// Reglas de uso de la ficha, comunes a todas las funciones que escriben textos
export const KNOWLEDGE_RULES = 'Usa esa información solo cuando el tema o la imagen tengan relación con Global Zion o sus servicios; si tratan de otra cosa, ignórala. Cuando hables de Global Zion, no inventes herramientas, servicios, precios, plazos ni cifras que no estén ahí. Si el tema pide "las herramientas", se refiere a las cuatro herramientas para empresas.'
