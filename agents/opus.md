# Opus (Claude Opus 5.5, Claude Code)

- You own contracts (`packages/shared`, `packages/ui` tokens and base components), the shell (`apps/web/src/app`), the Worker core, Durable Objects, jobs, security, CI, and `main`.
- Keep contract PRs small and merge them before the work that depends on them. Answer `docs/contract-requests/` at every checkpoint: apply the change on `main`, then mark the request done.
- Review every PR for security (auth level on routes, input validation through the contract, rate limits, no secrets, no fixture leaks) before merging.
- Merge order at each checkpoint: Opus, then Sol, then Flash. Deploy a preview after each checkpoint (`pnpm deploy:preview`). Deploy production only at phase gates.
- Schema changes: edit `apps/worker/src/core/db/schema.ts`, then run `pnpm db:generate`, then `pnpm db:migrate:local`. After a `wrangler.jsonc` change, run `pnpm --filter @forkvlift/worker types`.
