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
    'parejas-liberales': {
      title: 'Parejas liberales | Comunidad privada para adultos registrados',
      description: 'Una entrada pública para parejas liberales en Argentina, con perfiles verificados, discreción y acceso privado para adultos registrados.',
      headline: 'Parejas liberales, afinidad y discreción real',
      intro: 'Una landing pensada para quienes buscan parejas liberales, parejas abiertas y encuentros afines dentro de una comunidad privada para adultos registrados.',
      focus: 'parejas liberales',
      bullets: ['Búsquedas de parejas liberales y parejas abiertas', 'Perfiles afines con acceso privado', 'Contenido completo solo para usuarios registrados'],
      faq: [
        ['¿El contenido completo es público?', 'No. Esta página es una entrada pública; los perfiles completos, historias y mensajes quedan detrás del registro.'],
        ['¿Para quién está pensada?', 'Para adultos que buscan parejas liberales, afinidad real y una experiencia más discreta.'],
      ],
    },
    trios: {
      title: 'Tríos en Mansión Deseo | Búsquedas discretas para adultos registrados',
      description: 'Explorá una comunidad privada para adultos registrados que buscan tríos, encuentros compartidos y conexiones discretas.',
      headline: 'Tríos, química y propuestas sin ruido',
      intro: 'Una landing pensada para búsquedas de tríos y experiencias compartidas, con contenido privado detrás del registro.',
      focus: 'tríos',
      bullets: ['Búsquedas de tríos y experiencias compartidas', 'Ambiente privado, discreto y verificado', 'Perfiles con actividad, fotos y stories'],
      faq: [
        ['¿Se puede ver todo sin registrarse?', 'No. La experiencia completa queda reservada a usuarios registrados.'],
        ['¿Qué muestra esta página?', 'Una introducción pública para captar la intención de búsqueda correcta.'],
      ],
    },
    swingers: {
      title: 'Swingers en Mansión Deseo | Comunidad privada para adultos registrados',
      description: 'Encontrá una comunidad orientada a swingers, parejas abiertas y contactos privados para adultos registrados.',
      headline: 'Swingers, apertura y encuentros privados',
      intro: 'Pensada para parejas y adultos que buscan una experiencia social más abierta, con discreción, control y perfiles verificados.',
      focus: 'swingers',
      bullets: ['Perfiles orientados a parejas abiertas', 'Búsqueda por afinidades y preferencias', 'Registro privado y acceso controlado'],
      faq: [
        ['¿Esto es para todos?', 'Está orientado a adultos que realmente buscan ese tipo de dinámica.'],
        ['¿El sitio es abierto?', 'La presentación es pública; el contenido completo, no.'],
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
      headline: 'Cuckold Argentina, discreción y afinidad real',
      intro: 'Una entrada pública pensada para captar búsquedas de cuckold en Argentina y llevarlas a una experiencia privada para adultos registrados.',
      focus: 'cuckold argentina',
      bullets: ['Búsquedas de cuckold en Argentina', 'Perfiles afines y verificados', 'Acceso completo tras el registro'],
      faq: [
        ['¿Esto es público?', 'Solo la puerta de entrada. El contenido completo queda para usuarios registrados.'],
        ['¿Sirve para posicionar la búsqueda?', 'Sí, porque ataca la intención principal con contenido propio y relevante.'],
      ],
    },
    'hotwife-argentina': {
      title: 'Hotwife Argentina | Comunidad privada para adultos registrados',
      description: 'Landing pública para búsquedas de hotwife en Argentina, con comunidad privada, perfiles verificados y acceso discreto para adultos registrados.',
      headline: 'Hotwife Argentina, deseo compartido y acceso privado',
      intro: 'Una entrada pública para búsquedas de hotwife en Argentina, orientada a llevar tráfico de alta intención hacia una experiencia privada y cuidada.',
      focus: 'hotwife argentina',
      bullets: ['Búsquedas de hotwife en Argentina', 'Afinidad, discreción y perfiles verificados', 'Acceso completo tras el registro'],
      faq: [
        ['¿Esta página muestra contenido explícito?', 'No. Es una landing pública de intención; la experiencia completa queda reservada a usuarios registrados.'],
        ['¿Por qué tener una página específica?', 'Porque hotwife es una búsqueda con intención propia y conviene tratarla con una landing clara, rápida y dedicada.'],
      ],
    },
    contactossex: {
      title: 'Contactossex | Alternativa privada para adultos registrados',
      description: 'Si buscás Contactossex, descubrí una alternativa privada para adultos registrados con perfiles verificados, discreción y acceso controlado.',
      headline: 'Si buscás Contactossex, esta es tu alternativa privada',
      intro: 'Una landing orientada a capturar búsquedas de Contactossex y convertirlas en registro dentro de Mansión Deseo.',
      focus: 'contactossex',
      bullets: ['Alternativa privada a Contactossex', 'Perfiles verificados y discretos', 'Acceso completo solo para registrados'],
      faq: [
        ['¿Es el mismo sitio?', 'No. Es una alternativa propia con foco en privacidad y comunidad verificada.'],
        ['¿Puedo entrar sin registrarme?', 'Solo a esta landing; el contenido completo sigue siendo privado.'],
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
      headline: 'Cornudos Argentina, discreción y afinidad real',
      intro: 'Una entrada pública pensada para captar búsquedas de cornudos y cornudo en Argentina, con acceso privado para adultos registrados.',
      focus: 'cornudos',
      bullets: ['Búsquedas de cornudos y cornudo en Argentina', 'Perfiles afines y verificados', 'Acceso completo tras el registro'],
      faq: [
        ['¿Esto es público?', 'Solo la puerta de entrada. El contenido completo queda para usuarios registrados.'],
        ['¿Sirve para posicionar la búsqueda?', 'Sí, porque ataca la intención principal con contenido propio y relevante.'],
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
