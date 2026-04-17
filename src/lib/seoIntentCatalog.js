import { DEFAULT_SEO_LOCALE } from './seoLocales.js';

const SEO_INTENT_PAGES = {
  'es-ar': {
    parejas: {
      title: 'Parejas en Mansión Deseo | Encuentros privados para adultos registrados',
      description: 'Descubrí parejas, contactos discretos y perfiles afines en una comunidad privada para adultos registrados, con verificación y acceso controlado.',
      headline: 'Parejas, complicidad y encuentros discretos',
      intro: 'Una puerta de entrada pública para quienes buscan contactos entre parejas, parejas abiertas y propuestas afines dentro de una comunidad privada para adultos.',
      focus: 'parejas',
      bullets: ['Contactos entre parejas y perfiles afines', 'Búsquedas por intención, afinidad y discreción', 'Acceso solo para adultos registrados'],
      faq: [
        ['¿Es público el contenido?', 'La entrada es pública, pero el contenido completo queda dentro del sitio para usuarios registrados.'],
        ['¿Para quién está pensado?', 'Para adultos que buscan relaciones discretas, parejas abiertas y encuentros afines.'],
      ],
    },
    trios: {
      title: 'Tríos en Mansión Deseo | Búsquedas discretas para adultos registrados',
      description: 'Explorá una comunidad privada para adultos registrados que buscan tríos, encuentros compartidos y conexiones discretas.',
      headline: 'Tríos, química clara y coordinación sin exposición',
      intro: 'Una landing pensada para búsquedas de tríos donde la intención suele ser muy concreta: encontrar química, límites compatibles y una dinámica compartida dentro de una comunidad privada.',
      focus: 'tríos',
      bullets: ['Búsquedas de tríos con intención clara y filtros reales', 'Ambiente privado, discreto y verificado', 'Perfiles con actividad, fotos y stories tras el registro'],
      faq: [
        ['¿Esta página está pensada específicamente para tríos?', 'Sí. La idea es captar esa búsqueda puntual y llevarla a una experiencia privada donde la compatibilidad importa más que la exposición pública.'],
        ['¿Se puede ver todo sin registrarse?', 'No. La parte pública presenta la propuesta, pero el contenido completo y la interacción quedan reservados a usuarios registrados.'],
      ],
    },
    swingers: {
      title: 'Swingers en Mansión Deseo | Comunidad privada para adultos registrados',
      description: 'Encontrá una comunidad orientada a swingers, parejas abiertas y contactos privados para adultos registrados.',
      headline: 'Swingers, código compartido y acceso privado',
      intro: 'Pensada para parejas y adultos que buscan una dinámica swinger con reglas claras, afinidad real y un entorno más cuidado que las redes abiertas.',
      focus: 'swingers',
      bullets: ['Perfiles orientados a parejas abiertas y dinámica swinger', 'Búsqueda por afinidades, límites y preferencias', 'Registro privado y acceso controlado'],
      faq: [
        ['¿Esta landing está pensada para público swinger real?', 'Sí. Está enfocada en esa intención específica y en derivar el tráfico a una experiencia privada con filtros y perfiles verificados.'],
        ['¿El sitio es abierto?', 'No. La presentación es pública para SEO, pero el contenido completo y la interacción quedan dentro del sitio.'],
      ],
    },
    'parejas-liberales': {
      title: 'Parejas Liberales en Mansión Deseo | Comunidad privada para adultos registrados',
      description: 'Conocé una comunidad privada para parejas liberales, parejas abiertas y búsquedas discretas con perfiles verificados.',
      headline: 'Parejas liberales, complicidad y filtros con criterio',
      intro: 'Una entrada pública pensada para búsquedas de parejas liberales donde pesa tanto la afinidad como la discreción: una puerta de entrada hacia una comunidad privada con perfiles verificados.',
      focus: 'parejas liberales',
      bullets: ['Búsquedas de parejas liberales y parejas abiertas', 'Perfiles verificados con afinidad real y contexto', 'Acceso completo solo para adultos registrados'],
      faq: [
        ['¿La comunidad está pensada para parejas liberales?', 'Sí. La landing apunta a esa intención puntual y funciona como entrada hacia una experiencia privada con filtros, perfiles y registro.'],
        ['¿Qué diferencia hay con una búsqueda genérica de parejas?', 'Acá la intención está más definida: parejas abiertas, afinidad consensuada y un entorno más alineado con esa dinámica.'],
      ],
    },
    'intercambio-de-parejas': {
      title: 'Intercambio de Parejas en Mansión Deseo | Comunidad privada para adultos registrados',
      description: 'Explorá una comunidad privada orientada a intercambio de parejas, encuentros discretos y perfiles verificados para adultos registrados.',
      headline: 'Intercambio de parejas con intención clara y sin ruido',
      intro: 'Una landing diseñada para búsquedas de intercambio de parejas donde lo importante es encontrar afinidad, acuerdos claros y una dinámica consensuada dentro de una comunidad privada.',
      focus: 'intercambio de parejas',
      bullets: ['Búsquedas de intercambio de parejas con filtros reales', 'Perfiles verificados, afinidad privada y contexto', 'Acceso completo solo para adultos registrados'],
      faq: [
        ['¿La landing sirve para búsquedas de intercambio de parejas?', 'Sí. Está creada para cubrir esa intención de forma clara, sin mezclarla con una propuesta demasiado genérica.'],
        ['¿El sitio muestra todo sin registro?', 'No. Solo la puerta de entrada pública; el detalle de perfiles e interacción queda reservado a usuarios registrados.'],
      ],
    },
    mujeres: {
      title: 'Mujeres en Mansión Deseo | Perfiles privados para adultos registrados',
      description: 'Explorá perfiles de mujeres dentro de una comunidad privada para adultos registrados, con foco en discreción, afinidad y registro.',
      headline: 'Mujeres, afinidad y conversaciones privadas',
      intro: 'Una entrada pública para búsquedas centradas en mujeres, con acceso a perfiles y funciones completas tras el registro.',
      focus: 'mujeres',
      bullets: ['Perfiles de mujeres con afinidad real', 'Acceso privado al detalle completo', 'Registro rápido para adultos'],
      faq: [
        ['¿Puedo ver perfiles completos?', 'Solo una vista pública; el acceso total requiere registro.'],
        ['¿Sirve para captar búsquedas?', 'Sí, porque cubre la intención de búsqueda sin exponer contenido privado.'],
      ],
    },
    hombres: {
      title: 'Hombres en Mansión Deseo | Perfiles privados para adultos registrados',
      description: 'Descubrí perfiles de hombres y una comunidad privada para adultos registrados con afinidad, filtros y discreción.',
      headline: 'Hombres, filtros y encuentros afines',
      intro: 'Una página de entrada pública para búsquedas centradas en hombres, ideal para llevar tráfico orgánico al registro.',
      focus: 'hombres',
      bullets: ['Búsquedas por sexo e intención', 'Perfil privado y verificado', 'Acceso completo luego del registro'],
      faq: [
        ['¿Se indexa el contenido privado?', 'No, solo esta entrada pública y el contenido preparado para captación.'],
        ['¿Puedo usarla como landing?', 'Sí, está pensada para eso.'],
      ],
    },
    trans: {
      title: 'Trans en Mansión Deseo | Comunidad privada para adultos registrados',
      description: 'Una comunidad privada para adultos registrados con búsquedas trans, perfiles verificados y acceso discreto.',
      headline: 'Trans, visibilidad y acceso discreto',
      intro: 'Una página clara y respetuosa para búsquedas trans, diseñada para captar intención sin mostrar contenido privado.',
      focus: 'trans',
      bullets: ['Búsquedas trans con filtros reales', 'Contenido privado para registrados', 'Landing con enfoque respetuoso'],
      faq: [
        ['¿El contenido es público?', 'No. La página pública solo presenta la propuesta general.'],
        ['¿Qué ventaja tiene SEO?', 'Te permite posicionar una intención concreta sin exponer el área privada.'],
      ],
    },
    'cuckold-argentina': {
      title: 'Cuckold Argentina | Encuentros privados para adultos registrados',
      description: 'Una landing pública para búsquedas de cuckold en Argentina, con una comunidad privada, perfiles verificados y acceso discreto.',
      headline: 'Cuckold Argentina, nicho claro y acceso discreto',
      intro: 'Una entrada pública pensada para captar búsquedas de cuckold en Argentina sin diluir esa intención en términos más amplios, y derivarla a una experiencia privada para adultos registrados.',
      focus: 'cuckold argentina',
      bullets: ['Búsquedas de cuckold en Argentina', 'Perfiles afines, verificados y con contexto', 'Acceso completo tras el registro'],
      faq: [
        ['¿La página apunta específicamente a búsquedas cuckold?', 'Sí. Está pensada para captar esa intención exacta y llevarla a una comunidad privada con acceso registrado.'],
        ['¿Esto es público?', 'Solo la puerta de entrada. El contenido completo y la interacción quedan para usuarios registrados.'],
      ],
    },
    contactossex: {
      title: 'Contactossex | Alternativa privada para adultos registrados',
      description: 'Si buscás Contactossex, descubrí una alternativa privada para adultos registrados con perfiles verificados, discreción y acceso controlado.',
      headline: 'Si buscás Contactossex, esta es una alternativa más privada',
      intro: 'Una landing orientada a capturar búsquedas de Contactossex y convertirlas en registro dentro de Mansión Deseo, con una propuesta más enfocada en privacidad, filtrado y comunidad verificada.',
      focus: 'contactossex',
      bullets: ['Alternativa privada a Contactossex', 'Perfiles verificados, discretos y con filtros reales', 'Acceso completo solo para registrados'],
      faq: [
        ['¿Es el mismo sitio?', 'No. Es una alternativa propia, con otra propuesta de producto y foco en privacidad, afinidad y comunidad verificada.'],
        ['¿Qué se puede ver sin registrarse?', 'Solo esta landing pública. El detalle completo de perfiles, stories y mensajes sigue siendo privado.'],
      ],
    },
    'contactossex-argentina': {
      title: 'Contactossex Argentina | Alternativa privada para adultos registrados',
      description: 'Si buscás contactossex argentina, descubrí una alternativa privada para adultos registrados con perfiles verificados, discreción y acceso controlado.',
      headline: 'Contactossex Argentina, acceso privado y perfiles verificados',
      intro: 'Una landing pensada para captar la búsqueda exacta de contactossex argentina y llevar tráfico a una experiencia privada para adultos registrados.',
      focus: 'contactossex',
      bullets: ['Búsqueda exacta de contactossex argentina', 'Perfiles verificados y discretos', 'Acceso completo solo para registrados'],
      faq: [
        ['¿Qué captura esta página?', 'Captura búsquedas exactas de contactossex argentina y variantes cercanas.'],
        ['¿Hay contenido público completo?', 'No, solo la puerta de entrada pública.'],
      ],
    },
    'cornudos-argentina': {
      title: 'Cornudos Argentina | Comunidad privada para adultos registrados',
      description: 'Una landing pública para búsquedas de cornudos en Argentina, con comunidad privada, perfiles verificados y acceso discreto.',
      headline: 'Cornudos Argentina, nicho definido y acceso privado',
      intro: 'Una entrada pública pensada para captar búsquedas de cornudos y cornudo en Argentina, sin mezclar esa intención con una propuesta demasiado general, y llevarla a una experiencia privada.',
      focus: 'cornudos',
      bullets: ['Búsquedas de cornudos y cornudo en Argentina', 'Perfiles afines, verificados y discretos', 'Acceso completo tras el registro'],
      faq: [
        ['¿La página apunta a ese nicho concreto?', 'Sí. Está pensada para búsquedas muy específicas y funciona como puerta de entrada hacia una comunidad privada con registro.'],
        ['¿Esto es público?', 'Solo la puerta de entrada. El contenido completo queda para usuarios registrados.'],
      ],
    },
    'hotwife-argentina': {
      title: 'Hotwife Argentina | Comunidad privada para adultos registrados',
      description: 'Una landing pública para búsquedas hotwife en Argentina, con comunidad privada, perfiles verificados y acceso discreto.',
      headline: 'Hotwife Argentina, intención específica y acceso discreto',
      intro: 'Una entrada pública pensada para captar búsquedas hotwife en Argentina sin diluir esa intención en términos más amplios, y llevarlas a una experiencia privada para adultos registrados.',
      focus: 'hotwife argentina',
      bullets: ['Búsquedas hotwife en Argentina', 'Perfiles afines, verificados y discretos', 'Acceso completo tras el registro'],
      faq: [
        ['¿Esta página apunta a búsquedas hotwife?', 'Sí. Está diseñada para captar esa intención específica y derivarla a una comunidad privada con registro.'],
        ['¿Se puede explorar todo desde esta página?', 'No. La landing es pública, pero la experiencia completa está reservada a usuarios registrados.'],
      ],
    },
  },
  'es-es': {},
  'en-us': {},
};

export function getSeoIntentCatalog(locale = DEFAULT_SEO_LOCALE) {
  return SEO_INTENT_PAGES[locale] || SEO_INTENT_PAGES[DEFAULT_SEO_LOCALE] || {};
}

export function getSeoIntentPage(locale = DEFAULT_SEO_LOCALE, variant = 'parejas') {
  const catalog = getSeoIntentCatalog(locale);
  const fallbackCatalog = getSeoIntentCatalog(DEFAULT_SEO_LOCALE);
  return catalog[variant] || fallbackCatalog[variant] || fallbackCatalog.parejas;
}
