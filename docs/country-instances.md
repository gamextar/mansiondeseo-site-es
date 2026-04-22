# Country Instances

Mansion Deseo keeps one codebase and separates each country through build variables,
Cloudflare resources, and D1 seed data.

## Frontend build variables

Use `.env.country.example` as the Pages environment template.

Required per country:

- `VITE_SITE_COUNTRY`
- `VITE_SITE_LOCALE`
- `VITE_SITE_SEO_LOCALE`
- `VITE_SITE_TIMEZONE`
- `VITE_SITE_CURRENCY`
- `VITE_SITE_ORIGIN`
- `VITE_SITE_MEDIA_BASE`
- `VITE_API_BASE`
- `VITE_WS_BASE`
- `VITE_TURNSTILE_SITE_KEY`

## Cloudflare resources

Each country should have its own:

- Pages project
- Worker API
- D1 database
- R2 bucket
- Durable Objects namespaces
- secrets

Spain starts from:

- `wrangler.es.toml`
- `api/seeds/country-es.sql`
- `config/countries/es.json`

## Bootstrap order

```bash
npx wrangler d1 create mansion-deseo-db-es --jurisdiction eu
npx wrangler r2 bucket create mansion-deseo-images-es --jurisdiction eu
npx wrangler d1 execute mansion-deseo-db-es --remote --file api/schema.sql
npx wrangler d1 execute mansion-deseo-db-es --remote --file api/seeds/country-es.sql
npx wrangler deploy --config wrangler.es.toml
npm run build
npx wrangler pages deploy dist --project-name mansiondeseo-site-es --branch country/es
```

Do not clone users, messages, visits, payments, or private media into a new country
unless the goal is a controlled migration from an existing global database.

## Git mirror option

Cloudflare Pages does not allow the same Git repository to be connected to Pages
projects in different Cloudflare accounts. If a country account needs Git-based
deployments and rollbacks, create a dedicated mirror repository for that country.

Recommended convention:

- Source repo: `gamextar/mansiondeseo-site`
- ES mirror repo: `gamextar/mansiondeseo-site-es`
- Cloudflare Pages B production branch: `main`

The mirror repo should not be edited directly. Sync it from the source repo:

```bash
npm run mirror:country -- \
  --repo git@github.com:gamextar/mansiondeseo-site-es.git \
  --remote espejo-es \
  --branch main \
  --target-branch main
```

If the mirror is intentionally read-only and diverged because of a previous
rollback or manual change, sync with:

```bash
npm run mirror:country -- \
  --repo git@github.com:gamextar/mansiondeseo-site-es.git \
  --remote espejo-es \
  --branch main \
  --target-branch main \
  --force-with-lease
```

The script refuses to run with uncommitted changes, because Cloudflare Pages can
only deploy committed Git state.
