import { expect, test } from "playwright/test";

test.use({ baseURL: process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:8791" });

test("open reports, resolve with hide, dismiss, ban form and chat slow mode", async ({ page }, info) => {
  await page.request.get("/api/dev/login?as=fx-admin");
  await page.goto("/moderation");
  await expect(page.getByRole("heading", { name: "Moderation", exact: true })).toBeVisible();
  await expect(page.getByText("Fixture report", { exact: false })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/3.10-${info.project.name}-queue.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.getByRole("button", { name: "Review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Resolve report" });
  await dialog.getByRole("radio", { name: /^Hide it/ }).check();
  await dialog.getByLabel("Note for the audit log").fill("Hide reported spam");
  await page.screenshot({ path: `docs/handoffs/screenshots/3.10-${info.project.name}-hide.png` });
  const resolve = page.waitForRequest((r) => r.url().endsWith("/fx_rep_1/resolve") && r.method() === "POST");
  await dialog.getByRole("button", { name: "Resolve", exact: true }).click();
  expect((await resolve).postDataJSON()).toEqual({ outcome: "resolved", action: "hide", note: "Hide reported spam" });
  await expect(dialog).toHaveCount(0);
  // Fixtures are stateless: refetch returns the report again for the dismiss flow.
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await dialog.getByRole("radio", { name: /^Hide it/ }).check();
  const dismiss = page.waitForRequest((r) => r.url().endsWith("/fx_rep_1/resolve") && r.method() === "POST");
  await dialog.getByRole("button", { name: "Dismiss", exact: true }).click();
  expect((await dismiss).postDataJSON()).toMatchObject({ outcome: "dismissed", action: "none" });
  await expect(dialog).toHaveCount(0);
  await page.getByLabel("Username", { exact: true }).fill("@");
  await expect(page.getByRole("button", { name: "Ban", exact: true })).toBeDisabled();
  await page.getByLabel("Username", { exact: true }).fill("@fx-bo");
  await page.getByLabel("Reason", { exact: true }).fill("Fixture moderation QA");
  const banned = page.waitForRequest((r) => r.url().endsWith("/fx-bo/ban") && r.method() === "POST");
  await page.getByRole("button", { name: "Ban", exact: true }).click();
  expect((await banned).postDataJSON()).toEqual({ banned: true, reason: "Fixture moderation QA" });
  await expect(page.getByRole("status").filter({ hasText: "Banned @fx-bo." })).toBeVisible();
  await page.getByRole("button", { name: "Unban", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Unbanned @fx-bo." })).toBeVisible();
  await page.getByLabel("Room", { exact: true }).selectOption("help");
  const seconds = page.getByLabel("Slow mode (seconds)");
  for (const invalid of ["-1", "3601", "1.5", ""]) {
    await seconds.fill(invalid);
    await expect(page.getByRole("button", { name: "Set", exact: true })).toBeDisabled();
  }
  await seconds.fill("30");
  const slow = page.waitForRequest((r) => r.url().endsWith("/api/admin/chat/help") && r.method() === "POST");
  await page.getByRole("button", { name: "Set", exact: true }).click();
  expect((await slow).postDataJSON()).toEqual({ action: "slow", seconds: 30 });
  // The fixture always returns slowModeSeconds=0; assert returned state, not persistence.
  await expect(page.getByRole("status").filter({ hasText: "#help: slow done. Slow mode is off." })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/3.10-${info.project.name}-controls.png`, fullPage: true });
  const off = page.waitForRequest((r) => r.url().endsWith("/api/admin/chat/help") && r.method() === "POST");
  await page.getByRole("button", { name: "Off", exact: true }).click();
  expect((await off).postDataJSON()).toEqual({ action: "slow", seconds: 0 });
});

test("loading, empty, retry and authorization loss hide moderation controls", async ({ page }, info) => {
  await page.request.get("/api/dev/login?as=fx-admin");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/admin/reports?**", async (route) => { await gate; await route.fulfill({ json: { items: [], nextCursor: null } }); });
  await page.goto("/moderation");
  await expect(page.getByText("Loading reports", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/3.10-${info.project.name}-loading.png` });
  release();
  await expect(page.getByText("Queue is clear", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/3.10-${info.project.name}-empty.png` });
  await page.unrouteAll({ behavior: "wait" });
  await page.route("**/api/admin/reports?**", (route) => route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Queue unavailable" } } }));
  await page.reload();
  await expect(page.getByText("Couldn't load reports", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/3.10-${info.project.name}-error.png` });
  await page.unrouteAll({ behavior: "wait" });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Review", exact: true })).toBeVisible();
  await page.route("**/api/admin/reports?**", (route) => route.fulfill({ status: 403, json: { error: { code: "forbidden", message: "Access expired" } } }));
  await page.getByRole("button", { name: "Resolved", exact: true }).click();
  await expect(page.getByText("Admins only", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Chat rooms" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Ban or unban" })).toHaveCount(0);
});

test("pending actions cannot race and failed resolve can retry", async ({ page }) => {
  await page.request.get("/api/dev/login?as=fx-admin");
  await page.goto("/moderation");
  await page.getByRole("button", { name: "Review", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Resolve report" });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/admin/reports/*/resolve", async (route) => { await gate; await route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Resolve unavailable" } } }); });
  await dialog.getByRole("button", { name: "Resolve", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Dismiss", exact: true })).toBeDisabled();
  await expect(dialog.getByRole("radio", { name: /^Hide it/ })).toBeDisabled();
  release();
  await expect(dialog.getByRole("alert")).toHaveText("Resolve unavailable");
  await page.unrouteAll({ behavior: "wait" });
  await dialog.getByRole("button", { name: "Resolve", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.route("**/api/admin/chat/*", (route) => route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Chat unavailable" } } }));
  await page.getByRole("button", { name: "Set", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Chat unavailable" })).toBeVisible();
});
