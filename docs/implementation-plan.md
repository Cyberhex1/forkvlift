# ForkYard — Implementation Plan

Oct 10, 2026 · @ohnna

## Team and how work is split

Opus builds the skeleton and every hard or cross-cutting system first, then all three agents work in parallel, each in its own folder and branch, with Opus merging at checkpoints. Nothing gets built until you connect your desktop and approve this plan; all paths below are placeholders.

| Agent | Tier | What it's best at (public info) | Gets |
| --- | --- | --- | --- |
| **Claude Opus 5.5** (me) | Hard + skeleton | Architecture, tricky backend logic, security, reviewing others' code | Skeleton run, data model, auth, realtime (Durable Objects), GitHub ingestion, search, security, all merges |
| **GPT-6.1 Sol** | Middle | [OpenAI's mid-tier upgrade](https://felo.ai/tools/gpt-6-1-sol) (released Sep 29, 2026): near-flagship agentic coding and computer use, 1,050,000-token context | Feature UIs (cards, focus panel, kanban, profiles, forum, Plaza client), plus end-to-end and visual testing, since computer use lets it click through the real site |
| **Gemini 3.8 Flash** | Easier | [Google's best Flash model](https://www.datacamp.com/blog/gemini-3-8-flash-cyber) (released Sep 2, 2026): fast and cheap, strong at command-line tasks (90.8% on Terminal-Bench 2.1), reads images, audio and video | Static pages, settings, music player, avatar assets, badges, feeds, seed-data scripts, accessibility and copy passes |

**Assignment rules**

1. Anything that defines a shared contract (database schema, API types, auth, design tokens) is Opus only. Others request changes; they never edit it directly.
2. A feature's backend and its UI can belong to different agents. The skeleton defines the API shape first so they never wait on each other.
3. Sol gets anything that benefits from seeing and clicking the running app: complex interactions, the Plaza canvas, and the Playwright test suite.
4. Flash gets self-contained work with a clear spec and low blast radius, plus scripting and data jobs where its terminal strength helps.
5. When unsure, round up a tier. A middle task given to Flash costs more in rework than it saves.

The strengths column comes from launch coverage, not hands-on testing. Swap tasks freely if one agent underperforms in your setup.

## Workspace setup for parallel work

One git repository, three **git worktrees**: each agent gets its own folder on its own branch, all sharing one history. Each code app opens only its own folder, so nobody overwrites anyone else's files, and merging is ordinary git. Paths are placeholders until your desktop is connected; I'll adjust them during the skeleton run.

| Folder (placeholder) | Branch | Opened in | Used by |
| --- | --- | --- | --- |
| `~/Code/forkyard/` | `main` | Claude (desktop) | Opus: integration, merges, deploys |
| `~/Code/forkyard-wt/opus/` | `agent/opus` | Claude (desktop) | Opus: hard features |
| `~/Code/forkyard-wt/sol/` | `agent/sol` | Sol's code app | Sol |
| `~/Code/forkyard-wt/flash/` | `agent/flash` | Flash's code app (e.g. Antigravity) | Flash |

All three run the dev server on different ports (Opus 8787, Sol 8788, Flash 8789), each with its own local D1 database, so they never collide.

**Repository layout and owners**

```text
forkyard/
├─ AGENTS.md                  shared rules (Opus)
├─ OWNERS.json                path → owner map, checked by CI (Opus)
├─ agents/                    one briefing file per agent (Opus)
├─ apps/
│  ├─ web/src/
│  │  ├─ app/                 shell, router, layout, header (Opus)
│  │  ├─ features/catalog/    cards, panel, feed, submit (Sol)
│  │  ├─ features/studio/     kanban, planning tools (Sol)
│  │  ├─ features/profile/    profiles, DMs, collab, notifications (Sol)
│  │  ├─ features/community/  forum, Plaza client (Sol)
│  │  ├─ features/resources/  resources library (Sol)
│  │  ├─ features/growth/     requests, jams, launches, alternatives (Sol)
│  │  ├─ features/pages/      about, rules, licensing 101, legal (Flash)
│  │  ├─ features/settings/   account settings, collections (Flash)
│  │  ├─ features/music/      elevator music player (Flash)
│  │  └─ features/avatar/     avatar builder (Flash)
│  ├─ admin/                  curation console UI (Sol), guards (Opus)
│  └─ worker/src/
│     ├─ core/                auth, db, middleware, security (Opus)
│     ├─ durable/             chat, presence, live threads (Opus)
│     ├─ jobs/                cron, queues, GitHub ingestion (Opus)
│     └─ routes/<area>.ts     one file per area; owner = same as its UI
├─ packages/
│  ├─ shared/                 schemas, types, API contract (Opus only)
│  └─ ui/                     tokens + base components (Opus); icons, sprites, art (Flash)
├─ data/seed/                 verified seed catalog JSON (Flash compiles, Opus verifies)
├─ e2e/                       Playwright tests (Sol)
└─ docs/
   ├─ contract-requests/      change requests to Opus-owned files
   └─ handoffs/               end-of-task notes from each agent
```

**The ownership rule.** `OWNERS.json` maps every folder to one agent. A CI check fails any pull request that edits files outside the author's folders. Needing a change elsewhere (for example a new field in `packages/shared`) means writing a short file in `docs/contract-requests/`; Opus applies it on `main`, and the requester rebases.

## Phase 0 — Skeleton run (Opus, solo)

The skeleton run gives Sol and Flash a working app shell, a frozen API contract, and empty folders to fill, so all three can work at once without waiting on each other. Nobody else starts until every box below is ticked.

**Setup (after your desktop is connected)**

- [ ] Confirm real folder paths and which code app each agent uses; update the placeholders
- [ ] Create the repo, the three worktrees and branches, and `OWNERS.json`
- [ ] Choose the final site name (or keep "ForkYard" as a code name; it's a single constant)

**Foundations**

- [ ] pnpm monorepo: `apps/web` (React + Vite + TS + Tailwind), `apps/admin`, `apps/worker` (Hono), `packages/shared`, `packages/ui`
- [ ] `wrangler.jsonc` with every binding declared (D1, R2, KV, Durable Objects, Queues, Cron, Vectorize, Turnstile, rate limiting) for local, preview and production
- [ ] Full D1 schema and first migration (Drizzle) covering every table in the product plan, including new fields: project `stage` (finished / WIP / up for adoption), `license` (nullable = no license), build facts (AI tools, build time, AI-involvement level), `is_template`, `replaces`
- [ ] `packages/shared`: Zod schemas + TypeScript types for every entity and every API request/response. This is the contract
- [ ] Every API route registered in the Worker, returning correct-shape responses from **dev-only fixtures** (clearly marked, never deployed, never shown on the live site)
- [ ] GitHub OAuth sign-in working end to end, with sessions and a `requireUser` / `requireAdmin` middleware

**App shell**

- [ ] Router with every page stubbed: feed, `/p/:slug`, `/studio`, `/u/:name`, `/forum`, `/plaza`, `/resources`, `/requests`, `/alternatives/:product`, `/settings`, static pages, 404
- [ ] Layout, header (logo, search slot, music-button slot, profile menu), footer slot
- [ ] `packages/ui`: design tokens (light, dark, retro themes; 16-bit accent palette), and base components: Button, Badge, Chip, Avatar, Modal shell, Card shell, Drawer, Tabs, Toast

**Guard rails**

- [ ] CI (GitHub Actions): typecheck, lint, unit tests, build, the ownership check, and a "no fixtures in production build" check
- [ ] `AGENTS.md`, the three briefing files, and `docs/contract-requests/TEMPLATE.md`
- [ ] Deploy the skeleton to a preview URL so everyone sees the same thing
- [ ] Merge to `main`, rebase all three worktrees, then hand off

## How a phase runs

After the one-time skeleton, every phase is the same loop: three agents build in parallel on their own branches, Opus merges at checkpoints, everyone rebases, and you review a preview link.

&#91;embedded content: how each phase runs · 1 skeleton, 3 parallel lanes, merge checkpoints\]

The loop repeats per task until the phase's tasks are Done; production deploys happen only at the phase gates in the product plan's roadmap.

## Task board

Every feature in the product plan maps to one task with one owner. Within a phase, all three agents work at the same time; "Needs" lists what must merge first (P0 = skeleton). Phases match the product plan's roadmap.

**Phase 1 — Catalog MVP**

| ID | Task | Owner | Needs | Status |
| --- | --- | --- | --- | --- |
| 1.1 | GitHub ingestion: repo metadata, license detection (including no license), README fetch and sanitizing | Opus 5.5 | P0 | Done |
| 1.2 | Projects API: list, filter, sort, paginate; D1 full-text search; unlicensed projects excluded unless the request opts in, with a hidden-count in results | Opus 5.5 | 1.1 | Done |
| 1.3 | Health score ranking (stars, forks, contributors, recency, age) with a visible breakdown | Opus 5.5 | 1.1 | Done |
| 1.4 | Submit-by-URL backend: ownership check, stage, build facts, unlicensed handling | Opus 5.5 | 1.1 | Done |
| 1.5 | Uploads to R2: signed uploads, image resizing, fallback thumbnail from the repo's preview image | Opus 5.5 | P0 | Done |
| 1.6 | Security: rate limits, Turnstile, secret and malware checks on import | Opus 5.5 | 1.4 | Done |
| 1.7 | Discovery cron, candidate queue, admin API behind Cloudflare Access | Opus 5.5 | 1.1 | Done |
| 1.8 | Project card: flip, See more + author placement, badges (stage, license or "No license", build facts), touch and reduced motion | Sol 6.1 | P0 | Done |
| 1.9 | Focus panel: blurred backdrop, shareable URL, gallery, README, fork box, WIP and unlicensed variants | Sol 6.1 | 1.8 | Done |
| 1.10 | Feed grid and toolbar: search, sort, filter drawer, URL state, infinite scroll; "Show unlicensed projects" switch with first-time disclaimer dialog and an "N hidden · Show them" note | Sol 6.1 | 1.2, 1.8 | Done |
| 1.11 | Submit form: paste URL → auto-filled preview, license message, stage picker | Sol 6.1 | 1.4 | Done |
| 1.12 | Admin review queue UI: auto-check chips, card preview, approve / reject / snooze, bulk actions | Sol 6.1 | 1.7 | Done |
| 1.13 | Elevator music player: mute, volume, skip, remembered choice, starts on first click | Flash 3.8 | P0 | Done |
| 1.14 | Static pages: About, Licensing 101 (including what "no license" means), Rules, Privacy, Terms, DMCA; the shared no-license disclaimer component (dialog and panel banner) | Flash 3.8 | P0 | Done |
| 1.15 | Category taxonomy seed file and a pixel icon per category | Flash 3.8 | P0 | Done |
| 1.16 | Seed-catalog script: candidate URL list → ingestion → import report (see Seeding) | Flash 3.8 | 1.1 | Done |
| 1.17 | Empty, loading and 404 states; footer | Flash 3.8 | P0 | Done |

**Phase 2 — Studio and profiles**

| ID | Task | Owner | Needs | Status |
| --- | --- | --- | --- | --- |
| 2.1 | Studio API: boards, editable columns, card ordering, optimistic saves | Opus 5.5 | P0 | Done |
| 2.2 | "Fork to my GitHub" in one click, fork lineage records, auto-add to Studio as an Idea | Opus 5.5 | 1.1 | Done |
| 2.3 | Notifications fan-out (Queues) and email digest sending | Opus 5.5 | P0 | Done |
| 2.4 | DMs and collab requests backend, DM privacy rules, blocks | Opus 5.5 | P0 | Done |
| 2.5 | Follows, bookmarks and collections API | Sol 6.1 | P0 | Done |
| 2.6 | Kanban board UI: drag (mouse and keyboard), rename / collapse / recolor columns, WIP limits | Sol 6.1 | 2.1 | Done |
| 2.7 | Project planning panel: checklist, markdown notes, upvotable roadmap, "looking for help with" | Sol 6.1 (built by Opus) | 2.1 | Done |
| 2.8 | Profile page: header, Collab and Message buttons, showcase pinning, tabs, stats | Sol 6.1 (built by Opus) | 2.5 | Done |
| 2.9 | DM and collab request UI; notification center | Sol 6.1 (built by Opus) | 2.3, 2.4 | Done |
| 2.10 | Settings pages: privacy, notifications, theme, music default, show-unlicensed preference (off by default), data export, delete account | Flash 3.8 (built by Opus) | P0 | Done |
| 2.11 | Collections pages, plus "export as awesome-list markdown" | Flash 3.8 (built by Opus) | 2.5 | Done |
| 2.12 | "Ask the author to add a license" prefilled GitHub issue link; owner-side link to GitHub's add-a-license page | Flash 3.8 (built by Opus) | 1.9 | Done |
| 2.13 | Email templates: notifications and weekly digest | Flash 3.8 (built by Opus) | 2.3 | Done |

**Phase 3 — Community, live**

| ID | Task | Owner | Needs | Status |
| --- | --- | --- | --- | --- |
| 3.1 | Chat-room Durable Object: WebSockets with hibernation, history, slow mode, mute and ban hooks | Opus 5.5 | P0 | Done |
| 3.2 | Presence and Plaza position sync (who's online and where they stand) | Opus 5.5 | 3.1 | Done |
| 3.3 | Live forum updates and typing indicator | Opus 5.5 | 3.1 | Done |
| 3.4 | Moderation backend: reports, bans, audit log, chat snapshots | Opus 5.5 | P0 | Done |
| 3.5 | Resources backend: uploads, script scanning, Proven badge rule, "worked for me" reports | Opus 5.5 | 1.6 | Done |
| 3.6 | Fork tree graph API | Opus 5.5 | 2.2 | Done |
| 3.7 | Plaza client: PixiJS room, walking, speech bubbles, click for profile, mobile strip | Sol 6.1 (built by Opus) | 3.2 | Done |
| 3.8 | Forum UI: boards, threads, markdown and code highlighting, project embeds, solved marking | Sol 6.1 (built by Opus) | 3.3 | Done |
| 3.9 | Resources library UI: copy and download, proof section, ratings | Sol 6.1 (built by Opus) | 3.5 | Done |
| 3.10 | Fork tree visualizer; moderation queue UI in the admin console | Sol 6.1 (built by Opus) | 3.4, 3.6 | Done |
| 3.11 | Avatar builder UI and layered 16-bit sprite sheets (hair, outfit, color, accessory) | Flash 3.8 (built by Opus) | P0 | Done |
| 3.12 | Badge and achievement pixel icons; badge display on profiles | Flash 3.8 (built by Opus) | P0 | Done |
| 3.13 | Forum board setup and community rules copy | Flash 3.8 (built by Opus) | P0 | Done |

**Phase 4 — Growth extras**

| ID | Task | Owner | Needs | Status |
| --- | --- | --- | --- | --- |
| 4.1 | Semantic search and the "Has this been built?" check (Vectorize + embeddings) | Opus 5.5 | 1.2 | Done |
| 4.2 | MCP endpoint so coding agents can search the catalog and fetch starter prompts | Opus 5.5 | 4.1 | Done |
| 4.3 | Public API with keys and rate limits | Opus 5.5 | 1.6 | Done |
| 4.4 | Agent starter-prompt generator per project (repo summary → paste-ready prompt) | Sol 6.1 | 1.1 | Not started |
| 4.5 | Requests board and bounties (API and UI) | Sol 6.1 | P0 | Not started |
| 4.6 | Launch days and leaderboards; Fork Friday and build jams with voting | Sol 6.1 | 1.10 | Not started |
| 4.7 | Alternatives directory pages built from the "replaces" field | Sol 6.1 | 1.2 | Not started |
| 4.8 | Live README badge (SVG with forks and upvotes) | Flash 3.8 | 1.2 | Not started |
| 4.9 | RSS feeds: new projects, per category, per user | Flash 3.8 | 1.2 | Not started |
| 4.10 | Newsletter signup and "Fork Report" issue template | Flash 3.8 | 2.13 | Not started |
| 4.11 | Subscription savings counter widget | Flash 3.8 | 4.7 | Not started |

**Phase 4 additions from the updated product plan** (the WIP "What works / What's missing" box is part of 1.9; "Continue this" is part of 2.2)

| ID | Task | Owner | Needs | Status |
| --- | --- | --- | --- | --- |
| 4.12 | "Up for adoption" flow: mark a project, request takeover, author approves, maintainer changes | Sol 6.1 | 2.4 | Not started |
| 4.13 | Open catalog data mirror: nightly export of one JSON file per project to a public repo; accept submissions by pull request | Flash 3.8 | 1.2 | Not started |
| 4.14 | Build competitions: prize rounds, judging, winners page | Sol 6.1 | 4.6 | Not started |

**Every phase**

| ID | Task | Owner | Needs | Status |
| --- | --- | --- | --- | --- |
| C.1 | Merges, code review, security review | Opus 5.5 | — | Not started |
| C.2 | Playwright end-to-end tests and visual checks at phone and desktop widths | Sol 6.1 | — | Not started |
| C.3 | Accessibility pass: keyboard, contrast, screen-reader labels | Flash 3.8 | — | Not started |
| C.4 | Copy and typo pass across the UI | Flash 3.8 | — | Not started |

## Seeding the catalog with real projects

The live site launches with real, verified repos only: no fake placeholder cards, ever. Task 1.16 (Flash) turns the lists below into a seed file; task 1.1's ingestion (Opus) checks each repo; you approve each one in the admin queue before it goes live.

**Projects found in research (verify, then import)**

| Repo | What it is | Fit | Check before import |
| --- | --- | --- | --- |
| [cloudflare/vibesdk](https://gittrend.io/repo/cloudflare/vibesdk) | Open-source platform for building your own vibe-coding app, on the same Cloudflare stack we use; about 5.0k stars and 1.2k forks per GitTrend | Strong: flagship Developer tools / AI card | License, last commit |
| [KaramelBytes/personal-linkhub-11ty](https://www.github.com/KaramelBytes/personal-linkhub-11ty) | Vibe-coded personal link hub (Eleventy + Tailwind) that invites forking | Good: Web templates | License, live demo |
| [lawrencedcodes/vibes](https://github.com/lawrencedcodes/vibes) | A collection of work-in-progress vibe-coded apps (church app, stock apps, coding coach, events) | Good test of the new WIP stage; could become several cards | License (none seen), which apps run |
| [uditk2/VibeCodeHelp](https://github.com/uditk2/VibeCodeHelp) | Static glassmorphism landing page, MIT per its README | Fair: Web templates | Confirm LICENSE file, demo link is a placeholder in its README |
| [Loscy/vcc](https://github.com/Loscy/vcc) | Vibe Code Club, a tiny static directory of AI-built projects | Fair: "directory starter" template | License |
| [devandapaige/pythoness-programmer](https://github.com/devandapaige/pythoness-programmer) | Portfolio site that includes a vibe-coding cheatsheet | Better as a Resources lead than a project | License, ask the author |
| [imran-86/TransPortWeb](https://github.com/imran-86/TransPortWeb) | Small university project, one commit | Skip unless it grows | — |

**Places to find more (leads only, never copied)**

| Source | How to use it |
| --- | --- |
| [Awesome-Vibe-Coding](https://github.com/0xWelt/Awesome-Vibe-Coding) "Awesome Projects" section | Best single list of open-source vibe-coded projects; feed repo links into the admin importer |
| Vibe Code Club's `projects/` folder | One JSON file per project, each with a link; check its license before reusing any data |
| MadeWithVibe, BuiltByVibe, vibecoding.engineer | Browse for entries that link a public GitHub repo; import the repo, never their write-ups |
| v0 templates and Replit community | Only projects their authors also pushed to public GitHub |
| madewithlovable.com | Most projects there went private after Lovable's April 2026 incident, so expect few usable repos |
| [OpenAlternative](https://openalternative.co/about) | Not vibe-coded, but a guide for filling each card's "Replaces" field and seeding the Alternatives pages |

**Resources section seeds:** the learning-resources part of Awesome-Vibe-Coding, and Cloudflare's own [Pages-to-Workers migration prompt](https://developers.cloudflare.com/workers/prompts/pages-to-workers.txt) (a real, published agent instruction file).

**Seeding rules**

- Each card comes from a live repo pulled through ingestion; descriptions are written fresh, never copied from another directory
- Curated cards say "Curated — claim this project" so authors can take over, edit, or remove
- Unlicensed repos may be listed, with the "No license" badge and the ask-the-author flow
- Target before Phase 2 starts: 100+ approved projects (the Phase 1 gate)

## Integration and merge rules

Opus merges everything into `main` at set checkpoints, in a fixed order, so conflicts are rare and always land with the agent who knows the most.

1. **One task = one pull request** from the agent's branch into `main`, titled with the task ID (e.g. `[1.9] Focus panel`), with a handoff note in `docs/handoffs/`.
2. **CI must be green** before review: typecheck, lint, unit tests, build, ownership check, Sol's end-to-end suite once it exists.
3. **Checkpoints:** Opus merges at the end of each working session, or whenever a task in the "Needs" column of someone else's task is ready.
4. **Merge order:** Opus first (contracts and backend), then Sol (UIs that use them), then Flash (pages and assets that sit on top).
5. **After each checkpoint** every agent runs `git fetch && git rebase origin/main` before starting its next task.
6. **Contract changes** (schema, shared types, tokens, auth) go through `docs/contract-requests/`. Opus applies them in a small PR of its own and merges it first, so nobody's work breaks halfway through.
7. **Conflicts:** the agent whose PR is newer rebases and fixes; if a conflict touches someone else's folder, it goes back to Opus.
8. **Preview deploy** after every checkpoint, to a preview URL you can click through on your phone.
9. **Production deploys** happen only at phase gates, after you've looked at the preview.

## Agent briefing files

Opus writes these during the skeleton run; each agent reads `AGENTS.md` plus its own file at the start of every session.

**`AGENTS.md` (everyone)**

- What the site is, in 5 lines, with a link to the product plan
- Only edit folders `OWNERS.json` gives you; need something else → `docs/contract-requests/`
- Import types from `packages/shared` only; never redefine an entity locally
- Use `packages/ui` components and tokens; no hard-coded colors or fonts
- Never add fake projects, users or posts to anything that ships; dev fixtures live only in `packages/shared/fixtures`
- Mobile first: every screen must work at 375 px wide
- Finish each task with a PR and a handoff note: what changed, how to test, anything unfinished

**`agents/opus.md`**

- You own contracts, core, realtime, jobs, security, and `main`
- Keep contract PRs small and merge them before dependent work
- Review every PR for security (auth checks, input validation, rate limits) before merging

**`agents/sol.md`**

- You own the feature UIs and `e2e/`
- Start each UI task by reading its API types in `packages/shared`, then build against the dev fixtures
- Use your computer-use ability: run the app, click through every state (empty, loading, error, long text, no license, WIP), and screenshot phone and desktop widths into the handoff note
- Add a Playwright test for every flow you finish

**`agents/flash.md`**

- You own static pages, settings, music, avatar art, badges, feeds and seed scripts
- Tasks are small and well specified; if one turns out bigger than described, stop and write a handoff note instead of improvising
- Pixel art: 16×16 or 32×32 grids, palette from the tokens, exported as sprite sheets with a JSON frame map
- Seed script: only output what ingestion verified; log every skipped repo with the reason

## Definition of done and testing

A task is done only when it's merged to `main`, works on the preview URL, and its status above says Done.

- [ ] CI green: typecheck, lint, unit tests, build, ownership check
- [ ] Uses shared types and UI tokens; no duplicated types, no hard-coded colors
- [ ] Handles empty, loading and error states, plus the WIP and "No license" variants where they apply
- [ ] Works at 375 px (phone) and 1440 px (desktop), with keyboard navigation and visible focus
- [ ] Respects reduced motion and the music mute setting
- [ ] No fake content in anything that ships
- [ ] Handoff note written; Sol adds or updates the end-to-end test for the flow

**Testing layers**

| Layer | Tool | Owner |
| --- | --- | --- |
| Unit (logic, scoring, parsers) | Vitest | Whoever wrote the code |
| API and Durable Objects | Vitest with Cloudflare's Workers test pool | Opus |
| End-to-end flows and visual checks | Playwright, run against the preview | Sol |
| Accessibility | axe checks in Playwright, plus a manual keyboard pass | Flash |
| Security review | Code review on every PR; dependency audit each phase | Opus |

## Open questions

- [ ] Which code app runs Sol and which runs Flash on your desktop, and can each one run git and a terminal?
- [ ] Real folder path for the repo (replaces `~/Code/forkyard`)
- [ ] GitHub account or org that will own the repo, and is it public from day one? (Public fits the mission)
- [ ] Final site name before the skeleton run, or keep "ForkYard" as a code name?
- [ ] Cloudflare account ready, and a domain bought through Cloudflare Registrar?
- [x] For curated (non-author) imports, should unlicensed repos be included? **No (2026-10-10):** curated imports must be licensed; unlicensed projects only come from their authors.
- [ ] Is Gemini 3.8 Flash Cyber available to you? It could take the security-scan work in task 1.6 if so

## Sources

- [GPT-6.1 Sol — Felo](https://felo.ai/tools/gpt-6-1-sol)
- [Gemini 3.8 Flash and 3.8 Flash Cyber — DataCamp](https://www.datacamp.com/blog/gemini-3-8-flash-cyber)
- [cloudflare/vibesdk — GitTrend](https://gittrend.io/repo/cloudflare/vibesdk)
- [Awesome-Vibe-Coding — GitHub](https://github.com/0xWelt/Awesome-Vibe-Coding)
- [OpenAlternative — About](https://openalternative.co/about)
