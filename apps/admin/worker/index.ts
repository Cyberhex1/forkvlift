/**
 * Admin console Worker (owner: Opus). Serves the console's static assets and
 * forwards /api/* to the main Worker over a service binding. Cloudflare Access
 * sits in front of this Worker's hostname; the main Worker re-verifies the Access
 * JWT on every /api/admin/* call, so this proxy is not a trust boundary on its own.
 */
interface AdminEnv {
  API: Fetcher;
  ASSETS: Fetcher;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return env.API.fetch(request);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<AdminEnv>;
