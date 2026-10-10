import { expect, test } from "playwright/test";

test("forum board, thread with safe Markdown and the solved answer", async ({ page }) => {
  await page.goto("/api/dev/login?as=fx-ada");
  await page.goto("/forum");
  await page.getByRole("link", { name: /Help & Debugging/ }).click();
  await expect(page.getByRole("heading", { name: "Help & Debugging", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /Durable Object keeps hibernating/ }).click();
  await expect(page).toHaveURL(/\/forum\/t\/fx_thr_1$/);
  await expect(page.locator("code", { hasText: "inline code" })).toBeVisible();
  await expect(page.locator("pre code")).toHaveText("console.log('hi')");
  await expect(page.getByText("Answer", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Post reply" })).toBeDisabled();
});

test("resources library and detail", async ({ page }) => {
  await page.goto("/resources");
  await expect(page.getByRole("heading", { name: "Proven", exact: true })).toBeVisible();
  await page.getByRole("link", { name: /plan → scaffold → test → ship/ }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("plan → scaffold → test → ship");
  await expect(page.getByRole("heading", { name: /Reports \(2 worked/ })).toBeVisible();
});

test("fork tree from the project panel", async ({ page }) => {
  await page.goto("/p/fixture-pixel-planner");
  await page.getByRole("button", { name: "See the fork tree" }).click();
  const tree = page.getByRole("tree", { name: "Fork tree" });
  await expect(tree.getByRole("link", { name: "Fixture: Pixel Planner" })).toBeVisible();
  await expect(tree.getByRole("link", { name: "Fixture: Dungeon Toaster" })).toBeVisible();
});

test("avatar builder saves the look", async ({ page }) => {
  await page.goto("/api/dev/login?as=fx-ada");
  await page.goto("/settings/avatar");
  await page.getByRole("button", { name: "Tone 4" }).click();
  await page.getByRole("button", { name: "Long", exact: true }).click();
  const saved = page.waitForRequest((r) => r.method() === "PUT" && r.url().endsWith("/api/me/avatar"));
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await saved).postDataJSON()).toMatchObject({ skin: "skin-4", hair: expect.stringMatching(/^long-/) });
});
