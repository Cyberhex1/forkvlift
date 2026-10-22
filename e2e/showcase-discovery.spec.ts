import { expect, test } from "playwright/test";
import type { Report, ShowcaseCard } from "@forkvlift/shared";

test("home rail, weekly pick, profile tab and catalog/resource credits", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fixture = await (await page.request.get("/api/showcases")).json() as { items: ShowcaseCard[]; nextCursor: null };
  await page.route(/\/api\/showcases(?:\?|$)/, r => r.fulfill({ json: { ...fixture, items: fixture.items.map(s => ({ ...s, staffPick: true })) } }));
  await page.goto("/"); await expect(page.getByRole("region", { name: "Showcases", exact: true })).toBeVisible(); await expect(page.getByRole("region", { name: "Showcase of the week", exact: true }).getByRole("heading", { name: "Fixture: Pocket Chef" })).toBeVisible();
  await page.getByRole("region", { name: "Showcases", exact: true }).screenshot({ path: `docs/handoffs/screenshots/5.6-${info.project.name}-home-rail.png` });
  await page.goto("/u/fx-ada"); await page.getByRole("tab", { name: "Showcases", exact: true }).press("Enter"); await expect(page.getByRole("region", { name: "Published showcases" })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/5.6-${info.project.name}-profile.png` });
  await page.goto("/p/fixture-pixel-planner"); await expect(page.getByRole("region", { name: "Showcases built with this" })).toBeVisible();
  const resources = await (await page.request.get("/api/resources")).json();
  await page.goto(`/resources/${resources.items[0].slug}`); await expect(page.getByRole("region", { name: "Showcases built with this" })).toBeVisible();
  await page.getByRole("region", { name: "Showcases built with this" }).screenshot({ path: `docs/handoffs/screenshots/5.6-${info.project.name}-resource.png` });
  await page.request.get("/api/dev/login?as=fx-ada"); await page.goto("/studio"); await page.getByRole("button", { name: "Add card", exact: true }).first().click();
  await page.getByRole("dialog").getByLabel("Card title", { exact: true }).fill("A helper for planning dinner tonight");
  await expect(page.getByRole("region", { name: "Similar showcases" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Similar showcases" }).getByRole("button", { name: /clone|fork/i })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("showcase strip loading, empty and error recovery", async ({ page }, info) => {
  let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  await page.route("**/api/users/fx-ada/showcases*", async r => { await gate; await r.fulfill({ json: { items: [], nextCursor: null } }); });
  await page.goto("/u/fx-ada"); await page.getByRole("tab", { name: "Showcases", exact: true }).click(); await expect(page.getByText("Loading published showcases", { exact: true })).toBeAttached(); release();
  await expect(page.getByText("No showcases yet", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/5.6-${info.project.name}-empty.png` });
  await page.unroute("**/api/users/fx-ada/showcases*"); await page.route("**/api/users/fx-ada/showcases*", r => r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Failed" } } })); await page.reload(); await page.getByRole("tab", { name: "Showcases", exact: true }).click();
  await expect(page.getByText("Couldn't load published showcases", { exact: true })).toBeVisible(); await page.unroute("**/api/users/fx-ada/showcases*"); await page.getByRole("button", { name: "Retry showcases" }).click(); await expect(page.getByRole("heading", { name: "Fixture: Pocket Chef" })).toBeVisible();
});

test.describe("admin showcases", () => {
  test.use({ baseURL: process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:8791" });
  test("staff-pick toggle, permission failure and showcase report resolution", async ({ page }, info) => {
    await page.request.get("/api/dev/login?as=fx-admin"); await page.goto("/showcases");
    const button = page.getByRole("button", { name: "Staff pick Fixture: Pocket Chef", exact: true }); await button.click(); await expect(button).toHaveAttribute("aria-pressed", "true");
    await button.click(); await expect(button).toHaveAttribute("aria-pressed", "false");
    await page.screenshot({ path: `docs/handoffs/screenshots/5.6-${info.project.name}-admin-picks.png` });
    await page.route("**/api/admin/showcases/*/staff-pick", r => r.fulfill({ status: 403, json: { error: { code: "forbidden", message: "Admins only" } } })); await button.click(); await expect(page.getByRole("alert")).toContainText("Admins only");
    const reports = await (await page.request.get("/api/admin/reports")).json() as { items: Report[]; nextCursor: null };
    await page.route("**/api/admin/reports?*", r => r.fulfill({ json: { ...reports, items: ["showcase", "showcase_comment"].map((type, i) => ({ ...reports.items[0], id: `showcase-report-${i}`, targetType: type, targetLabel: `Reported showcase ${i}`, targetHref: "/showcase/fixture-pocket-chef", note: "N".repeat(500) })) } }));
    await page.goto("/moderation"); await expect(page.getByText("showcase comment", { exact: true })).toBeVisible(); await page.getByRole("button", { name: "Review", exact: true }).first().click();
    const dialog = page.getByRole("dialog", { name: "Resolve report" }); await dialog.getByRole("radio", { name: /^Hide it/ }).check();
    const resolved = page.waitForRequest(r => r.method() === "POST" && r.url().includes("/resolve"));
    await page.route("**/api/admin/reports/showcase-report-0/resolve", r => r.fulfill({ json: { ...reports.items[0], status: "resolved" } }));
    await dialog.getByRole("button", { name: "Resolve", exact: true }).click(); expect((await resolved).postDataJSON()).toMatchObject({ outcome: "resolved", action: "hide" });
    await expect(dialog).toHaveCount(0); await page.getByRole("button", { name: "Review", exact: true }).last().click();
    await page.route("**/api/admin/reports/showcase-report-1/resolve", r => r.fulfill({ json: { ...reports.items[0], status: "resolved" } })); await dialog.getByRole("button", { name: "Dismiss", exact: true }).click(); await expect(dialog).toHaveCount(0);
    await page.screenshot({ path: `docs/handoffs/screenshots/5.6-${info.project.name}-reports.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});


