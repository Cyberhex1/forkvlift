import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __FIXTURES__: "true" },
  test: { include: ["test/**/*.test.ts"] },
});
