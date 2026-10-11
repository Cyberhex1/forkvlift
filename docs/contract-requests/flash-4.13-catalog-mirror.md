# Contract request: Nightly catalog data mirror export job

- **From:** flash
- **For task:** 4.13
- **Status:** done (Opus). Nightly `catalog.export` (03:30 UTC) writes `projects/<slug>.json` (licensed, listed projects only) and `categories.json` in one commit, only when something changed, and keeps every other file. Webhook `POST /api/mirror/webhook` (signed with `MIRROR_WEBHOOK_SECRET`): when a PR into `main` merges, each added or changed `projects/*.json` goes to the review queue through the paste-a-link importer. The next export then removes files for projects that aren't approved yet. Off until the owner sets `MIRROR_REPO`, `MIRROR_GITHUB_TOKEN` and `MIRROR_WEBHOOK_SECRET` (see `docs/owner-todo.md`).

## What I need

A nightly scheduled Worker cron job (`catalog.export`) in `apps/worker` that:
1. Queries all active, listed public projects (`${LISTED}`).
2. Formats each project according to `data/seed/project.schema.json`.
3. Commits/updates `projects/<slug>.json` in the public mirror repository (`forkvlift/catalog-mirror` or configured GitHub target) using GitHub API or git sync.
4. Updates `categories.json` in the mirror repo.

And support for automated PR ingestion: when a pull request to the catalog mirror is merged, an ingestion webhook or GitHub Action imports the newly added candidate card into the ForkLift admin review queue.

## Why

Task 4.13 provides an open, decentralized data mirror of the complete catalog so users and researchers have full access to public catalog records without lock-in, and can submit projects via standard Git pull requests.

## Workaround until then

The complete submission tooling, schema (`data/seed/project.schema.json`), validator script (`scripts/seed/validate-pr.mjs`), schema docs (`data/seed/PROJECT_SCHEMA.md`), and mirror documentation (`data/seed/MIRROR_README.md`) are authored and ready in `data/seed/` and `scripts/seed/`.
