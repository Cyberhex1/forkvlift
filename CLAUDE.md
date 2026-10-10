# ForkLift — Context Brief for Coding Agents

> Site name: **ForkLift** (domain `forklift.stream`; slug `forklift`; keep it in the `SITE_NAME` constant). Older docs say "ForkYard" or "ForkvLift": read both as ForkLift. **Internal identifiers keep `forkvlift` on purpose and must not be renamed**: the `@forkvlift/*` package scope, Cloudflare resource names (`forkvlift-preview`, D1, R2, KV, queues), the GitHub repo, and the folders `C:\code\ForkvLift` and `C:\code\forkvlift-wt`.
> Full specs live in `docs/`. Read this file first, then the two plans.

## What we're building

A social catalog of vibe-coded projects, finished **and** unfinished, with public code that people can fork and point their own agents at, so nobody rebuilds the same app twice. Secondary mission: free, open alternatives to subscription-heavy big-company software. The site stays free and has no paywalled core features.

## Source documents (read these)

| File | What it holds |
| --- | --- |
| `docs/product-plan.md` | Every feature: cards, focus panel, discovery, Studio, profiles, forum, Plaza chat, music, resources, admin console, licensing rules, architecture, roadmap |
| `docs/implementation-plan.md` | Who builds what, folder ownership, Phase 0 skeleton checklist, task board (IDs like `1.9`), merge rules, definition of done |

If this brief and those docs disagree, the docs win. Ask the owner if unsure.

## Decisions already made (don't relitigate)

- **Hosting:** Cloudflare **Workers with static assets**, not Cloudflare Pages. Live chat needs Durable Objects and discovery needs Cron Triggers, which Pages lacks.
- **Stack:** React + Vite + TypeScript + Tailwind; Hono API on Workers; D1 (Drizzle), R2, KV, Durable Objects, Queues, Cron, Vectorize, Turnstile, Cloudflare Access for admin.
- **Auth:** GitHub OAuth (primary) + email magic link.
- **Unlicensed projects:** allowed, but **hidden by default** everywhere. A "Show unlicensed projects" switch (filter drawer + Settings, off by default) reveals them after a one-time disclaimer dialog. Their panels show the disclaimer banner and replace the clone box with "Ask the author to add a license" and "Request to build on this". The exact disclaimer text is in the product plan (Trust, safety, licensing).
- **Unfinished projects:** listed with a stage badge (Finished / Work in progress / Up for adoption).
- **Reddit:** no scraping or unofficial APIs. The admin console uses a paste-a-link importer. Reddit API access only if Reddit approves a request.
- **No fake content:** nothing fake ships. The catalog is seeded only with real, verified repos (implementation plan, "Seeding"). Dev fixtures live in `packages/shared/fixtures` and never deploy.
- **No paid boosts or placement.**
- **Curated imports must be licensed.** Unlicensed projects only come from their own authors (owner, 2026-10-10).

## Team and ownership

| Agent | Runs in | Branch / worktree | Owns |
| --- | --- | --- | --- |
| Claude Opus 5.5 | Claude Code (Claude desktop app) | `agent/opus` (+ `main` for merges) | Skeleton, `packages/shared` (contract), core/auth, Durable Objects, jobs, security, all merges |
| GPT-6.1 Sol | Codex in the ChatGPT desktop app | `agent/sol` | Feature UIs under `apps/web/src/features/{catalog,studio,profile,community,resources,growth}`, `apps/admin` UI, `e2e/` |
| Gemini 3.8 Flash | Antigravity IDE | `agent/flash` | `features/{pages,settings,music,avatar}`, icons/sprites in `packages/ui`, feeds, badges, seed scripts |

`OWNERS.json` is the source of truth once it exists. Edit only your folders. Request changes to anyone else's via `docs/contract-requests/`.

## Rules for every session

1. Import types from `packages/shared`; never redefine an entity.
2. Use `packages/ui` tokens and components; no hard-coded colors or fonts.
3. Mobile first: every screen must work at 375 px. Respect reduced motion and the music mute setting.
4. Handle empty, loading, and error states, plus the WIP and "No license" variants.
5. One task = one PR titled with its task ID (e.g. `[1.9] Focus panel`), plus a note in `docs/handoffs/`.
6. Rebase on `main` after every merge checkpoint.

## Current status

- **Phase 0 skeleton is merged** (see `docs/handoffs/P0-skeleton.md`). Phase 1 is open: all three agents work in parallel.
- Repo: https://github.com/Cyberhex1/forkvlift (public). Main checkout `C:\code\ForkvLift` (`main`); worktrees `C:\code\forkvlift-wt\{opus,sol,flash}`.
- Day-to-day rules and commands: `AGENTS.md`, plus `agents/<you>.md`.

## Open questions for the owner

- Domain `forklift.stream`: connect it as the production Worker's custom domain at the Phase 1 gate (needs its nameservers on Cloudflare)
- GitHub account or org that owns the repo; public from day one?
