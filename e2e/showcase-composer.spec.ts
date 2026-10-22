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
  await page.goto("/studio");
  await expect(page.getByRole("link", { name: "Publish as showcase", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Publish as showcase", exact: true })).toHaveCount(0);
  const options = page.getByRole("button", { name: /^Card options for / }).first();
  const menuLabel = await options.getAttribute("aria-label");
  await options.click(); const menu = page.getByRole("dialog", { name: menuLabel!, exact: true });
  await page.screenshot({ path: `docs/handoffs/screenshots/5.5-${info.project.name}-studio-menu.png` });
  await menu.getByRole("button", { name: "Publish as showcase", exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/showcase\/new\?card=/);
  await expect(page.getByLabel("Title", { exact: true })).not.toHaveValue("");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `docs/handoffs/screenshots/5.5-${info.project.name}-studio-composer.png`, fullPage: true });
  await page.request.get("/api/dev/login?as=fx-admin"); await page.goto("/showcase/fixture-pocket-chef/edit"); await expect(page.getByText("Only the maker can edit this showcase", { exact: true })).toBeVisible();
});

test("Enter saves a published showcase without changing its status; buttons change status explicitly", async ({ page }) => {
  await page.request.get("/api/dev/login?as=fx-ada");
  let saved = await (await page.request.get("/api/showcases/fixture-pocket-chef")).json() as ShowcaseDetail;
  expect(saved.status).toBe("published");
  const publishedAt = saved.publishedAt;
  await page.route("**/api/showcases/fixture-pocket-chef", r => {
    if (r.request().method() === "PATCH") {
      const data = r.request().postDataJSON();
      // Match the worker: omitted publish preserves status; false clears published_at.
      saved = { ...saved, title: data.title ?? saved.title, status: data.publish === false ? "draft" : data.publish === true ? "published" : saved.status, publishedAt: data.publish === false ? null : data.publish === true ? publishedAt : saved.publishedAt };
    }
    return r.fulfill({ json: saved });
  });
  for (const [label, value] of [
    ["Title", "Published title after Enter"],
    ["Tagline", "Still live after Enter"],
    ["Build time", "One afternoon"],
    ["YouTube or Vimeo video URL", "https://youtu.be/dQw4w9WgXcQ"],
    ["AI tools (comma separated)", "Codex, Claude"],
    ["Tags (comma separated)", "live, keyboard"],
  ]) {
    await page.goto("/showcase/fixture-pocket-chef/edit");
    const input = page.getByLabel(label, { exact: true }); await input.fill(value);
    await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeEnabled();
    const patched = page.waitForRequest(r => r.method() === "PATCH" && new URL(r.url()).pathname === "/api/showcases/fixture-pocket-chef");
    await input.press("Enter");
    const data = (await patched).postDataJSON();
    expect(data).not.toHaveProperty("publish");
    if (label === "Title") expect(data.title).toBe(value);
    if (label === "AI tools (comma separated)") expect(data.aiTools).toEqual(["Codex", "Claude"]);
    if (label === "Tags (comma separated)") expect(data.tags).toEqual(["live", "keyboard"]);
    await expect(page).toHaveURL(/\/showcase\/fixture-pocket-chef$/);
    await expect(page.getByRole("heading", { name: "Published title after Enter", exact: true })).toBeVisible();
    await expect(page.getByText("Draft", { exact: true })).toHaveCount(0);
    expect(saved.status).toBe("published"); expect(saved.publishedAt).toBe(publishedAt);
  }
  await page.reload(); await expect(page.getByText("Draft", { exact: true })).toHaveCount(0);
  await page.goto("/showcase/fixture-pocket-chef/edit");
  const unchanged = page.waitForRequest(r => r.method() === "PATCH" && r.url().endsWith("/api/showcases/fixture-pocket-chef"));
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  expect((await unchanged).postDataJSON()).not.toHaveProperty("publish");
  await expect(page).toHaveURL(/\/showcase\/fixture-pocket-chef$/);
  await page.goto("/showcase/fixture-pocket-chef/edit");
  const unpublished = page.waitForRequest(r => r.method() === "PATCH" && r.url().endsWith("/api/showcases/fixture-pocket-chef"));
  await page.getByRole("button", { name: "Unpublish to draft", exact: true }).click();
  expect((await unpublished).postDataJSON().publish).toBe(false);
  await expect(page.getByText("Draft", { exact: true })).toBeVisible(); expect(saved.publishedAt).toBeNull();
  await page.goto("/showcase/fixture-pocket-chef/edit");
  const published = page.waitForRequest(r => r.method() === "PATCH" && r.url().endsWith("/api/showcases/fixture-pocket-chef"));
  await page.getByRole("button", { name: "Publish showcase", exact: true }).click();
  expect((await published).postDataJSON().publish).toBe(true);
  await expect(page).toHaveURL(/\/showcase\/fixture-pocket-chef$/);
  await expect(page.getByText("Draft", { exact: true })).toHaveCount(0); expect(saved.status).toBe("published");
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

test("credit limits and catalog action stays on the showcase page", async ({ page }) => {
  await page.request.get("/api/dev/login?as=fx-ada");
  const projects = await (await page.request.get("/api/projects")).json();
  await page.route(/\/api\/projects(?:\?|$)/, r => r.fulfill({ json: { ...projects, items: Array.from({ length: 11 }, (_, i) => ({ ...projects.items.find((p: { license: unknown }) => p.license), id: `credit-${i}`, slug: `credit-${i}`, name: `Credit project ${i}` })) } }));
  await page.goto("/showcase/new");
  for (let i = 0; i < 10; i++) await page.getByRole("button", { name: `Add Credit project ${i}`, exact: true }).click();
  await expect(page.getByRole("button", { name: "Add Credit project 10", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Remove credit-0", exact: true }).click(); await expect(page.getByRole("button", { name: "Add Credit project 10", exact: true })).toBeEnabled();
  await page.goto("/showcase/fixture-pocket-chef/edit"); await page.getByLabel("Public GitHub repo (optional)").fill("https://github.com/example/fixture");
  await expect(page.getByRole("button", { name: "List in catalog", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "List the code in the catalog" })).toHaveCount(0);
});

test("Enter searches credits without saving or publishing the showcase", async ({ page }) => {
  await page.request.get("/api/dev/login?as=fx-ada");
  const submissions: unknown[] = [];
  await page.route(/\/api\/showcases$/, r => {
    if (r.request().method() !== "POST") return r.continue();
    submissions.push(r.request().postDataJSON());
    return r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Unexpected submission" } } });
  });
  await page.goto("/showcase/new");
  await page.getByLabel("Title", { exact: true }).fill("Keyboard search regression");
  await page.getByLabel("Category", { exact: true }).selectOption("home-and-life");
  await expect(page.getByRole("button", { name: "Publish showcase", exact: true })).toBeEnabled();
  for (const [kind, query] of [["projects", "toaster"], ["resources", "workflow"]]) {
    const search = page.getByRole("searchbox", { name: `Find ${kind}` });
    await search.fill(query);
    const response = page.waitForResponse(r => new URL(r.url()).pathname === `/api/${kind}` && new URL(r.url()).searchParams.get("q") === query);
    await search.press("Enter");
    await response;
    await expect(page.getByText(`Loading ${kind}`, { exact: true })).toHaveCount(0);
    expect(submissions).toEqual([]);
    await expect(page).toHaveURL(/\/showcase\/new$/);
  }
});

test("Enter only saves drafts and includes AI tools and tags before blur", async ({ page }) => {
  await page.request.get("/api/dev/login?as=fx-ada"); await page.goto("/showcase/new");
  await page.getByLabel("Title", { exact: true }).fill("Keyboard draft regression");
  await page.getByLabel("Category", { exact: true }).selectOption("home-and-life");
  await page.route(/\/api\/showcases$/, r => r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Draft retained for inspection" } } }));
  for (const [label, value, key, expected] of [
    ["AI tools (comma separated)", "Codex, Claude", "aiTools", ["Codex", "Claude"]],
    ["Tags (comma separated)", "keyboard, draft", "tags", ["keyboard", "draft"]],
    ["Title", "Updated keyboard draft", "title", "Updated keyboard draft"],
    ["YouTube or Vimeo video URL", "https://youtu.be/dQw4w9WgXcQ", "title", "Updated keyboard draft"],
  ] as const) {
    const input = page.getByLabel(label, { exact: true });
    await input.fill(value);
    const posted = page.waitForRequest(r => r.method() === "POST" && new URL(r.url()).pathname === "/api/showcases");
    await input.press("Enter");
    const data = (await posted).postDataJSON();
    expect(data.publish).toBe(false);
    expect(data[key]).toEqual(expected);
    await expect(page.getByRole("alert")).toContainText("Draft retained for inspection");
    await expect(page.getByRole("button", { name: "Save draft", exact: true })).toBeEnabled();
  }
  await page.getByRole("button", { name: "Preview showcase" }).click();
  await page.getByRole("button", { name: "Back to editing" }).click();
  await expect(page.getByLabel("AI tools (comma separated)")).toHaveValue("Codex, Claude");
  await expect(page.getByLabel("Tags (comma separated)")).toHaveValue("keyboard, draft");
});

test("preview uses upload content type for extensionless keys", async ({ page }) => {
  await page.request.get("/api/dev/login?as=fx-ada"); await page.goto("/showcase/new");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/uploads", r => {
    const kind = r.request().postDataJSON().contentType === "video/mp4" ? "movie" : "animation";
    return r.fulfill({ json: { key: `media/ada/${kind}`, uploadUrl: `/api/uploads/media/ada/${kind}`, expiresAt: "2030-01-01T00:00:00Z" } });
  });
  await page.route("**/api/uploads/media/ada/*", r => r.fulfill({ json: {} }));
  await page.getByLabel("Gallery images or videos (25 MB each)").setInputFiles([
    { name: "demo.mp4", mimeType: "video/mp4", buffer: Buffer.from("test video") },
    { name: "demo.gif", mimeType: "image/gif", buffer: Buffer.from("test gif") },
  ]);
  await expect(page.getByRole("button", { name: "Remove media 2", exact: true })).toBeVisible();
  await expect(page.getByLabel("Gallery images or videos (25 MB each)")).toBeEnabled();
  await page.getByRole("button", { name: "Preview showcase" }).click();
  await expect(page.locator("video")).toHaveAttribute("src", "/api/media/media/ada/movie");
  await expect(page.getByRole("link", { name: "View animated image: demo.gif" })).toBeVisible();
});


