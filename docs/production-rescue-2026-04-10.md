# Production Rescue 2026-04-10

This branch is a stable recovery point created after restoring the known-good Cloudflare Pages deployment.

## What It Preserves

- Public profile source restored from the pre-rollback state.
- Admin "Poner en revision" profile functionality restored in source.
- Public filtering for users under review restored in source.
- Canonical media domain set to `https://media.mansiondeseo.com`.
- Media URLs are now canonicalized to `https://media.mansiondeseo.com`.
- Main feed backend page size set to 42 profiles.
- `dist/` includes fresh build assets plus aliases for recent stale chunk names to reduce MIME/cache breakage.

## Restore Commands

Deploy API/Worker from this branch:

```bash
npx wrangler deploy
```

Deploy Pages from the tracked build output:

```bash
npx wrangler pages deploy dist --project-name mansiondeseo-site --branch main
```

If the live frontend is healthy, prefer Cloudflare Pages rollback from the dashboard before deploying new source.
