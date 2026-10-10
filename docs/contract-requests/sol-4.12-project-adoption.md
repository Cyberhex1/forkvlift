# Contract request: project adoption and maintainer transfer

- **From:** sol
- **For task:** 4.12
- **Status:** open

## What I need

Opus-owned shared schemas, D1 migrations and core authorization/transfer handlers for marking a project up for adoption, requesting takeover, and approving a new listed maintainer. The existing stage="adoption" is only a label; it cannot safely authorize a transfer.

## Why

A client-side change to the author or stage would not establish ownership or preserve lineage. Transfer must be atomic, auditable and require the current author's approval. It changes ForkLift stewardship only, not GitHub repository access or licensing.

## Proposed shape

Use shared UserSummary, ProjectRef, ProjectDetail and PageQuery; all errors use the existing envelope.

- PATCH /api/projects/:slug/adoption (setProjectAdoption, user): body { open: boolean, note: string(max 1000) }; response ProjectDetail. Current verified owner only. On opening store the prior stage; on cancellation restore it and close pending applications.
- GET /api/projects/:slug/adoption (getProjectAdoption, public for listed projects): { open, note, originalAuthor: UserSummary|null, maintainer: UserSummary|null, viewerRequest: AdoptionRequest|null, canManage: boolean }. Never expose applicants or private notes publicly.
- POST /api/projects/:slug/adoption/requests (requestProjectAdoption, user + Turnstile): body { message: string(1..2000), turnstileToken }; response AdoptionRequest. Another non-banned user, one pending request per project/person. No blocked pairs or self-requests.
- GET /api/projects/:slug/adoption/requests (listProjectAdoptionRequests, owner): paged AdoptionRequest, optionally status. Only current owner sees all applications; applicant can read their own via viewerRequest.
- DELETE /api/projects/:slug/adoption/requests/:id (withdrawProjectAdoptionRequest, applicant): withdraw pending only; idempotent.
- POST /api/projects/:slug/adoption/requests/:id/decision (decideProjectAdoption, current owner): body { decision: "approve"|"decline" }; response { request: AdoptionRequest, project: ProjectDetail }. Approval compare-and-sets the current owner and open adoption version, closes competing pending requests and transfers owner_id to the approved adopter in one transaction. No approval by applicant/admin impersonation. Admin moderation may cancel adoption but cannot silently appoint a maintainer.

AdoptionRequest: { id, project: ProjectRef, requester: UserSummary, message, status: "pending"|"approved"|"declined"|"withdrawn"|"cancelled", createdAt, decidedAt: ISO|null }.

Suggested tables:
- project_adoptions: project_id PK/FK, original_owner_id nullable FK, previous_stage, note, opened_at, version; preserve original attribution separately from current owner.
- adoption_requests: id PK, project_id FK, requester_id FK, message, status, created_at, decided_at, deciding_owner_id FK, adoption_version. Partial unique pending(project_id, requester_id).
- Audit/notifications use existing facilities, implemented by Opus. Transfer authorization must update every owner-sensitive core route consistently (edit, Studio, claims, collaboration). Preserve IDs, forks, credits, license and history; do not transfer external GitHub permissions.

Read policy: follow the catalog's public/private/hidden/deleted rules. Unlicensed projects remain hidden in lists unless opted in; reuse the exact disclaimer. Adoption approval conveys no new code license. Require repository-control verification or an explicit approved stewardship policy before granting repository edit privileges; Opus should settle this distinction in the shared contract.

Failure semantics: 401 signed out, 403 unauthorized/blocked, 404 inaccessible project/application, 409 closed/stale/already decided. Retries cannot transfer twice. Use existing write limits and Turnstile validation.

## Workaround until then

Keep the existing stage badge. No takeover UI, fabricated applications, local ownership mutation, shared/core/DO/job edits. Sol implements owned feature UI and e2e after Opus lands the contracts/core. Fixtures and migration/authorization tests belong to Opus.
