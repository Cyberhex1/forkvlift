import { expect, test, type Page } from "playwright/test";

async function mockVerification(page: Page) {
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit", (route) => route.fulfill({ contentType: "application/javascript", body: `window.turnstile = { render(el, options) { const button = document.createElement('button'); button.type='button'; button.textContent='Expire test verification'; button.onclick=()=>options['expired-callback'](); el.append(button); setTimeout(()=>options.callback('test-token'),0); return 'test-widget'; }, remove() {} };` }));
}
async function previewRepo(page: Page) {
  await page.goto("/api/dev/login?as=fx-ada");
  await page.goto("/submit");
  await page.getByLabel("GitHub repository URL").fill("https://github.com/fx-ada/project");
  await page.getByRole("button", { name: "Preview repository" }).click();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue("fixture-submission");
}

test("signed out gate, preview, no license, WIP and successful typed submit", async ({ page }, info) => {
  await mockVerification(page);
  await page.goto("/submit");
  await expect(page.getByText("Sign in to submit", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.11-${info.project.name}-signed-out.png` });
  await previewRepo(page);
  await expect(page.getByRole("note")).toContainText("No license: all rights reserved.");
  await expect(page.getByText("No license found: this project will be hidden from most visitors by default.", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.11-${info.project.name}-preview.png` });
  await page.getByLabel("Category", { exact: true }).selectOption("productivity");
  await page.getByLabel("Stage", { exact: true }).selectOption("wip");
  await page.getByLabel("What works", { exact: true }).fill("Editor works");
  await page.getByLabel("What's missing", { exact: true }).fill("Sync");
  await page.getByLabel("Looking for help with", { exact: true }).fill("Testing");
  await page.getByLabel("Tags (up to 5, comma separated)").fill("notes, tools");
  await page.screenshot({ path: `docs/handoffs/screenshots/1.11-${info.project.name}-wip.png` });
  const submitted = page.waitForRequest((request) => request.method() === "POST" && new URL(request.url()).pathname === "/api/projects");
  await page.getByRole("button", { name: "Submit project", exact: true }).click();
  const body = (await submitted).postDataJSON();
  expect(body).toMatchObject({ stage: "wip", whatWorks: "Editor works", whatsMissing: "Sync", lookingForHelp: "Testing", tags: ["notes", "tools"], turnstileToken: "test-token", repoUrl: "https://github.com/fx-ada/project", isPublic: true });
  await expect(page.getByText("Project submitted", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.11-${info.project.name}-success.png` });
});

test("loading preview, error retry, foreign ownership, already listed and claim", async ({ page }, info) => {
  await mockVerification(page);
  await page.goto("/api/dev/login?as=fx-ada");
  let release!: () => void; const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/projects/preview", async (route) => { await gate; await route.fulfill({ status: 503, json: { error: { code: "internal", message: "Preview unavailable" } } }); });
  await page.goto("/submit");
  await page.getByLabel("GitHub repository URL").fill("https://github.com/fx-ada/project");
  await page.getByRole("button", { name: "Preview repository" }).click();
  await expect(page.getByText("Fetching repository preview", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.11-${info.project.name}-loading.png` });
  release();
  await expect(page.getByText("Couldn't preview repository", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.11-${info.project.name}-error.png` });
  await page.unrouteAll({ behavior: "wait" }); await mockVerification(page);
  await page.route("**/api/projects/preview", async (route) => { const response = await route.fetch(); const data = await response.json(); data.ownedByViewer = false; await route.fulfill({ json: data }); });
  await page.getByRole("button", { name: "Try preview again" }).click();
  await expect(page.getByText("You must own this repository", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit project", exact: true })).toBeDisabled();
  await page.unrouteAll({ behavior: "wait" }); await mockVerification(page);
  const project = await (await page.request.get("/api/projects/fixture-curated-cli")).json();
  await page.route("**/api/projects/preview", async (route) => { const response = await route.fetch(); const data = await response.json(); data.alreadyListed = { id: project.id, slug: project.slug, name: project.name, author: null }; await route.fulfill({ json: data }); });
  await page.getByRole("button", { name: "Preview repository" }).click();
  await expect(page.getByText("This repository is already listed:", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit project", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Claim it" }).click();
  await expect(page.getByText("Project submitted", { exact: true })).toBeVisible();
});

test("file validation, raw uploads attached only when complete, failed upload retry", async ({ page }) => {
  await mockVerification(page); await previewRepo(page);
  const thumbnail = page.getByLabel("Thumbnail (image, up to 5 MB)");
  await thumbnail.setInputFiles({ name: "unsafe.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg/>") });
  await expect(page.getByText("Choose supported images up to 5 MB", { exact: false })).toBeVisible();
  await page.route("**/api/uploads/*", (route) => route.fulfill({ status: 503, json: { error: { code: "internal", message: "Upload unavailable" } } }));
  await thumbnail.setInputFiles({ name: "preview.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
  await expect(page.getByText("Upload unavailable", { exact: true })).toBeVisible();
  await page.unroute("**/api/uploads/*");
  const upload = page.waitForRequest((request) => request.method() === "PUT");
  await thumbnail.setInputFiles({ name: "preview.png", mimeType: "image/png", buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]) });
  expect((await upload).headers()["content-type"]).toBe("image/png");
  await expect(page.getByText("Thumbnail uploaded", { exact: true })).toBeVisible();
  await page.getByLabel("Gallery files (up to 12, 25 MB each)").setInputFiles({ name: "movie.webm", mimeType: "video/webm", buffer: Buffer.from([26, 69, 223, 163]) });
  await expect(page.getByText("Gallery file 1 uploaded", { exact: true })).toBeVisible();
  await page.getByLabel("Category", { exact: true }).selectOption("productivity");
  const submitted = page.waitForRequest((request) => request.method() === "POST" && new URL(request.url()).pathname === "/api/projects");
  await page.getByRole("button", { name: "Submit project", exact: true }).click();
  expect((await submitted).postDataJSON()).toMatchObject({ thumbnailKey: "fixture/thumbnail/upload.bin", mediaKeys: ["fixture/media/upload.bin"] });
  await expect(page.getByText("Project submitted", { exact: true })).toBeVisible();
});

test("private idea, API validation, expired verification and retry", async ({ page }, info) => {
  await mockVerification(page); await page.goto("/api/dev/login?as=fx-ada"); await page.goto("/submit");
  await page.getByLabel("Save a private idea without a repository").check();
  await page.getByLabel("Project name", { exact: true }).fill("Private test idea");
  await page.getByLabel("Category", { exact: true }).selectOption("productivity");
  await page.getByLabel("Tags (up to 5, comma separated)").fill("a,b,c,d,e,f");
  await page.getByRole("button", { name: "Save private idea", exact: true }).click();
  await expect(page.getByText("Check these fields:", { exact: true })).toBeVisible();
  await page.getByLabel("Tags (up to 5, comma separated)").fill("a,b");
  await page.getByRole("button", { name: "Expire test verification" }).click();
  await expect(page.getByText("Verification expired. Try again.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save private idea", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Retry verification" }).click();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.11-${info.project.name}-idea.png` });
  const submitted = page.waitForRequest((request) => request.method() === "POST" && new URL(request.url()).pathname === "/api/projects");
  await page.getByRole("button", { name: "Save private idea", exact: true }).click();
  expect((await submitted).postDataJSON()).toMatchObject({ repoUrl: null, isPublic: false });
  await expect(page.getByText("Private idea saved", { exact: true })).toBeVisible();
});

test("duplicate conflict offers claim; rate limit preserves input and resets verification", async ({ page }) => {
  await mockVerification(page); await previewRepo(page);
  await page.getByLabel("Category", { exact: true }).selectOption("productivity");
  await page.route("**/api/projects", (route) => route.fulfill({ status: 429, json: { error: { code: "rate_limited", message: "Daily limit reached" } } }));
  await page.getByRole("button", { name: "Submit project", exact: true }).click();
  await expect(page.getByText("Daily limit reached", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Project name", { exact: true })).toHaveValue("fixture-submission");
  await page.unroute("**/api/projects");
  await page.route("**/api/projects", (route) => route.fulfill({ status: 409, json: { error: { code: "conflict", message: "Already listed", details: { claimable: true, slug: "fixture-curated-cli" } } } }));
  await page.getByRole("button", { name: "Submit project", exact: true }).click();
  await expect(page.getByRole("button", { name: "Claim it" })).toBeVisible();
  await page.getByRole("button", { name: "Claim it" }).click();
  await expect(page.getByText("Project submitted", { exact: true })).toBeVisible();
});

test("licensed preview, empty category list and missing verification block submission", async ({ page }, info) => {
  await mockVerification(page);
  const project = await (await page.request.get("/api/projects/fixture-pixel-planner")).json();
  await page.route("**/api/projects/preview", async (route) => { const response = await route.fetch(); const data = await response.json(); data.license = project.license; data.readmeHtml = null; data.warnings = []; await route.fulfill({ json: data }); });
  await page.route("**/api/categories", (route) => route.fulfill({ json: { items: [] } }));
  await page.route("**/api/config", async (route) => { const response = await route.fetch(); const data = await response.json(); data.turnstileSiteKey = null; await route.fulfill({ json: data }); });
  await previewRepo(page);
  await expect(page.getByText("MIT", { exact: true })).toBeVisible();
  await page.getByText("README preview", { exact: true }).click();
  await expect(page.getByText("No README available.", { exact: true })).toBeVisible();
  await expect(page.getByText("No categories available.", { exact: false })).toBeVisible();
  await expect(page.getByText("Submission verification is not configured.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit project", exact: true })).toBeDisabled();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.11-${info.project.name}-licensed-empty.png` });
});
