import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SITE_LOCALE, SITE_ORIGIN } from '../src/lib/siteConfig.js';

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
    '/ / 200',
    ...[...appFallbackPrefixes]
      .sort((a, b) => a.localeCompare(b))
      .map((prefix) => `${prefix} /app/ 200`),
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
const homeTitle = 'Mansión Deseo | Acceso privado para parejas liberales';
const homeDescription = 'Mansión Deseo es una comunidad privada para parejas liberales y adultos que valoran la discreción, la verificación y el acceso curado.';
const activeCouplesNow = '1.248';
const staticHomeStructuredData = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Mansión Deseo',
  alternateName: 'Mansion Deseo',
  url: `${SITE_ORIGIN}/`,
  description: homeDescription,
  inLanguage: SITE_LOCALE,
});

const staticHomeHtml = `<!doctype html>
<html lang="${SITE_LOCALE.split('-')[0] || 'es'}" style="background:#000000;color-scheme:dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>${homeTitle}</title>
  <meta name="description" content="${homeDescription}" />
  <meta name="keywords" content="parejas liberales, comunidad privada adultos, swingers argentina, acceso privado, perfiles verificados, club liberal" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="${SITE_ORIGIN}/" />
  <meta name="theme-color" content="#000000" />
  <meta name="color-scheme" content="dark" />
  <link rel="manifest" href="/manifest.json" />
  <link rel="icon" type="image/svg+xml" href="/icon.svg" />
  <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Mansión Deseo" />
  <meta property="og:title" content="${homeTitle}" />
  <meta property="og:description" content="${homeDescription}" />
  <meta property="og:image" content="${SITE_ORIGIN}/icon-512.png" />
  <meta property="og:url" content="${SITE_ORIGIN}/" />
  <meta property="og:locale" content="${ogLocale}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${homeTitle}" />
  <meta name="twitter:description" content="${homeDescription}" />
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
    :root{--bg:#000000;--text:#f4f4f4;--muted:rgba(244,244,244,.64);--soft:rgba(244,244,244,.38);--line:rgba(255,255,255,.08);--gold:#c5a059;--gold-hover:#d4b36c}
    *{box-sizing:border-box}
    html{background:var(--bg)}
    body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font-family:Inter,Montserrat,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;overflow-x:hidden}
    a{color:inherit;text-decoration:none}
    button,input{font:inherit}
    .page{width:100%;max-width:1280px;margin:0 auto;padding:0 24px}
    .top{height:80px;display:flex;align-items:center;justify-content:space-between;gap:24px;border-bottom:1px solid var(--line)}
    .brand{display:flex;align-items:center;gap:12px;min-width:0}
    .mark{width:36px;height:36px;display:grid;place-items:center;border:1px solid rgba(197,160,89,.5);color:var(--gold);font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:14px;font-weight:600}
    .brand-text{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:20px;font-weight:500;color:var(--text);white-space:nowrap}
    .login-inline{position:relative;display:grid;grid-template-columns:12rem 10rem auto;gap:16px;align-items:center}
    .home-input{height:36px;width:100%;border:0;border-bottom:1px solid rgba(255,255,255,.2);border-radius:0;background:transparent;padding:4px 0;color:var(--text);font-size:14px;outline:none}
    .home-input::placeholder{color:rgba(244,244,244,.35)}
    .home-input:focus{border-bottom-color:var(--gold)}
    .login-btn,.mobile-login{height:36px;display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(197,160,89,.7);border-radius:0;background:transparent;padding:0 20px;color:var(--gold);font-size:14px;font-weight:500;cursor:pointer;transition:background .18s ease,border-color .18s ease,color .18s ease,opacity .18s ease}
    .login-btn:hover,.mobile-login:hover{border-color:var(--gold);background:var(--gold);color:#000}
    .login-btn:disabled{cursor:wait;opacity:.6}
    .mobile-login{display:none}
    .login-error{position:absolute;right:0;top:44px;margin:0;max-width:320px;color:var(--gold);font-size:12px;text-align:right}
    .hero{max-width:960px;min-height:calc(100svh - 176px);display:flex;flex-direction:column;justify-content:center;padding:96px 0 112px}
    .title{max-width:900px;margin:0;font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:72px;line-height:1.05;font-weight:500;color:var(--text)}
    .lead{max-width:680px;margin:32px 0 0;color:var(--muted);font-size:20px;font-weight:300;line-height:1.6}
    .cta{margin-top:40px}
    .access-btn{min-height:48px;display:inline-flex;align-items:center;gap:12px;background:var(--gold);border:1px solid var(--gold);padding:12px 28px;color:#000;font-size:14px;font-weight:700;transition:background .18s ease,border-color .18s ease}
    .access-btn:hover{background:var(--gold-hover);border-color:var(--gold-hover)}
    .access-btn svg{width:16px;height:16px}
    .social-proof{border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:32px 0;text-align:center}
    .social-proof p{margin:0;color:rgba(244,244,244,.7);font-size:14px;font-weight:300}
    .social-proof strong{color:var(--gold);font-weight:500}
    .benefits{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:48px;padding:96px 0 128px}
    .benefit{border-top:1px solid var(--line);padding-top:32px}
    .benefit svg{width:24px;height:24px;color:var(--gold)}
    .benefit h2{margin:32px 0 0;font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:26px;line-height:1.2;font-weight:500;color:var(--text)}
    .benefit p{max-width:360px;margin:16px 0 0;color:rgba(244,244,244,.58);font-size:14px;font-weight:300;line-height:1.75}
    .footer{display:flex;align-items:center;justify-content:space-between;gap:20px;border-top:1px solid var(--line);padding:40px 0;color:var(--soft);font-size:12px}
    .footer nav{display:flex;flex-wrap:wrap;gap:24px}
    .footer a{color:var(--soft);transition:color .18s ease}
    .footer a:hover{color:var(--gold)}
    @media(max-width:767px){
      .page{padding:0 20px}
      .top{height:72px;gap:16px}
      .mark{width:34px;height:34px}
      .brand-text{font-size:18px}
      .login-inline{display:none}
      .mobile-login{display:inline-flex}
      .hero{min-height:auto;padding:80px 0 88px}
      .title{font-size:44px;line-height:1.08}
      .lead{margin-top:28px;font-size:18px;line-height:1.55}
      .cta{margin-top:36px}
      .access-btn{width:100%;justify-content:center}
      .social-proof{padding:28px 0}
      .benefits{grid-template-columns:1fr;gap:44px;padding:80px 0 96px}
      .footer{align-items:flex-start;flex-direction:column}
      .footer nav{gap:18px}
    }
    @media(min-width:768px) and (max-width:1023px){
      .title{font-size:60px}
      .benefits{gap:32px}
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="top">
      <a class="brand" href="/" aria-label="Mansión Deseo">
        <span class="mark">MD</span>
        <span class="brand-text">Mansión Deseo</span>
      </a>
      <form class="login-inline" id="homeLogin" autocomplete="on">
        <input class="home-input" id="homeLoginEmail" type="email" name="username" placeholder="Email" autocomplete="username" inputmode="email" required />
        <input class="home-input" id="homeLoginPassword" type="password" name="password" placeholder="Contraseña" autocomplete="current-password" required />
        <button class="login-btn" id="homeLoginSubmit" type="submit">Entrar</button>
        <p class="login-error" id="homeLoginError" role="alert" aria-live="polite"></p>
      </form>
      <a class="mobile-login" href="/login/">Login</a>
    </header>

    <section class="hero" aria-label="Mansión Deseo">
      <h1 class="title">Mansión Deseo, el club privado donde el deseo entra sin ruido.</h1>
      <p class="lead">Acceso reservado, perfiles cuidados y privacidad diseñada para explorar con elegancia.</p>
      <div class="cta">
        <a class="access-btn" href="/registro/">Solicitar Acceso <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path></svg></a>
      </div>
    </section>

    <section class="social-proof" aria-label="Actividad actual">
      <p><strong>${activeCouplesNow}</strong> Parejas activas ahora</p>
    </section>

    <section class="benefits" aria-label="Beneficios">
      <article class="benefit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"></path><path d="m9.5 12 1.7 1.7 3.8-4"></path></svg>
        <h2>Privacidad por defecto</h2>
        <p>Un entorno reservado, discreto y pensado para adultos que cuidan su exposición.</p>
      </article>
      <article class="benefit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1"></path><circle cx="10" cy="7" r="4"></circle><path d="M20 19v-1a4 4 0 0 0-3-3.86"></path><path d="M17 3.13a4 4 0 0 1 0 7.75"></path></svg>
        <h2>Perfiles Verificados</h2>
        <p>Menos ruido, más intención: perfiles cuidados antes de entrar a la comunidad.</p>
      </article>
      <article class="benefit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-4.35-9-9a5 5 0 0 1 8-5.7L12 7.4l1-1.1a5 5 0 0 1 8 5.7c-2 4.65-9 9-9 9Z"></path></svg>
        <h2>Acceso curado</h2>
        <p>Una experiencia selectiva para conectar con personas que buscan lo mismo.</p>
      </article>
    </section>

    <footer class="footer">
      <span>© 2026 Mansión Deseo · Mayores de 18 años.</span>
      <nav aria-label="Privacidad y redes">
        <a href="/privacidad/">Privacidad</a>
        <a href="/terminos/">Términos</a>
        <a href="https://instagram.com/mansiondeseo" target="_blank" rel="noreferrer">Instagram</a>
        <a href="https://x.com/mansiondeseo" target="_blank" rel="noreferrer">X</a>
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
              html += '<div style="display:grid;grid-template-columns:104px 1fr;gap:8px;border-bottom:1px solid rgba(255,255,255,.06);padding:6px 0"><dt style="color:#555566;text-transform:uppercase;font-size:10px">' + key + '</dt><dd style="margin:0;color:#f0ede8;font-weight:600;word-break:break-word">' + (cf[key] || '-') + '</dd></div>';
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
