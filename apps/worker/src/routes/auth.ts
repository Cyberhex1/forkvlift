import { and, eq, gt, isNull } from "drizzle-orm";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Hono } from "hono";
import { COOKIES } from "@forkvlift/shared";
import type { AppEnv } from "../env";
import { getDb, schema } from "../core/db";
import { HttpError, mount } from "../core/http";
import { randomToken, sha256Hex } from "../core/ids";
import { clientIp, safeReturnTo, verifyTurnstile } from "../core/security";
import { createSession, destroySession } from "../core/auth/session";
import { upsertEmailUser, upsertGithubUser, type GithubProfile } from "../core/auth/users";

const GITHUB_UA = "ForkvLift (+https://github.com/Cyberhex1/forkvlift)";
const MAGIC_LINK_MINUTES = 15;

export function registerAuth(app: Hono<AppEnv>) {
  mount(app, "me", (_, c) => ({ user: c.get("user") }));

  mount(app, "githubStart", ({ query }, c) => {
    if (!c.env.GITHUB_CLIENT_ID) throw new HttpError("unavailable", "GitHub sign-in is not configured");
    const url = new URL(c.req.url);
    const state = randomToken(24);
    const returnTo = safeReturnTo(query.returnTo);
    setCookie(c, COOKIES.oauthState, `${state}|${returnTo}`, {
      httpOnly: true,
      secure: url.protocol === "https:",
      sameSite: "Lax",
      path: "/api/auth/github",
      maxAge: 600,
    });
    const authorize = new URL("https://github.com/login/oauth/authorize");
    authorize.searchParams.set("client_id", c.env.GITHUB_CLIENT_ID);
    authorize.searchParams.set("redirect_uri", `${url.origin}/api/auth/github/callback`);
    authorize.searchParams.set("scope", "read:user user:email");
    authorize.searchParams.set("state", state);
    authorize.searchParams.set("allow_signup", "true");
    return c.redirect(authorize.toString(), 302);
  });

  mount(app, "githubCallback", async ({ query }, c) => {
    const url = new URL(c.req.url);
    const cookie = getCookie(c, COOKIES.oauthState) ?? "";
    deleteCookie(c, COOKIES.oauthState, { path: "/api/auth/github", secure: url.protocol === "https:" });
    const [expectedState, rawReturnTo] = cookie.split("|");
    const returnTo = safeReturnTo(rawReturnTo);

    if (query.error) return c.redirect(`/?auth_error=${encodeURIComponent(query.error)}`, 302);
    if (!query.code || !query.state || !expectedState || !timingSafeEqual(query.state, expectedState)) {
      return c.redirect("/?auth_error=state_mismatch", 302);
    }
    if (!c.env.GITHUB_CLIENT_ID || !c.env.GITHUB_CLIENT_SECRET) throw new HttpError("unavailable", "GitHub sign-in is not configured");

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", "user-agent": GITHUB_UA },
      body: JSON.stringify({
        client_id: c.env.GITHUB_CLIENT_ID,
        client_secret: c.env.GITHUB_CLIENT_SECRET,
        code: query.code,
        redirect_uri: `${url.origin}/api/auth/github/callback`,
      }),
    });
    const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: string };
    if (!tokenJson.access_token) return c.redirect(`/?auth_error=${encodeURIComponent(tokenJson.error ?? "token")}`, 302);

    const gh = { authorization: `Bearer ${tokenJson.access_token}`, accept: "application/vnd.github+json", "user-agent": GITHUB_UA };
    const [userRes, emailsRes] = await Promise.all([
      fetch("https://api.github.com/user", { headers: gh }),
      fetch("https://api.github.com/user/emails", { headers: gh }),
    ]);
    if (!userRes.ok) return c.redirect("/?auth_error=github_user", 302);
    const profile = (await userRes.json()) as GithubProfile;
    const emails = emailsRes.ok ? ((await emailsRes.json()) as { email: string; primary: boolean; verified: boolean }[]) : [];
    const email = emails.find((e) => e.primary && e.verified)?.email.toLowerCase() ?? null;

    // The GitHub token is not stored; repo-scoped actions (task 2.2) will request their own grant.
    const userId = await upsertGithubUser(c.env, profile, email);
    const banned = (await getDb(c.env).select({ bannedAt: schema.users.bannedAt }).from(schema.users).where(eq(schema.users.id, userId)).limit(1))[0];
    if (banned?.bannedAt) return c.redirect("/?auth_error=banned", 302);
    await createSession(c, userId);
    return c.redirect(returnTo, 302);
  });

  mount(app, "magicLinkRequest", async ({ body }, c) => {
    await verifyTurnstile(c.env, body.turnstileToken, clientIp(c.req.raw));
    const token = randomToken();
    const email = body.email.toLowerCase();
    await getDb(c.env)
      .insert(schema.magicLinkTokens)
      .values({ id: await sha256Hex(token), email, returnTo: safeReturnTo(body.returnTo), expiresAt: new Date(Date.now() + MAGIC_LINK_MINUTES * 60_000) });
    const link = `${new URL(c.req.url).origin}/api/auth/magic-link/verify?token=${token}`;
    if (c.env.ENVIRONMENT === "local") {
      console.log(`[magic-link] ${email}: ${link}`);
    } else {
      // Email sending (Cloudflare Email / Resend) lands with task 2.3.
      throw new HttpError("unavailable", "Email sign-in is not available yet. Use GitHub.");
    }
    // Same response whether or not the address has an account.
    return { ok: true as const };
  });

  mount(app, "magicLinkVerify", async ({ query }, c) => {
    const db = getDb(c.env);
    const id = await sha256Hex(query.token);
    const row = (
      await db
        .select()
        .from(schema.magicLinkTokens)
        .where(and(eq(schema.magicLinkTokens.id, id), isNull(schema.magicLinkTokens.usedAt), gt(schema.magicLinkTokens.expiresAt, new Date())))
        .limit(1)
    )[0];
    if (!row) return c.redirect("/?auth_error=link_expired", 302);
    await db.update(schema.magicLinkTokens).set({ usedAt: new Date() }).where(eq(schema.magicLinkTokens.id, id));
    const userId = await upsertEmailUser(c.env, row.email);
    await createSession(c, userId);
    return c.redirect(safeReturnTo(row.returnTo), 302);
  });

  mount(app, "logout", async (_, c) => {
    await destroySession(c);
    return { ok: true as const };
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
