# Contract request: competition draft retrieval and publication deadline

- **From:** sol
- **For task:** 4.14
- **Status:** resolved in [PR #85](https://github.com/Cyberhex1/forkvlift/pull/85), merged 2026-10-13

## Resolution

`listAdminCompetitions` lists all rounds with drafts first; `getAdminCompetition` reads a round by id, including drafts. Both routes enforce admin authorization. Winner publication now enforces `judgingEndsAt` on the server. The 4.14 console uses these reads for listing, opening and conflict reloads after merging main into its branch.

## What I need

Admin read routes for competition rounds, including drafts. `listCompetitions` excludes unopened rounds, and `getCompetition` calls roundBySlug without allowDraft, including for admins. There is no admin list/get route in routes.ts.

Also clarify and enforce the publication deadline: the route summary says awards publish after judging closes, but `core/competitions.ts:publish` currently checks status=judging (after submissions close) and version, without comparing now to judging_ends_at.

## Why

Admins cannot rediscover a draft after leaving creation. An empty update would mutate its version, so it isn't a read workaround. Winner publication should use the same judging deadline contract as scorecard submission.

## Proposed shape

`listAdminCompetitions`: paged CompetitionRound including drafts; `getAdminCompetition`: CompetitionRound by id, behind admin auth. Add deadline validation to publishCompetitionWinners or explicitly document a different permitted publication window.

## Workaround until then

Create returns a real draft and the UI immediately offers editing/opening it in that session. No local copies pretend to be the server's draft catalog. Existing public rounds remain manageable. UI winner publication is disabled until judgingEndsAt and still sends expectedVersion. Server authorization stays authoritative.
