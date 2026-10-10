import { expect, test, type Page } from "playwright/test";
const adminURL = process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:8791";
test.use({ baseURL: adminURL });

async function licensedCandidate(page: Page) {
  const candidate = (await (await page.request.get("/api/admin/candidates")).json()).items[0];
  const project = await (await page.request.get("/api/projects/fixture-pixel-planner")).json();
  return { ...candidate, license: project.license, checks: candidate.checks.map((check: { key: string }) => check.key === "license" ? { ...check, pass: true, detail: null } : check) };
}

test("access denied, authenticated queue, unlicensed restrictions and live card edits", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByText("Administrator access required", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.12-${info.project.name}-access.png` });
  await page.goto("/api/dev/login?as=fx-admin"); await page.goto("/");
  await expect(page.getByTestId("candidate")).toHaveCount(1);
  await page.screenshot({ path: `docs/handoffs/screenshots/1.12-${info.project.name}-queue.png` });
  await page.getByRole("checkbox", { name: "Select all loaded candidates" }).check();
  await expect(page.getByRole("button", { name: "Publish selected", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Review Fixture Candidate", exact: true }).press("Enter");
  const dialog = page.getByRole("dialog", { name: "Review Fixture Candidate" });
  await expect(dialog.getByRole("button", { name: "Approve and publish" })).toBeDisabled();
  await expect(dialog.getByText("No committed secrets: Not run", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("note")).toContainText("No license: all rights reserved.");
  await page.screenshot({ path: `docs/handoffs/screenshots/1.12-${info.project.name}-unlicensed.png` });
  await dialog.getByLabel("Proposed name", { exact: true }).fill("Edited candidate");
  await dialog.getByLabel("Proposed tagline", { exact: true }).fill("Edited proposed card");
  await expect(dialog.getByRole("heading", { name: "Edited candidate", exact: true })).toBeVisible();
  await dialog.getByLabel("Decision reason (optional)").fill("No license");
  const decision = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/decision"));
  await dialog.getByRole("button", { name: "Reject candidate" }).click();
  expect((await decision).postDataJSON()).toMatchObject({ action: "reject", reason: "No license", edits: { name: "Edited candidate", tagline: "Edited proposed card" } });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("status", { name: "Review feedback" })).toContainText("rejected");
  await expect(page.getByText("No candidates in this queue", { exact: true })).toBeVisible();
});

test("licensed approval, draft, missing category, snooze and decision error retry", async ({ page }, info) => {
  await page.goto("/api/dev/login?as=fx-admin");
  const candidate = await licensedCandidate(page);
  await page.route("**/api/admin/candidates?**", (route) => route.fulfill({ json: { items: [candidate], nextCursor: null } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Review Fixture Candidate", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Review Fixture Candidate" });
  await dialog.getByLabel("Proposed category", { exact: true }).selectOption("");
  await expect(dialog.getByRole("button", { name: "Approve and publish" })).toBeDisabled();
  await dialog.getByLabel("Proposed category", { exact: true }).selectOption("productivity");
  await dialog.getByLabel("Thumbnail URL", { exact: true }).fill("https://example.invalid/missing.png");
  await expect(dialog.getByRole("region", { name: "Proposed card preview" }).getByText("No preview available", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.12-${info.project.name}-licensed.png` });
  await page.route("**/api/admin/candidates/*/decision", (route) => route.fulfill({ status: 503, json: { error: { code: "internal", message: "Decision unavailable" } } }));
  await dialog.getByRole("button", { name: "Approve and publish" }).click();
  await expect(dialog.getByText("Decision unavailable", { exact: true })).toBeVisible();
  await page.unroute("**/api/admin/candidates/*/decision");
  await dialog.getByRole("button", { name: "Approve and publish" }).click();
  await expect(page.getByRole("status", { name: "Review feedback" })).toContainText("published");
  await page.getByRole("button", { name: "Refresh queue" }).click();
  await page.getByRole("button", { name: "Review Fixture Candidate", exact: true }).click();
  await dialog.getByRole("button", { name: "Approve as draft" }).click();
  await expect(page.getByRole("status", { name: "Review feedback" })).toContainText("draft");
  await page.getByRole("button", { name: "Refresh queue" }).click();
  await page.getByRole("button", { name: "Review Fixture Candidate", exact: true }).click();
  await dialog.getByLabel("Snooze days", { exact: true }).fill("14");
  const decision = page.waitForRequest((request) => request.method() === "POST" && request.url().endsWith("/decision"));
  await dialog.getByRole("button", { name: "Snooze candidate" }).click();
  expect((await decision).postDataJSON()).toMatchObject({ action: "snooze", snoozeDays: 14 });
  await expect(page.getByRole("status", { name: "Review feedback" })).toContainText("snoozed");
});

test("bulk counts preserve skipped meaning, filters, pagination and importer", async ({ page }) => {
  await page.goto("/api/dev/login?as=fx-admin");
  const candidate = await licensedCandidate(page);
  await page.route("**/api/admin/candidates?**", (route) => route.fulfill({ json: { items: [candidate], nextCursor: new URL(route.request().url()).searchParams.has("cursor") ? null : "test-next" } }));
  await page.goto("/");
  await page.getByLabel("Queue sort", { exact: true }).selectOption("stars");
  await expect(page).toHaveURL(/sort=stars/);
  await page.getByLabel("Queue status", { exact: true }).selectOption("draft");
  await expect(page).toHaveURL(/status=draft/);
  await page.getByRole("button", { name: "Load more candidates" }).click();
  await expect(page.getByRole("button", { name: "Load more candidates" })).toHaveCount(0);
  await expect(page.getByTestId("candidate")).toHaveCount(1);
  await page.getByRole("checkbox", { name: "Select all loaded candidates" }).check();
  await page.route("**/api/admin/candidates/bulk", (route) => route.fulfill({ json: { updated: 0 } }));
  await page.getByRole("button", { name: "Publish selected", exact: true }).click();
  await expect(page.getByRole("status", { name: "Review feedback" })).toContainText("0 of 1 selected candidates updated. 1 skipped");
  await page.getByRole("button", { name: "Import repository", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Import repository" });
  await dialog.getByLabel("GitHub repository URL").fill("https://github.com/example/test-repo");
  await dialog.getByLabel("Found via URL (optional credit)").fill("https://www.reddit.com/r/test/comments/test");
  await page.route("**/api/admin/candidates", (route) => route.fulfill({ status: 503, json: { error: { code: "internal", message: "Import unavailable" } } }));
  await dialog.getByRole("button", { name: "Import for review" }).click();
  await expect(dialog.getByText("Import unavailable", { exact: true })).toBeVisible();
  await page.unroute("**/api/admin/candidates");
  const imported = page.waitForRequest((request) => request.method() === "POST" && new URL(request.url()).pathname === "/api/admin/candidates");
  await dialog.getByRole("button", { name: "Import for review" }).click();
  expect((await imported).postDataJSON()).toMatchObject({ repoUrl: "https://github.com/example/test-repo", foundViaUrl: "https://www.reddit.com/r/test/comments/test" });
  await expect(page.getByRole("dialog", { name: "Review Fixture Candidate" })).toBeVisible();
});

test("loading, empty, API failure, retry and no viewport overflow", async ({ page }, info) => {
  await page.goto("/api/dev/login?as=fx-admin");
  let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/admin/candidates?**", async (route) => { await gate; await route.fulfill({ json: { items: [], nextCursor: null } }); });
  await page.goto("/");
  await expect(page.getByText("Loading review queue", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.12-${info.project.name}-loading.png` });
  release();
  await expect(page.getByText("No candidates in this queue", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.12-${info.project.name}-empty.png` });
  await page.unrouteAll({ behavior: "wait" });
  await page.route("**/api/admin/candidates?**", (route) => route.fulfill({ status: 503, json: { error: { code: "internal", message: "Queue unavailable" } } }));
  await page.reload();
  await expect(page.getByText("Couldn't load review queue", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.12-${info.project.name}-error.png` });
  await page.unrouteAll({ behavior: "wait" });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("candidate")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});



test("account motion preference and expired admin authorization hide cached queue", async ({ page }) => {
  await page.goto("/api/dev/login?as=fx-admin");
  await page.route("**/api/auth/me", async (route) => { const response = await route.fetch(); const data = await response.json(); data.user.settings.reducedMotion = "on"; await route.fulfill({ json: data }); });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.getByTestId("candidate")).toHaveCount(1);
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduce");
  await page.route("**/api/admin/candidates?**", (route) => route.fulfill({ status: 403, json: { error: { code: "forbidden", message: "Admin access expired" } } }));
  await page.getByRole("button", { name: "Refresh queue" }).click();
  await expect(page.getByText("Administrator access required", { exact: true })).toBeVisible();
  await expect(page.getByTestId("candidate")).toHaveCount(0);
});
