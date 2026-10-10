/**
 * Integration tests: run inside workerd with real local D1/KV/DO bindings and
 * every migration applied. Fixtures are off, so these hit the real handlers.
 */
import path from "node:path";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));
  return {
    define: { __FIXTURES__: "false" },
    plugins: [
      cloudflareTest({
        wrangler: { configPath: "./wrangler.jsonc" },
        // Pinned here so results never depend on a developer's .dev.vars.
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            ENVIRONMENT: "local",
            ALLOW_SESSION_ADMIN: "true",
            TURNSTILE_SECRET: "1x0000000000000000000000000000000AA",
            GITHUB_TOKEN: "",
            USE_FIXTURES: "false",
            DISABLE_RATE_LIMITS: "true",
          },
        },
      }),
    ],
    test: {
      include: ["test/integration/**/*.test.ts"],
      setupFiles: ["./test/integration/setup.ts"],
    },
  };
});
