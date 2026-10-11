# Contract request: build competitions, judging and winners

- **From:** sol
- **For task:** 4.14
- **Status:** done (Opus). A round sits on a growth event: entries use the event's `submitGrowthEntry` (there is no separate competition entry route), and `CompetitionRound.eventSlug` points at it. Status: draft → open (until the event's submissions close) → judging → published (or cancelled). Prizes, criteria and judges are set at creation and freeze once the round opens; only rules and eligibility text can change. Judges can't score entries they own or submitted (`conflicts` in `getCompetitionJudging`). Submitted scorecards are final. Admin `getCompetitionScores` shows weighted totals (each criterion counts score/max × weight, averaged over submitted scorecards; ties go to the earlier entry). `publishCompetitionWinners` works once, after submissions close, with `expectedVersion`; published awards are never rewritten. Prizes are display only.

## What I need

After 4.6, extend its shared event/entry model with prize rounds, judging permissions, published awards and winners routes. Opus implements shared contracts, migrations, core judging/publication and any jobs; Sol implements the owned UI.

## Why

A community ballot is not a judge decision. Prizes, judge conflicts, private scorecards and finalized winners require distinct server authority. The site lists prizes and sponsor attribution; it does not accept money, pay prizes or sell placement.

## Proposed shape

Reuse GrowthEvent/EventEntry from the 4.6 request (sol-4.6-growth-events.md), ProjectCard/ProjectRef and UserSummary. Keep competitions as events so entry eligibility, licensing, windows and moderation do not diverge.

CompetitionRound: { id, slug, eventId, title, rulesMd, eligibilityMd, submissionEndsAt, judgingEndsAt, publishedAt: ISO|null, status: "draft"|"open"|"judging"|"published"|"cancelled", prizes: Prize[], criteria: Criterion[], judges: public UserSummary[] }.
Prize: { id, label: string(max 140), descriptionMd: string(max 2000), sponsorName: string(max 100)|null, sponsorUrl: safeHttpUrl|null, place: positiveInt|null }. Informational only; no account, payout, checkout or paid-ranking fields.
Criterion: { id, label, description, maxScore: positiveInt, weight: boundedNumber }.
Scorecard: { roundId, entryId, judge: UserSummary, scores: { criterionId, score }[], note: string(max 2000), submittedAt: ISO|null }. Private to assigned judge and administrators until an explicit approved disclosure policy.
Award: { id, roundId, prize: Prize, entry: EventEntry, rationaleMd, announcedAt }. Published awards cite the entry/project and its license; never silently rewrite published history.

Routes:
- GET /api/competitions (listCompetitions, public): PageQuery + public status; page(CompetitionRound summary). Exclude drafts.
- GET /api/competitions/:slug (getCompetition, public): public round/rules/prizes and eligibility; exclude confidential judging.
- GET /api/competitions/:slug/winners (getCompetitionWinners, public): { competition, awards: Award[] }; before publication return empty awards with publishedAt=null, never provisional winners.
- POST /api/competitions/:slug/entries (submitCompetitionEntry, user + Turnstile): { projectId, turnstileToken }; reuse 4.6 verified owner, public licensed entry, window and uniqueness checks. Response EventEntry.
- GET /api/competitions/:slug/judging (getCompetitionJudging, assigned judge/admin): eligible entries, criteria and the caller's own scorecards.
- PUT /api/competitions/:slug/scorecards/:entryId (saveCompetitionScorecard, assigned judge): { scores, note, submit: boolean }; server validates every criterion, score bound, window and conflict. Judges cannot score their own entries, sponsor-owned entries or disclosed conflicts.
- POST /api/admin/competitions (createCompetition, admin): draft rules, prizes, criteria, dates, assigned judge ids; response CompetitionRound.
- PATCH /api/admin/competitions/:id (updateCompetition, admin): only fields allowed by lifecycle. Freeze rules/criteria/prizes once entries open; auditable cancellation/errata.
- POST /api/admin/competitions/:id/publish (publishCompetitionWinners, admin): { awards: { prizeId, entryId, rationaleMd }[], expectedVersion }; require complete valid judging and eligibility, compare-and-set publication version. Return immutable published awards.
- Auditable corrections/cancellation need an explicit contract; never permit ordinary PATCH to swap winners after publication.

Suggested tables extending 4.6:
- competition_rounds: id PK, event_id unique FK, slug unique, rules_md, eligibility_md, judging_ends_at, status, version, published_at, created_by.
- competition_prizes: id PK, round_id FK, label, description_md, sponsor_name/url, place; display metadata only.
- competition_criteria: id PK, round_id FK, label, description, max_score, weight.
- competition_judges: round_id/judge_id composite PK, conflict_note; permissions scoped to round.
- competition_scorecards: round_id/entry_id/judge_id composite PK, scores_json, note, submitted_at, updated_at.
- competition_awards: id PK, round_id/prize_id FK, entry_id FK, rationale_md, announced_at; one winner per prize unless rules explicitly model shared awards.

Opus must choose and document tie resolution and withdrawn/hidden/disqualified entry handling. Server clock controls deadlines; late scores rejected, ranks never client-authored. Aggregate finalized scorecards only, require explicit admin publication and audit it atomically. Public winner pages exclude private user data; moderation may tombstone a project while retaining an honest published-result record under an explicit policy.

## Workaround until then

Wait for 4.6 and this contract. No mock prizes, invented winners, local judging scores or payment processing. Sol can build UI/e2e when shared fixtures and core publication/authorization tests are present. No shared/core/DO/job edits by Sol.
