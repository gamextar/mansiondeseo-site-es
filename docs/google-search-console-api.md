# Google Search Console API

Este flujo permite exportar datos de Search Console sin compartir contraseña. Usa OAuth local de solo lectura.

## 1. Crear credenciales

1. Entrá a Google Cloud Console.
2. Creá o elegí un proyecto.
3. Habilitá `Google Search Console API`.
4. Creá credenciales OAuth de tipo `Desktop app`.
5. Descargá el JSON y guardalo como:

```txt
config/google-search-console/credentials.json
```

Ese archivo está ignorado por git.

## 2. Autorizar y exportar

```bash
npm run seo:gsc
```

La primera vez abre Google en el navegador. Autorizá con la cuenta que tenga acceso a la propiedad de Search Console.

Por defecto usa:

```txt
sc-domain:mansiondeseo.com
```

Para otra propiedad:

```bash
npm run seo:gsc -- --site "https://mansiondeseo.com/"
```

## 3. Archivos generados

Se guardan en:

```txt
data/search-console/
```

Exporta:

- consultas
- páginas
- consultas + páginas
- países
- dispositivos
- fechas
- resumen JSON con oportunidades iniciales

La carpeta está ignorada por git.

## Opciones útiles

```bash
npm run seo:gsc -- --days 180
npm run seo:gsc -- --startDate 2026-02-01 --endDate 2026-05-01
npm run seo:gsc -- --site "sc-domain:mansiondeseo.com"
```

