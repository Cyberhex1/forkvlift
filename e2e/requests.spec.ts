import { expect, test } from "playwright/test";
import type { BuildRequest, ProjectDetail } from "@forkvlift/shared";

test("browse, sign-in gate, claim loading/error/retry and claimed state", async ({ page }, info) => {
  await page.goto("/requests");
  await expect(page.getByRole("link", { name: "Sign in to post" })).toBeVisible();
  await page.getByRole("link", { name: "Fixture request: free Figma-lite" }).press("Enter");
  await expect(page.getByRole("link", { name: "Sign in to claim" })).toBeVisible();
  await page.request.get("/api/dev/login?as=fx-ada");
  await page.reload();
  let release!: () => void; let fail = true;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/requests/fx_req_1/claim", async route => {
    if (fail) { await gate; await route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Try claiming again." } } }); }
    else await route.continue();
  });
  const claim = page.getByRole("button", { name: "Claim this request" });
  await claim.click(); await expect(claim).toBeDisabled();
  await page.screenshot({ path: `docs/handoffs/screenshots/4.5-${info.project.name}-claim-loading.png` });
  release(); await expect(page.getByRole("alert")).toContainText("Try claiming again.");
  await page.screenshot({ path: `docs/handoffs/screenshots/4.5-${info.project.name}-claim-error.png` });
  fail = false; await claim.click(); await expect(page.getByText("You're building this.", { exact: true })).toBeVisible();
  await expect(claim).toHaveCount(0);
  await page.screenshot({ path: `docs/handoffs/screenshots/4.5-${info.project.name}-claimed.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const fixture = await (await page.request.get("/api/requests/fx_req_1")).json() as BuildRequest;
  const project = await (await page.request.get("/api/projects/fixture-pixel-planner")).json() as ProjectDetail;
  await page.route("**/api/requests/fx_req_1", route => route.fulfill({ json: { ...fixture, status: "built", bodyMd: "", builtProject: { id: project.id, slug: project.slug, name: project.name.repeat(4).slice(0, 100), author: project.author } } }));
  await page.reload();
  await expect(page.getByText("No details provided yet.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /See the finished project/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `docs/handoffs/screenshots/4.5-${info.project.name}-built.png` });
});

test("post with text bounty, retain input on error, then show submitted details", async ({ page }, info) => {
  await page.request.get("/api/dev/login?as=fx-ada");
  await page.route("**/api/config", async route => { const response = await route.fetch(); await route.fulfill({ json: { ...await response.json(), turnstileSiteKey: null } }); });
  let fail = true; let created: BuildRequest;
  await page.route(/\/api\/requests$/, async route => {
    if (route.request().method() !== "POST") return route.continue();
    if (fail) return route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Posting is temporarily unavailable." } } });
    const response = await route.fetch(); created = await response.json() as BuildRequest;
    await route.fulfill({ response });
  });
  await page.route("**/api/requests/fx_req_new", route => route.fulfill({ json: created }));
  await page.goto("/requests");
  await page.getByRole("button", { name: "Post a request" }).click();
  const dialog = page.getByRole("dialog", { name: "Post a request" });
  await dialog.getByLabel("Title", { exact: true }).fill("Free design tool for my team");
  await dialog.getByLabel("What should it do?").fill("Portable files and keyboard shortcuts. <script>alert(1)</script>");
  await dialog.getByLabel("Replaces (optional)").fill("Figma");
  await dialog.getByLabel("Bounty (optional, text only)").fill("A thank-you donation arranged directly.");
  await dialog.getByRole("button", { name: "Post request", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("temporarily unavailable");
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue("Free design tool for my team");
  await page.screenshot({ path: `docs/handoffs/screenshots/4.5-${info.project.name}-post-error.png` });
  fail = false;
  const posted = page.waitForRequest(r => r.method() === "POST" && new URL(r.url()).pathname === "/api/requests");
  await dialog.getByRole("button", { name: "Post request", exact: true }).click();
  expect((await posted).postDataJSON().bodyMd).toContain("## Bounty (off-site)\n\nA thank-you donation");
  await expect(page).toHaveURL(/\/requests\/fx_req_new$/);
  await expect(page.getByRole("heading", { name: "Free design tool for my team" })).toBeVisible();
  await expect(page.getByText("Another builder can claim your request.")).toBeVisible();
  await expect(page.locator("main script")).toHaveCount(0);
  await page.screenshot({ path: `docs/handoffs/screenshots/4.5-${info.project.name}-posted.png` });
});

test("board loading, empty, retry, pagination, status and detail failures", async ({ page }, info) => {
  const fixture = await (await page.request.get("/api/requests")).json() as { items: BuildRequest[]; nextCursor: null };
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(/\/api\/requests(?:\?|$)/, async route => { await gate; await route.fulfill({ json: { items: [], nextCursor: null } }); });
  await page.goto("/requests"); await expect(page.getByText("Loading requests", { exact: true })).toBeAttached();
  await page.screenshot({ path: `docs/handoffs/screenshots/4.5-${info.project.name}-loading.png` });
  release(); await expect(page.getByText("No requests to show", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/4.5-${info.project.name}-empty.png` });
  await page.unrouteAll({ behavior: "wait" });
  await page.route(/\/api\/requests(?:\?|$)/, route => route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "QA outage" } } }));
  await page.reload(); await expect(page.getByText("Couldn't load requests", { exact: true })).toBeVisible();
  await page.unrouteAll({ behavior: "wait" });
  let nextFailed = true;
  await page.route(/\/api\/requests(?:\?|$)/, route => {
    if (new URL(route.request().url()).searchParams.has("cursor")) return nextFailed ? route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "QA outage" } } }) : route.fulfill({ json: { items: [], nextCursor: null } });
    return route.fulfill({ json: { ...fixture, nextCursor: "fixture-next" } });
  });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("link", { name: "Fixture request: free Figma-lite" })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/4.5-${info.project.name}-board.png` });
  await page.getByRole("button", { name: "Load more requests" }).click();
  await expect(page.getByRole("alert")).toContainText("current results are still here");
  await expect(page.getByRole("link", { name: "Fixture request: free Figma-lite" })).toBeVisible();
  nextFailed = false; await page.getByRole("button", { name: "Retry loading more" }).click();
  await expect(page.getByRole("button", { name: "Load more requests" })).toHaveCount(0);
  await page.getByLabel("Request status").selectOption("built");
  await expect(page).toHaveURL(/status=built/); await expect(page.getByText("No requests to show", { exact: true })).toBeVisible();
  await page.goto("/requests?status=invalid"); await expect(page.getByText("Invalid request filter", { exact: true })).toBeVisible();
  await page.unrouteAll({ behavior: "wait" });
  await page.route("**/api/requests/missing", route => route.fulfill({ status: 404, json: { error: { code: "not_found", message: "Missing" } } }));
  await page.goto("/requests/missing"); await expect(page.getByText("Request not found", { exact: true })).toBeVisible();
});

test("verification loading, expiry, failure and setup retry gate submission", async ({ page }) => {
  await page.request.get("/api/dev/login?as=fx-ada");
  await page.addInitScript(() => {
    const state = window as unknown as { turnstile: unknown; requestVerification: Record<string, (...args: string[]) => void> };
    state.turnstile = { render: (_element: HTMLElement, options: Record<string, (...args: string[]) => void>) => { state.requestVerification = options; return "test-widget"; }, remove: () => undefined };
  });
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); let fail = true;
  await page.route("**/api/config", async route => { await gate; if (fail) return route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "QA outage" } } }); const response = await route.fetch(); await route.fulfill({ json: { ...await response.json(), turnstileSiteKey: "test-key" } }); });
  await page.goto("/requests"); await page.getByRole("button", { name: "Post a request" }).click();
  const dialog = page.getByRole("dialog", { name: "Post a request" }); const submit = dialog.getByRole("button", { name: "Post request", exact: true });
  await expect(dialog.getByText("Loading verification", { exact: true })).toBeAttached(); await expect(submit).toBeDisabled();
  release(); await expect(dialog.getByText("Couldn't load verification", { exact: true })).toBeVisible();
  fail = false; await dialog.getByRole("button", { name: "Retry verification setup" }).click();
  await expect(dialog.getByLabel("Submission verification")).toBeAttached();
  await dialog.getByLabel("Title", { exact: true }).fill("Free design tool");
  await page.evaluate(() => (window as unknown as { requestVerification: { callback: (token: string) => void } }).requestVerification.callback("test-token"));
  await expect(submit).toBeEnabled();
  await page.evaluate(() => (window as unknown as { requestVerification: Record<string, () => void> }).requestVerification["expired-callback"]());
  await expect(submit).toBeDisabled(); await expect(dialog.getByRole("alert")).toContainText("Verification expired");
  await dialog.getByRole("button", { name: "Retry verification" }).click();
  await page.evaluate(() => (window as unknown as { requestVerification: { callback: (token: string) => void } }).requestVerification.callback("fresh-token"));
  await page.route(/\/api\/requests$/, route => route.request().method() === "POST" ? route.fulfill({ status: 403, json: { error: { code: "turnstile_failed", message: "Bot check failed. Please try again." } } }) : route.continue());
  await submit.click(); await expect(dialog.getByRole("alert")).toContainText("Bot check failed"); await expect(submit).toBeDisabled();
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue("Free design tool");
});
