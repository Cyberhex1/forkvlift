# AGENTS.md: rules for every agent

**ForkvLift** is a free, social catalog of vibe-coded projects, finished and unfinished, with public code people can fork and point their own agents at, so nobody rebuilds the same app twice. It also points people to free, open alternatives to subscription software. Full spec: [docs/product-plan.md](docs/product-plan.md). Who builds what: [docs/implementation-plan.md](docs/implementation-plan.md). (The docs say "ForkYard", which was the working name. Read it as ForkvLift.)

Read this file, then your own briefing in `agents/<you>.md`, at the start of every session.

## The rules

1. **Only edit what [OWNERS.json](OWNERS.json) gives you.** CI fails PRs that touch other folders. Need something elsewhere (a new API field, a token, a dependency, a route)? Write a request in `docs/contract-requests/` (copy `TEMPLATE.md`) and keep working against what exists.
2. **Import types from `@forkvlift/shared`.** Never redefine an entity locally. The API contract is `packages/shared/src/api/routes.ts`. Call it with the typed client: `api.call("getProject", { params: { slug } })`.
3. **Use `@forkvlift/ui` components and token classes** (`bg-surface`, `text-muted`, `bg-accent`, `bg-stage-wip`, `bg-pixel-4` …). Tailwind's default palette is switched off, so hard-coded colors fail lint. Same for fonts: `font-display`, `font-body`, `font-mono`.
4. **No fake content in anything that ships.** Dev fixtures live only in `packages/shared/src/fixtures` and are served by the Worker in local dev. Clients never import them, and CI fails if they reach a build.
5. **Mobile first.** Every screen must work at 375 px. Respect reduced motion (`usePreferences().motionReduced`) and the music mute setting.
6. **Every screen handles** empty, loading and error states, plus the WIP and "No license" variants where they apply.
7. **Unlicensed projects are hidden by default.** Lists exclude them unless `showUnlicensed` is on (`usePreferences().showUnlicensed`). The disclaimer text is `NO_LICENSE_DISCLAIMER` in shared. Never paraphrase it.
8. **One task = one PR**, titled with the task ID (`[1.9] Focus panel`), from a branch named `<agent>/<task-id>-<slug>` (e.g. `sol/1.9-focus-panel`). Add a handoff note in `docs/handoffs/<task-id>-<slug>.md`: what changed, how to test, what's unfinished.
9. **After every merge checkpoint:** `git fetch && git rebase origin/main`.

## Running it

```bash
pnpm install
cp apps/worker/.dev.vars.example apps/worker/.dev.vars   # once
pnpm db:migrate:local                                     # once, and after schema changes
pnpm dev                                                  # web + API on your port
```

Ports are picked from your worktree folder: opus/main **8787**, sol **8788**, flash **8789**. The admin console (`pnpm dev:admin`) runs on that port + 3.

- **Sign in locally without GitHub:** open `/api/dev/login?as=fx-ada` (or `fx-bo`, `fx-admin`). Sign out with `/api/dev/logout`.
- **Fixtures:** in dev, every JSON API route answers from fixtures. Set `USE_FIXTURES=false` in `apps/worker/.dev.vars` to hit the real handlers.
- **Before opening a PR:** `pnpm check` (typecheck, lint, tests, build, no-fixtures check).

## Where things live

| Path | What |
| --- | --- |
| `packages/shared` | Zod schemas, the API contract, typed client, constants, dev fixtures (Opus) |
| `packages/ui` | Tokens (`tokens.css`) and base components (Opus); icons, sprites, art (Flash) |
| `apps/web/src/app` | Shell: router, layout, header, session, preferences (Opus) |
| `apps/web/src/features/<area>` | Feature UIs. Each exports its routes from `routes.tsx` |
| `apps/worker` | Hono API, D1 schema, auth, Durable Objects, jobs (Opus); `routes/social.ts`, `routes/growth.ts` (Sol); `routes/feeds.ts` (Flash) |
| `apps/admin` | Curation console UI (Sol); `worker/` guard (Opus) |
| `e2e/` | Playwright tests (Sol) |
| `data/seed`, `scripts/seed` | Verified seed catalog and scripts (Flash compiles, Opus verifies) |
