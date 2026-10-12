import { expect, test } from "playwright/test";
import type { ShowcaseDetail } from "@forkvlift/shared";

test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: "wait" }); });
test.beforeEach(async ({ page }) => { await page.route("**/api/config", async r => { const response = await r.fetch(); await r.fulfill({ json: { ...await response.json(), turnstileSiteKey: null } }); }); });

test("draft creation, link checks, credits, preview and retained input on failure", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/showcase/new");
  await expect(page.getByRole("link", { name: "Sign in to create a showcase" })).toBeVisible();
  await page.request.get("/api/dev/login?as=fx-ada"); await page.reload();
  await page.getByLabel("Title", { exact: true }).fill("My dinner helper"); await page.getByLabel("Tagline", { exact: true }).fill("B".repeat(140));
  await page.getByLabel("Category", { exact: true }).selectOption("home-and-life");
  await page.getByLabel("How I built it", { exact: true }).fill("Built with **a reusable workflow**.");
  await page.getByRole("button", { name: "Add link", exact: true }).click(); await page.getByLabel("Link 1 URL", { exact: true }).fill("https://example.com/app");
  await page.getByLabel("Link 1 label", { exact: true }).fill("Try app"); await page.getByRole("button", { name: "Check links" }).click(); await expect(page.getByRole("alert")).toContainText("valid formats");
  await page.getByRole("button", { name: "Add Fixture: Dungeon Toaster", exact: true }).click();
  const resource = page.getByRole("region", { name: "Built with resources" }).getByRole("button", { name: /^Add / }).first(); await resource.click();
  await page.getByLabel("YouTube or Vimeo video URL").fill("https://example.com/video"); await page.getByRole("button", { name: "Add video", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("YouTube or Vimeo");
  await page.getByLabel("YouTube or Vimeo video URL").fill("https://youtu.be/dQw4w9WgXcQ"); await page.getByRole("button", { name: "Add video", exact: true }).click();
  await page.getByRole("button", { name: "Preview showcase" }).click(); await expect(page.getByRole("heading", { name: "My dinner helper", exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/5.5-${info.project.name}-preview.png`, fullPage: true });
  await page.getByRole("button", { name: "Back to editing" }).click(); await expect(page.getByLabel("Title", { exact: true })).toHaveValue("My dinner helper");
  let fail = true; let created: ShowcaseDetail;
  await page.route(/\/api\/showcases$/, async r => { if (r.request().method() !== "POST") return r.continue(); if (fail) return r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Try saving again" } } }); const response = await r.fetch(); created = await response.json() as ShowcaseDetail; await r.fulfill({ response }); });
  await page.route("**/api/showcases/fixture-pocket-chef", r => r.fulfill({ json: created }));
  await page.getByRole("button", { name: "Save draft", exact: true }).click(); await expect(page.getByRole("alert")).toContainText("Try saving again");
  await page.screenshot({ path: `docs/handoffs/screenshots/5.5-${info.project.name}-save-error.png`, fullPage: true });
  fail = false; const posted = page.waitForRequest(r => r.method() === "POST" && new URL(r.url()).pathname === "/api/showcases");
  await page.getByRole("button", { name: "Save draft", exact: true }).click(); const data = (await posted).postDataJSON(); expect(data.publish).toBe(false); expect(data.builtWith.projects).toContain("fixture-dungeon-toaster"); expect(data.builtWith.resources).toHaveLength(1); expect(data.media[0].embedUrl).toContain("youtube-nocookie.com");
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();
});

test("draft management, edit/unpublish and Studio publish entry", async ({ page }, info) => {
  await page.request.get("/api/dev/login?as=fx-ada"); await page.goto("/showcase/mine");
  await page.getByRole("link", { name: "Edit draft", exact: true }).click(); await expect(page.getByRole("heading", { name: "Edit showcase" })).toBeVisible();
  await page.getByLabel("Title", { exact: true }).fill("Edited dinner helper");
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue("home-and-life");
  const patch = page.waitForRequest(r => r.method() === "PATCH" && r.url().includes("/api/showcases/fixture-draft"));
  await page.getByRole("button", { name: "Publish showcase", exact: true }).click(); expect((await patch).postDataJSON().publish).toBe(true);
  await expect(page).toHaveURL(/\/showcase\/fixture-draft$/);
  await page.goto("/studio"); await page.getByRole("link", { name: "Publish as showcase", exact: true }).first().click();
  await expect(page.getByLabel("Title", { exact: true })).not.toHaveValue("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `docs/handoffs/screenshots/5.5-${info.project.name}-studio-composer.png`, fullPage: true });
  await page.request.get("/api/dev/login?as=fx-admin"); await page.goto("/showcase/fixture-pocket-chef/edit"); await expect(page.getByText("Only the maker can edit this showcase", { exact: true })).toBeVisible();
});

test("upload progress, failure, retry and media removal", async ({ page }, info) => {
  await page.request.get("/api/dev/login?as=fx-ada"); await page.goto("/showcase/new");
  let release!: () => void; let fail = true; const gate = new Promise<void>(r => { release = r; });
  await page.route("**/api/uploads", r => r.fulfill({ json: { key: "thumbnail/ada/test.png", uploadUrl: "/api/uploads/thumbnail/ada/test.png", expiresAt: "2030-01-01T00:00:00Z" } }));
  await page.route("**/api/uploads/thumbnail/ada/test.png", async r => { if (fail) { await gate; return r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Upload failed" } } }); } return r.fulfill({ json: { key: "thumbnail/ada/test.png", url: "/api/media/thumbnail/ada/test.png" } }); });
  const image = { name: "test.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHjoAAAAASUVORK5CYII=", "base64") };
  await page.getByLabel("Cover image (5 MB)").setInputFiles(image); await expect(page.getByRole("progressbar", { name: "Media upload progress" })).toBeVisible(); await expect(page.getByRole("button", { name: "Save draft" })).toBeDisabled();
  await page.screenshot({ path: `docs/handoffs/screenshots/5.5-${info.project.name}-upload.png` });
  release(); await expect(page.getByRole("alert")).toContainText("Upload failed"); fail = false;
  await page.getByLabel("Cover image (5 MB)").setInputFiles(image); await expect(page.getByRole("button", { name: "Remove cover" })).toBeVisible(); await page.getByRole("button", { name: "Remove cover" }).click();
  await expect(page.getByRole("img", { name: "Cover preview" })).toHaveCount(0);
});

test("my-showcases loading, empty and error recovery", async ({ page }, info) => {
  await page.request.get("/api/dev/login?as=fx-ada"); let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  await page.route("**/api/me/showcases*", async r => { await gate; await r.fulfill({ json: { items: [], nextCursor: null } }); });
  await page.goto("/showcase/mine"); await expect(page.getByText("Loading your showcases", { exact: true })).toBeAttached(); release(); await expect(page.getByText("No showcases of your own yet", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/5.5-${info.project.name}-drafts-empty.png` });
  await page.unroute("**/api/me/showcases*"); await page.route("**/api/me/showcases*", r => r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Failed" } } })); await page.reload(); await expect(page.getByText("Couldn't load your showcases", { exact: true })).toBeVisible();
  await page.unroute("**/api/me/showcases*"); await page.getByRole("button", { name: "Try again" }).click(); await expect(page.getByRole("link", { name: "Edit draft" })).toBeVisible();
});

test("credit limits and open-source-later catalog action", async ({ page }) => {
  await page.request.get("/api/dev/login?as=fx-ada");
  const projects = await (await page.request.get("/api/projects")).json();
  await page.route(/\/api\/projects(?:\?|$)/, r => r.fulfill({ json: { ...projects, items: Array.from({ length: 11 }, (_, i) => ({ ...projects.items.find((p: { license: unknown }) => p.license), id: `credit-${i}`, slug: `credit-${i}`, name: `Credit project ${i}` })) } }));
  await page.goto("/showcase/new");
  for (let i = 0; i < 10; i++) await page.getByRole("button", { name: `Add Credit project ${i}`, exact: true }).click();
  await expect(page.getByRole("button", { name: "Add Credit project 10", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Remove credit-0", exact: true }).click(); await expect(page.getByRole("button", { name: "Add Credit project 10", exact: true })).toBeEnabled();
  await page.goto("/showcase/fixture-pocket-chef/edit"); await page.getByLabel("Public GitHub repo (optional)").fill("https://github.com/example/fixture");
  await page.getByRole("button", { name: "List in catalog", exact: true }).click();
  await expect(page.getByRole("link", { name: "See the code", exact: true })).toBeVisible();
});


