/**
 * Task 4.14: build competitions. A round sits on a growth event (which holds
 * entries and the submission window) and adds rules, prizes, criteria, judges
 * and published awards. Prizes are display-only: the site never takes or pays
 * money, and nothing about a round can be bought.
 *
 * Lifecycle (server clock): draft → open (until the event's submissions close)
 * → judging (until published) → published. Prizes, criteria and judges freeze
 * once a round opens; awards are published once and never rewritten.
 */
import type { Award, CompetitionRound, CompetitionStatus, Criterion, EventEntry, Prize, Scorecard, SessionUser, UserSummary } from "@forkvlift/shared";
import { HttpError, notFound } from "./errors";
import { eventById, loadEntries, type EventRow } from "./events";
import { newId } from "./ids";
import { decodeCursor, encodeCursor } from "./projects/list";
import { parseJson } from "./projects/rows";

interface RoundRow {
  id: string;
  event_id: string;
  slug: string;
  title: string;
  rules_md: string;
  eligibility_md: string;
  judging_ends_at: number;
  opened_at: number | null;
  published_at: number | null;
  cancelled_at: number | null;
  version: number;
}

const iso = (ms: number) => new Date(ms).toISOString();

function statusOf(r: RoundRow, e: EventRow, now = Date.now()): CompetitionStatus {
  if (r.cancelled_at || e.cancelled_at) return "cancelled";
  if (r.published_at) return "published";
  if (!r.opened_at) return "draft";
  return now < e.submission_ends_at ? "open" : "judging";
}

async function hydrate(db: D1Database, r: RoundRow): Promise<CompetitionRound> {
  const e = (await eventById(db, r.event_id))!;
  const [prizes, criteria, judges] = await db.batch([
    db.prepare(`SELECT * FROM competition_prizes WHERE round_id = ? ORDER BY place IS NULL, place, label`).bind(r.id),
    db.prepare(`SELECT * FROM competition_criteria WHERE round_id = ? ORDER BY rowid`).bind(r.id),
    db
      .prepare(`SELECT u.id, u.username, u.display_name, u.avatar_url, av.config AS avatar FROM competition_judges j JOIN users u ON u.id = j.judge_id LEFT JOIN avatars av ON av.user_id = u.id WHERE j.round_id = ? AND u.deleted_at IS NULL ORDER BY u.username`)
      .bind(r.id),
  ]);
  return {
    id: r.id,
    slug: r.slug,
    eventSlug: e.slug,
    title: r.title,
    rulesMd: r.rules_md,
    eligibilityMd: r.eligibility_md,
    submissionEndsAt: iso(e.submission_ends_at),
    judgingEndsAt: iso(r.judging_ends_at),
    publishedAt: r.published_at ? iso(r.published_at) : null,
    status: statusOf(r, e),
    prizes: (prizes!.results as Record<string, unknown>[]).map(toPrize),
    criteria: (criteria!.results as Record<string, unknown>[]).map(toCriterion),
    judges: (judges!.results as { id: string; username: string; display_name: string; avatar_url: string | null; avatar: string | null }[]).map(
      (u): UserSummary => ({ id: u.id, username: u.username, displayName: u.display_name, avatarUrl: u.avatar_url, avatar: parseJson(u.avatar, null) }),
    ),
    version: r.version,
  };
}

const toPrize = (p: Record<string, unknown>): Prize => ({
  id: p.id as string,
  label: p.label as string,
  descriptionMd: p.description_md as string,
  sponsorName: (p.sponsor_name as string | null) ?? null,
  sponsorUrl: (p.sponsor_url as string | null) ?? null,
  place: (p.place as number | null) ?? null,
});
const toCriterion = (c: Record<string, unknown>): Criterion => ({
  id: c.id as string,
  label: c.label as string,
  description: c.description as string,
  maxScore: c.max_score as number,
  weight: c.weight as number,
});

async function roundBySlug(db: D1Database, slug: string, opts: { allowDraft?: boolean } = {}): Promise<RoundRow> {
  const r = await db.prepare(`SELECT * FROM competition_rounds WHERE slug = ?`).bind(slug).first<RoundRow>();
  if (!r || (!r.opened_at && !opts.allowDraft)) throw notFound("Competition not found");
  return r;
}

async function roundById(db: D1Database, id: string): Promise<RoundRow> {
  const r = await db.prepare(`SELECT * FROM competition_rounds WHERE id = ?`).bind(id).first<RoundRow>();
  if (!r) throw notFound("Competition not found");
  return r;
}

export async function listCompetitions(db: D1Database, q: { cursor?: string; limit?: number }) {
  const limit = q.limit ?? 20;
  const cursor = decodeCursor(q.cursor);
  const { results } = await db
    .prepare(`SELECT r.* FROM competition_rounds r JOIN growth_events e ON e.id = r.event_id WHERE r.opened_at IS NOT NULL ORDER BY r.published_at IS NOT NULL, e.submission_ends_at DESC LIMIT ? OFFSET ?`)
    .bind(limit + 1, cursor.o)
    .all<RoundRow>();
  const items = await Promise.all(results.slice(0, limit).map((r) => hydrate(db, r)));
  return { items, nextCursor: results.length > limit ? encodeCursor({ o: cursor.o + limit }) : null };
}

export async function getCompetition(db: D1Database, slug: string): Promise<CompetitionRound> {
  return hydrate(db, await roundBySlug(db, slug));
}

async function awardsOf(db: D1Database, r: RoundRow, viewerId: string | null): Promise<Award[]> {
  if (!r.published_at) return [];
  const e = (await eventById(db, r.event_id))!;
  const { results } = await db
    .prepare(`SELECT a.*, p.label, p.description_md, p.sponsor_name, p.sponsor_url, p.place FROM competition_awards a JOIN competition_prizes p ON p.id = a.prize_id WHERE a.round_id = ? ORDER BY p.place IS NULL, p.place, p.label`)
    .bind(r.id)
    .all<Record<string, unknown>>();
  const out: Award[] = [];
  for (const a of results) {
    // Published results stay on record; a project hidden later simply drops its card.
    const [entry] = await loadEntries(db, e, viewerId, { sort: "newest", limit: 1, offset: 0, entryId: a.entry_id as string, includeWithdrawn: true });
    if (!entry) continue;
    out.push({ id: a.id as string, prize: toPrize({ ...a, id: a.prize_id }), entry, rationaleMd: a.rationale_md as string, announcedAt: iso(a.announced_at as number) });
  }
  return out;
}

export async function getWinners(db: D1Database, slug: string, viewerId: string | null) {
  const r = await roundBySlug(db, slug);
  return { competition: await hydrate(db, r), awards: await awardsOf(db, r, viewerId) };
}

// ── Judging ───────────────────────────────────────────────────────────────

async function requireJudge(db: D1Database, r: RoundRow, userId: string) {
  const j = await db.prepare(`SELECT 1 FROM competition_judges WHERE round_id = ? AND judge_id = ?`).bind(r.id, userId).first();
  if (!j) throw new HttpError("forbidden", "Only this competition's judges can do that.");
}

/** Entries a judge may not score: ones they own or submitted. */
function isConflict(entry: EventEntry, judgeId: string) {
  return entry.submittedBy.id === judgeId || entry.project.author?.id === judgeId;
}

export async function getJudging(db: D1Database, slug: string, viewer: SessionUser) {
  const r = await roundBySlug(db, slug);
  await requireJudge(db, r, viewer.id);
  const e = (await eventById(db, r.event_id))!;
  const entries = await loadEntries(db, e, null, { sort: "newest", limit: 500, offset: 0 });
  const { results } = await db.prepare(`SELECT * FROM competition_scorecards WHERE round_id = ? AND judge_id = ?`).bind(r.id, viewer.id).all<Record<string, unknown>>();
  return {
    competition: await hydrate(db, r),
    entries,
    scorecards: results.map(toScorecard),
    conflicts: entries.filter((x) => isConflict(x, viewer.id)).map((x) => x.id),
  };
}

const toScorecard = (s: Record<string, unknown>): Scorecard => ({
  entryId: s.entry_id as string,
  scores: parseJson(s.scores as string, []),
  note: s.note as string,
  submittedAt: s.submitted_at ? iso(s.submitted_at as number) : null,
});

export async function saveScorecard(
  db: D1Database,
  viewer: SessionUser,
  slug: string,
  entryId: string,
  body: { scores: { criterionId: string; score: number }[]; note: string; submit: boolean },
): Promise<Scorecard> {
  const r = await roundBySlug(db, slug);
  await requireJudge(db, r, viewer.id);
  const e = (await eventById(db, r.event_id))!;
  const now = Date.now();
  if (statusOf(r, e, now) !== "judging" || now >= r.judging_ends_at) throw new HttpError("conflict", "Judging isn't open for this competition.");
  const [entry] = await loadEntries(db, e, null, { sort: "newest", limit: 1, offset: 0, entryId });
  if (!entry) throw notFound("Entry not found");
  if (isConflict(entry, viewer.id)) throw new HttpError("forbidden", "You can't judge your own entry.");
  const existing = await db.prepare(`SELECT submitted_at FROM competition_scorecards WHERE round_id = ? AND entry_id = ? AND judge_id = ?`).bind(r.id, entryId, viewer.id).first<{ submitted_at: number | null }>();
  if (existing?.submitted_at) throw new HttpError("conflict", "That scorecard is already submitted.");

  const criteria = ((await db.prepare(`SELECT * FROM competition_criteria WHERE round_id = ?`).bind(r.id).all()).results as Record<string, unknown>[]).map(toCriterion);
  const byId = new Map(body.scores.map((s) => [s.criterionId, s.score]));
  for (const s of body.scores) if (!criteria.some((c) => c.id === s.criterionId)) throw new HttpError("invalid_request", "Unknown criterion.");
  for (const c of criteria) {
    const score = byId.get(c.id);
    if (score === undefined) {
      if (body.submit) throw new HttpError("invalid_request", `Score every criterion before submitting ("${c.label}" is missing).`);
      continue;
    }
    if (score < 0 || score > c.maxScore) throw new HttpError("invalid_request", `"${c.label}" is scored 0–${c.maxScore}.`);
  }
  const scores = criteria.filter((c) => byId.has(c.id)).map((c) => ({ criterionId: c.id, score: byId.get(c.id)! }));
  await db
    .prepare(
      `INSERT INTO competition_scorecards (round_id, entry_id, judge_id, scores, note, submitted_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
       ON CONFLICT(round_id, entry_id, judge_id) DO UPDATE SET scores = ?4, note = ?5, submitted_at = ?6, updated_at = ?7 WHERE submitted_at IS NULL`,
    )
    .bind(r.id, entryId, viewer.id, JSON.stringify(scores), body.note, body.submit ? now : null, now)
    .run();
  return { entryId, scores, note: body.note, submittedAt: body.submit ? iso(now) : null };
}

// ── Admin ─────────────────────────────────────────────────────────────────

export async function createCompetition(
  db: D1Database,
  actor: string,
  b: {
    eventId: string;
    slug: string;
    title: string;
    rulesMd: string;
    eligibilityMd: string;
    judgingEndsAt: string;
    prizes: Omit<Prize, "id">[];
    criteria: Omit<Criterion, "id">[];
    judgeUsernames: string[];
  },
): Promise<CompetitionRound> {
  const e = await eventById(db, b.eventId);
  if (!e) throw new HttpError("invalid_request", "Event not found.");
  if (e.cancelled_at) throw new HttpError("invalid_request", "That event was cancelled.");
  if (e.kind === "show_off") throw new HttpError("invalid_request", "Competitions run on project events, not showcase events.");
  const judgingEnds = Date.parse(b.judgingEndsAt);
  if (judgingEnds <= e.submission_ends_at) throw new HttpError("invalid_request", "Judging must end after submissions close.");
  if (await db.prepare(`SELECT 1 FROM competition_rounds WHERE slug = ? OR event_id = ?`).bind(b.slug, b.eventId).first()) {
    throw new HttpError("conflict", "That slug is taken, or the event already has a competition.");
  }
  const { results: judges } = await db
    .prepare(`SELECT id, username FROM users WHERE lower(username) IN (${b.judgeUsernames.map(() => "lower(?)").join(",")}) AND deleted_at IS NULL AND banned_at IS NULL`)
    .bind(...b.judgeUsernames)
    .all<{ id: string; username: string }>();
  if (judges.length !== new Set(b.judgeUsernames.map((u) => u.toLowerCase())).size) throw new HttpError("invalid_request", "Every judge needs an active account.");
  for (const p of b.prizes) if (p.sponsorUrl && !/^https?:\/\//i.test(p.sponsorUrl)) throw new HttpError("invalid_request", "Sponsor links must be http(s).");

  const id = newId("comp");
  await db.batch([
    db
      .prepare(`INSERT INTO competition_rounds (id, event_id, slug, title, rules_md, eligibility_md, judging_ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, b.eventId, b.slug, b.title, b.rulesMd, b.eligibilityMd, judgingEnds, actor),
    ...b.prizes.map((p) =>
      db.prepare(`INSERT INTO competition_prizes (id, round_id, label, description_md, sponsor_name, sponsor_url, place) VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(newId("prize"), id, p.label, p.descriptionMd, p.sponsorName, p.sponsorUrl, p.place),
    ),
    ...b.criteria.map((c) => db.prepare(`INSERT INTO competition_criteria (id, round_id, label, description, max_score, weight) VALUES (?, ?, ?, ?, ?, ?)`).bind(newId("crit"), id, c.label, c.description, c.maxScore, c.weight)),
    ...judges.map((j) => db.prepare(`INSERT INTO competition_judges (round_id, judge_id) VALUES (?, ?)`).bind(id, j.id)),
  ]);
  return hydrate(db, await roundById(db, id));
}

export async function updateCompetition(db: D1Database, id: string, b: { open?: boolean; rulesMd?: string; eligibilityMd?: string; cancelled?: boolean }): Promise<CompetitionRound> {
  const r = await roundById(db, id);
  if (r.published_at) throw new HttpError("conflict", "Winners are published; this competition is final.");
  if (b.open === false && r.opened_at) throw new HttpError("conflict", "An open competition can't go back to draft. Cancel it instead.");
  const now = Date.now();
  await db
    .prepare(
      `UPDATE competition_rounds SET rules_md = coalesce(?, rules_md), eligibility_md = coalesce(?, eligibility_md),
         opened_at = CASE WHEN ? = 1 THEN coalesce(opened_at, ?) ELSE opened_at END,
         cancelled_at = CASE WHEN ? = 1 THEN coalesce(cancelled_at, ?) ELSE cancelled_at END,
         version = version + 1 WHERE id = ?`,
    )
    .bind(b.rulesMd ?? null, b.eligibilityMd ?? null, b.open ? 1 : 0, now, b.cancelled ? 1 : 0, now, id)
    .run();
  return hydrate(db, await roundById(db, id));
}

/** Weighted totals: each criterion contributes score/max × weight, averaged over submitted scorecards. */
export async function scores(db: D1Database, id: string) {
  const r = await roundById(db, id);
  const e = (await eventById(db, r.event_id))!;
  const criteria = ((await db.prepare(`SELECT * FROM competition_criteria WHERE round_id = ?`).bind(r.id).all()).results as Record<string, unknown>[]).map(toCriterion);
  const judges = (await db.prepare(`SELECT count(*) AS n FROM competition_judges WHERE round_id = ?`).bind(r.id).first<{ n: number }>())?.n ?? 0;
  const { results: cards } = await db.prepare(`SELECT entry_id, scores FROM competition_scorecards WHERE round_id = ? AND submitted_at IS NOT NULL`).bind(r.id).all<{ entry_id: string; scores: string }>();
  const entries = await loadEntries(db, e, null, { sort: "newest", limit: 500, offset: 0 });
  const items = entries.map((entry) => {
    const mine = cards.filter((c) => c.entry_id === entry.id);
    const totals = mine.map((c) => {
      const s = new Map(parseJson<{ criterionId: string; score: number }[]>(c.scores, []).map((x) => [x.criterionId, x.score]));
      return criteria.reduce((sum, cr) => sum + ((s.get(cr.id) ?? 0) / cr.maxScore) * cr.weight, 0);
    });
    const total = totals.length ? Math.round((totals.reduce((a, b) => a + b, 0) / totals.length) * 1000) / 1000 : 0;
    return { entry, total, scorecards: mine.length, judges };
  });
  items.sort((a, b) => b.total - a.total || Date.parse(a.entry.submittedAt) - Date.parse(b.entry.submittedAt));
  return { items };
}

export async function publish(db: D1Database, id: string, b: { awards: { prizeId: string; entryId: string; rationaleMd: string }[]; expectedVersion: number }) {
  const r = await roundById(db, id);
  const e = (await eventById(db, r.event_id))!;
  if (r.published_at) throw new HttpError("conflict", "Winners are already published.");
  if (statusOf(r, e) !== "judging") throw new HttpError("conflict", "Winners can only be published after submissions close.");
  if (r.version !== b.expectedVersion) throw new HttpError("conflict", "The competition changed since you loaded it. Reload and try again.");
  const prizeIds = new Set(((await db.prepare(`SELECT id FROM competition_prizes WHERE round_id = ?`).bind(r.id).all<{ id: string }>()).results).map((p) => p.id));
  const seen = new Set<string>();
  for (const a of b.awards) {
    if (!prizeIds.has(a.prizeId)) throw new HttpError("invalid_request", "Unknown prize.");
    if (seen.has(a.prizeId)) throw new HttpError("invalid_request", "Each prize goes to one entry.");
    seen.add(a.prizeId);
    const [entry] = await loadEntries(db, e, null, { sort: "newest", limit: 1, offset: 0, entryId: a.entryId });
    if (!entry) throw new HttpError("invalid_request", "Awards must go to live entries in this competition.");
  }
  const now = Date.now();
  const results = await db.batch([
    db.prepare(`UPDATE competition_rounds SET published_at = ?, version = version + 1 WHERE id = ? AND version = ? AND published_at IS NULL`).bind(now, r.id, b.expectedVersion),
    ...b.awards.map((a) =>
      db
        .prepare(`INSERT INTO competition_awards (id, round_id, prize_id, entry_id, rationale_md, announced_at) SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM competition_rounds WHERE id = ? AND published_at = ?)`)
        .bind(newId("award"), r.id, a.prizeId, a.entryId, a.rationaleMd, now, r.id, now),
    ),
  ]);
  if (!results[0]!.meta.changes) throw new HttpError("conflict", "Winners are already published.");
  const fresh = await roundById(db, id);
  return { competition: await hydrate(db, fresh), awards: await awardsOf(db, fresh, null) };
}
