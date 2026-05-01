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
  'dashboard',
  'explorar',
  'favoritos',
  'feed',
  'feed-shell-test',
  'full-mobile-test',
  'historia/nueva',
  'ayuda',
  'inicio',
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
  'radar',
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
const homeTitle = 'Mansión Deseo | Acceso privado para adultos';
const homeDescription = 'Comunidad privada y selecta para adultos registrados, pensada para parejas y usuarios solos que valoran perfiles verificados y acceso discreto.';
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
<html lang="${SITE_LOCALE.split('-')[0] || 'es'}" style="background:#08080e;color-scheme:dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>${homeTitle}</title>
  <meta name="description" content="${homeDescription}" />
  <meta name="keywords" content="parejas liberales, comunidad privada adultos, swingers argentina, acceso privado, perfiles verificados, club liberal" />
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
  <meta property="og:title" content="${homeTitle}" />
  <meta property="og:description" content="${homeDescription}" />
  <meta property="og:image" content="${SITE_ORIGIN}/icon-512.png" />
  <meta property="og:url" content="${SITE_ORIGIN}/" />
  <meta property="og:locale" content="${ogLocale}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${homeTitle}" />
  <meta name="twitter:description" content="${homeDescription}" />
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
            location.replace('/inicio/');
            return;
          }
          var deepTarget = path + (location.search || '') + (location.hash || '');
          location.replace('/app/?redirect=' + encodeURIComponent(deepTarget));
        }
      } catch (_) {}
    })();
  </script>
  <style>
    :root{--bg:#08080e;--card:#111118;--elevated:#1a1a24;--border:#2a2a38;--text:#f0ede8;--muted:#888899;--dim:#555566;--gold:#c9a84c;--gold-light:#e0c97a;--crimson:#d4183d;--crimson-dark:#9b1c3a}
    *{box-sizing:border-box}
    html{background:var(--bg)}
    body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font-family:Inter,system-ui,sans-serif;overflow:hidden}
    a{color:inherit;text-decoration:none}
    button{font:inherit}
    .welcome{position:relative;min-height:100vh;min-height:100dvh;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:24px}
    .ambient{position:absolute;inset:0;pointer-events:none}
    .ambient:before{content:"";position:absolute;top:25%;left:50%;width:384px;height:384px;transform:translateX(-50%);border-radius:999px;background:rgba(212,24,61,.05);filter:blur(64px)}
    .ambient:after{content:"";position:absolute;bottom:25%;left:25%;width:256px;height:256px;border-radius:999px;background:rgba(201,168,76,.05);filter:blur(64px)}
    .panel{position:relative;z-index:1;width:100%;max-width:384px;text-align:center}
    .mansion-visual{position:relative;width:192px;height:224px;margin:0 auto 40px;opacity:0;animation:visualEnter .68s cubic-bezier(.2,.9,.2,1.08) .2s forwards}
    .visual-glow{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}
    .visual-glow:before{content:"";width:160px;height:160px;border-radius:999px;background:linear-gradient(135deg,rgba(212,24,61,.2),rgba(201,168,76,.1));filter:blur(32px)}
    .door-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;transform:rotate(-10deg);animation:doorSettle .62s cubic-bezier(.2,.9,.2,1.1) .4s forwards}
    .door{position:relative;display:flex;width:112px;height:144px;align-items:flex-end;justify-content:center;border:2px solid rgba(201,168,76,.4);border-bottom-color:rgba(201,168,76,.34);border-radius:56px 56px 0 0;background:rgba(26,26,36,.5);padding-bottom:16px}
    .knob{width:12px;height:12px;border-radius:999px;background:var(--gold)}
    .particle{position:absolute;width:6px;height:6px;border-radius:999px;background:var(--gold);opacity:0;animation:particleEnter .42s ease-out forwards,floatParticle 3s ease-in-out infinite}
    .particle:nth-child(3){left:15%;top:10%;animation-delay:.6s,.6s}
    .particle:nth-child(4){left:25%;top:32%;animation-delay:.68s,.9s}
    .particle:nth-child(5){left:35%;top:54%;animation-delay:.76s,1.2s}
    .particle:nth-child(6){left:45%;top:76%;animation-delay:.84s,1.5s}
    .particle:nth-child(7){left:55%;top:10%;animation-delay:.92s,1.8s}
    .particle:nth-child(8){left:65%;top:32%;animation-delay:1s,2.1s}
    .particle:nth-child(9){left:75%;top:54%;animation-delay:1.08s,2.4s}
    .particle:nth-child(10){left:85%;top:76%;animation-delay:1.16s,2.7s}
    .title,.copy,.cta,.login-line,.features{opacity:0;animation:fadeInUp .5s ease-out forwards}
    .title{margin:0 0 12px;font-family:"Playfair Display",Georgia,serif;font-size:30px;line-height:1.2;font-weight:700;background:linear-gradient(90deg,var(--gold),var(--gold-light),var(--gold));-webkit-background-clip:text;background-clip:text;color:transparent}
    .copy{max-width:320px;margin:0 auto 32px;color:var(--muted);font-size:14px;line-height:1.63;animation-delay:.6s}
    .cta{animation-delay:.7s}
    .register-btn{display:flex;width:100%;align-items:center;justify-content:center;gap:8px;border:0;border-radius:16px;background:linear-gradient(90deg,var(--gold),var(--gold-light));padding:16px 24px;color:var(--bg);font-family:"Playfair Display",Georgia,serif;font-size:18px;font-weight:600;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}
    .register-btn:hover{box-shadow:0 0 20px rgba(201,168,76,.15);transform:scale(1.02)}
    .register-btn:active{transform:scale(.97)}
    .register-btn svg{width:20px;height:20px}
    .login-line{margin:20px 0 0;font-size:14px;animation-delay:.9s}
    .login-line span{color:var(--dim)}
    .login-line a{color:var(--gold);font-weight:500}
    .login-line a:hover{text-decoration:underline}
    .features{display:flex;align-items:center;justify-content:center;gap:20px;margin-top:32px;color:var(--dim);font-size:12px;animation-delay:.9s}
    .features span{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
    .features svg{width:12px;height:12px;color:var(--gold)}
    @keyframes visualEnter{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}
    @keyframes doorSettle{from{transform:rotate(-10deg)}to{transform:rotate(0)}}
    @keyframes particleEnter{from{opacity:0;transform:scale(0)}to{opacity:.6;transform:scale(1)}}
    @keyframes floatParticle{0%,100%{transform:translateY(-5px) scale(1)}50%{transform:translateY(5px) scale(1)}}
    @keyframes fadeInUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    .title{animation-delay:.5s}
    @media(min-width:768px){.title{font-size:36px}}
    @media(max-width:374px){.features{gap:12px;font-size:11px}.copy{max-width:300px}.title{font-size:28px}}
    @media(prefers-reduced-motion:reduce){*,*:before,*:after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
  </style>
</head>
<body>
  <main class="welcome">
    <div class="ambient" aria-hidden="true"></div>
    <section class="panel" aria-label="Mansión Deseo">
      <div class="mansion-visual" aria-hidden="true">
        <div class="visual-glow"></div>
        <div class="door-wrap">
          <div class="door"><span class="knob"></span></div>
        </div>
        <span class="particle"></span>
        <span class="particle"></span>
        <span class="particle"></span>
        <span class="particle"></span>
        <span class="particle"></span>
        <span class="particle"></span>
        <span class="particle"></span>
        <span class="particle"></span>
      </div>

      <h1 class="title">Mansión Deseo</h1>
      <p class="copy">
        Un espacio selecto para quienes buscan experiencias únicas con discreción total,
        perfiles verificados y conexiones reales entre parejas y usuarios solos.
      </p>

      <div class="cta">
        <a class="register-btn" href="/registro/" id="registerLink">
          Registrarme
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>
        </a>
      </div>

      <p class="login-line">
        <span>¿Ya tienes cuenta? </span><a href="/login/">Acceder</a>
      </p>

      <div class="features" aria-label="Beneficios">
        <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.9 2.9 8.5 8.5 2.9 9.9l5.6 1.4 1.4 5.6 1.4-5.6 5.6-1.4-5.6-1.4-1.4-5.6Z"></path><path d="M19 15v4"></path><path d="M21 17h-4"></path></svg> Perfiles verificados</span>
        <span>•</span>
        <span>Confidencial</span>
        <span>•</span>
        <span>Acceso Privado</span>
      </div>
    </section>
  </main>
  <script>
    (function(){
      var registerLink = document.getElementById('registerLink');
      function removeMatchingStorageKeys(storage, shouldRemove) {
        try {
          for (var index = storage.length - 1; index >= 0; index -= 1) {
            var key = storage.key(index);
            if (key && shouldRemove(key)) storage.removeItem(key);
          }
        } catch (_) {}
      }
      function clearAccountLocalData() {
        var exactKeys = {
          mansion_token: true,
          mansion_user: true,
          mansion_ever_logged_in: true,
          mansion_registered: true,
          mansion_feed: true,
          mansion_feed_cache_version: true,
          mansion_feed_dirty: true,
          mansion_feed_filter: true,
          mansion_feed_force_refresh: true,
          mansion_feed_scroll_y: true,
          mansion_conversations: true,
          mansion_pending_story_likes: true,
          appBootstrap: true,
          authMe: true,
          ownProfileDashboard: true,
          conversations: true,
          unreadCount: true,
          vf_active_story: true,
          vf_idx: true,
          vf_prefetched: true,
          vf_stories: true
        };
        var prefixes = [
          'mansion_chat_',
          'mansion_profile_detail_',
          'mansion_pending_viewed_story_users:',
          'viewed_story_users:'
        ];
        var shouldRemove = function(key) {
          if (exactKeys[key]) return true;
          for (var i = 0; i < prefixes.length; i += 1) {
            if (key.indexOf(prefixes[i]) === 0) return true;
          }
          return false;
        };
        removeMatchingStorageKeys(localStorage, shouldRemove);
        removeMatchingStorageKeys(sessionStorage, shouldRemove);
        if ('caches' in window) {
          caches.keys()
            .then(function(keys) {
              return Promise.all(keys.filter(function(key) {
                return key.toLowerCase().indexOf('mansion') >= 0;
              }).map(function(key) { return caches.delete(key); }));
            })
            .catch(function(){});
        }
      }
      if (registerLink) {
        registerLink.addEventListener('click', function() {
          clearAccountLocalData();
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
      var intentLinks = document.querySelectorAll('a[href^="/registro"],a[href^="/login"],a[href^="/inicio"],a[href^="/radar"],a[href^="/feed"]');
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
