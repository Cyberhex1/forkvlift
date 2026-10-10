import { expect, test } from "playwright/test";

test("share uploads, remove, partial failure, retry and archive warning", async ({ page }, info) => {
  await page.goto("/api/dev/login?as=fx-ada");
  // Leave verification out of this upload-focused fixture test.
  await page.route("**/api/config", async (route) => { const response = await route.fetch(); const config = await response.json(); await route.fulfill({ json: { ...config, turnstileSiteKey: null } }); });
  await page.goto("/resources");
  await page.getByRole("button", { name: "Share a resource" }).click();
  const dialog = page.getByRole("dialog", { name: "Share a resource" });
  await dialog.getByLabel("Title", { exact: true }).fill("Upload test resource");
  await dialog.getByLabel("The resource", { exact: true }).fill("Review these files before use.");
  const input = dialog.getByLabel("Files (optional)");
  await expect(dialog.getByText("No files attached.")).toBeVisible();
  await input.setInputFiles({ name: "empty.md", mimeType: "text/markdown", buffer: Buffer.alloc(0) });
  await expect(dialog.getByRole("alert")).toContainText("non-empty");
  await input.setInputFiles({ name: "big.zip", mimeType: "application/zip", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await expect(dialog.getByRole("alert")).toContainText("10 MB");
  await input.setInputFiles({ name: "run.sh", mimeType: "text/plain", buffer: Buffer.from("echo hello") });
  await expect(dialog.getByRole("alert")).toContainText("Put scripts in a ZIP");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let reservations = 0;
  await page.route("**/api/uploads", async (route) => {
    expect(route.request().postDataJSON().kind).toBe("resource");
    reservations++;
    if (reservations === 1) await gate;
    const type = route.request().postDataJSON().contentType;
    await route.fulfill({ json: { key: `resource.fx_ada.test${reservations}.${type === "application/zip" ? "zip" : "md"}`, uploadUrl: "/unused", expiresAt: new Date(Date.now() + 60000).toISOString() } });
  });
  let fail = true;
  await page.route("**/api/uploads/*", async (route) => {
    expect(route.request().method()).toBe("PUT");
    if (fail && route.request().url().endsWith(".zip")) { await route.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Upload unavailable" } } }); return; }
    await route.fulfill({ json: { key: route.request().url().split("/").pop(), url: "/unused" } });
  });
  await input.setInputFiles([
    { name: "guide.md", mimeType: "application/octet-stream", buffer: Buffer.from("# Guide") },
    { name: "scripts.zip", mimeType: "application/x-zip-compressed", buffer: Buffer.from("PK fixture archive") },
  ]);
  await expect(dialog.getByText("Uploading resource files", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Share", exact: true })).toBeDisabled();
  await page.screenshot({ path: `docs/handoffs/screenshots/3.9-${info.project.name}-loading.png` });
  release();
  await expect(dialog.getByRole("alert")).toContainText("Upload unavailable");
  await expect(dialog.getByText("guide.md", { exact: false })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/3.9-${info.project.name}-error.png` });
  fail = false;
  await input.setInputFiles({ name: "scripts.zip", mimeType: "application/zip", buffer: Buffer.from("PK fixture archive") });
  await expect(dialog.getByText("Runs code", { exact: true })).toBeVisible();
  await expect(dialog.getByText("(1 KB)")).toHaveCount(2);
  await dialog.getByRole("button", { name: "Remove guide.md" }).click();
  await expect(dialog.getByRole("button", { name: "Remove guide.md" })).toHaveCount(0);
  await page.screenshot({ path: `docs/handoffs/screenshots/3.9-${info.project.name}-files.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
  const created = page.waitForRequest((r) => r.method() === "POST" && new URL(r.url()).pathname === "/api/resources");
  await dialog.getByRole("button", { name: "Share", exact: true }).click();
  expect((await created).postDataJSON().fileKeys).toEqual(["resource.fx_ada.test3.zip"]);
  await expect(page).toHaveURL(/\/resources\/fixture-new-resource$/);
});
