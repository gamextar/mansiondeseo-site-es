import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SITE_LOCALE, SITE_ORIGIN } from '../src/lib/siteConfig.js';
import { SEO_BASE_INTENTS } from '../src/lib/seoVariants.js';

const DIST_DIR = path.resolve('dist');
const indexPath = path.join(DIST_DIR, 'index.html');
const appDir = path.join(DIST_DIR, 'app');
const appPath = path.join(appDir, 'index.html');
const notFoundPath = path.join(DIST_DIR, '404.html');
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
  'ayuda',
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
  'privacidad',
  'terminos',
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

function buildRedirects() {
  const appFallbackPrefixes = new Set(
    [...appRoutes]
      .map((route) => String(route || '').split('/')[0])
      .filter(Boolean)
      .map((prefix) => `/${prefix}/*`)
  );
  appFallbackPrefixes.add('/mensajes/*');
  appFallbackPrefixes.add('/perfiles/*');
  appFallbackPrefixes.add('/perfil/*');
  appFallbackPrefixes.add('/historia/*');

  return `${[
    '/ /index.html 200',
    ...[...appFallbackPrefixes]
      .sort((a, b) => a.localeCompare(b))
      .map((prefix) => `${prefix} /app/index.html 200`),
  ].join('\n')}\n`;
}

function buildNotFoundHtml() {
  return `<!doctype html>
<html lang="es" style="background:#08080e;color-scheme:dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex" />
  <title>404 | Mansión Deseo</title>
  <style>
    html,body{margin:0;min-height:100%;background:#08080e;color:#f0ede8;font-family:Inter,system-ui,sans-serif}
    main{min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center}
    h1{font-size:28px;margin:0 0 8px}
    p{margin:0;color:#888899}
  </style>
</head>
<body>
  <main>
    <div>
      <h1>Contenido no encontrado</h1>
      <p>El recurso solicitado ya no está disponible.</p>
    </div>
  </main>
</body>
</html>`;
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
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="preload" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600;700&display=swap" as="style" onload="this.onload=null;this.rel='stylesheet'" />
  <noscript><link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" /></noscript>
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
    :root{--bg:#08080e;--card:#111118;--elevated:#1a1a24;--border:#2a2a38;--text:#f0ede8;--muted:#888899;--dim:#555566;--gold:#c9a84c;--gold2:#e0c97a;--crimson:#d4183d;--crimson2:#9b1c3a;--line:rgba(255,255,255,.10)}
    *{box-sizing:border-box}
    html{background:var(--bg)}
    body{margin:0;min-height:100vh;background:var(--bg);color:#fff;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow-x:hidden}
    body:before{content:"";position:fixed;top:-140px;left:50%;width:420px;height:420px;transform:translateX(-50%);border-radius:9999px;background:rgba(212,24,61,.10);filter:blur(64px);pointer-events:none}
    body:after{content:"";position:fixed;left:-120px;bottom:0;width:280px;height:280px;border-radius:9999px;background:rgba(201,168,76,.10);filter:blur(64px);pointer-events:none}
    a{color:inherit;text-decoration:none}button,input{font:inherit}.page{position:relative;z-index:1;width:100%;max-width:1152px;min-height:100vh;margin:0 auto;padding:40px 24px 64px;display:flex;flex-direction:column}.page:before{content:"";position:fixed;right:-120px;top:33.333333%;width:300px;height:300px;border-radius:9999px;background:rgba(212,24,61,.10);filter:blur(64px);pointer-events:none;z-index:-1}.top{display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid var(--line);background:rgba(255,255,255,.04);border-radius:24px;padding:12px 16px;backdrop-filter:blur(16px)}
    .brand{display:flex;align-items:center;gap:8px}.mark{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,var(--crimson),var(--crimson2));display:grid;place-items:center;font-family:"Playfair Display",Georgia,serif;font-size:14px;font-weight:700;color:#fff}.brand-text{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:17px;font-weight:600;background:linear-gradient(90deg,var(--gold),var(--gold2),var(--gold));-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 2px 8px rgba(0,0,0,.35)}
    .login-inline{position:relative;display:grid;width:100%;grid-template-columns:1fr;gap:8px;align-items:start}.home-input{height:40px;width:100%;border:1px solid var(--line);background:rgba(255,255,255,.05);border-radius:999px;padding:8px 16px;color:var(--text);font-size:14px;outline:none}.home-input::placeholder{color:var(--dim)}.home-input:focus{border-color:rgba(201,168,76,.50);box-shadow:0 0 0 4px rgba(201,168,76,.10)}.login-btn{height:40px;border:0;border-radius:999px;background:var(--gold);padding:0 20px;color:#000;font-size:14px;font-weight:700;cursor:pointer;transition:filter .18s ease,opacity .18s ease}.login-btn:hover{filter:brightness(1.1)}.login-btn:disabled{cursor:wait;opacity:.70}.login-error{grid-column:1/-1;margin:0;color:var(--crimson);font-size:12px;text-align:left}
    .hero{display:grid;flex:1;align-items:center;gap:48px;padding:56px 0;grid-template-columns:1fr}.badge{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--line);background:rgba(255,255,255,.05);border-radius:999px;padding:8px 16px;color:var(--muted);font-size:12px;font-weight:500;backdrop-filter:blur(8px)}.badge svg,.badge-icon{color:var(--gold);width:16px;height:16px}.title{max-width:768px;margin:24px 0 0;font-family:"Playfair Display",Georgia,serif;font-size:36px;line-height:1.25;font-weight:700;color:#fff}.lead{max-width:672px;margin:20px 0 0;color:var(--muted);font-size:16px;line-height:28px}.cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}.pill-btn{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:12px 24px;font-size:14px;font-weight:700;transition:filter .18s ease,background .18s ease}.gold{background:var(--gold);color:#000}.gold:hover{filter:brightness(1.1)}.ghost{border:1px solid var(--line);background:rgba(255,255,255,.05);color:#fff}.ghost:hover{background:rgba(255,255,255,.10)}.tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:32px}.tag{border:1px solid var(--line);background:rgba(255,255,255,.05);border-radius:999px;padding:6px 12px;color:var(--muted);font-size:12px;font-weight:500}.tag:hover{color:#fff}
    .showcase{border:1px solid var(--line);background:rgba(255,255,255,.04);border-radius:32px;padding:20px;box-shadow:0 30px 80px rgba(0,0,0,.35);backdrop-filter:blur(18px)}.inner{border:1px solid var(--line);background:rgba(0,0,0,.30);border-radius:24px;padding:20px}.showcase-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.eyebrow{margin:0;color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.18em}.showcase h2{margin:8px 0 0;font-size:24px;line-height:1.2}.icon-box{width:48px;height:48px;border-radius:16px;background:rgba(201,168,76,.15);display:grid;place-items:center;color:var(--gold)}.features{margin-top:24px;display:grid;gap:12px}.feature{border:1px solid var(--line);background:rgba(255,255,255,.03);border-radius:16px;padding:16px;display:flex;align-items:flex-start;gap:12px}.feature-icon{flex:0 0 auto;width:40px;height:40px;border-radius:12px;background:rgba(201,168,76,.10);display:grid;place-items:center;color:var(--gold)}.feature-title{margin:0;color:#fff;font-size:14px;font-weight:700}.feature-text{margin:4px 0 0;color:var(--muted);font-size:14px;line-height:1.55}.footer{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:24px;color:var(--dim);font-size:12px}.footer nav{display:flex;flex-wrap:wrap;gap:16px}.footer a{color:var(--dim)}.footer a:hover{color:var(--muted)}
    @media(min-width:640px){.page{padding-left:32px;padding-right:32px}.top{flex-direction:row;align-items:center;justify-content:space-between;padding-left:20px;padding-right:20px}.login-inline{width:auto;grid-template-columns:minmax(11rem,13rem) minmax(9rem,11rem) auto}.login-error{text-align:right}.title{font-size:48px}.lead{font-size:18px}}
    @media(min-width:1024px){.page{padding-left:40px;padding-right:40px}.hero{grid-template-columns:1.15fr .85fr;padding:80px 0}.title{font-size:60px}}
    @media(max-width:639px){.page{padding-top:24px}.top{flex-direction:column;align-items:stretch}.showcase{border-radius:24px}.footer{flex-direction:column}.footer nav{gap:12px}}
  </style>
</head>
<body>
  <main class="page">
    <header class="top">
      <a class="brand" href="/" aria-label="Mansión Deseo">
        <span class="mark">M</span>
        <span class="brand-text">Mansión Deseo</span>
      </a>
      <form class="login-inline" id="homeLogin" autocomplete="off">
        <input class="home-input" id="homeLoginEmail" type="email" name="email" placeholder="Email" autocomplete="off" inputmode="email" tabindex="-1" readonly data-defer-focus required />
        <input class="home-input" id="homeLoginPassword" type="password" name="password" placeholder="Contraseña" autocomplete="off" tabindex="-1" readonly data-defer-focus required />
        <button class="login-btn" id="homeLoginSubmit" type="submit">Entrar</button>
        <p class="login-error" id="homeLoginError" role="alert" aria-live="polite"></p>
      </form>
    </header>

    <section class="hero" aria-label="Mansión Deseo">
      <div>
        <div class="badge"><span class="badge-icon">✦</span> Acceso privado para adultos registrados</div>
        <h1 class="title">Una comunidad privada para perfiles reales, afinidad y discrecion total.</h1>
        <p class="lead">Mansion Deseo funciona como puerta de entrada publica y experiencia privada: landings indexables para captar busquedas locales y una app cerrada para explorar perfiles verificados, historias, mensajes y conexiones con afinidad real.</p>
        <div class="cta">
          <a class="pill-btn gold" href="/registro/">Registrarme →</a>
        </div>
        <div class="tags">
          ${staticIntentTags}
        </div>
      </div>

      <aside class="showcase" aria-label="Qué encontrás">
        <div class="inner">
          <div class="showcase-head">
            <div>
              <p class="eyebrow">Visibilidad publica</p>
              <h2>SEO fuerte por intencion y ciudad</h2>
            </div>
            <div class="icon-box">◎</div>
          </div>
          <div class="features">
            <article class="feature"><div class="feature-icon">✓</div><div><p class="feature-title">Perfiles verificados</p><p class="feature-text">Una comunidad cerrada para adultos registrados, con foco en discrecion y acceso controlado.</p></div></article>
            <article class="feature"><div class="feature-icon">⌖</div><div><p class="feature-title">Intencion local real</p><p class="feature-text">Entradas SEO por ciudad e intencion para captar trafico local y dirigirlo a una experiencia privada.</p></div></article>
            <article class="feature"><div class="feature-icon">♡</div><div><p class="feature-title">Conexiones afines</p><p class="feature-text">Parejas, trios, swingers, hombres, mujeres y perfiles trans con filtros y afinidad real.</p></div></article>
          </div>
        </div>
      </aside>
    </section>

    <footer class="footer">
      <span>© 2026 Mansión Deseo · Sitio para mayores de 18 años.</span>
      <nav aria-label="Legal y ayuda">
        <a href="/terminos/">Términos</a>
        <a href="/privacidad/">Privacidad</a>
        <a href="/ayuda/">Ayuda</a>
      </nav>
    </footer>
  </main>
  <script>
    (function(){
      var loginForm = document.getElementById('homeLogin');
      var loginEmail = document.getElementById('homeLoginEmail');
      var loginPassword = document.getElementById('homeLoginPassword');
      var loginError = document.getElementById('homeLoginError');
      var loginSubmit = document.getElementById('homeLoginSubmit');
      function blurDeferredLogin() {
        window.setTimeout(function() {
          var active = document.activeElement;
          if (active && active.matches && active.matches('[data-defer-focus]')) active.blur();
        }, 0);
        window.setTimeout(function() {
          var active = document.activeElement;
          if (active && active.matches && active.matches('[data-defer-focus]')) active.blur();
        }, 120);
      }
      blurDeferredLogin();
      Array.prototype.forEach.call(document.querySelectorAll('[data-defer-focus]'), function(input) {
        input.addEventListener('pointerdown', function() {
          input.removeAttribute('readonly');
          input.removeAttribute('tabindex');
        }, { once: true });
        input.addEventListener('focus', function(event) {
          if (input.hasAttribute('readonly')) {
            event.preventDefault();
            input.blur();
          }
        });
        input.addEventListener('keydown', function() {
          input.removeAttribute('readonly');
          input.removeAttribute('tabindex');
        }, { once: true });
      });
      window.addEventListener('pageshow', blurDeferredLogin);
      window.addEventListener('load', blurDeferredLogin);
      if (loginForm) {
        loginForm.addEventListener('submit', function(event) {
          event.preventDefault();
          if (!loginEmail || !loginPassword || !loginSubmit) return;
          loginError.textContent = '';
          loginSubmit.disabled = true;
          loginSubmit.textContent = 'Entrando...';
          fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: loginEmail.value, password: loginPassword.value })
          })
            .then(function(response) {
              return response.json().then(function(data) {
                if (!response.ok) throw new Error(data && data.error ? data.error : 'Credenciales inválidas');
                return data;
              });
            })
            .then(function(data) {
              localStorage.setItem('mansion_token', data.token);
              localStorage.setItem('mansion_user', JSON.stringify(data.user));
              localStorage.setItem('mansion_registered', 'true');
              localStorage.setItem('mansion_ever_logged_in', '1');
              location.href = '/feed/';
            })
            .catch(function(error) {
              loginError.textContent = error.message || 'Credenciales inválidas';
              loginSubmit.disabled = false;
              loginSubmit.textContent = 'Entrar';
            });
        });
      }
      if (new URLSearchParams(location.search).get('geo_debug') === '1') {
        var geoBox = document.createElement('aside');
        geoBox.setAttribute('aria-label', 'Cloudflare location debug');
        geoBox.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:10000;width:min(352px,calc(100vw - 32px));max-height:70vh;overflow:auto;border:1px solid rgba(103,232,249,.22);border-radius:18px;background:rgba(0,0,0,.86);color:#fff;box-shadow:0 24px 80px rgba(0,0,0,.45);backdrop-filter:blur(18px);font:12px Inter,system-ui,sans-serif';
        geoBox.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid rgba(255,255,255,.10);padding:12px 14px"><div><strong style="display:block;font-size:13px">Cloudflare location</strong><span id="geoDebugTime" style="color:#888899;font-size:10px">Cargando...</span></div><button id="geoDebugClose" type="button" style="width:32px;height:32px;border-radius:10px;border:1px solid rgba(255,255,255,.10);background:rgba(255,255,255,.06);color:#fff;cursor:pointer">x</button></div><div id="geoDebugBody" style="padding:12px 14px;color:#888899">Leyendo /api/debug/cf-location...</div>';
        document.body.appendChild(geoBox);
        document.getElementById('geoDebugClose').addEventListener('click', function(){ geoBox.remove(); });
        fetch('/api/debug/cf-location', { cache: 'no-store' })
          .then(function(response){ return response.json(); })
          .then(function(data){
            var cf = data.cf || {};
            var fields = ['country','region','regionCode','city','postalCode','latitude','longitude','timezone','continent','colo','asn','asOrganization','tlsVersion'];
            var html = '<dl style="margin:0">';
            fields.forEach(function(key){
              html += '<div style="display:grid;grid-template-columns:104px 1fr;gap:8px;border-bottom:1px solid rgba(255,255,255,.06);padding:6px 0"><dt style="color:#555566;text-transform:uppercase;letter-spacing:.12em;font-size:10px">' + key + '</dt><dd style="margin:0;color:#f0ede8;font-weight:600;word-break:break-word">' + (cf[key] || '-') + '</dd></div>';
            });
            html += '</dl><p style="margin:12px 0 0;color:#555566;font-size:10px;line-height:1.45">' + (data.note || '') + '</p>';
            document.getElementById('geoDebugBody').innerHTML = html;
            document.getElementById('geoDebugTime').textContent = data.generatedAt || 'OK';
          })
          .catch(function(error){
            document.getElementById('geoDebugBody').textContent = error.message || 'No se pudo leer la geolocalizacion.';
          });
      }
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
await writeFile(notFoundPath, buildNotFoundHtml(), 'utf8');
await writeFile(headersPath, buildHeaders(), 'utf8');
await writeFile(redirectsPath, buildRedirects(), 'utf8');
console.log(`Installed static home and ${appRoutes.size} static SPA route entries`);
