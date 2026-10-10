import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  outputDir: "./test-results",
  reporter: "list",
  webServer: { command: "pnpm dev:admin", url: process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:8791", reuseExistingServer: !process.env.CI, timeout: 120000, env: { PORT: String(Number(new URL(process.env.E2E_BASE_URL ?? "http://127.0.0.1:8788").port) || 8788) } },
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:8788", trace: "retain-on-failure" },
  projects: [
    { name: "phone", use: { browserName: "chromium", viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true } },
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 1000 } } },
  ],
});

