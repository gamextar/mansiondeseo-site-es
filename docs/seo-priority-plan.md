# SEO Priority Plan

Objetivo: concentrar la autoridad orgánica en las búsquedas con mayor intención de registro y dejar el resto como soporte long tail.

## Prioridad 1

- `/contactossex`
- `/contactossex-argentina`
- `/cornudos-argentina`
- `/cuckold-argentina`

Estas páginas atacan búsquedas exactas o muy cercanas a la intención principal del sitio.

## Prioridad 2

- `/contactossex/caba`
- `/contactossex/buenos-aires`
- `/contactossex/cordoba`
- `/contactossex/rosario`
- `/contactossex/mendoza`
- `/contactossex-argentina/caba`
- `/contactossex-argentina/buenos-aires-provincia`
- `/contactossex-argentina/cordoba-provincia`

Estas URLs suelen tener mejor volumen y mejor chance de conversión por geografía.

## Prioridad 3

- `/cornudos-argentina/caba`
- `/cornudos-argentina/buenos-aires-provincia`
- `/cornudos-argentina/cordoba-provincia`
- `/cuckold-argentina/caba`
- `/cuckold-argentina/buenos-aires-provincia`
- `/cuckold-argentina/cordoba-provincia`
- `/contactossex/{otras-ciudades}`
- `/cornudos-argentina/{otras-ciudades}`
- `/cuckold-argentina/{otras-ciudades}`

Sirven para capturar long tail regional y búsquedas menos competidas.

## Reglas de contenido

- Mantener la home y bienvenida enfocadas en privacidad, exclusividad y perfiles verificados.
- No sobrecargar la navegación pública con demasiadas variantes.
- Dejar `tríos` solo como landing SEO, sin destacarlo en la superficie principal.
- Priorizar textos que suenen naturales para adultos registrados, no solo listas de keywords.

## Regla operativa

- Si se agrega una nueva ciudad o provincia, incluirla en `src/lib/seoGeoCatalog.js`.
- El sitemap se regenera solo con `npm run build`.
- No duplicar páginas manualmente si la misma plantilla puede resolver la variante.
