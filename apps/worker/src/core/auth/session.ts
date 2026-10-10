import { and, eq, gt } from "drizzle-orm";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { COOKIES, DEFAULT_USER_SETTINGS, type SessionUser } from "@forkvlift/shared";
import type { AppEnv } from "../../env";
import { getDb, schema } from "../db";
import { randomToken, sha256Hex } from "../ids";

const SESSION_DAYS = 30;

type C = Context<AppEnv>;

function cookieSecure(c: C) {
  return new URL(c.req.url).protocol === "https:";
}

export async function createSession(c: C, userId: string): Promise<void> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await getDb(c.env)
    .insert(schema.sessions)
    .values({ id: await sha256Hex(token), userId, userAgent: c.req.header("user-agent")?.slice(0, 200) ?? null, expiresAt });
  setCookie(c, COOKIES.session, token, {
    httpOnly: true,
    secure: cookieSecure(c),
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(c: C): Promise<void> {
  const token = getCookie(c, COOKIES.session);
  if (token) {
    await getDb(c.env).delete(schema.sessions).where(eq(schema.sessions.id, await sha256Hex(token)));
  }
  deleteCookie(c, COOKIES.session, { path: "/", secure: cookieSecure(c) });
}

export async function sessionUserFromCookie(c: C): Promise<SessionUser | null> {
  const token = getCookie(c, COOKIES.session);
  if (!token) return null;
  const db = getDb(c.env);
  const rows = await db
    .select({ user: schema.users, profile: schema.profiles, avatar: schema.avatars })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .leftJoin(schema.profiles, eq(schema.profiles.userId, schema.users.id))
    .leftJoin(schema.avatars, eq(schema.avatars.userId, schema.users.id))
    .where(and(eq(schema.sessions.id, await sha256Hex(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  const row = rows[0];
  if (!row || row.user.deletedAt || row.user.bannedAt) return null;
  return toSessionUser(row.user, row.profile, row.avatar);
}

export function toSessionUser(
  user: typeof schema.users.$inferSelect,
  profile: typeof schema.profiles.$inferSelect | null,
  avatar: typeof schema.avatars.$inferSelect | null,
): SessionUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    avatar: avatar?.config ?? null,
    role: user.role,
    email: user.email,
    githubLogin: user.githubLogin,
    settings: { ...DEFAULT_USER_SETTINGS, ...(profile?.settings ?? {}) },
  };
}
