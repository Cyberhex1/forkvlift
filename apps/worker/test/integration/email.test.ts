import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushNotificationEmails, sendWeeklyDigests } from "../../src/email/deliver";
import { notify } from "../../src/core/notify";
import { env, resetDb, seedUser } from "./helpers";

interface Sent {
  to: string;
  subject: string;
  html: string;
  text: string;
}
let sent: Sent[] = [];
/** Env with Resend configured; fetch is stubbed to record what would be sent. */
const mailEnv = () => ({ ...env, RESEND_API_KEY: "re_test", SITE_ORIGIN: "https://forklift.example" }) as unknown as Env;

beforeEach(async () => {
  await resetDb();
  await env.DB.prepare(`DELETE FROM notifications`).run();
  await seedUser("usr_ada", "ada");
  await seedUser("usr_bo", "bo");
  await env.DB.batch([
    env.DB.prepare(`UPDATE users SET email = 'ada@example.invalid' WHERE id = 'usr_ada'`),
    env.DB.prepare(`UPDATE users SET email = 'bo@example.invalid' WHERE id = 'usr_bo'`),
  ]);
  sent = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    if (url === "https://api.resend.com/emails") {
      const body = JSON.parse(String(init.body)) as { to: string[]; subject: string; html: string; text: string };
      sent.push({ to: body.to[0]!, subject: body.subject, html: body.html, text: body.text });
      return Response.json({ id: "x" });
    }
    return new Response("unexpected", { status: 500 });
  });
});
afterEach(() => vi.unstubAllGlobals());

const setSettings = (userId: string, settings: object) =>
  env.DB.prepare(`UPDATE profiles SET settings = ? WHERE user_id = ?`).bind(JSON.stringify(settings), userId).run();

describe("notification emails", () => {
  it("emails defaults (messages, collab requests) once, with absolute links", async () => {
    await notify(env.DB, [
      { userId: "usr_ada", type: "message", actorId: "usr_bo", title: "New message from bo", href: "/messages?c=1" },
      { userId: "usr_ada", type: "fork", actorId: "usr_bo", title: "bo forked your project", href: "/p/x" },
    ]);
    expect(await flushNotificationEmails(mailEnv())).toEqual({ sent: 1, skipped: 1 });
    expect(sent[0]).toMatchObject({ to: "ada@example.invalid", subject: "New message from bo" });
    expect(sent[0]!.text).toContain("https://forklift.example/messages?c=1");
    expect(await flushNotificationEmails(mailEnv())).toEqual({ sent: 0, skipped: 0 });
  });

  it("follows per-type preferences and skips what was already read", async () => {
    await setSettings("usr_ada", { notifications: { fork: { email: true, push: false }, message: { email: false, push: false } } });
    await notify(env.DB, [
      { userId: "usr_ada", type: "fork", actorId: "usr_bo", title: "Forked", href: "/p/x" },
      { userId: "usr_ada", type: "message", actorId: "usr_bo", title: "Hi", href: "/messages" },
      { userId: "usr_ada", type: "collab_request", actorId: "usr_bo", title: "Collab?", href: "/messages" },
    ]);
    await env.DB.prepare(`UPDATE notifications SET read_at = 1 WHERE title = 'Collab?'`).run();
    await flushNotificationEmails(mailEnv());
    expect(sent.map((s) => s.subject)).toEqual(["Forked"]);
  });

  it("escapes user-controlled text", async () => {
    await notify(env.DB, [{ userId: "usr_ada", type: "message", actorId: "usr_bo", title: "<script>alert(1)</script>", href: "/messages" }]);
    await flushNotificationEmails(mailEnv());
    expect(sent[0]!.html).not.toContain("<script>");
    expect(sent[0]!.html).toContain("&lt;script&gt;");
  });

  it("marks everything handled without sending when no provider is configured", async () => {
    await notify(env.DB, [{ userId: "usr_ada", type: "message", actorId: "usr_bo", title: "Hi", href: "/m" }]);
    expect(await flushNotificationEmails(env)).toEqual({ sent: 0, skipped: 1 });
    expect(sent).toHaveLength(0);
  });
});

describe("weekly digest", () => {
  it("goes only to opted-in users with news, at most once a week", async () => {
    await setSettings("usr_ada", { weeklyDigest: true });
    await setSettings("usr_bo", { weeklyDigest: true });
    await notify(env.DB, [{ userId: "usr_ada", type: "fork", actorId: "usr_bo", title: "bo forked your project", href: "/p/x" }]);
    expect(await sendWeeklyDigests(mailEnv())).toBe(1);
    expect(sent[0]).toMatchObject({ to: "ada@example.invalid" });
    expect(sent[0]!.subject).toMatch(/Your week on ForkLift: 1 update/);
    expect(await sendWeeklyDigests(mailEnv())).toBe(0);
  });
});
