import { expect, test } from "playwright/test";
import type { ProjectDetail, ShowcaseCard, ShowcaseDetail } from "@forkvlift/shared";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/config", async r => { const response = await r.fetch(); await r.fulfill({ json: { ...await response.json(), turnstileSiteKey: null } }); });
});

test("detail loading, not-found recovery, empty comments and media variants", async ({ page }, info) => {
  const fixture = await (await page.request.get("/api/showcases/fixture-pocket-chef")).json() as ShowcaseDetail;
  let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  await page.route("**/api/showcases/missing", async r => { await gate; await r.fulfill({ status: 404, json: { error: { code: "not_found", message: "Missing" } } }); });
  await page.goto("/showcase/missing"); await expect(page.getByText("Loading showcase", { exact: true })).toBeAttached(); release();
  await expect(page.getByText("Showcase not found", { exact: true })).toBeVisible();
  await page.unroute("**/api/showcases/missing");
  await page.route("**/api/showcases/missing", r => r.fulfill({ json: { ...fixture, title: "X".repeat(100), tagline: "Y".repeat(140), media: [{ id: "img", kind: "image", url: "/favicon.svg", alt: "Gallery image" }, { id: "vid", kind: "video", url: "/demo.webm", alt: "Uploaded video" }, { id: "unsafe", kind: "embed", url: "https://example.com/embed", alt: "Refused host" }], links: [{ kind: "download", label: "Download", url: "https://example.com/download" }] } }));
  await page.route("**/api/showcases/fixture-pocket-chef/comments*", r => r.fulfill({ json: { items: [], nextCursor: null } }));
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("No comments yet.")).toBeVisible(); await expect(page.getByText("Review before running.")).toBeVisible();
  await expect(page.getByRole("img", { name: "Gallery image" })).toBeVisible(); await expect(page.locator("video")).toHaveAttribute("controls", ""); await expect(page.locator("video")).not.toHaveAttribute("autoplay");
  await expect(page.locator('iframe[title="Refused host"]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `docs/handoffs/screenshots/5.4-${info.project.name}-gallery.png` });
});

test("showcase feed filters, semantic query, paging, keyboard and state recovery", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const fixture = await (await page.request.get("/api/showcases")).json() as { items: ShowcaseCard[]; nextCursor: null };
  let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  await page.route(/\/api\/showcases(?:\?|$)/, async r => { await gate; await r.fulfill({ json: { items: [], nextCursor: null } }); });
  await page.goto("/showcase"); await expect(page.getByText("Loading showcases", { exact: true })).toBeAttached();
  await page.screenshot({ path: `docs/handoffs/screenshots/5.4-${info.project.name}-loading.png` });
  release(); await expect(page.getByText("No showcases yet", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/5.4-${info.project.name}-empty.png` });
  await page.unroute(/\/api\/showcases(?:\?|$)/);
  await page.route(/\/api\/showcases(?:\?|$)/, r => r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Unavailable" } } }));
  await page.reload(); await expect(page.getByText("Couldn't load showcases", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/5.4-${info.project.name}-error.png` });
  await page.unroute(/\/api\/showcases(?:\?|$)/);
  let failNext = true;
  await page.route(/\/api\/showcases(?:\?|$)/, r => {
    if (new URL(r.request().url()).searchParams.has("cursor")) return failNext ? r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Unavailable" } } }) : r.fulfill({ json: { items: [], nextCursor: null } });
    return r.fulfill({ json: { ...fixture, items: fixture.items.map(s => ({ ...s, title: "A".repeat(100), tagline: "B".repeat(140), stage: "wip" })), nextCursor: "next" } });
  });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Work in progress").first()).toBeVisible();
  await page.getByLabel("Search by idea").fill("dinner helper");
  const search = page.waitForRequest(r => r.url().includes("/api/showcases?") && new URL(r.url()).searchParams.get("q") === "dinner helper");
  await page.getByRole("button", { name: "Search", exact: true }).press("Enter");
  expect(new URL((await search).url()).searchParams.get("sort")).toBeNull();
  await page.getByLabel("Showcase sort").selectOption("top"); await page.getByLabel("Type", { exact: true }).selectOption("game");
  await expect(page).toHaveURL(/q=dinner\+helper.*sort=top.*kind=game/);
  await page.getByLabel("AI tool", { exact: true }).fill("cursor"); await page.getByRole("button", { name: "Filter tool" }).click();
  await page.getByLabel("Staff picks", { exact: true }).click(); await expect(page.getByLabel("Staff picks", { exact: true })).toBeChecked();
  await page.screenshot({ path: `docs/handoffs/screenshots/5.4-${info.project.name}-feed.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Load more showcases" }).click(); await expect(page.getByRole("alert")).toContainText("current showcases");
  failNext = false; await page.getByRole("button", { name: "Load more showcases" }).click();
  await expect(page.getByRole("button", { name: "Load more showcases" })).toHaveCount(0);
  await page.goto("/showcase?kind=bad"); await expect(page.getByText("Invalid showcase filters", { exact: true })).toBeVisible();
});

test("gallery, credits, signed-out gate, save/vote failures, replies and moderation", async ({ page }, info) => {
  await page.goto("/showcase/fixture-pocket-chef");
  await expect(page.getByRole("link", { name: "Sign in to upvote or save" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Fixture: Dungeon Toaster", exact: true })).toBeVisible();
  await expect(page.locator('iframe[title="Demo video"]')).toBeVisible();
  await expect(page.getByRole("button", { name: /clone|fork/i })).toHaveCount(0);
  await page.screenshot({ path: `docs/handoffs/screenshots/5.4-${info.project.name}-detail-out.png` });
  await page.request.get("/api/dev/login?as=fx-admin"); await page.reload();
  let fail = true;
  await page.route("**/api/showcases/fixture-pocket-chef/vote", r => fail ? r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Vote unavailable" } } }) : r.continue());
  await page.getByRole("button", { name: "Upvote · 12" }).click(); await expect(page.getByRole("alert")).toContainText("Vote unavailable");
  fail = false; await page.getByRole("button", { name: "Upvote · 12" }).click(); await expect(page.getByRole("button", { name: "Upvoted · 13" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Save showcase", exact: true }).click(); await expect(page.getByRole("button", { name: "Saved", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Reply to @fx-bo" }).click(); await page.getByLabel("Reply", { exact: true }).fill("Thanks for sharing **your workflow**.");
  await page.getByRole("button", { name: "Post reply" }).click(); await expect(page.getByText("your workflow", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete comment", exact: true }).last().click(); await expect(page.getByText("your workflow", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `docs/handoffs/screenshots/5.4-${info.project.name}-detail-admin.png` });
  await page.request.get("/api/dev/login?as=fx-ada"); await page.reload(); await expect(page.getByRole("button", { name: "Upvote · 12" })).toBeDisabled();
  const detail = await (await page.request.get("/api/showcases/fixture-pocket-chef")).json() as ShowcaseDetail;
  const project = await (await page.request.get("/api/projects/fixture-pixel-planner")).json() as ProjectDetail;
  await page.route("**/api/projects/preview", async r => { const response = await r.fetch(); await r.fulfill({ json: { ...await response.json(), license: project.license } }); });
  await page.route("**/api/showcases/fixture-pocket-chef", r => r.fulfill({ json: { ...detail, hasPublicCode: true, repoUrl: "https://github.com/example/fixture", media: [], bodyMd: "", buildStoryMd: "", builtWith: { projects: [], resources: [] } } }));
  await page.reload(); await expect(page.getByText("No credits added yet.")).toBeVisible();
  await page.getByRole("button", { name: "List in catalog" }).click(); await expect(page.getByRole("link", { name: "See the code", exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/5.4-${info.project.name}-detail-owner.png` });
});

test("catalog action waits for licensing and recovers eligibility failures", async ({ page }) => {
  await page.request.get("/api/dev/login?as=fx-ada");
  const detail = await (await page.request.get("/api/showcases/fixture-pocket-chef")).json() as ShowcaseDetail;
  await page.route("**/api/showcases/fixture-pocket-chef", r => r.fulfill({ json: { ...detail, hasPublicCode: true, repoUrl: "https://github.com/example/fixture" } }));
  await page.goto("/showcase/fixture-pocket-chef");
  await expect(page.getByText("Add an open-source license to this repository before listing it in the catalog.")).toBeVisible();
  await expect(page.getByRole("button", { name: "List in catalog" })).toHaveCount(0);
  await page.route("**/api/projects/preview", r => r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Failed" } } }));
  await page.reload(); await expect(page.getByText("Couldn't verify repository eligibility", { exact: true })).toBeVisible();
  await page.unroute("**/api/projects/preview"); await page.getByRole("button", { name: "Retry repository check" }).click();
  await expect(page.getByText("Add an open-source license to this repository before listing it in the catalog.")).toBeVisible();
});

test("only the comment being deleted shows a busy indicator", async ({ page }) => {
  await page.request.get("/api/dev/login?as=fx-admin");
  const comments = await (await page.request.get("/api/showcases/fixture-pocket-chef/comments")).json();
  const comment = comments.items[0];
  await page.route("**/api/showcases/fixture-pocket-chef/comments", r => r.fulfill({ json: { items: [comment, { ...comment, id: "second-comment", body: "Another comment" }], nextCursor: null } }));
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/showcases/fixture-pocket-chef/comments/${comment.id}`, async r => { await gate; await r.fulfill({ json: { ok: true } }); });
  await page.goto("/showcase/fixture-pocket-chef");
  const buttons = page.getByRole("button", { name: "Delete comment", exact: true });
  await expect(buttons).toHaveCount(2);
  await buttons.first().click();
  await expect(buttons.first()).toHaveAttribute("aria-busy", "true");
  await expect(buttons.last()).not.toHaveAttribute("aria-busy", "true");
  release();
  await expect(buttons).toHaveCount(1);
});


