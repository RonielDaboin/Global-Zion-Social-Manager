import { t, useLang, getLang, locale } from '../lib/i18n.jsx'
import { Logo, ThemeToggle, LangToggle } from './ui.jsx'
import { BUILD_DATE, COMPANY, LEGAL_UPDATED, SITE, VERSION, WHATSAPP } from '../lib/appInfo.js'

/** Pie de página: derechos reservados (el año se actualiza solo), privacidad, términos y versión. */
export function Footer({ className = '' }) {
  useLang()
  return (
    <footer className={'app-foot ' + className}>
      <span>© {new Date().getFullYear()} {COMPANY}. {t('Todos los derechos reservados.')}</span>
      <nav aria-label={t('Información legal')}>
        <a href="#/privacy">{t('Política de privacidad')}</a>
        <a href="#/terms">{t('Términos y condiciones')}</a>
        <span className="ver" title={BUILD_DATE ? `${t('Compilación')} ${BUILD_DATE}` : undefined}>V{VERSION}</span>
      </nav>
    </footer>
  )
}

// Contenido legal en ambos idiomas. Los textos están pensados para esta app (Global Zion Social Manager).
const DOCS = {
  privacy: {
    es: {
      title: 'Política de privacidad',
      intro: `Esta política explica qué datos trata Global Zion Social Manager (la «App»), operada por ${COMPANY} (${SITE}), para qué los usa y qué derechos tienes.`,
      sections: [
        ['1. Datos que tratamos', [
          'Cuenta: nombre, correo y foto de perfil cuando inicias sesión con Google o con correo y contraseña.',
          'Datos de contacto opcionales (teléfono, ciudad/país y canal preferido) que tú agregas en tu perfil, para avisarte si hay un problema con tu cuenta o el servicio.',
          'Redes conectadas: al conectar Instagram, Facebook o Gmail guardamos los identificadores de tu cuenta/página y un token de acceso entregado por Meta o Google. Los tokens se guardan en el servidor y no son accesibles desde el navegador.',
          'Contenido: las publicaciones, imágenes, videos, textos y programaciones que creas en la App.',
          'Uso de la IA: un registro del número de peticiones por proveedor, sin el contenido de tus textos.',
          'Datos técnicos mínimos del navegador (por ejemplo idioma y tema) guardados en tu propio dispositivo.',
        ]],
        ['2. Para qué los usamos', [
          'Para que puedas crear, programar y publicar contenido en tus redes, y enviar correos desde tu cuenta de Gmail cuando tú lo pidas.',
          'Para generar textos e imágenes con inteligencia artificial cuando usas esas funciones.',
          'Para mostrar tu consumo de cupos de IA y mantener la seguridad y el funcionamiento de la App.',
          'No vendemos tus datos ni los usamos para publicidad.',
        ]],
        ['3. Servicios de terceros', [
          'Supabase (base de datos, autenticación y almacenamiento de archivos).',
          'Meta (Instagram y Facebook) y Google (inicio de sesión y Gmail): solo actuamos con los permisos que tú autorizas. Su uso de los datos se rige por sus propias políticas.',
          'IA: Google Gemini (puede recibir tu tema, textos, imágenes o fotogramas de video para generar o evaluar contenido), Cloudflare Workers AI y Pollinations (reciben la descripción de la imagen que pides). Usamos planes gratuitos; no incluyas información confidencial en esas funciones.',
          'Google Fonts (carga de tipografías).',
        ]],
        ['4. Archivos publicados', [
          'Para publicar en redes, las imágenes y videos se suben a un almacenamiento con enlace público, porque Instagram y Facebook necesitan descargarlos desde una URL. Quien tenga el enlace puede verlos; evita subir material privado.',
        ]],
        ['5. Conservación y eliminación', [
          'Conservamos tus datos mientras tengas una cuenta activa. Puedes desconectar una red en cualquier momento desde «Cuentas», lo que elimina sus tokens de nuestros servidores.',
          `Para eliminar tu cuenta y todos tus datos (incluidos los obtenidos de Meta o Google), escríbenos por WhatsApp al ${WHATSAPP} o desde ${SITE}. Lo haremos en un plazo máximo de 30 días. También puedes revocar el acceso desde la configuración de tu cuenta de Meta o de Google.`,
        ]],
        ['6. Tus derechos', [
          'Puedes solicitar acceso, rectificación, supresión, oposición y portabilidad de tus datos personales, conforme a la legislación chilena de protección de datos personales (Ley N.º 19.628 y sus modificaciones, incluida la Ley N.º 21.719).',
        ]],
        ['7. Seguridad y menores', [
          'Aplicamos medidas razonables de seguridad (conexión cifrada, tokens fuera del navegador, acceso restringido por usuario). Ningún sistema es 100 % infalible.',
          'La App no está dirigida a menores de 14 años.',
        ]],
        ['8. Cambios y contacto', [
          'Podemos actualizar esta política; publicaremos la nueva versión aquí con su fecha.',
          `Contacto: ${COMPANY} · ${SITE} · WhatsApp ${WHATSAPP}.`,
        ]],
      ],
    },
    en: {
      title: 'Privacy policy',
      intro: `This policy explains what data Global Zion Social Manager (the “App”), operated by ${COMPANY} (${SITE}), processes, why, and what rights you have.`,
      sections: [
        ['1. Data we process', [
          'Account: name, email and profile picture when you sign in with Google or with email and password.',
          'Optional contact details (phone, city/country and preferred channel) that you add in your profile, so we can reach you if there is a problem with your account or the service.',
          'Connected networks: when you connect Instagram, Facebook or Gmail we store your account/page identifiers and an access token issued by Meta or Google. Tokens are stored on the server and are not accessible from the browser.',
          'Content: the posts, images, videos, texts and schedules you create in the App.',
          'AI usage: a count of requests per provider, without the content of your texts.',
          'Minimal browser data (such as language and theme) stored on your own device.',
        ]],
        ['2. What we use it for', [
          'To let you create, schedule and publish content on your networks, and send emails from your Gmail account when you ask us to.',
          'To generate texts and images with artificial intelligence when you use those features.',
          'To show your AI quota usage and keep the App secure and working.',
          'We do not sell your data or use it for advertising.',
        ]],
        ['3. Third-party services', [
          'Supabase (database, authentication and file storage).',
          'Meta (Instagram and Facebook) and Google (sign-in and Gmail): we only act with the permissions you authorize. Their use of data is governed by their own policies.',
          'AI: Google Gemini (may receive your topic, texts, images or video frames to generate or review content), Cloudflare Workers AI and Pollinations (receive the description of the image you request). We use free plans; do not include confidential information in these features.',
          'Google Fonts (typeface loading).',
        ]],
        ['4. Published files', [
          'To publish on social networks, images and videos are uploaded to storage with a public link, because Instagram and Facebook must download them from a URL. Anyone with the link can view them; avoid uploading private material.',
        ]],
        ['5. Retention and deletion', [
          'We keep your data while you have an active account. You can disconnect a network at any time from “Accounts”, which removes its tokens from our servers.',
          `To delete your account and all your data (including data obtained from Meta or Google), message us on WhatsApp at ${WHATSAPP} or through ${SITE}. We will do it within 30 days. You can also revoke access from your Meta or Google account settings.`,
        ]],
        ['6. Your rights', [
          'You may request access, rectification, deletion, objection and portability of your personal data, under Chilean data protection law (Law No. 19,628 and its amendments, including Law No. 21,719).',
        ]],
        ['7. Security and minors', [
          'We apply reasonable security measures (encrypted connection, tokens kept out of the browser, per-user access control). No system is 100% infallible.',
          'The App is not directed at children under 14.',
        ]],
        ['8. Changes and contact', [
          'We may update this policy; the new version will be published here with its date.',
          `Contact: ${COMPANY} · ${SITE} · WhatsApp ${WHATSAPP}.`,
        ]],
      ],
    },
  },
  terms: {
    es: {
      title: 'Términos y condiciones',
      intro: `Al usar Global Zion Social Manager (la «App»), operada por ${COMPANY} (${SITE}), aceptas estos términos.`,
      sections: [
        ['1. Qué es la App', [
          'Una herramienta para diseñar, programar y publicar contenido en redes sociales y enviar correos, con ayuda opcional de inteligencia artificial.',
        ]],
        ['2. Tu cuenta', [
          'Eres responsable de mantener la seguridad de tu acceso y de la actividad realizada con tu cuenta. Debes tener al menos 14 años y permisos sobre las cuentas y páginas que conectes.',
        ]],
        ['3. Uso aceptable', [
          'No uses la App para spam, contenido ilegal, engañoso, que infrinja derechos de terceros o que incumpla las normas de Instagram, Facebook, TikTok, Google u otras plataformas.',
          'Eres el único responsable del contenido que publicas y de contar con los derechos sobre imágenes, videos, música y textos.',
        ]],
        ['4. Contenido generado con IA', [
          'Los textos e imágenes generados por IA pueden contener errores o parecerse a otros contenidos. Revísalos antes de publicar. Los proveedores de IA gratuitos tienen cupos diarios y pueden fallar o cambiar sin aviso.',
        ]],
        ['5. Servicios de terceros', [
          'La App depende de Meta, Google, Supabase y otros proveedores. Sus condiciones, límites y cambios (por ejemplo, en sus APIs) pueden afectar el funcionamiento; no controlamos su disponibilidad. Las publicaciones programadas solo se envían mientras la App esté abierta.',
        ]],
        ['6. Propiedad intelectual', [
          `La App, su diseño y su código pertenecen a ${COMPANY}. El contenido que creas sigue siendo tuyo; nos autorizas a procesarlo solo para prestarte el servicio.`,
        ]],
        ['7. Disponibilidad y responsabilidad', [
          'La App se entrega «tal cual», sin garantía de funcionamiento ininterrumpido. En la medida que la ley lo permita, no respondemos por pérdidas indirectas, pérdida de datos, bloqueos de cuentas en redes sociales ni resultados de tus publicaciones.',
        ]],
        ['8. Suspensión y cambios', [
          'Podemos suspender cuentas que incumplan estos términos. Podemos modificar la App y estos términos; el uso continuado tras los cambios implica su aceptación.',
        ]],
        ['9. Ley aplicable y contacto', [
          `Estos términos se rigen por las leyes de Chile. Contacto: ${COMPANY} · ${SITE} · WhatsApp ${WHATSAPP}.`,
        ]],
      ],
    },
    en: {
      title: 'Terms and conditions',
      intro: `By using Global Zion Social Manager (the “App”), operated by ${COMPANY} (${SITE}), you accept these terms.`,
      sections: [
        ['1. What the App is', [
          'A tool to design, schedule and publish social media content and send emails, with optional help from artificial intelligence.',
        ]],
        ['2. Your account', [
          'You are responsible for keeping your access secure and for activity under your account. You must be at least 14 and have permission over the accounts and pages you connect.',
        ]],
        ['3. Acceptable use', [
          'Do not use the App for spam, or content that is illegal, misleading, infringes third-party rights or breaks the rules of Instagram, Facebook, TikTok, Google or other platforms.',
          'You are solely responsible for the content you publish and for holding the rights to images, videos, music and texts.',
        ]],
        ['4. AI-generated content', [
          'AI-generated texts and images may contain errors or resemble other content. Review them before publishing. Free AI providers have daily quotas and may fail or change without notice.',
        ]],
        ['5. Third-party services', [
          'The App depends on Meta, Google, Supabase and other providers. Their terms, limits and changes (for example to their APIs) may affect how it works; we do not control their availability. Scheduled posts are only sent while the App is open.',
        ]],
        ['6. Intellectual property', [
          `The App, its design and code belong to ${COMPANY}. The content you create remains yours; you authorize us to process it only to provide the service.`,
        ]],
        ['7. Availability and liability', [
          'The App is provided “as is”, with no guarantee of uninterrupted operation. To the extent permitted by law, we are not liable for indirect losses, data loss, social media account restrictions or the results of your posts.',
        ]],
        ['8. Suspension and changes', [
          'We may suspend accounts that breach these terms. We may modify the App and these terms; continued use after changes means you accept them.',
        ]],
        ['9. Governing law and contact', [
          `These terms are governed by the laws of Chile. Contact: ${COMPANY} · ${SITE} · WhatsApp ${WHATSAPP}.`,
        ]],
      ],
    },
  },
}

/** Página pública (se ve sin iniciar sesión): #/privacy y #/terms. */
export default function Legal({ doc }) {
  useLang()
  const d = DOCS[doc][getLang()] || DOCS[doc].es
  const date = new Date(LEGAL_UPDATED + 'T12:00:00').toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' })
  return (
    <div className="legal">
      <div className="legal-top">
        <a href="#/" className="legal-back">← {t('Volver a la App')}</a>
        <div className="row" style={{ gap: 8 }}><LangToggle /><ThemeToggle /></div>
      </div>
      <article className="legal-card">
        <Logo />
        <h1>{d.title}</h1>
        <p className="muted small">{t('Última actualización')}: {date}</p>
        <p>{d.intro}</p>
        {d.sections.map(([h, ps]) => (
          <section key={h}>
            <h2>{h}</h2>
            {ps.map((p, i) => <p key={i}>{p}</p>)}
          </section>
        ))}
        <p className="legal-links"><a href="#/privacy">{t('Política de privacidad')}</a> · <a href="#/terms">{t('Términos y condiciones')}</a></p>
      </article>
      <Footer />
    </div>
  )
}
