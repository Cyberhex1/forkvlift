/**
 * Task 4.12: "Up for adoption". The current maintainer opens adoption, others
 * ask to take over, and the maintainer approves one request; approval moves
 * ForkLift stewardship (owner_id) to the adopter in one batch. It does not
 * touch GitHub access or the code's license. The original author stays
 * credited through the adoption record.
 */
import type { AdoptionRequest, AdoptionRequestStatus, ProjectAdoption, SessionUser, UserSummary } from "@forkvlift/shared";
import { HttpError, notFound } from "./errors";
import { newId } from "./ids";
import { decodeCursor, encodeCursor } from "./projects/list";
import { LISTED, parseJson } from "./projects/rows";
import { syncProjectSearch } from "./projects/search";
import { notify } from "./notify";

interface ProjectLite {
  id: string;
  slug: string;
  name: string;
  owner_id: string | null;
  stage: "finished" | "wip" | "adoption";
  listed: number;
}

interface AdoptionRow {
  id: string;
  project_id: string;
  original_owner_id: string | null;
  previous_stage: string;
  note: string;
  opened_at: number;
  closed_at: number | null;
  outcome: "cancelled" | "adopted" | null;
}

interface RequestRow {
  id: string;
  adoption_id: string;
  project_id: string;
  requester_id: string;
  message: string;
  status: AdoptionRequestStatus;
  created_at: number;
  decided_at: number | null;
  slug: string;
  name: string;
  r_username: string;
  r_display_name: string;
  r_avatar_url: string | null;
  r_avatar: string | null;
}

const REQUEST_SELECT = `SELECT r.*, p.slug, p.name, u.username AS r_username, u.display_name AS r_display_name, u.avatar_url AS r_avatar_url, av.config AS r_avatar
  FROM adoption_requests r JOIN projects p ON p.id = r.project_id JOIN users u ON u.id = r.requester_id LEFT JOIN avatars av ON av.user_id = u.id`;

const toRequest = (r: RequestRow): AdoptionRequest => ({
  id: r.id,
  project: { id: r.project_id, slug: r.slug, name: r.name, author: null },
  requester: { id: r.requester_id, username: r.r_username, displayName: r.r_display_name, avatarUrl: r.r_avatar_url, avatar: parseJson(r.r_avatar, null) },
  message: r.message,
  status: r.status,
  createdAt: new Date(r.created_at).toISOString(),
  decidedAt: r.decided_at ? new Date(r.decided_at).toISOString() : null,
});

async function project(db: D1Database, slug: string, viewer: SessionUser | null): Promise<ProjectLite> {
  const p = await db
    .prepare(`SELECT p.id, p.slug, p.name, p.owner_id, p.stage, (${LISTED}) AS listed FROM projects p WHERE p.slug = ? AND p.deleted_at IS NULL`)
    .bind(slug)
    .first<ProjectLite>();
  // Unlisted projects are visible to their maintainer only.
  if (!p || (!p.listed && p.owner_id !== viewer?.id)) throw notFound("Project not found");
  return p;
}

async function userSummary(db: D1Database, id: string | null): Promise<UserSummary | null> {
  if (!id) return null;
  const u = await db
    .prepare(`SELECT u.id, u.username, u.display_name, u.avatar_url, av.config AS avatar FROM users u LEFT JOIN avatars av ON av.user_id = u.id WHERE u.id = ? AND u.deleted_at IS NULL`)
    .bind(id)
    .first<{ id: string; username: string; display_name: string; avatar_url: string | null; avatar: string | null }>();
  return u ? { id: u.id, username: u.username, displayName: u.display_name, avatarUrl: u.avatar_url, avatar: parseJson(u.avatar, null) } : null;
}

const openAdoption = (db: D1Database, projectId: string) =>
  db.prepare(`SELECT * FROM project_adoptions WHERE project_id = ? AND closed_at IS NULL`).bind(projectId).first<AdoptionRow>();

function requireMaintainer(p: ProjectLite, viewer: SessionUser) {
  if (p.owner_id !== viewer.id) throw new HttpError("forbidden", "Only the project's current maintainer can do that.");
}

async function view(db: D1Database, p: ProjectLite, viewer: SessionUser | null): Promise<ProjectAdoption> {
  const open = await openAdoption(db, p.id);
  // Credit the first author across handovers: the oldest adoption record's original owner.
  const first = await db
    .prepare(`SELECT original_owner_id FROM project_adoptions WHERE project_id = ? ORDER BY opened_at ASC LIMIT 1`)
    .bind(p.id)
    .first<{ original_owner_id: string | null }>();
  const mine = viewer
    ? await db.prepare(`${REQUEST_SELECT} WHERE r.project_id = ? AND r.requester_id = ? ORDER BY r.created_at DESC LIMIT 1`).bind(p.id, viewer.id).first<RequestRow>()
    : null;
  return {
    open: Boolean(open),
    note: open?.note ?? "",
    openedAt: open ? new Date(open.opened_at).toISOString() : null,
    originalAuthor: await userSummary(db, first?.original_owner_id ?? null),
    maintainer: await userSummary(db, p.owner_id),
    viewerRequest: mine ? toRequest(mine) : null,
    canManage: viewer !== null && viewer.id === p.owner_id,
  };
}

export async function getAdoption(db: D1Database, slug: string, viewer: SessionUser | null): Promise<ProjectAdoption> {
  return view(db, await project(db, slug, viewer), viewer);
}

export async function setAdoption(db: D1Database, viewer: SessionUser, slug: string, input: { open: boolean; note: string }): Promise<ProjectAdoption> {
  const p = await project(db, slug, viewer);
  requireMaintainer(p, viewer);
  const open = await openAdoption(db, p.id);
  const now = Date.now();
  if (input.open) {
    if (!p.listed) throw new HttpError("bad_request", "Publish the project before putting it up for adoption.");
    if (open) {
      await db.prepare(`UPDATE project_adoptions SET note = ? WHERE id = ?`).bind(input.note.trim(), open.id).run();
    } else {
      await db.batch([
        db
          .prepare(`INSERT INTO project_adoptions (id, project_id, original_owner_id, previous_stage, note, opened_at) VALUES (?, ?, ?, ?, ?, ?)`)
          .bind(newId("adopt"), p.id, viewer.id, p.stage === "adoption" ? "wip" : p.stage, input.note.trim(), now),
        db.prepare(`UPDATE projects SET stage = 'adoption', updated_at = ? WHERE id = ?`).bind(now, p.id),
      ]);
    }
  } else if (open) {
    await db.batch([
      db.prepare(`UPDATE project_adoptions SET closed_at = ?, outcome = 'cancelled' WHERE id = ?`).bind(now, open.id),
      db.prepare(`UPDATE adoption_requests SET status = 'cancelled', decided_at = ? WHERE adoption_id = ? AND status = 'pending'`).bind(now, open.id),
      db.prepare(`UPDATE projects SET stage = ?, updated_at = ? WHERE id = ? AND stage = 'adoption'`).bind(open.previous_stage, now, p.id),
    ]);
  }
  await syncProjectSearch(db, p.id);
  return view(db, { ...p, stage: input.open ? "adoption" : p.stage }, viewer);
}

export async function requestAdoption(db: D1Database, viewer: SessionUser, slug: string, message: string): Promise<AdoptionRequest> {
  const p = await project(db, slug, viewer);
  if (p.owner_id === viewer.id) throw new HttpError("bad_request", "You already maintain this project.");
  const open = await openAdoption(db, p.id);
  if (!open) throw new HttpError("conflict", "This project isn't up for adoption.");
  if (p.owner_id) {
    const blocked = await db
      .prepare(`SELECT 1 FROM blocks WHERE kind = 'block' AND ((blocker_id = ?1 AND blocked_id = ?2) OR (blocker_id = ?2 AND blocked_id = ?1))`)
      .bind(viewer.id, p.owner_id)
      .first();
    if (blocked) throw new HttpError("forbidden", "You can't ask to adopt this person's project.");
  }
  const id = newId("adreq");
  try {
    await db
      .prepare(`INSERT INTO adoption_requests (id, adoption_id, project_id, requester_id, message, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, open.id, p.id, viewer.id, message.trim(), Date.now())
      .run();
  } catch (e) {
    if (String(e).includes("UNIQUE")) throw new HttpError("conflict", "You already have a pending request for this project.");
    throw e;
  }
  if (p.owner_id) {
    await notify(db, [{ userId: p.owner_id, type: "collab_request", actorId: viewer.id, title: `@${viewer.username} wants to adopt ${p.name}`, href: `/p/${p.slug}?adoption=requests` }]);
  }
  return toRequest((await db.prepare(`${REQUEST_SELECT} WHERE r.id = ?`).bind(id).first<RequestRow>())!);
}

export async function listRequests(db: D1Database, viewer: SessionUser, slug: string, q: { cursor?: string; limit?: number; status?: AdoptionRequestStatus }) {
  const p = await project(db, slug, viewer);
  requireMaintainer(p, viewer);
  const limit = q.limit ?? 30;
  const cursor = decodeCursor(q.cursor);
  const { results } = await db
    .prepare(`${REQUEST_SELECT} WHERE r.project_id = ? AND (? IS NULL OR r.status = ?) ORDER BY r.status = 'pending' DESC, r.created_at DESC LIMIT ? OFFSET ?`)
    .bind(p.id, q.status ?? null, q.status ?? null, limit + 1, cursor.o)
    .all<RequestRow>();
  return { items: results.slice(0, limit).map(toRequest), nextCursor: results.length > limit ? encodeCursor({ o: cursor.o + limit }) : null };
}

export async function withdrawRequest(db: D1Database, viewer: SessionUser, slug: string, id: string): Promise<void> {
  const p = await project(db, slug, viewer);
  const r = await db.prepare(`SELECT requester_id, status FROM adoption_requests WHERE id = ? AND project_id = ?`).bind(id, p.id).first<{ requester_id: string; status: string }>();
  if (!r || r.requester_id !== viewer.id) throw notFound("Request not found");
  if (r.status === "withdrawn") return;
  if (r.status !== "pending") throw new HttpError("conflict", "That request was already decided.");
  await db.prepare(`UPDATE adoption_requests SET status = 'withdrawn', decided_at = ? WHERE id = ? AND status = 'pending'`).bind(Date.now(), id).run();
}

/**
 * Approve or decline. Approval is a compare-and-set: every statement in the
 * batch is guarded on the request having been approved at this exact moment,
 * so a retry, a second click, or a race with another approval can't hand the
 * project over twice.
 */
export async function decide(db: D1Database, viewer: SessionUser, slug: string, id: string, decision: "approve" | "decline") {
  const p = await project(db, slug, viewer);
  requireMaintainer(p, viewer);
  const r = await db.prepare(`SELECT * FROM adoption_requests WHERE id = ? AND project_id = ?`).bind(id, p.id).first<{ adoption_id: string; requester_id: string; status: string }>();
  if (!r) throw notFound("Request not found");
  if (r.status !== "pending") throw new HttpError("conflict", "That request was already decided.");
  const open = await openAdoption(db, p.id);
  if (!open || open.id !== r.adoption_id) throw new HttpError("conflict", "Adoption for this project has closed.");
  const now = Date.now();

  if (decision === "decline") {
    await db.prepare(`UPDATE adoption_requests SET status = 'declined', decided_at = ?, decided_by = ? WHERE id = ? AND status = 'pending'`).bind(now, viewer.id, id).run();
    await notify(db, [{ userId: r.requester_id, type: "system", actorId: viewer.id, title: `Your request to adopt ${p.name} was declined`, href: `/p/${p.slug}` }]);
  } else {
    // Every later statement only runs if this exact approval landed.
    const won = `EXISTS (SELECT 1 FROM adoption_requests WHERE id = ? AND status = 'approved' AND decided_at = ? AND decided_by = ?)`;
    const w = [id, now, viewer.id] as const;
    const results = await db.batch([
      db
        .prepare(`UPDATE adoption_requests SET status = 'approved', decided_at = ?, decided_by = ? WHERE id = ? AND status = 'pending' AND adoption_id = (SELECT id FROM project_adoptions WHERE project_id = ? AND closed_at IS NULL)`)
        .bind(now, viewer.id, id, p.id),
      db.prepare(`UPDATE projects SET owner_id = ?, stage = ?, updated_at = ? WHERE id = ? AND owner_id = ? AND ${won}`).bind(r.requester_id, open.previous_stage, now, p.id, viewer.id, ...w),
      db.prepare(`UPDATE project_adoptions SET closed_at = ?, outcome = 'adopted', adopted_by = ? WHERE id = ? AND closed_at IS NULL AND ${won}`).bind(now, r.requester_id, open.id, ...w),
      db.prepare(`UPDATE adoption_requests SET status = 'cancelled', decided_at = ? WHERE adoption_id = ? AND status = 'pending' AND ${won}`).bind(now, open.id, ...w),
      // The project leaves the previous maintainer's Studio board.
      db.prepare(`DELETE FROM board_cards WHERE project_id = ? AND board_id IN (SELECT id FROM boards WHERE user_id = ?) AND ${won}`).bind(p.id, viewer.id, ...w),
    ]);
    if (!results[0]!.meta.changes) throw new HttpError("conflict", "That request was already decided.");
    await syncProjectSearch(db, p.id);
    await notify(db, [{ userId: r.requester_id, type: "system", actorId: viewer.id, title: `You're now the maintainer of ${p.name}`, href: `/p/${p.slug}` }]);
  }
  const request = toRequest((await db.prepare(`${REQUEST_SELECT} WHERE r.id = ?`).bind(id).first<RequestRow>())!);
  const fresh = await project(db, slug, null).catch(() => ({ ...p, owner_id: decision === "approve" ? r.requester_id : p.owner_id }));
  return { request, adoption: await view(db, fresh, viewer) };
}
