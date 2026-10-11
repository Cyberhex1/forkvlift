# Owner to-do (saved for later)

Not blocking Phase 1. Do these before real sign-in, uploads, or the admin console are needed.

- [x] **GitHub OAuth app (local):** GitHub → Settings → Developer settings → OAuth Apps → New.
      Callback URL: `http://127.0.0.1/api/auth/github/callback`.
      Put the Client ID and secret in `apps/worker/.dev.vars` (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) in each folder you run.
- [x] **GitHub OAuth app (preview):** callback `https://forkvlift-preview.kdlindsey25.workers.dev/api/auth/github/callback`.
      Then, from `C:\code\ForkvLift\apps\worker`:
      `npx wrangler secret put GITHUB_CLIENT_ID --env preview` and `npx wrangler secret put GITHUB_CLIENT_SECRET --env preview`
- [x] **Enable R2** in the Cloudflare dashboard, then tell Opus (buckets + binding get finished).
- [x] **(Optional) Cloudflare Images:** nothing to enable. Every account is on the Images Free plan (5,000 unique transformations/month, no overage charges); the `IMAGES` binding is set for preview and production.
- [x] **Turnstile:** create a widget, then give Opus the site key and set the secret with `npx wrangler secret put TURNSTILE_SECRET --env preview`.
- [x] **Cloudflare Access** for the admin console (needed by task 1.12/1.7). Zero Trust team `tight-night-bcaf.cloudflareaccess.com` set up; Opus creates the Access application (and `ACCESS_AUD`) when the admin console is deployed.
- [x] **Domain:** `forklift.stream` (site renamed to ForkLift). Opus attaches it to the production Worker at the Phase 1 gate; its nameservers must be on Cloudflare.
- [x] **Decide:** should curated (non-author) imports include unlicensed repos? **No.** Approval is blocked when a repo has no license.

FYI: `gh auth setup-git` was run so git pushes use your GitHub CLI login.

## Catalog mirror (task 4.13; optional)

- [ ] Create a public repo for the mirror (for example `Cyberhex1/forklift-catalog`) with a `main` branch. Copy in `data/seed/MIRROR_README.md` (as `README.md`), `data/seed/project.schema.json`, `data/seed/PROJECT_SCHEMA.md` and `scripts/seed/validate-pr.mjs`.
- [ ] Create a fine-grained GitHub token with **Contents: read and write** and **Pull requests: read** on that repo only. From `C:\code\ForkvLift\apps\worker`:
      `npx wrangler secret put MIRROR_GITHUB_TOKEN --env preview` (and `--env production` at launch)
- [ ] Pick a random webhook secret: `npx wrangler secret put MIRROR_WEBHOOK_SECRET --env preview`
- [ ] Tell Opus the repo name (it goes in `MIRROR_REPO`).
- [ ] In the mirror repo's Settings → Webhooks, add `https://<site>/api/mirror/webhook`, content type JSON, the same secret, and only the "Pull requests" event.
