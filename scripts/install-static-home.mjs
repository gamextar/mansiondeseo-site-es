import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

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
  'historia/nueva',
  'login',
  'mensajes',
  'monedas',
  'pago-exitoso',
  'pago-fallido',
  'pago-monedas-exitoso',
  'pago-pendiente',
  'perfil',
  'ranking',
  'recuperar-contrasena',
  'registro',
  'seguidores',
  'videos',
  'vip',
]);

async function addSitemapRoutes() {
  try {
    const sitemap = await readFile(sitemapPath, 'utf8');
    for (const match of sitemap.matchAll(/<loc>(https:\/\/mansiondeseo\.com\/[^<]*)<\/loc>/g)) {
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
  const htmlCache = '  Cache-Control: public, max-age=0, s-maxage=600, stale-while-revalidate=86400';
  const blocks = [
    `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n${htmlCache}`,
    `/assets/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable`,
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

const staticHomeHtml = `<!doctype html>
<html lang="es" style="background:#08080e;color-scheme:dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Mansión Deseo | Club privado para adultos registrados</title>
  <meta name="description" content="Comunidad privada para adultos registrados, pensada para parejas liberales, swingers, tríos y conexiones discretas con perfiles verificados." />
  <meta name="keywords" content="parejas liberales, swingers, cuckold, tríos, contactossex, intercambio de parejas, comunidad liberal, club privado adultos" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://mansiondeseo.com/" />
  <meta name="theme-color" content="#08080E" />
  <meta name="color-scheme" content="dark" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" type="image/svg+xml" href="/icon.svg" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Mansión Deseo" />
  <meta property="og:title" content="Mansión Deseo | Club privado para adultos registrados" />
  <meta property="og:description" content="Comunidad privada para adultos registrados, pensada para parejas liberales, swingers, tríos y conexiones discretas con perfiles verificados." />
  <meta property="og:image" content="https://mansiondeseo.com/icon-512.png" />
  <meta property="og:url" content="https://mansiondeseo.com/" />
  <meta property="og:locale" content="es_AR" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Mansión Deseo | Club privado para adultos registrados" />
  <meta name="twitter:description" content="Comunidad privada para adultos registrados, pensada para parejas liberales, swingers, tríos y conexiones discretas." />
  <meta name="twitter:image" content="https://mansiondeseo.com/icon-512.png" />
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite","name":"Mansión Deseo","alternateName":"Mansion Deseo","url":"https://mansiondeseo.com/","description":"Club privado para adultos registrados, parejas liberales, swingers y conexiones discretas.","inLanguage":"es-AR"}</script>
  <script>
    (function(){
      try {
        var hasToken = !!localStorage.getItem('mansion_token');
        var registered = localStorage.getItem('mansion_registered') === 'true';
        if (hasToken || registered) location.replace('/feed/');
      } catch (_) {}
    })();
  </script>
  <style>
    :root{--bg:#08080e;--panel:#11111a;--panel2:#17151f;--text:#f6efe6;--muted:rgba(246,239,230,.68);--dim:rgba(246,239,230,.48);--gold:#c9a84c;--gold2:#f0d98b;--crimson:#9b2b40;--line:rgba(255,255,255,.09)}
    *{box-sizing:border-box}html{background:var(--bg)}body{margin:0;background:radial-gradient(circle at 72% 8%,rgba(201,168,76,.14),transparent 26rem),radial-gradient(circle at 12% 10%,rgba(155,43,64,.22),transparent 24rem),linear-gradient(180deg,#0b0a11 0%,#08080e 70%);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh}a{color:inherit;text-decoration:none}.wrap{width:min(1160px,calc(100% - 32px));margin:0 auto;padding:22px 0 48px}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:10px 0 24px}.brand{display:flex;align-items:center;gap:12px}.mark{width:42px;height:42px;border-radius:16px;background:linear-gradient(135deg,var(--crimson),#54172a);display:grid;place-items:center;font-family:Georgia,serif;font-weight:800;box-shadow:0 18px 42px rgba(155,43,64,.22)}.brand-text{font-family:Georgia,"Times New Roman",serif;font-size:22px;color:var(--gold2)}.top-actions{display:flex;align-items:center;gap:10px}.link{font-size:14px;color:var(--muted)}.pill-btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:12px 18px;font-weight:700;font-size:14px}.gold{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#14100a}.ghost{border:1px solid var(--line);background:rgba(255,255,255,.045);color:var(--text)}.hero{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(320px,.95fr);gap:22px;align-items:stretch}.panel{border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.065),rgba(255,255,255,.025));border-radius:34px;box-shadow:0 30px 90px rgba(0,0,0,.34);overflow:hidden}.copy{padding:42px}.badge{display:inline-flex;border:1px solid rgba(201,168,76,.26);background:rgba(201,168,76,.09);color:rgba(240,217,139,.92);border-radius:999px;padding:9px 13px;font-size:12px;letter-spacing:.06em}.title{font-family:Georgia,"Times New Roman",serif;font-weight:500;letter-spacing:-.045em;font-size:clamp(46px,7vw,86px);line-height:.94;margin:24px 0 0}.lead{max-width:680px;margin:22px 0 0;color:var(--muted);font-size:18px;line-height:1.75}.cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}.visual{min-height:520px;position:relative;background:radial-gradient(circle at 50% 20%,rgba(240,217,139,.16),transparent 18rem),linear-gradient(145deg,#1b141d,#09080d 62%);display:flex;align-items:flex-end;padding:26px}.orb{position:absolute;border-radius:999px;filter:blur(.2px);opacity:.78}.orb.one{width:185px;height:185px;left:16%;bottom:21%;background:linear-gradient(145deg,rgba(201,168,76,.28),rgba(155,43,64,.14))}.orb.two{width:230px;height:230px;right:12%;bottom:15%;background:linear-gradient(145deg,rgba(155,43,64,.32),rgba(201,168,76,.1))}.orb.three{width:150px;height:150px;left:40%;bottom:31%;background:linear-gradient(145deg,rgba(255,255,255,.16),rgba(201,168,76,.1))}.visual-card{position:relative;z-index:2;border:1px solid var(--line);background:rgba(0,0,0,.24);backdrop-filter:blur(14px);border-radius:24px;padding:18px;color:var(--muted);font-size:14px;line-height:1.65}.strip{display:grid;grid-template-columns:1.1fr .9fr;gap:18px;margin-top:18px}.mini{padding:24px}.eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:rgba(201,168,76,.86)}.stat{font-family:Georgia,"Times New Roman",serif;font-size:50px;line-height:1;margin-top:12px}.muted{color:var(--muted);line-height:1.65}.tags{display:flex;flex-wrap:wrap;gap:9px;margin-top:15px}.tag{border:1px solid var(--line);background:rgba(0,0,0,.18);border-radius:999px;padding:8px 12px;font-size:12px;color:rgba(255,255,255,.78)}@media(max-width:900px){.wrap{width:min(100% - 24px,680px);padding-top:14px}.hero,.strip{grid-template-columns:1fr}.copy{padding:26px}.visual{min-height:360px}.top{align-items:flex-start}.brand-text{font-size:20px}.top-actions{gap:8px}.top-actions .link{display:none}.pill-btn{padding:11px 15px}.title{font-size:clamp(42px,13vw,68px)}}
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
        <span class="badge">+18 · Acceso privado para adultos</span>
        <h1 class="title">Una comunidad privada con química real.</h1>
        <p class="lead">Mansión Deseo es una entrada discreta para adultos registrados que buscan parejas liberales, swingers, tríos y conexiones de nicho dentro de un entorno más cuidado.</p>
        <div class="cta">
          <a class="pill-btn gold" href="/registro/">Empezar ahora</a>
          <a class="pill-btn ghost" href="/login/">Ya tengo cuenta</a>
        </div>
      </div>
      <div class="panel visual" aria-label="Ambiente premium de Mansión Deseo">
        <span class="orb one"></span><span class="orb two"></span><span class="orb three"></span>
        <div class="visual-card">No es una red abierta. La experiencia completa vive adentro: perfiles, historias y mensajes para adultos registrados.</div>
      </div>
    </section>

    <section class="strip">
      <div class="panel mini">
        <div class="eyebrow">Últimas búsquedas</div>
        <div class="tags">
          <a class="tag" href="/parejas-liberales/">Parejas liberales</a>
          <a class="tag" href="/swingers/">Swingers</a>
          <a class="tag" href="/cornudos-argentina/">Cornudos</a>
          <a class="tag" href="/cuckold-argentina/">Cuckold</a>
          <a class="tag" href="/hotwife-argentina/">Hotwife</a>
        </div>
      </div>
      <div class="panel mini">
        <div class="eyebrow">Acceso privado</div>
        <div class="stat">+18</div>
        <p class="muted">El contenido completo, la interacción y los perfiles detallados quedan reservados para usuarios registrados.</p>
      </div>
    </section>
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
await writeFile(redirectsPath, `/ /index.html 200\n/* /app/index.html 200\n`, 'utf8');
console.log(`Installed static home and ${appRoutes.size} static SPA route entries`);
