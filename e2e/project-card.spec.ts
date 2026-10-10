import { expect, test } from "playwright/test";

const cards = '[data-testid="project-card"]';

for (const identity of [null, "fx-ada", "fx-admin"]) {
  test(`cards and keyboard controls: ${identity ?? "signed out"}`, async ({ page }) => {
    if (identity) await page.goto(`/api/dev/login?as=${identity}`);
    await page.goto("/");
    await expect(page.locator(cards)).toHaveCount(4);
    await expect(page.getByText("No license", { exact: true })).toHaveCount(0);
    const card = page.getByRole("article", { name: "Fixture: Pixel Planner", exact: true });
    await card.getByRole("button", { name: "Flip card", exact: true }).press("Enter");
    await expect(card).toHaveAttribute("data-flipped", "true");
    await expect(card.getByRole("link", { name: "GitHub" })).toBeVisible();
    await expect(card.getByRole("link", { name: /See more/ })).toHaveAttribute("href", "/p/fixture-pixel-planner");
    await expect(card.getByRole("link", { name: "@fx-ada" })).toBeVisible();
    await card.getByRole("button", { name: "Show preview" }).press("Enter");
    await expect(card).toHaveAttribute("data-flipped", "false");
    await expect(page.getByText("Work in progress", { exact: true })).toBeVisible();
    await expect(page.getByText("Up for adoption", { exact: true })).toBeVisible();
    const viewportWidth = page.viewportSize()!.width;
    for (const bounds of await page.locator(cards).evaluateAll((elements) => elements.map((element) => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right }; }))) {
      expect(bounds.left).toBeGreaterThanOrEqual(0);
      expect(bounds.right).toBeLessThanOrEqual(viewportWidth);
    }
  });
}

test("touch flips once, then opens; back actions do not open the panel", async ({ page }, info) => {
  test.skip(info.project.name !== "phone", "Touch device flow");
  await page.goto("/");
  const card = page.getByRole("article", { name: "Fixture: Pixel Planner", exact: true });
  await card.getByText("No preview available").tap();
  await expect(card).toHaveAttribute("data-flipped", "true");
  await card.getByRole("button", { name: "Copy clone command" }).tap();
  await expect(page).toHaveURL(/\/$/);
  await card.getByText("Dev fixture.", { exact: false }).tap();
  await expect(page).toHaveURL(/\/p\/fixture-pixel-planner$/);
});

test("hover flips only on pointer devices; fade replaces rotation", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const card = page.getByRole("article", { name: "Fixture: Pixel Planner", exact: true });
  if (info.project.name === "desktop") await card.hover();
  else await card.getByRole("button", { name: "Flip card", exact: true }).click();
  await expect(card).toHaveAttribute("data-flipped", "true");
  await expect(card).toHaveClass(/project-card-reduced/);
  expect(await card.locator(".project-card-turner").evaluate((el) => getComputedStyle(el).transform)).toBe("none");
  await page.screenshot({ path: `docs/handoffs/screenshots/1.8-${info.project.name}-back-reduced.png` });
});

test("long text, stage, and preview fallback screenshot", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.locator(cards)).toHaveCount(4);
  await page.screenshot({ path: `docs/handoffs/screenshots/1.8-${info.project.name}-front.png` });
  const long = page.getByRole("article", { name: /Deliberately Long Name/ });
  await long.getByRole("button", { name: "Flip card", exact: true }).press("Enter");
  await expect(long.getByText("Dev fixture for the curated", { exact: false })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.8-${info.project.name}-long.png` });
});

test("unlicensed is opt-in and never offers clone", async ({ page }, info) => {
  await page.addInitScript(() => { localStorage.setItem("fv-show-unlicensed", "true"); localStorage.setItem("fv-unlicensed-accepted", "true"); });
  await page.goto("/");
  await expect(page.locator(cards)).toHaveCount(5);
  const card = page.getByRole("article", { name: "Fixture: No-License Notes", exact: true });
  await expect(card.getByText("No license", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Flip card", exact: true }).press("Enter");
  await expect(card.getByRole("button", { name: "Copy clone command" })).toHaveCount(0);
  await expect(card.getByText("No license. Ask the author", { exact: false })).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.8-${info.project.name}-unlicensed.png` });
});

test("loading, empty, error, retry", async ({ page }, info) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/api/projects?**", async (route) => {
    await gate;
    await route.fulfill({ json: { items: [], nextCursor: null, hiddenUnlicensedCount: 0 } });
  });
  await page.goto("/");
  await expect(page.getByText("Loading projects", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.8-${info.project.name}-loading.png` });
  release();
  await expect(page.getByText("No projects to show", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/1.8-${info.project.name}-empty.png` });
  await page.unrouteAll({ behavior: "wait" });
  await page.route("**/api/projects?**", (route) => route.fulfill({ status: 503, json: { error: { code: "internal", message: "Test outage" } } }));
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Couldn't load projects");
  await page.screenshot({ path: `docs/handoffs/screenshots/1.8-${info.project.name}-error.png` });
  await page.unrouteAll({ behavior: "wait" });
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.locator(cards)).toHaveCount(4);
});

