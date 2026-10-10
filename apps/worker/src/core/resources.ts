/**
 * Task 3.5: the Resources library (skills, system prompts, workflows, MCP
 * configs…). A resource is "Proven" once 3 listed projects link it or 5 people
 * report it worked; admins can override either way.
 */
import type { ParsedInput, Resource, ResourceDetail, Routes, SessionUser } from "@forkvlift/shared";
import { HttpError, notFound } from "./errors";
import { newId, slugify } from "./ids";
import { decodeCursor, encodeCursor } from "./projects/list";
import { LISTED, parseJson } from "./projects/rows";
import { scriptFlags } from "./safety/scan";
import { assertOwnedUploads, mediaUrl } from "./uploads";

export const PROVEN_PROJECTS = 3;
export const PROVEN_REPORTS = 5;

interface ResourceRow {
  id: string;
  slug: string;
  type: Resource["type"];
  title: string;
  summary: string;
  body_md: string;
  license: string;
  tested_with: string | null;
  files: string | null;
  has_executable_code: number;
  scan_flags: string | null;
  proven_override: number | null;
  worked_count: number;
  didnt_work_count: number;
  rating_sum: number;
  rating_count: number;
  version: number;
  created_at: number;
  updated_at: number;
  author_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  avatar: string | null;
  linked: number;
}

const SELECT = `SELECT r.*, u.id AS author_id, u.username, u.display_name, u.avatar_url, av.config AS avatar,
  (SELECT count(*) FROM resource_projects rp JOIN projects p ON p.id = rp.project_id WHERE rp.resource_id = r.id AND ${LISTED}) AS linked
  FROM resources r JOIN users u ON u.id = r.author_id LEFT JOIN avatars av ON av.user_id = u.id`;

export function isProven(r: { proven_override: number | null; linked: number; worked_count: number }): boolean {
  if (r.proven_override !== null) return r.proven_override === 1;
  return r.linked >= PROVEN_PROJECTS || r.worked_count >= PROVEN_REPORTS;
}

function toResource(r: ResourceRow): Resource {
  return {
    id: r.id,
    slug: r.slug,
    type: r.type,
    title: r.title,
    summary: r.summary,
    author: { id: r.author_id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url, avatar: parseJson(r.avatar, null) },
    license: r.license,
    testedWith: parseJson(r.tested_with, []),
    proven: isProven(r),
    workedCount: r.worked_count,
    didntWorkCount: r.didnt_work_count,
    rating: r.rating_count ? Math.round((r.rating_sum / r.rating_count) * 10) / 10 : 0,
    ratingCount: r.rating_count,
    hasExecutableCode: r.has_executable_code === 1,
    createdAt: new Date(r.created_at).toISOString(),
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export async function listResources(db: D1Database, q: ParsedInput<Routes["listResources"]>["query"]) {
  const limit = q.limit ?? 24;
  const cursor = decodeCursor(q.cursor);
  const where = ["r.deleted_at IS NULL"];
  const binds: unknown[] = [];
  if (q.type?.length) {
    where.push(`r.type IN (${q.type.map(() => "?").join(",")})`);
    binds.push(...q.type);
  }
  if (q.q) {
    where.push(`(r.title LIKE ? OR r.summary LIKE ? OR r.body_md LIKE ?)`);
    const like = `%${q.q.replace(/[%_]/g, "")}%`;
    binds.push(like, like, like);
  }
  const { results } = await db
    .prepare(`SELECT * FROM (${SELECT} WHERE ${where.join(" AND ")}) ORDER BY worked_count - didnt_work_count DESC, rating_sum DESC, created_at DESC LIMIT ? OFFSET ?`)
    .bind(...binds, 500, 0)
    .all<ResourceRow>();
  // Proven is derived, so filter after mapping (the library is small; capped at 500).
  let items = results.map(toResource);
  if (q.proven !== undefined) items = items.filter((r) => r.proven === q.proven);
  const page = items.slice(cursor.o, cursor.o + limit);
  return { items: page, nextCursor: items.length > cursor.o + limit ? encodeCursor({ o: cursor.o + limit }) : null };
}

export async function getResource(db: D1Database, slug: string): Promise<ResourceDetail> {
  const r = await db.prepare(`${SELECT} WHERE r.slug = ? AND r.deleted_at IS NULL`).bind(slug).first<ResourceRow>();
  if (!r) throw notFound("Resource not found");
  const [projects, reports] = await db.batch<Record<string, unknown>>([
    db
      .prepare(
        `SELECT p.id, p.slug, p.name, u.id AS u_id, u.username, u.display_name, u.avatar_url FROM resource_projects rp JOIN projects p ON p.id = rp.project_id
         LEFT JOIN users u ON u.id = p.owner_id WHERE rp.resource_id = ? AND ${LISTED} LIMIT 50`,
      )
      .bind(r.id),
    db
      .prepare(
        `SELECT rr.id, rr.worked, rr.note, rr.created_at, u.id AS u_id, u.username, u.display_name, u.avatar_url FROM resource_reports rr JOIN users u ON u.id = rr.author_id
         WHERE rr.resource_id = ? AND u.deleted_at IS NULL ORDER BY rr.created_at DESC LIMIT 30`,
      )
      .bind(r.id),
  ]);
  const files = parseJson<{ path: string; size: number; key: string }[]>(r.files, []);
  type P = { id: string; slug: string; name: string; u_id: string | null; username: string | null; display_name: string | null; avatar_url: string | null };
  type Rep = { id: string; worked: number; note: string; created_at: number; u_id: string; username: string; display_name: string; avatar_url: string | null };
  return {
    ...toResource(r),
    bodyMd: r.body_md,
    files: files.map((f) => ({ path: f.path, size: f.size })),
    downloadUrl: files.length === 1 ? mediaUrl(files[0]!.key) : null,
    linkedProjects: ((projects?.results ?? []) as P[]).map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      author: p.u_id && p.username ? { id: p.u_id, username: p.username, displayName: p.display_name ?? p.username, avatarUrl: p.avatar_url, avatar: null } : null,
    })),
    reports: ((reports?.results ?? []) as Rep[]).map((x) => ({
      id: x.id,
      author: { id: x.u_id, username: x.username, displayName: x.display_name, avatarUrl: x.avatar_url, avatar: null },
      worked: x.worked === 1,
      note: x.note,
      createdAt: new Date(x.created_at).toISOString(),
    })),
    versions: [{ version: String(r.version), createdAt: new Date(r.updated_at).toISOString() }],
    scanFlags: parseJson<string[]>(r.scan_flags, []),
  };
}

/** Code blocks in languages that run things, or attached archives, mean "review before running". */
export function detectExecutable(bodyMd: string, filePaths: string[]): boolean {
  if (filePaths.some((p) => /\.(zip|sh|ps1|js|ts|py)$/i.test(p))) return true;
  return /```\s*(bash|sh|shell|zsh|powershell|ps1|pwsh|cmd|bat|python|py|js|javascript|ts|typescript|node)\b/i.test(bodyMd);
}

type CreateBody = ParsedInput<Routes["createResource"]>["body"];

export async function createResource(env: Env, user: SessionUser, body: CreateBody): Promise<ResourceDetail> {
  const db = env.DB;
  await assertOwnedUploads(env, user.id, body.fileKeys, ["resource"]);
  const projects = [...new Set(body.linkedProjectIds)];
  if (projects.length) {
    const { results } = await db.prepare(`SELECT p.id FROM projects p WHERE p.id IN (${projects.map(() => "?").join(",")}) AND ${LISTED}`).bind(...projects).all<{ id: string }>();
    if (results.length !== projects.length) throw new HttpError("invalid_request", "Link only public projects.");
  }
  const files = await Promise.all(
    body.fileKeys.map(async (key, i) => {
      const head = await env.MEDIA!.head(key);
      return { key, path: `${slugify(body.title) || "resource"}-${i + 1}.${key.split(".").pop()}`, size: head?.size ?? 0 };
    }),
  );
  // Scan the instructions themselves for install-style commands that pipe downloads into a shell, etc.
  const flags = scriptFlags("resource.sh", body.bodyMd);
  let slug = slugify(body.title) || "resource";
  for (let i = 2; await db.prepare(`SELECT 1 FROM resources WHERE slug = ?`).bind(slug).first(); i++) slug = `${slugify(body.title).slice(0, 70)}-${i}`;
  const id = newId("res");
  const now = Date.now();
  await db.batch([
    db
      .prepare(
        `INSERT INTO resources (id, slug, type, title, summary, body_md, author_id, license, tested_with, files, has_executable_code, scan_flags, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(id, slug, body.type, body.title.trim(), body.summary.trim(), body.bodyMd, user.id, body.license || "CC0-1.0", JSON.stringify(body.testedWith), JSON.stringify(files), detectExecutable(body.bodyMd, files.map((f) => f.path)) ? 1 : 0, JSON.stringify(flags), now, now),
    ...projects.map((pid) => db.prepare(`INSERT OR IGNORE INTO resource_projects (resource_id, project_id) VALUES (?, ?)`).bind(id, pid)),
  ]);
  return getResource(db, slug);
}

async function resourceId(db: D1Database, slug: string): Promise<string> {
  const r = await db.prepare(`SELECT id FROM resources WHERE slug = ? AND deleted_at IS NULL`).bind(slug).first<{ id: string }>();
  if (!r) throw notFound("Resource not found");
  return r.id;
}

async function summary(db: D1Database, id: string): Promise<Resource> {
  return toResource((await db.prepare(`${SELECT} WHERE r.id = ?`).bind(id).first<ResourceRow>())!);
}

/** "Worked for me" / "Didn't work": one report per person, latest wins. */
export async function reportResult(db: D1Database, userId: string, slug: string, worked: boolean, note: string): Promise<Resource> {
  const id = await resourceId(db, slug);
  await db.batch([
    db
      .prepare(`INSERT INTO resource_reports (id, resource_id, author_id, worked, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(resource_id, author_id) DO UPDATE SET worked = ?4, note = ?5, created_at = ?6`)
      .bind(newId("rr"), id, userId, worked ? 1 : 0, note, Date.now()),
    db
      .prepare(`UPDATE resources SET worked_count = (SELECT count(*) FROM resource_reports WHERE resource_id = ?1 AND worked = 1),
         didnt_work_count = (SELECT count(*) FROM resource_reports WHERE resource_id = ?1 AND worked = 0) WHERE id = ?1`)
      .bind(id),
  ]);
  return summary(db, id);
}

export async function rate(db: D1Database, userId: string, slug: string, stars: number): Promise<Resource> {
  const id = await resourceId(db, slug);
  await db.batch([
    db.prepare(`INSERT INTO resource_ratings (resource_id, user_id, stars, created_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(resource_id, user_id) DO UPDATE SET stars = ?3`).bind(id, userId, stars, Date.now()),
    db
      .prepare(`UPDATE resources SET rating_sum = (SELECT coalesce(sum(stars), 0) FROM resource_ratings WHERE resource_id = ?1),
         rating_count = (SELECT count(*) FROM resource_ratings WHERE resource_id = ?1) WHERE id = ?1`)
      .bind(id),
  ]);
  return summary(db, id);
}

export async function setProvenOverride(db: D1Database, slug: string, proven: boolean | null): Promise<void> {
  const id = await resourceId(db, slug);
  await db.prepare(`UPDATE resources SET proven_override = ? WHERE id = ?`).bind(proven === null ? null : proven ? 1 : 0, id).run();
}
