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
    :root{--bg:#08080e;--text:#f6efe6;--muted:rgba(246,239,230,.72);--dim:rgba(246,239,230,.48);--gold:#c9a84c;--gold2:#f0d98b;--crimson:#9b2b40;--wine:#4a1324;--line:rgba(255,255,255,.10)}
    *{box-sizing:border-box}
    html{background:var(--bg)}
    body{margin:0;min-height:100vh;background:radial-gradient(circle at 82% 8%,rgba(201,168,76,.20),transparent 28rem),radial-gradient(circle at 8% 18%,rgba(155,43,64,.28),transparent 26rem),linear-gradient(180deg,#0d0b12 0%,#08080e 62%,#050508 100%);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    body:before{content:"";position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px);background-size:56px 56px;mask-image:linear-gradient(to bottom,black,transparent 82%)}
    a{color:inherit;text-decoration:none}button,input{font:inherit}.wrap{width:min(1180px,calc(100% - 32px));margin:0 auto;padding:18px 0 54px}
    @keyframes rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
    @keyframes glowDrift{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(-18px,16px,0) scale(1.08)}}
    @keyframes lineSweep{from{transform:translateX(-110%)}to{transform:translateX(110%)}}
    .top-shell{position:sticky;top:0;z-index:20;padding-top:8px;background:linear-gradient(180deg,rgba(8,8,14,.96),rgba(8,8,14,.70) 72%,transparent);backdrop-filter:blur(14px);animation:rise .7s ease both}
    .top{display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid rgba(255,255,255,.08);background:rgba(9,8,14,.62);border-radius:24px;padding:12px 14px}
    .brand{display:flex;align-items:center;gap:8px}.mark{width:32px;height:32px;border-radius:8px;background:linear-gradient(135deg,#D4183D,#9B1C3A);display:grid;place-items:center;font-family:"Playfair Display",Georgia,serif;font-size:14px;font-weight:700;color:#fff}.brand-text{font-family:"Playfair Display",Georgia,"Times New Roman",serif;font-size:17px;font-weight:600;background:linear-gradient(90deg,#C9A84C,#E0C97A,#C9A84C);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 2px 8px rgba(0,0,0,.35)}
    .top-actions{display:flex;align-items:center;gap:10px;flex-shrink:0}.top.login-open .top-actions .link{display:none}.link{font-size:14px;color:var(--muted);background:none;border:0;cursor:pointer;padding:0}.pill-btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:12px 18px;font-weight:800;font-size:14px;border:0;cursor:pointer}.gold{background:linear-gradient(135deg,var(--gold),var(--gold2));color:#14100a;box-shadow:0 18px 36px rgba(201,168,76,.18)}.ghost{border:1px solid var(--line);background:rgba(255,255,255,.045);color:var(--text)}
    .login-inline{position:relative;display:grid;grid-template-columns:180px 160px auto;gap:8px;align-items:center;max-width:560px;opacity:1;overflow:visible;pointer-events:auto;transform:none}.home-input{width:100%;border:1px solid var(--line);background:rgba(255,255,255,.045);border-radius:15px;padding:11px 12px;color:var(--text);font-size:14px;outline:none}.home-input::placeholder{color:var(--dim)}.home-input:focus{border-color:rgba(201,168,76,.42);box-shadow:0 0 0 4px rgba(201,168,76,.08)}.login-error{position:absolute;right:0;top:calc(100% + 8px);min-height:16px;margin:0;color:#ff8ea0;font-size:12px;text-align:right;white-space:nowrap}
    .hero{margin-top:22px}.panel{border:1px solid var(--line);background:linear-gradient(180deg,rgba(255,255,255,.072),rgba(255,255,255,.026));border-radius:36px;box-shadow:0 32px 96px rgba(0,0,0,.36);overflow:hidden}.hero-panel{position:relative;min-height:610px;animation:rise .85s .08s ease both}.hero-panel:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 78% 18%,rgba(240,217,139,.18),transparent 21rem),radial-gradient(circle at 14% 10%,rgba(155,43,64,.18),transparent 22rem);pointer-events:none;animation:glowDrift 9s ease-in-out infinite}.hero-panel:after{content:"";position:absolute;left:0;right:0;top:0;height:1px;background:linear-gradient(90deg,transparent,rgba(240,217,139,.65),transparent);animation:lineSweep 3.8s ease-in-out infinite}.copy{position:relative;padding:72px 64px;max-width:1030px}.badge{display:inline-flex;border:1px solid rgba(201,168,76,.28);background:rgba(201,168,76,.10);color:rgba(240,217,139,.95);border-radius:999px;padding:9px 13px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;animation:rise .7s .16s ease both}.title{font-family:Georgia,"Times New Roman",serif;font-weight:500;letter-spacing:-.055em;font-size:clamp(56px,8.5vw,112px);line-height:.92;margin:24px 0 0;max-width:980px;animation:rise .8s .22s ease both}.lead{max-width:780px;margin:24px 0 0;color:var(--muted);font-size:19px;line-height:1.75;animation:rise .8s .30s ease both}.cta{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px;animation:rise .8s .38s ease both}.hero-notes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:34px;max-width:900px}.note{border:1px solid var(--line);background:rgba(0,0,0,.18);border-radius:20px;padding:16px;animation:rise .8s calc(.44s + var(--i,0s)) ease both}.note strong{display:block;color:var(--gold2);font-size:18px}.note span{display:block;margin-top:5px;color:var(--dim);font-size:12px;line-height:1.4}
    .strip{display:grid;grid-template-columns:1.15fr .85fr .85fr;gap:18px;margin-top:18px}.mini{padding:26px;animation:rise .75s .18s ease both}.eyebrow{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:rgba(201,168,76,.86)}.stat{font-family:Georgia,"Times New Roman",serif;font-size:52px;line-height:1;margin-top:12px}.muted{color:var(--muted);line-height:1.65}.tags{display:flex;flex-wrap:wrap;gap:9px;margin-top:16px}.tag{border:1px solid var(--line);background:rgba(0,0,0,.18);border-radius:999px;padding:8px 12px;font-size:12px;color:rgba(255,255,255,.78);transition:transform .18s ease,border-color .18s ease}.tag:hover{transform:translateY(-2px);border-color:rgba(201,168,76,.35)}.trust{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:18px}.trust .mini{padding:20px}.trust h3{font-size:14px;margin:0 0 8px}.trust p{margin:0;color:var(--muted);font-size:13px;line-height:1.55}.footer{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:24px;color:var(--dim);font-size:12px}.footer a{color:var(--muted)}
    @media(prefers-reduced-motion:reduce){*,*:before,*:after{animation:none!important;transition:none!important}}
    @media(max-width:960px){.wrap{width:min(100% - 24px,720px);padding-top:10px}.top{border-radius:20px;flex-wrap:wrap}.top-actions{gap:8px}.top-actions .link{display:none}.pill-btn{padding:11px 15px}.login-inline{order:3;grid-template-columns:1fr;max-width:100%;width:100%;display:grid;opacity:1;transform:none}.login-error{position:static;text-align:left;white-space:normal}.copy{padding:38px 28px}.title{font-size:clamp(42px,13vw,72px)}.lead{font-size:17px}.hero-panel{min-height:auto}.hero-notes,.strip,.trust{grid-template-columns:1fr}.brand-text{font-size:20px}}
  </style>
</head>
<body>
  <main class="wrap">
    <div class="top-shell">
      <nav class="top" aria-label="Principal">
        <a class="brand" href="/" aria-label="Mansión Deseo">
          <span class="mark">M</span>
          <span class="brand-text">Mansión Deseo</span>
        </a>
        <form class="login-inline" id="homeLogin">
          <input class="home-input" id="homeLoginEmail" type="email" name="email" placeholder="tu@email.com" autocomplete="email" required />
          <input class="home-input" id="homeLoginPassword" type="password" name="password" placeholder="Contraseña" autocomplete="current-password" required />
          <button class="pill-btn gold" id="homeLoginSubmit" type="submit">Entrar</button>
          <p class="login-error" id="homeLoginError" role="alert" aria-live="polite"></p>
        </form>
      </nav>
    </div>

    <section class="hero">
      <div class="panel hero-panel">
        <div class="copy">
          <span class="badge">Swingers Argentina · +18 · Acceso privado</span>
          <h1 class="title">Conocé adultos con la misma curiosidad.</h1>
          <p class="lead">Mansión Deseo es una comunidad privada para adultos en Argentina: parejas liberales, swingers, tríos y contactos discretos dentro de una experiencia cuidada, moderna y reservada.</p>
          <div class="cta">
            <a class="pill-btn gold" href="/registro/">Crear cuenta</a>
            <button class="pill-btn ghost" type="button" data-show-login>Iniciar sesión</button>
          </div>
          <div class="hero-notes" aria-label="Datos de la comunidad">
            <div class="note" style="--i:0s"><strong>Privado</strong><span>Tu actividad no se vincula con redes sociales.</span></div>
            <div class="note" style="--i:.08s"><strong>Argentina</strong><span>Perfiles y búsquedas enfocadas en tu zona.</span></div>
            <div class="note" style="--i:.16s"><strong>+18</strong><span>Acceso reservado para adultos registrados.</span></div>
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
      <span><a href="/terminos/">Términos</a> · <a href="/privacidad/">Privacidad</a> · <a href="/ayuda/">Ayuda</a></span>
    </footer>
  </main>
  <script>
    (function(){
      var loginForm = document.getElementById('homeLogin');
      var topNav = document.querySelector('.top');
      var loginEmail = document.getElementById('homeLoginEmail');
      var loginPassword = document.getElementById('homeLoginPassword');
      var loginError = document.getElementById('homeLoginError');
      var loginSubmit = document.getElementById('homeLoginSubmit');
      function showLogin() {
        if (!loginForm) return;
        loginForm.classList.add('is-open');
        topNav && topNav.classList.add('login-open');
        loginForm.setAttribute('aria-hidden', 'false');
        loginError.textContent = '';
        setTimeout(function(){ loginEmail && loginEmail.focus(); }, 40);
      }
      var showLoginButtons = document.querySelectorAll('[data-show-login]');
      for (var b = 0; b < showLoginButtons.length; b += 1) {
        showLoginButtons[b].addEventListener('click', showLogin);
      }
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
