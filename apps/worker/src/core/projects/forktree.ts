/**
 * Task 3.6: the fork tree. Starts at the oldest ancestor of the project, then
 * walks down the lineage. Only listed projects (and the viewer's own) appear;
 * a hidden fork hides its subtree too. Capped for very large families.
 */
import type { ForkTree, ForkTreeNode } from "@forkvlift/shared";
import { notFound } from "../errors";
import { authorOf, LISTED, PROJECT_SELECT, type ProjectRow } from "./rows";

const MAX_NODES = 200;
const MAX_DEPTH = 6;
const MAX_ANCESTORS = 20;

export async function getForkTree(db: D1Database, slug: string, viewerId: string | null): Promise<ForkTree> {
  const visible = `(${LISTED} OR (p.owner_id IS NOT NULL AND p.owner_id = ?))`;
  const start = await db.prepare(`${PROJECT_SELECT} WHERE p.slug = ? AND p.deleted_at IS NULL AND ${visible}`).bind(slug, viewerId).first<ProjectRow>();
  if (!start) throw notFound("Project not found");

  // Up to the root (stop at the first ancestor we can't show).
  let root = start;
  for (let i = 0; i < MAX_ANCESTORS; i++) {
    const parent = await db
      .prepare(`${PROJECT_SELECT} WHERE p.id = (SELECT parent_id FROM forks WHERE child_id = ?) AND p.deleted_at IS NULL AND ${visible}`)
      .bind(root.id, viewerId)
      .first<ProjectRow>();
    if (!parent || parent.id === start.id) break;
    root = parent;
  }

  // Down, breadth-first.
  const ref = (r: ProjectRow) => ({ id: r.id, slug: r.slug, name: r.name, author: authorOf(r) });
  const rootNode: ForkTreeNode = { project: ref(root), children: [] };
  let frontier: ForkTreeNode[] = [rootNode];
  const seen = new Set([root.id]);
  let total = 1;
  for (let depth = 0; depth < MAX_DEPTH && frontier.length && total < MAX_NODES; depth++) {
    const ids = frontier.map((n) => n.project.id);
    const { results: edges } = await db
      .prepare(`SELECT child_id, parent_id FROM forks WHERE parent_id IN (${ids.map(() => "?").join(",")})`)
      .bind(...ids)
      .all<{ child_id: string; parent_id: string }>();
    const childIds = edges.map((e) => e.child_id).filter((id) => !seen.has(id));
    if (!childIds.length) break;
    const { results } = await db
      .prepare(`${PROJECT_SELECT} WHERE p.id IN (${childIds.map(() => "?").join(",")}) AND p.deleted_at IS NULL AND ${visible} ORDER BY p.stars DESC, p.upvotes DESC LIMIT ?`)
      .bind(...childIds, viewerId, MAX_NODES - total)
      .all<ProjectRow>();
    const parentOf = new Map(edges.map((e) => [e.child_id, e.parent_id]));
    const next: ForkTreeNode[] = [];
    for (const r of results) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const parent = frontier.find((n) => n.project.id === parentOf.get(r.id));
      if (!parent) continue;
      const node: ForkTreeNode = { project: ref(r), children: [] };
      parent.children.push(node);
      next.push(node);
      total++;
    }
    frontier = next;
  }
  return { root: rootNode, total };
}
