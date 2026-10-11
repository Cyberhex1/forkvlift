/**
 * Task 4.3: public API keys. A key looks like `fl_<12 hex>_<32 hex>`; only its
 * SHA-256 is stored, and the first part doubles as a visible prefix.
 */
import type { ApiKey } from "@forkvlift/shared";
import { HttpError, notFound } from "./errors";
import { newId, sha256Hex } from "./ids";

export const MAX_ACTIVE_KEYS = 5;
const KEY_SHAPE = /^fl_[0-9a-f]{12}_[0-9a-f]{32}$/;

interface KeyRow {
  id: string;
  user_id: string;
  name: string;
  prefix: string;
  created_at: number;
  last_used_at: number | null;
  revoked_at: number | null;
}

const toKey = (r: KeyRow): ApiKey => ({
  id: r.id,
  name: r.name,
  prefix: r.prefix,
  createdAt: new Date(r.created_at).toISOString(),
  lastUsedAt: r.last_used_at ? new Date(r.last_used_at).toISOString() : null,
});

const hex = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");

export async function listKeys(db: D1Database, userId: string): Promise<ApiKey[]> {
  const { results } = await db.prepare(`SELECT * FROM api_keys WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC`).bind(userId).all<KeyRow>();
  return results.map(toKey);
}

export async function createKey(db: D1Database, userId: string, name: string): Promise<{ key: ApiKey; secret: string }> {
  const active = await db.prepare(`SELECT count(*) AS n FROM api_keys WHERE user_id = ? AND revoked_at IS NULL`).bind(userId).first<{ n: number }>();
  if ((active?.n ?? 0) >= MAX_ACTIVE_KEYS) throw new HttpError("conflict", `You can have up to ${MAX_ACTIVE_KEYS} keys. Revoke one first.`);
  const prefix = `fl_${hex(6)}`;
  const secret = `${prefix}_${hex(16)}`;
  const row: KeyRow = { id: newId("key"), user_id: userId, name: name.trim(), prefix, created_at: Date.now(), last_used_at: null, revoked_at: null };
  await db
    .prepare(`INSERT INTO api_keys (id, user_id, name, prefix, key_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(row.id, userId, row.name, prefix, await sha256Hex(secret), row.created_at)
    .run();
  return { key: toKey(row), secret };
}

export async function revokeKey(db: D1Database, userId: string, id: string): Promise<void> {
  const res = await db.prepare(`UPDATE api_keys SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL`).bind(Date.now(), id, userId).run();
  if (!res.meta.changes) throw notFound("Key not found");
}

/**
 * The key behind an `Authorization: Bearer` header. Returns null for no
 * header; throws for a malformed, unknown, revoked or banned-owner key.
 */
export async function keyFromRequest(db: D1Database, req: Request): Promise<{ id: string; userId: string } | null> {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const secret = auth.replace(/^Bearer\s+/i, "").trim();
  if (!KEY_SHAPE.test(secret)) throw new HttpError("unauthorized", "That API key isn't valid.");
  const row = await db
    .prepare(
      `SELECT k.id, k.user_id, k.last_used_at FROM api_keys k JOIN users u ON u.id = k.user_id
       WHERE k.key_hash = ? AND k.revoked_at IS NULL AND u.deleted_at IS NULL AND u.banned_at IS NULL`,
    )
    .bind(await sha256Hex(secret))
    .first<{ id: string; user_id: string; last_used_at: number | null }>();
  if (!row) throw new HttpError("unauthorized", "That API key isn't valid or was revoked.");
  // Record use at most once an hour.
  if (!row.last_used_at || Date.now() - row.last_used_at > 3_600_000) {
    await db.prepare(`UPDATE api_keys SET last_used_at = ? WHERE id = ?`).bind(Date.now(), row.id).run();
  }
  return { id: row.id, userId: row.user_id };
}
