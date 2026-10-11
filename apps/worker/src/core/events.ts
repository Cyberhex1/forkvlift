/**
 * Task 4.6: launch days, Fork Friday and build jams. An event has three
 * windows (scheduled → submitting → voting → ended), all judged by the server
 * clock. Owners enter their own public, licensed projects; everyone else gets
 * one vote per event. Rankings come only from ballots for live entries, so
 * withdrawn or hidden projects and banned voters never count.
 */
import type { EventEntry, GrowthEvent, GrowthEventDetail, GrowthEventKind, GrowthEventStatus, SessionUser } from "@forkvlift/shared";
import { HttpError, notFound } from "./errors";
import { newId } from "./ids";
import { decodeCursor, encodeCursor } from "./projects/list";
import { LISTED, parseJson, rowsToCards, type ProjectRow } from "./projects/rows";

export interface EventRow {
  id: string;
  slug: string;
  kind: GrowthEventKind;
  title: string;
  body_md: string;
  featured_project_id: string | null;
  starts_at: number;
  submission_ends_at: number;
  voting_ends_at: number;
  cancelled_at: number | null;
  f_slug: string | null;
  f_name: string | null;
  entry_count: number;
}

const EVENT_SELECT = `SELECT e.*, f.slug AS f_slug, f.name AS f_name,
  (SELECT count(*) FROM growth_entries ge JOIN projects p ON p.id = ge.project_id WHERE ge.event_id = e.id AND ge.withdrawn_at IS NULL AND ${LISTED} AND p.license_spdx IS NOT NULL) AS entry_count
  FROM growth_events e LEFT JOIN projects f ON f.id = e.featured_project_id`;

export function statusOf(e: Pick<EventRow, "starts_at" | "submission_ends_at" | "voting_ends_at" | "cancelled_at">, now = Date.now()): GrowthEventStatus {
  if (e.cancelled_at) return "cancelled";
  if (now < e.starts_at) return "scheduled";
  if (now < e.submission_ends_at) return "submitting";
  if (now < e.voting_ends_at) return "voting";
  return "ended";
}

const iso = (ms: number) => new Date(ms).toISOString();

function toEvent(r: EventRow, now = Date.now()): GrowthEvent {
  return {
    id: r.id,
    slug: r.slug,
    kind: r.kind,
    title: r.title,
    bodyMd: r.body_md,
    startsAt: iso(r.starts_at),
    submissionEndsAt: iso(r.submission_ends_at),
    votingEndsAt: iso(r.voting_ends_at),
    featuredProject: r.featured_project_id && r.f_slug ? { id: r.featured_project_id, slug: r.f_slug, name: r.f_name ?? r.f_slug, author: null } : null,
    status: statusOf(r, now),
    entryCount: r.entry_count,
  };
}

export async function eventById(db: D1Database, id: string): Promise<EventRow | null> {
  return db.prepare(`${EVENT_SELECT} WHERE e.id = ?`).bind(id).first<EventRow>();
}

async function eventBySlug(db: D1Database, slug: string): Promise<EventRow> {
  const e = await db.prepare(`${EVENT_SELECT} WHERE e.slug = ?`).bind(slug).first<EventRow>();
  if (!e) throw notFound("Event not found");
  return e;
}

export async function listEvents(db: D1Database, q: { cursor?: string; limit?: number; kind?: GrowthEventKind; status?: GrowthEventStatus }) {
  const limit = q.limit ?? 20;
  const cursor = decodeCursor(q.cursor);
  const now = Date.now();
  const where: string[] = [];
  const binds: unknown[] = [];
  if (q.kind) {
    where.push(`e.kind = ?`);
    binds.push(q.kind);
  }
  const statusSql: Record<GrowthEventStatus, string> = {
    cancelled: `e.cancelled_at IS NOT NULL`,
    scheduled: `e.cancelled_at IS NULL AND e.starts_at > ${now}`,
    submitting: `e.cancelled_at IS NULL AND e.starts_at <= ${now} AND e.submission_ends_at > ${now}`,
    voting: `e.cancelled_at IS NULL AND e.submission_ends_at <= ${now} AND e.voting_ends_at > ${now}`,
    ended: `e.cancelled_at IS NULL AND e.voting_ends_at <= ${now}`,
  };
  if (q.status) where.push(statusSql[q.status]);
  // Live and upcoming first, then the most recent past events.
  const { results } = await db
    .prepare(`${EVENT_SELECT} ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY (e.cancelled_at IS NULL AND e.voting_ends_at > ${now}) DESC, CASE WHEN e.voting_ends_at > ${now} THEN e.starts_at END ASC, e.voting_ends_at DESC LIMIT ? OFFSET ?`)
    .bind(...binds, limit + 1, cursor.o)
    .all<EventRow>();
  return { items: results.slice(0, limit).map((r) => toEvent(r, now)), nextCursor: results.length > limit ? encodeCursor({ o: cursor.o + limit }) : null };
}

/** Projects the viewer could enter: theirs, listed, licensed, and (Fork Friday) descended from the featured project. */
async function eligibleProjectIds(db: D1Database, e: EventRow, userId: string): Promise<string[]> {
  const { results } = await db.prepare(`SELECT p.id FROM projects p WHERE p.owner_id = ? AND ${LISTED} AND p.license_spdx IS NOT NULL`).bind(userId).all<{ id: string }>();
  if (e.kind !== "fork_friday") return results.map((r) => r.id);
  if (!e.featured_project_id) return [];
  const out: string[] = [];
  for (const r of results) if (await descendsFrom(db, r.id, e.featured_project_id)) out.push(r.id);
  return out;
}

async function descendsFrom(db: D1Database, projectId: string, ancestorId: string): Promise<boolean> {
  let current = projectId;
  for (let i = 0; i < 20; i++) {
    const parent = await db.prepare(`SELECT parent_id FROM forks WHERE child_id = ?`).bind(current).first<{ parent_id: string }>();
    if (!parent) return false;
    if (parent.parent_id === ancestorId) return true;
    current = parent.parent_id;
  }
  return false;
}

export async function getEvent(db: D1Database, slug: string, viewer: SessionUser | null): Promise<GrowthEventDetail> {
  const e = await eventBySlug(db, slug);
  const event = toEvent(e);
  let viewerCanSubmit = false;
  let viewerBallot: string | null = null;
  if (viewer) {
    if (event.status === "submitting") viewerCanSubmit = (await eligibleProjectIds(db, e, viewer.id)).length > 0;
    viewerBallot = (await db.prepare(`SELECT entry_id FROM growth_ballots WHERE event_id = ? AND voter_id = ?`).bind(e.id, viewer.id).first<{ entry_id: string }>())?.entry_id ?? null;
  }
  return { ...event, viewerCanSubmit, viewerCanVote: Boolean(viewer) && event.status === "voting", viewerBallot };
}

interface EntryRow extends ProjectRow {
  entry_id: string;
  entry_submitted_by: string;
  entry_submitted_at: number;
  s_username: string;
  s_display_name: string;
  s_avatar_url: string | null;
  s_avatar: string | null;
  votes: number;
}



/** Live entries with authoritative vote counts (banned or deleted voters don't count). */
export async function loadEntries(db: D1Database, e: EventRow, viewerId: string | null, opts: { sort: "newest" | "rank"; limit: number; offset: number; entryId?: string; includeWithdrawn?: boolean }) {
  const order = opts.sort === "rank" ? `votes DESC, ge.submitted_at ASC, ge.id ASC` : `ge.submitted_at DESC, ge.id DESC`;
  const { results } = await db
    .prepare(
      `SELECT p.rowid AS rowid, p.*,
         u.id AS u_id, u.username AS u_username, u.display_name AS u_display_name, u.avatar_url AS u_avatar_url, u.github_login AS u_github_login, av.config AS u_avatar,
         c.name AS cat_name, c.icon_key AS cat_icon, NULL AS studio_column,
         ge.id AS entry_id, ge.submitted_by AS entry_submitted_by, ge.submitted_at AS entry_submitted_at,
         su.username AS s_username, su.display_name AS s_display_name, su.avatar_url AS s_avatar_url, sav.config AS s_avatar,
         (SELECT count(*) FROM growth_ballots b JOIN users vu ON vu.id = b.voter_id WHERE b.entry_id = ge.id AND vu.banned_at IS NULL AND vu.deleted_at IS NULL) AS votes
       FROM growth_entries ge
       JOIN projects p ON p.id = ge.project_id
       LEFT JOIN users u ON u.id = p.owner_id AND u.deleted_at IS NULL
       LEFT JOIN avatars av ON av.user_id = u.id
       LEFT JOIN categories c ON c.slug = p.category_slug
       JOIN users su ON su.id = ge.submitted_by
       LEFT JOIN avatars sav ON sav.user_id = su.id
       WHERE ge.event_id = ? ${opts.includeWithdrawn ? "" : "AND ge.withdrawn_at IS NULL"} AND ${LISTED} AND p.license_spdx IS NOT NULL ${opts.entryId ? `AND ge.id = ?` : ""}
       ORDER BY ${order} LIMIT ? OFFSET ?`,
    )
    .bind(...[e.id, ...(opts.entryId ? [opts.entryId] : []), opts.limit, opts.offset])
    .all<EntryRow>();
  const cards = await rowsToCards(db, results, viewerId);
  const mine = viewerId ? (await db.prepare(`SELECT entry_id FROM growth_ballots WHERE event_id = ? AND voter_id = ?`).bind(e.id, viewerId).first<{ entry_id: string }>())?.entry_id : null;
  const status = statusOf(e);
  // Ranks are only meaningful once submissions close; compute them over all live entries.
  let ranks = new Map<string, number>();
  if (status === "voting" || status === "ended") {
    const { results: all } = await db
      .prepare(
        `SELECT ge.id, (SELECT count(*) FROM growth_ballots b JOIN users vu ON vu.id = b.voter_id WHERE b.entry_id = ge.id AND vu.banned_at IS NULL AND vu.deleted_at IS NULL) AS votes
         FROM growth_entries ge JOIN projects p ON p.id = ge.project_id
         WHERE ge.event_id = ? AND ge.withdrawn_at IS NULL AND ${LISTED} AND p.license_spdx IS NOT NULL
         ORDER BY votes DESC, ge.submitted_at ASC, ge.id ASC`,
      )
      .bind(e.id)
      .all<{ id: string }>();
    ranks = new Map(all.map((r, i) => [r.id, i + 1]));
  }
  return results.map((r, i): EventEntry => ({
    id: r.entry_id,
    eventId: e.id,
    project: cards[i]!,
    submittedBy: { id: r.entry_submitted_by, username: r.s_username, displayName: r.s_display_name, avatarUrl: r.s_avatar_url, avatar: parseJson(r.s_avatar, null) },
    submittedAt: iso(r.entry_submitted_at),
    voteCount: r.votes,
    viewerVoted: mine === r.entry_id,
    rank: ranks.get(r.entry_id) ?? null,
  }));
}

export async function listEntries(db: D1Database, slug: string, viewerId: string | null, q: { cursor?: string; limit?: number; sort?: "newest" | "rank" }) {
  const e = await eventBySlug(db, slug);
  const limit = q.limit ?? 30;
  const cursor = decodeCursor(q.cursor);
  const items = await loadEntries(db, e, viewerId, { sort: q.sort ?? "newest", limit: limit + 1, offset: cursor.o });
  return { items: items.slice(0, limit), nextCursor: items.length > limit ? encodeCursor({ o: cursor.o + limit }) : null };
}

export async function submitEntry(db: D1Database, viewer: SessionUser, slug: string, projectId: string): Promise<EventEntry> {
  const e = await eventBySlug(db, slug);
  if (statusOf(e) !== "submitting") throw new HttpError("conflict", "Submissions aren't open for this event.");
  const eligible = await eligibleProjectIds(db, e, viewer.id);
  if (!eligible.includes(projectId)) {
    throw new HttpError(
      "forbidden",
      e.kind === "fork_friday" ? "Enter one of your public, licensed projects that was forked from this week's featured project." : "Enter one of your own public projects with an open license.",
    );
  }
  const id = newId("entry");
  try {
    await db.prepare(`INSERT INTO growth_entries (id, event_id, project_id, submitted_by, submitted_at) VALUES (?, ?, ?, ?, ?)`).bind(id, e.id, projectId, viewer.id, Date.now()).run();
  } catch (err) {
    if (String(err).includes("UNIQUE")) throw new HttpError("conflict", "That project is already entered.");
    throw err;
  }
  return (await loadEntries(db, e, viewer.id, { sort: "newest", limit: 1, offset: 0, entryId: id }))[0]!;
}

export async function withdrawEntry(db: D1Database, viewer: SessionUser, slug: string, entryId: string): Promise<void> {
  const e = await eventBySlug(db, slug);
  const entry = await db.prepare(`SELECT submitted_by, withdrawn_at FROM growth_entries WHERE id = ? AND event_id = ?`).bind(entryId, e.id).first<{ submitted_by: string; withdrawn_at: number | null }>();
  if (!entry || entry.submitted_by !== viewer.id) throw notFound("Entry not found");
  if (entry.withdrawn_at) return;
  if (statusOf(e) !== "submitting") throw new HttpError("conflict", "Entries can only be withdrawn while submissions are open.");
  await db.batch([
    db.prepare(`UPDATE growth_entries SET withdrawn_at = ? WHERE id = ?`).bind(Date.now(), entryId),
    db.prepare(`DELETE FROM growth_ballots WHERE entry_id = ?`).bind(entryId),
  ]);
}

export async function vote(db: D1Database, viewer: SessionUser, slug: string, entryId: string | null): Promise<{ entryId: string | null }> {
  const e = await eventBySlug(db, slug);
  if (statusOf(e) !== "voting") throw new HttpError("conflict", "Voting isn't open for this event.");
  if (entryId === null) {
    await db.prepare(`DELETE FROM growth_ballots WHERE event_id = ? AND voter_id = ?`).bind(e.id, viewer.id).run();
    return { entryId: null };
  }
  const entry = await db
    .prepare(`SELECT ge.id, p.owner_id FROM growth_entries ge JOIN projects p ON p.id = ge.project_id WHERE ge.id = ? AND ge.event_id = ? AND ge.withdrawn_at IS NULL AND ${LISTED} AND p.license_spdx IS NOT NULL`)
    .bind(entryId, e.id)
    .first<{ id: string; owner_id: string | null }>();
  if (!entry) throw notFound("Entry not found");
  if (entry.owner_id === viewer.id) throw new HttpError("forbidden", "You can't vote for your own entry.");
  await db
    .prepare(`INSERT INTO growth_ballots (event_id, voter_id, entry_id, updated_at) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(event_id, voter_id) DO UPDATE SET entry_id = ?3, updated_at = ?4`)
    .bind(e.id, viewer.id, entryId, Date.now())
    .run();
  return { entryId };
}

// ── Admin ─────────────────────────────────────────────────────────────────

function checkWindows(starts: number, subEnds: number, voteEnds: number) {
  if (!(starts < subEnds && subEnds < voteEnds)) throw new HttpError("invalid_request", "Times must go start → submissions close → voting closes.");
}

export async function createEvent(
  db: D1Database,
  actor: string,
  b: { slug: string; kind: GrowthEventKind; title: string; bodyMd: string; featuredProjectId: string | null; startsAt: string; submissionEndsAt: string; votingEndsAt: string },
): Promise<GrowthEvent> {
  const [s, se, ve] = [Date.parse(b.startsAt), Date.parse(b.submissionEndsAt), Date.parse(b.votingEndsAt)];
  checkWindows(s, se, ve);
  if (b.kind === "fork_friday") {
    if (!b.featuredProjectId) throw new HttpError("invalid_request", "Fork Friday needs a featured project.");
    const ok = await db.prepare(`SELECT 1 FROM projects p WHERE p.id = ? AND ${LISTED} AND p.license_spdx IS NOT NULL`).bind(b.featuredProjectId).first();
    if (!ok) throw new HttpError("invalid_request", "The featured project must be public and openly licensed.");
  }
  if (b.kind === "launch_day" && new Date(s).toISOString().slice(0, 10) !== new Date(se - 1).toISOString().slice(0, 10)) {
    throw new HttpError("invalid_request", "A launch day's submissions open and close on the same UTC date.");
  }
  if (await db.prepare(`SELECT 1 FROM growth_events WHERE slug = ?`).bind(b.slug).first()) throw new HttpError("conflict", "That slug is taken.");
  const id = newId("evt");
  await db
    .prepare(`INSERT INTO growth_events (id, slug, kind, title, body_md, featured_project_id, starts_at, submission_ends_at, voting_ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, b.slug, b.kind, b.title, b.bodyMd, b.featuredProjectId, s, se, ve, actor)
    .run();
  return toEvent((await db.prepare(`${EVENT_SELECT} WHERE e.id = ?`).bind(id).first<EventRow>())!);
}

/** Wording can change any time; deadlines only move while they are still in the future; results are never rewritten. */
export async function updateEvent(
  db: D1Database,
  id: string,
  b: { title?: string; bodyMd?: string; submissionEndsAt?: string; votingEndsAt?: string; cancelled?: boolean },
): Promise<GrowthEvent> {
  const e = await db.prepare(`${EVENT_SELECT} WHERE e.id = ?`).bind(id).first<EventRow>();
  if (!e) throw notFound("Event not found");
  const now = Date.now();
  const status = statusOf(e, now);
  if (status === "ended" && (b.submissionEndsAt || b.votingEndsAt || b.cancelled)) throw new HttpError("conflict", "This event has ended; its results stand.");
  let se = e.submission_ends_at;
  let ve = e.voting_ends_at;
  if (b.submissionEndsAt) {
    if (e.submission_ends_at <= now) throw new HttpError("conflict", "Submissions already closed.");
    se = Date.parse(b.submissionEndsAt);
    if (se <= now) throw new HttpError("invalid_request", "New deadlines must be in the future.");
  }
  if (b.votingEndsAt) {
    ve = Date.parse(b.votingEndsAt);
    if (ve <= now) throw new HttpError("invalid_request", "New deadlines must be in the future.");
  }
  checkWindows(e.starts_at, se, ve);
  await db
    .prepare(`UPDATE growth_events SET title = coalesce(?, title), body_md = coalesce(?, body_md), submission_ends_at = ?, voting_ends_at = ?, cancelled_at = CASE WHEN ? = 1 THEN coalesce(cancelled_at, ?) WHEN ? = 0 THEN NULL ELSE cancelled_at END WHERE id = ?`)
    .bind(b.title ?? null, b.bodyMd ?? null, se, ve, b.cancelled === true ? 1 : -1, now, b.cancelled === false ? 0 : -1, id)
    .run();
  return toEvent((await db.prepare(`${EVENT_SELECT} WHERE e.id = ?`).bind(id).first<EventRow>())!);
}
