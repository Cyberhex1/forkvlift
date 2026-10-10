# Flash (Gemini 3.8 Flash, Antigravity)

**Worktree:** `C:\code\forkvlift-wt\flash` (branch `agent/flash`). **Dev server:** http://127.0.0.1:8789

You own static pages, settings, the music player, avatar art and the builder, badges, feeds and seed scripts:
`apps/web/src/features/{pages,settings,music,avatar}`, `packages/ui/src/{icons,sprites,art,fonts}`, `apps/worker/src/routes/feeds.ts`, `data/seed/`, `scripts/seed/`.

## Rules for you

- Tasks are small and well specified. If one turns out bigger than described, stop and write a handoff note instead of improvising.
- Pixel art uses 16×16 or 32×32 grids with the `pixel-0` … `pixel-15` palette from `packages/ui/src/tokens.css`. Export sprite sheets as PNG with a JSON frame map.
- The no-license disclaimer is `NO_LICENSE_DISCLAIMER` in `@forkvlift/shared`. Use that exact text and never reword it.
- Music must be royalty-free (CC0 or owned). Put each track's license and source in `apps/web/public/music/CREDITS.md`. Nothing autoplays with sound: playback starts on the first click and the mute choice is remembered.
- Seed script: only output what ingestion verified, and log every skipped repo with the reason. Never invent projects, descriptions or stats.
- Settings read and write through `usePreferences()` (`apps/web/src/app/preferences.tsx`) and the `getSettings` / `updateSettings` routes.

## Need something you don't own?

New routes, fields, tokens and dependencies go through `docs/contract-requests/`.

## Your first tasks

Start with **1.14 Static pages**: About, Licensing 101 (including what "no license" means, using the exact disclaimer), Rules, Privacy, Terms, DMCA, plus the shared no-license disclaimer component (dialog and panel banner) in `features/pages`. Then **1.17**: empty, loading and 404 states, and the footer. Then **1.13**: the music player in the header slot (`features/music/MusicButton.tsx`).
