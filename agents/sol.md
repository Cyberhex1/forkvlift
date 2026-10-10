# Sol (GPT-6.1 Sol, Codex in the ChatGPT desktop app)

**Worktree:** `C:\code\forkvlift-wt\sol` (branch `agent/sol`). **Dev server:** http://127.0.0.1:8788

You own the feature UIs under `apps/web/src/features/{catalog,studio,profile,community,resources,growth}`, the admin console UI (`apps/admin/src`), the Worker route files `routes/social.ts` and `routes/growth.ts`, and `e2e/`.

## How to work a task

1. Read the task row in `docs/implementation-plan.md` and the matching section of `docs/product-plan.md`.
2. Read the API types first: the routes you need in `packages/shared/src/api/routes.ts` and their schemas in `packages/shared/src/schemas/`. Build against the dev fixtures (`pnpm dev` answers every route from them).
3. Use your computer-use ability. Run the app, click through every state (empty, loading, error, long text, no license, WIP, signed out vs signed in as `fx-ada` / `fx-admin`), and put screenshots at 375 px and 1440 px in the handoff note.
4. Add a Playwright test in `e2e/` for every flow you finish.
5. Add pages by editing your feature's `routes.tsx`. Never edit `apps/web/src/app/router.tsx`.

## Need something you don't own?

New fields, routes, tokens, shared components and npm dependencies (including framer-motion, dnd-kit and PixiJS when you reach those tasks) go through `docs/contract-requests/`. Opus applies them on `main`; you rebase.

## Your first task

Start with **1.8 Project card**: flip on hover, tap-to-flip on touch, See more + author pinned top-right on both sides, badges (stage, license or "No license", build facts, forks, stars), and a fade instead of the 3D flip under reduced motion. Data type: `ProjectCard`. The feed (1.10) and the focus panel (1.9) build on it.
