import { expect, test } from "playwright/test";
import type { GrowthEventDetail, ShowcaseCard } from "@forkvlift/shared";

test.beforeEach(async ({ page }) => { const config = await (await page.request.get("/api/config")).json(); await page.route("**/api/config", r => r.fulfill({ json: { ...config, turnstileSiteKey: null } })); });

test("event browsing, filters, project submit/withdraw and ballot", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/events"); await page.getByLabel("Event type", { exact: true }).selectOption("fork_friday"); await expect(page).toHaveURL(/kind=fork_friday/);
  await page.getByRole("link", { name: "Fixture build jam: tiny tools", exact: true }).click(); await expect(page.getByRole("link", { name: "Sign in to enter" })).toBeVisible();
  await page.request.get("/api/dev/login?as=fx-ada"); await page.reload(); await page.getByLabel("Pick one of your projects").selectOption({ label: "Fixture: Plant Pal" });
  let fail = true; await page.route("**/api/events/fixture-build-jam/entries", r => r.request().method() === "POST" && fail ? r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Entry unavailable" } } }) : r.continue());
  await page.getByRole("button", { name: "Submit entry" }).click(); await expect(page.getByRole("alert")).toContainText("Entry unavailable"); fail = false;
  await page.getByRole("button", { name: "Submit entry" }).click(); await expect(page.getByRole("status").filter({ hasText: "Entry submitted." })).toBeVisible(); await page.getByRole("button", { name: "Withdraw entry" }).click(); await expect(page.getByText("No entries yet", { exact: true })).toBeVisible();
  const event = await (await page.request.get("/api/events/fixture-build-jam")).json() as GrowthEventDetail;
  await page.route("**/api/events/fixture-build-jam", r => r.fulfill({ json: { ...event, status: "voting", viewerCanSubmit: false, viewerCanVote: true } }));
  await page.request.get("/api/dev/login?as=fx-admin"); await page.reload(); await page.getByRole("button", { name: "Vote for entry" }).click(); await expect(page.getByRole("button", { name: "Remove vote" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Remove vote" }).click(); await expect(page.getByRole("button", { name: "Vote for entry" })).toHaveAttribute("aria-pressed", "false");
  await page.screenshot({ path: `docs/handoffs/screenshots/4.6-${info.project.name}-leaderboard.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("show-off uses published showcases and shared event voting", async ({ page }, info) => {
  await page.request.get("/api/dev/login?as=fx-ada");
  const event = await (await page.request.get("/api/events/fixture-build-jam")).json() as GrowthEventDetail;
  const shows = await (await page.request.get("/api/showcases")).json() as { items: ShowcaseCard[]; nextCursor: null };
  await page.route("**/api/events/show-off", r => r.fulfill({ json: { ...event, slug: "show-off", kind: "show_off", title: "Show-off Saturday" } }));
  await page.route("**/api/me/showcases*", r => r.fulfill({ json: shows }));
  await page.goto("/events/show-off"); await expect(page.getByLabel("Pick one of your showcases")).toBeVisible();
  await page.getByLabel("Pick one of your showcases").selectOption({ label: "Fixture: Neon Drift" });
  const submitted = page.waitForRequest(r => r.method() === "POST" && r.url().includes("/showcase-entries")); await page.getByRole("button", { name: "Submit entry" }).click(); expect((await submitted).postDataJSON().showcaseId).toBe(shows.items[1]!.id);
  await expect(page.getByRole("status").filter({ hasText: "Entry submitted." })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/4.6-${info.project.name}-show-off.png` });
  await page.getByRole("button", { name: "Withdraw entry" }).click(); await expect(page.getByText("No entries yet", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /clone|fork this/i })).toHaveCount(0);
  await page.unroute("**/api/events/show-off");
  await page.route("**/api/events/show-off", r => r.fulfill({ json: { ...event, slug: "show-off", kind: "show_off", status: "voting", viewerCanSubmit: false, viewerCanVote: true } }));
  await page.request.get("/api/dev/login?as=fx-admin"); await page.reload();
  const ballot = page.waitForRequest(r => r.method() === "PUT" && r.url().endsWith("/api/events/show-off/ballot"));
  await page.getByRole("button", { name: "Vote for entry" }).click(); expect((await ballot).postDataJSON()).toEqual({ entryId: "fx_sentry_1" });
  await expect(page.getByRole("button", { name: "Remove vote" })).toBeVisible();
});

test("events loading, empty, error and detail recovery", async ({ page }, info) => {
  let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  await page.route(/\/api\/events(?:\?|$)/, async r => { await gate; await r.fulfill({ json: { items: [], nextCursor: null } }); });
  await page.goto("/events"); await expect(page.getByText("Loading events", { exact: true })).toBeAttached(); release(); await expect(page.getByText("No events scheduled", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/4.6-${info.project.name}-empty.png` });
  await page.unroute(/\/api\/events(?:\?|$)/); await page.route(/\/api\/events(?:\?|$)/, r => r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Failed" } } })); await page.reload(); await expect(page.getByText("Couldn't load events", { exact: true })).toBeVisible();
  await page.unroute(/\/api\/events(?:\?|$)/); await page.getByRole("button", { name: "Try again" }).click(); await expect(page.getByRole("link", { name: "Fixture build jam: tiny tools" })).toBeVisible();
  await page.goto("/events?kind=invalid"); await expect(page.getByText("Invalid event filters", { exact: true })).toBeVisible();
});

test("detail and entry failures, ended state and long text", async ({ page }, info) => {
  const fixture = await (await page.request.get("/api/events/fixture-build-jam")).json() as GrowthEventDetail;
  let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  await page.route("**/api/events/fixture-build-jam", async r => { await gate; await r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Failed" } } }); });
  await page.goto("/events/fixture-build-jam"); await expect(page.getByText("Loading event", { exact: true })).toBeAttached(); release(); await expect(page.getByText("Couldn't load event", { exact: true })).toBeVisible();
  await page.unroute("**/api/events/fixture-build-jam"); await page.route("**/api/events/fixture-build-jam", r => r.fulfill({ json: { ...fixture, title: "E".repeat(120), bodyMd: "A long event story. ".repeat(100), status: "ended", viewerCanSubmit: false, viewerCanVote: false } }));
  await page.route("**/api/events/fixture-build-jam/entries*", r => r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Failed" } } }));
  await page.getByRole("button", { name: "Try again", exact: true }).click(); await expect(page.getByText("Couldn't load entries", { exact: true })).toBeVisible();
  await page.unroute("**/api/events/fixture-build-jam/entries*"); await page.route("**/api/events/fixture-build-jam/entries*", r => r.fulfill({ json: { items: [], nextCursor: null } })); await page.getByRole("button", { name: "Retry entries" }).click(); await expect(page.getByText("No entries yet", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit entry" })).toHaveCount(0); await expect(page.getByRole("button", { name: "Vote for entry" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `docs/handoffs/screenshots/4.6-${info.project.name}-ended-long.png` });
});

test.describe("event admin", () => {
  test.use({ baseURL: process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:8791" });
  test("schedule show-off, edit wording/deadlines, permission error and cancel", async ({ page }, info) => {
    await page.request.get("/api/dev/login?as=fx-admin"); await page.goto("/events"); await page.getByRole("button", { name: "Schedule event", exact: true }).click();
    await page.getByLabel("Event title").fill("Community show-off Saturday"); await page.getByLabel("Event slug").fill("community-show-off"); await page.getByLabel("Event kind").selectOption("show_off"); await page.getByLabel("Starts at").fill("2030-01-01T12:00"); await page.getByLabel("Submission deadline").fill("2030-01-02T12:00"); await page.getByLabel("Voting deadline").fill("2030-01-03T12:00");
    const created = page.waitForRequest(r => r.method() === "POST" && r.url().endsWith("/api/admin/events")); await page.getByRole("button", { name: "Create event", exact: true }).click(); expect((await created).postDataJSON()).toMatchObject({ kind: "show_off", featuredProjectId: null });
    await page.getByRole("button", { name: "Edit event", exact: true }).click(); await page.getByLabel("Event rules", { exact: true }).fill("R".repeat(5000));
    let fail = true; await page.route("**/api/admin/events/fx_evt_1", r => fail ? r.fulfill({ status: 403, json: { error: { code: "forbidden", message: "Admins only" } } }) : r.continue());
    await page.getByRole("button", { name: "Save event", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("Admins only");
    await page.screenshot({ path: `docs/handoffs/screenshots/4.6-${info.project.name}-schedule.png`, fullPage: true });
    fail = false; await page.getByRole("button", { name: "Save event", exact: true }).click(); await expect(page.getByRole("button", { name: "Save event", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Edit event", exact: true }).click(); const cancel = page.waitForRequest(r => r.method() === "PATCH" && r.url().includes("/api/admin/events/")); await page.getByRole("button", { name: "Cancel event", exact: true }).click(); expect((await cancel).postDataJSON()).toEqual({ cancelled: true });
  });
});

