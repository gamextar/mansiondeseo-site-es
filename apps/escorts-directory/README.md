# Mansión Deseo Escorts

Proyecto independiente y sin React para el futuro catálogo público de `mansiondeseo.com`.

## Principio de despliegue

1. Desplegar inicialmente en un host temporal con `STAGING_NO_INDEX=1`.
2. Crear una D1 y dos buckets R2 exclusivos para este producto.
3. Con perfiles reales aprobados, cambiar `PUBLIC_SITE_ORIGIN` y la ruta de Workers al dominio principal.
4. Generar sitemap solo con las nuevas URLs públicas, purgar caché y hacer 301 únicamente cuando exista una equivalencia real. Las URLs antiguas sin equivalente deben devolver `410`, no redirigirse genéricamente a la portada.

## Antes del primer deploy

1. Configurar los secretos `ESCORT_SESSION_SECRET` y `ESCORT_ADMIN_TOKEN` con `wrangler secret put`.
3. Conectar `media-escorts.mansiondeseo.com` al bucket público. El bucket privado nunca debe tener dominio público.
4. Ejecutar `npm run db:migrate:remote` y recién entonces `npm run deploy`.

## Imágenes

- Originales privados: `ESCORT_MEDIA_PRIVATE`.
- Solo derivados aprobados públicos: `ESCORT_MEDIA_PUBLIC`.
- Derivados esperados: tarjeta 320/640px y perfil 1280px, con URLs versionadas y AVIF/WebP.
- El dominio público de medios debe ser un Custom Domain de R2, con `Cache-Control: public, max-age=31536000, immutable` para archivos versionados.
- Existe un endpoint público de reportes. Antes de lanzamiento, el administrador debe revisar reportes abiertos cada día y pausar el perfil inmediatamente si hay riesgo de suplantación, falta de consentimiento o posible minoría de edad.

## Importación desde ArgXP

`npm run import:argxp` intenta conectarse a Chrome por CDP en `127.0.0.1:9222`. Si no encuentra una sesión abierta, inicia automáticamente Chrome con el perfil persistente `.chrome-argxp-profile` y espera hasta 30 segundos a que esté disponible. La primera vez hay que iniciar sesión manualmente en esa ventana; las siguientes ejecuciones reutilizan la sesión guardada.

Opciones útiles:

```bash
npm run import:argxp -- --limit=100 --existing=skip --delay-ms=3000
npm run import:argxp -- --cdp-url=http://127.0.0.1:9333
npm run import:argxp -- --no-auto-browser
```

También se puede definir `ARGXP_CHROME_PATH`, `ARGXP_CHROME_PROFILE` o `ARGXP_CDP_URL` si se necesita una instalación, perfil o puerto diferente.

## Niveles

`basic`, `bronze`, `silver`, `gold`, `platinum`, `diamond`. Los precios se expresan en USD. Una promoción activa no publica ni salta la revisión de un perfil.
