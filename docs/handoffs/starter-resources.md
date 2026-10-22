# Starter resources (Opus, 2026-10-13)

The Resources page was empty: resources only come from people pressing "Share a resource", and the
seeds the implementation plan asked for ("Resources section seeds") were never assigned.

- `data/seed/resources/*.md`: ten starter resources, one file each (front matter + Markdown body).
  Our own write-ups are CC0; ones about other people's work link to the source and carry its license
  (or "See source" when it varies). Bodies are written fresh, never copied.
- `scripts/seed/resources.mjs --author <username>` prints idempotent SQL: each insert is skipped if
  its slug already exists, and posts under that existing account.
- Preview: loaded on 2026-10-13 under @Cyberhex1 (10 rows).
- **Launch:** run the same script against `forkvlift` production after the owner's account exists
  there, e.g. `node scripts/seed/resources.mjs --author Cyberhex1 > resources.sql`, then from
  `apps/worker`: `npx wrangler d1 execute <prod db> --remote --env production --file ../../resources.sql`.

To add more, drop another `NN-name.md` file in the folder and re-run; existing ones are skipped.
