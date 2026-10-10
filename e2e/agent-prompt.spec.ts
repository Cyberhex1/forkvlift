import { expect, test } from "playwright/test";
import type { ProjectDetail } from "@forkvlift/shared";

test("generated prompt reflects licensed, WIP and permission-first projects", async ({ page }, info) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text: string) => { sessionStorage.setItem("copied-prompt", text); } } }));
  for (const [slug, state] of [["fixture-pixel-planner", "licensed"], ["fixture-dungeon-toaster", "wip"], ["fixture-no-license-notes", "no-license"]]) {
    const project = await (await page.request.get(`/api/projects/${slug}`)).json() as ProjectDetail;
    await page.goto(`/p/${slug}`);
    const prompt = page.getByRole("textbox", { name: "Prompt to copy" });
    await expect(prompt).toBeVisible();
    const text = await prompt.inputValue();
    expect(text).toContain(JSON.stringify(project.name));
    expect(text).toContain(project.repoUrl);
    expect(text).toContain(project.stack[0] || "Not specified");
    expect(text).toContain(project.license?.spdx ?? "request permission");
    if (project.wipStatus?.whatWorks) expect(text).toContain(JSON.stringify(project.wipStatus.whatWorks));
    if (project.wipStatus?.whatsMissing) expect(text).toContain(JSON.stringify(project.wipStatus.whatsMissing));
    if (!project.license) { expect(text).not.toContain("work on a fork"); expect(text).not.toContain("git clone"); }
    await page.getByRole("button", { name: "Copy agent prompt", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Agent prompt copied" })).toBeVisible();
    expect(await page.evaluate(() => sessionStorage.getItem("copied-prompt"))).toBe(text);
    const bounds = await prompt.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(info.project.use.viewport!.width);
    await prompt.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `docs/handoffs/screenshots/4.4-${info.project.name}-${state}.png` });
  }
});

test("missing data, safe bounded README text, and clipboard progress/error/retry", async ({ page }, info) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => new Promise<void>((resolve, reject) => {
      window.addEventListener("clipboard-result", ((event: CustomEvent<boolean>) => event.detail ? resolve() : reject(new Error("Denied"))) as EventListener, { once: true });
    }) } });
  });
  let missing = true;
  await page.route("**/api/projects/fixture-pixel-planner", async route => {
    const project = await (await route.fetch()).json() as ProjectDetail;
    await route.fulfill({ json: { ...project, stack: [], description: "", tagline: "", wipStatus: null, starterPrompt: null, readmeHtml: missing ? null : "<p>Useful &amp; readable summary.</p><script>DO_NOT_INCLUDE_SCRIPT</script><style>DO_NOT_INCLUDE_STYLE</style><p>" + "Very long text. ".repeat(300) + "</p>" } });
  });
  await page.goto("/p/fixture-pixel-planner");
  const prompt = page.getByRole("textbox", { name: "Prompt to copy" });
  await expect(prompt).toHaveValue(/Not provided\. Inspect the repository README/);
  expect(await prompt.inputValue()).toContain("Not specified; verify in the repository.");
  expect(await prompt.inputValue()).toContain("Not described; verify the code and tests.");
  await prompt.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `docs/handoffs/screenshots/4.4-${info.project.name}-empty.png` });
  const copy = page.getByRole("button", { name: "Copy agent prompt", exact: true });
  await copy.click(); await expect(copy).toBeDisabled();
  await page.screenshot({ path: `docs/handoffs/screenshots/4.4-${info.project.name}-loading.png` });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("clipboard-result", { detail: false })));
  await expect(page.getByRole("alert").filter({ hasText: "Copy failed" })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/4.4-${info.project.name}-error.png` });
  await copy.click(); await page.evaluate(() => window.dispatchEvent(new CustomEvent("clipboard-result", { detail: true })));
  await expect(page.getByRole("status").filter({ hasText: "Agent prompt copied" })).toBeVisible();
  missing = false; await page.reload();
  await expect(prompt).toHaveValue(/Useful & readable summary/);
  const text = await prompt.inputValue();
  expect(text).toContain("[summary truncated]");
  expect(text).not.toContain("DO_NOT_INCLUDE");
  expect(text).not.toContain("<p>");
  expect(text.length).toBeLessThan(4000);
});
