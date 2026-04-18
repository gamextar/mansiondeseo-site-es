import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_SEO_LOCALE, getSeoLocale } from '../src/lib/seoLocales.js';
import { buildSeoCanonical, buildSeoPath } from '../src/lib/seoRouting.js';
import { getSeoIntentPage } from '../src/lib/seoIntentCatalog.js';

const DIST_DIR = path.resolve('dist');
const redirectsPath = path.join(DIST_DIR, '_redirects');
const STATIC_SEO_VARIANTS = [
  'parejas',
  'trios',
  'swingers',
  'cuckold-argentina',
  'cornudos-argentina',
  'contactossex',
];

const RELATED_LABELS = {
  parejas: 'Parejas liberales',
  trios: 'Tríos',
  swingers: 'Swingers',
  'cuckold-argentina': 'Cuckold',
  'cornudos-argentina': 'Cornudos',
  contactossex: 'Contactossex',
};

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeJsonScript(value) {
  return JSON.stringify(value).replaceAll('</', '<\\/');
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

function routePath(variant) {
  return buildSeoPath({ locale: DEFAULT_SEO_LOCALE, variant });
}

function canonicalUrl(variant) {
  return ensureTrailingSlash(buildSeoCanonical({ locale: DEFAULT_SEO_LOCALE, variant }));
}

function relatedLinks(activeVariant) {
  return STATIC_SEO_VARIANTS
    .filter((variant) => variant !== activeVariant)
    .map((variant) => ({
      href: ensureTrailingSlash(routePath(variant)),
      label: RELATED_LABELS[variant] || variant,
    }));
}

function buildStructuredData({ page, variant, canonical, locale }) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: page.title,
      description: page.description,
      url: canonical,
      inLanguage: locale.hreflang,
      isPartOf: {
        '@type': 'WebSite',
        name: 'Mansión Deseo',
        url: 'https://mansiondeseo.com/',
      },
      about: [
        { '@type': 'Thing', name: page.focus },
        { '@type': 'Thing', name: 'adultos registrados' },
        { '@type': 'Thing', name: 'encuentros discretos' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Mansión Deseo',
          item: 'https://mansiondeseo.com/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: RELATED_LABELS[variant] || page.focus,
          item: canonical,
        },
      ],
    },
  ];
}

function renderSeoPage(variant) {
  const locale = getSeoLocale(DEFAULT_SEO_LOCALE);
  const page = getSeoIntentPage(DEFAULT_SEO_LOCALE, variant);
  const canonical = canonicalUrl(variant);
  const currentPath = ensureTrailingSlash(routePath(variant));
  const related = relatedLinks(variant);
  const structuredData = buildStructuredData({ page, variant, canonical, locale });
  const visibleFaq = page.faq || [];

  return `<!doctype html>
<html lang="${escapeHtml(locale.language)}" style="background:#08080e;color-scheme:dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.description)}" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${escapeHtml(canonical)}" />
  <meta name="theme-color" content="#08080E" />
  <meta name="color-scheme" content="dark" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" type="image/svg+xml" href="/icon.svg" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Mansión Deseo" />
  <meta property="og:title" content="${escapeHtml(page.title)}" />
  <meta property="og:description" content="${escapeHtml(page.description)}" />
  <meta property="og:image" content="https://mansiondeseo.com/icon-512.png" />
  <meta property="og:url" content="${escapeHtml(canonical)}" />
  <meta property="og:locale" content="${escapeHtml(locale.hreflang.replace('-', '_'))}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(page.title)}" />
  <meta name="twitter:description" content="${escapeHtml(page.description)}" />
  <meta name="twitter:image" content="https://mansiondeseo.com/icon-512.png" />
  <script type="application/ld+json">${escapeJsonScript(structuredData)}</script>
  <style>
    :root{--bg:#08080e;--paper:#11111a;--paper2:#17151f;--ink:#f6efe6;--soft:rgba(246,239,230,.7);--dim:rgba(246,239,230,.5);--gold:#c9a84c;--gold2:#f0d98b;--red:#9b2b40;--line:rgba(255,255,255,.1)}
    *{box-sizing:border-box}html{background:var(--bg)}body{margin:0;min-height:100vh;background:radial-gradient(circle at 74% -8%,rgba(201,168,76,.18),transparent 31rem),radial-gradient(circle at 10% 18%,rgba(155,43,64,.22),transparent 25rem),linear-gradient(180deg,#0b0a11,#08080e 72%);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit;text-decoration:none}.wrap{width:min(1160px,calc(100% - 32px));margin:0 auto;padding:22px 0 54px}.top{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:10px 0 26px}.brand{display:flex;align-items:center;gap:12px}.mark{display:grid;place-items:center;width:42px;height:42px;border-radius:16px;background:linear-gradient(135deg,var(--red),#54172a);font-family:Georgia,serif;font-weight:800;box-shadow:0 18px 42px rgba(155,43,64,.24)}.brand strong{font-family:Georgia,"Times New Roman",serif;font-size:22px;color:var(--gold2);font-weight:600}.nav{display:flex;gap:10px;align-items:center}.nav a,.btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:12px 17px;font-size:14px;font-weight:700}.nav .ghost,.btn.ghost{border:1px solid var(--line);background:rgba(255,255,255,.045);color:var(--ink)}.btn.gold{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#171107}.hero{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(315px,.92fr);gap:22px;align-items:stretch}.panel{border:1px solid var(--line);border-radius:34px;background:linear-gradient(180deg,rgba(255,255,255,.064),rgba(255,255,255,.026));box-shadow:0 30px 90px rgba(0,0,0,.34);overflow:hidden}.copy{padding:42px}.kicker{display:inline-flex;border:1px solid rgba(201,168,76,.28);background:rgba(201,168,76,.09);color:rgba(240,217,139,.94);border-radius:999px;padding:9px 13px;font-size:12px;letter-spacing:.08em;text-transform:uppercase}.title{max-width:800px;margin:22px 0 0;font-family:Georgia,"Times New Roman",serif;font-size:clamp(42px,6.7vw,78px);font-weight:500;letter-spacing:-.045em;line-height:.96}.lead{max-width:700px;margin:22px 0 0;color:var(--soft);font-size:18px;line-height:1.75}.cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}.aside{padding:28px;background:radial-gradient(circle at 80% 10%,rgba(201,168,76,.13),transparent 17rem),linear-gradient(145deg,rgba(23,21,31,.94),rgba(8,8,14,.96))}.aside h2,.section h2{font-family:Georgia,"Times New Roman",serif;font-weight:500;letter-spacing:-.03em}.aside h2{margin:0;font-size:30px}.bullets{display:grid;gap:12px;margin:22px 0 0;padding:0;list-style:none}.bullets li{border:1px solid rgba(255,255,255,.08);border-radius:22px;background:rgba(0,0,0,.2);padding:15px;color:var(--soft);line-height:1.55}.focus{margin-top:18px;border:1px solid rgba(201,168,76,.18);border-radius:24px;background:rgba(201,168,76,.075);padding:18px;color:var(--soft);line-height:1.65}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.section{padding:26px}.section h2{margin:0;font-size:30px}.faq{display:grid;gap:13px;margin-top:18px}.qa{border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.16);border-radius:22px;padding:17px}.qa h3{margin:0;font-size:15px}.qa p,.section p{color:var(--soft);line-height:1.65}.links{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}.tag{border:1px solid var(--line);background:rgba(0,0,0,.19);border-radius:999px;padding:9px 13px;font-size:12px;color:rgba(255,255,255,.78)}.foot{margin-top:18px;color:var(--dim);font-size:12px;text-align:center}@media(max-width:900px){.wrap{width:min(100% - 24px,680px);padding-top:14px}.hero,.grid{grid-template-columns:1fr}.copy{padding:26px}.top{align-items:flex-start}.brand strong{font-size:20px}.nav a:first-child{display:none}.title{font-size:clamp(40px,12vw,64px)}}
  </style>
</head>
<body>
  <main class="wrap">
    <nav class="top" aria-label="Principal">
      <a class="brand" href="/" aria-label="Mansión Deseo">
        <span class="mark">M</span>
        <strong>Mansión Deseo</strong>
      </a>
      <div class="nav">
        <a class="ghost" href="/login/">Iniciar sesión</a>
        <a class="btn gold" href="/registro/">Registrarme</a>
      </div>
    </nav>

    <section class="hero">
      <article class="panel copy">
        <span class="kicker">+18 · Landing pública SEO</span>
        <h1 class="title">${escapeHtml(page.headline)}</h1>
        <p class="lead">${escapeHtml(page.intro)}</p>
        <div class="cta">
          <a class="btn gold" href="/registro/">Crear cuenta privada</a>
          <a class="btn ghost" href="/login/">Ya tengo cuenta</a>
        </div>
      </article>
      <aside class="panel aside">
        <h2>Qué encontrás</h2>
        <ul class="bullets">
          ${page.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n          ')}
        </ul>
        <div class="focus">
          Foco de búsqueda: <strong>${escapeHtml(page.focus)}</strong>. La interacción, los perfiles completos y los mensajes quedan reservados para usuarios registrados.
        </div>
      </aside>
    </section>

    <section class="grid">
      <article class="panel section">
        <h2>Preguntas frecuentes</h2>
        <div class="faq">
          ${visibleFaq.map(([question, answer]) => `<div class="qa"><h3>${escapeHtml(question)}</h3><p>${escapeHtml(answer)}</p></div>`).join('\n          ')}
        </div>
      </article>
      <article class="panel section">
        <h2>Más búsquedas</h2>
        <p>Estas páginas refuerzan el enlazado interno de las intenciones principales sin exponer contenido privado.</p>
        <div class="links">
          ${related.map((item) => `<a class="tag" href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`).join('\n          ')}
        </div>
        <p class="foot">URL estática generada: ${escapeHtml(currentPath)}</p>
      </article>
    </section>
  </main>
</body>
</html>`;
}

async function writeSeoPage(variant) {
  const route = routePath(variant).replace(/^\/+|\/+$/g, '');
  const outputDir = path.join(DIST_DIR, ...route.split('/'));
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'index.html'), renderSeoPage(variant), 'utf8');
}

async function updateRedirects() {
  let redirects = '';
  try {
    redirects = await readFile(redirectsPath, 'utf8');
  } catch {
    redirects = '';
  }

  const seoRules = STATIC_SEO_VARIANTS.flatMap((variant) => {
    const route = routePath(variant);
    const target = `${ensureTrailingSlash(route)}index.html`;
    return [
      `${route} ${target} 200`,
      `${ensureTrailingSlash(route)} ${target} 200`,
    ];
  });
  const existingLines = redirects
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !seoRules.includes(line));

  await writeFile(redirectsPath, `${[...seoRules, ...existingLines].join('\n')}\n`, 'utf8');
}

await Promise.all(STATIC_SEO_VARIANTS.map(writeSeoPage));
await updateRedirects();
console.log(`Generated ${STATIC_SEO_VARIANTS.length} static SEO pages`);
