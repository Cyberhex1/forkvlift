<img src="assets/forklift-icon.svg" alt="ForkLift icon" width="96" height="96">

# ForkLift

A free, social catalog of vibe-coded projects, finished and unfinished, with public code you can fork and point your own agents at, so nobody rebuilds the same app twice.

- Product plan: [docs/product-plan.md](docs/product-plan.md)
- Implementation plan and task board: [docs/implementation-plan.md](docs/implementation-plan.md)
- Rules for contributors and agents: [AGENTS.md](AGENTS.md)

## Stack

React + Vite + TypeScript + Tailwind, Hono API, one Cloudflare Worker with static assets, D1 (Drizzle), KV, R2, Durable Objects, Queues, Cron Triggers, Vectorize, Turnstile, and Cloudflare Access for the admin console.

## Develop

```bash
pnpm install
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
pnpm db:migrate:local
pnpm dev            # http://127.0.0.1:8787
```

In dev, every API route answers from clearly marked dev fixtures. To sign in as a fixture user, open `/api/dev/login?as=fx-ada`. Fixtures are compiled out of every build, and CI checks that.

To use real GitHub sign-in locally, create a GitHub OAuth app with the callback `http://127.0.0.1/api/auth/github/callback` and put its ID and secret in `apps/worker/.dev.vars`.

## Deploy

```bash
pnpm deploy:preview     # D1 migrations + build + deploy forkvlift-preview
```

Production deploys happen only at phase gates: `pnpm --filter @forkvlift/worker db:migrate:production && pnpm --filter @forkvlift/web deploy:production`.

### One-time Cloudflare setup still needed

- **R2:** enable it in the dashboard, then run `wrangler r2 bucket create forkvlift-media-preview` (and `-prod`) and uncomment `r2_buckets` in `apps/worker/wrangler.jsonc`.
- **Secrets** (per env): `wrangler secret put GITHUB_CLIENT_ID --env preview`, `GITHUB_CLIENT_SECRET`, `TURNSTILE_SECRET`, plus `TURNSTILE_SITE_KEY` in vars.
- **Admin console:** create a Cloudflare Access application for the admin hostname. Set `ACCESS_TEAM_DOMAIN` (e.g. `yourteam.cloudflareaccess.com`) and `ACCESS_AUD` in `wrangler.jsonc`, then deploy `apps/admin`.
