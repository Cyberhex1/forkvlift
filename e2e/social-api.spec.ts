import { expect, test } from "playwright/test";
import type { Collection, CollectionDetail, Follow } from "@forkvlift/shared";

test("social route contracts and authenticated fixture plumbing", async ({ page }) => {
  const request = page.request;
  expect((await request.post("/api/follows", { data: { targetType: "user", targetId: "fx_bo" } })).status()).toBe(401);
  await page.goto("/api/dev/login?as=fx-ada");
  const headers = { cookie: (await page.context().cookies()).map(c => `${c.name}=${c.value}`).join(";"), accept: "application/json" };
  const following = await request.get("/api/me/following", { headers });
  expect(following.ok()).toBe(true);
  const follows = await following.json() as { items: Follow[] };
  for (const method of ["post", "delete"] as const) expect((await request[method]("/api/follows", { headers, data: { targetType: follows.items[0].targetType, targetId: follows.items[0].targetId } })).ok()).toBe(true);
  const list = await request.get("/api/users/fx-ada/collections", { headers });
  const collections = await list.json() as { items: Collection[] };
  expect(list.ok()).toBe(true);
  const saved = collections.items.find((c: { isDefault: boolean }) => c.isDefault);
  expect(saved).toBeTruthy();
  const detail = await request.get(`/api/collections/${saved.id}`, { headers });
  expect((await detail.json() as CollectionDetail).collection.id).toBe(saved.id);
  const created = await request.post("/api/collections", { headers, data: { name: "QA collection", description: "Test-only fixture request", isPublic: false } });
  expect(await created.json()).toMatchObject({ name: "QA collection", isDefault: false, isPublic: false });
});

test("bookmark licensed, WIP, and no-license projects with the Saved chooser", async ({ page }, info) => {
  await page.goto("/api/dev/login?as=fx-ada");
  for (const [slug, variant] of [["fixture-pixel-planner", "saved"], ["fixture-dungeon-toaster", "wip"], ["fixture-no-license-notes", "no-license"]]) {
    await page.goto(`/p/${slug}`);
    const panel = page.getByRole("dialog").first();
    await panel.getByRole("button", { name: "Save to collection", exact: true }).click();
    const chooser = page.getByRole("dialog", { name: "Save to collection", exact: true });
    await expect(chooser.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
    await page.screenshot({ path: `docs/handoffs/screenshots/2.5-${info.project.name}-${variant}.png` });
    const savedRequest = page.waitForRequest(req => req.method() === "POST" && req.url().includes("/items"));
    await chooser.getByRole("button", { name: "Saved", exact: true }).click();
    expect((await savedRequest).postDataJSON()).toHaveProperty("projectId");
    await expect(panel.getByText("Saved to collection.", { exact: true })).toBeVisible();
    if (variant === "no-license") await expect(panel.getByRole("button", { name: "Copy clone command", exact: true })).toHaveCount(0);
  }
});

test("collection chooser loading, error retry, and empty states", async ({ page }, info) => {
  await page.goto("/api/dev/login?as=fx-ada");
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/users/fx-ada/collections", async route => { await gate; await route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Test outage" } } }); });
  await page.goto("/p/fixture-pixel-planner");
  await page.getByRole("button", { name: "Save to collection", exact: true }).click();
  const chooser = page.getByRole("dialog", { name: "Save to collection", exact: true });
  await expect(chooser.getByText("Loading collections", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/2.5-${info.project.name}-loading.png` });
  release();
  await expect(chooser.getByText("Couldn't load collections", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/2.5-${info.project.name}-error.png` });
  await page.unroute("**/api/users/fx-ada/collections");
  await page.route("**/api/users/fx-ada/collections", route => route.fulfill({ json: { items: [] } }));
  await chooser.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(chooser.getByText("You have no collections yet.", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/2.5-${info.project.name}-empty.png` });
});
