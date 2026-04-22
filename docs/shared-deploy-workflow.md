# Shared Deploy Workflow

## Goal

One shared codebase, with country differences handled by:

- Cloudflare env vars
- D1 / R2 / Durable Objects
- domains
- payment gateways
- per-country settings

## Local branches

- `main`: shared trunk, aligned with `origin/main`
- `country/es-bootstrap-2026-04`: local safety branch that preserves the ES setup history

Use `main` for normal app and backend work.

## Daily flow

Create your change from `main`:

```bash
git switch main
git pull origin main
git switch -c feat/mi-cambio
```

After coding:

```bash
git add .
git commit -m "Describe el cambio"
npm run deploy:shared
```

`npm run deploy:shared` pushes the current `HEAD` to:

- `origin/main`
- `espejo-es/main`

That keeps Argentina and Spain on the same code.

## When not to use it

Do not use `npm run deploy:shared` for:

- secrets
- Cloudflare dashboard changes
- Pages env vars
- D1 data fixes
- R2 bucket operations
- country-only infra work

Those should be handled directly in Cloudflare or in a dedicated country setup branch.

## Spain-specific history

The branch `country/es-bootstrap-2026-04` exists only as a local backup of the ES rollout work.
It is there in case you need to inspect or recover that setup history. It is not the branch for normal daily development.
