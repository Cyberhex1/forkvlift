/**
 * Task 5.9: showcase-only events (kind "show_off", e.g. "Show-off Saturday")
 * on the 4.6 events system. Same windows and rules as project events: makers
 * enter their own published showcases while submissions are open, everyone
 * else gets one vote per event while voting is open, and rankings count only
 * live entries and voters who aren't banned or deleted.
 */
import type { SessionUser, ShowcaseEventEntry } from "@forkvlift/shared";
import { HttpError, notFound } from "./errors";
import type { EventRow } from "./events";
import { statusOf } from "./events";
import { newId } from "./ids";
import { decodeCursor, encodeCursor } from "./projects/list";
import { parseJson } from "./projects/rows";
import { SHOWCASE_SELECT, VISIBLE, toCards, type ShowcaseRow } from "./showcases";

const iso = (ms: number) => new Date(ms).toISOString();
const VOTES = `(SELECT count(*) FROM showcase_ballots b JOIN users vu ON vu.id = b.voter_id WHERE b.entry_id = se.id AND vu.banned_at IS NULL AND vu.deleted_at IS NULL)`;

function assertShowcaseEvent(e: EventRow) {
  if (e.kind !== "show_off") throw new HttpError("invalid_request", "This event takes projects, not showcases.");
}

/** The viewer's own published showcases. */
export async function eligibleShowcaseIds(db: D1Database, userId: string): Promise<string[]> {
  const { results } = await db.prepare(`SELECT s.id FROM showcases s JOIN users u ON u.id = s.owner_id WHERE s.owner_id = ? AND ${VISIBLE}`).bind(userId).all<{ id: string }>();
  return results.map((r) => r.id);
}

export async function ballotOf(db: D1Database, eventId: string, voterId: string): Promise<string | null> {
  return (await db.prepare(`SELECT entry_id FROM showcase_ballots WHERE event_id = ? AND voter_id = ?`).bind(eventId, voterId).first<{ entry_id: string }>())?.entry_id ?? null;
}

interface EntryRow extends ShowcaseRow {
  entry_id: string;
  entry_submitted_by: string;
  entry_submitted_at: number;
  e_username: string;
  e_display_name: string;
  e_avatar_url: string | null;
  e_avatar: string | null;
  votes: number;
}

async function loadEntries(db: D1Database, e: EventRow, viewerId: string | null, opts: { sort: "newest" | "rank"; limit: number; offset: number; entryId?: string }): Promise<ShowcaseEventEntry[]> {
  const order = opts.sort === "rank" ? `votes DESC, se.submitted_at ASC, se.id ASC` : `se.submitted_at DESC, se.id DESC`;
  const select = SHOWCASE_SELECT.replace(
    "FROM showcases s",
    `, se.id AS entry_id, se.submitted_by AS entry_submitted_by, se.submitted_at AS entry_submitted_at,
       eu.username AS e_username, eu.display_name AS e_display_name, eu.avatar_url AS e_avatar_url, eav.config AS e_avatar, ${VOTES} AS votes
     FROM showcase_entries se JOIN showcases s ON s.id = se.showcase_id
     JOIN users eu ON eu.id = se.submitted_by LEFT JOIN avatars eav ON eav.user_id = eu.id`,
  );
  const { results } = await db
    .prepare(`${select} WHERE se.event_id = ? AND se.withdrawn_at IS NULL AND ${VISIBLE} ${opts.entryId ? `AND se.id = ?` : ""} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .bind(e.id, ...(opts.entryId ? [opts.entryId] : []), opts.limit, opts.offset)
    .all<EntryRow>();
  const cards = await toCards(db, results, viewerId);
  const mine = viewerId ? await ballotOf(db, e.id, viewerId) : null;

  // Ranks only mean something once submissions close; they cover every live entry.
  let ranks = new Map<string, number>();
  const status = statusOf(e);
  if (status === "voting" || status === "ended") {
    const { results: all } = await db
      .prepare(
        `SELECT se.id, ${VOTES} AS votes FROM showcase_entries se JOIN showcases s ON s.id = se.showcase_id JOIN users u ON u.id = s.owner_id
         WHERE se.event_id = ? AND se.withdrawn_at IS NULL AND ${VISIBLE} ORDER BY votes DESC, se.submitted_at ASC, se.id ASC`,
      )
      .bind(e.id)
      .all<{ id: string }>();
    ranks = new Map(all.map((r, i) => [r.id, i + 1]));
  }
  return results.map((r, i) => ({
    id: r.entry_id,
    eventId: e.id,
    showcase: cards[i]!,
    submittedBy: { id: r.entry_submitted_by, username: r.e_username, displayName: r.e_display_name, avatarUrl: r.e_avatar_url, avatar: parseJson(r.e_avatar, null) },
    submittedAt: iso(r.entry_submitted_at),
    voteCount: r.votes,
    viewerVoted: mine === r.entry_id,
    rank: ranks.get(r.entry_id) ?? null,
  }));
}

export async function listEntries(db: D1Database, e: EventRow, viewerId: string | null, q: { cursor?: string; limit?: number; sort?: "newest" | "rank" }) {
  if (e.kind !== "show_off") return { items: [], nextCursor: null };
  const limit = q.limit ?? 30;
  const cursor = decodeCursor(q.cursor);
  const items = await loadEntries(db, e, viewerId, { sort: q.sort ?? "newest", limit: limit + 1, offset: cursor.o });
  return { items: items.slice(0, limit), nextCursor: items.length > limit ? encodeCursor({ o: cursor.o + limit }) : null };
}

export async function submitEntry(db: D1Database, viewer: SessionUser, e: EventRow, showcaseId: string): Promise<ShowcaseEventEntry> {
  assertShowcaseEvent(e);
  if (statusOf(e) !== "submitting") throw new HttpError("conflict", "Submissions aren't open for this event.");
  if (!(await eligibleShowcaseIds(db, viewer.id)).includes(showcaseId)) throw new HttpError("forbidden", "Enter one of your own published showcases.");
  const id = newId("sentry");
  try {
    await db.prepare(`INSERT INTO showcase_entries (id, event_id, showcase_id, submitted_by, submitted_at) VALUES (?, ?, ?, ?, ?)`).bind(id, e.id, showcaseId, viewer.id, Date.now()).run();
  } catch (err) {
    if (String(err).includes("UNIQUE")) throw new HttpError("conflict", "That showcase is already entered.");
    throw err;
  }
  return (await loadEntries(db, e, viewer.id, { sort: "newest", limit: 1, offset: 0, entryId: id }))[0]!;
}

export async function withdrawEntry(db: D1Database, viewer: SessionUser, e: EventRow, entryId: string): Promise<void> {
  assertShowcaseEvent(e);
  const entry = await db.prepare(`SELECT submitted_by, withdrawn_at FROM showcase_entries WHERE id = ? AND event_id = ?`).bind(entryId, e.id).first<{ submitted_by: string; withdrawn_at: number | null }>();
  if (!entry || entry.submitted_by !== viewer.id) throw notFound("Entry not found");
  if (entry.withdrawn_at) return;
  if (statusOf(e) !== "submitting") throw new HttpError("conflict", "Entries can only be withdrawn while submissions are open.");
  await db.batch([
    db.prepare(`UPDATE showcase_entries SET withdrawn_at = ? WHERE id = ?`).bind(Date.now(), entryId),
    db.prepare(`DELETE FROM showcase_ballots WHERE entry_id = ?`).bind(entryId),
  ]);
}

export async function vote(db: D1Database, viewer: SessionUser, e: EventRow, entryId: string | null): Promise<{ entryId: string | null }> {
  if (statusOf(e) !== "voting") throw new HttpError("conflict", "Voting isn't open for this event.");
  if (entryId === null) {
    await db.prepare(`DELETE FROM showcase_ballots WHERE event_id = ? AND voter_id = ?`).bind(e.id, viewer.id).run();
    return { entryId: null };
  }
  const entry = await db
    .prepare(`SELECT se.id, s.owner_id FROM showcase_entries se JOIN showcases s ON s.id = se.showcase_id JOIN users u ON u.id = s.owner_id WHERE se.id = ? AND se.event_id = ? AND se.withdrawn_at IS NULL AND ${VISIBLE}`)
    .bind(entryId, e.id)
    .first<{ id: string; owner_id: string }>();
  if (!entry) throw notFound("Entry not found");
  if (entry.owner_id === viewer.id) throw new HttpError("forbidden", "You can't vote for your own entry.");
  await db
    .prepare(`INSERT INTO showcase_ballots (event_id, voter_id, entry_id, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(event_id, voter_id) DO UPDATE SET entry_id = ?3, updated_at = ?4`)
    .bind(e.id, viewer.id, entryId, Date.now())
    .run();
  return { entryId };
}
