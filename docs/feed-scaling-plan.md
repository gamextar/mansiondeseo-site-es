# Feed Scaling Plan

## Estado actual

El feed principal ya tiene varias capas de cache:

- cache L1 en memoria del isolate en [api/src/index.js](/Users/javierasenjofuchs/LOCAL%20DEV/MANSIONDESEO.COM/mansiondeseo-site/api/src/index.js)
- cache L2 cross-isolate con `caches.default` en [api/src/index.js](/Users/javierasenjofuchs/LOCAL%20DEV/MANSIONDESEO.COM/mansiondeseo-site/api/src/index.js)
- cache del query base compartido por combinación `profiles:${seekingKey}:${countryKey}:${search}` en [api/src/index.js](/Users/javierasenjofuchs/LOCAL%20DEV/MANSIONDESEO.COM/mansiondeseo-site/api/src/index.js)
- cache del feed ya procesado por viewer `feed:${auth.sub}:...` en [api/src/index.js](/Users/javierasenjofuchs/LOCAL%20DEV/MANSIONDESEO.COM/mansiondeseo-site/api/src/index.js)

La consulta actual:

1. lee settings y viewer
2. arma un SQL base filtrado por `role`, `country`, `search`
3. trae hasta `feedSqlLimit`
4. mapea, aplica reglas premium/ghost/favorites/stories
5. calcula `_feedScore`
6. ordena
7. cachea el resultado final por viewer

## Qué no conviene hacer

### HTML estático

No vale la pena porque el feed:

- requiere login
- depende de `seeking` del usuario
- depende de premium, ghost mode y favoritos
- puede variar por país y por búsqueda

### Cachear solo 9 HTMLs

Tampoco alcanza. Aunque conceptualmente haya 9 combinaciones simples:

- hombre buscando mujer
- hombre buscando pareja
- hombre buscando hombre
- mujer buscando hombre
- mujer buscando pareja
- mujer buscando mujer
- pareja buscando hombre
- pareja buscando mujer
- pareja buscando pareja

en la práctica hoy también existen:

- `pareja_hombres`
- `pareja_mujeres`
- `trans`
- usuarios con múltiples valores en `seeking`
- `search`
- `country`
- scoring por intereses compartidos

## Recomendación

La mejora grande no sería “más HTML cacheado”, sino introducir una capa de **candidate pools precomputados**.

Idea:

1. Precomputar periódicamente una lista de candidatos por bucket base.
2. Guardar solo IDs + score base + metadatos mínimos.
3. En cada request del feed, tomar esa lista base y aplicar arriba solo lo específico del viewer.

## Arquitectura propuesta

### Fase 1: Bucket cache compartido

Agregar una estructura precomputada por bucket, por ejemplo:

- `hombre->mujer`
- `hombre->pareja`
- `hombre->hombre`
- `mujer->hombre`
- `mujer->pareja`
- `mujer->mujer`
- `pareja->hombre`
- `pareja->mujer`
- `pareja->pareja`

Opcionalmente:

- `hombre->trans`
- `mujer->trans`
- buckets separados para `pareja_hombres` y `pareja_mujeres`

Cada bucket debería guardar, por usuario:

- `user_id`
- `role`
- `last_active`
- `followers_total`
- `has_active_story`
- `premium`
- `photo_count`
- `base_score`
- `rank`
- `updated_at`

`base_score` incluiría solo señales compartidas:

- actividad reciente
- story activa
- cantidad de fotos
- seguidores
- premium

No incluiría:

- intereses compartidos con el viewer
- favoritos del viewer
- blur por ghost mode respecto al viewer

### Fase 2: Resolver el feed desde el pool

El endpoint del feed dejaría de escanear y ordenar el universo completo.

Nuevo flujo:

1. leer viewer y settings
2. determinar bucket base por `role + seeking principal`
3. leer top N `user_id` desde el pool precomputado
4. traer solo esos usuarios desde `users`
5. aplicar encima:
   - exclusión de sí mismo
   - favoritos
   - ghost mode
   - intereses compartidos
   - reordenamiento fino
6. devolver la página

Esto baja mucho:

- D1 rows leídas por request
- trabajo de map/sort en runtime
- costo cuando el feed crece a miles de perfiles

### Fase 3: Cache por viewer más chico

Mantener el cache actual por viewer, pero alimentado desde esos pools.

Eso vuelve mucho más barato:

- primer request del viewer
- paginación por cursor
- invalidaciones

## Dónde guardar los pools

### Opción recomendada: tabla materializada en D1

Ventajas:

- ya existe D1 en el proyecto
- fácil de consultar y depurar
- fácil de refrescar con cron o script
- fácil de paginar por `rank`

Ejemplo conceptual:

```sql
CREATE TABLE IF NOT EXISTS feed_candidate_pool (
  bucket_key TEXT NOT NULL,
  rank INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  base_score REAL NOT NULL,
  last_active TEXT,
  followers_total INTEGER NOT NULL DEFAULT 0,
  has_active_story INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (bucket_key, rank)
);
```

Índices:

```sql
CREATE INDEX IF NOT EXISTS idx_feed_candidate_pool_user_id
ON feed_candidate_pool(user_id);
```

### Opción 2: KV

También serviría, pero hoy el repo no tiene binding de KV. Sería útil para guardar arrays JSON por bucket, pero complica más:

- invalidación
- ordenamiento fino
- depuración

### Opción 3: R2 JSON

No la recomiendo para este caso. Es buena para snapshots grandes, pero menos cómoda para lectura frecuente y refresh incremental.

## Cómo refrescar el pool

### Opción A: cron del Worker

La más prolija a mediano plazo.

- cada 2 a 5 minutos
- recalcula top N por bucket
- reemplaza el pool

### Opción B: script manual/on-demand

Más simple para arrancar.

- script local o admin task
- recalcula buckets cuando subís lotes nuevos
- invalida caches actuales

### Opción C: refresh híbrido

- refresh total por cron
- refresh puntual al importar nuevos perfiles o stories

## Impacto esperado

Si hoy el feed usa `feedSqlLimit = 400`, cada miss importante:

- trae hasta 400 filas
- las mapea
- las puntúa
- las ordena
- luego cachea

Con pools:

- el request típico podría leer solo 60 a 120 IDs candidatas
- mapear y reordenar un subconjunto mucho más chico
- mantener el mismo comportamiento visual

## Qué haría yo en este proyecto

### Paso 1

No tocaría el producto todavía. Primero implementaría un pool compartido simple en D1 para las 9 combinaciones principales.

### Paso 2

Dejaría el endpoint actual detrás de un flag:

- modo actual
- modo pool

Así se puede comparar sin arriesgar el feed real.

### Paso 3

Si funciona bien, después recién:

- extender a `trans`
- separar `pareja_hombres` y `pareja_mujeres`
- sumar country si vuelve a activarse fuerte

## Conclusión

Sí vale la pena escalar el feed, pero no con HTMLs estáticos.

La mejor inversión parece ser:

- **precomputed candidate pools**
- **mantener el cache actual por viewer**
- **hacer el scoring fino solo sobre un subconjunto**

Eso conserva personalización, baja costo por request y prepara el feed para crecer sin reescribir toda la experiencia.
