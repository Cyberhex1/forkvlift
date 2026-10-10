# Contract request: launch days, Fork Friday and build jams

- **From:** sol
- **For task:** 4.6
- **Status:** open

## What I need

Shared event/entry/ballot schemas and routes, D1 tables, and Opus-owned eligibility, scheduling and ranking logic. Sol builds /launches, /jams and event/leaderboard pages after those contracts land. Launches are free and ranking has no paid placement.

## Why

The catalog has votes and lineage but no event scope, submission window, event entry or event ballot. Reusing project upvotes as event votes would misrepresent competition results.

## Proposed shape

Use existing ProjectCard, ProjectRef, UserSummary, PageQuery and error envelopes.

GrowthEvent: { id, slug, kind: "launch_day"|"fork_friday"|"build_jam", title, bodyMd, startsAt, submissionEndsAt, votingEndsAt, featuredProject: ProjectRef|null, status: "scheduled"|"submitting"|"voting"|"ended"|"cancelled", entryCount }. All times ISO UTC; status derives from server clock and cancellation, not client time. Fork Friday requires a featured licensed project. Build jams have a theme in bodyMd. Launch days have a server-validated calendar date.

EventEntry: { id, eventId, project: ProjectCard, submittedBy: UserSummary, submittedAt, voteCount, viewerVoted: boolean, rank: number|null }. Server filters hidden/private/deleted/unlicensed projects. No fabricated entries on empty events.

Routes:
- GET /api/growth/events (listGrowthEvents, public): query PageQuery + optional kind/status; response page(GrowthEvent).
- GET /api/growth/events/:slug (getGrowthEvent, public): GrowthEvent plus { viewerCanSubmit, viewerCanVote }; no private applicant data.
- GET /api/growth/events/:slug/entries (listGrowthEventEntries, public): PageQuery + sort="newest"|"rank"; page(EventEntry).
- GET /api/growth/events/:slug/leaderboard (getGrowthLeaderboard, public): paged EventEntry, ranked by valid vote count desc then submission time asc then entry id; documented tie behavior.
- POST /api/growth/events/:slug/entries (submitGrowthEntry, user + Turnstile): { projectId, turnstileToken }; response EventEntry. Current verified project owner only, licensed/public/listed, within window, one entry per project/event. Fork Friday additionally requires a real fork lineage to featuredProject.
- DELETE /api/growth/events/:slug/entries/:id (withdrawGrowthEntry, submitting owner): allowed until submissions close; audit removal, hide from rankings.
- PUT /api/growth/events/:slug/ballot (voteGrowthEntry, user): { entryId: string|null }; response { entryId, entries: changed counts }. One active vote per user/event; null retracts. Only during voting, no self-votes, banned users, ineligible projects or duplicate ballots.
- POST /api/admin/growth/events (createGrowthEvent, admin): validated event fields including featuredProjectId; response GrowthEvent.
- PATCH /api/admin/growth/events/:id (updateGrowthEvent, admin): draft/cancellation fields; cannot retroactively change closed windows or outcomes without an auditable explicit operation.

Suggested tables:
- growth_events: id PK, slug unique, kind, title, body_md, featured_project_id FK nullable, starts_at, submission_ends_at, voting_ends_at, cancelled_at, created_by FK, created_at.
- growth_entries: id PK, event_id FK, project_id FK, submitted_by FK, submitted_at, withdrawn_at; unique active(event_id, project_id).
- growth_ballots: event_id FK, voter_id FK, entry_id FK, updated_at; PK(event_id, voter_id). Aggregate authoritative eligible ballots; counters cannot drift or count removed/blocked/banned entries.
- Audit changes and invalidation of removed projects use Opus core facilities. Any jobs/notifications/reminders are owned by Opus; no DO required for the UI contract.

Permissions/security: reads use existing listing rules; writes authenticated, rate-limited, scoped to current verified owners/admins. Never accept client rank, votes or lifecycle state. All mutation races validate windows and eligibility atomically; 409 for closed/stale windows, 403 unauthorized, 404 inaccessible. No placement/payment field or checkout integration.

## Workaround until then

Keep normal catalog discovery. No mock launch schedule, localStorage voting, fake entries or timer-based claims of results. Sol implements feature pages/e2e after Opus provides contracts, fixtures and core tests. 4.14 extends this event/entry model after 4.6.
