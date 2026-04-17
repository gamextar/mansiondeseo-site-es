# Astro SEO Migration

## Estado actual

- La app privada sigue en React/Vite.
- La capa publica SEO ya tiene un scaffold real en Astro.
- Astro genera HTML estatico para:
  - `/`
  - `/:variant`
  - `/:variant/:citySlug`
- El origen publico Astro ya esta desplegado en Pages:
  - `https://8e0a6217.mansiondeseo-seo.pages.dev`
- El proyecto Pages creado para esa capa es:
  - `mansiondeseo-seo`
- El router de dominio ya esta preparado en:
  - `workers/site-router.js`
  - `wrangler.site-router.toml`

## Comandos

```bash
npm run astro:dev
npm run astro:build
npm run astro:preview
```

## Archivos clave

- `astro.config.mjs`
- `astro-src/pages/index.astro`
- `astro-src/pages/[variant].astro`
- `astro-src/pages/[variant]/[citySlug].astro`
- `astro-src/lib/landingData.js`

## Por que no esta conectado aun a produccion

La app privada y la capa publica hoy conviven en el mismo proyecto Pages.
Para pasar la home y las landings SEO a Astro sin romper `/feed`, `/login`, `/registro` y el resto de la SPA, hay que elegir una frontera de deploy.

## Opciones sanas

### Opcion A: Astro publico + React privado en dos proyectos

- Proyecto Pages/Workers 1: publico SEO en Astro
- Proyecto Pages 2: app privada React
- El dominio principal enruta `/`, `/:variant`, `/:variant/:citySlug` al publico y `/feed`, `/login`, `/registro`, etc. a la app

### Opcion B: Astro como sitio principal y React montado dentro del mismo stack

- Requiere una migracion mas profunda
- Permite un solo deploy final
- Es mas trabajo, pero deja una arquitectura mas limpia a largo plazo

## Recomendacion

Usar una separacion limpia:

- `mansiondeseo.com` y `www.mansiondeseo.com` -> Astro publico
- `app.mansiondeseo.com` -> app React privada

## Cambios necesarios

1. Agregar `app.mansiondeseo.com` como custom domain del proyecto Pages React.
2. Mover `mansiondeseo.com` y `www.mansiondeseo.com` al proyecto Pages Astro.
3. Mantener el Worker API en:
   - `mansiondeseo.com/api/*`
   - `www.mansiondeseo.com/api/*`
   - `app.mansiondeseo.com/api/*`
4. Mantener `CORS_ORIGIN` permitiendo `https://app.mansiondeseo.com`.

## Nota

El Worker router queda como experimento util, pero ya no es la recomendacion principal.
