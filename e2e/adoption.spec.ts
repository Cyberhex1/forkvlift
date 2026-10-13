import { expect, test } from "playwright/test";
import type { AdoptionRequest, ProjectAdoption } from "@forkvlift/shared";

const slug = "fixture-plant-pal";
test.beforeEach(async ({ page }) => { const config = await (await page.request.get("/api/config")).json(); await page.route("**/api/config", r => r.fulfill({ json: { ...config, turnstileSiteKey: null } })); });

test("signed-out gate, private application, retained errors and withdrawal", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto(`/p/${slug}`); await expect(page.getByRole("link", { name: "Sign in to request adoption" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Private adoption requests" })).toHaveCount(0);
  await page.request.get("/api/dev/login?as=fx-ada"); await page.reload();
  let fail = true;
  await page.route(`**/api/projects/${slug}/adoption/requests`, r => fail ? r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Application unavailable" } } }) : r.continue());
  await page.getByLabel("Why would you like to take this on?").fill("I can maintain the reminders and mobile layout.");
  await page.getByRole("button", { name: "Request adoption", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("Application unavailable");
  await expect(page.getByLabel("Why would you like to take this on?")).toHaveValue("I can maintain the reminders and mobile layout.");
  fail = false; await page.getByRole("button", { name: "Request adoption", exact: true }).click(); await expect(page.getByText("Your application is", { exact: false })).toContainText("pending");
  await page.screenshot({ path: `docs/handoffs/screenshots/4.12-${info.project.name}-applied.png` });
  await page.getByRole("button", { name: "Withdraw application" }).click(); await expect(page.getByText("Your application is", { exact: false })).toContainText("withdrawn");
  await page.request.get("/api/dev/login?as=fx-admin"); await page.reload(); await expect(page.getByRole("heading", { name: "Private adoption requests" })).toHaveCount(0);
});

test("maintainer open/close, private requests, decline and guarded approval", async ({ page }, info) => {
  await page.request.get("/api/dev/login?as=fx-ada");
  const adoption = await (await page.request.get(`/api/projects/${slug}/adoption`)).json() as ProjectAdoption;
  const requestPage = await (await page.request.get(`/api/projects/${slug}/adoption/requests`)).json() as { items: AdoptionRequest[]; nextCursor: null };
  const session = await (await page.request.get("/api/auth/me")).json();
  let current = { ...adoption, canManage: true, maintainer: session.user };
  await page.route(`**/api/projects/${slug}/adoption`, r => r.request().method() === "GET" ? r.fulfill({ json: current }) : (() => { const data = r.request().postDataJSON(); current = { ...current, ...data }; return r.fulfill({ json: current }); })());
  await page.route(`**/api/projects/${slug}/adoption/requests*`, r => r.fulfill({ json: { ...requestPage, items: requestPage.items.map(item => ({ ...item, requester: adoption.maintainer, message: "Long application ".repeat(100) })) } }));
  await page.goto(`/p/${slug}`); await page.getByLabel("Adoption note", { exact: true }).fill("Looking for a maintainer for mobile support."); await page.getByRole("button", { name: "Save adoption note" }).click();
  await page.getByRole("button", { name: "Close adoption" }).click(); await expect(page.getByRole("button", { name: "Open for adoption" })).toBeVisible(); await page.getByRole("button", { name: "Open for adoption" }).click();
  await page.getByRole("button", { name: "Decline request" }).click(); await page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true }).click();
  let fail = true;
  await page.route(`**/api/projects/${slug}/adoption/requests/*/decision`, r => { if (fail) return r.fulfill({ status: 409, json: { error: { code: "conflict", message: "Another decision won. Refresh the project." } } }); const request = { ...requestPage.items[0]!, requester: adoption.maintainer!, status: "approved", decidedAt: new Date().toISOString() }; current = { ...current, open: false, canManage: false, maintainer: request.requester }; return r.fulfill({ json: { request, adoption: current } }); });
  await page.getByRole("button", { name: "Review approval" }).click(); const dialog = page.getByRole("dialog", { name: "Approve new maintainer?" }); await expect(dialog).toContainText("GitHub access directly");
  await dialog.getByRole("button", { name: "Approve maintainer" }).click(); await expect(dialog.getByRole("alert")).toContainText("Another decision won");
  await page.screenshot({ path: `docs/handoffs/screenshots/4.12-${info.project.name}-approval-error.png` });
  fail = false; await dialog.getByRole("button", { name: "Approve maintainer" }).click(); await expect(dialog).toHaveCount(0); await expect(page.getByRole("button", { name: "Close adoption" })).toHaveCount(0);
  await expect(page.getByText("Originally built by", { exact: false })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/4.12-${info.project.name}-transferred.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("adoption loading/error/retry and closed state", async ({ page }, info) => {
  const adoption = await (await page.request.get(`/api/projects/${slug}/adoption`)).json() as ProjectAdoption;
  let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  await page.route(`**/api/projects/${slug}/adoption`, async r => { await gate; await r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Failed" } } }); });
  await page.goto(`/p/${slug}`); await expect(page.getByText("Loading adoption status", { exact: true })).toBeAttached(); release(); await expect(page.getByText("Couldn't load adoption status", { exact: true })).toBeVisible();
  await page.unroute(`**/api/projects/${slug}/adoption`); await page.route(`**/api/projects/${slug}/adoption`, r => r.fulfill({ json: { ...adoption, open: false } })); await page.getByRole("button", { name: "Retry adoption" }).click(); await expect(page.getByText("This project isn't accepting adoption requests.", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/4.12-${info.project.name}-closed.png` });
});

test("empty private requests and declining an application", async ({ page }) => {
  await page.request.get("/api/dev/login?as=fx-ada");
  const adoption = await (await page.request.get(`/api/projects/${slug}/adoption`)).json() as ProjectAdoption;
  const fixture = await (await page.request.get(`/api/projects/${slug}/adoption/requests`)).json() as { items: AdoptionRequest[]; nextCursor: null };
  await page.route(`**/api/projects/${slug}/adoption`, r => r.fulfill({ json: { ...adoption, canManage: true } }));
  await page.route(`**/api/projects/${slug}/adoption/requests*`, r => r.fulfill({ json: { items: [], nextCursor: null } }));
  await page.goto(`/p/${slug}`); await expect(page.getByText("No applications yet.")).toBeVisible();
  await page.unroute(`**/api/projects/${slug}/adoption/requests*`);
  await page.route(`**/api/projects/${slug}/adoption/requests`, r => r.fulfill({ json: fixture }));
  await page.reload(); await page.getByRole("button", { name: "Decline request", exact: true }).click();
  await page.route(`**/api/projects/${slug}/adoption/requests/*/decision`, r => r.fulfill({ json: { request: { ...fixture.items[0]!, status: "declined", decidedAt: new Date().toISOString() }, adoption: { ...adoption, canManage: true } } }));
  await page.getByRole("button", { name: "Confirm decline", exact: true }).click(); await expect(page.getByText("declined", { exact: true })).toBeVisible();
});

