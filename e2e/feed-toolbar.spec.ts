import { expect, test } from "playwright/test";
const cards = '[data-testid="project-card"]';

test("search and all filters persist in URL, reload and browser history", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.locator(cards)).toHaveCount(4);
  await page.screenshot({ path: `docs/handoffs/screenshots/1.10-${info.project.name}-feed.png` });
  await page.getByRole("button", { name: "Filters", exact: true }).press("Enter");
  const drawer = page.getByRole("dialog", { name: "Filter projects" });
  await expect(drawer.getByText("Categories and subcategories")).toBeVisible();
  await drawer.getByLabel("Work in progress", { exact: true }).check();
  await drawer.getByLabel("Has live demo", { exact: true }).check();
  await drawer.getByLabel("License IDs (comma separated)").fill("MIT");
  await drawer.getByLabel("Stack / languages (comma separated)").fill("TypeScript");
  await page.screenshot({ path: `docs/handoffs/screenshots/1.10-${info.project.name}-filters.png` });
  await drawer.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/stage=wip/);
  expect(new URL(page.url()).searchParams.get("hasDemo")).toBe("true");
  await page.getByLabel("Sort", { exact: true }).selectOption("most_starred");
  await page.getByRole("search", { name: "Feed search" }).getByLabel("Search", { exact: true }).fill("Dungeon");
  await page.getByRole("search", { name: "Feed search" }).getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/q=Dungeon/);
  await page.reload();
  await expect(page.getByLabel("Sort", { exact: true })).toHaveValue("most_starred");
  await page.getByRole("button", { name: "Remove stack filter" }).click();
  await expect(page).not.toHaveURL(/stack=/);
  await page.goBack();
  await expect(page).toHaveURL(/stack=TypeScript/);
  await page.getByRole("search", { name: "Header search" }).getByRole("searchbox").fill("Planner");
  await page.getByRole("search", { name: "Header search" }).getByRole("searchbox").press("Enter");
  await expect(page).toHaveURL(/q=Planner/);
  expect(new URL(page.url()).searchParams.get("stage")).toBe("wip");
});

test("unlicensed disclaimer cancel, accept, turn off, remembered acceptance", async ({ page }, info) => {
  await page.goto("/?showUnlicensed=true");
  await expect(page.locator(cards)).toHaveCount(4);
  await page.getByRole("button", { name: "Show them" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("No license");
  await page.screenshot({ path: `docs/handoffs/screenshots/1.10-${info.project.name}-disclaimer.png` });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator(cards)).toHaveCount(4);
  await page.getByRole("switch").click();
  await dialog.getByRole("button", { name: "I understand" }).click();
  await expect(page.locator(cards)).toHaveCount(5);
  await page.screenshot({ path: `docs/handoffs/screenshots/1.10-${info.project.name}-unlicensed.png` });
  await page.getByRole("switch").uncheck();
  await expect(page.locator(cards)).toHaveCount(4);
  await page.getByRole("switch").click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(cards)).toHaveCount(5);
  await page.reload();
  await expect(page.getByRole("switch")).toBeChecked();
});

test("loading, empty, invalid URL, error, next page error keeps cards and retries", async ({ page }, info) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/projects?**", async (route) => { await gate; await route.fulfill({ json: { items: [], nextCursor: null, hiddenUnlicensedCount: 0 } }); });
  await page.goto("/");
  await expect(page.getByText("Loading projects", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.10-${info.project.name}-loading.png` });
  release();
  await expect(page.getByText("No projects to show", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.10-${info.project.name}-empty.png` });
  await page.unrouteAll({ behavior: "wait" });
  await page.goto("/?stage=invalid");
  await expect(page.getByText("Invalid filters", { exact: true })).toBeVisible();
  await page.route("**/api/projects?**", (route) => route.fulfill({ status: 503, json: { error: { code: "internal", message: "QA outage" } } }));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Couldn't load projects");
  await page.screenshot({ path: `docs/handoffs/screenshots/1.10-${info.project.name}-error.png` });
  await page.unrouteAll({ behavior: "wait" });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(cards)).toHaveCount(4);
  let nextFails = true;
  await page.route("**/api/projects?**", async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has("cursor")) {
      if (nextFails) await route.fulfill({ status: 503, json: { error: { code: "internal", message: "Next page failed" } } });
      else await route.fulfill({ json: { items: [], nextCursor: null, hiddenUnlicensedCount: 0 } });
    } else { const response = await route.fetch(); const data = await response.json(); data.nextCursor = "qa-next"; await route.fulfill({ json: data }); }
  });
  await page.reload();
  await page.getByRole("button", { name: /Load more projects|Retry loading more/ }).scrollIntoViewIfNeeded();
  await expect(page.getByText("Couldn't load more projects.", { exact: false })).toBeVisible();
  await expect(page.locator(cards)).toHaveCount(4);
  nextFails = false;
  await page.getByRole("button", { name: "Retry loading more" }).press("Enter");
  await expect(page.getByText("You've reached the end.", { exact: true })).toBeVisible();
});

