import type { SessionUser } from "@forkvlift/shared";

declare global {
  /** Compile-time flag: true only under `vite dev`. Production bundles drop every fixture branch. */
  const __FIXTURES__: boolean;

  /** Secrets and dev-only vars (not in wrangler.jsonc). */
  interface Env {
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    TURNSTILE_SECRET?: string;
    USE_FIXTURES?: string;
    ALLOW_SESSION_ADMIN?: string;
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
