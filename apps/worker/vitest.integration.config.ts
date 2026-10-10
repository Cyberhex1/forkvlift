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
        miniflare: { bindings: { TEST_MIGRATIONS: migrations, ENVIRONMENT: "local" } },
      }),
    ],
    test: {
      include: ["test/integration/**/*.test.ts"],
      setupFiles: ["./test/integration/setup.ts"],
    },
  };
});
