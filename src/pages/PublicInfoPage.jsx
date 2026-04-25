import { Link } from 'react-router-dom';
import { useSeoMeta } from '../lib/seo';
import { SITE_ORIGIN } from '../lib/siteConfig';

const PAGES = {
  terms: {
    title: 'Términos | Mansión Deseo',
    heading: 'Términos de uso',
    description: 'Condiciones generales de uso de Mansión Deseo para adultos registrados.',
    body: [
      'Mansión Deseo es una comunidad privada para personas mayores de 18 años. El acceso y uso del sitio implica actuar con respeto, consentimiento y responsabilidad.',
      'Cada usuario es responsable por la información que comparte, por sus interacciones y por cumplir las normas aplicables en su jurisdicción.',
      'La plataforma puede moderar, limitar o suspender cuentas cuando detecte abuso, suplantación, contenido no permitido o conductas contrarias a la seguridad de la comunidad.',
    ],
  },
  privacy: {
    title: 'Privacidad | Mansión Deseo',
    heading: 'Privacidad',
    description: 'Información de privacidad para usuarios y visitantes de Mansión Deseo.',
    body: [
      'La privacidad es parte central de la experiencia. Usamos datos de cuenta, sesión y actividad para operar el servicio, proteger accesos y mejorar la comunidad.',
      'No mostramos contenido privado completo en la landing pública. Las fotos, mensajes y preferencias viven dentro del área reservada para usuarios registrados.',
      'Podés actualizar tu perfil, ajustar tu visibilidad y cerrar sesión desde la app. Para consultas de privacidad, usá el canal de ayuda.',
    ],
  },
  help: {
    title: 'Ayuda | Mansión Deseo',
    heading: 'Ayuda',
    description: 'Canales de ayuda y soporte de Mansión Deseo.',
    body: [
      'Si necesitás ayuda con tu cuenta, acceso, pagos o seguridad, contactá al equipo de soporte.',
      'Incluí tu usuario o email de registro y una descripción breve del problema para que podamos revisar tu caso con más precisión.',
      'Si querés reportar una conducta dentro de la comunidad, usá también las herramientas de reporte disponibles en los perfiles.',
    ],
  },
};

export default function PublicInfoPage({ type }) {
  const page = PAGES[type] || PAGES.help;

  useSeoMeta({
    title: page.title,
    description: page.description,
    canonical: `${SITE_ORIGIN}/${type === 'terms' ? 'terminos' : type === 'privacy' ? 'privacidad' : 'ayuda'}/`,
  });

  return (
    <main className="min-h-screen bg-mansion-base px-6 py-8 text-text-primary sm:px-8 lg:px-10">
      <div className="mx-auto max-w-3xl">
        <Link to="/" className="inline-flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-mansion-crimson to-mansion-crimson-dark flex items-center justify-center">
            <span className="font-display text-white text-sm font-bold">M</span>
          </div>
          <span className="font-display text-[17px] font-semibold text-gradient-gold" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>
            Mansión Deseo
          </span>
        </Link>

        <section className="mt-12 rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl sm:p-8">
          <h1 className="font-display text-4xl font-bold text-text-primary">{page.heading}</h1>
          <div className="mt-6 space-y-4 text-sm leading-7 text-text-muted sm:text-base">
            {page.body.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </div>
          {type === 'help' && (
            <a
              href="mailto:soporte@mansiondeseo.com"
              className="mt-8 inline-flex rounded-full bg-mansion-gold px-5 py-3 text-sm font-semibold text-black transition-all hover:brightness-110"
            >
              Contactar soporte
            </a>
          )}
        </section>
      </div>
    </main>
  );
}
