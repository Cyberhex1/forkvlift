# Owner to-do (saved for later)

Not blocking Phase 1. Do these before real sign-in, uploads, or the admin console are needed.

- [x] **GitHub OAuth app (local):** GitHub → Settings → Developer settings → OAuth Apps → New.
      Callback URL: `http://127.0.0.1/api/auth/github/callback`.
      Put the Client ID and secret in `apps/worker/.dev.vars` (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) in each folder you run.
- [x] **GitHub OAuth app (preview):** callback `https://forkvlift-preview.kdlindsey25.workers.dev/api/auth/github/callback`.
      Then, from `C:\code\ForkvLift\apps\worker`:
      `npx wrangler secret put GITHUB_CLIENT_ID --env preview` and `npx wrangler secret put GITHUB_CLIENT_SECRET --env preview`
- [x] **Enable R2** in the Cloudflare dashboard, then tell Opus (buckets + binding get finished).
- [ ] **(Optional) Cloudflare Images** on the account so uploaded thumbnails get resized. Tell Opus when it's on.
- [x] **Turnstile:** create a widget, then give Opus the site key and set the secret with `npx wrangler secret put TURNSTILE_SECRET --env preview`.
- [x] **Cloudflare Access** for the admin console (needed by task 1.12/1.7). Zero Trust team `tight-night-bcaf.cloudflareaccess.com` set up; Opus creates the Access application (and `ACCESS_AUD`) when the admin console is deployed.
- [ ] **Domain** via Cloudflare Registrar (any time before launch).
- [x] **Decide:** should curated (non-author) imports include unlicensed repos? **No.** Approval is blocked when a repo has no license.

FYI: `gh auth setup-git` was run so git pushes use your GitHub CLI login.
