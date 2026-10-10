import type { SessionUser } from "@forkvlift/shared";

declare global {
  /** Compile-time flag: true only under `vite dev`. Production bundles drop every fixture branch. */
  const __FIXTURES__: boolean;

  /** Secrets and dev-only vars (not in wrangler.jsonc). */
  interface Env {
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    /** Server token for the GitHub API (public repos only). Raises the limit to 5,000 requests/hour. */
    GITHUB_TOKEN?: string;
    TURNSTILE_SECRET?: string;
    /** Email via Resend when the Cloudflare Email binding isn't available. */
    RESEND_API_KEY?: string;
    /** Override the sender, e.g. "ForkLift <hello@forklift.stream>". */
    EMAIL_FROM?: string;
    USE_FIXTURES?: string;
    ALLOW_SESSION_ADMIN?: string;
    /** Test-only: skip the write rate limits (set in vitest.integration.config.ts). */
    DISABLE_RATE_LIMITS?: string;
  }
}

export interface AppVariables {
  user: SessionUser | null;
  /** Set by requireAdmin: user id or Cloudflare Access email, for the audit log. */
  adminActor: string | null;
}

export interface AppEnv {
  Bindings: Env;
  Variables: AppVariables;
}
