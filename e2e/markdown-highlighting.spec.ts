import { expect, test, type Page } from "playwright/test";
import type { ThreadDetail } from "@forkvlift/shared";

async function markdown(page: Page, bodyMd: string) {
  const response = await page.request.get("/api/forum/threads/fx_thr_1");
  const data = await response.json() as ThreadDetail;
  data.posts = [{ ...data.posts[0]!, bodyMd }];
  await page.route(/\/api\/forum\/threads\/fx_thr_1(?:\?|$)/, (route) => route.fulfill({ json: data }));
}
const fence = (language: string, source: string) => `\`\`\`${language}\n${source}\n\`\`\``;

test("safe highlighting preserves code and uses theme tokens", async ({ page }, info) => {
  const samples = [
    ["js", 'const message = "<img src=x onerror=alert(1)>"; // safe text'],
    ["ts", "const count: number = 42;"],
    ["tsx", 'const view = <button title="Save">Save</button>;'],
    ["json", '{"enabled": true, "count": 42}'],
    ["py", 'def greet(name):\n    return "Hello " + name'],
    ["sh", 'echo "review before running"'],
    ["html", '<script>alert("text only")</script>'],
    ["css", ".panel { display: flex; }"],
    ["sql", "SELECT name FROM projects WHERE public = true;"],
    ["ps1", 'Write-Output "review first"'],
  ];
  await markdown(page, samples.map(([lang, code]) => fence(lang!, code!)).join("\n\n"));
  await page.goto("/forum/t/fx_thr_1");
  for (const [lang, source] of samples) {
    const block = page.locator(`pre[data-lang="${lang}"]`);
    await expect(block.locator("code")).toHaveText(source!);
    await expect(block.locator("[data-syntax-token]").first()).toBeVisible();
    await expect(block.locator("img, script, button")).toHaveCount(0);
  }
  const keyword = page.locator('pre[data-lang="js"] [data-syntax-token="keyword"]').first();
  await expect(keyword).toHaveClass("text-accent");
  for (const theme of ["light", "dark", "retro"]) {
    await page.evaluate((value) => document.documentElement.dataset.theme = value, theme);
    expect(await keyword.evaluate((element) => getComputedStyle(element).color)).toBe(await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.className = "text-accent";
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    }));
    await page.screenshot({ path: `docs/handoffs/screenshots/3.8-${info.project.name}-${theme}.png`, fullPage: true });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("unknown, unlabelled and large code stays plain without loading highlighter", async ({ page }) => {
  const loaded: string[] = [];
  page.on("request", (request) => { if (request.url().includes("refractor")) loaded.push(request.url()); });
  const large = "x".repeat(20001);
  await markdown(page, [fence("unknownlang", "<img src=x onerror=alert(1)>"), fence("", "plain code"), fence("js", large)].join("\n\n"));
  await page.goto("/forum/t/fx_thr_1");
  await expect(page.locator('pre[data-lang="unknownlang"] code')).toHaveText("<img src=x onerror=alert(1)>");
  await expect(page.locator("pre:not([data-lang]) code")).toHaveText("plain code");
  await expect(page.locator('pre[data-lang="js"] code')).toHaveText(large);
  await expect(page.locator("pre span, pre img")).toHaveCount(0);
  expect(loaded).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width);
});

test("code remains readable during lazy loading", async ({ page }, info) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/*refractor*", async (route) => { await gate; await route.continue(); });
  await markdown(page, fence("js", 'const greeting = "hello";'));
  await page.goto("/forum/t/fx_thr_1", { waitUntil: "domcontentloaded" });
  const code = page.locator("pre code");
  await expect(code).toHaveText('const greeting = "hello";');
  await expect(code.locator("span")).toHaveCount(0);
  await page.screenshot({ path: `docs/handoffs/screenshots/3.8-${info.project.name}-loading.png` });
  release();
  await expect(code.locator('[data-syntax-token="keyword"]')).toHaveText("const");
});

test("failed lazy download falls back to plain safe code", async ({ page }) => {
  await page.route("**/*refractor*", (route) => route.abort());
  await markdown(page, fence("js", 'const greeting = "<script>alert(1)</script>";'));
  await page.goto("/forum/t/fx_thr_1");
  await expect(page.locator("pre code")).toHaveText('const greeting = "<script>alert(1)</script>";');
  await expect(page.locator("pre span, pre script")).toHaveCount(0);
});
