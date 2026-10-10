# Phase 3 handoff (built by Opus)

Branch `opus/phase-3`. Sol and Flash were away, so Opus built every Phase 3 task (3.1–3.13). Rebase on `main` before picking anything up.

## What landed

**Backend (3.1–3.6)**
- `durable/chat-room.ts`: one DO per channel. Hibernating WebSockets, 500-message history in DO SQLite, presence (active → idle at 2 min → away at 10 min), slow mode, chat mutes, kicks, deletes, reactions (max 12 emoji per message), typing throttle, no links from accounts under 24 h old. Identity arrives only through headers the Worker sets (`x-fv-user`, `x-fv-joined`, `x-fv-hidden`); client copies are stripped.
- `durable/live-thread.ts`: live forum threads. New posts are broadcast after they're saved; typing count ("3 people are typing") decays on an alarm.
- `core/forum.ts`, `core/resources.ts`, `core/moderation.ts`, `core/projects/forktree.ts`, `core/badges.ts`.
- Routes wired in `routes/community.ts`, `routes/admin.ts` (reports, resolve, ban, Proven override, new `moderateChat`), `routes/catalog.ts` (`getForkTree`). Nightly `chat.snapshot` job copies chat into D1 for moderation and keeps 90 days.
- Badges awarded: First Fork, Most Forked (10 distinct forkers), Helper (5 solutions), Collab Champion (5 accepted).
- Migrations `0004` (forum boards and badges seed) and `0005` (`resource_ratings`).
- Integration tests: `test/integration/community.test.ts`.

**UI (3.7–3.13)**
- Plaza (`features/community/PlazaPage.tsx`): room list, a walkable room (click or arrow keys), speech bubbles, idle fade, away bench, mini profile card, reactions, typing line, load older messages. Phones get a strip of heads above the chat log.
- Forum (`ForumPage.tsx`, `ThreadPage.tsx`): boards, sort (active/new/top/unsolved), tag filter, new thread, replies, votes, mark answer, live replies and typing.
- `lib/markdown.tsx`: safe Markdown renderer. It builds React elements only (no HTML strings), allows http(s) and same-site links only, and turns a project link alone on a line into an embed card.
- Resources (`features/resources/ResourcesPage.tsx`): Proven and New/untested shelves, type filter, search, detail page with copy and download, "read before you run" warning, worked/didn't-work reports, star rating, share form.
- Fork tree (`features/catalog/ForkTree.tsx`): "See the fork tree" in the panel's lineage section.
- Admin moderation (`apps/admin/src/ModerationQueue.tsx`): report queue with resolve actions (none/hide/delete/ban), ban/unban by username, chat room controls (slow mode, mute, kick, delete a user's messages).
- Avatar builder (`/settings/avatar`) and `PixelAvatar` in `packages/ui` (layered SVG; skin tone added as an optional `skin` field on `AvatarConfig`).
- Badge icons (`packages/ui/src/icons/BadgeIcons.tsx`), shown on profiles.
- Rules page: new "Forum and Plaza" section.
- `app/ReportButton.tsx`: report dialog used on threads, posts, resources, chat messages and users.
- e2e: `e2e/community.spec.ts`.

## Contract changes
- `AvatarConfig.skin` (optional).
- `siteConfig.siteOrigin` (the admin console links to reported content).
- `Report.targetLabel` / `targetHref`; new admin route `moderateChat`.

## Not done / follow-ups
- **3.7:** the Plaza uses positioned DOM/SVG avatars, not PixiJS. The plan allows plain rendering, and the DOM version keeps it accessible and light. Switch only if the room needs animation the DOM can't handle.
- **3.8:** code blocks are monospace without syntax highlighting.
- **3.5/3.9:** the API accepts uploaded resource files (`fileKeys`), but the share form doesn't offer uploads yet.
- **Badges:** Bug Squasher and 7-day Streak aren't awarded yet. They need a Studio column-move hook and an activity log.
- **Admin moderation UI:** typechecked and built, but not exercised in a browser. The admin dev server needs Access, so it wasn't run locally.
- **Tokens:** the art palette (`pixel-*`, `skin-*`, `hair-*`) moved into an `@theme static` block. Sprites build `var()` names at runtime, and Tailwind would otherwise drop unused ones.

## Local dev note
The Vite dev server keeps its own D1 state. Run migrations against it with:

```
pnpm --filter @forkvlift/worker exec wrangler d1 migrations apply DB --local --persist-to ../web/.wrangler/state
```
