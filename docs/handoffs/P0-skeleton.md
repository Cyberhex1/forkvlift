# [P0] Skeleton run: Opus

**Preview:** https://forkvlift-preview.kdlindsey25.workers.dev (fixtures off, so the catalog is honestly empty)

## What exists

- **Monorepo** (pnpm): `apps/web` (React 19 + Vite 8 + Tailwind 4 + React Router 8 + TanStack Query), `apps/worker` (Hono), `apps/admin`, `packages/shared`, `packages/ui`.
- **One Worker** serves the static app and `/api/*`, built through the Cloudflare Vite plugin. `wrangler.jsonc` declares D1, KV, R2 (local only until R2 is enabled), Durable Objects (`ChatRoom`, `LiveThread`), Queues (producer and consumer), two Cron Triggers, Vectorize, Workers AI and rate limits, for local, preview and production.
- **D1 schema** (Drizzle, first migration applied locally and to preview) covers every table in the product plan, including `stage`, nullable `license_spdx` (null means no license), build facts, `is_template` and `replaces`.
- **Contract** (`packages/shared/src/api/routes.ts`): about 100 routes with Zod params, query, body and response, a typed client, and the error shape. Every route is registered in the Worker. A test checks that every route has a handler, that every JSON GET's fixture matches its schema, and that bad bodies return the error shape.
- **Dev fixtures** cover every JSON route, including the variants: unlicensed, WIP, up for adoption, curated unclaimed, and long text. They're compiled out of builds by the `__FIXTURES__` define, and `check-no-fixtures` scans the build output.
- **Auth:** GitHub OAuth (state cookie, no token stored, sessions hashed in D1), magic link (logs the link locally; email sending comes with 2.3), and `requireUser` / `requireAdmin` (Cloudflare Access JWT; local session admin; fixture admin). `ADMIN_GITHUB_LOGINS=Cyberhex1`.
- **Security:** rate limits on every write, Turnstile verification helper, secure headers on the API, a CSP and other headers on static assets (`apps/web/public/_headers`), and same-site-only redirects.
- **Realtime:** `ChatRoom` DO with hibernation (hello, say, move, typing, ping) and history in DO SQLite, verified over a WebSocket locally. `LiveThread` DO is a broadcast stub.
- **Jobs:** cron enqueues typed jobs; the queue consumer validates and acks them (handlers are not built yet).
- **App shell:** router with every page stubbed (feed, `/p/:slug`, studio, profiles, forum, plaza, resources, requests, alternatives, settings, static pages, 404). Each feature owns its `routes.tsx`. The shell has a header (logo, search slot, music slot, profile menu), a footer slot, theme and reduced-motion preferences, and the show-unlicensed preference with disclaimer acceptance.
- **`packages/ui`:** tokens for the light, dark and retro themes plus a 16-color pixel palette, with Tailwind's default palette removed. Components: Button, Badge (stage and license tones), Chip, Avatar, Modal (blurred backdrop), Drawer, Card, Tabs, Toast, Spinner, Skeleton, StateMessage.
- **Guard rails:** CI (typecheck, lint, tests, build, ownership check, no-fixtures check), `OWNERS.json`, `AGENTS.md`, `agents/*.md`, the contract-request template, and the PR template.

## Not done / needs the owner

- **GitHub OAuth apps** (you create them in GitHub settings): one for local dev (callback `http://127.0.0.1/api/auth/github/callback`) and one for preview (callback `https://forkvlift-preview.kdlindsey25.workers.dev/api/auth/github/callback`). Then `wrangler secret put GITHUB_CLIENT_ID --env preview` and `GITHUB_CLIENT_SECRET` from `apps/worker`. The code path is built, but the full sign-in flow hasn't been tested against GitHub yet.
- **R2:** enable it in the Cloudflare dashboard, then I'll create the buckets and turn on the binding.
- **Turnstile** site key and secret, and **Cloudflare Access** for the admin console. The admin Worker isn't deployed yet.

## How to test

`pnpm dev`, open http://127.0.0.1:8787, then `/api/dev/login?as=fx-ada` and `/api/projects?showUnlicensed=true`. Run `pnpm check` for everything CI runs.
