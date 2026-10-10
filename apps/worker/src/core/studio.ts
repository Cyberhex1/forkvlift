/**
 * Task 2.1: Studio. Each user has one kanban board (created with the default
 * columns on first visit). Cards are ideas or linked projects; positions are
 * dense integers per column, rewritten on every move.
 */
import { DEFAULT_BOARD_COLUMNS, type Board, type BoardCard, type BoardColumn, type ProjectPlan, type ProjectStage } from "@forkvlift/shared";
import { HttpError, notFound } from "./errors";
import { newId } from "./ids";
import { PROJECT_SELECT, rowsToCards, type ProjectRow } from "./projects/rows";
import { syncProjectSearch } from "./projects/search";

const MAX_COLUMNS = 12;
const MAX_CARDS = 500;
/** Column colors are token keys only (packages/ui pixel palette), never raw colors. */
const COLOR_RE = /^pixel-(?:[0-9]|1[0-5])$/;

interface ColumnRow {
  id: string;
  board_id: string;
  title: string;
  color: string | null;
  position: number;
  collapsed: number;
  wip_limit: number | null;
}
interface CardRow {
  id: string;
  board_id: string;
  column_id: string;
  project_id: string | null;
  title: string;
  idea: string | null;
  stage: ProjectStage;
  is_public: number;
  position: number;
  plan: string | null;
  updated_at: number;
}

const toColumn = (r: ColumnRow): BoardColumn => ({
  id: r.id,
  title: r.title,
  color: r.color,
  position: r.position,
  collapsed: r.collapsed === 1,
  wipLimit: r.wip_limit,
});

// ── Board ────────────────────────────────────────────────────────────────

export async function ensureBoard(db: D1Database, userId: string): Promise<string> {
  const existing = await db.prepare(`SELECT id FROM boards WHERE user_id = ?`).bind(userId).first<{ id: string }>();
  if (existing) return existing.id;
  const id = newId("brd");
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO boards (id, user_id) VALUES (?, ?)`).bind(id, userId),
    ...DEFAULT_BOARD_COLUMNS.map((title, position) =>
      db.prepare(`INSERT INTO board_columns (id, board_id, title, position) SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM boards WHERE id = ?)`).bind(newId("col"), id, title, position, id),
    ),
  ]);
  // A concurrent first visit may have won the race; use whichever board exists.
  return (await db.prepare(`SELECT id FROM boards WHERE user_id = ?`).bind(userId).first<{ id: string }>())!.id;
}

export async function getBoard(db: D1Database, userId: string): Promise<Board> {
  const boardId = await ensureBoard(db, userId);
  const [cols, cards] = await db.batch<unknown>([
    db.prepare(`SELECT * FROM board_columns WHERE board_id = ? ORDER BY position`).bind(boardId),
    db.prepare(`SELECT * FROM board_cards WHERE board_id = ? ORDER BY column_id, position`).bind(boardId),
  ]);
  const cardRows = (cards!.results as CardRow[]) ?? [];
  return {
    id: boardId,
    columns: (cols!.results as ColumnRow[]).map(toColumn),
    cards: await toCards(db, cardRows, userId),
  };
}

async function toCards(db: D1Database, rows: CardRow[], userId: string): Promise<BoardCard[]> {
  const projectIds = [...new Set(rows.map((r) => r.project_id).filter((v): v is string => v !== null))];
  const projects = new Map<string, Awaited<ReturnType<typeof rowsToCards>>[number]>();
  if (projectIds.length) {
    const { results } = await db
      .prepare(`${PROJECT_SELECT} WHERE p.id IN (${projectIds.map(() => "?").join(",")}) AND p.deleted_at IS NULL`)
      .bind(...projectIds)
      .all<ProjectRow>();
    for (const card of await rowsToCards(db, results, userId)) projects.set(card.id, card);
  }
  return rows.map((r) => ({
    id: r.id,
    columnId: r.column_id,
    position: r.position,
    title: r.title,
    idea: r.idea,
    stage: r.stage,
    isPublic: r.is_public === 1,
    project: r.project_id ? (projects.get(r.project_id) ?? null) : null,
    updatedAt: new Date(r.updated_at).toISOString(),
  }));
}

// ── Columns ──────────────────────────────────────────────────────────────

async function ownColumn(db: D1Database, userId: string, columnId: string): Promise<ColumnRow> {
  const row = await db
    .prepare(`SELECT c.* FROM board_columns c JOIN boards b ON b.id = c.board_id WHERE c.id = ? AND b.user_id = ?`)
    .bind(columnId, userId)
    .first<ColumnRow>();
  if (!row) throw notFound("Column not found");
  return row;
}

export async function createColumn(db: D1Database, userId: string, title: string): Promise<BoardColumn> {
  const boardId = await ensureBoard(db, userId);
  const stats = await db.prepare(`SELECT count(*) AS n, coalesce(max(position), -1) AS maxPos FROM board_columns WHERE board_id = ?`).bind(boardId).first<{ n: number; maxPos: number }>();
  if ((stats?.n ?? 0) >= MAX_COLUMNS) throw new HttpError("conflict", `A board can have up to ${MAX_COLUMNS} columns.`);
  const id = newId("col");
  await db.prepare(`INSERT INTO board_columns (id, board_id, title, position) VALUES (?, ?, ?, ?)`).bind(id, boardId, title.trim(), (stats?.maxPos ?? -1) + 1).run();
  return toColumn((await db.prepare(`SELECT * FROM board_columns WHERE id = ?`).bind(id).first<ColumnRow>())!);
}

export async function updateColumn(
  db: D1Database,
  userId: string,
  columnId: string,
  patch: { title?: string; color?: string | null; collapsed?: boolean; wipLimit?: number | null },
): Promise<BoardColumn> {
  await ownColumn(db, userId, columnId);
  if (patch.color !== undefined && patch.color !== null && !COLOR_RE.test(patch.color)) {
    throw new HttpError("invalid_request", "Column colors are palette tokens: pixel-0 … pixel-15");
  }
  const sets: string[] = [];
  const binds: unknown[] = [];
  if (patch.title !== undefined) { sets.push("title = ?"); binds.push(patch.title.trim()); }
  if (patch.color !== undefined) { sets.push("color = ?"); binds.push(patch.color); }
  if (patch.collapsed !== undefined) { sets.push("collapsed = ?"); binds.push(patch.collapsed ? 1 : 0); }
  if (patch.wipLimit !== undefined) { sets.push("wip_limit = ?"); binds.push(patch.wipLimit); }
  if (sets.length) await db.prepare(`UPDATE board_columns SET ${sets.join(", ")} WHERE id = ?`).bind(...binds, columnId).run();
  return toColumn((await db.prepare(`SELECT * FROM board_columns WHERE id = ?`).bind(columnId).first<ColumnRow>())!);
}

/** Deleting a column moves its cards to the end of the first remaining column. */
export async function deleteColumn(db: D1Database, userId: string, columnId: string): Promise<void> {
  const col = await ownColumn(db, userId, columnId);
  const others = await db.prepare(`SELECT id FROM board_columns WHERE board_id = ? AND id != ? ORDER BY position`).bind(col.board_id, columnId).all<{ id: string }>();
  const target = others.results[0];
  if (!target) throw new HttpError("conflict", "A board needs at least one column.");
  const moving = await db.prepare(`SELECT id FROM board_cards WHERE column_id = ? ORDER BY position`).bind(columnId).all<{ id: string }>();
  const end = (await db.prepare(`SELECT coalesce(max(position), -1) AS p FROM board_cards WHERE column_id = ?`).bind(target.id).first<{ p: number }>())?.p ?? -1;
  await db.batch([
    ...moving.results.map((c, i) => db.prepare(`UPDATE board_cards SET column_id = ?, position = ? WHERE id = ?`).bind(target.id, end + 1 + i, c.id)),
    db.prepare(`DELETE FROM board_columns WHERE id = ?`).bind(columnId),
    ...others.results.map((c, i) => db.prepare(`UPDATE board_columns SET position = ? WHERE id = ?`).bind(i, c.id)),
  ]);
}

export async function reorderColumns(db: D1Database, userId: string, columnIds: string[]): Promise<BoardColumn[]> {
  const boardId = await ensureBoard(db, userId);
  const { results } = await db.prepare(`SELECT id FROM board_columns WHERE board_id = ?`).bind(boardId).all<{ id: string }>();
  const current = new Set(results.map((r) => r.id));
  if (columnIds.length !== current.size || new Set(columnIds).size !== columnIds.length || !columnIds.every((id) => current.has(id))) {
    throw new HttpError("invalid_request", "Send every column id on the board exactly once.");
  }
  await db.batch(columnIds.map((id, position) => db.prepare(`UPDATE board_columns SET position = ? WHERE id = ?`).bind(position, id)));
  const { results: cols } = await db.prepare(`SELECT * FROM board_columns WHERE board_id = ? ORDER BY position`).bind(boardId).all<ColumnRow>();
  return cols.map(toColumn);
}

// ── Cards ────────────────────────────────────────────────────────────────

async function ownCard(db: D1Database, userId: string, cardId: string): Promise<CardRow> {
  const row = await db
    .prepare(`SELECT c.* FROM board_cards c JOIN boards b ON b.id = c.board_id WHERE c.id = ? AND b.user_id = ?`)
    .bind(cardId, userId)
    .first<CardRow>();
  if (!row) throw notFound("Card not found");
  return row;
}

async function assertWipRoom(db: D1Database, column: ColumnRow, excludingCardId: string | null) {
  if (column.wip_limit === null) return;
  const n = (await db.prepare(`SELECT count(*) AS n FROM board_cards WHERE column_id = ? AND id != ?`).bind(column.id, excludingCardId ?? "").first<{ n: number }>())?.n ?? 0;
  if (n >= column.wip_limit) throw new HttpError("conflict", `"${column.title}" is at its limit of ${column.wip_limit} cards.`, { wipLimit: column.wip_limit });
}

async function oneCard(db: D1Database, userId: string, cardId: string): Promise<BoardCard> {
  const row = await db.prepare(`SELECT * FROM board_cards WHERE id = ?`).bind(cardId).first<CardRow>();
  return (await toCards(db, [row!], userId))[0]!;
}

export async function createCard(
  db: D1Database,
  userId: string,
  input: { columnId: string; title: string; idea: string | null; projectId: string | null },
  opts: { ignoreWipLimit?: boolean } = {},
): Promise<BoardCard> {
  const column = await ownColumn(db, userId, input.columnId);
  if (!opts.ignoreWipLimit) await assertWipRoom(db, column, null);
  const total = (await db.prepare(`SELECT count(*) AS n FROM board_cards WHERE board_id = ?`).bind(column.board_id).first<{ n: number }>())?.n ?? 0;
  if (total >= MAX_CARDS) throw new HttpError("conflict", `A board can hold up to ${MAX_CARDS} cards.`);

  let stage: ProjectStage = "wip";
  let isPublic = false;
  if (input.projectId) {
    const project = await db
      .prepare(`SELECT id, stage, is_public FROM projects WHERE id = ? AND owner_id = ? AND deleted_at IS NULL`)
      .bind(input.projectId, userId)
      .first<{ id: string; stage: ProjectStage; is_public: number }>();
    if (!project) throw new HttpError("invalid_request", "You can only add your own projects to your Studio.");
    const linked = await db.prepare(`SELECT 1 FROM board_cards WHERE project_id = ?`).bind(project.id).first();
    if (linked) throw new HttpError("conflict", "That project already has a Studio card.");
    stage = project.stage;
    isPublic = project.is_public === 1;
  }
  const end = (await db.prepare(`SELECT coalesce(max(position), -1) AS p FROM board_cards WHERE column_id = ?`).bind(column.id).first<{ p: number }>())?.p ?? -1;
  const id = newId("card");
  await db
    .prepare(
      `INSERT INTO board_cards (id, board_id, column_id, project_id, title, idea, stage, is_public, position, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(id, column.board_id, column.id, input.projectId, input.title.trim(), input.idea, stage, isPublic ? 1 : 0, end + 1, Date.now(), Date.now())
    .run();
  return oneCard(db, userId, id);
}

/**
 * Edits a card. For a linked project the stage and Public/Private toggle are the
 * project's own (publishing from any column shows the stage on the public card).
 */
export async function updateCard(
  db: D1Database,
  userId: string,
  cardId: string,
  patch: { title?: string; idea?: string | null; stage?: ProjectStage; isPublic?: boolean },
): Promise<BoardCard> {
  const card = await ownCard(db, userId, cardId);
  const statements: D1PreparedStatement[] = [];
  const sets: string[] = ["updated_at = ?"];
  const binds: unknown[] = [Date.now()];
  if (patch.title !== undefined) { sets.push("title = ?"); binds.push(patch.title.trim()); }
  if (patch.idea !== undefined) { sets.push("idea = ?"); binds.push(patch.idea); }
  if (patch.stage !== undefined) { sets.push("stage = ?"); binds.push(patch.stage); }

  if (patch.isPublic !== undefined) {
    if (patch.isPublic && !card.project_id) {
      throw new HttpError("bad_request", "Link a GitHub repo before publishing. Ideas without a repo stay private for now.");
    }
    sets.push("is_public = ?");
    binds.push(patch.isPublic ? 1 : 0);
  }
  statements.push(db.prepare(`UPDATE board_cards SET ${sets.join(", ")} WHERE id = ?`).bind(...binds, cardId));

  if (card.project_id && (patch.stage !== undefined || patch.isPublic !== undefined)) {
    const project = await db.prepare(`SELECT repo_url, published_at FROM projects WHERE id = ?`).bind(card.project_id).first<{ repo_url: string | null; published_at: number | null }>();
    const psets: string[] = ["updated_at = ?"];
    const pbinds: unknown[] = [Date.now()];
    if (patch.stage !== undefined) { psets.push("stage = ?"); pbinds.push(patch.stage); }
    if (patch.isPublic !== undefined) {
      const pub = patch.isPublic && project?.repo_url != null;
      psets.push("is_public = ?");
      pbinds.push(pub ? 1 : 0);
      if (pub && !project?.published_at) { psets.push("published_at = ?"); pbinds.push(Date.now()); }
    }
    statements.push(db.prepare(`UPDATE projects SET ${psets.join(", ")} WHERE id = ?`).bind(...pbinds, card.project_id));
  }
  await db.batch(statements);
  if (card.project_id) await syncProjectSearch(db, card.project_id);
  return oneCard(db, userId, cardId);
}

/** Move a card to `position` in `columnId` (same board), renumbering both columns. */
export async function moveCard(db: D1Database, userId: string, cardId: string, columnId: string, position: number): Promise<BoardCard> {
  const card = await ownCard(db, userId, cardId);
  const target = await ownColumn(db, userId, columnId);
  if (target.board_id !== card.board_id) throw notFound("Column not found");
  if (target.id !== card.column_id) await assertWipRoom(db, target, card.id);

  const { results: targetCards } = await db
    .prepare(`SELECT id FROM board_cards WHERE column_id = ? AND id != ? ORDER BY position`)
    .bind(target.id, card.id)
    .all<{ id: string }>();
  const order = targetCards.map((c) => c.id);
  order.splice(Math.min(position, order.length), 0, card.id);

  const statements = order.map((id, i) =>
    id === card.id
      ? db.prepare(`UPDATE board_cards SET column_id = ?, position = ?, updated_at = ? WHERE id = ?`).bind(target.id, i, Date.now(), id)
      : db.prepare(`UPDATE board_cards SET position = ? WHERE id = ?`).bind(i, id),
  );
  if (target.id !== card.column_id) {
    const { results: sourceCards } = await db.prepare(`SELECT id FROM board_cards WHERE column_id = ? AND id != ? ORDER BY position`).bind(card.column_id, card.id).all<{ id: string }>();
    statements.push(...sourceCards.map((c, i) => db.prepare(`UPDATE board_cards SET position = ? WHERE id = ?`).bind(i, c.id)));
  }
  await db.batch(statements);
  return oneCard(db, userId, cardId);
}

export async function deleteCard(db: D1Database, userId: string, cardId: string): Promise<void> {
  const card = await ownCard(db, userId, cardId);
  const { results } = await db.prepare(`SELECT id FROM board_cards WHERE column_id = ? AND id != ? ORDER BY position`).bind(card.column_id, cardId).all<{ id: string }>();
  await db.batch([
    db.prepare(`DELETE FROM board_cards WHERE id = ?`).bind(cardId),
    ...results.map((c, i) => db.prepare(`UPDATE board_cards SET position = ? WHERE id = ?`).bind(i, c.id)),
  ]);
}

// ── Planning tools ───────────────────────────────────────────────────────

type StoredPlan = Omit<ProjectPlan, "cardId" | "roadmap">;
const EMPTY_PLAN: StoredPlan = { checklist: [], notesMd: "", lookingForHelp: null, savedPrompts: [], githubIssuesSync: false };

export async function getPlan(db: D1Database, userId: string, cardId: string): Promise<ProjectPlan> {
  const card = await ownCard(db, userId, cardId);
  const stored: StoredPlan = { ...EMPTY_PLAN, ...(card.plan ? (JSON.parse(card.plan) as Partial<StoredPlan>) : {}) };
  const { results } = await db
    .prepare(`SELECT id, title, status, votes FROM roadmap_items WHERE card_id = ? ORDER BY position`)
    .bind(cardId)
    .all<ProjectPlan["roadmap"][number]>();
  return { cardId, ...stored, roadmap: results };
}

export async function updatePlan(db: D1Database, userId: string, cardId: string, patch: Partial<Omit<ProjectPlan, "cardId">>): Promise<ProjectPlan> {
  const card = await ownCard(db, userId, cardId);
  const current = await getPlan(db, userId, cardId);
  const { roadmap, ...rest } = patch;
  const next: StoredPlan = {
    checklist: rest.checklist ?? current.checklist,
    notesMd: rest.notesMd ?? current.notesMd,
    lookingForHelp: rest.lookingForHelp !== undefined ? rest.lookingForHelp : current.lookingForHelp,
    savedPrompts: rest.savedPrompts ?? current.savedPrompts,
    githubIssuesSync: rest.githubIssuesSync ?? current.githubIssuesSync,
  };
  const statements = [db.prepare(`UPDATE board_cards SET plan = ?, updated_at = ? WHERE id = ?`).bind(JSON.stringify(next), Date.now(), cardId)];

  if (roadmap) {
    // Votes belong to visitors; editing a roadmap keeps the counts of items that survive.
    const kept = new Set(roadmap.map((r) => r.id));
    for (const old of current.roadmap) if (!kept.has(old.id)) statements.push(db.prepare(`DELETE FROM roadmap_items WHERE id = ? AND card_id = ?`).bind(old.id, cardId));
    const existing = new Set(current.roadmap.map((r) => r.id));
    roadmap.slice(0, 50).forEach((item, position) => {
      statements.push(
        existing.has(item.id)
          ? db.prepare(`UPDATE roadmap_items SET title = ?, status = ?, position = ? WHERE id = ? AND card_id = ?`).bind(item.title, item.status, position, item.id, cardId)
          : db.prepare(`INSERT INTO roadmap_items (id, card_id, title, status, position) VALUES (?, ?, ?, ?, ?)`).bind(newId("rm"), cardId, item.title, item.status, position),
      );
    });
  }
  if (card.project_id && rest.lookingForHelp !== undefined) {
    statements.push(db.prepare(`UPDATE projects SET looking_for_help = ?, updated_at = ? WHERE id = ?`).bind(rest.lookingForHelp, Date.now(), card.project_id));
  }
  await db.batch(statements);
  return getPlan(db, userId, cardId);
}

/** Public roadmap upvote on a listed project's Studio card. */
export async function voteRoadmapItem(db: D1Database, userId: string, projectSlug: string, itemId: string): Promise<number> {
  const item = await db
    .prepare(
      `SELECT r.id FROM roadmap_items r
       JOIN board_cards c ON c.id = r.card_id
       JOIN projects p ON p.id = c.project_id
       WHERE r.id = ? AND p.slug = ? AND p.is_public = 1 AND p.deleted_at IS NULL`,
    )
    .bind(itemId, projectSlug)
    .first<{ id: string }>();
  if (!item) throw notFound("Roadmap item not found");
  const results = await db.batch<{ votes: number }>([
    db.prepare(`INSERT OR IGNORE INTO votes (user_id, target_type, target_id, value) VALUES (?, 'roadmap_item', ?, 1)`).bind(userId, itemId),
    db.prepare(`UPDATE roadmap_items SET votes = (SELECT count(*) FROM votes WHERE target_type = 'roadmap_item' AND target_id = ?1) WHERE id = ?1`).bind(itemId),
    db.prepare(`SELECT votes FROM roadmap_items WHERE id = ?`).bind(itemId),
  ]);
  return results[2]?.results[0]?.votes ?? 0;
}
