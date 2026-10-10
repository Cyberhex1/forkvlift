import { eq, sql } from "drizzle-orm";
import { DEFAULT_USER_SETTINGS, LIMITS } from "@forkvlift/shared";
import { getDb, schema } from "../db";
import { newId } from "../ids";

export interface GithubProfile {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  html_url: string;
  blog: string | null;
  location: string | null;
  bio: string | null;
}

function isAdminLogin(env: Env, login: string): boolean {
  return (env.ADMIN_GITHUB_LOGINS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(login.toLowerCase());
}

/** Pick a free username based on `base` (case-insensitive unique). */
export async function freeUsername(env: Env, base: string): Promise<string> {
  const db = getDb(env);
  const clean =
    base
      .replace(/[^A-Za-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, LIMITS.usernameMax - 5) || "builder";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? clean : `${clean}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const taken = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(sql`lower(${schema.users.username}) = ${candidate.toLowerCase()}`)
      .limit(1);
    if (!taken.length) return candidate.length >= LIMITS.usernameMin ? candidate : `${candidate}-x`;
  }
  return `builder-${crypto.randomUUID().slice(0, 8)}`;
}

/** Create or refresh the user behind a GitHub login. Returns the user id. */
export async function upsertGithubUser(env: Env, gh: GithubProfile, email: string | null): Promise<string> {
  const db = getDb(env);
  const role = isAdminLogin(env, gh.login) ? "admin" : "user";
  const existing = await db.select().from(schema.users).where(eq(schema.users.githubId, gh.id)).limit(1);
  const found = existing[0];
  if (found) {
    await db
      .update(schema.users)
      .set({
        githubLogin: gh.login,
        avatarUrl: gh.avatar_url,
        // Never demote an existing admin here; never promote without the allowlist.
        role: found.role === "admin" ? "admin" : role,
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, found.id));
    return found.id;
  }

  // An account created by magic link with the same verified email is linked, not duplicated.
  if (email) {
    const byEmail = (await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1))[0];
    if (byEmail && !byEmail.githubId) {
      await db
        .update(schema.users)
        .set({ githubId: gh.id, githubLogin: gh.login, avatarUrl: byEmail.avatarUrl ?? gh.avatar_url, role, updatedAt: new Date() })
        .where(eq(schema.users.id, byEmail.id));
      return byEmail.id;
    }
  }

  const id = newId("usr");
  const username = await freeUsername(env, gh.login);
  await db.batch([
    db.insert(schema.users).values({
      id,
      githubId: gh.id,
      githubLogin: gh.login,
      username,
      displayName: (gh.name ?? gh.login).slice(0, 80),
      email,
      avatarUrl: gh.avatar_url,
      role,
    }),
    db.insert(schema.profiles).values({
      userId: id,
      bio: (gh.bio ?? "").slice(0, 2000),
      location: gh.location?.slice(0, 80) ?? null,
      links: { github: gh.html_url, website: gh.blog ? normalizeUrl(gh.blog) : null, socials: [], donation: null },
      showcase: [],
      settings: DEFAULT_USER_SETTINGS,
    }),
  ]);
  return id;
}

/** Find or create the user for a verified magic-link email. */
export async function upsertEmailUser(env: Env, email: string): Promise<string> {
  const db = getDb(env);
  const found = (await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1))[0];
  if (found) return found.id;
  const id = newId("usr");
  const username = await freeUsername(env, email.split("@")[0] ?? "builder");
  await db.batch([
    db.insert(schema.users).values({ id, username, displayName: username, email, role: "user" }),
    db.insert(schema.profiles).values({
      userId: id,
      links: { github: null, website: null, socials: [], donation: null },
      showcase: [],
      settings: DEFAULT_USER_SETTINGS,
    }),
  ]);
  return id;
}

function normalizeUrl(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const withScheme = /^https?:\/\//i.test(v) ? v : `https://${v}`;
  try {
    return new URL(withScheme).toString();
  } catch {
    return null;
  }
}
