import { expect, test } from "playwright/test";

const slug = "fixture-pixel-planner";

test("open, share, Escape, focus restore, close, backdrop", async ({ page }) => {
  await page.goto("/?q=planner");
  const trigger = page.getByRole("link", { name: "See more about Fixture: Pixel Planner", exact: true });
  await trigger.press("Enter");
  await expect(page).toHaveURL(/\/p\/fixture-pixel-planner\?q=planner$/);
  const panel = page.getByRole("dialog", { name: "Fixture: Pixel Planner", exact: true });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: "Fork this", exact: true })).toBeVisible();
  await expect(panel.getByRole("link", { name: "Open in Codespaces ↗", exact: true })).toHaveAttribute("href", "https://codespaces.new/example/fixture-pixel-planner");
  await expect(panel.getByRole("heading", { name: "README", exact: true })).toBeVisible();
  const blur = await panel.evaluate((el) => getComputedStyle(el, "::backdrop").backdropFilter);
  expect(blur).toContain("blur");
  await panel.press("Escape");
  await expect(page).toHaveURL(/\/\?q=planner$/);
  await expect(trigger).toBeFocused();
  await trigger.press("Enter");
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await trigger.press("Enter");
  await expect(panel).toBeVisible();
  await page.mouse.click(1, 1);
  await expect(panel).toHaveCount(0);
});

test("direct links, WIP, no license, and responsive screenshots", async ({ page }, info) => {
  for (const [projectSlug, state] of [[slug, "licensed"], ["fixture-dungeon-toaster", "wip"], ["fixture-no-license-notes", "unlicensed"], ["fixture-curated-cli", "long"]]) {
    await page.goto(`/p/${projectSlug}`);
    const panel = page.getByRole("dialog");
    await expect(panel).toContainText(state === "wip" ? "What works / What's missing" : state === "unlicensed" ? "No license: all rights reserved." : "Repository stats");
    const bounds = await panel.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(info.project.use.viewport!.width);
    if (state === "unlicensed") {
      await expect(panel.getByRole("button", { name: "Copy clone command" })).toHaveCount(0);
      await expect(panel.getByRole("button", { name: "Copy starter prompt" })).toHaveCount(0);
      await expect(page.locator('[data-testid="project-card"]')).toHaveCount(4);
    }
    await page.screenshot({ path: `docs/handoffs/screenshots/1.9-${info.project.name}-${state}.png` });
    await panel.getByRole("button", { name: "Close", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
  }
});

test("gallery selection, empty README, no comments, broken media", async ({ page }) => {
  await page.route(`**/api/projects/${slug}`, async (route) => {
    const project = await (await route.fetch()).json();
    project.readmeHtml = null;
    project.media = [{ id: "qa_image", kind: "image", url: "/missing-qa.png", alt: "Unavailable QA image", width: null, height: null }, { id: "qa_gif", kind: "gif", url: "/qa-animation.gif", alt: "QA animation", width: null, height: null }];
    await route.fulfill({ json: project });
  });
  await page.route(`**/api/projects/${slug}/comments*`, (route) => route.fulfill({ json: { items: [], nextCursor: null } }));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/p/${slug}`);
  const panel = page.getByRole("dialog");
  await expect(panel.getByText("No preview available", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "2 · gif", exact: true }).click();
  await expect(panel.getByRole("link", { name: "View animated image: QA animation" })).toBeVisible();
  await expect(panel.getByText("No README available.", { exact: false })).toBeVisible();
  await expect(panel.getByText("No comments yet.", { exact: true })).toBeVisible();
});

test("signed-in upvote, collection, report use typed API flows", async ({ page }) => {
  await page.goto("/api/dev/login?as=fx-ada");
  await page.goto(`/p/${slug}`);
  const panel = page.getByRole("dialog", { name: "Fixture: Pixel Planner", exact: true });
  await panel.getByRole("button", { name: /Upvote ·/ }).click();
  await expect(panel.getByRole("button", { name: /Upvote ·/ })).toHaveAttribute("aria-pressed", "true");
  await panel.getByRole("button", { name: "Save to collection", exact: true }).click();
  await page.getByRole("dialog", { name: "Save to collection", exact: true }).getByRole("button", { name: "Saved", exact: true }).click();
  await expect(panel.getByText("Saved to collection.", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Report project", exact: true }).click();
  const report = page.getByRole("dialog", { name: "Report project", exact: true });
  await report.getByLabel("Details").fill("Local QA report");
  await report.getByRole("button", { name: "Send report" }).click();
  await expect(panel.getByText("Report sent for review.", { exact: true })).toBeVisible();
});

test("loading, failure, retry, not found screenshots", async ({ page }, info) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route(`**/api/projects/${slug}`, async (route) => { await gate; await route.fulfill({ status: 503, json: { error: { code: "internal", message: "QA outage" } } }); });
  await page.goto(`/p/${slug}`);
  await expect(page.getByText("Loading project", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.9-${info.project.name}-loading.png` });
  release();
  await expect(page.getByRole("dialog")).toContainText("Couldn't load this project");
  await page.screenshot({ path: `docs/handoffs/screenshots/1.9-${info.project.name}-error.png` });
  await page.unrouteAll({ behavior: "wait" });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Repository stats");
  await page.goto("/p/nonexistent-qa-project");
  await expect(page.getByRole("dialog")).toContainText("Project not found");
});
