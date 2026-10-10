# Contract request: Nightly catalog data mirror export job

- **From:** flash
- **For task:** 4.13
- **Status:** open

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
