import { expect, test } from "playwright/test";
import type { CompetitionRound, EventEntry, Scorecard } from "@forkvlift/shared";

const slug = "fixture-tiny-tools-cup";
test("competition rules, event entry, unannounced and published winners", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" }); await page.goto("/competitions");
  await page.getByRole("link", { name: "Fixture: Tiny Tools Cup", exact: true }).press("Enter"); await expect(page.getByRole("heading", { name: "Prizes", exact: true })).toBeVisible();
  await expect(page.getByText("ForkLift never takes or pays money", { exact: false })).toBeVisible(); await expect(page.getByRole("link", { name: "Enter through the event" })).toHaveAttribute("href", "/events/fixture-build-jam");
  await page.screenshot({ path: `docs/handoffs/screenshots/4.14-${info.project.name}-rules.png`, fullPage: true });
  await page.getByRole("link", { name: "Winners", exact: true }).click(); await expect(page.getByText("Winners haven't been announced", { exact: true })).toBeVisible();
  await page.request.get("/api/dev/login?as=fx-admin"); const winner = await (await page.request.post("/api/admin/competitions/fx_comp_1/publish", { data: { expectedVersion: 2, awards: [{ prizeId: "fx_prize_1", entryId: "fx_entry_1", rationaleMd: "Useful tool" }] } })).json();
  await page.route(`**/api/competitions/${slug}/winners`, r => r.fulfill({ json: winner })); await page.reload(); await expect(page.getByRole("region", { name: "Published winners" })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/4.14-${info.project.name}-winners.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("judge authentication, draft, retained error and final immutable scorecard", async ({ page }, info) => {
  await page.goto(`/competitions/${slug}/judging`); await expect(page.getByRole("link", { name: "Sign in to judge" })).toBeVisible();
  await page.request.get("/api/dev/login?as=fx-admin"); await page.reload();
  await page.getByLabel("Score Usefulness", { exact: true }).fill("11"); await page.getByRole("button", { name: "Submit final scorecard" }).click(); await expect(page.getByRole("alert")).toContainText("within each criterion");
  await page.getByLabel("Score Usefulness", { exact: true }).fill(""); await page.getByRole("button", { name: "Submit final scorecard" }).click(); await expect(page.getByRole("alert")).toContainText("Score every criterion");
  await page.getByLabel("Score Usefulness", { exact: true }).fill("8"); await page.getByLabel("Judge note", { exact: true }).fill("Clear and useful. ".repeat(100));
  let fail = true; await page.route(`**/api/competitions/${slug}/scorecards/*`, r => fail ? r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Score save unavailable" } } }) : r.continue());
  await page.getByRole("button", { name: "Save scorecard draft" }).click(); await expect(page.getByRole("alert")).toContainText("Score save unavailable"); await expect(page.getByLabel("Score Usefulness", { exact: true })).toHaveValue("8");
  fail = false; await page.getByRole("button", { name: "Save scorecard draft" }).click(); await expect(page.getByText("Scorecard draft saved.", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/4.14-${info.project.name}-scorecard.png`, fullPage: true });
  await page.getByRole("button", { name: "Submit final scorecard" }).click(); const dialog = page.getByRole("dialog", { name: "Submit final scorecard?" }); await expect(dialog).toContainText("Usefulness: 8");
  const submitted = page.waitForRequest(r => r.method() === "PUT" && r.url().includes("/scorecards/")); await dialog.getByRole("button", { name: "Confirm final scores" }).click(); expect((await submitted).postDataJSON()).toMatchObject({ scores: [{ criterionId: "fx_crit_1", score: 8 }], submit: true });
  await expect(page.getByText("Scorecard submitted. Scores are final.")).toBeVisible(); await expect(page.getByLabel("Score Usefulness", { exact: true })).toBeDisabled();
  await page.request.get("/api/dev/login?as=fx-ada"); await page.reload(); await expect(page.getByLabel("Score Usefulness", { exact: true })).toBeDisabled(); await expect(page.getByRole("button", { name: "Submit final scorecard" })).toHaveCount(0);
});

test("competition loading/empty/error and judging permission recovery", async ({ page }, info) => {
  let release!: () => void; const gate = new Promise<void>(r => { release = r; });
  await page.route(/\/api\/competitions(?:\?|$)/, async r => { await gate; await r.fulfill({ json: { items: [], nextCursor: null } }); }); await page.goto("/competitions"); await expect(page.getByText("Loading competitions", { exact: true })).toBeAttached(); release(); await expect(page.getByText("No competitions yet", { exact: true })).toBeVisible();
  await page.screenshot({ path: `docs/handoffs/screenshots/4.14-${info.project.name}-empty.png` });
  await page.unroute(/\/api\/competitions(?:\?|$)/); await page.route(/\/api\/competitions(?:\?|$)/, r => r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Failed" } } })); await page.reload(); await expect(page.getByText("Couldn't load competitions", { exact: true })).toBeVisible(); await page.unroute(/\/api\/competitions(?:\?|$)/); await page.getByRole("button", { name: "Try again" }).click(); await expect(page.getByRole("link", { name: "Fixture: Tiny Tools Cup" })).toBeVisible();
  await page.request.get("/api/dev/login?as=fx-admin"); await page.route(`**/api/competitions/${slug}/judging`, r => r.fulfill({ status: 403, json: { error: { code: "forbidden", message: "Assigned judges only" } } })); await page.goto(`/competitions/${slug}/judging`); await expect(page.getByText("Assigned judges only", { exact: true })).toBeVisible();
  const judging = await (await page.request.get(`/api/competitions/${slug}/judging`)).json() as { competition: CompetitionRound; entries: EventEntry[]; scorecards: Scorecard[]; conflicts: string[] };
  await page.unroute(`**/api/competitions/${slug}/judging`); await page.route(`**/api/competitions/${slug}/judging`, r => r.fulfill({ json: { ...judging, entries: [] } })); await page.getByRole("button", { name: "Retry judging" }).click(); await expect(page.getByText("No entries to judge", { exact: true })).toBeVisible();
});

test.describe("competition admin", () => {
  test.use({ baseURL: process.env.E2E_ADMIN_URL ?? "http://127.0.0.1:8791" });
  test("create a draft with prize, criteria and judges; open and edit rules", async ({ page }, info) => {
    await page.request.get("/api/dev/login?as=fx-admin"); await page.goto("/competitions"); await page.getByRole("button", { name: "Create prize round" }).click();
    await page.getByLabel("Competition title", { exact: true }).fill("Useful tiny tools prize round"); await page.getByLabel("Competition slug").fill("useful-tiny-tools"); await page.getByLabel("Project event", { exact: true }).selectOption("fx_evt_1"); await page.getByLabel("Judging deadline").fill("2030-01-04T12:00"); await page.getByLabel("Judge usernames (comma separated)").fill("fx-bo");
    await page.getByRole("button", { name: "Add prize" }).click(); await page.getByLabel("Prize 1 label").fill("Useful tool award"); await page.getByLabel("Prize 1 sponsor", { exact: true }).fill("Community");
    await page.getByRole("button", { name: "Add criterion" }).click(); await page.getByLabel("Criterion 1 label").fill("Usefulness");
    let fail = true; await page.route("**/api/admin/competitions", r => fail ? r.fulfill({ status: 503, json: { error: { code: "unavailable", message: "Draft unavailable" } } }) : r.continue());
    await page.getByRole("button", { name: "Create draft round" }).click(); await expect(page.getByRole("alert")).toContainText("Draft unavailable"); fail = false;
    const created = page.waitForRequest(r => r.method() === "POST" && r.url().endsWith("/api/admin/competitions")); await page.getByRole("button", { name: "Create draft round" }).click(); expect((await created).postDataJSON()).toMatchObject({ prizes: [{ label: "Useful tool award" }], criteria: [{ label: "Usefulness", maxScore: 10, weight: 1 }], judgeUsernames: ["fx-bo"] });
    await page.getByRole("button", { name: "Open competition", exact: true }).click(); await expect(page.getByRole("button", { name: "Open competition" })).toHaveCount(0); await page.getByLabel("Edit rules", { exact: true }).fill("Clear rules. ".repeat(150)); await page.getByRole("button", { name: "Save rules", exact: true }).click();
    await page.screenshot({ path: `docs/handoffs/screenshots/4.14-${info.project.name}-admin-round.png`, fullPage: true });
    await page.getByRole("button", { name: "My judge scorecards" }).click(); await expect(page.getByRole("button", { name: "Save scorecard draft" })).toBeVisible();
    await page.getByLabel("Score Usefulness").fill("7"); await page.getByRole("button", { name: "Save scorecard draft" }).click(); await expect(page.getByText("Scorecard draft saved.", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Cancel competition", exact: true }).click();
    const cancelled = page.waitForRequest(r => r.method() === "PATCH" && r.url().includes("/api/admin/competitions/"));
    await page.getByRole("dialog", { name: "Cancel competition?" }).getByRole("button", { name: "Confirm cancel competition" }).click(); expect((await cancelled).postDataJSON()).toEqual({ cancelled: true });
    await expect(page.getByText("Published results and cancelled rounds cannot be edited.", { exact: true })).toBeVisible();
  });

  test("judge totals, award review, version conflict and final winners publication", async ({ page }, info) => {
    await page.request.get("/api/dev/login?as=fx-admin"); const list = await (await page.request.get("/api/competitions")).json();
    await page.route(/\/api\/competitions(?:\?|$)/, r => r.fulfill({ json: { ...list, items: list.items.map((round: CompetitionRound) => ({ ...round, status: "judging", judgingEndsAt: "2020-01-01T00:00:00Z" })) } }));
    await page.goto("/competitions"); await page.getByRole("button", { name: "Manage round" }).click(); await expect(page.getByRole("cell", { name: "0.8", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Add award" }).click(); await page.getByLabel("Award 1 prize", { exact: true }).selectOption("fx_prize_1"); await page.getByLabel("Award 1 entry", { exact: true }).selectOption("fx_entry_1"); await page.getByLabel("Award 1 rationale", { exact: true }).fill("Useful and easy to run."); await page.getByRole("button", { name: "Review winners" }).click();
    const dialog = page.getByRole("dialog", { name: "Publish final winners?" }); await expect(dialog).toContainText("Fixture: Pixel Planner");
    let fail = true; await page.route("**/api/admin/competitions/fx_comp_1/publish", r => fail ? r.fulfill({ status: 409, json: { error: { code: "conflict", message: "Round changed. Reload." } } }) : r.continue());
    await dialog.getByRole("button", { name: "Publish final winners" }).click(); await expect(dialog.getByRole("alert")).toContainText("Round changed");
    await page.screenshot({ path: `docs/handoffs/screenshots/4.14-${info.project.name}-publication.png` });
    await page.route(`**/api/competitions/${slug}`, r => r.fulfill({ json: { ...list.items[0], status: "judging", version: 3, judgingEndsAt: "2020-01-01T00:00:00Z" } })); await dialog.getByRole("button", { name: "Reload round" }).click(); await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: "Add award" }).click(); await page.getByLabel("Award 1 prize", { exact: true }).selectOption("fx_prize_1"); await page.getByLabel("Award 1 entry", { exact: true }).selectOption("fx_entry_1"); await page.getByRole("button", { name: "Review winners" }).click();
    fail = false; const published = page.waitForRequest(r => r.method() === "POST" && r.url().includes("/publish")); await dialog.getByRole("button", { name: "Publish final winners" }).click(); expect((await published).postDataJSON()).toMatchObject({ expectedVersion: 3, awards: [{ prizeId: "fx_prize_1", entryId: "fx_entry_1" }] });
    await expect(page.getByRole("link", { name: "View published winners on the public site" })).toBeVisible(); await expect(page.getByRole("button", { name: "Review winners" })).toHaveCount(0);
  });
});
