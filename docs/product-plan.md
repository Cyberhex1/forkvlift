# ForkYard — Product Plan for a Vibe-Coder Project Hub

Oct 10, 2026 · @ohnna

## Vision and mission

The site is a catalog of vibe-coded projects, finished and unfinished,, so builders start from someone else's working repo instead of rebuilding the same app for the hundredth time. "ForkYard" is the working name; alternatives are in the next section.

**Primary goal:** make the vibe-coding scene organized and reusable. Every listed project has public code you can clone and point your agents at. Finished or not, licensed or not, each card says plainly what you're allowed to do with it.

**Secondary goal:** take power back from big companies with heavy subscription models. The catalog makes it easy to find free, open alternatives to paid tools, and the site itself stays free to use.

**Guiding principles**

- **Public code, honestly labeled.** A public card needs a public repo. Open licenses (MIT, Apache-2.0, GPL…) get a green license badge; repos without one are still listed but hidden by default, and anyone can choose to show them behind a clear disclaimer. Unfinished projects are listed too, marked by stage.
- **Credit the original.** Every fork shows its lineage, so authors get visible credit when others build on their work.
- **No dark patterns.** No paywalled core features, no algorithmic rage-bait feed, no selling user data.
- **Fun, not corporate.** 16-bit avatars, elevator music, and a playful tone make it feel like a clubhouse rather than a SaaS dashboard.
- **Cheap to run.** Built on free or near-free infrastructure so it can stay free without investors.

## Name suggestions

Top pick: **ForkYard** — short, says "fork" outright, and "yard" fits the town-square/16-bit vibe. None of these have been checked for domain or trademark availability yet.

| Name | Why it fits |
| --- | --- |
| ForkYard | A yard full of projects you can fork; friendly and visual |
| Vibe Vault | Alliterative; a vault of finished work so nobody rebuilds it |
| Remixr | Frames forking as remixing; music-culture energy |
| Seedbank | Every project is a seed you can grow; strong anti-waste message |
| ForkLift | Lift someone's project and carry it further; easy logo |
| Already Built | Blunt, funny, states the mission in two words |
| Open Shelf | Like a free library shelf of apps |
| Hand-Me-Down | Warm, playful; projects passed between builders |
| Commons.dev | Points straight at the anti-corporate, shared-commons goal |
| Reroll | Gaming term for taking another run at something |
| The Fork Market | Bazaar feel; pairs with the 16-bit town look |
| Vibe Cellar | A cellar of aged, finished projects to pull from |

Pick by checking .com/.dev/.app availability, GitHub org name, and a quick trademark search.

## Core experience: project cards

The home feed is a responsive grid of vertical rectangle cards (portrait, roughly 3:4 or 2:3). Each card has a front and a back that flip on hover.

**Card front (default)**

- Preview thumbnail filling the top \~60% (screenshot, GIF, or short looping video)
- Project name
- Short description (one line, \~80 characters max)
- Top-right corner: a **See more** button, with the **author name** directly beneath it
- Small badges along the bottom edge: category chip, stage (Finished / Work in progress / Up for adoption), license (MIT, GPL…) or "No license", fork count, star count

**Card back (on hover)**

- Full description (\~300 characters)
- **GitHub** button (opens the repo)
- **Live site / Release** button (opens the deployed app or the latest release download)
- Quick-copy clone command (`git clone …`) — handy for pasting straight into an agent
- See more + author name stay pinned top-right on both sides so the layout doesn't jump

**Touch devices:** there's no hover on phones, so a tap flips the card and a second tap (or See more) opens the panel. Respect the reduced-motion setting by swapping the 3D flip for a fade.

**Focused panel (See more)**

Clicking See more opens a large centered panel. Every other card stays visible but blurred and dimmed behind it (CSS backdrop blur). Escape, the X, or clicking outside closes it. The URL updates (`/p/project-slug`) so panels are shareable links.

Panel contents:

- Image/video gallery and the README rendered from GitHub
- Tech stack tags (React, Python, Godot, Tauri…) and which AI tools built it (Claude Code, Cursor, Lovable, Bolt, etc.)
- "Fork this" box: clone command, one-click "Open in Codespaces / StackBlitz" where supported, and a ready-to-paste starter prompt for your agent
- Fork tree: what this was forked from and notable forks of it
- "Replaces" field: the paid product this is an alternative to (e.g. "Free alternative to Notion")
- Stats: stars, forks, last commit, open issues (pulled from GitHub)
- Comments, upvotes, save to collection, report
- Author mini-profile with Collab and Message buttons

## Discovery: sorting, filtering, categories

A sticky toolbar above the grid holds search, a sort dropdown, and a filter drawer. Every filter combination is reflected in the URL so searches can be bookmarked and shared.

**Sort options:** Trending (upvotes weighted by recency), Newest, Most forked, Most starred, Recently updated, Most discussed, Staff picks, Random ("surprise me").

**Filters**

- Category and sub-category (multi-select)
- License (MIT, Apache-2.0, GPL, AGPL, BSD, Unlicense…). Unlicensed projects stay hidden unless "Show unlicensed projects" is switched on (see Trust, safety, licensing)
- Stack/language (JS/TS, Python, Rust, Go, Godot, Unity, Swift…)
- Platform (web, desktop, mobile, CLI, browser extension, self-hosted/Docker)
- AI tool used to build it (Claude Code, Cursor, Lovable, Bolt, Replit, Windsurf, v0…)
- Stage: finished, work in progress, up for adoption; plus has live demo, has release binary, actively maintained (commit in last 90 days)
- Difficulty to run: one-click, needs API keys, needs a server
- "Replaces a paid product" toggle, plus search by product name ("show me free Notion alternatives")
- Source: community-submitted vs. curated by you

**Search** covers names, descriptions, tags, README text, and the "replaces" field. Add semantic search later so "app to track my plants" finds a plant-care tracker even without those exact words.

**Categories (starting taxonomy, admin-editable)**

| Category | Example sub-categories |
| --- | --- |
| Games | Browser games, roguelikes, puzzle, multiplayer, game jams, engines and tools for games |
| Production | Music/audio, video editing, streaming tools, podcasting, 3D/CAD |
| Tools and utilities | File converters, CLI tools, browser extensions, clipboard and window managers |
| Suites | All-in-one office suites, multi-tool dashboards, self-hosted bundles |
| Productivity | Notes, to-do, calendars, habit trackers, time tracking, focus timers |
| Developer tools | Code editors, linters, API clients, DevOps, testing, MCP servers |
| AI and agents | Agent frameworks, chat UIs, prompt tools, local LLM front-ends, RAG apps |
| Creative and design | Image editors, pixel art, generative art, fonts, UI kits |
| Finance and money | Budgeting, invoicing, expense splitting, portfolio trackers |
| Health and fitness | Workout logs, meal planners, sleep and mood trackers |
| Education and learning | Flashcards, language learning, coding tutorials, study tools |
| Home and life | Recipes, home automation, inventory, plant care, pet care |
| Social and community | Forums, chat apps, link-in-bio, event planners |
| Business and ops | CRM, invoicing, booking systems, small-shop tools |
| Data and analytics | Dashboards, scrapers, visualization, spreadsheets |
| Media and entertainment | Media players, readers, trackers for films, books and games |
| Hardware and IoT | Raspberry Pi, Arduino, 3D printing, smart-home firmware |
| Privacy and security | Password managers, VPN front-ends, ad blockers, encryption tools |
| Self-hosted and homelab | Server dashboards, Docker stacks, backup tools |
| Web templates and starters | Landing pages, portfolios, SaaS boilerplates |
| Mobile apps | iOS, Android, cross-platform |
| Accessibility | Screen-reader helpers, captioning, color tools |
| Fun and experiments | Toys, weird one-offs, art projects |

Projects can carry one primary category and up to five free tags. Users can suggest new categories; you approve them from the admin console.

## Studio mode

Studio is each user's private workspace for uploading and planning projects, laid out as a **kanban board** (the Japanese-origin method you were thinking of). Projects can be published to the public catalog at any stage.

**Default columns** (titles editable, each one collapsible to a slim vertical strip):

1. Idea
2. Develop
3. Bug fix
4. Ready for release

**Board behavior**

- Drag cards between columns and reorder within a column; keyboard drag support for accessibility
- Click a column title to rename it inline; add, delete, recolor, and reorder columns
- Collapse state is remembered per user
- Optional WIP limit per column (e.g. "max 3 in Develop")
- Studio cards reuse the public card design, plus a stage badge and a Public/Private toggle
- Publishing from any column shows the stage on the public card ("In development", "Idea — looking for collaborators") so people can join early

**Uploading a project**

- Paste a GitHub URL → the site auto-fills name, description, README, license, stars, language, and the repo's social preview image
- Or start from scratch with just a name and an idea, no repo yet (stays private or publishes as an "Idea")
- Thumbnail upload, screenshot gallery, optional demo video
- License check runs automatically; projects without a license can still go public, but the form warns that they'll be hidden from most visitors by default and offers a one-click link to GitHub's add-a-license page

**Planning tools inside each project**

- Checklist/sub-task list and notes (markdown)
- Changelog and version history, auto-synced from GitHub releases
- Roadmap items that visitors can upvote
- "Looking for help with…" field that powers the collab matchmaking feature
- Saved prompts and agent instructions used on the project (can be shared to the Resources section)
- Optional GitHub Issues sync, so bug-fix cards mirror real issues

## Profiles and account features

Every profile leads with the user's showcase, so visitors see their best work before anything else.

**Profile page**

- Header: profile picture, username, display name, and their 16-bit chat avatar
- **Collab** button (sends a structured collab request: which project, what role, availability) and **Message** button (opens a DM)
- About me (markdown, links, location optional)
- **Showcase**: up to 6 pinned project cards the user picks, then a full grid of their public projects
- Tabs: Projects · Forks they made · Collections · Resources shared · Forum activity
- Stats: projects published, total forks of their work, "forked-by" count (how many people built on them)
- Badges/achievements (see Extra features)
- Links: GitHub, personal site, socials, optional donation link (Ko-fi, GitHub Sponsors)

**Account features**

- Sign in with GitHub (primary, since everyone here has one), plus email magic link; optional passkeys
- GitHub link also verifies repo ownership when someone submits a project
- Editable username, avatar upload, and a 16-bit avatar builder (hair, outfit, color, accessory)
- Notification center: new forks of your work, comments, collab requests, messages, mentions, followed users posting
- Email/push notification preferences per type, plus a weekly digest option
- Follow users and categories; a "Following" feed tab
- Bookmarks and named collections ("Free Adobe alternatives", "Weekend game jam starters"), public or private
- Privacy: hide online status in chat, block/mute users, control who can DM (everyone, followers, nobody)
- Light/dark/retro themes, reduced motion, music default on/off, show unlicensed projects (off by default)
- Data export (all your projects, posts and messages as JSON) and full account deletion
- Two-factor auth for email-login accounts

## Community: forum, live chat, music

**Discussion board / forum**

- Boards: Show & Tell, Help & Debugging, Collab Wanted, Prompts & Workflows, Free Alternatives Requests ("Is there an open version of X?"), Feature Ideas for the site, Off-topic
- Threads with markdown, code blocks with syntax highlighting, image paste, and inline project cards (paste a project link → it embeds as a mini card)
- Upvotes, "solved" marking on help threads, pinned threads, tags
- Live updates: new replies appear without refreshing, with a "3 people are typing" indicator
- A project's comments can be promoted into a forum thread when they grow long

**Live chat ("the Plaza")**

- A pixel-art room drawn at the top of the chat panel where everyone online appears as a little 16-bit character
- Characters idle-animate, walk to a random spot when their user sends a message, and show a speech bubble with the message for a few seconds
- Click a character → mini profile with Message, Collab, View profile
- Channels: #general, #help, #showcase, #gamedev, plus one room per big category
- Chat log beside the room; mentions, emoji reactions, code blocks, slow mode for busy times
- Avatars built in the profile avatar builder; idle users fade after 10 minutes, away users sit on a bench
- Mobile: the room collapses to a strip of avatar heads above the chat log

**Elevator music**

- Royalty-free, looping lo-fi/elevator tracks you own the rights to (commission one or use CC0 music)
- Small speaker icon fixed in the header: mute/unmute, volume slider, skip track
- Browsers block autoplay with sound, so music starts on the visitor's first click anywhere; the mute choice is remembered
- Music keeps playing across page changes (the site behaves as a single-page app, so the player never reloads)
- Optional: themed tracks per area (calmer in Studio, chiptune in the Plaza)

## Resources: skills and system instructions

The Resources section is a library of agent skills, system prompts, and workflows that have proven results, each backed by evidence rather than hype.

**Resource types**

- Agent skills (SKILL.md folders and similar packaged instructions)
- System instructions / custom instructions / CLAUDE.md, .cursorrules and AGENTS.md files
- Prompt templates (e.g. "turn this repo into a desktop app")
- Workflows: multi-step recipes ("plan → scaffold → test → ship" for a given stack)
- MCP server configs and tool setups
- Starter repos and boilerplates tuned for agent work

**Each resource page shows**

- Full text with one-click copy and a download button (.md or .zip for skill folders)
- Which tools/models it's been used with, and which version it was last tested on
- **Proof**: linked projects on the site that were built with it, before/after examples, and user reports ("worked" / "didn't work" with a short note)
- Ratings, comments, fork/remix of the resource itself, version history
- License (default CC0 or CC-BY for text resources)

**"Proven results" rule**

A resource gets a **Proven** badge only once it links at least 3 projects built with it, or collects a set number of "worked for me" reports. Others sit under "New / untested" so the top shelf stays trustworthy.

**Safety:** skills can contain scripts. Scan uploads for obviously malicious commands (e.g. curl-pipe-to-shell from unknown hosts, credential exfiltration) and show a clear "review before running" warning on anything with executable code.

## Admin curation console (your dev console)

The console is a separate, admin-only app (e.g. `admin.forkyard.dev`, behind Cloudflare Access) where you review candidate projects in a queue and import the good ones in one click. GitHub can be fully automated; Reddit has to be mostly manual because of its current API rules.

**Important Reddit constraint.** Reddit's [Responsible Builder Policy](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy) (updated Oct 5, 2026) requires explicit approval before any API access, and bans scraping or commercializing Reddit data without written permission. So the plan is:

- **Default:** a "paste a link" importer. You browse r/vibecoding, r/ClaudeAI, r/SideProject, r/selfhosted etc. yourself, copy the GitHub link (and the Reddit post URL as a "found via" credit), and paste it into the console. Only the GitHub data is fetched automatically.
- **Later:** file a non-commercial access request with Reddit describing exactly this use. Only automate Reddit polling if they approve it.
- No unofficial Reddit scrapers or third-party resellers — that risks a ban and undercuts the site's ethics.

**GitHub discovery (automated)**

- Scheduled job (Cloudflare Cron Trigger, e.g. every 6 hours) queries the GitHub Search API for: repos created in the last 30–90 days, topics like `vibe-coding`, `built-with-claude`, `cursor`, `ai-generated`, and star velocity (stars gained per week); licensed repos score higher, unlicensed ones aren't excluded
- Watchlist of curated "awesome-\*" lists and showcase repos to diff for new entries
- Every candidate lands in the review queue with a quality score

**Review queue UI**

- Table of candidates: name, stars, star velocity, license, last commit, has README, has demo link, has screenshots, score
- Auto-checks with pass/fail chips: license detected (shown, not required), README exists, not a fork with no changes, not archived, no obvious secrets committed, not malware-flagged
- Preview of how the card will look; edit name, description, category, tags, thumbnail before publishing
- Actions: Approve and publish · Approve as draft · Reject (with reason, so it's never suggested again) · Snooze
- Bulk actions for approving several at once

**Author respect**

- Curated cards say "Curated by ForkYard — Claim this project". The real author can claim it via GitHub login, then edit or remove it
- Optional: open a polite GitHub issue or discussion on the repo letting the author know (off by default; keep it rare to avoid spam)

**Other console tools**

- Moderation queue (reported projects, posts, chat messages, users)
- Category and tag manager (merge, rename, approve user-suggested categories)
- Staff picks and homepage featured slots
- Resource "Proven" badge overrides
- Site stats: signups, projects added, forks clicked, chat activity
- Audit log of every admin action

## Extra feature ideas

These fit the mission and the playful tone; the roadmap marks which come first.

**Fight duplication (the core mission)**

- **"Has this been built?" check:** before someone starts a new Studio idea, they type a one-line description and the site shows similar existing projects to fork instead
- **Requests board / bounties:** people post "I wish there were a free X"; others claim and build it; the finished project links back to the request
- **Fork tree visualizer:** a branching graph of a project and every fork listed on the site, showing how ideas evolve
- **"Merge back" nudges:** when a fork adds a popular improvement, suggest the forker open a pull request to the original

**Beat subscription software**

- **Alternatives directory:** a page per paid product ("Free alternatives to Photoshop") auto-built from the "replaces" field
- **Subscription savings counter:** a sitewide ticker estimating money saved (forks × replaced product's monthly price) — a fun, mission-driven stat
- **Self-host friendliness score:** how easy it is to run without any paid service (no API keys, Docker one-liner, runs offline)

**Make forking effortless**

- **Agent starter prompt** on every project: a generated prompt ("You are working on a fork of X, a Tauri app that… Key files are…") to paste into Claude Code, Cursor, etc.
- **Repo health card:** dependencies outdated? tests present? setup steps in README? — shown so forkers know what they're getting into
- **Open-in buttons:** GitHub Codespaces, StackBlitz, Gitpod where the stack supports it

**Community and fun**

- **Weekly "Fork Friday" challenge:** one featured project; everyone forks and improves it; the community votes on the best fork
- **Game jams / build jams** with themes and a timer, results shown as a special card set
- **Badges:** First Fork, Most Forked, Bug Squasher, Helper (5 solved threads), Collab Champion, 7-day streak — shown as 16-bit pixel icons
- **Collab matchmaking:** match people by "Looking for help with" and declared skills (art, backend, sound, testing)
- **Changelog feed:** "what's new in projects you follow" pulled from GitHub releases
- **Embeddable badge** for READMEs: "Listed on ForkYard — fork me" that links back (free marketing)
- **Browser extension (later):** on any GitHub repo page, shows if it's on ForkYard and lets you submit it
- **Public API and RSS** so others can build on the catalog (fits the open ethos)

**Sustainability without subscriptions**

- Donations via GitHub Sponsors / Open Collective with transparent spending
- Optional cosmetic supporter perks only (extra avatar outfits, profile frame) — never paywall core features
- Tip jars on projects that route straight to the author

### Unfinished projects

Work-in-progress projects sit in the main catalog beside finished ones, so a promising half-built app can be picked up instead of restarted.

- **Stage badge** on every card: Finished, Work in progress, or Up for adoption; WIP cards also show which Studio column they're in
- **Preview first:** the thumbnail or GIF is the main pitch; the focus panel adds an author-written "What works / What's missing" box so you can judge whether to build on it
- **Continue this** button: forks it to your GitHub (licensed) or sends a build-on request (unlicensed), then adds it to your Studio as an Idea with lineage back to the original
- **Up for adoption:** authors can mark a project they've stopped working on as open to takeover; with their OK, the adopter becomes the listed maintainer
- Filters to show or hide WIP, find "up for adoption", or match "looking for help with…" to your skills
- Follow a WIP project to get notified when it reaches a new stage

### Ideas adapted from existing sites

Each of these takes a good idea from a site in the competitor research and reshapes it to fit the mission, rather than copying the original.

| Feature | Inspired by | Our version |
| --- | --- | --- |
| Build facts: AI tools used, rough build time, AI-involvement level (AI-assisted / mostly AI / no hand-written code) | MadeWithVibe, BuiltByVibe, Vibe Code Club | Self-reported, filterable, shown on the back of each card |
| Agent access through an MCP endpoint | BuiltByVibe | Agents can search the catalog and pull a starter prompt, with license and lineage included; free |
| Live README badge that shows upvotes and forks | BuiltByVibe, Vibe Code Club | Pixel-art style, links straight to the fork box |
| Template flag and a gallery sorted by forks and likes | v0 Templates | Works for any stack, not tied to one vendor |
| One-click fork | Replit Remix, v0 | A real GitHub fork you own, plus lineage on the site |
| Launch days, leaderboards, "looking for first testers" | Lovable Launched | Launches are free; no paid placement |
| Transparent health score (stars, forks, contributors, activity, age) | OpenAlternative | The breakdown is shown on every project |
| Build competitions with prizes, plus a newsletter | MadeWithVibe | Prizes funded by donations or sponsors; a "Fork Report" newsletter |
| Open catalog data: one JSON file per project in a public repo, submissions by pull request | Vibe Code Club | A public mirror of the whole catalog under an open data license |
| Never store agent chat logs; scan imports for secrets | Lesson from Lovable's April 2026 exposure of public projects' chats and code | Built into ingestion and the privacy policy |

Deliberately skipped: paid "featured boosts", because they clash with the no-paywall principle.

## Trust, safety, licensing

A catalog of runnable code is a target for malware and spam, so safety checks are part of the core design rather than an add-on.

**Licensing**

- Unlicensed repos are listed but \*\*hidden by default\*\* everywhere: feed, search, categories, profiles and collections. Licenses are detected with GitHub's license API
- Show the license plainly on every card, with a one-line plain-English summary ("MIT: do anything, keep the credit")
- Flag copyleft (GPL/AGPL) so forkers know their fork must stay open
- A short "Licensing 101" page for newcomers

**Unlicensed projects: hidden unless you opt in**

- A **Show unlicensed projects** switch sits in the filter drawer and in Settings. It's off by default, remembered per account (or per browser when signed out)
- Turning it on the first time opens a dialog with the disclaimer below and an "I understand" button; turning it off again needs no confirmation
- While hidden, results show a quiet note such as "4 unlicensed projects hidden · Show them", so people know they exist
- A direct link to an unlicensed project still opens, with the disclaimer as a banner at the top of the panel
- When shown, unlicensed cards carry a "No license" badge, the disclaimer appears in their panel, and the clone box is replaced by "Ask the author to add a license" (a prefilled GitHub issue) and "Request to build on this" (a Collab request)
- Authors always see their own unlicensed projects in Studio and on their profile, with a nudge to add a license

**Disclaimer text** (shown in the dialog, the panel banner, and Licensing 101):

> **No license: all rights reserved.** This project's code is public, but its author hasn't given permission to reuse it. GitHub's terms let you view and fork it on GitHub, but you may not copy, modify or redistribute it elsewhere — including building your own version from it — without the author's permission. Ask the author to add a license before building on it. This is general information, not legal advice.

**Code safety**

- Never run or host submitted code on the site's servers; the site only links out
- Basic automated checks on import: known-malware hash lists, suspicious install scripts, committed secrets/API keys (warn the author privately)
- "Review before running" notice on every project and resource; report button everywhere
- Verified-author badge when the GitHub account that owns the repo is the one that submitted it

**Moderation**

- Clear community rules (no harassment, no malware, no stolen code, no spam)
- Report → moderation queue in the admin console; trusted-user moderators later
- Chat: rate limits, slow mode, word filter, mute/kick/ban, message delete; logs kept for a limited time
- Spam defense: Cloudflare Turnstile on signup and posting; new accounts limited (e.g. 3 projects/day, no links in chat for the first 24 hours)
- DMCA / takedown process and contact page

**Privacy and legal**

- Privacy policy, terms of service, cookie notice (keep tracking minimal — privacy-friendly analytics only)
- Users 13+ (or 16+ in parts of the EU) with an age check at signup
- Data export and deletion (GDPR/CCPA style)

## Architecture and tech stack

One Cloudflare Worker serves both the website and its API, with Durable Objects handling everything real-time (chat, Plaza presence, live forum updates).

&#91;embedded content: system architecture · one Worker, four stores, one background job\]

The browser talks to the single Worker; the Worker fans out to storage, and a scheduled job feeds new GitHub candidates into the admin review queue. GitHub (dashed) is the only outside service.

**Stack**

| Layer | Choice | Why |
| --- | --- | --- |
| Frontend | React + Vite + TypeScript, Tailwind | Huge ecosystem, agents write it well, fast builds |
| Animation | Framer Motion | Card flip, blurred focus panel, page transitions |
| Kanban drag-and-drop | dnd-kit | Accessible, keyboard support built in |
| Plaza room | PixiJS (or plain canvas) | Lightweight 2D sprites for 16-bit avatars |
| API | Hono on Workers | Tiny, fast, made for Cloudflare |
| Database access | Drizzle ORM on D1 | Typed queries, simple migrations |
| Auth | GitHub OAuth + email magic link (e.g. Better Auth) | Everyone has GitHub; proves repo ownership |
| Search | D1 full-text search first, Vectorize later | Start simple, add semantic search in phase 3 |
| Analytics | Cloudflare Web Analytics | Free and cookie-less |
| Email | Cloudflare Email or Resend | Notifications and digests |

**Core data model (tables)**

- `users`, `profiles`, `avatars` (16-bit outfit choices), `follows`, `blocks`
- `projects` (repo URL, license, stage, public flag, replaces-product, source: community/curated), `project_media`, `project_tags`, `categories`
- `forks` (parent → child links for the fork tree)
- `boards`, `board_columns` (editable title, order, collapsed, WIP limit), `board_cards`
- `collab_requests`, `conversations`, `messages`
- `forum_boards`, `threads`, `posts`, `votes`
- `resources`, `resource_reports` (worked / didn't work), `collections`, `collection_items`
- `notifications`, `reports`, `badges`, `user_badges`
- `candidates` (admin review queue), `audit_log`

Chat history lives inside each Durable Object room, with periodic snapshots to D1 for moderation.

## Hosting recommendation

**Stay on Cloudflare, but use Cloudflare Workers (with static assets) instead of Cloudflare Pages.** Same company, same free static hosting, same pricing model — just the newer product, which this site actually needs.

**Why not Pages specifically.** Cloudflare's own [Pages-to-Workers migration guide](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/) (updated Sep 22, 2026) says static asset requests are free on both and costs are similar, but Workers has a broader feature set. Three things this plan depends on are missing or awkward on Pages:

- **Durable Objects** power the live chat, the Plaza room, and live forum updates. Pages can only use them through a separate Worker; on Workers they're built in.
- **Cron Triggers** run the GitHub discovery job and stat refreshes. Pages doesn't support them.
- **Rate Limiting, Queue consumers, and Workers Logs** (spam control, background jobs, debugging) are Workers-only.

Pages still works and isn't being shut off, but new Cloudflare features land on Workers. Starting there avoids a migration later.

**One catch:** a Worker custom domain needs the domain's nameservers on Cloudflare. That's easy if you buy the domain through Cloudflare Registrar.

**Suggested Cloudflare setup**

| Need | Cloudflare product |
| --- | --- |
| Website + API | Workers with static assets (one deploy) |
| Main database (users, projects, posts) | D1 (SQLite) |
| Thumbnails, avatars, uploads | R2 (no egress fees) |
| Live chat, Plaza, presence, live threads | Durable Objects with WebSocket hibernation |
| GitHub discovery, stat refresh | Cron Triggers + Queues |
| Caching GitHub API responses, sessions | KV |
| Semantic search, "has this been built?" | Vectorize + Workers AI embeddings |
| Bot protection | Turnstile |
| Lock down the admin console | Cloudflare Access (Zero Trust, free up to 50 users) |
| Music files | R2 behind the CDN |

**Other hosts worth knowing**

| Host | Good for | Trade-off vs. Cloudflare |
| --- | --- | --- |
| Vercel | Best-in-class Next.js experience | Bandwidth and function costs climb fast at scale; no built-in WebSocket rooms |
| Netlify | Simple static + functions, great previews | Similar cost curve to Vercel; realtime needs a third party |
| Supabase | Postgres, auth, storage, realtime in one | Great as a backend paired with any frontend host; free tier pauses idle projects |
| Fly.io | Long-running servers and WebSockets near users | You manage servers/containers; no forever-free tier |
| Render | Traditional backend + Postgres + cron | Free web services sleep when idle |
| Railway | Fast deploy of any stack | Usage-based billing, no free tier for production |
| GitHub Pages | Docs or a static mirror of the catalog | Static only; no backend at all |
| Coolify on a VPS (e.g. Hetzner) | Fully self-hosted, matches the anti-big-corp ethos | You handle uptime, backups and security |

If you'd ever rather not depend on one provider, the most portable alternative is **Supabase (backend) + Cloudflare Workers (frontend)**, or self-hosting with Coolify once traffic is predictable. Pricing on all of these changes often, so recheck the free tiers before committing.

## Phased roadmap

Launch the catalog alone first: it's useful on day one even with zero users, because you seed it yourself from the curation console.

&#91;embedded content: roadmap · 4 phases, 3 gates\]

Each gate is a suggested checkpoint before moving on, not a deadline; adjust the numbers once you see real traffic.

## Open questions

- [ ] Final name, and is the domain available?
- [ ] Should Studio allow projects with no repo at all (idea-only), or require a GitHub link before anything goes public?
- [ ] Must every public project have a live demo, or is a repo + screenshots enough?
- [ ] Decided: unlicensed projects are allowed with a clear label. Still open: should curated (non-author) imports include unlicensed repos, or only author submissions?
- [ ] Will you apply for Reddit API access, or stay with the paste-a-link importer?
- [ ] Who moderates chat at launch — just you, or a few trusted early users?
- [ ] Music: commission an original loop, or use CC0 tracks?
- [ ] Any monetization at all (donations only?), and should that be stated publicly from day one?

## Sources

- [Migrate from Pages to Workers — Cloudflare Docs](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/) (Pages vs. Workers compatibility matrix)
- [Responsible Builder Policy — Reddit Help](https://support.reddithelp.com/hc/en-us/articles/42728983564564-Responsible-Builder-Policy) (Reddit data access rules)
