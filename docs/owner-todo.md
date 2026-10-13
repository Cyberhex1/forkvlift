# Owner to-do

Things only the owner can do (accounts, secrets, approvals). Agents keep this list current.

## Production launch (the Phase 1 gate)

Run the `wrangler` commands from `C:\code\ForkvLift\apps\worker`.

- [ ] **Approve at least 100 real projects** in the review queue at https://forkvlift-admin-preview.kdlindsey25.workers.dev. Discovery adds candidates every 6 hours; the paste-a-link importer adds more on demand. Opus starts the launch once this is done.
- [ ] **GitHub OAuth app (production):** GitHub → Settings → Developer settings → OAuth Apps → New. Homepage `https://forklift.stream`, callback `https://forklift.stream/api/auth/github/callback`. Then:
      `npx wrangler secret put GITHUB_CLIENT_ID --env production` and `npx wrangler secret put GITHUB_CLIENT_SECRET --env production`
- [ ] **Turnstile:** the production site key is in `wrangler.jsonc` (same widget as preview). In the Cloudflare dashboard → Turnstile → your widget → Hostnames, add `forklift.stream`. Then, from `apps\worker`, run `npx wrangler secret put TURNSTILE_SECRET --env production` and paste the same secret as preview.
- [ ] **Discovery token (production):** `npx wrangler secret put GITHUB_TOKEN --env production` (the same fine-grained token as preview works).
- [ ] **Domain:** confirm `forklift.stream`'s nameservers are on Cloudflare (dashboard → Websites shows it as Active). Opus attaches it to the production Worker.
- [ ] **Cloudflare Access (production admin console):** when Opus deploys `forkvlift-admin`, approve the Access application it asks for so only you can open it.
- [ ] **Renew the GitHub token** before it expires (around October 2027), for preview and production.

## Done

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
