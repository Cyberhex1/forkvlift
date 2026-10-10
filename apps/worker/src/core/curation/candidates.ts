/**
 * Task 1.7: the curation queue. Candidates come from the discovery cron, the
 * awesome-list watchlist, or the admin's paste-a-link importer.
 */
import type { Candidate, CandidateAction, CandidateStatus, ParsedInput, Routes } from "@forkvlift/shared";
import { HttpError, notFound } from "../errors";
import type { RepoSnapshot } from "../github/ingest";
import { ingestRepo } from "../github/ingest";
import { newId } from "../ids";
import { decodeCursor, encodeCursor } from "../projects/list";
import { insertProject } from "../projects/submit";
import { scanRepo } from "../safety/scan";
import { candidateChecks, candidateScore, proposedCard, starVelocity } from "./score";

type FoundVia = Candidate["foundVia"]["kind"];

interface CandidateRow {
  id: string;
  repo_full_name: string;
  repo_url: string;
  data: string;
  proposed: string | null;
  score: number;
  checks: string | null;
  status: CandidateStatus;
  found_via_kind: FoundVia;
  found_via_url: string | null;
  reject_reason: string | null;
  snoozed_until: number | null;
  project_id: string | null;
  p_slug: string | null;
  p_name: string | null;
  created_at: number;
}

const SELECT = `SELECT c.*, p.slug AS p_slug, p.name AS p_name FROM candidates c LEFT JOIN projects p ON p.id = c.project_id`;

function toCandidate(r: CandidateRow): Candidate {
  const s = JSON.parse(r.data) as RepoSnapshot;
  const proposed = r.proposed ? (JSON.parse(r.proposed) as Candidate["proposed"]) : proposedCard(s);
  // A snooze that has run out shows as pending again.
  const status: CandidateStatus = r.status === "snoozed" && r.snoozed_until !== null && r.snoozed_until <= Date.now() ? "pending" : r.status;
  return {
    id: r.id,
    repoUrl: r.repo_url,
    repoFullName: r.repo_full_name,
    name: s.name,
    description: s.description,
    stars: s.stars,
    starVelocity: starVelocity(s),
    license: s.license,
    lastCommitAt: s.pushedAt,
    hasReadme: s.readmeHtml !== null,
    hasDemo: s.homepage !== null,
    hasScreenshots: s.hasScreenshots,
    score: r.score,
    checks: r.checks ? JSON.parse(r.checks) : candidateChecks(s),
    status,
    foundVia: { kind: r.found_via_kind, url: r.found_via_url },
    rejectReason: r.reject_reason,
    snoozedUntil: r.snoozed_until ? new Date(r.snoozed_until).toISOString() : null,
    proposed,
    project: r.project_id && r.p_slug ? { id: r.project_id, slug: r.p_slug, name: r.p_name ?? r.p_slug, author: null } : null,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

export async function getCandidate(db: D1Database, id: string): Promise<Candidate> {
  const row = await db.prepare(`${SELECT} WHERE c.id = ?`).bind(id).first<CandidateRow>();
  if (!row) throw notFound("Candidate not found");
  return toCandidate(row);
}

export async function listCandidates(db: D1Database, q: ParsedInput<Routes["listCandidates"]>["query"]) {
  const limit = q.limit ?? 30;
  const cursor = decodeCursor(q.cursor);
  const status = q.status ?? "pending";
  const now = Date.now();
  const where =
    status === "pending"
      ? `(c.status = 'pending' OR (c.status = 'snoozed' AND c.snoozed_until <= ${now}))`
      : status === "snoozed"
        ? `c.status = 'snoozed' AND c.snoozed_until > ${now}`
        : `c.status = ?`;
  const order = q.sort === "newest" ? "c.created_at DESC" : q.sort === "stars" ? "json_extract(c.data, '$.stars') DESC" : "c.score DESC";
  const stmt = db.prepare(`${SELECT} WHERE ${where} ORDER BY ${order}, c.id LIMIT ? OFFSET ?`);
  const bound = status === "pending" || status === "snoozed" ? stmt.bind(limit + 1, cursor.o) : stmt.bind(status, limit + 1, cursor.o);
  const { results } = await bound.all<CandidateRow>();
  return {
    items: results.slice(0, limit).map(toCandidate),
    nextCursor: results.length > limit ? encodeCursor({ o: cursor.o + limit }) : null,
  };
}

/**
 * Add or refresh a candidate from a fresh snapshot. Rejected candidates stay
 * rejected (never suggested again); repos already in the catalog are skipped.
 */
export async function upsertCandidate(
  env: Env,
  s: RepoSnapshot,
  foundVia: { kind: FoundVia; url: string | null },
): Promise<{ id: string; created: boolean } | null> {
  const db = env.DB;
  const listed = await db.prepare(`SELECT 1 FROM projects WHERE lower(repo_full_name) = lower(?) AND deleted_at IS NULL`).bind(s.fullName).first();
  const existing = await db.prepare(`SELECT id, status FROM candidates WHERE lower(repo_full_name) = lower(?)`).bind(s.fullName).first<{ id: string; status: CandidateStatus }>();
  const scan = await scanRepo(env, s).catch(() => null);
  const data = JSON.stringify(s);
  const checks = JSON.stringify(candidateChecks(s, scan));
  const score = candidateScore(s, Date.now(), scan);

  if (existing) {
    await db
      .prepare(`UPDATE candidates SET data = ?, checks = ?, score = ?, updated_at = ?, found_via_url = coalesce(found_via_url, ?) WHERE id = ?`)
      .bind(data, checks, score, Date.now(), foundVia.url, existing.id)
      .run();
    return { id: existing.id, created: false };
  }
  if (listed && foundVia.kind !== "manual" && foundVia.kind !== "reddit_link") return null;

  const id = newId("cand");
  await db
    .prepare(
      `INSERT INTO candidates (id, repo_full_name, repo_url, data, proposed, score, checks, status, found_via_kind, found_via_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
    .bind(id, s.fullName, s.htmlUrl, data, JSON.stringify(proposedCard(s)), score, checks, foundVia.kind, foundVia.url)
    .run();
  return { id, created: true };
}

export async function importByUrl(env: Env, repoUrl: string, foundViaUrl: string | null): Promise<Candidate> {
  const s = await ingestRepo(env, repoUrl);
  const kind: FoundVia = foundViaUrl && /reddit\.com/i.test(foundViaUrl) ? "reddit_link" : "manual";
  const result = await upsertCandidate(env, s, { kind, url: foundViaUrl });
  return getCandidate(env.DB, result!.id);
}

export async function decideCandidate(
  env: Env,
  actor: string,
  id: string,
  d: { action: CandidateAction; reason: string | null; snoozeDays: number | null; edits: Partial<Candidate["proposed"]> | null },
): Promise<Candidate> {
  const db = env.DB;
  const current = await getCandidate(db, id);
  const proposed = { ...current.proposed, ...(d.edits ?? {}) };
  const now = Date.now();

  if (d.action === "reject") {
    await db.prepare(`UPDATE candidates SET status = 'rejected', reject_reason = ?, proposed = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ?`)
      .bind(d.reason ?? "", JSON.stringify(proposed), actor, now, now, id)
      .run();
  } else if (d.action === "snooze") {
    const until = now + (d.snoozeDays ?? 7) * 86_400_000;
    await db.prepare(`UPDATE candidates SET status = 'snoozed', snoozed_until = ?, proposed = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ?`)
      .bind(until, JSON.stringify(proposed), actor, now, now, id)
      .run();
  } else {
    if (current.project) throw new HttpError("conflict", "Already imported", { slug: current.project.slug });
    if (!proposed.categorySlug) throw new HttpError("invalid_request", "Pick a category before approving.");
    const cat = await db.prepare(`SELECT 1 FROM categories WHERE slug = ? AND status = 'active'`).bind(proposed.categorySlug).first();
    if (!cat) throw new HttpError("invalid_request", `Unknown category "${proposed.categorySlug}"`);
    const listed = await db.prepare(`SELECT slug FROM projects WHERE lower(repo_full_name) = lower(?) AND deleted_at IS NULL`).bind(current.repoFullName).first<{ slug: string }>();
    if (listed) throw new HttpError("conflict", "This repository is already in the catalog.", { slug: listed.slug });

    // Re-ingest so the published card starts from current data.
    const s = await ingestRepo(env, current.repoFullName, { freshFor: 3600 });
    // Owner decision: curated imports must be licensed. Unlicensed projects only come from their own authors.
    if (!s.license) throw new HttpError("invalid_request", "Unlicensed repos can't be curated. Ask the author to add a license or submit it themselves.");
    const { id: projectId } = await insertProject(db, {
      ownerId: null,
      source: "curated",
      snapshot: s,
      name: proposed.name,
      tagline: proposed.tagline.slice(0, 80),
      // Descriptions are written fresh by the curator; the repo's own description is the starting point.
      description: s.description.slice(0, 300),
      categorySlug: proposed.categorySlug,
      stage: "finished",
      isPublic: d.action === "approve_publish",
      liveUrl: s.homepage,
      releaseUrl: null,
      stack: s.language ? [s.language] : [],
      platforms: [],
      difficulty: null,
      aiTools: [],
      buildTime: null,
      aiInvolvement: null,
      isTemplate: false,
      replaces: [],
      whatWorks: null,
      whatsMissing: null,
      lookingForHelp: null,
      thumbnailKey: null,
      thumbnailUrl: proposed.thumbnailUrl,
      tags: proposed.tags,
      forkedFromId: null,
      foundViaUrl: current.foundVia.url,
      safetyFlags: (current.checks.find((k) => k.key === "not_malware")?.detail ?? "").split("; ").filter((f) => f && f !== "Scan not run"),
    });
    const status = d.action === "approve_publish" ? "published" : "draft";
    await db.prepare(`UPDATE candidates SET status = ?, project_id = ?, proposed = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ?`)
      .bind(status, projectId, JSON.stringify(proposed), actor, now, now, id)
      .run();
  }
  await audit(db, actor, `candidate.${d.action}`, "candidate", id, { repo: current.repoFullName, reason: d.reason });
  return getCandidate(db, id);
}

export async function audit(db: D1Database, actor: string, action: string, targetType: string, targetId: string, details: Record<string, unknown> = {}) {
  await db
    .prepare(`INSERT INTO audit_log (id, actor, action, target_type, target_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(newId("aud"), actor, action, targetType, targetId, JSON.stringify(details), Date.now())
    .run();
}
