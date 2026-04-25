import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SITE_LOCALE, SITE_ORIGIN } from '../src/lib/siteConfig.js';
import { SEO_BASE_INTENTS } from '../src/lib/seoVariants.js';

const DIST_DIR = path.resolve('dist');
const indexPath = path.join(DIST_DIR, 'index.html');
const appDir = path.join(DIST_DIR, 'app');
const appPath = path.join(appDir, 'index.html');
const headersPath = path.join(DIST_DIR, '_headers');
const redirectsPath = path.join(DIST_DIR, '_redirects');
const sitemapPath = path.join(DIST_DIR, 'sitemap.xml');

const appRoutes = new Set([
  'admin',
  'bienvenida',
  'black-test',
  'configuracion',
  'explorar',
  'favoritos',
  'feed',
  'feed-shell-test',
  'full-mobile-test',
  'historia/nueva',
  'login',
  'mensajes',
  'monedas',
  'pago-exitoso',
  'pago-fallido',
  'pago-monedas-exitoso',
  'pago-pendiente',
  'perfil',
  'profile-shell-test',
  'ranking',
  'recuperar-contrasena',
  'registro',
  'safe-area-debug',
  'seguidores',
  'videos',
  'vip',
]);

async function addSitemapRoutes() {
  try {
    const sitemap = await readFile(sitemapPath, 'utf8');
    for (const match of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      const route = new URL(match[1]).pathname.replace(/^\/+|\/+$/g, '');
      if (route) appRoutes.add(route);
    }
  } catch {
    // The build can run without a sitemap in local experiments.
  }
}

async function writeAppRoute(route, html) {
  const routeDir = path.join(DIST_DIR, ...route.split('/'));
  await mkdir(routeDir, { recursive: true });
  await writeFile(path.join(routeDir, 'index.html'), html, 'utf8');
}

function buildHeaders() {
  const blocks = [
    `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Cache-Control: no-store, max-age=0, must-revalidate`,
    `/assets/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable`,
    `/sw.js\n  ! Cache-Control\n  Cache-Control: no-store, max-age=0, must-revalidate`,
    `/manifest.json\n  ! Cache-Control\n  Cache-Control: no-cache, max-age=0, must-revalidate`,
  ];
  return `${blocks.join('\n\n')}\n`;
}

function collectAppAssetHrefs(html) {
  const hrefs = [];
  const seen = new Set();
  for (const match of html.matchAll(/(?:src|href)="(\/assets\/[^"]+\.(?:js|css))"/g)) {
    const href = match[1];
    if (!seen.has(href)) {
      seen.add(href);
      hrefs.push(href);
    }
  }
  return hrefs.sort((a, b) => Number(a.endsWith('.js')) - Number(b.endsWith('.js')));
}

const appHtml = await readFile(indexPath, 'utf8');
await mkdir(appDir, { recursive: true });
await rename(indexPath, appPath);
await addSitemapRoutes();
await Promise.all([...appRoutes].map((route) => writeAppRoute(route, appHtml)));
const prewarmAssetHrefs = collectAppAssetHrefs(appHtml);
const ogLocale = SITE_LOCALE.replace('-', '_');
const staticHomeStructuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Mansión Deseo',
  alternateName: 'Mansion Deseo',
  url: `${SITE_ORIGIN}/`,
  description: 'Club privado para adultos registrados, parejas liberales, swingers y conexiones discretas.',
  inLanguage: SITE_LOCALE,
});
const intentLabelMap = {
  'parejas-liberales': 'Parejas liberales',
  trios: 'Trios',
  swingers: 'Swingers',
  contactossex: 'Contactossex',
  'cornudos-argentina': 'Cornudos',
  'cuckold-argentina': 'Cuckold',
  'hotwife-argentina': 'Hotwife',
};
const staticIntentTags = SEO_BASE_INTENTS
  .map(([variant]) => ({ href: `/${variant}/`, label: intentLabelMap[variant] || variant }))
  .slice(0, 6)
  .map((item) => `<a class="tag" href="${item.href}">${item.label}</a>`)
  .join('\n              ');

const staticHomeHtml = `<!doctype html>
	<html lang="${SITE_LOCALE.split('-')[0] || 'es'}" style="background:#08080e;color-scheme:dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>Mansión Deseo | Swingers Argentina y contactos adultos privados</title>
  <meta name="description" content="Mansión Deseo es una comunidad privada para adultos en Argentina: swingers, parejas liberales, tríos y contactos discretos con perfiles cuidados." />
  <meta name="keywords" content="swingers argentina, parejas liberales argentina, contactos adultos, intercambio de parejas, tríos argentina, comunidad liberal, club privado adultos" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${SITE_ORIGIN}/" />
  <meta name="theme-color" content="#08080E" />
  <meta name="color-scheme" content="dark" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" type="image/svg+xml" href="/icon.svg" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Mansión Deseo" />
  <meta property="og:title" content="Mansión Deseo | Swingers Argentina y contactos adultos privados" />
  <meta property="og:description" content="Comunidad privada para adultos en Argentina: swingers, parejas liberales, tríos y conexiones discretas." />
  <meta property="og:image" content="${SITE_ORIGIN}/icon-512.png" />
  <meta property="og:url" content="${SITE_ORIGIN}/" />
  <meta property="og:locale" content="${ogLocale}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Mansión Deseo | Swingers Argentina y contactos adultos privados" />
  <meta name="twitter:description" content="Comunidad privada para adultos en Argentina: swingers, parejas liberales, tríos y conexiones discretas." />
  <meta name="twitter:image" content="${SITE_ORIGIN}/icon-512.png" />
  <script type="application/ld+json">${staticHomeStructuredData}</script>
  <script>
    (function(){
      try {
        var hasToken = !!localStorage.getItem('mansion_token');
        var registered = localStorage.getItem('mansion_registered') === 'true';
        var path = location.pathname || '/';
        var isHomePath = path === '/' || path === '/index.html';
        if (hasToken || registered) {
          if (isHomePath) {
            location.replace('/feed/');
            return;
          }
          var deepTarget = path + (location.search || '') + (location.hash || '');
          location.replace('/app/?redirect=' + encodeURIComponent(deepTarget));
        }
      } catch (_) {}
    })();
  </script>
  <style>
    :root{--bg:#08080e;--panel:#11111a;--panel2:#17151f;--text:#f6efe6;--muted:rgba(246,239,230,.70);--dim:rgba(246,239,230,.50);--gold:#c9a84c;--gold2:#f0d98b;--crimson:#9b2b40;--wine:#4a1324;--line:rgba(255,255,255,.10)}
    *{box-sizing:border-box}html{background:var(--bg)}body{margin:0;min-height:100vh;background:radial-gradient(circle at 78% 4%,rgba(201,168,76,.18),transparent 25rem),radial-gradient(circle at 9% 18%,rgba(155,43,64,.27),transparent 24rem),linear-gradient(180deg,#0d0b12 0%,#08080e 68%,#050508 100%);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}a{color:inherit;text-decoration:none}.wrap{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:22px 0 54px}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 0 22px}.brand{display:flex;align-items:center;gap:12px}.mark{width:44px;height:44px;border-radius:17px;background:linear-gradient(135deg,var(--crimson),#54172a);display:grid;place-items:center;font-family:Georgia,serif;font-weight:800;box-shadow:0 18px 44px rgba(155,43,64,.24)}.brand-text{font-family:Georgia,"Times New Roman",serif;font-size:23px;color:var(--gold2)}.top-actions{display:flex;align-items:center;gap:10px}.link{font-size:14px;color:var(--muted)}.pill-btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:12px 18px;font-weight:800;font-size:14px}.gold{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#14100a;box-shadow:0 18px 36px rgba(201,168,76,.18)}.ghost{border:1px solid var(--line);background:rgba(255,255,255,.045);color:var(--text)}.hero{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(330px,.85fr);gap:22px;align-items:stretch}.panel{border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.026));border-radius:34px;box-shadow:0 30px 90px rgba(0,0,0,.36);overflow:hidden}.copy{padding:44px}.badge{display:inline-flex;border:1px solid rgba(201,168,76,.28);background:rgba(201,168,76,.10);color:rgba(240,217,139,.95);border-radius:999px;padding:9px 13px;font-size:12px;letter-spacing:.08em;text-transform:uppercase}.title{font-family:Georgia,"Times New Roman",serif;font-weight:500;letter-spacing:-.05em;font-size:clamp(46px,7vw,88px);line-height:.94;margin:24px 0 0}.lead{max-width:720px;margin:22px 0 0;color:var(--muted);font-size:18px;line-height:1.75}.cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}.hero-notes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:28px}.note{border:1px solid var(--line);background:rgba(0,0,0,.16);border-radius:18px;padding:14px}.note strong{display:block;color:var(--gold2);font-size:18px}.note span{display:block;margin-top:4px;color:var(--dim);font-size:12px;line-height:1.35}.access{padding:24px;background:linear-gradient(145deg,rgba(74,19,36,.48),rgba(8,8,14,.86) 62%)}.access-card{height:100%;border:1px solid var(--line);border-radius:26px;background:rgba(0,0,0,.26);padding:22px;display:flex;flex-direction:column;justify-content:space-between;min-height:520px;position:relative;overflow:hidden}.access-card:before{content:"";position:absolute;inset:-35% -20% auto auto;width:280px;height:280px;border-radius:999px;background:radial-gradient(circle,rgba(201,168,76,.20),transparent 62%)}.access h2{position:relative;font-family:Georgia,"Times New Roman",serif;font-size:34px;line-height:1.05;margin:0}.access p{position:relative;color:var(--muted);line-height:1.7}.fields{position:relative;display:grid;gap:10px;margin:18px 0}.fake-field{border:1px solid var(--line);background:rgba(255,255,255,.045);border-radius:16px;padding:13px 14px;color:var(--dim);font-size:14px}.role-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.role{border:1px solid rgba(201,168,76,.16);background:rgba(201,168,76,.07);border-radius:14px;padding:10px;text-align:center;font-size:12px;color:rgba(240,217,139,.92)}.fine{font-size:12px;color:var(--dim);line-height:1.55}.strip{display:grid;grid-template-columns:1fr 1fr 1fr;gap:18px;margin-top:18px}.mini{padding:24px}.eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:rgba(201,168,76,.86)}.stat{font-family:Georgia,"Times New Roman",serif;font-size:48px;line-height:1;margin-top:12px}.muted{color:var(--muted);line-height:1.65}.tags{display:flex;flex-wrap:wrap;gap:9px;margin-top:15px}.tag{border:1px solid var(--line);background:rgba(0,0,0,.18);border-radius:999px;padding:8px 12px;font-size:12px;color:rgba(255,255,255,.78)}.trust{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:18px}.trust .mini{padding:20px}.trust h3{font-size:14px;margin:0 0 8px}.trust p{margin:0;color:var(--muted);font-size:13px;line-height:1.55}.footer{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:24px;color:var(--dim);font-size:12px}.footer a{color:var(--muted)}@media(max-width:900px){.wrap{width:min(100% - 24px,700px);padding-top:14px}.hero,.strip,.trust{grid-template-columns:1fr}.copy{padding:28px}.access-card{min-height:auto}.hero-notes{grid-template-columns:1fr}.top{align-items:flex-start}.brand-text{font-size:20px}.top-actions{gap:8px}.top-actions .link{display:none}.pill-btn{padding:11px 15px}.title{font-size:clamp(42px,13vw,68px)}}
  </style>
</head>
<body>
  <main class="wrap">
    <nav class="top" aria-label="Principal">
      <a class="brand" href="/" aria-label="Mansión Deseo">
        <span class="mark">M</span>
        <span class="brand-text">Mansión Deseo</span>
      </a>
      <div class="top-actions">
        <a class="link" href="/login/">Ya tengo cuenta</a>
        <a class="pill-btn gold" href="/registro/">Empezar ahora</a>
      </div>
    </nav>

    <section class="hero">
      <div class="panel copy">
        <span class="badge">Swingers Argentina · +18 · Acceso privado</span>
        <h1 class="title">Conocé adultos con la misma curiosidad.</h1>
        <p class="lead">Mansión Deseo es una comunidad privada para adultos en Argentina: parejas liberales, swingers, tríos y contactos discretos dentro de una experiencia más cuidada, moderna y reservada.</p>
        <div class="cta">
          <a class="pill-btn gold" href="/registro/">Empezar ahora</a>
          <a class="pill-btn ghost" href="/login/">Ya tengo cuenta</a>
        </div>
        <div class="hero-notes" aria-label="Datos de la comunidad">
          <div class="note"><strong>Privado</strong><span>Tu actividad no se vincula con redes sociales.</span></div>
          <div class="note"><strong>Argentina</strong><span>Perfiles y búsquedas enfocadas en tu zona.</span></div>
          <div class="note"><strong>+18</strong><span>Acceso reservado para adultos registrados.</span></div>
        </div>
      </div>
      <div class="panel access" aria-label="Acceso a Mansión Deseo">
        <div class="access-card">
          <div>
            <h2>Entrá a la mansión con un perfil reservado.</h2>
            <p>Creá tu cuenta gratis y completá tu perfil para descubrir personas, parejas e historias privadas.</p>
            <div class="fields" aria-hidden="true">
              <div class="fake-field">Correo electrónico</div>
              <div class="fake-field">Nombre de usuario</div>
              <div class="role-grid">
                <div class="role">Mujer</div>
                <div class="role">Hombre</div>
                <div class="role">Pareja</div>
                <div class="role">Trans</div>
              </div>
            </div>
          </div>
          <div>
            <a class="pill-btn gold" style="width:100%" href="/registro/">Crear mi cuenta</a>
            <p class="fine">Registro rápido, entorno discreto y herramientas para bloquear o denunciar perfiles cuando haga falta.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="strip">
      <div class="panel mini">
        <div class="eyebrow">Búsquedas destacadas</div>
        <div class="tags">
	          ${staticIntentTags}
        </div>
      </div>
      <div class="panel mini">
        <div class="eyebrow">Comunidad</div>
        <div class="stat">3k+</div>
        <p class="muted">Perfiles de lanzamiento y usuarios reales conviven mientras crece la comunidad.</p>
      </div>
      <div class="panel mini">
        <div class="eyebrow">Experiencia</div>
        <div class="stat">24/7</div>
        <p class="muted">Feed, stories, mensajes y moderación pensados para una navegación privada.</p>
      </div>
    </section>

    <section class="trust" aria-label="Confianza y privacidad">
      <div class="panel mini"><h3>Discreción</h3><p>Sin conexión pública con redes sociales y con acceso completo dentro del área privada.</p></div>
      <div class="panel mini"><h3>Moderación</h3><p>Herramientas para reportar, bloquear y revisar perfiles desde administración.</p></div>
      <div class="panel mini"><h3>Historias privadas</h3><p>Contenido efímero y perfiles con fotos visibles según configuración.</p></div>
      <div class="panel mini"><h3>Argentina primero</h3><p>Landings, búsquedas y contenido orientados a ciudades y términos locales.</p></div>
    </section>

    <footer class="footer">
      <span>© 2026 Mansión Deseo · Sitio para mayores de 18 años.</span>
      <span><a href="/login/">Ingresar</a> · <a href="/registro/">Registrarme</a></span>
    </footer>
  </main>
  <script>
    (function(){
      var assets = ${JSON.stringify(prewarmAssetHrefs)};
      var warmed = false;
      function addLink(rel, href, as) {
        if (!href) return;
        var previous = document.querySelector('link[data-app-warm][href="' + href + '"]');
        if (previous && previous.rel === rel) return;
        if (previous && rel !== 'prefetch') previous.remove();
        var link = document.createElement('link');
        link.rel = rel;
        link.href = href;
        if (as) link.as = as;
        link.crossOrigin = 'anonymous';
        link.dataset.appWarm = 'true';
        document.head.appendChild(link);
      }
      function warm(mode) {
        if (warmed && mode !== 'preload') return;
        warmed = true;
        for (var i = 0; i < assets.length; i += 1) {
          var href = assets[i];
          var isCss = href.slice(-4) === '.css';
          if (mode === 'preload') {
            addLink(isCss ? 'preload' : 'modulepreload', href, isCss ? 'style' : undefined);
          } else {
            addLink('prefetch', href, isCss ? 'style' : 'script');
          }
        }
      }
      var idle = window.requestIdleCallback || function(cb){ return setTimeout(cb, 900); };
      idle(function(){ warm('prefetch'); }, { timeout: 1800 });
      var intentLinks = document.querySelectorAll('a[href^="/registro"],a[href^="/login"],a[href^="/feed"]');
      var events = ['pointerenter', 'focus', 'touchstart', 'mousedown'];
      for (var i = 0; i < intentLinks.length; i += 1) {
        for (var j = 0; j < events.length; j += 1) {
          intentLinks[i].addEventListener(events[j], function(){ warm('preload'); }, { once: true, passive: true });
        }
      }
    })();
  </script>
</body>
</html>`;

await writeFile(indexPath, staticHomeHtml, 'utf8');
await writeFile(headersPath, buildHeaders(), 'utf8');
await writeFile(
  redirectsPath,
  `/ /index.html 200
/mensajes/* /app/index.html 200
/perfiles/* /app/index.html 200
/* /app/index.html 200
`,
  'utf8',
);
console.log(`Installed static home and ${appRoutes.size} static SPA route entries`);
